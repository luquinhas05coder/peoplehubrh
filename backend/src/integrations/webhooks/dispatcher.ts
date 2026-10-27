/**
 * integrations/webhooks/dispatcher.ts — Enfileirador e Publicador de Eventos de Webhooks
 *
 * Desacopla a emissão de eventos das operações de negócio de RH.
 * Garante idempotência, payloads mínimos e gravação no banco SQLite.
 */

import { getDB, persist } from "../../db/index.js"
import type { WebhookEventType } from "../core/types.js"
import { sanitizePayload } from "../security/sanitizer.js"

/**
 * Publica um evento assíncrono para todos os endpoints de webhook ativos inscritos
 */
export async function dispatchWebhookEvent(
  eventType: WebhookEventType,
  rawPayload: Record<string, any>,
  tenantId: string
): Promise<string[]> {
  try {
    const db = getDB()
    const sanitized = sanitizePayload(rawPayload)
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()

    // Buscar endpoints ativos para o tenant
    const subsRes = db.exec(
      `SELECT id, events_json, secret, url FROM webhook_subscriptions 
       WHERE tenant_id = ? AND is_active = 1`,
      [tenantId]
    )

    if (!subsRes.length || !subsRes[0].values.length) {
      return []
    }

    const deliveryIds: string[] = []
    const cols = subsRes[0].columns

    for (const row of subsRes[0].values) {
      const sub: Record<string, any> = {}
      cols.forEach((col, idx) => {
        sub[col] = row[idx]
      })

      // Verificar se a inscrição aceita o evento
      let subscribedEvents: string[] = []
      try {
        subscribedEvents = JSON.parse(sub.events_json || "[]")
      } catch (_e) {
        subscribedEvents = []
      }

      const isSubscribed =
        subscribedEvents.includes("*") || subscribedEvents.includes(eventType)

      if (!isSubscribed) {
        continue
      }

      const deliveryId = `wh_del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const fullEventEnvelope = {
        id: eventId,
        type: eventType,
        occurred_at: now,
        tenant_id: tenantId,
        payload: sanitized,
      }

      db.run(
        `INSERT INTO webhook_deliveries (
          id, tenant_id, subscription_id, event_id, event_type, payload_json,
          attempt_count, max_attempts, next_attempt_at, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 3, ?, 'pending', ?)`,
        [
          deliveryId,
          tenantId,
          sub.id,
          eventId,
          eventType,
          JSON.stringify(fullEventEnvelope),
          now,
          now,
        ]
      )

      deliveryIds.push(deliveryId)

      // Disparar execução assíncrona imediata sem bloquear o processo principal
      setImmediate(async () => {
        try {
          const { processDelivery } = await import("./worker.js")
          await processDelivery(deliveryId)
        } catch (err: any) {
          console.error(`[Webhook Worker] Erro ao processar entrega ${deliveryId}:`, err?.message || err)
        }
      })
    }

    if (deliveryIds.length > 0) {
      persist()
    }

    return deliveryIds
  } catch (err: any) {
    console.error("[Webhook Dispatcher] Falha ao despachar evento de webhook:", err.message)
    return []
  }
}
