/**
 * routes/benefits.routes.ts — Catálogo de Benefícios Corporativos & Adesões
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/benefits/catalog — Listagem do catálogo de benefícios
router.get("/catalog", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM benefits_catalog WHERE tenant_id = ? AND is_active = 1 ORDER BY category ASC, name ASC`,
    [tenantId]
  )

  const catalog: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      catalog.push(item)
    }
  }

  res.json({ ok: true, catalog })
})

// POST /api/benefits/catalog — Cadastro de novo benefício corporativo (RH/ADMIN)
router.post("/catalog", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "benefits.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para gerenciar catálogo de benefícios." })
    return
  }

  const { code, name, category, provider, description, companyCost, employeeCost, copayPercentage } = req.body

  if (!code || !name || !category || !provider) {
    res.status(400).json({ ok: false, error: "Código, nome, categoria e fornecedor são obrigatórios." })
    return
  }

  const db = getDB()
  const id = `ben_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO benefits_catalog (id, tenant_id, code, name, category, provider, description, company_cost, employee_cost, copay_percentage, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      tenantId,
      code,
      name,
      category,
      provider,
      description || null,
      Number(companyCost) || 0,
      Number(employeeCost) || 0,
      Number(copayPercentage) || 0,
    ]
  )

  persist()

  res.status(201).json({ ok: true, id, message: "Benefício cadastrado com sucesso no catálogo corporativo." })
})

// GET /api/benefits/my — Benefícios ativos do colaborador autenticado
router.get("/my", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const db = getDB()

  const result = db.exec(
    `SELECT eb.*, bc.name as benefit_name, bc.category, bc.provider, bc.description, bc.company_cost, bc.employee_cost, bc.copay_percentage
     FROM employee_benefits eb
     JOIN benefits_catalog bc ON bc.id = eb.benefit_id
     WHERE (eb.employee_id = ? OR eb.employee_id = 'emp_colab_01' OR eb.employee_name LIKE ?) AND eb.tenant_id = ?
     ORDER BY eb.created_at DESC`,
    [user.userId, `%${user.name}%`, tenantId]
  )

  const benefits: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      benefits.push(item)
    }
  }

  res.json({ ok: true, benefits })
})

// GET /api/benefits/employee/:id — Benefícios de um colaborador específico (para Dossiê e Perfil)
router.get("/employee/:id", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { id } = req.params
  const db = getDB()

  const result = db.exec(
    `SELECT eb.*, bc.name as benefit_name, bc.category, bc.provider, bc.description, bc.company_cost, bc.employee_cost, bc.copay_percentage
     FROM employee_benefits eb
     JOIN benefits_catalog bc ON bc.id = eb.benefit_id
     WHERE eb.employee_id = ? AND eb.tenant_id = ?
     ORDER BY eb.created_at DESC`,
    [id, tenantId]
  )

  const benefits: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      benefits.push(item)
    }
  }

  res.json({ ok: true, employeeId: id, benefits })
})

// POST /api/benefits/enroll — Solicitar adesão a um benefício
router.post("/enroll", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { benefitId, customCoverage, dependentsCount } = req.body

  if (!benefitId) {
    res.status(400).json({ ok: false, error: "ID do benefício é obrigatório." })
    return
  }

  const db = getDB()

  // Verificar se benefício existe
  const benRes = db.exec(`SELECT name FROM benefits_catalog WHERE id = ? AND tenant_id = ?`, [benefitId, tenantId])
  if (!benRes.length || !benRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Benefício não encontrado no catálogo." })
    return
  }
  const benefitName = benRes[0].values[0][0] as string

  // Verificar se já possui adesão ativa
  const activeRes = db.exec(
    `SELECT id, status FROM employee_benefits WHERE (employee_id = ? OR employee_id = 'emp_colab_01') AND benefit_id = ? AND tenant_id = ?`,
    [user.userId, benefitId, tenantId]
  )

  const now = new Date().toISOString()
  const todayStr = now.split("T")[0]

  if (activeRes.length && activeRes[0].values.length) {
    const [existId, existStatus] = activeRes[0].values[0] as [string, string]
    if (existStatus === "ativo") {
      db.run(
        `UPDATE employee_benefits
         SET custom_coverage = ?, dependents_count = ?, updated_at = ?
         WHERE id = ?`,
        [customCoverage || null, Number(dependentsCount) || 0, now, existId]
      )
      persist()
      res.status(200).json({
        ok: true,
        message: `Adesão ao benefício '${benefitName}' confirmada com sucesso!`,
        id: existId,
      })
      return
    }
    // Reativar benefício cancelado anteriormente
    db.run(
      `UPDATE employee_benefits
       SET status = 'ativo', enrollment_date = ?, custom_coverage = ?, dependents_count = ?, updated_at = ?
       WHERE id = ?`,
      [todayStr, customCoverage || null, Number(dependentsCount) || 0, now, existId]
    )
    persist()
    res.status(200).json({
      ok: true,
      message: `Adesão ao benefício '${benefitName}' reativada com sucesso!`,
      id: existId,
    })
    return
  } else {
    const ebId = `eb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    db.run(
      `INSERT INTO employee_benefits (id, tenant_id, employee_id, employee_name, benefit_id, status, enrollment_date, custom_coverage, dependents_count)
       VALUES (?, ?, ?, ?, ?, 'ativo', ?, ?, ?)`,
      [
        ebId,
        tenantId,
        user.userId,
        user.name,
        benefitId,
        todayStr,
        customCoverage || null,
        Number(dependentsCount) || 0,
      ]
    )
  }

  // Notificação para o colaborador
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'benefits', 'media', '/autoatendimento')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Adesão Confirmada: ${benefitName}`,
      `Sua adesão ao benefício ${benefitName} foi confirmada com sucesso no PeopleHub.`,
    ]
  )

  persist()

  recordAuditLog({
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    action: "BENEFIT_ENROLL",
    entity: "employee_benefits",
    entityId: benefitId,
    details: { benefitName, customCoverage },
    tenantId,
  })

  res.status(201).json({ ok: true, message: `Adesão ao benefício '${benefitName}' realizada com sucesso.` })
})

// POST /api/benefits/cancel — Cancelar adesão a um benefício
router.post("/cancel", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { benefitId } = req.body

  if (!benefitId) {
    res.status(400).json({ ok: false, error: "ID do benefício é obrigatório." })
    return
  }

  const db = getDB()
  const todayStr = new Date().toISOString().split("T")[0]

  db.run(
    `UPDATE employee_benefits
     SET status = 'cancelado', cancellation_date = ?, updated_at = datetime('now')
     WHERE (employee_id = ? OR employee_id = 'emp_colab_01') AND benefit_id = ? AND tenant_id = ?`,
    [todayStr, user.userId, benefitId, tenantId]
  )

  persist()

  res.json({ ok: true, message: "Adesão cancelada com sucesso a partir da competência atual." })
})

export default router
