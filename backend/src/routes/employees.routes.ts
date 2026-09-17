/**
 * routes/employees.routes.ts — Gestão de Colaboradores & Pastas de RH com Multi-Tenancy
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { sendWelcomeEmployeeEmail, generateSecureRandomPassword } from "../services/mail.service.js"

const router = Router()

// Aplicar resolução de tenant em todas as rotas de colaboradores
router.use(resolveTenant)

// GET /api/employees
router.get("/", (req: Request, res: Response) => {
  const { search, department, status } = req.query as Record<string, string>
  const db = getDB()
  const tenantId = req.tenantId || "tenant_default"

  let sql = `SELECT * FROM employees WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (department) {
    sql += ` AND department = ?`
    params.push(department)
  }
  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (search) {
    sql += ` AND (lower(name) LIKE lower(?) OR lower(role) LIKE lower(?) OR lower(email) LIKE lower(?))`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  sql += ` ORDER BY name ASC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, employees: [] })
    return
  }

  const columns = result[0].columns
  const employees = result[0].values.map((row) => {
    const emp: any = {}
    columns.forEach((col, idx) => {
      emp[col] = row[idx]
    })
    if (emp.customSchedulePattern && typeof emp.customSchedulePattern === "string") {
      try {
        emp.customSchedulePattern = JSON.parse(emp.customSchedulePattern)
      } catch (_e) {}
    }
    return emp
  })

  res.json({ ok: true, employees })
})

// GET /api/employees/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT * FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não encontrado nesta organização." })
    return
  }

  const columns = result[0].columns
  const emp: any = {}
  result[0].values[0].forEach((val, idx) => {
    emp[columns[idx]] = val
  })
  if (emp.customSchedulePattern && typeof emp.customSchedulePattern === "string") {
    try {
      emp.customSchedulePattern = JSON.parse(emp.customSchedulePattern)
    } catch (_e) {}
  }

  res.json({ ok: true, employee: emp })
})

// POST /api/employees (Criar pasta de colaborador / Novo funcionário e envio de credenciais via SMTP)
router.post("/", async (req: Request, res: Response) => {
  const {
    name,
    role,
    department,
    email,
    phone,
    cpf,
    hireDate,
    salary,
    manager,
    location,
    contractType,
    workSchedule,
    customSchedulePattern,
    initialPassword,
    sendEmail = true,
  } = req.body
  const tenantId = req.tenantId || "tenant_default"

  if (!name || !role || !department || !email) {
    res.status(400).json({ ok: false, error: "Nome, cargo, departamento e e-mail são obrigatórios." })
    return
  }

  const id = `emp_${Date.now()}`
  const db = getDB()
  const patternJson = customSchedulePattern
    ? typeof customSchedulePattern === "string"
      ? customSchedulePattern
      : JSON.stringify(customSchedulePattern)
    : null

  // 1. Criar pasta funcional do colaborador na tabela employees
  db.run(
    `INSERT INTO employees (id, name, role, department, status, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, customSchedulePattern, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      role,
      department,
      "Ativo",
      email,
      phone || "",
      cpf || "",
      hireDate || new Date().toISOString().split("T")[0],
      salary || "R$ 0,00",
      manager || "Não atribuído",
      location || "São Paulo, SP",
      contractType || "prazo_indeterminado",
      workSchedule || "escala_5x2",
      patternJson,
      tenantId,
    ]
  )

  // 2. Gerar senha temporária segura (o RH não visualiza a senha; o sistema gera e dispara ao e-mail)
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanName = String(name).trim()
  const userPassword = initialPassword && String(initialPassword).trim()
    ? String(initialPassword).trim()
    : generateSecureRandomPassword()

  const hash = bcrypt.hashSync(userPassword, 10)
  const initials = cleanName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "US"

  const userRole = role ? String(role) : "Colaborador"
  const userDept = department ? String(department) : "Recursos Humanos"

  const existingUser = db.exec(`SELECT id FROM users WHERE lower(email) = ?`, [cleanEmail])
  if (existingUser.length && existingUser[0].values.length) {
    const existingId = existingUser[0].values[0][0] as string
    db.run(
      `UPDATE users SET name = ?, password = ?, role = ?, department = ?, initials = ?, tenant_id = ?, must_change_password = 1 WHERE id = ?`,
      [cleanName, hash, userRole, userDept, initials, tenantId, existingId]
    )
  } else {
    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    db.run(
      `INSERT INTO users (id, name, email, password, role, department, initials, tenant_id, two_factor_enabled, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [newUserId, cleanName, cleanEmail, hash, userRole, userDept, initials, tenantId]
    )
  }

  persist()

  // 3. Buscar nome do tenant para o e-mail corporativo
  let tenantName = "PeopleHub Matriz"
  const tRes = db.exec(`SELECT name FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
  }

  // 4. Disparo de e-mail SMTP com a senha para o colaborador
  let emailDispatched = false
  let emailError: string | undefined

  if (sendEmail !== false) {
    try {
      const mailRes = await sendWelcomeEmployeeEmail({
        to: cleanEmail,
        name: cleanName,
        temporaryPassword: userPassword,
        role: userRole,
        department: userDept,
        tenantName,
      })
      emailDispatched = mailRes.ok
      if (!mailRes.ok) emailError = mailRes.error
    } catch (mErr: any) {
      emailError = mErr.message
    }
  }

  res.status(201).json({
    ok: true,
    id,
    userEmail: cleanEmail,
    emailDispatched,
    emailError,
    message: emailDispatched
      ? `Pasta de colaborador criada e credenciais de acesso enviadas via SMTP para ${cleanEmail}.`
      : `Pasta de colaborador criada e credenciais de acesso geradas com sucesso.`,
  })
})

// POST /api/employees/:id/resend-access-email (Reenviar e-mail de credenciais com nova senha via SMTP)
router.post("/:id/resend-access-email", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT name, email, role, department FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não encontrado." })
    return
  }

  const [name, email, role, department] = result[0].values[0] as [string, string, string, string]
  const cleanEmail = email.toLowerCase().trim()
  const newPassword = generateSecureRandomPassword()
  const hash = bcrypt.hashSync(newPassword, 10)

  // Atualizar senha na tabela users
  db.run(`UPDATE users SET password = ? WHERE lower(email) = ?`, [hash, cleanEmail])
  persist()

  let tenantName = "PeopleHub Matriz"
  const tRes = db.exec(`SELECT name FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
  }

  const mailRes = await sendWelcomeEmployeeEmail({
    to: cleanEmail,
    name,
    temporaryPassword: newPassword,
    role,
    department,
    tenantName,
  })

  res.json({
    ok: mailRes.ok,
    message: mailRes.ok
      ? `Novas credenciais de acesso enviadas via SMTP para ${cleanEmail}.`
      : `Erro ao disparar e-mail: ${mailRes.error}`,
  })
})

// DELETE /api/employees/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  res.json({ ok: true, message: "Colaborador removido com sucesso." })
})

// PATCH /api/employees/:id
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const { name, role, department, status, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, customSchedulePattern } = req.body

  const db = getDB()
  const fields: string[] = []
  const params: any[] = []

  if (name !== undefined) { fields.push("name = ?"); params.push(name) }
  if (role !== undefined) { fields.push("role = ?"); params.push(role) }
  if (department !== undefined) { fields.push("department = ?"); params.push(department) }
  if (status !== undefined) { fields.push("status = ?"); params.push(status) }
  if (email !== undefined) { fields.push("email = ?"); params.push(email) }
  if (phone !== undefined) { fields.push("phone = ?"); params.push(phone) }
  if (cpf !== undefined) { fields.push("cpf = ?"); params.push(cpf) }
  if (hireDate !== undefined) { fields.push("hireDate = ?"); params.push(hireDate) }
  if (salary !== undefined) { fields.push("salary = ?"); params.push(salary) }
  if (manager !== undefined) { fields.push("manager = ?"); params.push(manager) }
  if (location !== undefined) { fields.push("location = ?"); params.push(location) }
  if (contractType !== undefined) { fields.push("contractType = ?"); params.push(contractType) }
  if (workSchedule !== undefined) { fields.push("workSchedule = ?"); params.push(workSchedule) }
  if (customSchedulePattern !== undefined) {
    fields.push("customSchedulePattern = ?")
    params.push(
      customSchedulePattern
        ? typeof customSchedulePattern === "string"
          ? customSchedulePattern
          : JSON.stringify(customSchedulePattern)
        : null
    )
  }

  if (fields.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum campo informado para atualização." })
    return
  }

  params.push(id)
  params.push(tenantId)
  db.run(`UPDATE employees SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, params)
  persist()

  res.json({ ok: true, message: "Cadastro do colaborador atualizado com sucesso." })
})

export default router

