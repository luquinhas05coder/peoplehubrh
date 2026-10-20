/**
 * middleware/auth.ts — JWT validation middleware
 */
import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export const JWT_SECRET = process.env.JWT_SECRET ?? "peoplehub_dev_secret_2026_change_in_prod"
export const JWT_EXPIRES = "8h"

export interface JwtPayload {
  sub: string    // user id
  email: string
  type: "session" | "pending"
  iat?: number
  exp?: number
}

/** Attaches decoded token to req if valid; otherwise 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined = req.cookies?.sessionToken

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7)
  }

  if (!token) {
    res.status(401).json({ ok: false, error: "Token não fornecido." })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (payload.type !== "session") {
      res.status(401).json({ ok: false, error: "Token inválido para esta operação." })
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ ok: false, error: "Token expirado ou inválido." })
  }
}

export function signPendingToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: "pending" } as JwtPayload, JWT_SECRET, {
    expiresIn: "10m",
  })
}

export function signSessionToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: "session" } as JwtPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  })
}

export function decodePendingToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (payload.type !== "pending") return null
    return payload
  } catch {
    return null
  }
}
