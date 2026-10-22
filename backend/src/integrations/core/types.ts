/**
 * integrations/core/types.ts — Tipos e interfaces comuns da camada de integrações
 */

export type WebhookEventType =
  | "employee.created"
  | "request.approved"
  | "job.published"
  | "candidate.stage_changed"
  | "ping.test"

export interface WebhookEvent<T = Record<string, any>> {
  id: string
  type: WebhookEventType
  occurred_at: string
  tenant_id: string
  payload: T
}

export interface WebhookSubscription {
  id: string
  tenant_id: string
  name: string
  url: string
  secret: string
  events: WebhookEventType[]
  is_active: boolean
  created_by_id?: string
  created_by_name?: string
  created_at: string
  updated_at: string
}

export type DeliveryStatus = "pending" | "delivered" | "failed"

export interface WebhookDelivery {
  id: string
  tenant_id: string
  subscription_id: string
  event_id: string
  event_type: WebhookEventType
  payload: Record<string, any>
  attempt_count: number
  max_attempts: number
  next_attempt_at: string
  status: DeliveryStatus
  response_code?: number | null
  response_body?: string | null
  execution_time_ms?: number | null
  last_error?: string | null
  created_at: string
  delivered_at?: string | null
}

export interface IntegrationConnectionResult {
  ok: boolean
  message: string
  latency_ms?: number
  details?: Record<string, any>
}

export interface IntegrationAdapter<TConfig = any, TInput = any, TOutput = any> {
  id: string
  name: string
  description: string
  version: string
  category: "cbo" | "export_import" | "communication" | "custom"
  testConnection(config?: TConfig): Promise<IntegrationConnectionResult>
  execute(input: TInput, config?: TConfig): Promise<TOutput>
}
