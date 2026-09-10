/**
 * routes/auth.routes.ts — Endpoints de Autenticação & 2FA
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { getDB, persist } from "../db/index.js"
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

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ ok: false, error: "E-mail e senha são obrigatórios." })
    return
  }

  const db = getDB()
  const result = db.exec(
    `SELECT id, name, email, password, role, department, initials FROM users WHERE lower(email) = lower(?)`,
    [email]
  )

  let userObj: { id: string; name: string; email: string; role: string; department: string; initials: string }

  if (!result.length || !result[0].values.length) {
    // Se o usuário não existir no banco, auto-cadastrar com as credenciais fornecidas
    const newId = `usr_${Date.now()}`
    const rawName = email.split("@")[0].replace(/\./g, " ")
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1)
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "US"
    
    const e = email.toLowerCase()
    let role = "Gestor de RH"
    let department = "Recursos Humanos"

    if (e.includes("dp@") || e.includes("folha@") || e.includes("pessoal@")) {
      role = "Especialista em DP & Folha"
      department = "Departamento Pessoal"
    } else if (e.includes("ti@") || e.includes("tech@") || e.includes("suporte@")) {
      role = "Administrador de Sistemas & TI"
      department = "Tecnologia da Informação"
    } else if (e.includes("colaborador@") || e.includes("funcionario@") || e.includes("dev@")) {
      role = "Colaborador"
      department = "Operações"
    }

    const hash = bcrypt.hashSync(password, 10)

    db.run(
      `INSERT INTO users (id, name, email, password, role, department, initials) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, name, email, hash, role, department, initials]
    )

    userObj = { id: newId, name, email, role, department, initials }
  } else {
    const [id, name, userEmail, hash, role, department, initials] = result[0].values[0] as string[]
    const valid = await bcrypt.compare(password, hash)

    if (!valid) {
      res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." })
      return
    }

    userObj = { id, name, email: userEmail, role, department, initials }
  }

  const token = signSessionToken(userObj.id, userObj.email)

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
    user: userObj,
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
  const mfaCheck = db.exec(
    `SELECT id FROM mfa_codes
     WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
     ORDER BY expires_at DESC LIMIT 1`,
    [payload.sub, code]
  )

  if (!mfaCheck.length || !mfaCheck[0].values.length) {
    res.status(401).json({ ok: false, error: "Código 2FA inválido ou expirado." })
    return
  }

  const mfaId = mfaCheck[0].values[0][0] as string
  db.run(`UPDATE mfa_codes SET used = 1 WHERE id = ?`, [mfaId])
  persist()

  const userRes = db.exec(
    `SELECT id, name, email, role, department, initials FROM users WHERE id = ?`,
    [payload.sub]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [id, name, email, role, department, initials] = userRes[0].values[0] as string[]
  const sessionToken = signSessionToken(id, email)

  res.cookie("token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  })

  res.json({
    ok: true,
    token: sessionToken,
    user: { id, name, email, role, department, initials },
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
    `SELECT id, name, email, role, department, initials FROM users WHERE lower(email) = lower(?)`,
    [payload.email]
  )

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const [id, name, email, role, department, initials] = userRes[0].values[0] as string[]
  res.json({
    ok: true,
    user: { id, name, email, role, department, initials },
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
  const userRes = db.exec(`SELECT id FROM users WHERE lower(email) = lower(?)`, [payload.email])

  if (!userRes.length || !userRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Usuário não encontrado." })
    return
  }

  const userId = userRes[0].values[0][0] as string

  if (name) {
    const rawName = name.trim()
    const initials = rawName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "RH"
    db.run(`UPDATE users SET name = ?, initials = ? WHERE id = ?`, [rawName, initials, userId])
  }
  if (email) {
    db.run(`UPDATE users SET email = ? WHERE id = ?`, [email.trim().toLowerCase(), userId])
  }
  if (role) {
    db.run(`UPDATE users SET role = ? WHERE id = ?`, [role.trim(), userId])
  }
  if (department) {
    db.run(`UPDATE users SET department = ? WHERE id = ?`, [department.trim(), userId])
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

export default router
