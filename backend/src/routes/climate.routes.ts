/**
 * routes/climate.routes.ts — Pesquisas de Clima Organizacional & Cálculo Matemático de eNPS
 */
import { Router, type Request, type Response } from "express"
import crypto from "crypto"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/climate/surveys — Listagem de pesquisas de clima
router.get("/surveys", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM climate_surveys WHERE tenant_id = ? ORDER BY start_date DESC`,
    [tenantId]
  )

  const surveys: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })

      // Contagem de respostas
      const respCount = db.exec(`SELECT count(*) FROM survey_responses WHERE survey_id = ?`, [item.id])
      item.responsesCount = respCount.length ? Number(respCount[0].values[0][0]) : 0
      surveys.push(item)
    }
  }

  res.json({ ok: true, surveys })
})

// POST /api/climate/surveys — Criar nova pesquisa de clima (RH/ADMIN)
router.post("/surveys", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "climate.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para criar pesquisas de clima." })
    return
  }

  const { title, description, startDate, endDate, targetDepartment } = req.body

  if (!title || !startDate || !endDate) {
    res.status(400).json({ ok: false, error: "Título, data de início e término são obrigatórios." })
    return
  }

  const db = getDB()
  const id = `surv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO climate_surveys (id, tenant_id, title, description, start_date, end_date, status, is_anonymous, target_department, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, 'aberta', 1, ?, ?)`,
    [id, tenantId, title, description || null, startDate, endDate, targetDepartment || "Todos", user.name]
  )

  // Notificar toda a empresa
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'climate', 'alta', '/clima')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Nova Pesquisa de Clima & eNPS Aberta!`,
      `Sua opinião constrói nossa cultura. Participe anonimamente da pesquisa '${title}'.`,
    ]
  )

  persist()

  res.status(201).json({ ok: true, id, message: "Pesquisa de clima criada com sucesso." })
})

// GET /api/climate/surveys/:id/dashboard — Cálculo do eNPS e estatísticas
router.get("/surveys/:id/dashboard", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  // Buscar dados da pesquisa
  const survRes = db.exec(`SELECT * FROM climate_surveys WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!survRes.length || !survRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Pesquisa não encontrada." })
    return
  }

  const survey: any = {}
  survRes[0].columns.forEach((c, idx) => { survey[c] = survRes[0].values[0][idx] })

  // Buscar todas as respostas
  const respRes = db.exec(`SELECT nps_score, comment, ratings_json, submitted_at FROM survey_responses WHERE survey_id = ?`, [id])

  let totalResponses = 0
  let promoters = 0 // notas 9 e 10
  let passives = 0  // notas 7 e 8
  let detractors = 0 // notas 0 a 6

  const dimensionTotals: Record<string, { sum: number; count: number }> = {
    lideranca: { sum: 0, count: 0 },
    ambiente: { sum: 0, count: 0 },
    beneficios: { sum: 0, count: 0 },
    oportunidades: { sum: 0, count: 0 },
  }

  const comments: string[] = []
  const scoreDistribution: Record<number, number> = {}
  for (let i = 0; i <= 10; i++) scoreDistribution[i] = 0

  if (respRes.length && respRes[0].values.length) {
    totalResponses = respRes[0].values.length
    for (const row of respRes[0].values) {
      const score = Number(row[0])
      const comment = row[1] as string | null
      const ratingsJson = row[2] as string | null

      if (score >= 9) promoters++
      else if (score >= 7) passives++
      else detractors++

      scoreDistribution[score] = (scoreDistribution[score] || 0) + 1

      if (comment && comment.trim()) {
        comments.push(comment.trim())
      }

      if (ratingsJson) {
        try {
          const parsed = JSON.parse(ratingsJson)
          Object.keys(parsed).forEach((k) => {
            if (!dimensionTotals[k]) dimensionTotals[k] = { sum: 0, count: 0 }
            dimensionTotals[k].sum += Number(parsed[k]) || 0
            dimensionTotals[k].count += 1
          })
        } catch {}
      }
    }
  }

  // Cálculo eNPS padrão de mercado = (% Promotores - % Detratores)
  const pctPromoters = totalResponses > 0 ? Number(((promoters / totalResponses) * 100).toFixed(1)) : 0
  const pctPassives = totalResponses > 0 ? Number(((passives / totalResponses) * 100).toFixed(1)) : 0
  const pctDetractors = totalResponses > 0 ? Number(((detractors / totalResponses) * 100).toFixed(1)) : 0
  const enpsScore = Math.round(pctPromoters - pctDetractors)

  // Zona de classificação eNPS
  let zoneLabel = "Zona Crítica"
  let zoneColor = "#ef4444"
  if (enpsScore >= 75) {
    zoneLabel = "Zona de Excelência"
    zoneColor = "#10b981"
  } else if (enpsScore >= 50) {
    zoneLabel = "Zona de Qualidade"
    zoneColor = "#3b82f6"
  } else if (enpsScore >= 0) {
    zoneLabel = "Zona de Aperfeiçoamento"
    zoneColor = "#f59e0b"
  }

  const dimensionAverages: Record<string, number> = {}
  Object.keys(dimensionTotals).forEach((dim) => {
    const item = dimensionTotals[dim]
    dimensionAverages[dim] = item.count > 0 ? Number((item.sum / item.count).toFixed(2)) : 0
  })

  res.json({
    ok: true,
    survey,
    enps: {
      score: enpsScore,
      zoneLabel,
      zoneColor,
      totalResponses,
      counts: {
        promoters,
        passives,
        detractors,
      },
      percentages: {
        promoters: pctPromoters,
        passives: pctPassives,
        detractors: pctDetractors,
      },
      scoreDistribution,
      dimensionAverages,
      commentsCount: comments.length,
      sampleComments: comments.slice(0, 10),
    },
  })
})

// POST /api/climate/surveys/:id/respond — Submeter resposta anônima
router.post("/surveys/:id/respond", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { npsScore, comment, ratings } = req.body

  const scoreNum = Number(npsScore)
  if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
    res.status(400).json({ ok: false, error: "A nota do eNPS deve ser um número inteiro de 0 a 10." })
    return
  }

  const db = getDB()

  // Hash criptográfico irreversível para garantir 1 voto por pessoa sem expor a identidade
  const respondentHash = crypto
    .createHash("sha256")
    .update(`${id}_${user.userId}_${process.env.JWT_SECRET || "salt_rh_enps"}`)
    .digest("hex")

  // Checar se já votou
  const existRes = db.exec(
    `SELECT id FROM survey_responses WHERE survey_id = ? AND respondent_hash = ?`,
    [id, respondentHash]
  )

  if (existRes.length && existRes[0].values.length) {
    res.status(409).json({ ok: false, error: "Você já respondeu a esta pesquisa de clima." })
    return
  }

  const respId = `sr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO survey_responses (id, survey_id, tenant_id, nps_score, comment, ratings_json, respondent_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      respId,
      id,
      tenantId,
      scoreNum,
      comment ? String(comment).trim() : null,
      JSON.stringify(ratings || {}),
      respondentHash,
    ]
  )

  persist()

  res.status(201).json({
    ok: true,
    message: "Sua resposta foi registrada com total garantia de sigilo e anonimato. Muito obrigado!",
  })
})

export default router
