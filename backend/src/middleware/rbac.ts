/**
 * middleware/rbac.ts — Middleware de Controle de Acesso Baseado em Funções (RBAC) e Escopos
 */
import type { Request, Response, NextFunction } from "express"
import { verifySessionToken, type JwtPayload } from "./auth.js"
import { type Role, type Permission, normalizeRole, roleHasPermission } from "../constants/rbac.js"
import { getDB, persist } from "../db/index.js"

export interface UserAccessContext {
  userId: string
  name: string
  email: string
  role: Role
  rawRole: string
  department: string
  tenantId: string
  scope: "ALL" | "TEAM" | "OWN"
}

declare global {
  namespace Express {
    interface Request {
      access?: UserAccessContext
    }
  }
}

/**
 * Registra um evento de auditoria no banco de dados.
 */
export function recordAuditLog(options: {
  userId?: string
  userName?: string
  userRole?: string
  action: string
  entity: string
  entityId?: string
  details?: any
  tenantId?: string
  ipAddress?: string
}): void {
  try {
    const db = getDB()
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details_json, tenant_id, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        options.userId || "system",
        options.userName || "Sistema",
        options.userRole || "SYSTEM",
        options.action,
        options.entity,
        options.entityId || null,
        options.details ? JSON.stringify(options.details) : null,
        options.tenantId || "tenant_default",
        options.ipAddress || null,
        now,
      ]
    )
    persist()
  } catch (err) {
    console.error("[AUDIT] Erro ao registrar log de auditoria:", err)
  }
}

/**
 * Autentica o usuário pelo JWT e carrega seu contexto RBAC atualizado do banco de dados.
 */
export function authenticateRBAC(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const cookieToken = req.cookies?.token

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : cookieToken

  if (!token) {
    res.status(401).json({
      ok: false,
      error: "Não autorizado: Token de autenticação ausente ou inválido. Faça login para continuar.",
    })
    return
  }

  const payload = verifySessionToken(token)
  if (!payload || !payload.sub) {
    res.status(401).json({
      ok: false,
      error: "Sessão inválida ou expirada. Por favor, autentique-se novamente.",
    })
    return
  }

  // Obter dados em tempo real do banco de dados para evitar tokens obsoletos
  const db = getDB()
  const userRes = db.exec(
    `SELECT id, name, email, role, department, tenant_id, status FROM users WHERE id = ?`,
    [payload.sub]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(401).json({
      ok: false,
      error: "Usuário não encontrado na base de dados da organização.",
    })
    return
  }

  const [id, name, email, rawRole, department, tenantId, status] = userRes[0].values[0] as [
    string,
    string,
    string,
    string,
    string,
    string,
    string | null
  ]

  // Verificar se o usuário está desativado
  if (status && status.toLowerCase() === "inactive") {
    res.status(403).json({
      ok: false,
      error: "Acesso bloqueado: Este usuário foi desativado pelo administrador do sistema.",
    })
    return
  }

  const normalizedRole = normalizeRole(rawRole)

  // Determinar o escopo padrão da role
  let scope: "ALL" | "TEAM" | "OWN" = "OWN"
  if (normalizedRole === "ADMIN" || normalizedRole === "RH") {
    scope = "ALL"
  } else if (normalizedRole === "GESTOR") {
    scope = "TEAM"
  } else {
    scope = "OWN"
  }

  req.user = payload
  req.tenantId = tenantId || payload.tenant_id || "tenant_default"
  req.access = {
    userId: id,
    name,
    email,
    role: normalizedRole,
    rawRole,
    department: department || "Geral",
    tenantId: req.tenantId,
    scope,
  }

  next()
}

/**
 * Middleware que exige uma ou mais roles específicas.
 */
export function requireRole(allowedRoles: Role | Role[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.access) {
      res.status(401).json({ ok: false, error: "Não autenticado." })
      return
    }

    if (!roles.includes(req.access.role)) {
      res.status(403).json({
        ok: false,
        error: `Acesso negado: Seu perfil (${req.access.role}) não possui permissão para executar esta ação. Exige: ${roles.join(", ")}.`,
      })
      return
    }

    next()
  }
}

/**
 * Middleware que exige uma permissão explícita baseada na matriz de permissões.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.access) {
      res.status(401).json({ ok: false, error: "Não autenticado." })
      return
    }

    if (!roleHasPermission(req.access.role, permission)) {
      res.status(403).json({
        ok: false,
        error: `Acesso negado: Seu perfil (${req.access.role}) não possui a permissão '${permission}'.`,
      })
      return
    }

    next()
  }
}
