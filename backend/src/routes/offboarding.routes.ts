/**
 * routes/offboarding.routes.ts — Gestão de Desligamentos, Checklist, Entrevista de Saída & Cálculo de Rescisão CLT
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

function calculateSeveranceCLT(params: {
  salary: number
  hireDate: string
  terminationDate: string
  resignationType: string // 'sem_justa_causa' | 'com_justa_causa' | 'pedido_demissao' | 'acordo_art_484a' | 'termino_experiencia'
  noticePeriod: string // 'trabalhado' | 'indenizado' | 'dispensado'
  fgtsBalanceEstimated?: number
}) {
  const { salary, hireDate, terminationDate, resignationType, noticePeriod } = params

  const dHire = new Date(hireDate)
  const dTerm = new Date(terminationDate)

  // 1. Saldo de Salário (dias trabalhados no mês do desligamento)
  const daysInTermMonth = dTerm.getDate()
  const dailySalary = salary / 30
  const saldoSalario = Number((dailySalary * daysInTermMonth).toFixed(2))

  // 2. Décimo Terceiro Proporcional (meses trabalhados no ano corrente com >= 15 dias)
  const termMonth = dTerm.getMonth() + 1
  const termDay = dTerm.getDate()
  const fractionalMonths13 = termDay >= 15 ? termMonth : termMonth - 1
  const decimoTerceiro = Number(((salary / 12) * Math.max(1, fractionalMonths13)).toFixed(2))

  // 3. Férias Proporcionais + 1/3 Constitucional
  // Meses no período aquisitivo atual
  const hireDay = dHire.getDate()
  const hireMonth = dHire.getMonth()
  let monthsInVacationPeriod = (dTerm.getFullYear() - dHire.getFullYear()) * 12 + (dTerm.getMonth() - hireMonth)
  if (dTerm.getDate() < hireDay) monthsInVacationPeriod -= 1
  const fractionalVacationMonths = (monthsInVacationPeriod % 12) + 1
  const feriasProporcionais = Number(((salary / 12) * Math.min(12, Math.max(1, fractionalVacationMonths))).toFixed(2))
  const tercoConstitucional = Number((feriasProporcionais / 3).toFixed(2))

  // 4. Aviso Prévio
  // Lei 12.506/2011: 30 dias + 3 dias por ano completo de serviço (máximo 90 dias)
  const fullYearsWorked = Math.max(0, Math.floor((dTerm.getTime() - dHire.getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
  const noticeDaysTotal = Math.min(90, 30 + fullYearsWorked * 3)
  let avisoPrevioValor = 0

  if (noticePeriod === "indenizado" && resignationType === "sem_justa_causa") {
    avisoPrevioValor = Number(((salary / 30) * noticeDaysTotal).toFixed(2))
  } else if (noticePeriod === "indenizado" && resignationType === "acordo_art_484a") {
    avisoPrevioValor = Number((((salary / 30) * noticeDaysTotal) / 2).toFixed(2)) // 50% no acordo
  }

  // 5. Multa Rescisória do FGTS
  const estimatedFgtsAccumulated = params.fgtsBalanceEstimated || (salary * 0.08 * Math.max(1, fullYearsWorked * 12 + fractionalMonths13))
  let multaFgts = 0

  if (resignationType === "sem_justa_causa") {
    multaFgts = Number((estimatedFgtsAccumulated * 0.4).toFixed(2)) // 40% CLT
  } else if (resignationType === "acordo_art_484a") {
    multaFgts = Number((estimatedFgtsAccumulated * 0.2).toFixed(2)) // 20% Acordo Art 484-A
  }

  // Ajustes de direitos conforme o tipo de rescisão
  let final13 = decimoTerceiro
  let finalFerias = feriasProporcionais
  let finalTerco = tercoConstitucional

  if (resignationType === "com_justa_causa") {
    // Justa Causa: Perde 13º proporcional, férias proporcionais, aviso e multa FGTS
    final13 = 0
    finalFerias = 0
    finalTerco = 0
    avisoPrevioValor = 0
    multaFgts = 0
  }

  const totalBruto = Number((saldoSalario + avisoPrevioValor + final13 + finalFerias + finalTerco + multaFgts).toFixed(2))
  const inssEstimado = Number((saldoSalario * 0.09).toFixed(2))
  const irrfEstimado = Number((saldoSalario * 0.075).toFixed(2))
  const totalLiquido = Number((totalBruto - inssEstimado - irrfEstimado).toFixed(2))

  return {
    salarioBase: salary,
    diasAvisoPrevio: noticeDaysTotal,
    saldoSalario,
    avisoPrevioValor,
    decimoTerceiro: final13,
    feriasProporcionais: finalFerias,
    tercoConstitucional: finalTerco,
    fgtsAcumuladoEstimado: Number(estimatedFgtsAccumulated.toFixed(2)),
    multaFgts,
    descontos: {
      inss: inssEstimado,
      irrf: irrfEstimado,
    },
    totalBruto,
    totalLiquido,
  }
}

// GET /api/offboarding — Listagem de processos de desligamento
router.get("/", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "offboarding.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para visualizar desligamentos." })
    return
  }

  const db = getDB()
  const result = db.exec(
    `SELECT * FROM offboardings WHERE tenant_id = ? ORDER BY termination_date DESC, created_at DESC`,
    [tenantId]
  )

  const offboardings: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => { item[c] = row[idx] })
      try { item.checklist = JSON.parse(item.checklist_json || "[]") } catch { item.checklist = [] }
      try { item.equipment = JSON.parse(item.equipment_status_json || "[]") } catch { item.equipment = [] }
      try { item.severance = JSON.parse(item.severance_calc_json || "{}") } catch { item.severance = {} }
      try { item.exitInterview = JSON.parse(item.exit_interview_json || "{}") } catch { item.exitInterview = {} }
      offboardings.push(item)
    }
  }

  res.json({ ok: true, offboardings })
})

// GET /api/offboarding/:id — Detalhes de um processo de desligamento
router.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT * FROM offboardings WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Processo de desligamento não encontrado." })
    return
  }

  const item: any = {}
  result[0].columns.forEach((c, idx) => { item[c] = result[0].values[0][idx] })
  try { item.checklist = JSON.parse(item.checklist_json || "[]") } catch { item.checklist = [] }
  try { item.equipment = JSON.parse(item.equipment_status_json || "[]") } catch { item.equipment = [] }
  try { item.severance = JSON.parse(item.severance_calc_json || "{}") } catch { item.severance = {} }
  try { item.exitInterview = JSON.parse(item.exit_interview_json || "{}") } catch { item.exitInterview = {} }

  res.json({ ok: true, offboarding: item })
})

// POST /api/offboarding/calculate-severance — Simulador de rescisão CLT
router.post("/calculate-severance", (req: Request, res: Response) => {
  const { salary, hireDate, terminationDate, resignationType, noticePeriod, fgtsBalance } = req.body

  if (!salary || !hireDate || !terminationDate || !resignationType) {
    res.status(400).json({ ok: false, error: "Salário, data de admissão, data de desligamento e tipo de rescisão são obrigatórios." })
    return
  }

  const numSalary = Number(String(salary).replace(/[^0-9.,]/g, "").replace(",", "."))
  if (isNaN(numSalary) || numSalary <= 0) {
    res.status(400).json({ ok: false, error: "Valor de salário base inválido." })
    return
  }

  const calc = calculateSeveranceCLT({
    salary: numSalary,
    hireDate,
    terminationDate,
    resignationType,
    noticePeriod: noticePeriod || "trabalhado",
    fgtsBalanceEstimated: fgtsBalance ? Number(fgtsBalance) : undefined,
  })

  res.json({ ok: true, calculation: calc })
})

// POST /api/offboarding/start — Iniciar processo de desligamento
router.post("/start", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "offboarding.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para iniciar desligamentos." })
    return
  }

  const { employeeId, terminationDate, resignationType, noticePeriod, equipmentList } = req.body

  if (!employeeId || !terminationDate || !resignationType) {
    res.status(400).json({ ok: false, error: "Colaborador, data de desligamento e tipo de rescisão são obrigatórios." })
    return
  }

  const db = getDB()

  // Buscar dados cadastrais do colaborador
  const empRes = db.exec(`SELECT * FROM employees WHERE id = ? AND tenant_id = ?`, [employeeId, tenantId])
  if (!empRes.length || !empRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não localizado." })
    return
  }

  const empRow = empRes[0].values[0]
  const empCols = empRes[0].columns
  const emp: any = {}
  empCols.forEach((c: string, idx: number) => { emp[c] = empRow[idx] })

  const rawSalary = Number(String(emp.salary || "0").replace(/[^0-9.,]/g, "").replace(",", ".")) || 3500

  // Checklist padrão corporativo de desligamento
  const defaultChecklist = [
    { id: "c1", task: "Revogação imediata de credenciais de TI, VPN e e-mail corporativo", completed: false, assignedRole: "TI" },
    { id: "c2", task: "Devolução e vistoria de equipamentos e crachá", completed: false, assignedRole: "TI" },
    { id: "c3", task: "Agendamento e realização de Exame Médico Demissional (ASO)", completed: false, assignedRole: "RH" },
    { id: "c4", task: "Aplicação da Entrevista de Desligamento", completed: false, assignedRole: "RH" },
    { id: "c5", task: "Geração e conferência do Termo de Rescisão do Contrato de Trabalho (TRCT)", completed: false, assignedRole: "DP" },
    { id: "c6", task: "Comunicação de desligamento e baixa no eSocial (evento S-2299)", completed: false, assignedRole: "DP" },
  ]

  const defaultEquipment = Array.isArray(equipmentList) && equipmentList.length
    ? equipmentList
    : [
        { item: "Notebook Corporativo", serial: "NTB-REGULAR", returned: false },
        { item: "Crachá de Acesso & Token 2FA", serial: "CR-TOKEN", returned: false },
      ]

  const severanceCalc = calculateSeveranceCLT({
    salary: rawSalary,
    hireDate: emp.hireDate || "2024-01-01",
    terminationDate,
    resignationType,
    noticePeriod: noticePeriod || "trabalhado",
  })

  const offId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO offboardings (id, tenant_id, employee_id, employee_name, role, department, hire_date, termination_date, resignation_type, notice_period, status, checklist_json, equipment_status_json, severance_calc_json, exit_interview_json, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_andamento', ?, ?, ?, '{}', ?)`,
    [
      offId,
      tenantId,
      emp.id,
      emp.name,
      emp.role,
      emp.department,
      emp.hireDate,
      terminationDate,
      resignationType,
      noticePeriod || "trabalhado",
      JSON.stringify(defaultChecklist),
      JSON.stringify(defaultEquipment),
      JSON.stringify(severanceCalc),
      user.name,
    ]
  )

  // Notificação para equipes responsáveis
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
     VALUES (?, ?, ?, ?, 'offboarding', 'alta', '/offboarding')`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Novo Processo de Desligamento: ${emp.name}`,
      `Processo de rescisão iniciado para ${emp.name} (${emp.role} - ${emp.department}). Conclua o checklist operacional.`,
    ]
  )

  persist()

  recordAuditLog({
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    action: "OFFBOARDING_START",
    entity: "offboardings",
    entityId: offId,
    details: { employee: emp.name, terminationDate, resignationType },
    tenantId,
  })

  res.status(201).json({ ok: true, id: offId, message: `Desligamento de ${emp.name} iniciado com sucesso.` })
})

// PATCH /api/offboarding/:id/checklist — Atualizar item do checklist
router.patch("/:id/checklist", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { checklist } = req.body

  if (!Array.isArray(checklist)) {
    res.status(400).json({ ok: false, error: "Checklist inválido." })
    return
  }

  const db = getDB()
  db.run(
    `UPDATE offboardings SET checklist_json = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
    [JSON.stringify(checklist), id, tenantId]
  )
  persist()

  res.json({ ok: true, message: "Checklist de desligamento atualizado." })
})

// PATCH /api/offboarding/:id/equipment — Atualizar status de devolução de equipamentos
router.patch("/:id/equipment", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { equipment } = req.body

  if (!Array.isArray(equipment)) {
    res.status(400).json({ ok: false, error: "Lista de equipamentos inválida." })
    return
  }

  const db = getDB()
  db.run(
    `UPDATE offboardings SET equipment_status_json = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
    [JSON.stringify(equipment), id, tenantId]
  )
  persist()

  res.json({ ok: true, message: "Status dos equipamentos atualizado." })
})

// POST /api/offboarding/:id/exit-interview — Registrar entrevista de desligamento
router.post("/:id/exit-interview", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { exitInterview } = req.body

  const db = getDB()
  db.run(
    `UPDATE offboardings
     SET exit_interview_json = ?, updated_at = datetime('now')
     WHERE id = ? AND tenant_id = ?`,
    [JSON.stringify(exitInterview || {}), id, tenantId]
  )
  persist()

  res.json({ ok: true, message: "Entrevista de desligamento salva com sucesso." })
})

// PATCH /api/offboarding/:id/finalize — Concluir homologação e desligar colaborador
router.patch("/:id/finalize", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const user = req.access!

  if (!roleHasPermission(user.role, "offboarding.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para finalizar desligamentos." })
    return
  }

  const db = getDB()
  const offRes = db.exec(`SELECT employee_id, employee_name, termination_date FROM offboardings WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!offRes.length || !offRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Processo não encontrado." })
    return
  }

  const [empId, empName, termDate] = offRes[0].values[0] as [string, string, string]

  // Concluir processo
  db.run(
    `UPDATE offboardings SET status = 'concluido', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  )

  // Atualizar status do colaborador para Desligado
  db.run(
    `UPDATE employees SET status = 'Desligado', terminationDate = ? WHERE id = ? AND tenant_id = ?`,
    [termDate, empId, tenantId]
  )

  // Inativar usuário no sistema
  db.run(
    `UPDATE users SET status = 'inactive' WHERE id = ? OR email IN (SELECT email FROM employees WHERE id = ?)`,
    [empId, empId]
  )

  persist()

  recordAuditLog({
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    action: "OFFBOARDING_FINALIZE",
    entity: "offboardings",
    entityId: id,
    details: { employee: empName, terminationDate: termDate },
    tenantId,
  })

  res.json({ ok: true, message: `Desligamento e homologação de ${empName} finalizados com sucesso.` })
})

export default router
