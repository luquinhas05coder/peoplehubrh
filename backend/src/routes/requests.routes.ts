/**
 * routes/requests.routes.ts — Gestão de Solicitações & Chamados de RH com Multi-Tenancy e RBAC
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, requirePermission, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()

// Aplicar identificação de tenant e autenticação RBAC em todas as rotas
router.use(resolveTenant)
router.use(authenticateRBAC)

// GET /api/requests
router.get("/", (req: Request, res: Response) => {
  const { status, type, priority, search } = req.query as Record<string, string>
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const scope = req.access?.scope || "OWN"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const userDept = (req.access?.department || "").toLowerCase()

  let sql = `SELECT * FROM requests WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  // Enforçamento estrito de escopo de dados RBAC
  if (scope === "OWN") {
    sql += ` AND (lower(requester) = ? OR lower(requester) = ?)`
    params.push(userName, userEmail)
  } else if (scope === "TEAM") {
    sql += ` AND (lower(department) = ? OR lower(requester) = ? OR lower(requester) = ?)`
    params.push(userDept, userName, userEmail)
  }

  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (type) {
    sql += ` AND type = ?`
    params.push(type)
  }
  if (priority) {
    sql += ` AND priority = ?`
    params.push(priority)
  }
  if (search) {
    sql += ` AND (lower(requester) LIKE lower(?) OR lower(description) LIKE lower(?))`
    params.push(`%${search}%`, `%${search}%`)
  }

  sql += ` ORDER BY id DESC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, requests: [] })
    return
  }

  const columns = result[0].columns
  const requests = result[0].values.map((row) => {
    const reqItem: any = {}
    columns.forEach((col, idx) => {
      reqItem[col] = row[idx]
    })
    if (reqItem.details_json) {
      try {
        reqItem.details = JSON.parse(reqItem.details_json)
      } catch {
        reqItem.details = {}
      }
    }
    delete reqItem.details_json
    return reqItem
  })

  res.json({ ok: true, requests })
})

// POST /api/requests
router.post("/", requirePermission("requests.create"), (req: Request, res: Response) => {
  let { type, requester, department, priority, description, details } = req.body
  const tenantId = req.tenantId || "tenant_default"

  // Se for escopo OWN (Colaborador), garante que o solicitante seja ele mesmo
  if (req.access?.scope === "OWN") {
    requester = req.access.name || req.access.email
    department = req.access.department || "Geral"
  }

  if (!type || !requester || !description) {
    res.status(400).json({ ok: false, error: "Tipo, solicitante e descrição são obrigatórios." })
    return
  }

  const id = `REQ-${Math.floor(100 + Math.random() * 900)}`
  const date = new Date().toISOString().split("T")[0]
  const status = "Em Análise"

  const db = getDB()
  db.run(
    `INSERT INTO requests (id, type, requester, department, date, status, priority, description, details_json, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      type,
      requester,
      department || "Geral",
      date,
      status,
      priority || "Média",
      description,
      details ? JSON.stringify(details) : null,
      tenantId,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "REQUEST_CREATE",
    entity: "requests",
    entityId: id,
    details: { type, requester, department, priority },
    tenantId,
  })

  res.status(201).json({ ok: true, id, message: "Solicitação registrada com sucesso." })
})

// GET /api/requests/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT * FROM requests WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada nesta organização." })
    return
  }

  const columns = result[0].columns
  const reqItem: any = {}
  result[0].values[0].forEach((val, idx) => {
    reqItem[columns[idx]] = val
  })

  // Verificação de escopo
  const scope = req.access?.scope || "OWN"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const userDept = (req.access?.department || "").toLowerCase()
  const reqUser = (reqItem.requester || "").toLowerCase()
  const reqDept = (reqItem.department || "").toLowerCase()

  if (scope === "OWN" && reqUser !== userName && reqUser !== userEmail) {
    res.status(403).json({ ok: false, error: "Acesso negado: Você só pode visualizar suas próprias solicitações." })
    return
  }

  if (scope === "TEAM" && reqDept !== userDept && reqUser !== userName && reqUser !== userEmail) {
    res.status(403).json({ ok: false, error: "Acesso negado: Solicitação fora do escopo da sua equipe." })
    return
  }

  if (reqItem.details_json) {
    try { reqItem.details = JSON.parse(reqItem.details_json) } catch { reqItem.details = {} }
  }
  delete reqItem.details_json

  res.json({ ok: true, request: reqItem })
})

// PATCH /api/requests/:id/status
router.patch("/:id/status", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { status } = req.body

  if (!status) {
    res.status(400).json({ ok: false, error: "Status é obrigatório." })
    return
  }

  const db = getDB()
  const checkRes = db.exec(`SELECT requester, department, status FROM requests WHERE id = ? AND tenant_id = ?`, [String(id), String(tenantId)])
  if (!checkRes.length || !checkRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada." })
    return
  }

  const [requester, department, oldStatus] = checkRes[0].values[0] as [string, string, string]
  const userRole = req.access?.role || "COLABORADOR"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const isSelf = requester.toLowerCase() === userName || requester.toLowerCase() === userEmail

  // Aprovação ou rejeição exige permissão requests.approve
  const isDecision = ["aprovado", "rejeitado", "cancelado"].includes(status.toLowerCase())
  if (isDecision) {
    if (!roleHasPermission(userRole, "requests.approve")) {
      res.status(403).json({
        ok: false,
        error: `Acesso negado: Seu perfil (${userRole}) não possui permissão para aprovar ou rejeitar solicitações.`,
      })
      return
    }

    // Regra anti auto-aprovação: Ninguém pode aprovar sua própria solicitação
    if (isSelf && status.toLowerCase() === "aprovado") {
      res.status(403).json({
        ok: false,
        error: "Violação de Governança: Você não tem permissão para aprovar sua própria solicitação.",
      })
      return
    }

    // Se for GESTOR, só pode aprovar solicitações de sua equipe
    if (req.access?.scope === "TEAM") {
      const userDept = (req.access?.department || "").toLowerCase()
      if (department.toLowerCase() !== userDept) {
        res.status(403).json({
          ok: false,
          error: "Acesso negado: Você só pode aprovar solicitações do seu próprio departamento.",
        })
        return
      }
    }
  }

  db.run(`UPDATE requests SET status = ? WHERE id = ? AND tenant_id = ?`, [status, String(id), String(tenantId)])
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "REQUEST_STATUS_CHANGE",
    entity: "requests",
    entityId: String(id),
    details: { oldStatus, newStatus: status, requester },
    tenantId,
  })

  res.json({ ok: true, message: `Status da solicitação alterado para "${status}".` })
})

// PATCH /api/requests/:id (Atualização genérica de solicitação)
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const { status, priority, description, details } = req.body

  const db = getDB()
  const checkRes = db.exec(`SELECT requester, department, status FROM requests WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!checkRes.length || !checkRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada." })
    return
  }

  const [requester, department] = checkRes[0].values[0] as [string, string]
  const userRole = req.access?.role || "COLABORADOR"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const isSelf = requester.toLowerCase() === userName || requester.toLowerCase() === userEmail

  if (status !== undefined) {
    const isDecision = ["aprovado", "rejeitado", "cancelado"].includes(status.toLowerCase())
    if (isDecision) {
      if (!roleHasPermission(userRole, "requests.approve")) {
        res.status(403).json({
          ok: false,
          error: `Acesso negado: Seu perfil (${userRole}) não possui permissão para aprovar ou rejeitar solicitações.`,
        })
        return
      }
      if (isSelf && status.toLowerCase() === "aprovado") {
        res.status(403).json({
          ok: false,
          error: "Violação de Governança: Você não tem permissão para aprovar sua própria solicitação.",
        })
        return
      }
      if (req.access?.scope === "TEAM" && department.toLowerCase() !== (req.access?.department || "").toLowerCase()) {
        res.status(403).json({
          ok: false,
          error: "Acesso negado: Você só pode aprovar solicitações do seu próprio departamento.",
        })
        return
      }
    }
  }

  const fields: string[] = []
  const params: any[] = []

  if (status !== undefined) { fields.push("status = ?"); params.push(status) }
  if (priority !== undefined) { fields.push("priority = ?"); params.push(priority) }
  if (description !== undefined) { fields.push("description = ?"); params.push(description) }
  if (details !== undefined) { fields.push("details_json = ?"); params.push(JSON.stringify(details)) }

  if (fields.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum campo informado para atualização." })
    return
  }

  params.push(id)
  params.push(tenantId)
  db.run(`UPDATE requests SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, params)
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "REQUEST_UPDATE",
    entity: "requests",
    entityId: id,
    details: { fieldsUpdated: fields.map((f) => f.split(" ")[0]) },
    tenantId,
  })

  res.json({ ok: true, message: "Solicitação atualizada com sucesso." })
})

// DELETE /api/requests/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const checkRes = db.exec(`SELECT requester, status FROM requests WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!checkRes.length || !checkRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada." })
    return
  }

  const [requester, currentStatus] = checkRes[0].values[0] as [string, string]
  const userRole = req.access?.role || "COLABORADOR"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const isSelf = requester.toLowerCase() === userName || requester.toLowerCase() === userEmail

  // Apenas Admin, RH ou o próprio solicitante (se ainda pendente) pode excluir
  const canDelete =
    userRole === "ADMIN" ||
    userRole === "RH" ||
    (isSelf && ["pendente", "em análise", "em_analise"].includes(currentStatus.toLowerCase()))

  if (!canDelete) {
    res.status(403).json({
      ok: false,
      error: "Acesso negado: Você não possui permissão para excluir esta solicitação.",
    })
    return
  }

  db.run(`DELETE FROM requests WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "REQUEST_DELETE",
    entity: "requests",
    entityId: id,
    tenantId,
  })

  res.json({ ok: true, message: "Solicitação excluída com sucesso." })
})

export default router
