/**
 * routes/webhooks.routes.ts — Gestão de Webhooks de Saída com RBAC e Proteção SSRF
 */

import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, requireRole, recordAuditLog } from "../middleware/rbac.js"
import { validateSsrfUrl } from "../integrations/security/ssrf.js"
import { generateWebhookSecret, maskWebhookSecret } from "../integrations/security/hmac.js"
import { dispatchWebhookEvent } from "../integrations/webhooks/dispatcher.js"
import { redeliverWebhook, processDelivery } from "../integrations/webhooks/worker.js"
import type { WebhookEventType } from "../integrations/core/types.js"

const router = Router()

// Proteger todas as rotas de webhooks com resolução de tenant, autenticação e RBAC restrito a ADMIN
router.use(resolveTenant)
router.use(authenticateRBAC)
router.use(requireRole(["ADMIN"]))

const SUPPORTED_EVENTS: Array<{ type: WebhookEventType; description: string; samplePayload: Record<string, any> }> = [
  {
    type: "employee.created",
    description: "Disparado quando um novo colaborador é admitido/cadastrado no sistema.",
    samplePayload: {
      employee_id: "emp_1729600000000",
      name: "Gabriel Santos",
      role: "Desenvolvedor Full-Stack",
      department: "Tecnologia",
      email: "gabriel.santos@peoplehub.com.br",
      hire_date: "2026-10-22",
      status: "Ativo",
      contract_type: "prazo_indeterminado",
      work_schedule: "escala_5x2",
    },
  },
  {
    type: "request.approved",
    description: "Disparado quando uma solicitação funcional (férias, alteração cadastral, etc.) é aprovada.",
    samplePayload: {
      request_id: "REQ-101",
      type: "Férias",
      requester: "Gabriel Santos",
      department: "Tecnologia",
      priority: "alta",
      status: "Aprovado",
      reviewed_by: "Mariana Alcantara",
      reviewed_at: "2026-10-22T19:30:00.000Z",
    },
  },
  {
    type: "job.published",
    description: "Disparado quando uma vaga de recrutamento é publicada no portal ATS.",
    samplePayload: {
      job_id: "job_1729600000_abc1",
      title: "Engenheiro de Software Sênior",
      department: "Tecnologia",
      work_model: "hibrido",
      contract_type: "CLT",
      positions_count: 2,
      is_public: true,
      published_at: "2026-10-22T19:30:00.000Z",
    },
  },
  {
    type: "candidate.stage_changed",
    description: "Disparado quando um candidato avança de etapa no funil seletivo (entrevista, aprovado, etc.).",
    samplePayload: {
      application_id: "app_1729600000_xyz2",
      candidate_id: "cand_1729600000_dg62",
      candidate_name: "Larissa Menezes",
      job_id: "job_1729600000_abc1",
      job_title: "Engenheiro de Software Sênior",
      from_stage: "triagem",
      to_stage: "entrevista",
      changed_by: "Mariana Alcantara",
      changed_at: "2026-10-22T19:30:00.000Z",
    },
  },
  {
    type: "ping.test",
    description: "Evento sintético para validação de conectividade e integridade HMAC do endpoint.",
    samplePayload: {
      message: "Webhook de teste disparado com sucesso pelo PeopleHubRH.",
      timestamp: 1729600000,
    },
  },
]

// GET /api/webhooks/events/types — Catálogo de eventos suportados
router.get("/events/types", (_req: Request, res: Response) => {
  res.json({ ok: true, events: SUPPORTED_EVENTS })
})

// GET /api/webhooks/subscriptions — Listar endpoints cadastrados
router.get("/subscriptions", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, tenant_id, name, url, secret, events_json, is_active, created_by_name, created_at, updated_at
     FROM webhook_subscriptions
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId]
  )

  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, subscriptions: [] })
    return
  }

  const cols = result[0].columns
  const subscriptions = result[0].values.map((row) => {
    const item: Record<string, any> = {}
    cols.forEach((col, idx) => {
      item[col] = row[idx]
    })

    try {
      item.events = JSON.parse(item.events_json || "[]")
    } catch {
      item.events = []
    }
    delete item.events_json

    // Mascarar o segredo
    item.masked_secret = maskWebhookSecret(item.secret)
    delete item.secret

    item.is_active = Boolean(item.is_active)
    return item
  })

  res.json({ ok: true, subscriptions })
})

// POST /api/webhooks/subscriptions — Criar novo endpoint com validação SSRF
router.post("/subscriptions", async (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { name, url, events, is_active = true } = req.body

  if (!name || !url) {
    res.status(400).json({ ok: false, error: "Nome descritivo e URL do endpoint são obrigatórios." })
    return
  }

  // Validação SSRF rigorosa
  const isTest = process.env.NODE_ENV === "test"
  const ssrfCheck = await validateSsrfUrl(url, { allowLocalhost: isTest })
  if (!ssrfCheck.valid) {
    res.status(400).json({
      ok: false,
      error: `Endpoint rejeitado por política de segurança SSRF: ${ssrfCheck.error}`,
      resolvedIps: ssrfCheck.resolvedIps,
    })
    return
  }

  const normalizedUrl = ssrfCheck.normalizedUrl || url.trim()
  const secret = generateWebhookSecret()
  const id = `wh_sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const now = new Date().toISOString()
  const eventsArray = Array.isArray(events) && events.length > 0 ? events : ["*"]

  const db = getDB()
  db.run(
    `INSERT INTO webhook_subscriptions (
      id, tenant_id, name, url, secret, events_json, is_active, created_by_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      name.trim(),
      normalizedUrl,
      secret,
      JSON.stringify(eventsArray),
      is_active ? 1 : 0,
      req.access?.userId || null,
      req.access?.name || "Administrador",
      now,
      now,
    ]
  )
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "WEBHOOK_SUBSCRIPTION_CREATE",
    entity: "webhook_subscriptions",
    entityId: id,
    details: { name, url: normalizedUrl, events: eventsArray },
    tenantId,
  })

  res.status(201).json({
    ok: true,
    message: "Endpoint de webhook registrado com sucesso.",
    subscription: {
      id,
      name: name.trim(),
      url: normalizedUrl,
      secret, // Retornado apenas na criação para o administrador anotar
      masked_secret: maskWebhookSecret(secret),
      events: eventsArray,
      is_active: Boolean(is_active),
      created_at: now,
    },
  })
})

// GET /api/webhooks/subscriptions/:id — Detalhes da inscrição
router.get("/subscriptions/:id", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, tenant_id, name, url, secret, events_json, is_active, created_by_name, created_at, updated_at
     FROM webhook_subscriptions
     WHERE id = ? AND tenant_id = ?`,
    [String(id), tenantId]
  )

  if (!result.length || !result[0].values.length) {
    res.status(404).json({ ok: false, error: "Inscrição de webhook não encontrada." })
    return
  }

  const cols = result[0].columns
  const item: Record<string, any> = {}
  result[0].values[0].forEach((v, idx) => {
    item[cols[idx]] = v
  })

  try {
    item.events = JSON.parse(item.events_json || "[]")
  } catch {
    item.events = []
  }
  delete item.events_json
  item.masked_secret = maskWebhookSecret(item.secret)
  delete item.secret
  item.is_active = Boolean(item.is_active)

  res.json({ ok: true, subscription: item })
})

// PUT /api/webhooks/subscriptions/:id — Atualizar endpoint
router.put("/subscriptions/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const { name, url, events, is_active } = req.body
  const db = getDB()

  const existingRes = db.exec(`SELECT id, url FROM webhook_subscriptions WHERE id = ? AND tenant_id = ?`, [
    String(id),
    tenantId,
  ])
  if (!existingRes.length || !existingRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Inscrição de webhook não encontrada." })
    return
  }

  let finalUrl = existingRes[0].values[0][1] as string
  if (url && url !== finalUrl) {
    const isTest = process.env.NODE_ENV === "test"
    const ssrfCheck = await validateSsrfUrl(url, { allowLocalhost: isTest })
    if (!ssrfCheck.valid) {
      res.status(400).json({ ok: false, error: `Nova URL rejeitada por SSRF: ${ssrfCheck.error}` })
      return
    }
    finalUrl = ssrfCheck.normalizedUrl || url.trim()
  }

  const updates: string[] = []
  const params: any[] = []

  if (name) {
    updates.push("name = ?")
    params.push(name.trim())
  }
  if (url) {
    updates.push("url = ?")
    params.push(finalUrl)
  }
  if (events) {
    updates.push("events_json = ?")
    params.push(JSON.stringify(Array.isArray(events) ? events : [events]))
  }
  if (is_active !== undefined) {
    updates.push("is_active = ?")
    params.push(is_active ? 1 : 0)
  }

  updates.push("updated_at = datetime('now')")
  params.push(String(id), tenantId)

  db.run(`UPDATE webhook_subscriptions SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, params)
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "WEBHOOK_SUBSCRIPTION_UPDATE",
    entity: "webhook_subscriptions",
    entityId: String(id),
    details: { name, url: finalUrl, is_active },
    tenantId,
  })

  res.json({ ok: true, message: "Inscrição de webhook atualizada com sucesso." })
})

// DELETE /api/webhooks/subscriptions/:id — Excluir endpoint
router.delete("/subscriptions/:id", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM webhook_deliveries WHERE subscription_id = ? AND tenant_id = ?`, [String(id), tenantId])
  db.run(`DELETE FROM webhook_subscriptions WHERE id = ? AND tenant_id = ?`, [String(id), tenantId])
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "WEBHOOK_SUBSCRIPTION_DELETE",
    entity: "webhook_subscriptions",
    entityId: String(id),
    details: { subscriptionId: id },
    tenantId,
  })

  res.json({ ok: true, message: "Inscrição de webhook excluída com sucesso." })
})

// POST /api/webhooks/subscriptions/:id/rotate-secret — Rotação segura de segredo HMAC
router.post("/subscriptions/:id/rotate-secret", (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const check = db.exec(`SELECT id, name FROM webhook_subscriptions WHERE id = ? AND tenant_id = ?`, [
    String(id),
    tenantId,
  ])
  if (!check.length || !check[0].values.length) {
    res.status(404).json({ ok: false, error: "Inscrição de webhook não encontrada." })
    return
  }

  const subName = check[0].values[0][1] as string
  const newSecret = generateWebhookSecret()

  db.run(
    `UPDATE webhook_subscriptions 
     SET secret = ?, updated_at = datetime('now') 
     WHERE id = ? AND tenant_id = ?`,
    [newSecret, String(id), tenantId]
  )
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "WEBHOOK_SECRET_ROTATE",
    entity: "webhook_subscriptions",
    entityId: String(id),
    details: { subscriptionName: subName },
    tenantId,
  })

  res.json({
    ok: true,
    message: "Segredo de assinatura HMAC rotacionado com sucesso.",
    newSecret,
    maskedSecret: maskWebhookSecret(newSecret),
  })
})

// POST /api/webhooks/subscriptions/:id/test — Disparo de teste imediato (ping.test)
router.post("/subscriptions/:id/test", async (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const check = db.exec(
    `SELECT id, name, url, secret, is_active FROM webhook_subscriptions WHERE id = ? AND tenant_id = ?`,
    [String(id), tenantId]
  )
  if (!check.length || !check[0].values.length) {
    res.status(404).json({ ok: false, error: "Inscrição de webhook não encontrada." })
    return
  }

  const deliveryIds = await dispatchWebhookEvent(
    "ping.test",
    {
      test: true,
      sender: "PeopleHub RH Security Agent",
      triggered_by: req.access?.name || "Administrador",
      timestamp: Date.now(),
    },
    tenantId
  )

  const deliveryId = deliveryIds[0] || null
  if (!deliveryId) {
    res.status(400).json({ ok: false, error: "Inscrição inativa ou não habilitada para receber eventos de teste." })
    return
  }

  // Aguardar a execução síncrona do teste
  const success = await processDelivery(deliveryId)

  const delRes = db.exec(`SELECT * FROM webhook_deliveries WHERE id = ?`, [deliveryId])
  let deliveryResult: any = null
  if (delRes.length && delRes[0].values.length) {
    const cols = delRes[0].columns
    deliveryResult = {}
    delRes[0].values[0].forEach((v, i) => {
      deliveryResult[cols[i]] = v
    })
  }

  res.json({
    ok: success,
    deliveryId,
    message: success
      ? "Disparo de teste realizado e recebido com sucesso (HTTP 2xx)."
      : "Disparo de teste realizado, porém o destino retornou falha ou não respondeu a tempo.",
    result: deliveryResult,
  })
})

// GET /api/webhooks/deliveries — Histórico de entregas com filtros
router.get("/deliveries", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const { subscription_id, status, event_type, limit = 50 } = req.query
  const db = getDB()

  let sql = `
    SELECT d.id, d.tenant_id, d.subscription_id, s.name as subscription_name, s.url,
           d.event_id, d.event_type, d.payload_json, d.attempt_count, d.max_attempts,
           d.status, d.response_code, d.response_body, d.execution_time_ms, d.last_error,
           d.created_at, d.delivered_at
    FROM webhook_deliveries d
    LEFT JOIN webhook_subscriptions s ON s.id = d.subscription_id
    WHERE d.tenant_id = ?
  `
  const params: any[] = [tenantId]

  if (subscription_id) {
    sql += ` AND d.subscription_id = ?`
    params.push(String(subscription_id))
  }
  if (status) {
    sql += ` AND d.status = ?`
    params.push(String(status))
  }
  if (event_type) {
    sql += ` AND d.event_type = ?`
    params.push(String(event_type))
  }

  sql += ` ORDER BY d.created_at DESC LIMIT ?`
  params.push(Math.min(100, Math.max(1, Number(limit) || 50)))

  const result = db.exec(sql, params)
  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, deliveries: [] })
    return
  }

  const cols = result[0].columns
  const deliveries = result[0].values.map((row) => {
    const item: Record<string, any> = {}
    cols.forEach((c, idx) => {
      item[c] = row[idx]
    })
    try {
      item.payload = JSON.parse(item.payload_json || "{}")
    } catch {
      item.payload = {}
    }
    delete item.payload_json
    return item
  })

  res.json({ ok: true, deliveries })
})

// POST /api/webhooks/deliveries/:id/redeliver — Reenvio manual
router.post("/deliveries/:id/redeliver", async (req: Request, res: Response) => {
  const { id } = req.params
  const tenantId = req.tenantId || "tenant_default"

  const result = await redeliverWebhook(String(id), tenantId)

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole: req.access?.role,
    action: "WEBHOOK_MANUAL_REDELIVER",
    entity: "webhook_deliveries",
    entityId: String(id),
    details: { success: result.ok, message: result.message },
    tenantId,
  })

  if (!result.ok && result.message.includes("não encontrado")) {
    res.status(404).json(result)
    return
  }

  res.json(result)
})

export default router
