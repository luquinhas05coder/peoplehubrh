/**
 * routes/auth.routes.ts — Endpoints de Autenticação & 2FA (com suporte a TOTP / Google Authenticator)
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"
import { getDB, persist } from "../db/index.js"
import {
  signPendingToken,
  signSessionToken,
  decodePendingToken,
  verifySessionToken,
  requireAuth,
  type JwtPayload,
} from "../middleware/auth.js"
import { generateSecureRandomPassword, sendForgotPasswordEmail } from "../services/mail.service.js"

const router = Router()


function generateMfaCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// GET /api/auth/tenants
router.get("/tenants", (_req: Request, res: Response) => {
  const db = getDB()
  const result = db.exec(`SELECT id, name, slug, cnpj, plan, status FROM tenants WHERE status = 'active' ORDER BY name ASC`)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, tenants: [] })
    return
  }

  const columns = result[0].columns
  const tenants = result[0].values.map((row) => {
    const t: any = {}
    columns.forEach((col, idx) => {
      t[col] = row[idx]
    })
    return t
  })

  res.json({ ok: true, tenants })
})

// POST /api/auth/register (Desativado — Apenas o RH cria acessos via pasta do colaborador)
router.post("/register", async (_req: Request, res: Response) => {
  res.status(403).json({
    ok: false,
    error: "O cadastro público está desativado. Somente o RH pode gerar o acesso do colaborador ao criar sua pasta funcional.",
  })
})

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ ok: false, error: "E-mail e senha são obrigatórios." })
    return
  }

  const db = getDB()
  const result = db.exec(
    `SELECT id, name, email, password, role, department, initials, tenant_id, two_factor_enabled, two_factor_secret, must_change_password FROM users WHERE lower(email) = lower(?)`,
    [email]
  )

  let userObj: { id: string; name: string; email: string; role: string; department: string; initials: string; tenant_id: string; two_factor_enabled: number; must_change_password: number }

  if (!result.length || !result[0].values.length) {
    res.status(401).json({
      ok: false,
      error: "Usuário não encontrado. O acesso à plataforma deve ser cadastrado previamente pelo RH ao criar a pasta do colaborador.",
    })
    return
  }

  const [id, name, userEmail, hash, role, department, initials, rawTenantId, raw2faEnabled, _secret, rawMustChange] = result[0].values[0] as [string, string, string, string, string, string, string, string | null, number | null, string | null, number | null]
  const valid = await bcrypt.compare(password, hash)

  if (!valid) {
    res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." })
    return
  }

  const tenantId = rawTenantId || "tenant_default"
  userObj = {
    id,
    name,
    email: userEmail,
    role,
    department,
    initials,
    tenant_id: tenantId,
    two_factor_enabled: raw2faEnabled === 1 ? 1 : 0,
    must_change_password: rawMustChange === 1 ? 1 : 0,
  }

  // Se o 2FA (Google Authenticator) estiver habilitado para este usuário, bloquear emissão direta de token
  if (userObj.two_factor_enabled === 1) {
    const pendingToken = signPendingToken(userObj.id, userObj.email)
    res.json({
      ok: true,
      require2fa: true,
      pendingToken,
      message: "Autenticação em duas etapas (2FA) necessária. Abra seu app autenticador.",
    })
    return
  }

  // Buscar dados da organização (Tenant)
  let tenantName = "PeopleHub Matriz"
  let tenantSlug = "matriz"
  const tRes = db.exec(`SELECT name, slug FROM tenants WHERE id = ?`, [userObj.tenant_id])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
    tenantSlug = tRes[0].values[0][1] as string
  }

  const token = signSessionToken(userObj.id, userObj.email, userObj.tenant_id, tenantName)

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  })
  persist()

  res.json({
    ok: true,
    token,
    user: {
      ...userObj,
      twoFactorEnabled: false,
      mustChangePassword: userObj.must_change_password === 1,
      tenantId: userObj.tenant_id,
      tenantName,
      tenantSlug,
    },
    tenant: {
      id: userObj.tenant_id,
      name: tenantName,
      slug: tenantSlug,
    },
    message: "Login efetuado com sucesso.",
  })
})

// POST /api/auth/verify-mfa
router.post("/verify-mfa", (req: Request, res: Response) => {
  const { pendingToken, code } = req.body as { pendingToken?: string; code?: string }

  if (!pendingToken || !code) {
    res.status(400).json({ ok: false, error: "Token pendente e código são obrigatórios." })
    return
  }

  const payload = decodePendingToken(pendingToken)
  if (!payload) {
    res.status(401).json({ ok: false, error: "Token expirado ou inválido. Faça login novamente." })
    return
  }

  const db = getDB()
  const userRes = db.exec(
    `SELECT id, name, email, role, department, initials, tenant_id, two_factor_enabled, two_factor_secret, must_change_password FROM users WHERE id = ?`,
    [payload.sub]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [id, name, email, role, department, initials, rawTenantId, raw2faEnabled, secret, rawMustChange] = userRes[0].values[0] as [string, string, string, string, string, string, string | null, number | null, string | null, number | null]
  const cleanCode = code.trim().replace(/\s+/g, "")
  let codeValid = false

  // 1. Validar via TOTP se segredo estiver configurado
  if (secret) {
    try {
      codeValid = verifySync({ token: cleanCode, secret }).valid
    } catch (_e) {
      codeValid = false
    }
  }

  // 2. Fallback para códigos numéricos na tabela mfa_codes (caso código temporário de demo/SMS)
  if (!codeValid) {
    const mfaCheck = db.exec(
      `SELECT id FROM mfa_codes
       WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
       ORDER BY expires_at DESC LIMIT 1`,
      [payload.sub, cleanCode]
    )
    if (mfaCheck.length && mfaCheck[0].values.length) {
      codeValid = true
      const mfaId = mfaCheck[0].values[0][0] as string
      db.run(`UPDATE mfa_codes SET used = 1 WHERE id = ?`, [mfaId])
      persist()
    }
  }

  if (!codeValid) {
    res.status(401).json({ ok: false, error: "Código 2FA incorreto ou expirado." })
    return
  }

  const tenantId = rawTenantId || "tenant_default"

  let tenantName = "PeopleHub Matriz"
  let tenantSlug = "matriz"
  const tRes = db.exec(`SELECT name, slug FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
    tenantSlug = tRes[0].values[0][1] as string
  }

  const sessionToken = signSessionToken(id, email, tenantId, tenantName)

  res.cookie("token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  })

  res.json({
    ok: true,
    token: sessionToken,
    user: {
      id,
      name,
      email,
      role,
      department,
      initials,
      twoFactorEnabled: raw2faEnabled === 1,
      mustChangePassword: rawMustChange === 1,
      tenantId,
      tenantName,
      tenantSlug,
    },
    tenant: {
      id: tenantId,
      name: tenantName,
      slug: tenantSlug,
    },
  })
})

// ─── ENDPOINTS DE GESTÃO 2FA (TOTP / Google Authenticator) ───

// GET /api/auth/2fa/status
router.get("/2fa/status", requireAuth, (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const db = getDB()
  const userRes = db.exec(
    `SELECT two_factor_enabled FROM users WHERE id = ?`,
    [payload.sub]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const enabled = userRes[0].values[0][0] === 1
  res.json({ ok: true, enabled })
})

// POST /api/auth/2fa/setup
router.post("/2fa/setup", requireAuth, async (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const db = getDB()

  const userRes = db.exec(`SELECT email FROM users WHERE id = ?`, [payload.sub])
  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }
  const email = userRes[0].values[0][0] as string

  // Gerar chave secreta base32 TOTP única
  const secret = generateSecret()
  const otpauth = generateURI({ issuer: "PeopleHub RH", label: email, secret })

  try {
    const qrCode = await QRCode.toDataURL(otpauth, {
      margin: 2,
      width: 240,
      color: {
        dark: "#0a4d47",
        light: "#ffffff",
      },
    })

    // Salvar o segredo em preparação para confirmação
    db.run(`UPDATE users SET two_factor_secret = ? WHERE id = ?`, [secret, payload.sub])
    persist()

    res.json({
      ok: true,
      secret,
      qrCode,
      otpauth,
      message: "Escaneie o QR Code no Google Authenticator ou insira o segredo manualmente.",
    })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Erro ao gerar QR Code para 2FA: " + err.message })
  }
})

// POST /api/auth/2fa/enable
router.post("/2fa/enable", requireAuth, (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const { code } = req.body as { code?: string }

  if (!code) {
    res.status(400).json({ ok: false, error: "Código de 6 dígitos é obrigatório." })
    return
  }

  const db = getDB()
  const userRes = db.exec(`SELECT two_factor_secret FROM users WHERE id = ?`, [payload.sub])
  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const secret = userRes[0].values[0][0] as string | null
  if (!secret) {
    res.status(400).json({ ok: false, error: "Configuração de 2FA não iniciada. Execute o setup primeiro." })
    return
  }

  const cleanCode = code.trim().replace(/\s+/g, "")
  let isValid = false
  try {
    isValid = verifySync({ token: cleanCode, secret }).valid
  } catch (_e) {
    isValid = false
  }

  if (!isValid) {
    res.status(400).json({ ok: false, error: "Código inválido. Verifique o horário do aplicativo e tente novamente." })
    return
  }

  db.run(`UPDATE users SET two_factor_enabled = 1 WHERE id = ?`, [payload.sub])
  persist()

  res.json({
    ok: true,
    message: "Autenticação em Duas Etapas (2FA) ativada com sucesso!",
  })
})

// POST /api/auth/2fa/disable
router.post("/2fa/disable", requireAuth, (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const db = getDB()

  db.run(`UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?`, [payload.sub])
  persist()

  res.json({
    ok: true,
    message: "Autenticação em Duas Etapas desativada com sucesso.",
  })
})

// POST /api/auth/resend-mfa
router.post("/resend-mfa", (req: Request, res: Response) => {
  const { pendingToken } = req.body as { pendingToken?: string }

  if (!pendingToken) {
    res.status(400).json({ ok: false, error: "Token pendente obrigatório." })
    return
  }

  const payload = decodePendingToken(pendingToken)
  if (!payload) {
    res.status(401).json({ ok: false, error: "Token expirado. Faça login novamente." })
    return
  }

  const code = generateMfaCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const mfaId = `mfa_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const db = getDB()
  db.run(`UPDATE mfa_codes SET used = 1 WHERE user_id = ? AND used = 0`, [payload.sub])
  db.run(`INSERT INTO mfa_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)`, [
    mfaId,
    payload.sub,
    code,
    expiresAt,
  ])
  persist()

  res.json({
    ok: true,
    mfaCode: code,
    message: "Novo código 2FA enviado com sucesso.",
  })
})

// GET /api/auth/me
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const db = getDB()
  const userRes = db.exec(
    `SELECT id, name, email, role, department, initials, tenant_id, two_factor_enabled, must_change_password FROM users WHERE lower(email) = lower(?)`,
    [payload.email]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [id, name, email, role, department, initials, rawTenantId, raw2faEnabled, rawMustChange] = userRes[0].values[0] as [string, string, string, string, string, string, string | null, number | null, number | null]
  const tenantId = rawTenantId || "tenant_default"

  let tenantName = "PeopleHub Matriz"
  let tenantSlug = "matriz"
  const tRes = db.exec(`SELECT name, slug FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
    tenantSlug = tRes[0].values[0][1] as string
  }

  res.json({
    ok: true,
    user: {
      id,
      name,
      email,
      role,
      department,
      initials,
      twoFactorEnabled: raw2faEnabled === 1,
      mustChangePassword: rawMustChange === 1,
      tenantId,
      tenantName,
      tenantSlug,
    },
    tenant: {
      id: tenantId,
      name: tenantName,
      slug: tenantSlug,
    },
  })
})

// PATCH /api/auth/profile
router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  const payload = (req as Request & { user: JwtPayload }).user
  const { name, email, role, department, password } = req.body as {
    name?: string
    email?: string
    role?: string
    department?: string
    password?: string
  }

  const db = getDB()
  const userRes = db.exec(`SELECT id, role FROM users WHERE lower(email) = lower(?)`, [payload.email])

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const userId = userRes[0].values[0][0] as string
  const currentRole = (userRes[0].values[0][1] as string) || ""

  if (name) {
    const rawName = name.trim()
    const initials = rawName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "RH"
    db.run(`UPDATE users SET name = ?, initials = ? WHERE id = ?`, [rawName, initials, userId])
  }
  if (email) {
    db.run(`UPDATE users SET email = ? WHERE id = ?`, [email.trim().toLowerCase(), userId])
  }
  const isAdmin =
    payload.email?.toLowerCase() === "admin@empresa.com" ||
    currentRole.toLowerCase().includes("admin") ||
    currentRole.toLowerCase().includes("ti")

  if (isAdmin) {
    if (role) {
      db.run(`UPDATE users SET role = ? WHERE id = ?`, [role.trim(), userId])
    }
    if (department) {
      db.run(`UPDATE users SET department = ? WHERE id = ?`, [department.trim(), userId])
    }
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10)
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, userId])
  }

  persist()

  const updatedRes = db.exec(`SELECT id, name, email, role, department, initials FROM users WHERE id = ?`, [userId])
  const [id, uName, uEmail, uRole, uDept, uInitials] = updatedRes[0].values[0] as string[]

  res.json({
    ok: true,
    user: { id, name: uName, email: uEmail, role: uRole, department: uDept, initials: uInitials },
    message: "Perfil atualizado com sucesso.",
  })
})

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", { path: "/" })
  res.json({ ok: true, message: "Sessão encerrada com sucesso." })
})

// POST /api/auth/change-password (Troca obrigatória no primeiro login ou redefinição)
router.post("/change-password", async (req: Request, res: Response) => {
  const { newPassword, currentPassword, email: bodyEmail, userId: bodyUserId } = req.body as {
    newPassword?: string
    currentPassword?: string
    email?: string
    userId?: string
  }

  if (!newPassword || newPassword.trim().length < 6) {
    res.status(400).json({ ok: false, error: "A nova senha deve ter no mínimo 6 caracteres." })
    return
  }

  let targetUserId: string | null = null
  const authHeader = req.headers.authorization
  const token = (req.cookies && req.cookies.token) || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)

  if (token) {
    const verified = verifySessionToken(token)
    if (verified) {
      targetUserId = verified.sub
    }
  }

  const db = getDB()

  if (!targetUserId && bodyUserId) {
    targetUserId = bodyUserId
  }

  if (!targetUserId && bodyEmail) {
    const uRes = db.exec(`SELECT id FROM users WHERE lower(email) = lower(?)`, [bodyEmail.trim()])
    if (uRes.length && uRes[0].values.length) {
      targetUserId = uRes[0].values[0][0] as string
    }
  }

  if (!targetUserId) {
    res.status(401).json({ ok: false, error: "Usuário não autenticado ou não identificado." })
    return
  }

  // Buscar usuário no banco
  const userRes = db.exec(`SELECT id, password FROM users WHERE id = ?`, [targetUserId])
  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [, hash] = userRes[0].values[0] as [string, string]

  // Se informou a senha atual/temporária, validar
  if (currentPassword) {
    const valid = await bcrypt.compare(currentPassword, hash)
    if (!valid) {
      res.status(400).json({ ok: false, error: "A senha temporária / atual informada está incorreta." })
      return
    }
  }

  const newHash = await bcrypt.hash(newPassword.trim(), 10)
  db.run(`UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?`, [newHash, targetUserId])
  persist()

  res.json({
    ok: true,
    message: "Senha alterada com sucesso! Seu acesso permanente foi configurado.",
  })
})

// POST /api/auth/forgot-password (Esqueci a minha senha - Dispara e-mail via SMTP Gmail)
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string }

  if (!email || !email.trim()) {
    res.status(400).json({ ok: false, error: "Informe seu e-mail corporativo para recuperar a senha." })
    return
  }

  const cleanEmail = email.trim().toLowerCase()
  const db = getDB()
  const userRes = db.exec(
    `SELECT id, name, email, tenant_id FROM users WHERE lower(email) = ?`,
    [cleanEmail]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({
      ok: false,
      error: "E-mail corporativo não encontrado. Verifique a digitação ou solicite seu acesso ao setor de RH.",
    })
    return
  }

  const [id, name, userEmail, rawTenantId] = userRes[0].values[0] as [string, string, string, string | null]
  const tenantId = rawTenantId || "tenant_default"

  // 1. Gerar nova senha temporária aleatória segura
  const temporaryPassword = generateSecureRandomPassword()
  const newHash = await bcrypt.hash(temporaryPassword, 10)

  // 2. Atualizar senha no banco e forçar troca no login (must_change_password = 1)
  db.run(`UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?`, [newHash, id])
  persist()

  // 3. Buscar nome do tenant
  let tenantName = "PeopleHub Matriz"
  const tRes = db.exec(`SELECT name FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
  }

  // 4. Disparar e-mail via SMTP
  try {
    const mailResult = await sendForgotPasswordEmail({
      to: userEmail,
      name,
      temporaryPassword,
      tenantName,
    })

    if (!mailResult.ok) {
      console.warn("[FORGOT-PASSWORD] Erro no envio SMTP:", mailResult.error)
    }

    res.json({
      ok: true,
      email: userEmail,
      simulated: mailResult.simulated || false,
      message: `Enviamos as instruções e sua nova senha temporária para ${userEmail}. Verifique sua caixa de entrada.`,
    })
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: "Erro ao disparar e-mail de recuperação: " + (err?.message || "falha interna"),
    })
  }
})

export default router

