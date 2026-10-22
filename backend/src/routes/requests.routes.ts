/**
 * routes/requests.routes.ts — Gestão de Solicitações & Chamados de RH com Multi-Tenancy e RBAC
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, requirePermission, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"
import { dispatchWebhookEvent } from "../integrations/webhooks/dispatcher.js"
import { buildRequestApprovedPayload } from "../integrations/security/sanitizer.js"

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
  const detailsObj = typeof details === "object" && details !== null ? { ...details } : {}
  if (req.access?.userId) detailsObj.created_by_id = req.access.userId
  if (req.access?.email) detailsObj.created_by_email = req.access.email
  if (req.access?.name) detailsObj.created_by_name = req.access.name

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
      Object.keys(detailsObj).length ? JSON.stringify(detailsObj) : null,
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
  const { status, justification, review_notes, note } = req.body

  if (!status) {
    res.status(400).json({ ok: false, error: "Status é obrigatório." })
    return
  }

  const db = getDB()
  const checkRes = db.exec(
    `SELECT requester, department, status, details_json, type, description FROM requests WHERE id = ? AND tenant_id = ?`,
    [String(id), String(tenantId)]
  )
  if (!checkRes.length || !checkRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada." })
    return
  }

  const [requester, department, oldStatus, detailsJson, reqType, reqDesc] = checkRes[0].values[0] as [
    string,
    string,
    string,
    string | null,
    string,
    string
  ]
  const userRole = req.access?.role || "COLABORADOR"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()

  let parsedDetails: any = null
  try {
    parsedDetails = detailsJson ? JSON.parse(detailsJson) : null
  } catch {}

  const isSelf =
    Boolean(parsedDetails?.created_by_id && parsedDetails.created_by_id === req.access?.userId) ||
    Boolean(parsedDetails?.created_by_email && parsedDetails.created_by_email.toLowerCase() === userEmail) ||
    requester.toLowerCase().trim() === userName.trim() ||
    requester.toLowerCase().trim() === userEmail.trim() ||
    Boolean(userName && (userName.includes(requester.toLowerCase().trim()) || requester.toLowerCase().trim().includes(userName))) ||
    Boolean(userEmail && requester.toLowerCase().includes(userEmail.split("@")[0]))

  const targetStatusLower = status.toLowerCase()
  const decisionNote = (review_notes || justification || note || "").trim()

  // 1. Regra de Cancelamento por parte do próprio solicitante
  if (targetStatusLower === "cancelado") {
    if (isSelf) {
      const cancellableStatuses = ["pendente", "em análise", "em_analise", "correção solicitada", "pendente de correção"]
      if (!cancellableStatuses.includes(oldStatus.toLowerCase())) {
        res.status(400).json({
          ok: false,
          error: `Não é possível cancelar uma solicitação que já foi finalizada ou está com status "${oldStatus}".`,
        })
        return
      }
      // Autorizado o cancelamento pelo solicitante!
    } else {
      // Cancelamento por terceiro exige permissão de aprovação
      if (!roleHasPermission(userRole, "requests.approve")) {
        res.status(403).json({
          ok: false,
          error: `Acesso negado: Seu perfil (${userRole}) não possui permissão para cancelar solicitações de outros colaboradores.`,
        })
        return
      }
    }
  } else {
    // 2. Aprovação, Rejeição ou Solicitação de Correção
    const isApprovalOrRejection = ["aprovado", "rejeitado", "correção solicitada", "pendente de correção"].includes(targetStatusLower)
    if (isApprovalOrRejection) {
      if (!roleHasPermission(userRole, "requests.approve")) {
        res.status(403).json({
          ok: false,
          error: `Acesso negado: Seu perfil (${userRole}) não possui permissão para aprovar, rejeitar ou solicitar correções.`,
        })
        return
      }

      // Regra anti auto-aprovação: Ninguém pode aprovar sua própria solicitação
      if (isSelf && targetStatusLower === "aprovado") {
        res.status(403).json({
          ok: false,
          error: "Violação de Governança: Você não tem permissão para aprovar sua própria solicitação.",
        })
        return
      }

      // Rejeição ou Correção Solicitada exige justificativa obrigatória
      if (["rejeitado", "correção solicitada", "pendente de correção"].includes(targetStatusLower) && !decisionNote) {
        res.status(400).json({
          ok: false,
          error: "Justificativa obrigatória: Informe o motivo da rejeição ou os itens pendentes de correção.",
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
  }

  // 3. Efeito colateral: Se for "Atualização Cadastral" aprovada, aplicar no banco de dados employees
  if (targetStatusLower === "aprovado" && (reqType.toLowerCase().includes("atualização cadastral") || reqType.toLowerCase().includes("alteração cadastral"))) {
    const changes = parsedDetails?.changes
    if (changes && typeof changes === "object" && Object.keys(changes).length > 0) {
      const allowedKeys = ["phone", "address", "city", "state", "cep", "notes"]
      const empFields: string[] = []
      const empParams: any[] = []

      for (const k of Object.keys(changes)) {
        if (allowedKeys.includes(k) && changes[k] !== undefined) {
          empFields.push(`${k} = ?`)
          empParams.push(changes[k])
        }
      }

      if (empFields.length > 0) {
        const targetEmail = (parsedDetails?.employee_email || parsedDetails?.created_by_email || userEmail).toLowerCase()
        empParams.push(targetEmail, tenantId)
        db.run(`UPDATE employees SET ${empFields.join(", ")} WHERE lower(email) = ? AND tenant_id = ?`, empParams)

        // Registrar no histórico funcional do colaborador
        const empId = parsedDetails?.employee_id || `emp_${targetEmail}`
        const histId = `hist_cad_${Date.now()}`
        try {
          db.run(
            `INSERT INTO employee_history (id, employee_id, tenant_id, type, title, description, old_value, new_value, created_by, created_at)
             VALUES (?, ?, ?, 'alteracao_cadastral', 'Atualização Cadastral Aprovada', ?, ?, ?, ?, datetime('now'))`,
            [
              histId,
              empId,
              tenantId,
              `Dados alterados via chamado ${id}: ${Object.keys(changes).join(", ")}`,
              JSON.stringify(parsedDetails.original || {}),
              JSON.stringify(changes),
              req.access?.name || "RH",
            ]
          )
        } catch (_hErr) {}
      }
    }
  }

  // Atualizar a solicitação
  const reviewerName = req.access?.name || "Analista de RH"
  const formattedStatus =
    targetStatusLower === "aprovado"
      ? "Aprovado"
      : targetStatusLower === "rejeitado"
      ? "Rejeitado"
      : targetStatusLower === "cancelado"
      ? "Cancelado"
      : targetStatusLower.includes("correção")
      ? "Correção Solicitada"
      : status

  db.run(
    `UPDATE requests 
     SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') 
     WHERE id = ? AND tenant_id = ?`,
    [formattedStatus, decisionNote || null, reviewerName, String(id), String(tenantId)]
  )

  // Enviar notificação ao solicitante
  const notifEmail = parsedDetails?.created_by_email || userEmail
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    db.run(
      `INSERT INTO notifications (id, tenant_id, user_email, title, description, category, priority, link, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '/solicitacoes', 0, datetime('now'))`,
      [
        notifId,
        tenantId,
        notifEmail,
        `Solicitação ${id} — ${formattedStatus}`,
        decisionNote ? `Status alterado para "${formattedStatus}": ${decisionNote}` : `Status da sua solicitação "${reqType}" alterado para "${formattedStatus}".`,
        "solicitacao",
        formattedStatus === "Aprovado" ? "alta" : "media",
      ]
    )
  } catch (_e) {}

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "REQUEST_STATUS_CHANGE",
    entity: "requests",
    entityId: String(id),
    details: { oldStatus, newStatus: formattedStatus, requester, reviewNotes: decisionNote },
    tenantId,
  })

  // Disparar Webhook assíncrono se a solicitação foi aprovada
  if (formattedStatus === "Aprovado") {
    dispatchWebhookEvent(
      "request.approved",
      buildRequestApprovedPayload({
        id: String(id),
        type: reqType,
        requester,
        department,
        priority: reqDesc || "media",
        description: reqDesc,
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString(),
      }),
      tenantId
    ).catch((wErr) => console.error("[Webhook Error] request.approved:", wErr.message))
  }

  res.json({
    ok: true,
    message: `Status da solicitação alterado para "${formattedStatus}".`,
    status: formattedStatus,
    review_notes: decisionNote,
  })
})

// GET /api/requests/:id/comments — Obter linha do tempo e comentários da solicitação
router.get("/:id/comments", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM request_comments WHERE request_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
    [String(id), String(tenantId)]
  )

  const comments: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    result[0].values.forEach((row) => {
      const c: any = {}
      cols.forEach((col, idx) => { c[col] = row[idx] })
      comments.push(c)
    })
  }

  res.json({ ok: true, comments })
})

// POST /api/requests/:id/comments — Adicionar comentário ou pendência na solicitação
router.post("/:id/comments", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { comment } = req.body

  if (!comment || typeof comment !== "string" || !comment.trim()) {
    res.status(400).json({ ok: false, error: "Comentário não pode ser vazio." })
    return
  }

  const db = getDB()
  const checkRes = db.exec(
    `SELECT requester, details_json FROM requests WHERE id = ? AND tenant_id = ?`,
    [String(id), String(tenantId)]
  )
  if (!checkRes.length || !checkRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada." })
    return
  }

  const commentId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const authorId = req.access?.userId || "user_unknown"
  const authorName = req.access?.name || "Usuário"
  const authorRole = req.access?.role || "COLABORADOR"

  db.run(
    `INSERT INTO request_comments (id, request_id, author_id, author_name, author_role, comment, tenant_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [commentId, String(id), authorId, authorName, authorRole, comment.trim(), String(tenantId)]
  )

  persist()

  recordAuditLog({
    userId: authorId,
    userName: authorName,
    userRole: authorRole,
    action: "REQUEST_ADD_COMMENT",
    entity: "requests",
    entityId: String(id),
    details: { comment: comment.trim().slice(0, 100) },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    comment: {
      id: commentId,
      request_id: String(id),
      author_id: authorId,
      author_name: authorName,
      author_role: authorRole,
      comment: comment.trim(),
      created_at: new Date().toISOString(),
    },
    message: "Comentário registrado com sucesso.",
  })
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
