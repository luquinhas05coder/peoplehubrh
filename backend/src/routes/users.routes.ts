/**
 * routes/users.routes.ts — Gestão Administrativa de Usuários, RBAC e Auditoria
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, requireRole, requirePermission, recordAuditLog } from "../middleware/rbac.js"
import { normalizeRole, type Role } from "../constants/rbac.js"

const router = Router()

// Todas as rotas deste módulo exigem autenticação ativa
router.use(authenticateRBAC)

/**
 * GET /api/users
 * Lista todos os usuários do tenant atual. Exclusivo para ADMIN (permissão users.view).
 */
router.get("/", requirePermission("users.view"), (req: Request, res: Response) => {
  const tenantId = req.access?.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, name, email, role, department, initials, status, last_login, created_at 
     FROM users 
     WHERE tenant_id = ? 
     ORDER BY created_at DESC`,
    [tenantId]
  )

  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, users: [] })
    return
  }

  const columns = result[0].columns
  const users = result[0].values.map((row) => {
    const u: any = {}
    columns.forEach((col, idx) => {
      u[col] = row[idx]
    })
    u.role = normalizeRole(u.role)
    u.status = u.status || "active"
    return u
  })

  res.json({ ok: true, users })
})

/**
 * POST /api/users
 * Criação de um novo usuário pelo ADMIN (permissão users.create).
 */
router.post("/", requirePermission("users.create"), async (req: Request, res: Response) => {
  const { name, email, password, role, department } = req.body
  const tenantId = req.access?.tenantId || "tenant_default"

  if (!name || !email || !password) {
    res.status(400).json({ ok: false, error: "Nome, e-mail e senha são obrigatórios." })
    return
  }

  const normalizedRole = normalizeRole(role || "COLABORADOR")
  const db = getDB()

  // Verificar se o e-mail já existe
  const check = db.exec(`SELECT id FROM users WHERE lower(email) = lower(?)`, [email.trim()])
  if (check.length && check[0].values.length) {
    res.status(409).json({ ok: false, error: "Já existe um usuário cadastrado com este e-mail." })
    return
  }

  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const hash = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO users (id, name, email, password, role, department, initials, tenant_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [id, name.trim(), email.trim().toLowerCase(), hash, normalizedRole, department || "Geral", initials, tenantId, now]
  )
  persist()

  // Registrar Auditoria
  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "CRIAR_USUARIO",
    entity: "users",
    entityId: id,
    details: { name: name.trim(), email: email.trim().toLowerCase(), role: normalizedRole, department },
    tenantId,
    ipAddress: req.ip,
  })

  res.status(201).json({
    ok: true,
    message: `Usuário ${name} cadastrado com sucesso com a função ${normalizedRole}.`,
    user: {
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: normalizedRole,
      department: department || "Geral",
      initials,
      status: "active",
      created_at: now,
    },
  })
})

/**
 * PUT /api/users/:id
 * Edição de dados do usuário pelo ADMIN (permissão users.update).
 */
router.put("/:id", requirePermission("users.update"), (req: Request, res: Response) => {
  const { id } = req.params
  const { name, department } = req.body
  const tenantId = req.access?.tenantId || "tenant_default"
  const db = getDB()

  const check = db.exec(`SELECT id, name, email, role FROM users WHERE id = ? AND tenant_id = ?`, [String(id), String(tenantId)])
  if (!check.length || !check[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [oldId, oldName, email, currentRole] = check[0].values[0] as [string, string, string, string]

  db.run(
    `UPDATE users SET name = COALESCE(?, name), department = COALESCE(?, department) WHERE id = ? AND tenant_id = ?`,
    [name ? name.trim() : null, department ? department.trim() : null, String(id), String(tenantId)]
  )
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "EDITAR_USUARIO",
    entity: "users",
    entityId: String(id),
    details: { oldName, newName: name, email, department },
    tenantId,
    ipAddress: req.ip,
  })

  res.json({ ok: true, message: "Dados do usuário atualizados com sucesso." })
})

/**
 * PATCH /api/users/:id/role
 * Alteração de Função/Role (permissão users.manage_roles).
 */
router.patch("/:id/role", requirePermission("users.manage_roles"), (req: Request, res: Response) => {
  const { id } = req.params
  const { role } = req.body
  const tenantId = req.access?.tenantId || "tenant_default"

  if (!role) {
    res.status(400).json({ ok: false, error: "A nova função/role é obrigatória." })
    return
  }

  const validRoles: Role[] = ["ADMIN", "RH", "GESTOR", "COLABORADOR"]
  const normalizedNewRole = normalizeRole(role)

  if (!validRoles.includes(normalizedNewRole)) {
    res.status(400).json({ ok: false, error: `Função inválida. Permitidas: ${validRoles.join(", ")}.` })
    return
  }

  const db = getDB()
  const userCheck = db.exec(`SELECT id, name, email, role FROM users WHERE id = ? AND tenant_id = ?`, [String(id), String(tenantId)])
  if (!userCheck.length || !userCheck[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [targetId, targetName, targetEmail, rawOldRole] = userCheck[0].values[0] as [string, string, string, string]
  const oldRole = normalizeRole(rawOldRole)

  // Segurança: Impedir que um ADMIN despromova a si mesmo acidentalmente
  if (req.access?.userId === targetId && oldRole === "ADMIN" && normalizedNewRole !== "ADMIN") {
    res.status(400).json({
      ok: false,
      error: "Ação bloqueada: Por segurança, você não pode revogar o próprio acesso de ADMIN.",
    })
    return
  }

  db.run(`UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?`, [normalizedNewRole, String(id), String(tenantId)])
  persist()

  // Registrar Auditoria Crítica
  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "ALTERAR_ROLE",
    entity: "users",
    entityId: String(id),
    details: {
      targetUser: targetName,
      targetEmail,
      oldRole,
      newRole: normalizedNewRole,
      reason: `Alteração realizada pelo administrador ${req.access?.name}`,
    },
    tenantId,
    ipAddress: req.ip,
  })

  res.json({
    ok: true,
    message: `Função de ${targetName} alterada com sucesso de ${oldRole} para ${normalizedNewRole}.`,
    role: normalizedNewRole,
  })
})

/**
 * PATCH /api/users/:id/status
 * Ativação / Desativação de Usuário (permissão users.update).
 */
router.patch("/:id/status", requirePermission("users.update"), (req: Request, res: Response) => {
  const { id } = req.params
  const { status } = req.body as { status?: "active" | "inactive" }
  const tenantId = req.access?.tenantId || "tenant_default"

  if (!status || !["active", "inactive"].includes(status)) {
    res.status(400).json({ ok: false, error: "Status inválido. Use 'active' ou 'inactive'." })
    return
  }

  // Não permitir auto-desativação
  if (req.access?.userId === id && status === "inactive") {
    res.status(400).json({ ok: false, error: "Você não pode desativar seu próprio usuário." })
    return
  }

  const db = getDB()
  const userCheck = db.exec(`SELECT id, name, email, status FROM users WHERE id = ? AND tenant_id = ?`, [String(id), String(tenantId)])
  if (!userCheck.length || !userCheck[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [targetId, targetName, targetEmail, currentStatus] = userCheck[0].values[0] as [string, string, string, string]

  db.run(`UPDATE users SET status = ? WHERE id = ? AND tenant_id = ?`, [status, String(id), String(tenantId)])
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: status === "active" ? "ATIVAR_USUARIO" : "DESATIVAR_USUARIO",
    entity: "users",
    entityId: String(id),
    details: { targetName, targetEmail, previousStatus: currentStatus, newStatus: status },
    tenantId,
    ipAddress: req.ip,
  })

  res.json({
    ok: true,
    message: `Usuário ${targetName} foi ${status === "active" ? "ativado" : "desativado"} com sucesso.`,
    status,
  })
})

/**
 * GET /api/users/audit
 * Consulta a trilha de auditoria de segurança (permissão audit.view).
 */
router.get("/audit", requirePermission("audit.view"), (req: Request, res: Response) => {
  const tenantId = req.access?.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, user_id, user_name, user_role, action, entity, entity_id, details_json, ip_address, created_at
     FROM audit_logs 
     WHERE tenant_id = ? 
     ORDER BY created_at DESC 
     LIMIT 100`,
    [tenantId]
  )

  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, logs: [] })
    return
  }

  const columns = result[0].columns
  const logs = result[0].values.map((row) => {
    const l: any = {}
    columns.forEach((col, idx) => {
      l[col] = row[idx]
    })
    if (l.details_json) {
      try {
        l.details = JSON.parse(l.details_json)
      } catch {
        l.details = l.details_json
      }
    }
    delete l.details_json
    return l
  })

  res.json({ ok: true, logs })
})

export default router
