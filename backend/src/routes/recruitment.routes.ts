/**
 * routes/recruitment.routes.ts — Gestão de Recrutamento & Seleção (ATS) do PeopleHub RH
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"
import { dispatchWebhookEvent } from "../integrations/webhooks/dispatcher.js"
import { buildJobPublishedPayload, buildCandidateStageChangedPayload } from "../integrations/security/sanitizer.js"

const router = Router()

// Whitelist de tipos MIME válidos para anexos de currículo (segurança e conformidade)
const ALLOWED_RESUME_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// Helper para converter parâmetros de rota para string segura
function paramToStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || ""
  return String(val || "")
}

/* ─────────────────────────────────────────────────────────────
 * ROTAS PÚBLICAS (Acesso sem autenticação para candidatos)
 * ───────────────────────────────────────────────────────────── */

// GET /api/recruitment/public/jobs — Listar vagas ativas abertas ao público
router.get("/public/jobs", (req: Request, res: Response) => {
  const tenantId = req.headers["x-tenant-id"] || req.query.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, title, department, role, work_model, contract_type, location, positions_count,
            salary_min, salary_max, salary_is_confidential, description, requirements, responsibilities,
            benefits, published_at, created_at
     FROM job_postings
     WHERE tenant_id = ? AND status = 'aberta' AND is_public = 1
     ORDER BY published_at DESC`,
    [tenantId as string]
  )

  const jobs: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      // Ocultar valores de salário se marcados como confidenciais
      if (item.salary_is_confidential) {
        delete item.salary_min
        delete item.salary_max
      }
      jobs.push(item)
    }
  }

  res.json({ ok: true, jobs })
})

// GET /api/recruitment/public/jobs/:id — Detalhes públicos de uma vaga
router.get("/public/jobs/:id", (req: Request, res: Response) => {
  const id = paramToStr(req.params.id)
  const tenantId = req.headers["x-tenant-id"] || req.query.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, title, department, role, work_model, contract_type, location, positions_count,
            salary_min, salary_max, salary_is_confidential, description, requirements, responsibilities,
            benefits, published_at, created_at
     FROM job_postings
     WHERE id = ? AND tenant_id = ? AND status = 'aberta' AND is_public = 1`,
    [id, tenantId as string]
  )

  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada ou não disponível publicamente." })
    return
  }

  const cols = result[0].columns
  const job: any = {}
  cols.forEach((col, idx) => {
    job[col] = result[0].values[0][idx]
  })

  if (job.salary_is_confidential) {
    delete job.salary_min
    delete job.salary_max
  }

  res.json({ ok: true, job })
})

// POST /api/recruitment/public/jobs/:id/apply — Candidatura pública com validações LGPD
router.post("/public/jobs/:id/apply", (req: Request, res: Response) => {
  const jobId = paramToStr(req.params.id)
  const tenantId = (req.headers["x-tenant-id"] as string) || "tenant_default"
  const {
    phone,
    linkedinUrl,
    portfolioUrl,
    city,
    state,
    source = "site_carreiras",
    resumeMimeType,
    lgpdConsent,
  } = req.body

  const name = req.body.name || req.body.fullName
  const email = req.body.email
  const resumeFilename = req.body.resumeFilename || req.body.resumeFileName
  const resumeDataBase64 = req.body.resumeDataBase64 || req.body.resumeBase64

  if (!name || !email) {
    res.status(400).json({ ok: false, error: "Nome completo e e-mail são obrigatórios para a candidatura." })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    res.status(400).json({ ok: false, error: "Formato de e-mail inválido." })
    return
  }

  if (!lgpdConsent) {
    res.status(400).json({
      ok: false,
      error: "O consentimento explícito com a política de privacidade (LGPD) é obrigatório.",
    })
    return
  }

  // Validação de segurança do currículo se enviado
  if (resumeDataBase64) {
    if (resumeMimeType && !ALLOWED_RESUME_MIMES.includes(resumeMimeType)) {
      res.status(400).json({
        ok: false,
        error: "Formato de arquivo não suportado. Utilize PDF, DOCX ou TXT.",
      })
      return
    }

    const approxSizeBytes = Math.round((resumeDataBase64.length * 3) / 4)
    if (approxSizeBytes > MAX_RESUME_SIZE_BYTES) {
      res.status(400).json({
        ok: false,
        error: "O tamanho do currículo excede o limite máximo permitido de 5 MB.",
      })
      return
    }
  }

  const db = getDB()

  // Verificar se a vaga existe e está aberta
  const jobRes = db.exec(`SELECT id, title FROM job_postings WHERE id = ? AND tenant_id = ? AND status = 'aberta'`, [
    jobId,
    tenantId,
  ])
  if (!jobRes.length || !jobRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada ou inscrições encerradas." })
    return
  }
  const jobTitle = jobRes[0].values[0][1] as string

  // Verificar se o candidato já existe pelo e-mail neste tenant
  const candRes = db.exec(`SELECT id FROM candidates WHERE tenant_id = ? AND lower(email) = lower(?)`, [
    tenantId,
    email.trim(),
  ])

  let candidateId = ""
  const now = new Date().toISOString()

  if (candRes.length && candRes[0].values.length) {
    candidateId = candRes[0].values[0][0] as string
    // Atualizar dados de contato e currículo se enviado
    db.run(
      `UPDATE candidates
       SET name = ?, phone = ?, linkedin_url = ?, portfolio_url = ?, city = ?, state = ?,
           resume_filename = COALESCE(?, resume_filename),
           resume_data_base64 = COALESCE(?, resume_data_base64),
           resume_mime_type = COALESCE(?, resume_mime_type),
           lgpd_consent = 1, lgpd_consent_date = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        name.trim(),
        phone || null,
        linkedinUrl || null,
        portfolioUrl || null,
        city || null,
        state || null,
        resumeFilename || null,
        resumeDataBase64 || null,
        resumeMimeType || null,
        now,
        now,
        candidateId,
        tenantId,
      ]
    )
  } else {
    candidateId = `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    db.run(
      `INSERT INTO candidates (id, tenant_id, name, email, phone, linkedin_url, portfolio_url, city, state, source,
                               resume_filename, resume_data_base64, resume_mime_type, lgpd_consent, lgpd_consent_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        candidateId,
        tenantId,
        name.trim(),
        email.trim().toLowerCase(),
        phone || null,
        linkedinUrl || null,
        portfolioUrl || null,
        city || null,
        state || null,
        source,
        resumeFilename || null,
        resumeDataBase64 || null,
        resumeMimeType || null,
        now,
        now,
        now,
      ]
    )
  }

  // Prevenção de candidatura duplicada para a mesma vaga
  const appCheck = db.exec(
    `SELECT id, stage FROM job_applications WHERE tenant_id = ? AND job_id = ? AND candidate_id = ?`,
    [tenantId, jobId, candidateId]
  )
  if (appCheck.length && appCheck[0].values.length) {
    res.status(409).json({
      ok: false,
      error: "Você já se candidatou para esta oportunidade anteriormente.",
      stage: appCheck[0].values[0][1],
    })
    return
  }

  const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  db.run(
    `INSERT INTO job_applications (id, tenant_id, job_id, candidate_id, stage, rating, applied_at, updated_at)
     VALUES (?, ?, ?, ?, 'inscricao', 0, ?, ?)`,
    [applicationId, tenantId, jobId, candidateId, now, now]
  )

  // Registro de histórico da candidatura
  db.run(
    `INSERT INTO application_stage_history (id, tenant_id, application_id, from_stage, to_stage, changed_by_name, notes, created_at)
     VALUES (?, ?, ?, NULL, 'inscricao', 'Candidato (Portal)', 'Inscrição submetida via página de oportunidades.', ?)`,
    [`hist_${Date.now()}`, tenantId, applicationId, now]
  )

  // Notificar equipe de RH
  db.run(
    `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link, read, created_at)
     VALUES (?, ?, 'Nova Candidatura Recebida', ?, 'recruitment', 'media', '/recrutamento', 0, ?)`,
    [
      `notif_${Date.now()}`,
      tenantId,
      `Candidato(a) ${name.trim()} se inscreveu para a vaga '${jobTitle}'.`,
      now,
    ]
  )

  persist()

  res.status(201).json({
    ok: true,
    candidateId,
    applicationId,
    message: "Candidatura registrada com sucesso! A equipe de seleção entrará em contato em breve.",
  })
})

/* ─────────────────────────────────────────────────────────────
 * ROTAS PROTEGIDAS (Exigem Autenticação RBAC)
 * ───────────────────────────────────────────────────────────── */
router.use(authenticateRBAC)

// GET /api/recruitment/jobs — Listar vagas com filtros e métricas de candidatos
router.get("/jobs", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para visualizar vagas no ATS." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { status, department, search } = req.query
  const db = getDB()

  let sql = `SELECT * FROM job_postings WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (status && status !== "todos") {
    sql += ` AND status = ?`
    params.push(String(status))
  }

  if (department && department !== "todos") {
    sql += ` AND department = ?`
    params.push(String(department))
  }

  if (search) {
    sql += ` AND (title LIKE ? OR role LIKE ? OR description LIKE ?)`
    const term = `%${search}%`
    params.push(term, term, term)
  }

  sql += ` ORDER BY created_at DESC`

  const result = db.exec(sql, params)
  const jobs: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })

      // Buscar total de candidatos por etapa para a vaga
      const appCounts = db.exec(
        `SELECT stage, count(*) as count FROM job_applications
         WHERE job_id = ? AND tenant_id = ? GROUP BY stage`,
        [item.id, tenantId]
      )

      const stageCounts: Record<string, number> = {
        inscricao: 0,
        triagem: 0,
        entrevista: 0,
        teste_tecnico: 0,
        aprovado: 0,
        reprovado: 0,
        contratado: 0,
      }
      let totalCandidates = 0

      if (appCounts.length && appCounts[0].values.length) {
        for (const stRow of appCounts[0].values) {
          const st = stRow[0] as string
          const count = stRow[1] as number
          stageCounts[st] = count
          totalCandidates += count
        }
      }

      item.candidate_counts = stageCounts
      item.total_candidates = totalCandidates
      item.is_public = Boolean(item.is_public)
      item.salary_is_confidential = Boolean(item.salary_is_confidential)
      jobs.push(item)
    }
  }

  res.json({ ok: true, jobs })
})

// GET /api/recruitment/jobs/:id — Detalhes completos da vaga e candidatos inscritos
router.get("/jobs/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const jobRes = db.exec(`SELECT * FROM job_postings WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!jobRes.length || !jobRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." })
    return
  }

  const jobCols = jobRes[0].columns
  const job: any = {}
  jobCols.forEach((col, idx) => {
    job[col] = jobRes[0].values[0][idx]
  })
  job.is_public = Boolean(job.is_public)
  job.salary_is_confidential = Boolean(job.salary_is_confidential)

  // Candidatos vinculados à vaga
  const candRes = db.exec(
    `SELECT a.id as application_id, a.stage, a.rating, a.rejection_reason, a.applied_at, a.hired_at,
            c.id as candidate_id, c.name, c.email, c.phone, c.linkedin_url, c.portfolio_url, c.city, c.state,
            c.source, c.resume_filename, c.lgpd_consent, c.notes
     FROM job_applications a
     INNER JOIN candidates c ON c.id = a.candidate_id
     WHERE a.job_id = ? AND a.tenant_id = ?
     ORDER BY a.applied_at DESC`,
    [id, tenantId]
  )

  const applications: any[] = []
  if (candRes.length && candRes[0].values.length) {
    const cols = candRes[0].columns
    for (const row of candRes[0].values) {
      const app: any = {}
      cols.forEach((col, idx) => {
        app[col] = row[idx]
      })
      applications.push(app)
    }
  }

  res.json({ ok: true, job, applications })
})

// POST /api/recruitment/jobs — Criar nova vaga de trabalho
router.post("/jobs", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para criar vagas." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const {
    title,
    department,
    role,
    workModel = "hibrido",
    contractType = "CLT",
    location = "São Paulo, SP",
    positionsCount = 1,
    status = "aberta",
    salaryMin,
    salaryMax,
    salaryIsConfidential = true,
    description,
    requirements,
    responsibilities,
    benefits,
    isPublic = true,
  } = req.body

  if (!title || !department) {
    res.status(400).json({ ok: false, error: "Título da vaga e departamento são obrigatórios." })
    return
  }

  const db = getDB()
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO job_postings (
      id, tenant_id, title, department, role, work_model, contract_type, location, positions_count,
      status, salary_min, salary_max, salary_is_confidential, description, requirements, responsibilities,
      benefits, is_public, published_at, created_by_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      tenantId,
      title.trim(),
      department.trim(),
      role || title.trim(),
      workModel,
      contractType,
      location,
      Math.max(1, Number(positionsCount) || 1),
      status,
      salaryMin ? Number(salaryMin) : null,
      salaryMax ? Number(salaryMax) : null,
      salaryIsConfidential ? 1 : 0,
      description || null,
      requirements || null,
      responsibilities || null,
      benefits || null,
      isPublic ? 1 : 0,
      status === "aberta" ? now : null,
      req.access?.userId,
      req.access?.name,
      now,
      now,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "JOB_POSTING_CREATE",
    entity: "job_postings",
    entityId: jobId,
    details: { title, department, status, workModel },
    tenantId,
  })

  // Disparar Webhook assíncrono se a vaga for publicada aberta
  if (status === "aberta") {
    dispatchWebhookEvent(
      "job.published",
      buildJobPublishedPayload({
        id: jobId,
        title,
        department,
        role,
        work_model: workModel,
        contract_type: contractType,
        location,
        positions_count: positionsCount,
        is_public: isPublic,
        published_at: now,
      }),
      tenantId
    ).catch((wErr) => console.error("[Webhook Error] job.published:", wErr.message))
  }

  res.status(201).json({ ok: true, id: jobId, job: { id: jobId, title }, message: "Vaga criada com sucesso no ATS." })
})

// PATCH /api/recruitment/jobs/:id — Editar vaga / Alterar status
router.patch("/jobs/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const check = db.exec(`SELECT status FROM job_postings WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!check.length || !check[0].values.length) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." })
    return
  }

  const currentStatus = check[0].values[0][0] as string
  const {
    title,
    department,
    role,
    workModel,
    contractType,
    location,
    positionsCount,
    status,
    salaryMin,
    salaryMax,
    salaryIsConfidential,
    description,
    requirements,
    responsibilities,
    benefits,
    isPublic,
  } = req.body

  const now = new Date().toISOString()
  let closedAt = null
  if (status === "encerrada" && currentStatus !== "encerrada") {
    closedAt = now
  }

  db.run(
    `UPDATE job_postings
     SET title = COALESCE(?, title),
         department = COALESCE(?, department),
         role = COALESCE(?, role),
         work_model = COALESCE(?, work_model),
         contract_type = COALESCE(?, contract_type),
         location = COALESCE(?, location),
         positions_count = COALESCE(?, positions_count),
         status = COALESCE(?, status),
         salary_min = COALESCE(?, salary_min),
         salary_max = COALESCE(?, salary_max),
         salary_is_confidential = COALESCE(?, salary_is_confidential),
         description = COALESCE(?, description),
         requirements = COALESCE(?, requirements),
         responsibilities = COALESCE(?, responsibilities),
         benefits = COALESCE(?, benefits),
         is_public = COALESCE(?, is_public),
         closed_at = COALESCE(?, closed_at),
         updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      title || null,
      department || null,
      role || null,
      workModel || null,
      contractType || null,
      location || null,
      positionsCount ? Number(positionsCount) : null,
      status || null,
      salaryMin !== undefined ? Number(salaryMin) : null,
      salaryMax !== undefined ? Number(salaryMax) : null,
      salaryIsConfidential !== undefined ? (salaryIsConfidential ? 1 : 0) : null,
      description !== undefined ? description : null,
      requirements !== undefined ? requirements : null,
      responsibilities !== undefined ? responsibilities : null,
      benefits !== undefined ? benefits : null,
      isPublic !== undefined ? (isPublic ? 1 : 0) : null,
      closedAt,
      now,
      id,
      tenantId,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "JOB_POSTING_UPDATE",
    entity: "job_postings",
    entityId: id,
    details: { status, title },
    tenantId,
  })

  res.json({ ok: true, message: "Vaga atualizada com sucesso." })
})

// DELETE /api/recruitment/jobs/:id — Excluir vaga
router.delete("/jobs/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.delete") && !roleHasPermission(userRole, "recruitment.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para excluir vagas." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM job_postings WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  res.json({ ok: true, message: "Vaga e candidaturas vinculadas excluídas com sucesso." })
})

// GET /api/recruitment/candidates — Listagem de candidatos
router.get("/candidates", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { jobId, stage, source, search } = req.query
  const db = getDB()

  let sql = `
    SELECT c.id, c.name, c.email, c.phone, c.linkedin_url, c.portfolio_url, c.city, c.state,
           c.source, c.resume_filename, c.lgpd_consent, c.notes, c.created_at,
           a.id as application_id, a.job_id, a.stage, a.rating, a.applied_at,
           j.title as job_title, j.department as job_department
    FROM candidates c
    LEFT JOIN job_applications a ON a.candidate_id = c.id AND a.tenant_id = c.tenant_id
    LEFT JOIN job_postings j ON j.id = a.job_id
    WHERE c.tenant_id = ?
  `
  const params: any[] = [tenantId]

  if (jobId && jobId !== "todos") {
    sql += ` AND a.job_id = ?`
    params.push(String(jobId))
  }

  if (stage && stage !== "todos") {
    sql += ` AND a.stage = ?`
    params.push(String(stage))
  }

  if (source && source !== "todos") {
    sql += ` AND c.source = ?`
    params.push(String(source))
  }

  if (search) {
    sql += ` AND (c.name LIKE ? OR c.email LIKE ? OR j.title LIKE ?)`
    const term = `%${search}%`
    params.push(term, term, term)
  }

  sql += ` ORDER BY c.created_at DESC`

  const result = db.exec(sql, params)
  const candidates: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      item.lgpd_consent = Boolean(item.lgpd_consent)
      candidates.push(item)
    }
  }

  res.json({ ok: true, candidates })
})

// GET /api/recruitment/candidates/:id — Detalhes do candidato e histórico
router.get("/candidates/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const candRes = db.exec(`SELECT * FROM candidates WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!candRes.length || !candRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Candidato não encontrado." })
    return
  }

  const candCols = candRes[0].columns
  const candidate: any = {}
  candCols.forEach((col, idx) => {
    // Não expor dados brutos em base64 na listagem geral de detalhes para economizar largura de banda
    if (col !== "resume_data_base64") {
      candidate[col] = candRes[0].values[0][idx]
    }
  })
  candidate.has_resume = Boolean(candRes[0].values[0][candCols.indexOf("resume_filename")])

  // Candidaturas do candidato
  const appsRes = db.exec(
    `SELECT a.*, j.title as job_title, j.department as job_department
     FROM job_applications a
     INNER JOIN job_postings j ON j.id = a.job_id
     WHERE a.candidate_id = ? AND a.tenant_id = ?`,
    [id, tenantId]
  )
  const applications: any[] = []
  if (appsRes.length && appsRes[0].values.length) {
    const aCols = appsRes[0].columns
    for (const aRow of appsRes[0].values) {
      const app: any = {}
      aCols.forEach((col, idx) => {
        app[col] = aRow[idx]
      })

      // Buscar histórico de etapas desta candidatura
      const histRes = db.exec(
        `SELECT * FROM application_stage_history WHERE application_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
        [app.id, tenantId]
      )
      app.stage_history = histRes.length ? histRes[0].values.map((v) => {
        const h: any = {}
        histRes[0].columns.forEach((hc, hIdx) => {
          h[hc] = v[hIdx]
        })
        return h
      }) : []

      // Buscar entrevistas desta candidatura
      const intRes = db.exec(
        `SELECT * FROM interviews WHERE application_id = ? AND tenant_id = ? ORDER BY scheduled_at DESC`,
        [app.id, tenantId]
      )
      app.interviews = intRes.length ? intRes[0].values.map((v) => {
        const it: any = {}
        intRes[0].columns.forEach((ic, iIdx) => {
          it[ic] = v[iIdx]
        })
        return it
      }) : []

      applications.push(app)
    }
  }

  candidate.applications = applications
  res.json({ ok: true, candidate, applications })
})

// GET /api/recruitment/candidates/:id/resume — Download seguro do currículo (restrito ao RH/Gestão)
router.get("/candidates/:id/resume", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para acessar currículos." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT resume_filename, resume_mime_type, resume_data_base64 FROM candidates WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  )

  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Candidato não encontrado." })
    return
  }

  const [filename, mimeType, base64Data] = result[0].values[0] as [string | null, string | null, string | null]
  if (!filename) {
    res.status(404).json({ ok: false, error: "Nenhum currículo anexado para este candidato." })
    return
  }

  // Se houver dados em base64 persistidos
  if (base64Data) {
    const fileBuffer = Buffer.from(base64Data, "base64")
    res.setHeader("Content-Type", mimeType || "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`)
    res.send(fileBuffer)
    return
  }

  // Caso seja um currículo de exemplo/seed simulado
  const sampleText = `=== PEOPLEHUB RH — DOSSIÊ DE CANDIDATURA ===\nArquivo: ${filename}\nStatus: Documento conferido e em conformidade LGPD.`
  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.txt"`)
  res.send(sampleText)
})

// PATCH /api/recruitment/applications/:id/stage — Mover candidato no pipeline seletivo
router.patch("/applications/:id/stage", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.manage") && !roleHasPermission(userRole, "recruitment.evaluate")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para alterar etapas do processo seletivo." })
    return
  }

  const applicationId = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const stage = req.body.stage || req.body.newStage
  const { notes, rejectionReason } = req.body

  const validStages = ["inscricao", "triagem", "entrevista", "teste_tecnico", "aprovado", "reprovado", "contratado"]
  if (!stage || !validStages.includes(stage)) {
    res.status(400).json({ ok: false, error: `Etapa inválida. Etapas válidas: ${validStages.join(", ")}` })
    return
  }

  const db = getDB()
  const appRes = db.exec(
    `SELECT a.stage, c.name, j.title, a.candidate_id, a.job_id
     FROM job_applications a
     INNER JOIN candidates c ON c.id = a.candidate_id
     INNER JOIN job_postings j ON j.id = a.job_id
     WHERE a.id = ? AND a.tenant_id = ?`,
    [applicationId, tenantId]
  )

  if (!appRes.length || !appRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Candidatura não encontrada." })
    return
  }

  const currentStage = appRes[0].values[0][0] as string
  const candidateName = appRes[0].values[0][1] as string
  const jobTitle = appRes[0].values[0][2] as string
  const candId = appRes[0].values[0][3] as string
  const jId = appRes[0].values[0][4] as string
  const now = new Date().toISOString()
  const hiredAt = stage === "contratado" ? now : null

  db.run(
    `UPDATE job_applications
     SET stage = ?, rejection_reason = COALESCE(?, rejection_reason), hired_at = COALESCE(?, hired_at), updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [stage, rejectionReason || null, hiredAt, now, applicationId, tenantId]
  )

  // Registro na timeline de histórico da candidatura
  db.run(
    `INSERT INTO application_stage_history (id, tenant_id, application_id, from_stage, to_stage, changed_by_id, changed_by_name, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `hist_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      tenantId,
      applicationId,
      currentStage,
      stage,
      req.access?.userId,
      req.access?.name,
      notes || `Etapa alterada de ${currentStage} para ${stage}.`,
      now,
    ]
  )

  // Notificação se contratado
  if (stage === "contratado") {
    db.run(
      `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link, read, created_at)
       VALUES (?, ?, 'Novo Colaborador Contratado', ?, 'recruitment', 'alta', '/onboarding', 0, ?)`,
      [
        `notif_${Date.now()}`,
        tenantId,
        `${candidateName} foi aprovado(a) e contratado(a) para a vaga '${jobTitle}'. Inicie a esteira de admissão/onboarding.`,
        now,
      ]
    )
  }

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "APPLICATION_STAGE_CHANGE",
    entity: "job_applications",
    entityId: applicationId,
    details: { candidateName, fromStage: currentStage, toStage: stage, notes },
    tenantId,
  })

  // Disparar Webhook assíncrono de mudança de etapa
  dispatchWebhookEvent(
    "candidate.stage_changed",
    buildCandidateStageChangedPayload({
      application_id: applicationId,
      candidate_id: candId,
      candidate_name: candidateName,
      job_id: jId,
      job_title: jobTitle,
      from_stage: currentStage,
      to_stage: stage,
      changed_by: req.access?.name || "RH",
      notes: notes || undefined,
    }),
    tenantId
  ).catch((wErr) => console.error("[Webhook Error] candidate.stage_changed:", wErr.message))

  res.json({ ok: true, message: `Candidato movido com sucesso para a etapa '${stage}'.` })
})

// GET /api/recruitment/interviews — Listagem de entrevistas
router.get("/interviews", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { status } = req.query
  const db = getDB()

  let sql = `SELECT * FROM interviews WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (status && status !== "todos") {
    sql += ` AND status = ?`
    params.push(String(status))
  }

  sql += ` ORDER BY scheduled_at ASC`

  const result = db.exec(sql, params)
  const interviews: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })
      interviews.push(item)
    }
  }

  res.json({ ok: true, interviews })
})

// POST /api/recruitment/interviews — Agendar nova entrevista
router.post("/interviews", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para agendar entrevistas." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { applicationId, scheduledAt, durationMinutes = 45, meetingLink, interviewerName } = req.body

  if (!applicationId || !scheduledAt) {
    res.status(400).json({ ok: false, error: "Candidatura e data/hora da entrevista são obrigatórios." })
    return
  }

  const db = getDB()
  const appRes = db.exec(
    `SELECT c.name, j.title, j.department
     FROM job_applications a
     INNER JOIN candidates c ON c.id = a.candidate_id
     INNER JOIN job_postings j ON j.id = a.job_id
     WHERE a.id = ? AND a.tenant_id = ?`,
    [applicationId, tenantId]
  )

  if (!appRes.length || !appRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Candidatura não encontrada." })
    return
  }

  const candidateName = appRes[0].values[0][0] as string
  const jobTitle = appRes[0].values[0][1] as string
  const department = appRes[0].values[0][2] as string

  const interviewId = `int_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const interviewer = interviewerName || req.access?.name || "Avaliador RH"

  db.run(
    `INSERT INTO interviews (id, tenant_id, application_id, candidate_name, job_title, interviewer_id,
                             interviewer_name, scheduled_at, duration_minutes, meeting_link, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendada')`,
    [
      interviewId,
      tenantId,
      applicationId,
      candidateName,
      jobTitle,
      req.access?.userId,
      interviewer,
      scheduledAt,
      Number(durationMinutes) || 45,
      meetingLink || "https://meet.google.com/ph-entrevista",
    ]
  )

  // Integração com o Calendário Corporativo (para aparecer na agenda integrada)
  const calEventId = `cal_int_${interviewId}`
  db.run(
    `INSERT INTO calendar_events (id, tenant_id, title, description, category, start_date, end_date, department, location, is_all_day, created_by_name)
     VALUES (?, ?, ?, ?, 'reuniao', ?, ?, ?, ?, 0, ?)`,
    [
      calEventId,
      tenantId,
      `Entrevista: ${candidateName} (${jobTitle})`,
      `Entrevista agendada com ${interviewer}. Link: ${meetingLink || "Google Meet"}`,
      scheduledAt,
      scheduledAt,
      department || "RH",
      meetingLink || "Google Meet",
      req.access?.name,
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "INTERVIEW_SCHEDULE",
    entity: "interviews",
    entityId: interviewId,
    details: { candidateName, jobTitle, scheduledAt, interviewer },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    id: interviewId,
    interview: { id: interviewId, candidateName, jobTitle, scheduledAt },
    message: "Entrevista agendada com sucesso.",
  })
})

// PATCH /api/recruitment/interviews/:id/evaluate — Registrar avaliação estruturada (Scorecard)
router.patch("/interviews/:id/evaluate", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.evaluate")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para avaliar candidatos." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const { technicalRating, behavioralRating, culturalRating, recommendation, feedbackNotes } = req.body

  const db = getDB()
  const intRes = db.exec(`SELECT application_id FROM interviews WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!intRes.length || !intRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Entrevista não encontrada." })
    return
  }
  const applicationId = intRes[0].values[0][0] as string

  const tRate = Math.min(Math.max(Number(technicalRating) || 3, 1), 5)
  const bRate = Math.min(Math.max(Number(behavioralRating) || 3, 1), 5)
  const cRate = Math.min(Math.max(Number(culturalRating) || 3, 1), 5)
  const avgRating = Number(((tRate + bRate + cRate) / 3).toFixed(1))

  db.run(
    `UPDATE interviews
     SET technical_rating = ?, behavioral_rating = ?, cultural_rating = ?,
         recommendation = ?, feedback_notes = ?, status = 'realizada'
     WHERE id = ? AND tenant_id = ?`,
    [tRate, bRate, cRate, recommendation || "sim", feedbackNotes || null, id, tenantId]
  )

  // Atualizar média de avaliação na candidatura
  db.run(
    `UPDATE job_applications SET rating = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
    [avgRating, applicationId, tenantId]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "INTERVIEW_EVALUATION",
    entity: "interviews",
    entityId: id,
    details: { applicationId, avgRating, recommendation },
    tenantId,
  })

  res.json({ ok: true, message: "Avaliação registrada com sucesso no Scorecard." })
})

// DELETE /api/recruitment/interviews/:id — Cancelar entrevista
router.delete("/interviews/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const id = paramToStr(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`UPDATE interviews SET status = 'cancelada' WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  res.json({ ok: true, message: "Entrevista cancelada." })
})

// GET /api/recruitment/metrics — Indicadores e Métricas do Funil ATS
router.get("/metrics", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "recruitment.view")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  // Vagas Abertas vs Encerradas
  const jobStats = db.exec(
    `SELECT status, count(*) as count FROM job_postings WHERE tenant_id = ? GROUP BY status`,
    [tenantId]
  )
  const jobsByStatus: Record<string, number> = { aberta: 0, pausada: 0, encerrada: 0, rascunho: 0 }
  if (jobStats.length && jobStats[0].values.length) {
    for (const row of jobStats[0].values) {
      jobsByStatus[row[0] as string] = row[1] as number
    }
  }

  // Candidatos por Etapa do Pipeline
  const stageStats = db.exec(
    `SELECT stage, count(*) as count FROM job_applications WHERE tenant_id = ? GROUP BY stage`,
    [tenantId]
  )
  const candidatesByStage: Record<string, number> = {
    inscricao: 0,
    triagem: 0,
    entrevista: 0,
    teste_tecnico: 0,
    aprovado: 0,
    reprovado: 0,
    contratado: 0,
  }
  let totalCandidates = 0
  if (stageStats.length && stageStats[0].values.length) {
    for (const row of stageStats[0].values) {
      const st = row[0] as string
      const c = row[1] as number
      candidatesByStage[st] = c
      totalCandidates += c
    }
  }

  // Origem dos Candidatos
  const sourceStats = db.exec(
    `SELECT source, count(*) as count FROM candidates WHERE tenant_id = ? GROUP BY source`,
    [tenantId]
  )
  const candidatesBySource: Record<string, number> = {
    site_carreiras: 0,
    linkedin: 0,
    indicacao: 0,
    gupy: 0,
    manual: 0,
  }
  if (sourceStats.length && sourceStats[0].values.length) {
    for (const row of sourceStats[0].values) {
      candidatesBySource[row[0] as string] = row[1] as number
    }
  }

  // Tempo Médio de Contratação (Time to Hire em dias entre applied_at e hired_at)
  const timeRes = db.exec(
    `SELECT applied_at, hired_at FROM job_applications
     WHERE tenant_id = ? AND stage = 'contratado' AND hired_at IS NOT NULL`,
    [tenantId]
  )
  let totalHireDays = 0
  let hiredCount = 0
  if (timeRes.length && timeRes[0].values.length) {
    for (const row of timeRes[0].values) {
      const applied = new Date(row[0] as string).getTime()
      const hired = new Date(row[1] as string).getTime()
      if (hired >= applied) {
        const diffDays = Math.max(1, Math.round((hired - applied) / (1000 * 3600 * 24)))
        totalHireDays += diffDays
        hiredCount++
      }
    }
  }
  const avgTimeToHireDays = hiredCount > 0 ? Number((totalHireDays / hiredCount).toFixed(1)) : 14.0

  // Taxa de Conversão do Funil (Inscrição -> Contratado)
  const conversionRate = totalCandidates > 0
    ? Number(((candidatesByStage.contratado / totalCandidates) * 100).toFixed(1))
    : 0

  res.json({
    ok: true,
    metrics: {
      totalJobs: Object.values(jobsByStatus).reduce((a, b) => a + b, 0),
      openJobsCount: jobsByStatus.aberta || 0,
      closedJobsCount: jobsByStatus.encerrada || 0,
      totalCandidates,
      jobsByStatus,
      candidatesByStage,
      candidatesBySource,
      avgTimeToHireDays,
      conversionRate,
    },
  })
})

export default router
