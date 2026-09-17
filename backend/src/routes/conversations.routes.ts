/**
 * routes/conversations.routes.ts — Gestão de Chat Omnichannel & Mensagens com Multi-Tenancy
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"

const router = Router()

// Aplicar resolução de tenant em todas as rotas de conversas
router.use(resolveTenant)

// GET /api/conversations
router.get("/", (req: Request, res: Response) => {
  const { channel, topic, status, priority, search } = req.query as Record<string, string>
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  let sql = `SELECT * FROM conversations WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (channel) {
    sql += ` AND channel = ?`
    params.push(channel)
  }
  if (topic) {
    sql += ` AND topic = ?`
    params.push(topic)
  }
  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (priority) {
    sql += ` AND priority = ?`
    params.push(priority)
  }
  if (search) {
    sql += ` AND (lower(name) LIKE lower(?) OR lower(lastMessage) LIKE lower(?) OR lower(department) LIKE lower(?))`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  sql += ` ORDER BY pinned DESC, id DESC`

  const convRes = db.exec(sql, params)
  if (!convRes.length || !convRes[0].values.length) {
    res.json({ ok: true, conversations: [] })
    return
  }

  const columns = convRes[0].columns
  const rows = convRes[0].values

  const conversations = rows.map((row) => {
    const c: any = {}
    columns.forEach((col, idx) => {
      c[col] = row[idx]
    })

    // Fetch messages
    const msgRes = db.exec(
      `SELECT id, direction, text, time, status, replyTo_json, forwarded FROM messages WHERE conversation_id = ? ORDER BY id ASC`,
      [c.id]
    )

    const messages = msgRes.length && msgRes[0].values.length
      ? msgRes[0].values.map((mRow) => ({
          id: mRow[0] as string,
          direction: mRow[1] as string,
          text: mRow[2] as string,
          time: mRow[3] as string,
          status: mRow[4] as string || undefined,
          replyTo: mRow[5] ? JSON.parse(mRow[5] as string) : undefined,
          forwarded: Boolean(mRow[6]),
        }))
      : []

    return {
      id: c.id,
      name: c.name,
      initials: c.initials,
      channel: c.channel,
      topic: c.topic,
      role: c.role,
      department: c.department,
      lastMessage: c.lastMessage,
      time: c.time,
      unread: Number(c.unread),
      online: Boolean(c.online),
      status: c.status,
      priority: c.priority,
      pinned: Boolean(c.pinned),
      snoozedUntil: c.snoozedUntil || null,
      assignedTo: c.assignedTo,
      contact: {
        email: c.contact_email || "",
        phone: c.contact_phone || "",
        location: c.contact_location || "",
        tenure: c.contact_tenure || "",
        manager: c.contact_manager || "",
      },
      messages,
    }
  })

  res.json({ ok: true, conversations })
})

// GET /api/conversations/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const convRes = db.exec(`SELECT * FROM conversations WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!convRes.length || !convRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Conversa não encontrada nesta organização." })
    return
  }

  const columns = convRes[0].columns
  const row = convRes[0].values[0]
  const c: any = {}
  columns.forEach((col, idx) => {
    c[col] = row[idx]
  })

  const msgRes = db.exec(
    `SELECT id, direction, text, time, status, replyTo_json, forwarded FROM messages WHERE conversation_id = ? ORDER BY id ASC`,
    [c.id]
  )

  const messages = msgRes.length && msgRes[0].values.length
    ? msgRes[0].values.map((mRow) => ({
        id: mRow[0] as string,
        direction: mRow[1] as string,
        text: mRow[2] as string,
        time: mRow[3] as string,
        status: mRow[4] as string || undefined,
        replyTo: mRow[5] ? JSON.parse(mRow[5] as string) : undefined,
        forwarded: Boolean(mRow[6]),
      }))
    : []

  res.json({
    ok: true,
    conversation: {
      id: c.id,
      name: c.name,
      initials: c.initials,
      channel: c.channel,
      topic: c.topic,
      role: c.role,
      department: c.department,
      lastMessage: c.lastMessage,
      time: c.time,
      unread: Number(c.unread),
      online: Boolean(c.online),
      status: c.status,
      priority: c.priority,
      pinned: Boolean(c.pinned),
      snoozedUntil: c.snoozedUntil || null,
      assignedTo: c.assignedTo,
      contact: {
        email: c.contact_email || "",
        phone: c.contact_phone || "",
        location: c.contact_location || "",
        tenure: c.contact_tenure || "",
        manager: c.contact_manager || "",
      },
      messages,
    },
  })
})

// POST /api/conversations
router.post("/", (req: Request, res: Response) => {
  const { name, channel, topic, role, department, initialMessage, assignedTo, contact } = req.body
  const tenantId = req.tenantId || "tenant_default"

  if (!name || !channel || !topic) {
    res.status(400).json({ ok: false, error: "Nome, canal e tópico são obrigatórios." })
    return
  }

  const id = `conv_${Date.now()}`
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const lastMsg = initialMessage || "Conversa iniciada."

  const db = getDB()
  db.run(
    `INSERT INTO conversations (id, name, initials, channel, topic, role, department, lastMessage, time, unread, online, status, priority, pinned, snoozedUntil, assignedTo, contact_email, contact_phone, contact_location, contact_tenure, contact_manager, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      initials,
      channel,
      topic,
      role || "Colaborador",
      department || "Geral",
      lastMsg,
      time,
      0,
      1,
      "aberto",
      "media",
      0,
      null,
      assignedTo || "Você",
      contact?.email || "",
      contact?.phone || "",
      contact?.location || "",
      contact?.tenure || "",
      contact?.manager || "",
      tenantId,
    ]
  )

  if (initialMessage) {
    db.run(
      `INSERT INTO messages (id, conversation_id, direction, text, time, status, replyTo_json, forwarded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`m_${Date.now()}`, id, "in", initialMessage, time, "lido", null, 0]
    )
  }

  persist()

  res.status(201).json({ ok: true, id, message: "Conversa iniciada com sucesso." })
})

// POST /api/conversations/:id/messages
router.post("/:id/messages", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { text, direction, replyTo } = req.body

  if (!text) {
    res.status(400).json({ ok: false, error: "O texto da mensagem é obrigatório." })
    return
  }

  const db = getDB()
  const tenantId = req.tenantId || "tenant_default"
  const convCheck = db.exec(`SELECT id FROM conversations WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!convCheck.length || !convCheck[0].values.length) {
    res.status(404).json({ ok: false, error: "Conversa não encontrada nesta organização." })
    return
  }

  const msgId = `m_${Date.now()}`
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const dir = direction || "out"

  db.run(
    `INSERT INTO messages (id, conversation_id, direction, text, time, status, replyTo_json, forwarded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [msgId, id, dir, text, time, "enviado", replyTo ? JSON.stringify(replyTo) : null, 0]
  )

  db.run(
    `UPDATE conversations SET lastMessage = ?, time = ? WHERE id = ? AND tenant_id = ?`,
    [text, time, id, tenantId]
  )

  persist()

  res.status(201).json({
    ok: true,
    message: {
      id: msgId,
      direction: dir,
      text,
      time,
      status: "enviado",
      replyTo,
    },
  })
})

// PATCH /api/conversations/:id
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const { status, priority, assignedTo, pinned, snoozedUntil } = req.body

  const db = getDB()
  const fields: string[] = []
  const params: any[] = []

  if (status !== undefined) {
    fields.push("status = ?")
    params.push(status)
  }
  if (priority !== undefined) {
    fields.push("priority = ?")
    params.push(priority)
  }
  if (assignedTo !== undefined) {
    fields.push("assignedTo = ?")
    params.push(assignedTo)
  }
  if (pinned !== undefined) {
    fields.push("pinned = ?")
    params.push(pinned ? 1 : 0)
  }
  if (snoozedUntil !== undefined) {
    fields.push("snoozedUntil = ?")
    params.push(snoozedUntil)
  }

  if (fields.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum campo informado para atualização." })
    return
  }

  params.push(id)
  params.push(tenantId)
  db.run(`UPDATE conversations SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, params)
  persist()

  res.json({ ok: true, message: "Conversa atualizada com sucesso." })
})

// DELETE /api/conversations/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const convCheck = db.exec(`SELECT id FROM conversations WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!convCheck.length || !convCheck[0].values.length) {
    res.status(404).json({ ok: false, error: "Conversa não encontrada nesta organização." })
    return
  }

  db.run(`DELETE FROM messages WHERE conversation_id = ?`, [id])
  db.run(`DELETE FROM conversations WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  res.json({ ok: true, message: "Conversa e mensagens excluídas com sucesso." })
})

export default router
