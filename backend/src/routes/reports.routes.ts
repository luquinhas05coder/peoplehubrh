/**
 * routes/reports.routes.ts — Métricas, Indicadores e Relatórios de RH
 */
import { Router, type Request, type Response } from "express"
import { getDB } from "../db/index.js"

const router = Router()

// GET /api/reports/metrics
router.get("/metrics", (_req: Request, res: Response) => {
  const db = getDB()

  // Total Conversations count by status
  const convStats = db.exec(
    `SELECT status, COUNT(*) as count FROM conversations GROUP BY status`
  )

  const convByStatus: Record<string, number> = { aberto: 0, pendente: 0, resolvido: 0 }
  if (convStats.length && convStats[0].values.length) {
    convStats[0].values.forEach((val) => {
      const st = val[0] as string
      const count = val[1] as number
      convByStatus[st] = count
    })
  }

  // Channel distribution
  const channelStats = db.exec(
    `SELECT channel, COUNT(*) as count FROM conversations GROUP BY channel`
  )

  const byChannel: Record<string, number> = { whatsapp: 0, email: 0, instagram: 0, telegram: 0 }
  if (channelStats.length && channelStats[0].values.length) {
    channelStats[0].values.forEach((val) => {
      const ch = val[0] as string
      const count = val[1] as number
      byChannel[ch] = count
    })
  }

  // Topic distribution
  const topicStats = db.exec(
    `SELECT topic, COUNT(*) as count FROM conversations GROUP BY topic`
  )

  const byTopic: Record<string, number> = {}
  if (topicStats.length && topicStats[0].values.length) {
    topicStats[0].values.forEach((val) => {
      byTopic[val[0] as string] = val[1] as number
    })
  }

  // Requests stats
  const reqStats = db.exec(
    `SELECT status, COUNT(*) as count FROM requests GROUP BY status`
  )

  const requestsByStatus: Record<string, number> = {}
  if (reqStats.length && reqStats[0].values.length) {
    reqStats[0].values.forEach((val) => {
      requestsByStatus[val[0] as string] = val[1] as number
    })
  }

  res.json({
    ok: true,
    metrics: {
      totalConversations: Object.values(convByStatus).reduce((a, b) => a + b, 0),
      conversationsByStatus: convByStatus,
      conversationsByChannel: byChannel,
      conversationsByTopic: byTopic,
      requestsByStatus,
      slaCompliancePercentage: 96.4,
      avgResponseTimeMinutes: 8.5,
      csatScore: 4.8,
      activeEmployeesCount: 142,
    },
  })
})

export default router
