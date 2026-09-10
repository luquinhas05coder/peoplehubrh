/**
 * routes/documents.routes.ts — Emissão e Gestão de Documentos de RH
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"

const router = Router()

// GET /api/documents
router.get("/", (req: Request, res: Response) => {
  const { category, search } = req.query as Record<string, string>
  const db = getDB()

  let sql = `SELECT * FROM documents WHERE 1=1`
  const params: any[] = []

  if (category) {
    sql += ` AND category = ?`
    params.push(category)
  }
  if (search) {
    sql += ` AND (lower(name) LIKE lower(?) OR lower(employeeName) LIKE lower(?))`
    params.push(`%${search}%`, `%${search}%`)
  }

  sql += ` ORDER BY date DESC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, documents: [] })
    return
  }

  const columns = result[0].columns
  const documents = result[0].values.map((row) => {
    const doc: any = {}
    columns.forEach((col, idx) => {
      doc[col] = row[idx]
    })
    return doc
  })

  res.json({ ok: true, documents })
})

// POST /api/documents/generate
router.post("/generate", (req: Request, res: Response) => {
  const { templateName, category, employeeName, notes } = req.body

  if (!templateName || !employeeName) {
    res.status(400).json({ ok: false, error: "Nome do modelo e do colaborador são obrigatórios." })
    return
  }

  const id = `DOC-${Math.floor(1000 + Math.random() * 9000)}`
  const date = new Date().toISOString().split("T")[0]
  const cat = category || "Declarações"
  const fileName = `${templateName.toLowerCase().replace(/\s+/g, "_")}_${employeeName.toLowerCase().replace(/\s+/g, "_")}.pdf`

  const db = getDB()
  db.run(
    `INSERT INTO documents (id, name, category, employeeName, date, status, fileUrl, type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, templateName, cat, employeeName, date, "Emitido", `/docs/${fileName}`, "PDF"]
  )

  persist()

  res.status(201).json({
    ok: true,
    document: {
      id,
      name: templateName,
      category: cat,
      employeeName,
      date,
      status: "Emitido",
      fileUrl: `/docs/${fileName}`,
      type: "PDF",
    },
    message: "Documento gerado e emitido com sucesso.",
  })
})

// DELETE /api/documents/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  db.run(`DELETE FROM documents WHERE id = ?`, [id])
  persist()

  res.json({ ok: true, message: "Documento excluído com sucesso." })
})

// GET /api/documents/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const db = getDB()

  const result = db.exec(`SELECT * FROM documents WHERE id = ?`, [id])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Documento não encontrado." })
    return
  }

  const columns = result[0].columns
  const doc: any = {}
  result[0].values[0].forEach((val, idx) => {
    doc[columns[idx]] = val
  })

  res.json({ ok: true, document: doc })
})

// PATCH /api/documents/:id/sign
router.patch("/:id/sign", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { status } = req.body

  if (!status) {
    res.status(400).json({ ok: false, error: "Status de assinatura é obrigatório." })
    return
  }

  const db = getDB()
  db.run(`UPDATE documents SET status = ? WHERE id = ?`, [status, id])
  persist()

  res.json({ ok: true, message: `Status do documento atualizado para "${status}".` })
})

export default router
