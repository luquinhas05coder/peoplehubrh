/**
 * integrations/webhooks/worker.ts — Worker e Fila de Entrega de Webhooks
 *
 * Implementa tentativas com backoff exponencial, timeout estrito, registro de latência,
 * reenvio manual para administradores e prevenção de falhas em cascata.
 */

import { getDB, persist } from "../../db/index.js"
import { safeFetch } from "../security/ssrf.js"
import { computeWebhookSignature, formatSignatureHeader } from "../security/hmac.js"

const BACKOFF_STEPS_SECONDS = [15, 60, 240, 900, 3600]

/**
 * Processa uma entrega individual de webhook
 */
export async function processDelivery(deliveryId: string): Promise<boolean> {
  const db = getDB()

  // Buscar dados da entrega e da inscrição vinculada
  const res = db.exec(
    `SELECT d.id, d.tenant_id, d.subscription_id, d.event_id, d.event_type, d.payload_json,
            d.attempt_count, d.max_attempts, d.status, s.url, s.secret, s.is_active
     FROM webhook_deliveries d
     INNER JOIN webhook_subscriptions s ON s.id = d.subscription_id
     WHERE d.id = ?`,
    [deliveryId]
  )

  if (!res.length || !res[0].values.length) {
    console.warn(`[Webhook Worker] Entrega ${deliveryId} ou inscrição não encontrada.`)
    return false
  }

  const cols = res[0].columns
  const row = res[0].values[0]
  const data: Record<string, any> = {}
  cols.forEach((c, idx) => {
    data[c] = row[idx]
  })

  // Se a inscrição estiver inativa ou entrega já concluída
  if (!data.is_active) {
    db.run(
      `UPDATE webhook_deliveries 
       SET status = 'failed', last_error = 'Inscrição de webhook inativa.' 
       WHERE id = ?`,
      [deliveryId]
    )
    persist()
    return false
  }

  if (data.status === "delivered") {
    return true
  }

  const payloadString = data.payload_json || "{}"
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = computeWebhookSignature(payloadString, data.secret, timestamp)
  const signatureHeader = formatSignatureHeader(signature, timestamp)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "PeopleHubRH-Webhook/1.0",
    "X-PeopleHub-Signature": signatureHeader,
    "X-PeopleHub-Event-Id": data.event_id,
    "X-PeopleHub-Event-Type": data.event_type,
    "X-PeopleHub-Delivery-Id": deliveryId,
  }

  const startTime = Date.now()
  let responseCode: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null
  let isSuccess = false

  try {
    const isTestEnv = process.env.NODE_ENV === "test"
    const response = await safeFetch(data.url, {
      method: "POST",
      headers,
      body: payloadString,
      timeoutMs: 8000,
      ssrfOptions: {
        allowLocalhost: isTestEnv,
      },
    })

    responseCode = response.status
    const text = await response.text()
    responseBody = text.slice(0, 1000) // Truncado para não onerar o banco

    if (response.ok) {
      isSuccess = true
    } else {
      errorMessage = `Servidor de destino retornou HTTP ${response.status}: ${response.statusText}`
    }
  } catch (err: any) {
    errorMessage = err.name === "AbortError" ? "Timeout: Endpoint não respondeu em 8 segundos." : err.message
  }

  const executionTimeMs = Date.now() - startTime
  const now = new Date().toISOString()
  const nextAttemptCount = (data.attempt_count || 0) + 1
  const maxAttempts = data.max_attempts || 3

  if (isSuccess) {
    db.run(
      `UPDATE webhook_deliveries SET
        status = 'delivered',
        attempt_count = ?,
        response_code = ?,
        response_body = ?,
        execution_time_ms = ?,
        last_error = NULL,
        delivered_at = ?
       WHERE id = ?`,
      [nextAttemptCount, responseCode, responseBody, executionTimeMs, now, deliveryId]
    )
    persist()
    return true
  } else {
    // Falha na entrega
    const hasMoreAttempts = nextAttemptCount < maxAttempts
    const nextStatus = hasMoreAttempts ? "pending" : "failed"

    let nextAttemptAt = now
    if (hasMoreAttempts) {
      const stepIdx = Math.min(nextAttemptCount - 1, BACKOFF_STEPS_SECONDS.length - 1)
      const delaySeconds = BACKOFF_STEPS_SECONDS[stepIdx]
      nextAttemptAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
    }

    db.run(
      `UPDATE webhook_deliveries SET
        status = ?,
        attempt_count = ?,
        response_code = ?,
        response_body = ?,
        execution_time_ms = ?,
        last_error = ?,
        next_attempt_at = ?
       WHERE id = ?`,
      [
        nextStatus,
        nextAttemptCount,
        responseCode,
        responseBody,
        executionTimeMs,
        errorMessage ? errorMessage.slice(0, 500) : "Erro desconhecido",
        nextAttemptAt,
        deliveryId,
      ]
    )
    persist()
    return false
  }
}

/**
 * Reenvia manualmente um webhook (restrito a administradores)
 */
export async function redeliverWebhook(
  deliveryId: string,
  tenantId: string
): Promise<{ ok: boolean; message: string; delivery?: any }> {
  const db = getDB()

  const res = db.exec(`SELECT * FROM webhook_deliveries WHERE id = ? AND tenant_id = ?`, [
    deliveryId,
    tenantId,
  ])

  if (!res.length || !res[0].values.length) {
    return { ok: false, message: "Registro de entrega não encontrado." }
  }

  // Resetar status e incrementar limite se já estiver esgotado
  db.run(
    `UPDATE webhook_deliveries 
     SET status = 'pending', max_attempts = max_attempts + 1, next_attempt_at = datetime('now')
     WHERE id = ? AND tenant_id = ?`,
    [deliveryId, tenantId]
  )
  persist()

  // Executar imediatamente
  const success = await processDelivery(deliveryId)

  // Consultar estado atualizado
  const updatedRes = db.exec(`SELECT * FROM webhook_deliveries WHERE id = ?`, [deliveryId])
  let updatedDelivery: any = null
  if (updatedRes.length && updatedRes[0].values.length) {
    const cols = updatedRes[0].columns
    updatedDelivery = {}
    updatedRes[0].values[0].forEach((v, i) => {
      updatedDelivery[cols[i]] = v
    })
  }

  return {
    ok: success,
    message: success
      ? "Reenvio de webhook efetuado com sucesso."
      : "Tentativa de reenvio executada, mas o destino retornou erro ou timeout.",
    delivery: updatedDelivery,
  }
}
