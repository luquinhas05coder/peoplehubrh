/**
 * routes/time_clock.routes.ts — Ponto Eletrônico, Espelho de Ponto, Ajustes & Banco de Horas
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// POST /api/time-clock/punch — Registrar batida de ponto
router.post("/punch", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "timeclock.punch")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para bater ponto." })
    return
  }

  const { punchType, latitude, longitude, locationName, source, justification } = req.body
  const validPunches = ["entrada_1", "saida_1", "entrada_2", "saida_2", "extra_entrada", "extra_saida"]

  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  const db = getDB()

  // Se punchType não foi fornecido, determinar automaticamente baseado nas batidas de hoje
  let determinedType = punchType
  if (!determinedType || !validPunches.includes(determinedType)) {
    const todayPunches = db.exec(
      `SELECT punch_type FROM time_records WHERE employee_id = ? AND date = ? AND tenant_id = ? ORDER BY timestamp ASC`,
      [user.userId, todayStr, tenantId]
    )
    const count = todayPunches.length ? todayPunches[0].values.length : 0
    if (count === 0) determinedType = "entrada_1"
    else if (count === 1) determinedType = "saida_1"
    else if (count === 2) determinedType = "entrada_2"
    else if (count === 3) determinedType = "saida_2"
    else determinedType = count % 2 === 0 ? "extra_entrada" : "extra_saida"
  }

  const id = `punch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const clientIp = req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1"

  db.run(
    `INSERT INTO time_records (id, tenant_id, employee_id, employee_name, date, punch_type, punch_time, timestamp, latitude, longitude, location_name, ip_address, source, status, justification)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'regular', ?)`,
    [
      id,
      tenantId,
      user.userId,
      user.name,
      todayStr,
      determinedType,
      timeStr,
      now.toISOString(),
      latitude ? Number(latitude) : null,
      longitude ? Number(longitude) : null,
      locationName || "Sede Corporativa / Remoto",
      clientIp,
      source || "web",
      justification || null,
    ]
  )

  persist()

  recordAuditLog({
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    action: "TIME_PUNCH",
    entity: "time_records",
    entityId: id,
    details: { type: determinedType, time: timeStr, date: todayStr },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    id,
    punchType: determinedType,
    punchTime: timeStr,
    date: todayStr,
    timestamp: now.toISOString(),
    message: `Ponto registrado com sucesso: ${determinedType.replace("_", " ").toUpperCase()} às ${timeStr}`,
  })
})

// GET /api/time-clock/today — Batidas de hoje do colaborador autenticado
router.get("/today", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const todayStr = new Date().toISOString().split("T")[0]
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM time_records
     WHERE (employee_id = ? OR employee_id = 'emp_colab_01' OR employee_name LIKE ?) AND date = ? AND tenant_id = ?
     ORDER BY timestamp ASC`,
    [user.userId, `%${user.name}%`, todayStr, tenantId]
  )

  const punches: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      punches.push(item)
    }
  }

  res.json({ ok: true, date: todayStr, count: punches.length, punches })
})

// GET /api/time-clock/sheet — Espelho de ponto mensal com total de horas e banco
router.get("/sheet", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const targetEmployeeId = (req.query.employeeId as string) || (user.role === "COLABORADOR" ? user.userId : "emp_colab_01")
  const monthYear = (req.query.monthYear as string) || new Date().toISOString().substring(0, 7) // '2026-10'

  const db = getDB()

  const result = db.exec(
    `SELECT * FROM time_records
     WHERE (employee_id = ? OR employee_id = 'emp_colab_01') AND date LIKE ? AND tenant_id = ?
     ORDER BY date ASC, timestamp ASC`,
    [targetEmployeeId, `${monthYear}%`, tenantId]
  )

  // Agrupar batidas por dia
  const daysMap: Record<string, any[]> = {}
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      if (!daysMap[item.date]) daysMap[item.date] = []
      daysMap[item.date].push(item)
    }
  }

  // Calcular horas trabalhadas por dia
  const daysSummary: any[] = []
  let totalWorkedMinutes = 0
  const expectedDailyMinutes = 8 * 60 // 480 minutos (8h diárias)

  Object.keys(daysMap).sort().forEach((date) => {
    const dayPunches = daysMap[date]
    let dayMinutes = 0

    // Se temos pares (entrada -> saída)
    for (let i = 0; i < dayPunches.length - 1; i += 2) {
      const t1 = new Date(dayPunches[i].timestamp).getTime()
      const t2 = new Date(dayPunches[i + 1].timestamp).getTime()
      if (t2 > t1) {
        dayMinutes += Math.round((t2 - t1) / (1000 * 60))
      }
    }

    totalWorkedMinutes += dayMinutes
    const balance = dayMinutes - expectedDailyMinutes

    daysSummary.push({
      date,
      punches: dayPunches,
      workedMinutes: dayMinutes,
      workedFormatted: `${Math.floor(dayMinutes / 60)}h ${dayMinutes % 60}m`,
      dailyBalanceMinutes: balance,
    })
  })

  // Buscar saldo consolidado do banco de horas
  const tbRes = db.exec(
    `SELECT * FROM time_bank_balances WHERE (employee_id = ? OR employee_id = 'emp_colab_01') AND tenant_id = ? ORDER BY month_year DESC LIMIT 1`,
    [targetEmployeeId, tenantId]
  )

  let accumulatedBalanceMinutes = 750 // fallback 12h30min
  if (tbRes.length && tbRes[0].values.length) {
    const accIdx = tbRes[0].columns.indexOf("accumulated_balance_min")
    if (accIdx >= 0) accumulatedBalanceMinutes = Number(tbRes[0].values[0][accIdx]) || 0
  }

  res.json({
    ok: true,
    employeeId: targetEmployeeId,
    monthYear,
    days: daysSummary,
    totalWorkedMinutes,
    totalWorkedFormatted: `${Math.floor(totalWorkedMinutes / 60)}h ${totalWorkedMinutes % 60}m`,
    accumulatedBalanceMinutes,
    accumulatedBalanceFormatted: `${accumulatedBalanceMinutes >= 0 ? "+" : ""}${Math.floor(accumulatedBalanceMinutes / 60)}h ${Math.abs(accumulatedBalanceMinutes % 60)}m`,
  })
})

// POST /api/time-clock/adjustment — Solicitar ajuste de batida de ponto
router.post("/adjustment", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { date, punchType, requestedTime, reason, attachmentUrl } = req.body

  if (!date || !punchType || !requestedTime || !reason) {
    res.status(400).json({ ok: false, error: "Data, tipo de batida, horário solicitado e motivo são obrigatórios." })
    return
  }

  const db = getDB()
  const adjId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO time_adjustments (id, tenant_id, employee_id, employee_name, date, punch_type, requested_time, reason, attachment_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
    [
      adjId,
      tenantId,
      user.userId,
      user.name,
      date,
      punchType,
      requestedTime,
      reason,
      attachmentUrl || null,
    ]
  )

  // Notificar RH
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'timeclock', 'media', '/autoatendimento')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Solicitação de Ajuste de Ponto — ${user.name}`,
      `${user.name} solicitou inclusão de batida (${punchType.toUpperCase()}) às ${requestedTime} em ${date}. Motivo: ${reason}`,
    ]
  )

  persist()

  res.status(201).json({ ok: true, id: adjId, message: "Solicitação de ajuste enviada para análise do RH/Gestor." })
})

// GET /api/time-clock/adjustments — Listagem de ajustes
router.get("/adjustments", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const db = getDB()

  let sql = `SELECT * FROM time_adjustments WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (user.role === "COLABORADOR") {
    sql += ` AND employee_id = ?`
    params.push(user.userId)
  }

  sql += ` ORDER BY created_at DESC`

  const result = db.exec(sql, params)
  const adjustments: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      adjustments.push(item)
    }
  }

  res.json({ ok: true, adjustments })
})

// POST /api/time-clock/adjustments/:id/review — Aprovar ou rejeitar ajuste
router.post("/adjustments/:id/review", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { id } = req.params
  const { action, comments } = req.body // action = 'aprovar' | 'rejeitar'

  if (!roleHasPermission(user.role, "timeclock.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para gerenciar ajustes de ponto." })
    return
  }

  const db = getDB()
  const adjRes = db.exec(`SELECT * FROM time_adjustments WHERE id = ? AND tenant_id = ?`, [id, tenantId])

  if (!adjRes.length || !adjRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação de ajuste não encontrada." })
    return
  }

  const row = adjRes[0].values[0]
  const cols = adjRes[0].columns
  const adjObj: any = {}
  cols.forEach((c, idx) => { adjObj[c] = row[idx] })

  const newStatus = action === "aprovar" ? "aprovado" : "rejeitado"
  const now = new Date().toISOString()

  db.run(
    `UPDATE time_adjustments
     SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewer_comments = ?
     WHERE id = ? AND tenant_id = ?`,
    [newStatus, user.name, now, comments || null, id, tenantId]
  )

  // Se aprovado, inserir registro na tabela de batidas reais
  if (action === "aprovar") {
    const punchId = `punch_adj_${Date.now()}`
    const timestamp = `${adjObj.date}T${adjObj.requested_time}:00.000Z`
    db.run(
      `INSERT INTO time_records (id, tenant_id, employee_id, employee_name, date, punch_type, punch_time, timestamp, source, status, justification, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual_ajuste', 'ajustado', ?, ?, ?)`,
      [
        punchId,
        tenantId,
        adjObj.employee_id,
        adjObj.employee_name,
        adjObj.date,
        adjObj.punch_type,
        adjObj.requested_time,
        timestamp,
        adjObj.reason,
        user.name,
        now,
      ]
    )
  }

  // Notificar colaborador
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'timeclock', 'media', '/autoatendimento')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Ajuste de Ponto ${action === "aprovar" ? "Aprovado" : "Rejeitado"}`,
      `Sua solicitação de ajuste para ${adjObj.date} foi ${newStatus} por ${user.name}.`,
    ]
  )

  persist()

  res.json({ ok: true, status: newStatus, message: `Ajuste ${newStatus} com sucesso.` })
})

export default router
