/**
 * routes/vacations.routes.ts — Gestão de Férias CLT (Períodos Aquisitivos, Concessivos, Saldo, Agenda & Alertas)
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

function calculateCLTPeriods(hireDateStr: string) {
  const hireDate = new Date(hireDateStr)
  const now = new Date()

  // Calcular quantos anos de empresa
  let years = now.getFullYear() - hireDate.getFullYear()
  const hireAnniversaryThisYear = new Date(hireDate)
  hireAnniversaryThisYear.setFullYear(now.getFullYear())

  if (now < hireAnniversaryThisYear) {
    years -= 1
  }
  const completedCycles = Math.max(0, years)

  const aquisitivoStart = new Date(hireDate)
  aquisitivoStart.setFullYear(hireDate.getFullYear() + completedCycles)

  const aquisitivoEnd = new Date(aquisitivoStart)
  aquisitivoEnd.setFullYear(aquisitivoStart.getFullYear() + 1)
  aquisitivoEnd.setDate(aquisitivoEnd.getDate() - 1)

  const concessivoStart = new Date(aquisitivoEnd)
  concessivoStart.setDate(concessivoStart.getDate() + 1)

  const concessivoEnd = new Date(concessivoStart)
  concessivoEnd.setFullYear(concessivoStart.getFullYear() + 1)
  concessivoEnd.setDate(concessivoEnd.getDate() - 1)

  const formatDate = (d: Date) => d.toISOString().split("T")[0]

  return {
    aquisitivoInicio: formatDate(aquisitivoStart),
    aquisitivoFim: formatDate(aquisitivoEnd),
    concessivoInicio: formatDate(concessivoStart),
    concessivoFim: formatDate(concessivoEnd),
  }
}

// GET /api/vacations/balance — Consulta saldo e períodos de férias do colaborador
router.get("/balance", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const targetEmployeeId = (req.query.employeeId as string) || (user.role === "COLABORADOR" ? user.userId : null)

  const db = getDB()

  let employeeId = targetEmployeeId
  let employeeName = user.name
  let hireDate = "2023-03-15"

  // Se não foi passado targetEmployeeId e o usuário não é colaborador, buscar pelo colaborador vinculado ao e-mail
  const empRes = db.exec(
    employeeId
      ? `SELECT id, name, hireDate, status FROM employees WHERE (id = ? OR email = ?) AND tenant_id = ?`
      : `SELECT id, name, hireDate, status FROM employees WHERE email = ? AND tenant_id = ?`,
    employeeId ? [employeeId, user.email, tenantId] : [user.email, tenantId]
  )

  if (empRes.length && empRes[0].values.length) {
    const [eId, eName, eHire] = empRes[0].values[0] as [string, string, string]
    employeeId = eId
    employeeName = eName
    if (eHire) hireDate = eHire
  } else if (!employeeId) {
    employeeId = "emp_colab_01"
  }

  // Buscar período aquisitivo cadastrado ou gerar período CLT dinâmico
  const perRes = db.exec(
    `SELECT * FROM vacation_periods WHERE employee_id = ? AND tenant_id = ? ORDER BY aquisitivo_fim DESC LIMIT 1`,
    [employeeId, tenantId]
  )

  let period: any = null
  if (perRes.length && perRes[0].values.length) {
    const cols = perRes[0].columns
    const row = perRes[0].values[0]
    period = {}
    cols.forEach((c, i) => { period[c] = row[i] })
  } else {
    // Gerar período aquisitivo legal calculado pela CLT
    const clt = calculateCLTPeriods(hireDate)
    const newPerId = `vac_per_${employeeId}_${Date.now()}`
    db.run(
      `INSERT INTO vacation_periods (id, tenant_id, employee_id, employee_name, aquisitivo_inicio, aquisitivo_fim, concessivo_inicio, concessivo_fim, dias_direito, dias_gozados, dias_saldo, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 30, 0, 30, 'adquirido')`,
      [newPerId, tenantId, employeeId, employeeName, clt.aquisitivoInicio, clt.aquisitivoFim, clt.concessivoInicio, clt.concessivoFim]
    )
    persist()
    period = {
      id: newPerId,
      tenant_id: tenantId,
      employee_id: employeeId,
      employee_name: employeeName,
      aquisitivo_inicio: clt.aquisitivoInicio,
      aquisitivo_fim: clt.aquisitivoFim,
      concessivo_inicio: clt.concessivoInicio,
      concessivo_fim: clt.concessivoFim,
      dias_direito: 30,
      dias_gozados: 0,
      dias_saldo: 30,
      status: "adquirido",
    }
  }

  // Buscar solicitações de férias vinculadas
  const reqRes = db.exec(
    `SELECT * FROM vacation_requests WHERE employee_id = ? AND tenant_id = ? ORDER BY data_inicio DESC`,
    [employeeId, tenantId]
  )

  const requests: any[] = []
  if (reqRes.length && reqRes[0].values.length) {
    const cols = reqRes[0].columns
    for (const row of reqRes[0].values) {
      const item: any = {}
      cols.forEach((c, i) => { item[c] = row[i] })
      requests.push(item)
    }
  }

  // Verificar se período concessivo está vencendo (< 60 dias)
  const today = new Date()
  const concessivoFimDate = new Date(period.concessivo_fim)
  const diffDays = Math.ceil((concessivoFimDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const isExpiringSoon = diffDays > 0 && diffDays <= 60
  const isExpired = diffDays <= 0

  res.json({
    ok: true,
    period,
    requests,
    summary: {
      diasDireito: period.dias_direito,
      diasGozados: period.dias_gozados,
      diasSaldo: period.dias_saldo,
      diasAbonoDisponivel: Math.min(10, Math.floor(period.dias_saldo / 3)),
      diasVencimento: diffDays,
      isExpiringSoon,
      isExpired,
      alertaCLT: isExpired
        ? "ATENÇÃO: Período concessivo vencido! Risco de pagamento em dobro (Art. 137 CLT)."
        : isExpiringSoon
        ? `ALERTA: Férias vencendo em ${diffDays} dias. Concessão prioritária recomendada.`
        : "Período aquisitivo regular.",
    },
  })
})

// GET /api/vacations/requests — Listagem geral de solicitações de férias para RH / Gestor
router.get("/requests", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { status, employeeId } = req.query
  const db = getDB()

  let sql = `SELECT * FROM vacation_requests WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (user.role === "COLABORADOR") {
    sql += ` AND (employee_id = ? OR employee_name LIKE ?)`
    params.push(user.userId, `%${user.name}%`)
  } else if (employeeId) {
    sql += ` AND employee_id = ?`
    params.push(String(employeeId))
  }

  if (status && status !== "todos") {
    sql += ` AND status = ?`
    params.push(String(status))
  }

  sql += ` ORDER BY solicitada_em DESC`

  const result = db.exec(sql, params)
  const requests: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      requests.push(item)
    }
  }

  res.json({ ok: true, requests })
})

// POST /api/vacations/requests — Nova solicitação de férias com regras CLT
router.post("/requests", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!
  const { employeeId, employeeName, periodId, dataInicio, dataFim, dias, abonoPecuniario, adiantamento13, observacoes } = req.body

  let empId = employeeId || user.userId
  let empName = employeeName || user.name

  // Validação das regras da Reforma Trabalhista (Art. 134 da CLT)
  const diasNum = Number(dias)
  if (!dataInicio || !dataFim || isNaN(diasNum) || diasNum <= 0) {
    res.status(400).json({ ok: false, error: "Datas de início, término e total de dias válidos são obrigatórios." })
    return
  }

  if (diasNum < 5) {
    res.status(400).json({ ok: false, error: "A CLT proíbe fracionamento de férias em períodos inferiores a 5 dias." })
    return
  }

  const db = getDB()

  // Buscar colaborador correspondente pelo e-mail se não especificado
  let hireDate = "2023-03-15"
  const empLookup = db.exec(
    `SELECT id, name, hireDate FROM employees WHERE (id = ? OR email = ?) AND tenant_id = ?`,
    [empId, user.email, tenantId]
  )
  if (empLookup.length && empLookup[0].values.length) {
    const [foundId, foundName, foundHire] = empLookup[0].values[0] as [string, string, string]
    empId = foundId
    empName = foundName
    if (foundHire) hireDate = foundHire
  }

  // Buscar período aquisitivo do colaborador com saldo suficiente
  let targetPeriodId = periodId
  let periodRes: any = null

  if (targetPeriodId) {
    periodRes = db.exec(`SELECT * FROM vacation_periods WHERE id = ? AND tenant_id = ?`, [targetPeriodId, tenantId])
  } else {
    periodRes = db.exec(
      `SELECT * FROM vacation_periods 
       WHERE (employee_id = ? OR employee_id = 'emp_colab_01' OR employee_name LIKE ?) 
         AND tenant_id = ? AND dias_saldo >= ?
       ORDER BY aquisitivo_fim ASC LIMIT 1`,
      [empId, `%${empName}%`, tenantId, diasNum]
    )

    // Se não encontrou período com saldo suficiente, buscar qualquer período recente
    if (!periodRes.length || !periodRes[0].values.length) {
      periodRes = db.exec(
        `SELECT * FROM vacation_periods 
         WHERE (employee_id = ? OR employee_id = 'emp_colab_01' OR employee_name LIKE ?) 
           AND tenant_id = ?
         ORDER BY aquisitivo_fim DESC LIMIT 1`,
        [empId, `%${empName}%`, tenantId]
      )
    }
  }

  let periodObj: any = {}
  if (!periodRes.length || !periodRes[0].values.length) {
    // Gerar período CLT dinâmico se ainda não gerado
    const clt = calculateCLTPeriods(hireDate)
    const newPerId = `vac_per_${empId}_${Date.now()}`
    db.run(
      `INSERT INTO vacation_periods (id, tenant_id, employee_id, employee_name, aquisitivo_inicio, aquisitivo_fim, concessivo_inicio, concessivo_fim, dias_direito, dias_gozados, dias_saldo, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 30, 0, 30, 'adquirido')`,
      [newPerId, tenantId, empId, empName, clt.aquisitivoInicio, clt.aquisitivoFim, clt.concessivoInicio, clt.concessivoFim]
    )
    persist()
    periodObj = {
      id: newPerId,
      dias_saldo: 30,
    }
    targetPeriodId = newPerId
  } else {
    const perRow = periodRes[0].values[0]
    const perCols = periodRes[0].columns
    perCols.forEach((c: string, idx: number) => { periodObj[c] = perRow[idx] })
    targetPeriodId = periodObj.id

    // Se o período mais recente já estiver sem saldo suficiente, abrir período subsequente CLT
    if (diasNum > periodObj.dias_saldo) {
      const prevAquisitivoFim = new Date(periodObj.aquisitivo_fim)
      const nextAquisitivoInicio = new Date(prevAquisitivoFim)
      nextAquisitivoInicio.setDate(nextAquisitivoInicio.getDate() + 1)
      const nextAquisitivoFim = new Date(nextAquisitivoInicio)
      nextAquisitivoFim.setFullYear(nextAquisitivoFim.getFullYear() + 1)
      nextAquisitivoFim.setDate(nextAquisitivoFim.getDate() - 1)

      const nextConcessivoInicio = new Date(nextAquisitivoFim)
      nextConcessivoInicio.setDate(nextConcessivoInicio.getDate() + 1)
      const nextConcessivoFim = new Date(nextConcessivoInicio)
      nextConcessivoFim.setFullYear(nextConcessivoFim.getFullYear() + 1)
      nextConcessivoFim.setDate(nextConcessivoFim.getDate() - 1)

      const newPerId = `vac_per_${empId}_${Date.now()}`
      const startStr = nextAquisitivoInicio.toISOString().split("T")[0]
      const endStr = nextAquisitivoFim.toISOString().split("T")[0]
      const concStartStr = nextConcessivoInicio.toISOString().split("T")[0]
      const concEndStr = nextConcessivoFim.toISOString().split("T")[0]

      db.run(
        `INSERT INTO vacation_periods (id, tenant_id, employee_id, employee_name, aquisitivo_inicio, aquisitivo_fim, concessivo_inicio, concessivo_fim, dias_direito, dias_gozados, dias_saldo, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 30, 0, 30, 'adquirido')`,
        [newPerId, tenantId, empId, empName, startStr, endStr, concStartStr, concEndStr]
      )
      persist()
      periodObj = {
        id: newPerId,
        dias_saldo: 30,
      }
      targetPeriodId = newPerId
    }
  }

  const reqId = `vac_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO vacation_requests (id, tenant_id, period_id, employee_id, employee_name, data_inicio, data_fim, dias, abono_pecuniario, adiantamento_13, status, observacoes, solicitada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`,
    [
      reqId,
      tenantId,
      targetPeriodId,
      empId,
      empName,
      dataInicio,
      dataFim,
      diasNum,
      abonoPecuniario ? 1 : 0,
      adiantamento13 ? 1 : 0,
      observacoes || null,
      now,
    ]
  )

  // Gerar notificação para o RH
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'ferias', 'media', '/autoatendimento')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Nova Solicitação de Férias: ${empName}`,
      `${empName} solicitou ${diasNum} dias de férias de ${dataInicio} a ${dataFim}.`,
    ]
  )

  persist()

  recordAuditLog({
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    action: "VACATION_REQUEST_CREATE",
    entity: "vacation_requests",
    entityId: reqId,
    details: { employeeId: empId, dias: diasNum, dataInicio, dataFim, abonoPecuniario },
    tenantId,
  })

  res.status(201).json({ ok: true, id: reqId, message: "Solicitação de férias submetida com sucesso ao RH." })
})

// POST /api/vacations/requests/:id/approve — Aprovação de férias pelo RH ou Gestor
router.post("/requests/:id/approve", (req: Request, res: Response) => {
  const user = req.access!
  if (!roleHasPermission(user.role, "vacations.approve")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para aprovar férias." })
    return
  }

  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const reqCheck = db.exec(`SELECT * FROM vacation_requests WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!reqCheck.length || !reqCheck[0].values.length) {
    res.status(404).json({ ok: false, error: "Solicitação de férias não encontrada." })
    return
  }

  const row = reqCheck[0].values[0]
  const cols = reqCheck[0].columns
  const reqObj: any = {}
  cols.forEach((c, idx) => { reqObj[c] = row[idx] })

  if (reqObj.status === "aprovada") {
    res.status(400).json({ ok: false, error: "Esta solicitação já foi aprovada anteriormente." })
    return
  }

  const now = new Date().toISOString()

  // 1. Atualizar a solicitação
  db.run(
    `UPDATE vacation_requests
     SET status = 'aprovada', aprovada_por = ?, aprovada_em = ?
     WHERE id = ? AND tenant_id = ?`,
    [user.name, now, id, tenantId]
  )

  // 2. Deduzir o saldo no período aquisitivo
  db.run(
    `UPDATE vacation_periods
     SET dias_gozados = dias_gozados + ?,
         dias_saldo = MAX(0, dias_saldo - ?),
         status = CASE WHEN (dias_saldo - ?) <= 0 THEN 'gozado' ELSE 'em_gozo' END
     WHERE id = ? AND tenant_id = ?`,
    [reqObj.dias, reqObj.dias, reqObj.dias, reqObj.period_id, tenantId]
  )

  // 3. Registrar no Calendário Corporativo
  db.run(
    `INSERT INTO calendar_events (id, tenant_id, title, description, category, start_date, end_date, employee_id, employee_name, is_all_day)
     VALUES (?, ?, ?, ?, 'ferias', ?, ?, ?, ?, 1)`,
    [
      `cal_vac_${id}`,
      tenantId,
      `Férias — ${reqObj.employee_name}`,
      `Período aprovado de ${reqObj.dias} dias de férias`,
      reqObj.data_inicio,
      reqObj.data_fim,
      reqObj.employee_id,
      reqObj.employee_name,
    ]
  )

  // 4. Notificar colaborador
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'ferias', 'alta', '/autoatendimento')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Férias Aprovadas!`,
      `Sua solicitação de ${reqObj.dias} dias de férias de ${reqObj.data_inicio} a ${reqObj.data_fim} foi aprovada por ${user.name}.`,
    ]
  )

  persist()

  recordAuditLog({
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    action: "VACATION_REQUEST_APPROVE",
    entity: "vacation_requests",
    entityId: id,
    details: { employee: reqObj.employee_name, dias: reqObj.dias, periodId: reqObj.period_id },
    tenantId,
  })

  res.json({ ok: true, message: "Férias aprovadas e sincronizadas no calendário com sucesso." })
})

// POST /api/vacations/requests/:id/reject — Rejeição de solicitação de férias
router.post("/requests/:id/reject", (req: Request, res: Response) => {
  const user = req.access!
  if (!roleHasPermission(user.role, "vacations.reject")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para rejeitar férias." })
    return
  }

  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { motivo } = req.body

  if (!motivo || !motivo.trim()) {
    res.status(400).json({ ok: false, error: "Justificativa obrigatória para rejeição da solicitação." })
    return
  }

  const db = getDB()
  db.run(
    `UPDATE vacation_requests
     SET status = 'rejeitada', motivo_rejeicao = ?, aprovada_por = ?, aprovada_em = datetime('now')
     WHERE id = ? AND tenant_id = ?`,
    [motivo.trim(), user.name, id, tenantId]
  )

  persist()

  res.json({ ok: true, message: "Solicitação de férias rejeitada com justificativa registrada." })
})

// GET /api/vacations/alerts — Alertas de férias a vencer (CLT dobro de férias)
router.get("/alerts", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT vp.*, e.department, e.role, e.email
     FROM vacation_periods vp
     LEFT JOIN employees e ON e.id = vp.employee_id
     WHERE vp.tenant_id = ? AND vp.dias_saldo > 0
     ORDER BY vp.concessivo_fim ASC`,
    [tenantId]
  )

  const alerts: any[] = []
  const today = new Date()

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })

      const concessivoFim = new Date(item.concessivo_fim)
      const diffDays = Math.ceil((concessivoFim.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays <= 90) {
        alerts.push({
          ...item,
          diasAteVencimento: diffDays,
          riscoDobro: diffDays <= 0,
          urgencia: diffDays <= 0 ? "critica" : diffDays <= 45 ? "alta" : "media",
        })
      }
    }
  }

  res.json({ ok: true, count: alerts.length, alerts })
})

export default router
