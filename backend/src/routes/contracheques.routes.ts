/**
 * routes/contracheques.routes.ts — Histórico Linear Imutável de CCs e Recálculo com Pedido de Vista
 */
import { Router, type Request, type Response } from "express"
import crypto from "crypto"
import { getDB, persist } from "../db/index.js"
import { resolveTenant, requireAuth } from "../middleware/auth.js"
import { authenticateRBAC, requirePermission, recordAuditLog } from "../middleware/rbac.js"

const router = Router()

// Middleware de resolução de tenant e autenticação RBAC
router.use(resolveTenant)
router.use(authenticateRBAC)

interface ContraChequeRow {
  id: string
  tenant_id: string
  employee_id: string
  employee_name: string
  cpf: string
  role: string
  department: string
  admission_date: string
  cbo: string
  month: string
  year_month: string
  salary_base: string
  holerite_json: string
  version: number
  status: string
  is_immutable: number
  generated_at: string
  contest_deadline_at: string
  contest_requested_at?: string
  contest_reason?: string
  contest_resolution?: string
  hash_signature?: string
}

function rowToDto(row: Record<string, any>): Record<string, any> {
  let holerite = {}
  try {
    holerite = JSON.parse(row.holerite_json || "{}")
  } catch (_e) {
    holerite = {}
  }

  const now = new Date()
  const deadline = new Date(row.contest_deadline_at)
  const isExpired = now > deadline

  // Se o prazo expirou e não está sob recurso ativo, o status efetivo é imutável
  const effectiveIsImmutable = row.is_immutable === 1 || (isExpired && row.status !== "em_recurso")
  const effectiveStatus = effectiveIsImmutable && row.status !== "em_recurso" ? "imutavel" : row.status

  const msRemaining = deadline.getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))

  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    cpf: row.cpf,
    role: row.role,
    department: row.department,
    admissionDate: row.admission_date,
    cbo: row.cbo,
    month: row.month,
    yearMonth: row.year_month,
    salaryBase: row.salary_base,
    holerite,
    version: row.version,
    status: effectiveStatus,
    isImmutable: effectiveIsImmutable,
    generatedAt: row.generated_at,
    contestDeadlineAt: row.contest_deadline_at,
    contestRequestedAt: row.contest_requested_at,
    contestReason: row.contest_reason,
    contestResolution: row.contest_resolution,
    hashSignature: row.hash_signature,
    daysRemaining,
    isExpired,
  }
}

/**
 * Helper para obter prazo de contestação configurado no Tenant (em dias)
 */
function getTenantContestDeadlineDays(tenantId: string): number {
  const db = getDB()
  const res = db.exec(`SELECT contest_deadline_days FROM tenants WHERE id = ?`, [tenantId])
  if (res.length && res[0].values.length && res[0].values[0][0]) {
    return Number(res[0].values[0][0]) || 10
  }
  return 10
}

/**
 * GET /api/contracheques
 * Retorna os Contra-Cheques organizados de forma temporal linear (ORDER BY year_month ASC, version ASC)
 */
router.get("/", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { employee_id, month } = req.query as Record<string, string>
  const db = getDB()

  // Atualizar automaticamente no banco qualquer CC cujo prazo de vista expirou
  db.run(
    `UPDATE contracheques 
     SET is_immutable = 1, status = 'imutavel' 
     WHERE tenant_id = ? 
       AND datetime('now') > datetime(contest_deadline_at) 
       AND is_immutable = 0 
       AND status NOT IN ('em_recurso', 'imutavel')`,
    [tenantId]
  )

  let sql = `SELECT * FROM contracheques WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  const scope = req.access?.scope || "OWN"
  const userName = req.access?.name || ""
  const userEmail = (req.access?.email || "").toLowerCase()
  const userDept = req.access?.department || ""

  if (scope === "OWN") {
    sql += ` AND (lower(employee_name) = lower(?) OR employee_id IN (SELECT id FROM employees WHERE lower(email) = lower(?)))`
    params.push(userName, userEmail)
  } else if (scope === "TEAM") {
    sql += ` AND (department = ? OR lower(employee_name) = lower(?))`
    params.push(userDept, userName)
  }

  if (employee_id) {
    sql += ` AND employee_id = ?`
    params.push(employee_id)
  }
  if (month) {
    sql += ` AND month = ?`
    params.push(month)
  }

  // Organização estritamente temporal linear
  sql += ` ORDER BY year_month ASC, generated_at ASC, version ASC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, contracheques: [] })
    return
  }

  const cols = result[0].columns
  const contracheques = result[0].values.map((valRow) => {
    const rowObj: Record<string, any> = {}
    cols.forEach((col, idx) => {
      rowObj[col] = valRow[idx]
    })
    return rowToDto(rowObj)
  })

  res.json({ ok: true, contracheques })
})

/**
 * GET /api/contracheques/:id
 */
router.get("/:id", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const id = String(req.params.id)
  const db = getDB()

  const result = db.exec(`SELECT * FROM contracheques WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Contra-cheque não encontrado." })
    return
  }

  const cols = result[0].columns
  const rowObj: Record<string, any> = {}
  cols.forEach((col, idx) => {
    rowObj[col] = result[0].values[0][idx]
  })

  const scope = req.access?.scope || "OWN"
  const userName = (req.access?.name || "").toLowerCase()
  const userDept = (req.access?.department || "").toLowerCase()
  const empName = (rowObj.employee_name || "").toLowerCase()
  const empDept = (rowObj.department || "").toLowerCase()

  if (scope === "OWN" && empName !== userName) {
    res.status(403).json({ ok: false, error: "Acesso negado: Você só pode visualizar seus próprios contra-cheques." })
    return
  }

  if (scope === "TEAM" && empDept !== userDept && empName !== userName) {
    res.status(403).json({ ok: false, error: "Acesso negado: Contra-cheque fora do escopo da sua equipe." })
    return
  }

  res.json({ ok: true, contracheque: rowToDto(rowObj) })
})

/**
 * POST /api/contracheques
 * Emissão de um novo CC com cálculo de prazo estimado pelo tenant
 */
router.post("/", requirePermission("payroll.manage"), (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const {
    employeeId,
    employeeName,
    cpf = "",
    role = "",
    department = "",
    admissionDate = "",
    cbo = "",
    month,
    yearMonth: rawYearMonth,
    salaryBase,
    holerite,
  } = req.body

  if (!employeeId || !employeeName || !month || !holerite) {
    res.status(400).json({ ok: false, error: "Dados incompletos para emissão do contra-cheque." })
    return
  }

  const db = getDB()
  const deadlineDays = getTenantContestDeadlineDays(tenantId)

  // Formatar yearMonth para ordenação linear se não vier
  let yearMonth = rawYearMonth
  if (!yearMonth) {
    const parts = month.split("/")
    if (parts.length === 2) {
      yearMonth = `${parts[1]}-${parts[0].padStart(2, "0")}`
    } else {
      yearMonth = "2026-08"
    }
  }

  // Verificar se já existe emissão para esta competência para definir versão
  const countRes = db.exec(
    `SELECT MAX(version) FROM contracheques WHERE tenant_id = ? AND employee_id = ? AND month = ?`,
    [tenantId, employeeId, month]
  )
  const currentMaxVersion = countRes.length && countRes[0].values.length && countRes[0].values[0][0]
    ? Number(countRes[0].values[0][0])
    : 0
  const version = currentMaxVersion + 1

  const cleanMonth = month.replace("/", "_")
  const id = `cc_${employeeId}_${cleanMonth}_v${version}_${Date.now()}`
  const now = new Date()
  const generatedAt = now.toISOString()
  const deadlineDate = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000)
  const contestDeadlineAt = deadlineDate.toISOString()

  const holeriteJson = typeof holerite === "string" ? holerite : JSON.stringify(holerite)
  const hashSignature = crypto
    .createHash("sha256")
    .update(`${tenantId}:${employeeId}:${month}:v${version}:${generatedAt}:${holeriteJson}`)
    .digest("hex")

  db.run(
    `INSERT INTO contracheques (
      id, tenant_id, employee_id, employee_name, cpf, role, department, admission_date, cbo,
      month, year_month, salary_base, holerite_json, version, status, is_immutable,
      generated_at, contest_deadline_at, hash_signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto_para_vista', 0, ?, ?, ?)`,
    [
      id,
      tenantId,
      employeeId,
      employeeName,
      cpf,
      role,
      department,
      admissionDate,
      cbo,
      month,
      yearMonth,
      salaryBase || "R$ 6.500,00",
      holeriteJson,
      version,
      generatedAt,
      contestDeadlineAt,
      hashSignature,
    ]
  )

  persist()

  res.status(201).json({
    ok: true,
    message: `Contra-cheque emitido com sucesso. Prazo de vista: ${deadlineDays} dias (até ${deadlineDate.toLocaleDateString("pt-BR")}).`,
    contracheque: {
      id,
      tenantId,
      employeeId,
      employeeName,
      month,
      yearMonth,
      version,
      status: "aberto_para_vista",
      isImmutable: false,
      generatedAt,
      contestDeadlineAt,
      daysRemaining: deadlineDays,
      hashSignature,
    },
  })
})

/**
 * POST /api/contracheques/:id/pedir-vista
 * Colaborador recorre do CC por motivo de erro de cálculo (dentro do prazo legal do tenant)
 */
router.post("/:id/pedir-vista", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const id = String(req.params.id)
  const { reason, details } = req.body as { reason?: string; details?: string }
  const db = getDB()

  if (!reason || !reason.trim()) {
    res.status(400).json({ ok: false, error: "Informe o motivo do erro de cálculo para pedir vista." })
    return
  }

  const result = db.exec(`SELECT * FROM contracheques WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Contra-cheque não encontrado." })
    return
  }

  const cols = result[0].columns
  const rowObj: Record<string, any> = {}
  cols.forEach((col, idx) => {
    rowObj[col] = result[0].values[0][idx]
  })

  // Verificação estrita de imutabilidade e expiração de prazo
  const now = new Date()
  const deadline = new Date(rowObj.contest_deadline_at)

  if (rowObj.is_immutable === 1 || now > deadline) {
    // Selar definitivamente se ainda não estiver
    db.run(`UPDATE contracheques SET is_immutable = 1, status = 'imutavel' WHERE id = ?`, [id])
    persist()
    res.status(403).json({
      ok: false,
      error: `O prazo estimado para pedido de vista deste contra-cheque expirou em ${deadline.toLocaleDateString("pt-BR")}. O documento tornou-se estritamente imutável.`,
    })
    return
  }

  const fullReason = details ? `${reason.trim()} — ${details.trim()}` : reason.trim()
  const requestedAt = now.toISOString()

  // Atualizar CC para 'em_recurso'
  db.run(
    `UPDATE contracheques 
     SET status = 'em_recurso', contest_requested_at = ?, contest_reason = ?
     WHERE id = ?`,
    [requestedAt, fullReason, id]
  )

  // Registrar solicitação formal no módulo de solicitações
  const reqId = `REQ-CC-${Date.now().toString().slice(-6)}`
  const reqTitle = `Recurso de Contra-Cheque — Competência ${rowObj.month}`
  const reqDesc = `O colaborador ${rowObj.employee_name} solicitou pedido de vista do contra-cheque da competência ${rowObj.month} alegando erro de cálculo:\n\nMotivo: ${fullReason}\n\nDocumento sob contestação: ${id} (Versão ${rowObj.version})`

  db.run(
    `INSERT INTO requests (
      id, type, requester, department, date, status, priority, description, details_json, tenant_id
    ) VALUES (?, 'contracheque', ?, ?, ?, 'em_analise', 'alta', ?, ?, ?)`,
    [
      reqId,
      rowObj.employee_name,
      rowObj.department || "Operações",
      now.toLocaleDateString("pt-BR"),
      reqDesc,
      JSON.stringify({
        contrachequeId: id,
        month: rowObj.month,
        employeeId: rowObj.employee_id,
        reason: fullReason,
      }),
      tenantId,
    ]
  )

  persist()

  res.json({
    ok: true,
    message: "Pedido de vista registrado com sucesso! O Departamento Pessoal analisará seu recurso.",
    contracheque: {
      ...rowToDto(rowObj),
      status: "em_recurso",
      contestRequestedAt: requestedAt,
      contestReason: fullReason,
    },
    protocol: reqId,
  })
})

/**
 * POST /api/contracheques/:id/recalcular
 * DP/RH recalcula as rubricas do CC e gera nova versão imutável linear
 */
router.post("/:id/recalcular", requirePermission("payroll.manage"), (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const id = String(req.params.id)
  const { newHolerite, newSalaryBase, resolutionNotes } = req.body
  const db = getDB()

  if (!newHolerite) {
    res.status(400).json({ ok: false, error: "Dados do novo holerite recalculado são obrigatórios." })
    return
  }

  const result = db.exec(`SELECT * FROM contracheques WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Contra-cheque não encontrado." })
    return
  }

  const cols = result[0].columns
  const oldRow: Record<string, any> = {}
  cols.forEach((col, idx) => {
    oldRow[col] = result[0].values[0][idx]
  })

  const now = new Date()
  const deadline = new Date(oldRow.contest_deadline_at)

  // Se já for imutável e NÃO estiver sob recurso formalmente aberto, bloquear
  if (oldRow.is_immutable === 1 && oldRow.status !== "em_recurso") {
    res.status(403).json({
      ok: false,
      error: "Este contra-cheque é imutável. Não é permitido recalcular documentos com prazo expirado e sem recurso ativo.",
    })
    return
  }

  if (now > deadline && oldRow.status !== "em_recurso") {
    db.run(`UPDATE contracheques SET is_immutable = 1, status = 'imutavel' WHERE id = ?`, [id])
    persist()
    res.status(403).json({
      ok: false,
      error: "O prazo de vista deste contra-cheque encerrou-se. O documento é imutável.",
    })
    return
  }

  const deadlineDays = getTenantContestDeadlineDays(tenantId)
  const newDeadlineDate = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000)

  // 1. Congelar a versão anterior como imutável (histórico preservado sem ligação com documentos posteriores)
  db.run(
    `UPDATE contracheques 
     SET status = 'recalculado', is_immutable = 1, contest_resolution = ?
     WHERE id = ?`,
    [resolutionNotes || "Recurso de cálculo deferido e homologado pelo Departamento Pessoal", id]
  )

  // 2. Criar a nova emissão linear independente (sem ligação ou dependência do CC anterior)
  const newVersion = oldRow.version + 1
  const cleanMonth = oldRow.month.replace("/", "_")
  const newId = `cc_${oldRow.employee_id}_${cleanMonth}_v${newVersion}_${Date.now()}`
  const newHoleriteJson = typeof newHolerite === "string" ? newHolerite : JSON.stringify(newHolerite)

  const hashSignature = crypto
    .createHash("sha256")
    .update(`${tenantId}:${oldRow.employee_id}:${oldRow.month}:v${newVersion}:${now.toISOString()}:${newHoleriteJson}`)
    .digest("hex")

  db.run(
    `INSERT INTO contracheques (
      id, tenant_id, employee_id, employee_name, cpf, role, department, admission_date, cbo,
      month, year_month, salary_base, holerite_json, version, status, is_immutable,
      generated_at, contest_deadline_at, hash_signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto_para_vista', 0, ?, ?, ?)`,
    [
      newId,
      tenantId,
      oldRow.employee_id,
      oldRow.employee_name,
      oldRow.cpf,
      oldRow.role,
      oldRow.department,
      oldRow.admission_date,
      oldRow.cbo,
      oldRow.month,
      oldRow.year_month,
      newSalaryBase || oldRow.salary_base,
      newHoleriteJson,
      newVersion,
      now.toISOString(),
      newDeadlineDate.toISOString(),
      hashSignature,
    ]
  )

  // 3. Atualizar status de eventuais solicitações em aberto para esse CC
  db.run(
    `UPDATE requests 
     SET status = 'aprovado' 
     WHERE tenant_id = ? 
       AND type = 'contracheque' 
       AND details_json LIKE ?`,
    [tenantId, `%${id}%`]
  )

  persist()

  res.json({
    ok: true,
    message: `Contra-cheque recalculado com sucesso! Nova emissão linear (Versão ${newVersion}) gerada de forma independente. O documento anterior permanece arquivado como imutável.`,
    contracheque: {
      id: newId,
      tenantId,
      employeeId: oldRow.employee_id,
      employeeName: oldRow.employee_name,
      month: oldRow.month,
      yearMonth: oldRow.year_month,
      version: newVersion,
      status: "aberto_para_vista",
      isImmutable: false,
      generatedAt: now.toISOString(),
      contestDeadlineAt: newDeadlineDate.toISOString(),
      daysRemaining: deadlineDays,
      holerite: typeof newHolerite === "string" ? JSON.parse(newHolerite) : newHolerite,
      hashSignature,
    },
  })
})

/**
 * GET /api/contracheques/tenant/deadline
 * Consulta o prazo configurado pelo cliente (tenant)
 */
router.get("/tenant/deadline", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const days = getTenantContestDeadlineDays(tenantId)
  res.json({ ok: true, tenantId, contestDeadlineDays: days })
})

/**
 * PATCH /api/contracheques/tenant/deadline
 * Atualiza o prazo estimado pelo cliente para pedido de vista
 */
router.patch("/tenant/deadline", requireAuth, (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { contestDeadlineDays } = req.body
  const days = Number(contestDeadlineDays)

  if (isNaN(days) || days < 1 || days > 90) {
    res.status(400).json({ ok: false, error: "O prazo deve ser um número entre 1 e 90 dias." })
    return
  }

  const db = getDB()
  db.run(`UPDATE tenants SET contest_deadline_days = ? WHERE id = ?`, [days, tenantId])
  persist()

  res.json({
    ok: true,
    message: `Prazo para pedido de vista do cliente configurado para ${days} dias.`,
    tenantId,
    contestDeadlineDays: days,
  })
})

export default router
