/**
 * integrations/security/sanitizer.ts — Sanitização de Payloads de Webhooks
 *
 * Garante que nenhum dado sensível (senhas, hashes, tokens de sessão, códigos 2FA)
 * ou dado confidencial desnecessário seja transmitido nos eventos.
 */

const FORBIDDEN_KEYS = new Set([
  "password",
  "initialpassword",
  "hash",
  "password_hash",
  "token",
  "jwt",
  "session",
  "cookie",
  "mfa_code",
  "mfacode",
  "secret",
  "otp",
  "resume_data_base64",
  "attachment_base64",
  "file_base64",
])

/**
 * Sanitiza recursivamente objetos e coleções removendo chaves sensíveis
 */
export function sanitizePayload<T = any>(data: T): T {
  if (data === null || data === undefined) return data

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item)) as unknown as T
  }

  if (typeof data === "object") {
    const sanitized: Record<string, any> = {}

    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      const lowerKey = key.toLowerCase()

      // Pula campos explicitamente proibidos
      if (FORBIDDEN_KEYS.has(lowerKey)) {
        continue
      }

      // Mascara CPF se presente
      if (lowerKey === "cpf" && typeof val === "string" && val.length >= 6) {
        sanitized[key] = val.substring(0, 3) + ".***.***-**"
        continue
      }

      sanitized[key] = sanitizePayload(val)
    }

    return sanitized as T
  }

  return data
}

/**
 * Monta o payload mínimo para evento employee.created
 */
export function buildEmployeeCreatedPayload(emp: {
  id: string
  name: string
  role: string
  department: string
  email: string
  hireDate?: string
  status?: string
  contractType?: string
  workSchedule?: string
}) {
  return sanitizePayload({
    employee_id: emp.id,
    name: emp.name,
    role: emp.role,
    department: emp.department,
    email: emp.email,
    hire_date: emp.hireDate || new Date().toISOString().split("T")[0],
    status: emp.status || "Ativo",
    contract_type: emp.contractType || "prazo_indeterminado",
    work_schedule: emp.workSchedule || "escala_5x2",
  })
}

/**
 * Monta o payload mínimo para evento request.approved
 */
export function buildRequestApprovedPayload(req: {
  id: string
  type: string
  requester: string
  department: string
  priority?: string
  description?: string
  reviewed_by?: string
  reviewed_at?: string
}) {
  return sanitizePayload({
    request_id: req.id,
    type: req.type,
    requester: req.requester,
    department: req.department,
    priority: req.priority || "media",
    description: req.description || "",
    status: "Aprovado",
    reviewed_by: req.reviewed_by || "RH",
    reviewed_at: req.reviewed_at || new Date().toISOString(),
  })
}

/**
 * Monta o payload mínimo para evento job.published
 */
export function buildJobPublishedPayload(job: {
  id: string
  title: string
  department: string
  role?: string
  work_model?: string
  contract_type?: string
  location?: string
  positions_count?: number
  is_public?: boolean | number
  published_at?: string
}) {
  return sanitizePayload({
    job_id: job.id,
    title: job.title,
    department: job.department,
    role: job.role || job.title,
    work_model: job.work_model || "hibrido",
    contract_type: job.contract_type || "CLT",
    location: job.location || "São Paulo, SP",
    positions_count: job.positions_count || 1,
    is_public: Boolean(job.is_public),
    published_at: job.published_at || new Date().toISOString(),
  })
}

/**
 * Monta o payload mínimo para evento candidate.stage_changed
 */
export function buildCandidateStageChangedPayload(data: {
  application_id: string
  candidate_id?: string
  candidate_name: string
  job_id: string
  job_title: string
  from_stage: string
  to_stage: string
  changed_by?: string
  notes?: string
}) {
  return sanitizePayload({
    application_id: data.application_id,
    candidate_id: data.candidate_id || "",
    candidate_name: data.candidate_name,
    job_id: data.job_id,
    job_title: data.job_title,
    from_stage: data.from_stage,
    to_stage: data.to_stage,
    changed_by: data.changed_by || "RH",
    notes: data.notes || null,
    changed_at: new Date().toISOString(),
  })
}
