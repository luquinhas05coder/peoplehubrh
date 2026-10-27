/**
 * routes/users.routes.ts — Gestão Administrativa de Usuários, Matriz de Acessos RBAC e Auditoria
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, requireRole, requirePermission, recordAuditLog } from "../middleware/rbac.js"
import {
  normalizeRole,
  type Role,
  type Permission,
  ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  getEffectivePermissionsForUser,
} from "../constants/rbac.js"

const router = Router()

// Todas as rotas deste módulo exigem autenticação ativa
router.use(authenticateRBAC)

/**
 * GET /api/users
 * Lista todos os usuários do tenant atual. Exclusivo para ADMIN ou AUDITOR (permissão users.view).
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
    u.rawRole = u.role
    u.role = normalizeRole(u.role)
    u.status = u.status || "active"
    // Indicador se usuário possui perfil inválido no banco
    const validRoles: Role[] = ["ADMIN", "RH", "DP", "GESTOR", "COLABORADOR", "RECRUTADOR", "AUDITOR"]
    u.hasValidRole = validRoles.includes(u.role)
    return u
  })

  res.json({ ok: true, users })
})

/**
 * GET /api/users/roles/matrix
 * Retorna os perfis, grupos de permissões por módulo/ação e matriz de permissões atual
 */
router.get("/roles/matrix", requirePermission("users.view"), (req: Request, res: Response) => {
  const db = getDB()
  const validRoles: Role[] = ["ADMIN", "RH", "DP", "GESTOR", "RECRUTADOR", "AUDITOR", "COLABORADOR"]

  const matrix: Record<string, string[]> = {}

  for (const role of validRoles) {
    // Buscar customizações no banco ou usar matriz padrão
    const roleRows = db.exec(`SELECT permission FROM role_permissions WHERE role = ?`, [role])
    if (roleRows.length && roleRows[0].values.length) {
      matrix[role] = roleRows[0].values.map((r) => r[0] as string)
    } else {
      matrix[role] = Array.from(ROLE_PERMISSIONS[role] || [])
    }
  }

  res.json({
    ok: true,
    roles: validRoles,
    groups: PERMISSION_GROUPS,
    allPermissions: ALL_PERMISSIONS,
    matrix,
  })
})

/**
 * GET /api/users/roles/:role/permissions
 * Retorna as permissões de um perfil específico
 */
router.get("/roles/:role/permissions", requirePermission("users.view"), (req: Request, res: Response) => {
  const roleParam = Array.isArray(req.params.role) ? req.params.role[0] : req.params.role
  const normalizedRole = normalizeRole(roleParam)
  const db = getDB()

  const roleRows = db.exec(`SELECT permission FROM role_permissions WHERE role = ?`, [normalizedRole])
  let permissions: string[] = []
  if (roleRows.length && roleRows[0].values.length) {
    permissions = roleRows[0].values.map((r) => r[0] as string)
  } else {
    permissions = Array.from(ROLE_PERMISSIONS[normalizedRole] || [])
  }

  res.json({
    ok: true,
    role: normalizedRole,
    permissions,
  })
})

/**
 * PUT /api/users/roles/:role/permissions
 * Atualiza a matriz de permissões de um perfil (exclusivo para ADMIN com users.manage_roles)
 */
router.put("/roles/:role/permissions", requirePermission("users.manage_roles"), (req: Request, res: Response) => {
  const roleParam = Array.isArray(req.params.role) ? req.params.role[0] : req.params.role
  const { permissions } = req.body as { permissions: string[] }
  const tenantId = req.access?.tenantId || "tenant_default"

  if (!Array.isArray(permissions)) {
    res.status(400).json({ ok: false, error: "A lista de permissões deve ser um array." })
    return
  }

  const normalizedRole = normalizeRole(roleParam)
  const db = getDB()

  // Salvaguarda 1: ADMIN deve sempre manter permissões vitais de segurança
  if (normalizedRole === "ADMIN") {
    const requiredAdminPerms: Permission[] = ["users.view", "users.manage_roles", "dashboard.view", "settings.update"]
    for (const p of requiredAdminPerms) {
      if (!permissions.includes(p)) {
        res.status(400).json({
          ok: false,
          error: `Operação bloqueada: O perfil ADMIN não pode perder a permissão essencial '${p}'.`,
        })
        return
      }
    }
  }

  // Salvaguarda 2: AUDITOR é estritamente LEITURA. Bloquear concessão de escrita/modificação
  if (normalizedRole === "AUDITOR") {
    const forbiddenAuditorPerms = permissions.filter((p) =>
      p.endsWith(".create") ||
      p.endsWith(".update") ||
      p.endsWith(".delete") ||
      p.endsWith(".manage") ||
      p.endsWith(".manage_roles") ||
      p.endsWith(".approve") ||
      p.endsWith(".reject")
    )
    if (forbiddenAuditorPerms.length > 0) {
      res.status(400).json({
        ok: false,
        error: `Operação bloqueada: O perfil AUDITOR possui exclusivamente privilégios de leitura. Não é permitido conceder: ${forbiddenAuditorPerms.join(", ")}.`,
      })
      return
    }
  }

  // Filtrar apenas permissões conhecidas
  const validNewPerms = permissions.filter((p) => ALL_PERMISSIONS.includes(p as Permission))

  // Atualizar banco de dados
  db.run(`DELETE FROM role_permissions WHERE role = ?`, [normalizedRole])
  for (const perm of validNewPerms) {
    db.run(
      `INSERT INTO role_permissions (role, permission, created_at) VALUES (?, ?, datetime('now'))`,
      [normalizedRole, perm]
    )
  }
  persist()

  // Registrar Auditoria
  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "ATUALIZAR_MATRIZ_PERMISSOES",
    entity: "role_permissions",
    entityId: normalizedRole,
    details: {
      role: normalizedRole,
      totalPermissions: validNewPerms.length,
      permissions: validNewPerms,
    },
    tenantId,
    ipAddress: req.ip,
  })

  res.json({
    ok: true,
    message: `Matriz de permissões do perfil ${normalizedRole} atualizada com sucesso (${validNewPerms.length} permissões ativas).`,
    role: normalizedRole,
    permissions: validNewPerms,
  })
})

/**
 * GET /api/users/:id/effective-permissions
 * Consulta as permissões efetivas de um usuário (Role Base + Overrides Individuais)
 */
router.get("/:id/effective-permissions", requirePermission("users.view"), (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.access?.tenantId || "tenant_default"
  const db = getDB()

  const userRes = db.exec(`SELECT id, name, email, role FROM users WHERE id = ? AND tenant_id = ?`, [
    String(id),
    String(tenantId),
  ])

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [userId, userName, userEmail, rawRole] = userRes[0].values[0] as [string, string, string, string]
  const role = normalizeRole(rawRole)
  const effectivePermissions = getEffectivePermissionsForUser(userId, role)

  // Consultar overrides individuais
  const userOverridesRes = db.exec(
    `SELECT permission, granted, created_at FROM user_permissions WHERE user_id = ?`,
    [userId]
  )
  const overrides: Array<{ permission: string; granted: boolean; created_at: string }> = []
  if (userOverridesRes.length && userOverridesRes[0].values.length) {
    for (const row of userOverridesRes[0].values) {
      overrides.push({
        permission: row[0] as string,
        granted: Boolean(row[1]),
        created_at: row[2] as string,
      })
    }
  }

  res.json({
    ok: true,
    user: { id: userId, name: userName, email: userEmail, role },
    effectivePermissions,
    overrides,
  })
})

/**
 * POST /api/users/:id/permissions
 * Concede ou revoga permissão específica diretamente para um usuário (override individual)
 */
router.post("/:id/permissions", requirePermission("users.manage_roles"), (req: Request, res: Response) => {
  const { id } = req.params
  const { permission, granted } = req.body as { permission: string; granted: boolean }
  const tenantId = req.access?.tenantId || "tenant_default"

  if (!permission || typeof granted !== "boolean") {
    res.status(400).json({ ok: false, error: "Permissão e status 'granted' (boolean) são obrigatórios." })
    return
  }

  if (!ALL_PERMISSIONS.includes(permission as Permission)) {
    res.status(400).json({ ok: false, error: `Permissão desconhecida: '${permission}'.` })
    return
  }

  // Prevenção de Auto-Elevação de Privilégios: Usuário não pode conceder permissões extras a si mesmo
  if (req.access?.userId === id && granted === true) {
    res.status(403).json({
      ok: false,
      error: "Ação bloqueada: Por segurança, você não pode conceder privilégios extras à sua própria conta.",
    })
    return
  }

  const db = getDB()
  const userRes = db.exec(`SELECT id, name, role FROM users WHERE id = ? AND tenant_id = ?`, [
    String(id),
    String(tenantId),
  ])

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [targetId, targetName, targetRole] = userRes[0].values[0] as [string, string, string]

  // Gravar ou atualizar override
  db.run(`DELETE FROM user_permissions WHERE user_id = ? AND permission = ?`, [targetId, permission])
  db.run(
    `INSERT INTO user_permissions (user_id, permission, granted, created_at) VALUES (?, ?, ?, datetime('now'))`,
    [targetId, permission, granted ? 1 : 0]
  )
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: granted ? "CONCEDER_PERMISSAO_INDIVIDUAL" : "REVOGAR_PERMISSAO_INDIVIDUAL",
    entity: "user_permissions",
    entityId: targetId,
    details: {
      targetUser: targetName,
      targetRole,
      permission,
      granted,
    },
    tenantId,
    ipAddress: req.ip,
  })

  const updatedPermissions = getEffectivePermissionsForUser(targetId, normalizeRole(targetRole))

  res.json({
    ok: true,
    message: `Permissão '${permission}' ${granted ? "concedida" : "revogada"} com sucesso para ${targetName}.`,
    effectivePermissions: updatedPermissions,
  })
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

  const validRoles: Role[] = ["ADMIN", "RH", "GESTOR", "COLABORADOR", "RECRUTADOR", "AUDITOR"]
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

  // Salvaguarda 1: Impedir que um ADMIN despromova a si mesmo
  if (
    (req.access?.userId === targetId || (req.access?.email && targetEmail && req.access.email.toLowerCase() === targetEmail.toLowerCase())) &&
    oldRole === "ADMIN" &&
    normalizedNewRole !== "ADMIN"
  ) {
    res.status(400).json({
      ok: false,
      error: "Ação bloqueada: Por segurança, você não pode revogar o próprio acesso de ADMIN.",
    })
    return
  }

  // Salvaguarda 2: Impedir a remoção do ÚLTIMO administrador ativo da organização
  if (oldRole === "ADMIN" && normalizedNewRole !== "ADMIN") {
    const adminCountRes = db.exec(
      `SELECT count(*) FROM users WHERE role = 'ADMIN' AND status = 'active' AND tenant_id = ?`,
      [tenantId]
    )
    const adminCount = adminCountRes.length ? (adminCountRes[0].values[0][0] as number) : 0
    if (adminCount <= 1) {
      res.status(400).json({
        ok: false,
        error: "Ação bloqueada: Não é possível remover o cargo do único Administrador ativo do sistema. Promova outro usuário antes de alterar este perfil.",
      })
      return
    }
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
  const userCheck = db.exec(`SELECT id, name, email, role, status FROM users WHERE id = ? AND tenant_id = ?`, [String(id), String(tenantId)])
  if (!userCheck.length || !userCheck[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [targetId, targetName, targetEmail, targetRole, currentStatus] = userCheck[0].values[0] as [string, string, string, string, string]

  // Salvaguarda: Não permitir desativar o ÚLTIMO administrador ativo
  if (status === "inactive" && normalizeRole(targetRole) === "ADMIN") {
    const adminCountRes = db.exec(
      `SELECT count(*) FROM users WHERE role = 'ADMIN' AND status = 'active' AND tenant_id = ?`,
      [tenantId]
    )
    const adminCount = adminCountRes.length ? (adminCountRes[0].values[0][0] as number) : 0
    if (adminCount <= 1) {
      res.status(400).json({
        ok: false,
        error: "Ação bloqueada: Não é possível desativar o único Administrador ativo da organização.",
      })
      return
    }
  }

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
