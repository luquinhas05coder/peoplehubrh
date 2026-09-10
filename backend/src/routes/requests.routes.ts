/**
 * routes/requests.routes.ts — Gestão de Solicitações & Chamados de RH
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"

const router = Router()

// GET /api/requests
router.get("/", (req: Request, res: Response) => {
  const { status, type, priority, search } = req.query as Record<string, string>
  const db = getDB()

  let sql = `SELECT * FROM requests WHERE 1=1`
  const params: any[] = []

  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (type) {
    sql += ` AND type = ?`
    params.push(type)
  }
  if (priority) {
    sql += ` AND priority = ?`
    params.push(priority)
  }
  if (search) {
    sql += ` AND (lower(requester) LIKE lower(?) OR lower(description) LIKE lower(?))`
    params.push(`%${search}%`, `%${search}%`)
  }

  sql += ` ORDER BY id DESC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, requests: [] })
    return
  }

  const columns = result[0].columns
  const requests = result[0].values.map((row) => {
    const reqItem: any = {}
    columns.forEach((col, idx) => {
      reqItem[col] = row[idx]
    })
    if (reqItem.details_json) {
      try {
        reqItem.details = JSON.parse(reqItem.details_json)
      } catch {
        reqItem.details = {}
      }
    }
    delete reqItem.details_json
    return reqItem
  })

  res.json({ ok: true, requests })
})

// POST /api/requests
router.post("/", (req: Request, res: Response) => {
  const { type, requester, department, priority, description, details } = req.body

  if (!type || !requester || !description) {
    res.status(400).json({ ok: false, error: "Tipo, solicitante e descrição são obrigatórios." })
    return
  }

  const id = `REQ-${Math.floor(100 + Math.random() * 900)}`
  const date = new Date().toISOString().split("T")[0]
  const status = "Em Análise"

  const db = getDB()
  db.run(
    `INSERT INTO requests (id, type, requester, department, date, status, priority, description, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      type,
      requester,
      department || "Geral",
      date,
      status,
      priority || "Média",
      description,
      details ? JSON.stringify(details) : null,
    ]
  )

  persist()

  res.status(201).json({ ok: true, id, message: "Solicitação registrada com sucesso." })
})

// PATCH /api/requests/:id/status
router.patch("/:id/status", (req: Request, res: Response) => {
  const { id } = req.params
  const { status } = req.body

  if (!status) {
    res.status(400).json({ ok: false, error: "Status é obrigatório." })
    return
  }

  const db = getDB()
  db.run(`UPDATE requests SET status = ? WHERE id = ?`, [status, id])
  persist()

  res.json({ ok: true, message: `Status da solicitação alterado para "${status}".` })
})

// DELETE /api/requests/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  db.run(`DELETE FROM requests WHERE id = ?`, [id])
  persist()

  res.json({ ok: true, message: "Solicitação excluída com sucesso." })
})

// GET /api/requests/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  const result = db.exec(`SELECT * FROM requests WHERE id = ?`, [id])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação não encontrada." })
    return
  }

  const columns = result[0].columns
  const reqItem: any = {}
  result[0].values[0].forEach((val, idx) => {
    reqItem[columns[idx]] = val
  })

  if (reqItem.details_json) {
    try { reqItem.details = JSON.parse(reqItem.details_json) } catch { reqItem.details = {} }
  }
  delete reqItem.details_json

  res.json({ ok: true, request: reqItem })
})

// PATCH /api/requests/:id (Atualização genérica de solicitação)
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { status, priority, description, details } = req.body

  const db = getDB()
  const fields: string[] = []
  const params: any[] = []

  if (status !== undefined) { fields.push("status = ?"); params.push(status) }
  if (priority !== undefined) { fields.push("priority = ?"); params.push(priority) }
  if (description !== undefined) { fields.push("description = ?"); params.push(description) }
  if (details !== undefined) { fields.push("details_json = ?"); params.push(JSON.stringify(details)) }

  if (fields.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum campo informado para atualização." })
    return
  }

  params.push(id)
  db.run(`UPDATE requests SET ${fields.join(", ")} WHERE id = ?`, params)
  persist()

  res.json({ ok: true, message: "Solicitação atualizada com sucesso." })
})

export default router
