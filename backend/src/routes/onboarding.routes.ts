/**
 * routes/onboarding.routes.ts — Gestão do Módulo de Integração (Onboarding)
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"

const router = Router()

// GET /api/onboarding
router.get("/", (req: Request, res: Response) => {
  const { status, department } = req.query as Record<string, string>
  const db = getDB()

  let sql = `SELECT * FROM onboarding WHERE 1=1`
  const params: any[] = []

  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (department) {
    sql += ` AND department = ?`
    params.push(department)
  }

  sql += ` ORDER BY startDate ASC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, onboardingItems: [] })
    return
  }

  const columns = result[0].columns
  const onboardingItems = result[0].values.map((row) => {
    const item: any = {}
    columns.forEach((col, idx) => {
      item[col] = row[idx]
    })
    if (item.steps_json) {
      try {
        item.steps = JSON.parse(item.steps_json)
      } catch {
        item.steps = []
      }
    }
    delete item.steps_json
    return item
  })

  res.json({ ok: true, onboardingItems })
})

// POST /api/onboarding
router.post("/", (req: Request, res: Response) => {
  const { candidateName, role, department, startDate, mentor } = req.body

  if (!candidateName || !role || !department) {
    res.status(400).json({ ok: false, error: "Nome, cargo e departamento são obrigatórios." })
    return
  }

  const id = `ONB-${Math.floor(10 + Math.random() * 90)}`
  const defaultSteps = [
    { id: 1, title: "Envio de Documentos Pessoais", done: false },
    { id: 2, title: "Assinatura do Contrato de Trabalho", done: false },
    { id: 3, title: "Configuração de Equipamentos e Acessos", done: false },
    { id: 4, title: "Treinamento Institucional de RH", done: false },
    { id: 5, title: "Reunião de Boas-vindas com o Time", done: false },
  ]

  const db = getDB()
  db.run(
    `INSERT INTO onboarding (id, candidateName, role, department, startDate, mentor, status, progress, steps_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      candidateName,
      role,
      department,
      startDate || new Date().toISOString().split("T")[0],
      mentor || "Equipe de RH",
      "Em Progresso",
      0,
      JSON.stringify(defaultSteps),
    ]
  )

  persist()

  res.status(201).json({ ok: true, id, message: "Onboarding iniciado com sucesso." })
})

// PATCH /api/onboarding/:id/step
router.patch("/:id/step", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { stepId, done } = req.body

  if (stepId === undefined || done === undefined) {
    res.status(400).json({ ok: false, error: "ID da etapa e status 'done' são obrigatórios." })
    return
  }

  const db = getDB()
  const result = db.exec(`SELECT steps_json FROM onboarding WHERE id = ?`, [id])

  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Onboarding não encontrado." })
    return
  }

  let steps: any[] = []
  try {
    steps = JSON.parse(result[0].values[0][0] as string)
  } catch {
    steps = []
  }

  const step = steps.find((s) => s.id === stepId)
  if (step) {
    step.done = Boolean(done)
  }

  const completed = steps.filter((s) => s.done).length
  const progress = Math.round((completed / steps.length) * 100)
  const status = progress === 100 ? "Concluído" : "Em Progresso"

  db.run(
    `UPDATE onboarding SET steps_json = ?, progress = ?, status = ? WHERE id = ?`,
    [JSON.stringify(steps), progress, status, id]
  )

  persist()

  res.json({ ok: true, progress, status, steps, message: "Etapa atualizada com sucesso." })
})

// DELETE /api/onboarding/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  db.run(`DELETE FROM onboarding WHERE id = ?`, [id])
  persist()

  res.json({ ok: true, message: "Processo de onboarding excluído com sucesso." })
})

// GET /api/onboarding/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  const result = db.exec(`SELECT * FROM onboarding WHERE id = ?`, [id])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Processo de onboarding não encontrado." })
    return
  }

  const columns = result[0].columns
  const item: any = {}
  result[0].values[0].forEach((val, idx) => {
    item[columns[idx]] = val
  })

  if (item.steps_json) {
    try { item.steps = JSON.parse(item.steps_json) } catch { item.steps = [] }
  }
  delete item.steps_json

  res.json({ ok: true, onboarding: item })
})

// PATCH /api/onboarding/:id (Atualização genérica)
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { candidateName, role, department, startDate, mentor, status } = req.body

  const db = getDB()
  const fields: string[] = []
  const params: any[] = []

  if (candidateName !== undefined) { fields.push("candidateName = ?"); params.push(candidateName) }
  if (role !== undefined) { fields.push("role = ?"); params.push(role) }
  if (department !== undefined) { fields.push("department = ?"); params.push(department) }
  if (startDate !== undefined) { fields.push("startDate = ?"); params.push(startDate) }
  if (mentor !== undefined) { fields.push("mentor = ?"); params.push(mentor) }
  if (status !== undefined) { fields.push("status = ?"); params.push(status) }

  if (fields.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum campo informado para atualização." })
    return
  }

  params.push(id)
  db.run(`UPDATE onboarding SET ${fields.join(", ")} WHERE id = ?`, params)
  persist()

  res.json({ ok: true, message: "Onboarding atualizado com sucesso." })
})

export default router
