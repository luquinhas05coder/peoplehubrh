/**
 * routes/employees.routes.ts — Gestão de Colaboradores & Pastas de RH
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"

const router = Router()

// GET /api/employees
router.get("/", (req: Request, res: Response) => {
  const { search, department, status } = req.query as Record<string, string>
  const db = getDB()

  let sql = `SELECT * FROM employees WHERE 1=1`
  const params: any[] = []

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
  const db = getDB()

  const result = db.exec(`SELECT * FROM employees WHERE id = ?`, [id])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não encontrado." })
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

// POST /api/employees (Criar pasta de colaborador / Novo funcionário)
router.post("/", (req: Request, res: Response) => {
  const { name, role, department, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, customSchedulePattern } = req.body

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

  db.run(
    `INSERT INTO employees (id, name, role, department, status, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, customSchedulePattern)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  )

  persist()

  res.status(201).json({ ok: true, id, message: "Pasta de colaborador criada com sucesso." })
})

// DELETE /api/employees/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  db.run(`DELETE FROM employees WHERE id = ?`, [id])
  persist()

  res.json({ ok: true, message: "Colaborador removido com sucesso." })
})

// PATCH /api/employees/:id
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
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
  db.run(`UPDATE employees SET ${fields.join(", ")} WHERE id = ?`, params)
  persist()

  res.json({ ok: true, message: "Cadastro do colaborador atualizado com sucesso." })
})

export default router
