/**
 * integrations/security/hmac.ts — Assinatura Criptográfica HMAC SHA-256 para Webhooks
 *
 * Utiliza o padrão t=timestamp,v1=signature com verificação em tempo constante (timingSafeEqual)
 * e proteção contra ataques de repetição (replay attack).
 */

import crypto from "crypto"

/**
 * Gera um segredo criptográfico aleatório com alta entropia para webhooks
 */
export function generateWebhookSecret(): string {
  const randomBytes = crypto.randomBytes(32).toString("hex")
  return `whsec_${randomBytes}`
}

/**
 * Ofusca o segredo para visualização segura no frontend e logs
 */
export function maskWebhookSecret(secret: string): string {
  if (!secret) return ""
  if (secret.length <= 12) return "••••••••"
  const prefix = secret.startsWith("whsec_") ? "whsec_" : ""
  const suffix = secret.slice(-4)
  return `${prefix}••••••••••••${suffix}`
}

/**
 * Calcula a assinatura HMAC SHA-256 com base no payload e no timestamp
 */
export function computeWebhookSignature(
  payloadString: string,
  secret: string,
  timestamp: number
): string {
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret
  const signedPayload = `${timestamp}.${payloadString}`
  return crypto.createHmac("sha256", cleanSecret).update(signedPayload).digest("hex")
}

/**
 * Formata o cabeçalho oficial de assinatura X-PeopleHub-Signature
 */
export function formatSignatureHeader(signature: string, timestamp: number): string {
  return `t=${timestamp},v1=${signature}`
}

/**
 * Validação rigorosa da assinatura recebida com comparação em tempo constante
 */
export function verifyWebhookSignature(
  signatureHeader: string,
  payloadString: string,
  secret: string,
  toleranceSeconds = 300
): { valid: boolean; error?: string } {
  if (!signatureHeader || !payloadString || !secret) {
    return { valid: false, error: "Assinatura, payload ou segredo ausente." }
  }

  // Extrair t e v1 do formato t=timestamp,v1=signature
  const parts = signatureHeader.split(",")
  let timestamp: number | null = null
  let signature: string | null = null

  for (const part of parts) {
    const [key, value] = part.trim().split("=")
    if (key === "t" && value) {
      timestamp = parseInt(value, 10)
    } else if (key === "v1" && value) {
      signature = value.trim()
    }
  }

  if (!timestamp || isNaN(timestamp) || !signature) {
    return { valid: false, error: "Formato do cabeçalho de assinatura inválido." }
  }

  // Prevenção contra Replay Attacks
  const currentTimestamp = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTimestamp - timestamp) > toleranceSeconds) {
    return { valid: false, error: "Assinatura expirada (possível ataque de repetição)." }
  }

  const expectedSignature = computeWebhookSignature(payloadString, secret, timestamp)

  try {
    const sigBuffer = Buffer.from(signature, "hex")
    const expectedBuffer = Buffer.from(expectedSignature, "hex")

    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Tamanho de assinatura incorreto." }
    }

    const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    return { valid: matches, error: matches ? undefined : "Assinatura digital inválida." }
  } catch (err: any) {
    return { valid: false, error: `Falha na verificação criptográfica: ${err.message}` }
  }
}
