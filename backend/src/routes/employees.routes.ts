/**
 * routes/employees.routes.ts — Gestão de Colaboradores & Pastas de RH com Multi-Tenancy
 */
import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, requirePermission, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"
import { sendWelcomeEmployeeEmail, generateSecureRandomPassword } from "../services/mail.service.js"
import { dispatchWebhookEvent } from "../integrations/webhooks/dispatcher.js"
import { buildEmployeeCreatedPayload } from "../integrations/security/sanitizer.js"

const router = Router()

// Aplicar autenticação RBAC e resolução de tenant em todas as rotas de colaboradores
router.use(resolveTenant)
router.use(authenticateRBAC)

// GET /api/employees
router.get("/", (req: Request, res: Response) => {
  const { search, department, status } = req.query as Record<string, string>
  const db = getDB()
  const tenantId = req.tenantId || "tenant_default"

  const scope = req.access?.scope || "OWN"
  const userEmail = (req.access?.email || "").toLowerCase()
  const userDept = req.access?.department || ""
  const userName = req.access?.name || ""

  let sql = `SELECT * FROM employees WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  // Enforçamento estrito de escopo de dados RBAC
  if (scope === "OWN") {
    sql += ` AND lower(email) = ?`
    params.push(userEmail)
  } else if (scope === "TEAM") {
    sql += ` AND (department = ? OR manager = ? OR lower(email) = ?)`
    params.push(userDept, userName, userEmail)
  }

  if (department) {
    sql += ` AND department = ?`
    params.push(department)
  }
  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (search) {
    sql += ` AND (lower(name) LIKE lower(?) OR lower(role) LIKE lower(?) OR lower(email) LIKE lower(?))`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  sql += ` ORDER BY name ASC`

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, employees: [] })
    return
  }

  const columns = result[0].columns
  const canViewSensitive = roleHasPermission(req.access?.role || "COLABORADOR", "employees.view_sensitive")

  const employees = result[0].values.map((row) => {
    const emp: any = {}
    columns.forEach((col, idx) => {
      emp[col] = row[idx]
    })
    if (emp.customSchedulePattern && typeof emp.customSchedulePattern === "string") {
      try {
        emp.customSchedulePattern = JSON.parse(emp.customSchedulePattern)
      } catch (_e) {}
    }
    if (emp.customMonthlyOverrides && typeof emp.customMonthlyOverrides === "string") {
      try {
        emp.customMonthlyOverrides = JSON.parse(emp.customMonthlyOverrides)
      } catch (_e) {}
    }

    // Mascaramento de dados confidenciais (salário, CPF) quando fora de permissão
    const isOwn = emp.email && emp.email.toLowerCase() === userEmail
    if (!canViewSensitive && !isOwn) {
      emp.salary = "Confidencial"
      if (emp.cpf) {
        emp.cpf = emp.cpf.substring(0, 3) + ".***.***-**"
      }
    }

    return emp
  })

  res.json({ ok: true, employees })
})

// GET /api/employees/me — Dossiê do próprio colaborador autenticado
router.get("/me", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()
  const userEmail = (req.access?.email || "").toLowerCase().trim()
  const userName = (req.access?.name || "").toLowerCase().trim()

  // Buscar colaborador pelo e-mail do usuário autenticado ou pelo nome
  let empRes = db.exec(`SELECT * FROM employees WHERE tenant_id = ? AND lower(email) = ?`, [tenantId, userEmail])
  if (!empRes.length || !empRes[0].values.length) {
    empRes = db.exec(`SELECT * FROM employees WHERE tenant_id = ? AND lower(name) = ?`, [tenantId, userName])
  }

  if (!empRes.length || !empRes[0].values.length) {
    // Se o usuário ainda não tiver uma ficha criada, retornar dados mínimos derivados do login
    const minimalEmp = {
      id: `emp_${req.access?.userId || "unknown"}`,
      name: req.access?.name || "Colaborador",
      email: req.access?.email || "",
      department: req.access?.department || "Geral",
      role: req.access?.role === "COLABORADOR" ? "Colaborador" : (req.access?.role || "Geral"),
      status: "Ativo",
      phone: "",
      location: "Matriz",
      manager: "",
      hireDate: "",
      tenure: "Recém-chegado",
    }
    res.json({
      ok: true,
      employee: minimalEmp,
      documents: [],
      personalDocuments: [],
      administrativeDocuments: [],
      requests: [],
      vacation: {
        diasDisponiveis: 30,
        diasUtilizados: 0,
        solicitacoesFerias: [],
        proximoPeriodo: "Período Aquisitivo Vigente",
        temFeriasPendentes: false,
      },
      history: [],
    })
    return
  }

  const columns = empRes[0].columns
  const emp: any = {}
  empRes[0].values[0].forEach((val, idx) => {
    emp[columns[idx]] = val
  })

  // Permissões
  const canViewSensitive = roleHasPermission(req.access?.role || "COLABORADOR", "employees.view_sensitive")
  // Colaborador pode visualizar seus próprios dados pessoais; se for confidencial para terceiros, mantém mascarado
  if (!emp.role) delete emp.role
  if (!emp.department) delete emp.department
  if (!emp.manager) delete emp.manager
  if (!emp.hireDate) delete emp.hireDate

  if (emp.customSchedulePattern && typeof emp.customSchedulePattern === "string") {
    try { emp.customSchedulePattern = JSON.parse(emp.customSchedulePattern) } catch (_e) {}
  }
  if (emp.customMonthlyOverrides && typeof emp.customMonthlyOverrides === "string") {
    try { emp.customMonthlyOverrides = JSON.parse(emp.customMonthlyOverrides) } catch (_e) {}
  }

  // 1. Documentos vinculados
  const docsRes = db.exec(
    `SELECT * FROM documents 
     WHERE tenant_id = ? AND (employee_id = ? OR lower(employeeName) = ? OR lower(employeeName) = ?)
     ORDER BY date DESC`,
    [tenantId, emp.id, (emp.name || "").toLowerCase(), userEmail]
  )
  const documents: any[] = []
  const personalDocuments: any[] = []
  const administrativeDocuments: any[] = []

  if (docsRes.length && docsRes[0].values.length) {
    const docCols = docsRes[0].columns
    docsRes[0].values.forEach((row) => {
      const docItem: any = {}
      docCols.forEach((col, idx) => { docItem[col] = row[idx] })
      documents.push(docItem)
      if (docItem.origin === "pessoal") {
        personalDocuments.push(docItem)
      } else {
        administrativeDocuments.push(docItem)
      }
    })
  }

  // 2. Solicitações relacionadas
  const reqRes = db.exec(
    `SELECT * FROM requests 
     WHERE tenant_id = ? AND (lower(requester) = ? OR lower(requester) = ?)
     ORDER BY id DESC`,
    [tenantId, (emp.name || "").toLowerCase(), userEmail]
  )
  const requests: any[] = []
  const vacationRequests: any[] = []
  if (reqRes.length && reqRes[0].values.length) {
    const reqCols = reqRes[0].columns
    reqRes[0].values.forEach((row) => {
      const rItem: any = {}
      reqCols.forEach((col, idx) => { rItem[col] = row[idx] })
      if (rItem.details_json && typeof rItem.details_json === "string") {
        try { rItem.details = JSON.parse(rItem.details_json) } catch (_e) {}
      }
      requests.push(rItem)
      if (rItem.type?.toLowerCase().includes("ferias") || rItem.type?.toLowerCase().includes("férias")) {
        vacationRequests.push(rItem)
      }
    })
  }

  // 3. Férias consolidadas
  const diasAprovados = vacationRequests
    .filter((r) => r.status?.toLowerCase() === "aprovado")
    .reduce((acc, curr) => acc + (curr.details?.days || 15), 0)

  const vacation = {
    diasDisponiveis: Math.max(30 - diasAprovados, 0),
    diasUtilizados: diasAprovados,
    solicitacoesFerias: vacationRequests,
    proximoPeriodo: "Período Aquisitivo Vigente",
    temFeriasPendentes: vacationRequests.some((r) => ["pendente", "em análise", "em_analise", "correção solicitada"].includes(r.status?.toLowerCase())),
  }

  // 4. Histórico funcional
  const histRes = db.exec(
    `SELECT * FROM employee_history 
     WHERE tenant_id = ? AND employee_id = ?
     ORDER BY created_at DESC`,
    [tenantId, emp.id]
  )
  const history: any[] = []
  if (histRes.length && histRes[0].values.length) {
    const histCols = histRes[0].columns
    histRes[0].values.forEach((row) => {
      const hItem: any = {}
      histCols.forEach((col, idx) => { hItem[col] = row[idx] })
      history.push(hItem)
    })
  }

  // 5. Cálculo do tempo de empresa
  let tenure = "Menos de 1 ano"
  if (emp.hireDate) {
    try {
      const hireTime = new Date(emp.hireDate).getTime()
      if (!isNaN(hireTime)) {
        const diffMonths = Math.floor((Date.now() - hireTime) / (1000 * 60 * 60 * 24 * 30.4))
        const years = Math.floor(diffMonths / 12)
        const months = diffMonths % 12
        if (years > 0) {
          tenure = `${years} ano${years > 1 ? "s" : ""}${months > 0 ? ` e ${months} m${months > 1 ? "eses" : "ês"}` : ""}`
        } else {
          tenure = `${Math.max(months, 1)} m${months > 1 ? "eses" : "ês"}`
        }
      }
    } catch (_e) {}
  }
  emp.tenure = tenure

  res.json({
    ok: true,
    employee: emp,
    documents,
    personalDocuments,
    administrativeDocuments,
    requests,
    vacation,
    history,
  })
})

// POST /api/employees/me/request-update — Solicitar alterações cadastrais (não aplicadas automaticamente)
router.post("/me/request-update", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()
  const userEmail = (req.access?.email || "").toLowerCase().trim()
  const userName = req.access?.name || "Colaborador"

  const { changes, justification, attachment } = req.body

  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0) {
    res.status(400).json({ ok: false, error: "Nenhuma alteração cadastral informada." })
    return
  }

  // Buscar colaborador correspondente
  let empRes = db.exec(`SELECT * FROM employees WHERE tenant_id = ? AND lower(email) = ?`, [tenantId, userEmail])
  if (!empRes.length || !empRes[0].values.length) {
    empRes = db.exec(`SELECT * FROM employees WHERE tenant_id = ? AND lower(name) = ?`, [tenantId, userName.toLowerCase()])
  }

  let emp: any = {}
  if (empRes.length && empRes[0].values.length) {
    const cols = empRes[0].columns
    empRes[0].values[0].forEach((val, idx) => { emp[cols[idx]] = val })
  } else {
    emp = { id: `emp_${req.access?.userId}`, name: userName, email: userEmail, department: req.access?.department || "Geral" }
  }

  const allowedKeys = ["phone", "address", "city", "state", "cep", "notes", "emergencyContact", "bankInfo"]
  const cleanChanges: Record<string, any> = {}
  const originalValues: Record<string, any> = {}

  for (const key of Object.keys(changes)) {
    if (allowedKeys.includes(key) && changes[key] !== undefined) {
      cleanChanges[key] = changes[key]
      originalValues[key] = emp[key] || ""
    }
  }

  if (Object.keys(cleanChanges).length === 0) {
    res.status(400).json({ ok: false, error: "Campos informados não são permitidos para alteração cadastral direta." })
    return
  }

  const requestId = `REQ-CAD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const date = new Date().toISOString().split("T")[0]
  const status = "Em Análise"
  const priority = "Média"
  const type = "Atualização Cadastral"
  const desc = justification || `Solicitação de alteração cadastral: ${Object.keys(cleanChanges).join(", ")}`

  const detailsObj = {
    created_by_id: req.access?.userId,
    created_by_email: userEmail,
    created_by_name: userName,
    employee_id: emp.id,
    employee_email: emp.email || userEmail,
    changes: cleanChanges,
    original: originalValues,
    justification: justification || "",
    attachment_name: attachment?.name || null,
  }

  db.run(
    `INSERT INTO requests (id, type, requester, department, date, status, priority, description, details_json, tenant_id, justification, attachment_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      requestId,
      type,
      emp.name || userName,
      emp.department || req.access?.department || "Geral",
      date,
      status,
      priority,
      desc,
      JSON.stringify(detailsObj),
      tenantId,
      justification || null,
      attachment?.name || null,
    ]
  )

  // Criar notificação para o RH
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    db.run(
      `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [
        notifId,
        tenantId,
        `Nova Solicitação Cadastral — ${emp.name || userName}`,
        `Colaborador solicitou alteração de dados cadastrais (${Object.keys(cleanChanges).join(", ")}).`,
        "solicitacao",
        "alta",
        "/solicitacoes",
      ]
    )
  } catch (_e) {}

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "EMPLOYEE_REQUEST_UPDATE",
    entity: "employees",
    entityId: emp.id,
    details: { requestId, fields: Object.keys(cleanChanges) },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    id: requestId,
    message: "Solicitação de alteração cadastral enviada com sucesso para análise do RH.",
  })
})

// GET /api/employees/:id (ou /api/funcionarios/:id) — Perfil Completo Consolidado
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT * FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não encontrado nesta organização." })
    return
  }

  const columns = result[0].columns
  const emp: any = {}
  result[0].values[0].forEach((val, idx) => {
    emp[columns[idx]] = val
  })

  // Validação de Escopo RBAC para acesso a perfil individual
  const scope = req.access?.scope || "OWN"
  const userEmail = (req.access?.email || "").toLowerCase()
  const userDept = req.access?.department || ""
  const userName = req.access?.name || ""
  const isOwnRecord = emp.email && emp.email.toLowerCase() === userEmail

  if (scope === "OWN" && !isOwnRecord) {
    res.status(403).json({
      ok: false,
      error: "Acesso negado: Seu perfil só possui permissão para visualizar seu próprio perfil de colaborador.",
    })
    return
  }

  if (scope === "TEAM" && !isOwnRecord) {
    const isSameDept = emp.department && emp.department.toLowerCase() === userDept.toLowerCase()
    const isManager = emp.manager && emp.manager.toLowerCase() === userName.toLowerCase()
    if (!isSameDept && !isManager) {
      res.status(403).json({
        ok: false,
        error: "Acesso negado: Este colaborador não pertence à sua equipe ou departamento.",
      })
      return
    }
  }

  const canViewSensitive = roleHasPermission(req.access?.role || "COLABORADOR", "employees.view_sensitive")
  if (!canViewSensitive && !isOwnRecord) {
    emp.salary = "Confidencial"
    if (emp.cpf) {
      emp.cpf = emp.cpf.substring(0, 3) + ".***.***-**"
    }
  }

  if (emp.customSchedulePattern && typeof emp.customSchedulePattern === "string") {
    try {
      emp.customSchedulePattern = JSON.parse(emp.customSchedulePattern)
    } catch (_e) {}
  }
  if (emp.customMonthlyOverrides && typeof emp.customMonthlyOverrides === "string") {
    try {
      emp.customMonthlyOverrides = JSON.parse(emp.customMonthlyOverrides)
    } catch (_e) {}
  }

  // 1. Documentos vinculados
  const docsRes = db.exec(
    `SELECT id, name, category, employeeName, expiryDate, date, status, fileUrl, type 
     FROM documents 
     WHERE tenant_id = ? AND (employee_id = ? OR employeeName = ?)
     ORDER BY date DESC`,
    [tenantId, id, emp.name]
  )
  const documents: any[] = []
  if (docsRes.length && docsRes[0].values.length) {
    const docCols = docsRes[0].columns
    docsRes[0].values.forEach((row) => {
      const docItem: any = {}
      docCols.forEach((col, idx) => { docItem[col] = row[idx] })
      documents.push(docItem)
    })
  }

  // 2. Solicitações relacionadas ao colaborador
  const reqRes = db.exec(
    `SELECT id, type, requester, department, date, status, priority, description, details_json
     FROM requests 
     WHERE tenant_id = ? AND requester = ?
     ORDER BY date DESC`,
    [tenantId, emp.name]
  )
  const requests: any[] = []
  const vacationRequests: any[] = []
  if (reqRes.length && reqRes[0].values.length) {
    const reqCols = reqRes[0].columns
    reqRes[0].values.forEach((row) => {
      const rItem: any = {}
      reqCols.forEach((col, idx) => { rItem[col] = row[idx] })
      if (rItem.details_json && typeof rItem.details_json === "string") {
        try { rItem.details = JSON.parse(rItem.details_json) } catch (_e) {}
      }
      requests.push(rItem)
      if (rItem.type?.toLowerCase().includes("ferias") || rItem.type?.toLowerCase().includes("férias")) {
        vacationRequests.push(rItem)
      }
    })
  }

  // 3. Férias consolidadas
  const diasAprovados = vacationRequests
    .filter((r) => r.status?.toLowerCase() === "aprovado")
    .reduce((acc, curr) => acc + (curr.details?.days || 15), 0)

  const vacation = {
    diasDisponiveis: Math.max(30 - diasAprovados, 0),
    diasUtilizados: diasAprovados,
    solicitacoesFerias: vacationRequests,
    proximoPeriodo: "Período Aquisitivo 2024/2025",
    temFeriasPendentes: vacationRequests.some((r) => ["pendente", "em análise", "em_analise"].includes(r.status?.toLowerCase())),
  }

  // 4. Histórico Funcional / Auditoria
  const histRes = db.exec(
    `SELECT id, type, title, description, old_value, new_value, created_by, created_at 
     FROM employee_history 
     WHERE tenant_id = ? AND employee_id = ?
     ORDER BY created_at DESC`,
    [tenantId, id]
  )
  const history: any[] = []
  if (histRes.length && histRes[0].values.length) {
    const histCols = histRes[0].columns
    histRes[0].values.forEach((row) => {
      const hItem: any = {}
      histCols.forEach((col, idx) => { hItem[col] = row[idx] })
      history.push(hItem)
    })
  } else {
    // Se não houver histórico, cria um marco de Admissão visual
    history.push({
      id: `hist_adm_${emp.id}`,
      type: "admissao",
      title: "Admissão Cadastrada",
      description: `Início das atividades profissionais na empresa como ${emp.role}.`,
      old_value: null,
      new_value: emp.salary,
      created_by: "Sistema RH",
      created_at: emp.hireDate || "2024-01-01",
    })
  }

  // 5. Cálculo do tempo de empresa
  let tenure = "Menos de 1 ano"
  if (emp.hireDate) {
    try {
      const hireTime = new Date(emp.hireDate).getTime()
      if (!isNaN(hireTime)) {
        const diffMonths = Math.floor((Date.now() - hireTime) / (1000 * 60 * 60 * 24 * 30.4))
        const years = Math.floor(diffMonths / 12)
        const months = diffMonths % 12
        if (years > 0) {
          tenure = `${years} ano${years > 1 ? "s" : ""}${months > 0 ? ` e ${months} m${months > 1 ? "eses" : "ês"}` : ""}`
        } else {
          tenure = `${Math.max(months, 1)} m${months > 1 ? "eses" : "ês"}`
        }
      }
    } catch (_e) {}
  }
  emp.tenure = tenure

  res.json({
    ok: true,
    employee: emp,
    documents,
    requests,
    vacation,
    history,
  })
})

// POST /api/employees (Criar pasta de colaborador / Novo funcionário e envio de credenciais via SMTP)
router.post("/", requirePermission("employees.create"), async (req: Request, res: Response) => {
  const {
    name,
    role,
    department,
    email,
    phone,
    cpf,
    hireDate,
    salary,
    manager,
    location,
    contractType,
    workSchedule,
    customSchedulePattern,
    initialPassword,
    sendEmail = true,
  } = req.body
  const tenantId = req.tenantId || "tenant_default"

  if (!name || !role || !department || !email) {
    res.status(400).json({ ok: false, error: "Nome, cargo, departamento e e-mail são obrigatórios." })
    return
  }

  const id = `emp_${Date.now()}`
  const db = getDB()
  const patternJson = customSchedulePattern
    ? typeof customSchedulePattern === "string"
      ? customSchedulePattern
      : JSON.stringify(customSchedulePattern)
    : null

  // 1. Criar pasta funcional do colaborador na tabela employees
  db.run(
    `INSERT INTO employees (id, name, role, department, status, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, customSchedulePattern, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      role,
      department,
      "Ativo",
      email,
      phone || "",
      cpf || "",
      hireDate || new Date().toISOString().split("T")[0],
      salary || "R$ 0,00",
      manager || "Não atribuído",
      location || "São Paulo, SP",
      contractType || "prazo_indeterminado",
      workSchedule || "escala_5x2",
      patternJson,
      tenantId,
    ]
  )

  // 2. Gerar senha temporária segura (o RH não visualiza a senha; o sistema gera e dispara ao e-mail)
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanName = String(name).trim()
  const userPassword = initialPassword && String(initialPassword).trim()
    ? String(initialPassword).trim()
    : generateSecureRandomPassword()

  const hash = bcrypt.hashSync(userPassword, 10)
  const initials = cleanName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "US"

  const userRole = role ? String(role) : "Colaborador"
  const userDept = department ? String(department) : "Recursos Humanos"

  const existingUser = db.exec(`SELECT id FROM users WHERE lower(email) = ?`, [cleanEmail])
  if (existingUser.length && existingUser[0].values.length) {
    const existingId = existingUser[0].values[0][0] as string
    db.run(
      `UPDATE users SET name = ?, password = ?, role = ?, department = ?, initials = ?, tenant_id = ?, must_change_password = 1 WHERE id = ?`,
      [cleanName, hash, userRole, userDept, initials, tenantId, existingId]
    )
  } else {
    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    db.run(
      `INSERT INTO users (id, name, email, password, role, department, initials, tenant_id, two_factor_enabled, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [newUserId, cleanName, cleanEmail, hash, userRole, userDept, initials, tenantId]
    )
  }

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "EMPLOYEE_CREATE",
    entity: "employees",
    entityId: id,
    details: { name: cleanName, role: userRole, department: userDept, email: cleanEmail },
    tenantId,
  })

  // Disparar Webhook assíncrono de colaborador criado
  dispatchWebhookEvent(
    "employee.created",
    buildEmployeeCreatedPayload({
      id,
      name: cleanName,
      role: userRole,
      department: userDept,
      email: cleanEmail,
      hireDate,
      status: "Ativo",
      contractType,
      workSchedule,
    }),
    tenantId
  ).catch((wErr) => console.error("[Webhook Error] employee.created:", wErr.message))

  // 3. Buscar nome do tenant para o e-mail corporativo
  let tenantName = "PeopleHub Matriz"
  const tRes = db.exec(`SELECT name FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
  }

  // 4. Disparo de e-mail SMTP com a senha para o colaborador
  let emailDispatched = false
  let emailError: string | undefined

  if (sendEmail !== false) {
    try {
      const mailRes = await sendWelcomeEmployeeEmail({
        to: cleanEmail,
        name: cleanName,
        temporaryPassword: userPassword,
        role: userRole,
        department: userDept,
        tenantName,
      })
      emailDispatched = mailRes.ok
      if (!mailRes.ok) emailError = mailRes.error
    } catch (mErr: any) {
      emailError = mErr.message
    }
  }

  res.status(201).json({
    ok: true,
    id,
    userEmail: cleanEmail,
    emailDispatched,
    emailError,
    message: emailDispatched
      ? `Pasta de colaborador criada e credenciais de acesso enviadas via SMTP para ${cleanEmail}.`
      : `Pasta de colaborador criada e credenciais de acesso geradas com sucesso.`,
  })
})

// POST /api/employees/:id/resend-access-email (Reenviar e-mail de credenciais com nova senha via SMTP)
router.post("/:id/resend-access-email", requirePermission("employees.update"), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(`SELECT name, email, role, department FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não encontrado." })
    return
  }

  const [name, email, role, department] = result[0].values[0] as [string, string, string, string]
  const cleanEmail = email.toLowerCase().trim()
  const newPassword = generateSecureRandomPassword()
  const hash = bcrypt.hashSync(newPassword, 10)

  // Atualizar senha na tabela users
  db.run(`UPDATE users SET password = ? WHERE lower(email) = ?`, [hash, cleanEmail])
  persist()

  let tenantName = "PeopleHub Matriz"
  const tRes = db.exec(`SELECT name FROM tenants WHERE id = ?`, [tenantId])
  if (tRes.length && tRes[0].values.length) {
    tenantName = tRes[0].values[0][0] as string
  }

  const mailRes = await sendWelcomeEmployeeEmail({
    to: cleanEmail,
    name,
    temporaryPassword: newPassword,
    role,
    department,
    tenantName,
  })

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "EMPLOYEE_RESET_PASSWORD",
    entity: "employees",
    entityId: id,
    details: { email: cleanEmail },
    tenantId,
  })

  res.json({
    ok: mailRes.ok,
    message: mailRes.ok
      ? `Novas credenciais de acesso enviadas via SMTP para ${cleanEmail}.`
      : `Erro ao disparar e-mail: ${mailRes.error}`,
  })
})

// DELETE /api/employees/:id
router.delete("/:id", requirePermission("employees.delete"), (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "EMPLOYEE_DELETE",
    entity: "employees",
    entityId: id,
    tenantId,
  })

  res.json({ ok: true, message: "Colaborador removido com sucesso." })
})

// Helper comum para atualização de colaborador com auditoria funcional
function handleEmployeeUpdate(req: Request, res: Response) {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const {
    name,
    role,
    department,
    status,
    email,
    phone,
    cpf,
    hireDate,
    terminationDate,
    salary,
    manager,
    location,
    contractType,
    workSchedule,
    birthDate,
    address,
    city,
    state,
    cep,
    notes,
    customSchedulePattern,
    customMonthlyOverrides,
  } = req.body

  const db = getDB()

  // Buscar dados anteriores para registrar histórico de auditoria
  const oldRes = db.exec(`SELECT * FROM employees WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!oldRes.length || !oldRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Colaborador não encontrado." })
    return
  }

  const oldCols = oldRes[0].columns
  const oldEmp: any = {}
  oldRes[0].values[0].forEach((val, idx) => {
    oldEmp[oldCols[idx]] = val
  })

  // Validação de permissões e escopos RBAC
  const userRole = req.access?.role || "COLABORADOR"
  const bodyKeys = Object.keys(req.body)
  const isScheduleOnly = bodyKeys.length > 0 && bodyKeys.every(
    (k) => k === "customSchedulePattern" || k === "customMonthlyOverrides" || req.body[k] === undefined
  )

  if (isScheduleOnly && roleHasPermission(userRole, "schedules.manage")) {
    if (req.access?.scope === "TEAM") {
      const isTeam = oldEmp.department === req.access.department || oldEmp.manager === req.access.name
      if (!isTeam) {
        res.status(403).json({ ok: false, error: "Acesso negado: Este colaborador não pertence à sua equipe." })
        return
      }
    }
  } else {
    if (!roleHasPermission(userRole, "employees.update")) {
      res.status(403).json({
        ok: false,
        error: `Acesso negado: Seu perfil (${userRole}) não possui permissão para editar dados cadastrais de funcionários.`,
      })
      return
    }
  }

  const fields: string[] = []
  const params: any[] = []

  if (name !== undefined) { fields.push("name = ?"); params.push(name) }
  if (role !== undefined) { fields.push("role = ?"); params.push(role) }
  if (department !== undefined) { fields.push("department = ?"); params.push(department) }
  if (status !== undefined) { fields.push("status = ?"); params.push(status) }
  if (email !== undefined) { fields.push("email = ?"); params.push(email) }
  if (phone !== undefined) { fields.push("phone = ?"); params.push(phone) }
  if (cpf !== undefined) { fields.push("cpf = ?"); params.push(cpf) }
  if (hireDate !== undefined) { fields.push("hireDate = ?"); params.push(hireDate) }
  if (terminationDate !== undefined) { fields.push("terminationDate = ?"); params.push(terminationDate) }
  if (salary !== undefined) { fields.push("salary = ?"); params.push(salary) }
  if (manager !== undefined) { fields.push("manager = ?"); params.push(manager) }
  if (location !== undefined) { fields.push("location = ?"); params.push(location) }
  if (contractType !== undefined) { fields.push("contractType = ?"); params.push(contractType) }
  if (workSchedule !== undefined) { fields.push("workSchedule = ?"); params.push(workSchedule) }
  if (birthDate !== undefined) { fields.push("birthDate = ?"); params.push(birthDate) }
  if (address !== undefined) { fields.push("address = ?"); params.push(address) }
  if (city !== undefined) { fields.push("city = ?"); params.push(city) }
  if (state !== undefined) { fields.push("state = ?"); params.push(state) }
  if (cep !== undefined) { fields.push("cep = ?"); params.push(cep) }
  if (notes !== undefined) { fields.push("notes = ?"); params.push(notes) }
  if (customSchedulePattern !== undefined) {
    fields.push("customSchedulePattern = ?")
    params.push(
      customSchedulePattern
        ? typeof customSchedulePattern === "string"
          ? customSchedulePattern
          : JSON.stringify(customSchedulePattern)
        : null
    )
  }
  if (customMonthlyOverrides !== undefined) {
    fields.push("customMonthlyOverrides = ?")
    params.push(
      customMonthlyOverrides
        ? typeof customMonthlyOverrides === "string"
          ? customMonthlyOverrides
          : JSON.stringify(customMonthlyOverrides)
        : null
    )
  }

  if (fields.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum campo informado para atualização." })
    return
  }

  params.push(id)
  params.push(tenantId)
  db.run(`UPDATE employees SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, params)

  // Auditoria automática no employee_history
  const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19)

  if (role !== undefined && role !== oldEmp.role) {
    db.run(
      `INSERT INTO employee_history (id, employee_id, tenant_id, type, title, description, old_value, new_value, created_by, created_at)
       VALUES (?, ?, ?, 'cargo', 'Alteração de Cargo', ?, ?, ?, 'Gestor RH', ?)`,
      [`hist_${Date.now()}_cargo`, id, tenantId, `Cargo alterado de "${oldEmp.role}" para "${role}".`, oldEmp.role, role, nowStr]
    )
  }

  if (salary !== undefined && salary !== oldEmp.salary) {
    db.run(
      `INSERT INTO employee_history (id, employee_id, tenant_id, type, title, description, old_value, new_value, created_by, created_at)
       VALUES (?, ?, ?, 'salario', 'Reajuste / Alteração Salarial', ?, ?, ?, 'Gestor RH', ?)`,
      [`hist_${Date.now()}_sal`, id, tenantId, `Salário base alterado de ${oldEmp.salary} para ${salary}.`, oldEmp.salary, salary, nowStr]
    )
  }

  if (department !== undefined && department !== oldEmp.department) {
    db.run(
      `INSERT INTO employee_history (id, employee_id, tenant_id, type, title, description, old_value, new_value, created_by, created_at)
       VALUES (?, ?, ?, 'departamento', 'Mudança de Departamento', ?, ?, ?, 'Gestor RH', ?)`,
      [`hist_${Date.now()}_dept`, id, tenantId, `Transferência do departamento "${oldEmp.department}" para "${department}".`, oldEmp.department, department, nowStr]
    )
  }

  if (status !== undefined && status !== oldEmp.status) {
    db.run(
      `INSERT INTO employee_history (id, employee_id, tenant_id, type, title, description, old_value, new_value, created_by, created_at)
       VALUES (?, ?, ?, 'status', 'Alteração de Status', ?, ?, ?, 'Gestor RH', ?)`,
      [`hist_${Date.now()}_stat`, id, tenantId, `Status cadastral atualizado de "${oldEmp.status}" para "${status}".`, oldEmp.status, status, nowStr]
    )
  }

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "EMPLOYEE_UPDATE",
    entity: "employees",
    entityId: id,
    details: { fieldsUpdated: fields.map((f) => f.split(" ")[0]) },
    tenantId,
  })

  res.json({ ok: true, message: "Funcionário atualizado com sucesso." })
}

// PUT /api/employees/:id
router.put("/:id", handleEmployeeUpdate)

// PATCH /api/employees/:id
router.patch("/:id", handleEmployeeUpdate)

export default router


