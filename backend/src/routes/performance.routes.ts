/**
 * routes/performance.routes.ts — Avaliação de Desempenho, Competências & Metas
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/performance/cycles — Listagem de ciclos avaliativos
router.get("/cycles", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM performance_cycles WHERE tenant_id = ? ORDER BY start_date DESC`,
    [tenantId]
  )

  const cycles: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      try {
        item.departments = JSON.parse(item.departments_json || "[]")
      } catch {
        item.departments = []
      }

      // Buscar critérios do ciclo
      const critRes = db.exec(
        `SELECT * FROM evaluation_criteria WHERE cycle_id = ? AND tenant_id = ?`,
        [item.id, tenantId]
      )
      const criteria: any[] = []
      if (critRes.length && critRes[0].values.length) {
        const cCols = critRes[0].columns
        for (const cRow of critRes[0].values) {
          const crit: any = {}
          cCols.forEach((c, idx) => {
            crit[c] = cRow[idx]
          })
          criteria.push(crit)
        }
      }
      item.criteria = criteria
      cycles.push(item)
    }
  }

  res.json({ ok: true, cycles })
})

// POST /api/performance/cycles — Criar novo ciclo de avaliação
router.post("/cycles", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "performance.create_cycle")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para criar ciclos de avaliação." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { title, description, startDate, endDate, departments, criteria } = req.body

  if (!title || !startDate || !endDate) {
    res.status(400).json({ ok: false, error: "Título, data de início e término são obrigatórios." })
    return
  }

  const db = getDB()
  const cycleId = `cycle_${Date.now()}`

  db.run(
    `INSERT INTO performance_cycles (id, tenant_id, title, description, start_date, end_date, departments_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto')`,
    [
      cycleId,
      tenantId,
      title,
      description || null,
      startDate,
      endDate,
      JSON.stringify(departments || []),
    ]
  )

  if (Array.isArray(criteria)) {
    criteria.forEach((c: any, idx: number) => {
      const critId = `crit_${Date.now()}_${idx}`
      db.run(
        `INSERT INTO evaluation_criteria (id, cycle_id, tenant_id, name, description, category, weight, scale_max)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          critId,
          cycleId,
          tenantId,
          c.name,
          c.description || null,
          c.category || "Geral",
          Number(c.weight) || 1.0,
          Number(c.scaleMax) || 5,
        ]
      )
    })
  }

  // Notificação corporativa de abertura do ciclo
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'performance', 'alta', ?)`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Novo Ciclo de Avaliação Aberto: ${title}`,
      `O ciclo ${title} foi iniciado. Acesse o módulo de desempenho para preencher sua avaliação.`,
      `/desempenho`,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "PERFORMANCE_CYCLE_CREATE",
    entity: "performance_cycles",
    entityId: cycleId,
    details: { title, startDate, endDate, criteriaCount: criteria?.length || 0 },
    tenantId,
  })

  res.status(201).json({ ok: true, id: cycleId, message: "Ciclo de avaliação criado com sucesso." })
})

// GET /api/performance/evaluations — Listagem de avaliações conforme escopo
router.get("/evaluations", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const userRole = req.access?.role || "COLABORADOR"
  const userId = req.access?.userId
  const { cycleId, employeeId } = req.query
  const db = getDB()

  let sql = `SELECT * FROM evaluations WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (cycleId) {
    sql += ` AND cycle_id = ?`
    params.push(String(cycleId))
  }

  // Restrição de escopo de dados (COLABORADOR só vê as suas)
  if (userRole === "COLABORADOR") {
    sql += ` AND (employee_id = ? OR evaluator_id = ?)`
    params.push(userId, userId)
  } else if (employeeId) {
    sql += ` AND employee_id = ?`
    params.push(String(employeeId))
  }

  sql += ` ORDER BY submitted_at DESC, updated_at DESC`

  const result = db.exec(sql, params)
  const evaluations: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      try {
        item.scores = JSON.parse(item.scores_json || "[]")
      } catch {
        item.scores = []
      }
      evaluations.push(item)
    }
  }

  res.json({ ok: true, evaluations })
})

// POST /api/performance/evaluations/submit — Submeter ou salvar rascunho de avaliação
router.post("/evaluations/submit", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const userRole = req.access?.role || "COLABORADOR"
  const evaluatorId = req.access?.userId || "user_unknown"
  const evaluatorName = req.access?.name || "Avaliador"

  const { cycleId, employeeId, employeeName, type, status, scores, feedbackText } = req.body

  if (!cycleId || !employeeId || !type) {
    res.status(400).json({ ok: false, error: "ID do ciclo, colaborador e tipo são obrigatórios." })
    return
  }

  // Calcular nota final ponderada
  let finalScore = 0
  if (Array.isArray(scores) && scores.length > 0) {
    let totalWeight = 0
    let weightedSum = 0
    for (const s of scores) {
      const w = Number(s.weight) || 1.0
      const score = Number(s.score) || 0
      weightedSum += score * w
      totalWeight += w
    }
    finalScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0
  }

  const db = getDB()
  const now = new Date().toISOString()
  const evalId = `eval_${cycleId}_${employeeId}_${type}`

  // Verificar se já existe registro prévio
  const existRes = db.exec(`SELECT id FROM evaluations WHERE id = ? AND tenant_id = ?`, [evalId, tenantId])

  if (existRes.length && existRes[0].values.length) {
    db.run(
      `UPDATE evaluations
       SET status = ?, scores_json = ?, final_score = ?, feedback_text = ?, submitted_at = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        status || "concluida",
        JSON.stringify(scores || []),
        finalScore,
        feedbackText || null,
        status === "concluida" ? now : null,
        now,
        evalId,
        tenantId,
      ]
    )
  } else {
    db.run(
      `INSERT INTO evaluations (id, cycle_id, tenant_id, employee_id, employee_name, evaluator_id, evaluator_name, type, status, scores_json, final_score, feedback_text, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evalId,
        cycleId,
        tenantId,
        employeeId,
        employeeName || "Colaborador",
        evaluatorId,
        evaluatorName,
        type,
        status || "concluida",
        JSON.stringify(scores || []),
        finalScore,
        feedbackText || null,
        status === "concluida" ? now : null,
        now,
      ]
    )
  }

  // Notificar colaborador se a avaliação foi submetida pelo gestor
  if (type === "gestor" && status === "concluida") {
    db.run(
      `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
       VALUES (?, ?, ?, ?, 'performance', 'media', ?)`,
      [
        `notif_${Date.now()}`,
        tenantId,
        `Avaliação de Desempenho Concluída pelo Gestor`,
        `Seu gestor (${evaluatorName}) concluiu sua avaliação com nota final ${finalScore}.`,
        `/desempenho`,
      ]
    )
  }

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "PERFORMANCE_EVALUATION_SUBMIT",
    entity: "evaluations",
    entityId: evalId,
    details: { cycleId, employeeId, type, status, finalScore },
    tenantId,
  })

  res.json({ ok: true, id: evalId, finalScore, message: "Avaliação registrada com sucesso." })
})

// GET /api/performance/goals — Listagem de Metas Individuais
router.get("/goals", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const userRole = req.access?.role || "COLABORADOR"
  const userId = req.access?.userId
  const { employeeId } = req.query
  const db = getDB()

  let sql = `SELECT * FROM individual_goals WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (userRole === "COLABORADOR") {
    sql += ` AND employee_id = ?`
    params.push(userId)
  } else if (employeeId) {
    sql += ` AND employee_id = ?`
    params.push(String(employeeId))
  }

  sql += ` ORDER BY due_date ASC, created_at DESC`

  const result = db.exec(sql, params)
  const goals: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      goals.push(item)
    }
  }

  res.json({ ok: true, goals })
})

// POST /api/performance/goals — Cadastrar meta individual
router.post("/goals", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { cycleId, employeeId, employeeName, title, description, metricTarget, dueDate, comments } = req.body

  if (!employeeId || !title || !metricTarget) {
    res.status(400).json({ ok: false, error: "Colaborador, título e indicador alvo são obrigatórios." })
    return
  }

  const db = getDB()
  const goalId = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO individual_goals (id, tenant_id, cycle_id, employee_id, employee_name, title, description, metric_target, current_progress, due_date, status, comments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'em_progresso', ?)`,
    [
      goalId,
      tenantId,
      cycleId || null,
      employeeId,
      employeeName || "Colaborador",
      title,
      description || null,
      metricTarget,
      dueDate || null,
      comments || null,
    ]
  )

  persist()

  res.status(201).json({ ok: true, id: goalId, message: "Meta individual cadastrada com sucesso." })
})

// PATCH /api/performance/goals/:id/progress — Atualizar progresso da meta
router.patch("/goals/:id/progress", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { progress, comments } = req.body

  const progressNum = Math.min(100, Math.max(0, Number(progress) || 0))
  const newStatus = progressNum >= 100 ? "concluida" : progressNum > 0 ? "em_progresso" : "pendente"

  const db = getDB()
  db.run(
    `UPDATE individual_goals
     SET current_progress = ?, status = ?, comments = coalesce(?, comments), updated_at = datetime('now')
     WHERE id = ? AND tenant_id = ?`,
    [progressNum, newStatus, comments || null, id, tenantId]
  )

  persist()

  res.json({ ok: true, progress: progressNum, status: newStatus, message: "Progresso da meta atualizado." })
})

export default router
