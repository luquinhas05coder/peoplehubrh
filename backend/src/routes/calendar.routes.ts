/**
 * routes/calendar.routes.ts — Calendário Corporativo Integrado
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/calendar/events — Listagem consolidada de eventos corporativos
router.get("/events", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { month, year, department, category } = req.query
  const db = getDB()

  let sql = `SELECT * FROM calendar_events WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (category && category !== "todos") {
    sql += ` AND category = ?`
    params.push(String(category))
  }

  if (department && department !== "todos") {
    sql += ` AND (department = ? OR department = 'Geral' OR department IS NULL)`
    params.push(String(department))
  }

  sql += ` ORDER BY start_date ASC`

  const result = db.exec(sql, params)
  const events: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      item.is_all_day = Boolean(item.is_all_day)
      events.push(item)
    }
  }

  // Integração Dinâmica 1: Férias Aprovadas na tabela requests
  try {
    const vacRes = db.exec(
      `SELECT id, requester, department, date, description FROM requests
       WHERE tenant_id = ? AND type = 'Férias' AND status = 'Aprovado'`,
      [tenantId]
    )
    if (vacRes.length && vacRes[0].values.length) {
      for (const vRow of vacRes[0].values) {
        const [vId, requester, dept, vDate, desc] = vRow as [string, string, string, string, string]
        events.push({
          id: `req_vac_${vId}`,
          tenant_id: tenantId,
          title: `Férias Aprovadas: ${requester}`,
          description: desc || "Período de férias regulamentares aprovado pelo RH",
          category: "ferias",
          start_date: vDate,
          end_date: vDate,
          department: dept,
          employee_name: requester,
          is_all_day: true,
          location: "Recesso / Férias",
          source: "requests",
        })
      }
    }
  } catch (_e) {}

  // Integração Dinâmica 2: Prazos de Workflows ativos
  try {
    const wfRes = db.exec(
      `SELECT id, title, category, due_date, employee_name FROM workflows
       WHERE tenant_id = ? AND status = 'em_andamento' AND due_date IS NOT NULL`,
      [tenantId]
    )
    if (wfRes.length && wfRes[0].values.length) {
      for (const wRow of wfRes[0].values) {
        const [wId, wTitle, wCat, wDueDate, wEmp] = wRow as [string, string, string, string, string]
        events.push({
          id: `wf_due_${wId}`,
          tenant_id: tenantId,
          title: `Prazo Workflow: ${wTitle}`,
          description: `Vencimento do processo #${wId} (${wCat}) - Colaborador: ${wEmp || "N/A"}`,
          category: "workflow_deadline",
          start_date: wDueDate,
          end_date: wDueDate,
          department: "RH",
          employee_name: wEmp,
          is_all_day: true,
          location: "Portal PeopleHub",
          source: "workflows",
        })
      }
    }
  } catch (_e) {}

  res.json({ ok: true, events })
})

// POST /api/calendar/events — Criar evento manual corporativo
router.post("/events", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "calendar.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para agendar eventos corporativos." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { title, description, category, startDate, endDate, department, location, isAllDay } = req.body

  if (!title || !startDate || !category) {
    res.status(400).json({ ok: false, error: "Título, categoria e data de início são obrigatórios." })
    return
  }

  const db = getDB()
  const eventId = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO calendar_events (id, tenant_id, title, description, category, start_date, end_date, department, location, is_all_day, created_by_id, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      tenantId,
      title,
      description || null,
      category,
      startDate,
      endDate || startDate,
      department || "Geral",
      location || null,
      isAllDay === false ? 0 : 1,
      req.access?.userId,
      req.access?.name,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "CALENDAR_EVENT_CREATE",
    entity: "calendar_events",
    entityId: eventId,
    details: { title, category, startDate, department },
    tenantId,
  })

  res.status(201).json({ ok: true, id: eventId, message: "Evento registrado no calendário com sucesso." })
})

// DELETE /api/calendar/events/:id — Excluir evento
router.delete("/events/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "calendar.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM calendar_events WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  res.json({ ok: true, message: "Evento excluído do calendário." })
})

export default router
