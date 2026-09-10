/**
 * routes/auth.ts — Authentication endpoints
 *
 * POST /api/auth/login        → validate credentials → issue pendingToken + MFA code
 * POST /api/auth/verify-mfa   → validate MFA code with pendingToken → issue sessionToken
 * POST /api/auth/resend-mfa   → generate a new MFA code (requires pendingToken)
 * GET  /api/auth/me           → return current user (requires sessionToken)
 * POST /api/auth/logout       → client-side logout (JWT is stateless; server confirms)
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import {
  findUserByEmail,
  saveMfaCode,
  validateMfaCode,
  type DBUser,
} from "../db.js"
import {
  signPendingToken,
  signSessionToken,
  decodePendingToken,
  requireAuth,
  type JwtPayload,
} from "../middleware/auth.js"

const router = Router()

function generateMfaCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ ok: false, error: "E-mail e senha são obrigatórios." })
    return
  }

  const user: DBUser | null = findUserByEmail(email)

  if (!user) {
    // Constant-time denial to avoid user enumeration
    await bcrypt.compare("dummy", "$2a$10$dummyhashfordummycomparison1234567890ab")
    res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." })
    return
  }

  // Generate and store a 2FA code (valid for 5 minutes)
  const code = generateMfaCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  saveMfaCode(user.id, code, expiresAt)

  // Issue a short-lived "pending" JWT (used only to verify MFA step)
  const pendingToken = signPendingToken(user.id, user.email)

  // In production, send `code` via email/SMS. For demo: return it in response.
  res.json({
    ok: true,
    pendingToken,
    mfaCode: code, // ← Demo only: expose code so user can complete 2FA flow
    message: "Credenciais válidas. Informe o código de verificação.",
  })
})

// ─── POST /api/auth/verify-mfa ───────────────────────────────────────────────
router.post("/verify-mfa", (req: Request, res: Response) => {
  const { pendingToken, code } = req.body as { pendingToken?: string; code?: string }

  if (!pendingToken || !code) {
    res.status(400).json({ ok: false, error: "Token e código são obrigatórios." })
    return
  }

  const payload: JwtPayload | null = decodePendingToken(pendingToken)
  if (!payload) {
    res.status(401).json({ ok: false, error: "Token expirado. Faça login novamente." })
    return
  }

  const valid = validateMfaCode(payload.sub, code)
  if (!valid) {
    res.status(401).json({ ok: false, error: "Código inválido ou expirado." })
    return
  }

  // Fetch user data to include in response
  const user = findUserByEmail(payload.email)
  if (!user) {
    res.status(500).json({ ok: false, error: "Erro interno. Tente novamente." })
    return
  }

  const sessionToken = signSessionToken(user.id, user.email)

  res.json({
    ok: true,
    token: sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      initials: user.initials,
    },
  })
})

// ─── POST /api/auth/resend-mfa ───────────────────────────────────────────────
router.post("/resend-mfa", (req: Request, res: Response) => {
  const { pendingToken } = req.body as { pendingToken?: string }

  if (!pendingToken) {
    res.status(400).json({ ok: false, error: "Token obrigatório." })
    return
  }

  const payload = decodePendingToken(pendingToken)
  if (!payload) {
    res.status(401).json({ ok: false, error: "Token expirado. Faça login novamente." })
    return
  }

  const code = generateMfaCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  saveMfaCode(payload.sub, code, expiresAt)

  res.json({
    ok: true,
    mfaCode: code, // ← Demo only
    message: "Código reenviado com sucesso.",
  })
})

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const user = findUserByEmail(payload.email)
  if (!user) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }
  res.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      initials: user.initials,
    },
  })
})

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (_req: Request, res: Response) => {
  // JWT is stateless — client discards the token.
  // For a full revocation list, store invalidated JTIs in the DB.
  res.json({ ok: true, message: "Sessão encerrada." })
})

export default router
