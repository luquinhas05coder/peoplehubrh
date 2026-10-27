/**
 * routes/trainings.routes.ts — Treinamentos & Desenvolvimento, Normas Regulamentadoras (NRs) e Certificações
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/trainings/catalog — Catálogo de cursos corporativos e NRs
router.get("/catalog", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM trainings WHERE tenant_id = ? ORDER BY is_mandatory DESC, nr_code ASC, title ASC`,
    [tenantId]
  )

  const trainings: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      try { item.targetRoles = JSON.parse(item.target_roles_json || "[]") } catch { item.targetRoles = [] }
      trainings.push(item)
    }
  }

  res.json({ ok: true, trainings })
})

// POST /api/trainings/catalog — Criar novo treinamento (RH/ADMIN)
router.post("/catalog", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "trainings.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para cadastrar treinamentos." })
    return
  }

  const { title, description, category, nrCode, workloadHours, validityMonths, isMandatory, targetRoles } = req.body

  if (!title || !category) {
    res.status(400).json({ ok: false, error: "Título e categoria são obrigatórios." })
    return
  }

  const db = getDB()
  const id = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO trainings (id, tenant_id, title, description, category, nr_code, workload_hours, validity_months, is_mandatory, target_roles_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      title,
      description || null,
      category,
      nrCode || null,
      Number(workloadHours) || 8,
      Number(validityMonths) || 12,
      isMandatory ? 1 : 0,
      JSON.stringify(targetRoles || []),
    ]
  )

  persist()

  res.status(201).json({ ok: true, id, message: "Treinamento cadastrado com sucesso." })
})

// GET /api/trainings/my — Cursos e certificações do colaborador autenticado
router.get("/my", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const db = getDB()

  const result = db.exec(
    `SELECT et.*, t.title as training_title, t.description, t.category, t.nr_code, t.workload_hours, t.validity_months, t.is_mandatory
     FROM employee_trainings et
     JOIN trainings t ON t.id = et.training_id
     WHERE (et.employee_id = ? OR et.employee_id = 'emp_colab_01' OR et.employee_name LIKE ?) AND et.tenant_id = ?
     ORDER BY et.created_at DESC`,
    [user.userId, `%${user.name}%`, tenantId]
  )

  const trainings: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      trainings.push(item)
    }
  }

  res.json({ ok: true, trainings })
})

// POST /api/trainings/enroll — Inscrever-se em treinamento
router.post("/enroll", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { trainingId } = req.body

  if (!trainingId) {
    res.status(400).json({ ok: false, error: "ID do treinamento é obrigatório." })
    return
  }

  const db = getDB()

  // Verificar se já está inscrito
  const checkRes = db.exec(
    `SELECT id, status FROM employee_trainings WHERE (employee_id = ? OR employee_id = 'emp_colab_01') AND training_id = ? AND tenant_id = ?`,
    [user.userId, trainingId, tenantId]
  )

  if (checkRes.length && checkRes[0].values.length) {
    res.status(400).json({ ok: false, error: "Você já está inscrito neste treinamento." })
    return
  }

  const etId = `et_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO employee_trainings (id, tenant_id, employee_id, employee_name, training_id, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'em_andamento', ?)`,
    [etId, tenantId, user.userId, user.name, trainingId, now]
  )

  persist()

  res.status(201).json({ ok: true, id: etId, message: "Inscrição realizada com sucesso! O treinamento já está disponível." })
})

// POST /api/trainings/complete — Concluir treinamento e emitir certificado
router.post("/complete", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { enrollmentId, trainingId, score } = req.body

  const db = getDB()
  const now = new Date()
  const completedAt = now.toISOString()

  // Buscar validade do curso em meses
  const trRes = db.exec(`SELECT validity_months, nr_code, title FROM trainings WHERE id = ? AND tenant_id = ?`, [trainingId, tenantId])
  let validityMonths = 12
  let nrCode = "NR"
  let title = "Treinamento"

  if (trRes.length && trRes[0].values.length) {
    validityMonths = Number(trRes[0].values[0][0]) || 12
    nrCode = (trRes[0].values[0][1] as string) || "NR"
    title = (trRes[0].values[0][2] as string) || "Treinamento"
  }

  const expiryDate = new Date(now)
  expiryDate.setMonth(expiryDate.getMonth() + validityMonths)
  const expiryDateStr = expiryDate.toISOString().split("T")[0]

  const certCode = `CERT-${nrCode.replace(/[^A-Za-z0-9]/g, "")}-${Date.now().toString(36).toUpperCase()}`

  if (enrollmentId) {
    db.run(
      `UPDATE employee_trainings
       SET status = 'concluido', completed_at = ?, expiry_date = ?, score = ?, certificate_code = ?
       WHERE id = ? AND tenant_id = ?`,
      [completedAt, expiryDateStr, Number(score) || 10, certCode, enrollmentId, tenantId]
    )
  } else {
    const etId = `et_${Date.now()}`
    db.run(
      `INSERT INTO employee_trainings (id, tenant_id, employee_id, employee_name, training_id, status, started_at, completed_at, expiry_date, score, certificate_code)
       VALUES (?, ?, ?, ?, ?, 'concluido', ?, ?, ?, ?, ?)`,
      [etId, tenantId, user.userId, user.name, trainingId, completedAt, completedAt, expiryDateStr, Number(score) || 10, certCode]
    )
  }

  // Notificar
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'trainings', 'alta', '/autoatendimento')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Certificado Emitido: ${title}`,
      `Parabéns! Você concluiu '${title}' com nota ${score || 10}. Código do certificado: ${certCode}.`,
    ]
  )

  persist()

  res.json({
    ok: true,
    certificateCode: certCode,
    expiryDate: expiryDateStr,
    message: "Treinamento concluído e certificado corporativo emitido com sucesso!",
  })
})

// GET /api/trainings/compliance — Matriz de conformidade de NRs e treinamentos a vencer
router.get("/compliance", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT et.*, t.title as training_title, t.nr_code, t.category, e.department, e.role
     FROM employee_trainings et
     JOIN trainings t ON t.id = et.training_id
     LEFT JOIN employees e ON e.id = et.employee_id
     WHERE et.tenant_id = ?
     ORDER BY et.expiry_date ASC`,
    [tenantId]
  )

  const items: any[] = []
  const today = new Date()
  let totalValid = 0
  let totalExpiring = 0
  let totalExpired = 0

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })

      if (item.expiry_date) {
        const expDate = new Date(item.expiry_date)
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        item.diffDays = diffDays
        if (diffDays < 0) {
          item.complianceStatus = "vencido"
          totalExpired++
        } else if (diffDays <= 45) {
          item.complianceStatus = "vencendo"
          totalExpiring++
        } else {
          item.complianceStatus = "valido"
          totalValid++
        }
      } else {
        item.complianceStatus = item.status === "concluido" ? "valido" : "em_andamento"
      }
      items.push(item)
    }
  }

  const complianceRate = items.length > 0 ? Math.round((totalValid / items.length) * 100) : 100

  res.json({
    ok: true,
    summary: {
      totalCertificates: items.length,
      totalValid,
      totalExpiring,
      totalExpired,
      complianceRate,
    },
    items,
  })
})

export default router
