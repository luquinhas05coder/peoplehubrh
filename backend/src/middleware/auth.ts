/**
 * middleware/auth.ts — JWT Authentication Helpers & Express Middleware
 */
import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "peoplehub_rh_secret_key_2026_super_secure"

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      tenantId?: string
    }
  }
}

export interface JwtPayload {
  sub: string
  email: string
  tenant_id?: string
  tenant_name?: string
  type: "session" | "pending_mfa"
  iat?: number
  exp?: number
}

export function signPendingToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: "pending_mfa" }, JWT_SECRET, {
    expiresIn: "10m",
  })
}

export function signSessionToken(
  userId: string,
  email: string,
  tenantId: string = "tenant_default",
  tenantName?: string
): string {
  return jwt.sign(
    { sub: userId, email, tenant_id: tenantId, tenant_name: tenantName, type: "session" },
    JWT_SECRET,
    {
      expiresIn: "8h",
    }
  )
}

export function decodePendingToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (payload.type !== "pending_mfa") return null
    return payload
  } catch {
    return null
  }
}

export function verifySessionToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (payload.type !== "session") return null
    return payload
  } catch {
    return null
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const cookieToken = req.cookies?.token

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : cookieToken

  if (!token) {
    res.status(401).json({ ok: false, error: "Não autorizado. Token de sessão ausente." })
    return
  }

  const payload = verifySessionToken(token)
  if (!payload) {
    res.status(401).json({ ok: false, error: "Sessão inválida ou expirada." })
    return
  }

  req.user = payload
  req.tenantId = payload.tenant_id || "tenant_default"
  next()
}

/**
 * Middleware para identificar o tenant da requisição:
 * 1. Prioriza o tenant contido no JWT verificado
 * 2. Em seguida, header 'x-tenant-id' (se enviado pelo frontend)
 * 3. Fallback seguro para 'tenant_default'
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const cookieToken = req.cookies?.token
  const headerTenant = req.headers["x-tenant-id"] as string | undefined

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : cookieToken

  if (token) {
    const payload = verifySessionToken(token)
    if (payload) {
      req.user = payload
      req.tenantId = payload.tenant_id || headerTenant || "tenant_default"
      return next()
    }
  }

  req.tenantId = headerTenant || "tenant_default"
  next()
}

