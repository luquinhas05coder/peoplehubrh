/**
 * routes/documents.routes.ts — Emissão, Gestão e Autoatendimento de Documentos com Multi-Tenancy e RBAC
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, requirePermission, recordAuditLog } from "../middleware/rbac.js"

const router = Router()

// Aplicar resolução de tenant e autenticação RBAC em todas as rotas de documentos
router.use(resolveTenant)
router.use(authenticateRBAC)

// GET /api/documents
router.get("/", (req: Request, res: Response) => {
  const { category, origin, search } = req.query as Record<string, string>
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const scope = req.access?.scope || "OWN"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()

  let sql = `SELECT id, name, category, employeeName, employee_id, expiryDate, date, status, fileUrl, type, origin, file_size, notes, tenant_id FROM documents WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (scope === "OWN") {
    sql += ` AND (lower(employeeName) = ? OR lower(employeeName) = ?)`
    params.push(userName, userEmail)
  }

  if (category) {
    sql += ` AND category = ?`
    params.push(category)
  }
  if (origin) {
    sql += ` AND origin = ?`
    params.push(origin)
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

// POST /api/documents/upload — Upload seguro pelo colaborador (ou RH) de documentos e comprovantes
router.post("/upload", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()
  const { name, category, file_base64, mime_type, file_size, expiryDate, notes, employeeName } = req.body

  if (!name || !category || !file_base64) {
    res.status(400).json({ ok: false, error: "Nome, categoria e arquivo (base64) são obrigatórios." })
    return
  }

  // Validação de formato MIME
  const allowedMimes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  const mime = mime_type || "application/pdf"
  if (!allowedMimes.includes(mime)) {
    res.status(400).json({
      ok: false,
      error: `Formato de arquivo não suportado (${mime}). Formatos aceitos: PDF, JPEG, PNG, WEBP, DOCX.`,
    })
    return
  }

  // Validação estrita de tamanho (máximo 5MB)
  const maxBytes = 5 * 1024 * 1024
  const approxSize = file_size || Math.round((file_base64.length * 3) / 4)
  if (approxSize > maxBytes) {
    res.status(400).json({ ok: false, error: "O arquivo excede o limite máximo permitido de 5MB." })
    return
  }

  const userRole = req.access?.role || "COLABORADOR"
  const isColab = userRole === "COLABORADOR" || req.access?.scope === "OWN"

  // Se for colaborador, o dono é o próprio usuário autenticado e a origem é pessoal
  const targetEmployeeName = isColab ? (req.access?.name || req.access?.email || "Colaborador") : (employeeName || req.access?.name)
  const origin = isColab ? "pessoal" : (req.body.origin || "pessoal")

  const id = `DOC-${Math.floor(1000 + Math.random() * 9000)}`
  const date = new Date().toISOString().split("T")[0]
  const fileType = mime.includes("pdf") ? "PDF" : mime.includes("image") ? "IMG" : "DOCX"
  const fileUrl = `/api/documents/${id}/download`

  db.run(
    `INSERT INTO documents (id, name, category, employeeName, expiryDate, date, status, fileUrl, type, tenant_id, origin, file_base64, mime_type, file_size, notes)
     VALUES (?, ?, ?, ?, ?, ?, 'Enviado', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      category,
      targetEmployeeName,
      expiryDate || null,
      date,
      fileUrl,
      fileType,
      tenantId,
      origin,
      file_base64,
      mime,
      approxSize,
      notes || null,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "DOCUMENT_UPLOAD",
    entity: "documents",
    entityId: id,
    details: { name, category, origin, mime, size: approxSize },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    document: {
      id,
      name,
      category,
      employeeName: targetEmployeeName,
      origin,
      date,
      fileUrl,
      type: fileType,
      status: "Enviado",
    },
    message: "Documento enviado com sucesso.",
  })
})

// POST /api/documents/generate
router.post("/generate", requirePermission("documents.upload"), (req: Request, res: Response) => {
  const { templateName, category, employeeName, notes } = req.body
  const tenantId = req.tenantId || "tenant_default"

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
    `INSERT INTO documents (id, name, category, employeeName, date, status, fileUrl, type, tenant_id, origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'administrativo')`,
    [id, templateName, cat, employeeName, date, "Emitido", `/api/documents/${id}/download`, "PDF", tenantId]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "DOCUMENT_CREATE",
    entity: "documents",
    entityId: id,
    details: { templateName, employeeName },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    document: {
      id,
      name: templateName,
      category: cat,
      employeeName,
      date,
      status: "Emitido",
      fileUrl: `/api/documents/${id}/download`,
      type: "PDF",
      origin: "administrativo",
    },
    message: "Documento administrativo emitido com sucesso.",
  })
})

// DELETE /api/documents/:id
router.delete("/:id", requirePermission("documents.delete"), (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM documents WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "DOCUMENT_DELETE",
    entity: "documents",
    entityId: id,
    tenantId,
  })

  res.json({ ok: true, message: "Documento excluído com sucesso." })
})

// GET /api/documents/:id (com proteção estrita contra IDOR)
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT * FROM documents WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Documento não encontrado nesta organização." })
    return
  }

  const columns = result[0].columns
  const doc: any = {}
  result[0].values[0].forEach((val, idx) => {
    doc[columns[idx]] = val
  })

  // Enforçamento estrito de RBAC contra IDOR
  const scope = req.access?.scope || "OWN"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const docOwner = (doc.employeeName || "").toLowerCase()

  if (scope === "OWN" && docOwner !== userName && docOwner !== userEmail) {
    res.status(403).json({
      ok: false,
      error: "Acesso negado: Você não possui autorização para consultar documentos de outros colaboradores.",
    })
    return
  }

  res.json({ ok: true, document: doc })
})

// GET /api/documents/:id/download (download protegido com RBAC)
router.get("/:id/download", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT * FROM documents WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Documento não encontrado." })
    return
  }

  const columns = result[0].columns
  const doc: any = {}
  result[0].values[0].forEach((val, idx) => {
    doc[columns[idx]] = val
  })

  // Enforçamento estrito de RBAC
  const scope = req.access?.scope || "OWN"
  const userName = (req.access?.name || "").toLowerCase()
  const userEmail = (req.access?.email || "").toLowerCase()
  const docOwner = (doc.employeeName || "").toLowerCase()

  if (scope === "OWN" && docOwner !== userName && docOwner !== userEmail) {
    res.status(403).json({
      ok: false,
      error: "Acesso negado: Você não possui autorização para baixar documentos de outros colaboradores.",
    })
    return
  }

  if (doc.file_base64) {
    const buffer = Buffer.from(doc.file_base64, "base64")
    const mime = doc.mime_type || "application/pdf"
    const ext = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "bin"
    const safeName = (doc.name || "documento").replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    res.setHeader("Content-Type", mime)
    res.setHeader("Content-Disposition", `inline; filename="${safeName}.${ext}"`)
    res.send(buffer)
    return
  }

  res.json({
    ok: true,
    message: "Download autorizado",
    document: {
      id: doc.id,
      name: doc.name,
      category: doc.category,
      employeeName: doc.employeeName,
      fileUrl: doc.fileUrl,
    },
  })
})

// PATCH /api/documents/:id/sign
router.patch("/:id/sign", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const { status } = req.body

  if (!status) {
    res.status(400).json({ ok: false, error: "Status de assinatura é obrigatório." })
    return
  }

  const db = getDB()
  db.run(`UPDATE documents SET status = ? WHERE id = ? AND tenant_id = ?`, [status, id, tenantId])
  persist()

  res.json({ ok: true, message: `Status do documento atualizado para "${status}".` })
})

export default router


