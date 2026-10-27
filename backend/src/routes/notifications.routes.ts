/**
 * routes/notifications.routes.ts — Central de Notificações Corporativas
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC } from "../middleware/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/notifications — Listar notificações do usuário e contagem não lida
router.get("/", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const userEmail = (req.access?.email || "").toLowerCase()
  const userId = req.access?.userId || null
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM notifications
     WHERE tenant_id = ? AND (user_id = ? OR lower(user_email) = ? OR user_id IS NULL)
     ORDER BY created_at DESC LIMIT 50`,
    [tenantId, userId, userEmail]
  )

  const notifications: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      item.read = Boolean(item.read)
      notifications.push(item)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  res.json({ ok: true, notifications, unreadCount })
})

// PATCH /api/notifications/:id/read — Marcar notificação como lida
router.patch("/:id/read", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`UPDATE notifications SET read = 1 WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  const io = req.app.get("io")
  if (io) {
    io.to(`tenant_${tenantId}`).emit("notification:read", { id, tenantId })
  }

  res.json({ ok: true, message: "Notificação marcada como lida." })
})

// PATCH /api/notifications/read-all — Marcar todas como lidas
router.patch("/read-all", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const userEmail = (req.access?.email || "").toLowerCase()
  const userId = req.access?.userId || null
  const db = getDB()

  db.run(
    `UPDATE notifications SET read = 1
     WHERE tenant_id = ? AND (user_id = ? OR lower(user_email) = ? OR user_id IS NULL)`,
    [tenantId, userId, userEmail]
  )
  persist()

  const io = req.app.get("io")
  if (io) {
    io.to(`tenant_${tenantId}`).emit("notification:read-all", { tenantId })
  }

  res.json({ ok: true, message: "Todas as notificações foram marcadas como lidas." })
})

export default router
