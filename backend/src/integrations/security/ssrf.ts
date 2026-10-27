/**
 * integrations/security/ssrf.ts — Proteção Avançada contra SSRF (Server-Side Request Forgery)
 *
 * Bloqueia destinos em loopback, redes privadas (RFC 1918), link-local (metadados de nuvem),
 * portas não-web, resolução DNS manipulada e redirecionamentos para redes restritas.
 */

import dns from "dns"
import net from "net"

export interface SsrfValidationResult {
  valid: boolean
  error?: string
  normalizedUrl?: string
  resolvedIps?: string[]
}

export interface SsrfOptions {
  allowLocalhost?: boolean // Apenas ativado em ambiente de teste automatizado local
  allowedProtocols?: string[]
  allowedPorts?: number[]
}

const BLOCKED_PORTS = new Set([
  21, 22, 23, 25, 53, 69, 110, 111, 135, 137, 138, 139, 143, 445, 1433, 1521, 2049,
  3306, 5432, 6379, 8086, 9200, 11211, 27017, 28017,
])

/**
 * Verifica se um endereço IPv4 está dentro de intervalos reservados/privados
 */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true
  }

  const [p0, p1] = parts

  // 0.0.0.0/8 (Endereço "este" hospedeiro)
  if (p0 === 0) return true

  // 10.0.0.0/8 (Rede privada RFC 1918)
  if (p0 === 10) return true

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true

  // 169.254.0.0/16 (Link-local / AWS, GCP, Azure Metadata)
  if (p0 === 169 && p1 === 254) return true

  // 172.16.0.0/12 (Rede privada RFC 1918: 172.16.0.0 a 172.31.255.255)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true

  // 192.168.0.0/16 (Rede privada RFC 1918)
  if (p0 === 192 && p1 === 168) return true

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (p0 === 192 && p1 === 0 && parts[2] === 0) return true

  // 192.0.2.0/24 (TEST-NET-1)
  if (p0 === 192 && p1 === 0 && parts[2] === 2) return true

  // 198.51.100.0/24 (TEST-NET-2)
  if (p0 === 198 && p1 === 51 && parts[2] === 100) return true

  // 203.0.113.0/24 (TEST-NET-3)
  if (p0 === 203 && p1 === 0 && parts[2] === 113) return true

  // 224.0.0.0/4 (Multicast)
  if (p0 >= 224 && p0 <= 239) return true

  // 240.0.0.0/4 (Reservado para uso futuro / broadcast)
  if (p0 >= 240) return true

  return false
}

/**
 * Verifica se um endereço IPv6 está em intervalos reservados/privados
 */
function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim()

  // Loopback ::1
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true

  // Unspecified ::
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true

  // IPv4-mapped IPv6 (ex: ::ffff:192.168.1.1 ou ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:") || normalized.startsWith("0:0:0:0:0:ffff:")) {
    const rawIpv4 = normalized.split(":").pop() || ""
    if (net.isIPv4(rawIpv4)) {
      return isPrivateOrReservedIPv4(rawIpv4)
    }
    return true
  }

  // Link-local (fe80::/10)
  if (/^fe[89ab]/i.test(normalized)) return true

  // Unique Local Address ULA (fc00::/7: fc00:: a fdff::)
  if (/^f[cd]/i.test(normalized)) return true

  // Multicast (ff00::/8)
  if (normalized.startsWith("ff")) return true

  // Discard Prefix (100::/64)
  if (normalized.startsWith("100:")) return true

  return false
}

/**
 * Validação rigorosa de URL e resolução DNS contra SSRF
 */
export async function validateSsrfUrl(
  inputUrl: string,
  options: SsrfOptions = {}
): Promise<SsrfValidationResult> {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { valid: false, error: "URL inválida ou não informada." }
  }

  let parsed: URL
  try {
    parsed = new URL(inputUrl.trim())
  } catch (_e) {
    return { valid: false, error: "Formato de URL inválido." }
  }

  // 1. Validação de Protocolo
  const protocol = parsed.protocol.toLowerCase()
  const allowedProtocols = options.allowedProtocols || (process.env.NODE_ENV === "test" ? ["https:", "http:"] : ["https:"])
  if (!allowedProtocols.includes(protocol)) {
    return {
      valid: false,
      error: `Protocolo '${protocol}' não permitido. Utilize HTTPS seguro.`,
    }
  }

  // 2. Validação de Porta
  const defaultPort = protocol === "https:" ? 443 : 80
  const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort

  if (isNaN(port) || port < 1 || port > 65535) {
    return { valid: false, error: "Porta de destino inválida." }
  }

  if (BLOCKED_PORTS.has(port)) {
    return {
      valid: false,
      error: `Porta ${port} bloqueada por política de segurança de rede.`,
    }
  }

  if (options.allowedPorts && !options.allowedPorts.includes(port)) {
    return {
      valid: false,
      error: `Porta ${port} não autorizada para conexões de webhook.`,
    }
  }

  const hostname = parsed.hostname.toLowerCase().trim()

  // 3. Validação de Nomes de Host Proibidos
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".onion")
  ) {
    if (!options.allowLocalhost) {
      return {
        valid: false,
        error: `Destino '${hostname}' é restrito ao ambiente interno e não pode ser configurado.`,
      }
    }
  }

  // 4. Resolução DNS e Inspecção de IPs Resolvidos
  const resolvedIps: string[] = []

  if (net.isIP(hostname)) {
    // Hostname já é um IP literal
    resolvedIps.push(hostname)
  } else {
    try {
      const records = await dns.promises.lookup(hostname, { all: true })
      if (!records || !records.length) {
        return { valid: false, error: `Não foi possível resolver o endereço do host '${hostname}'.` }
      }
      for (const rec of records) {
        resolvedIps.push(rec.address)
      }
    } catch (dnsErr: any) {
      return {
        valid: false,
        error: `Falha na resolução de DNS para '${hostname}': ${dnsErr.message}`,
      }
    }
  }

  // Inspecionar todos os endereços IP resolvidos
  for (const ip of resolvedIps) {
    if (net.isIPv4(ip)) {
      if (isPrivateOrReservedIPv4(ip)) {
        if (!options.allowLocalhost || !ip.startsWith("127.")) {
          return {
            valid: false,
            error: `O endereço resolvido (${ip}) pertence a uma faixa privada, reservada ou interna. Acesso bloqueado por proteção SSRF.`,
            resolvedIps,
          }
        }
      }
    } else if (net.isIPv6(ip)) {
      if (isPrivateOrReservedIPv6(ip)) {
        if (!options.allowLocalhost || ip !== "::1") {
          return {
            valid: false,
            error: `O endereço IPv6 resolvido (${ip}) pertence a uma faixa privada ou loopback. Acesso bloqueado por proteção SSRF.`,
            resolvedIps,
          }
        }
      }
    } else {
      return { valid: false, error: `Endereço IP não reconhecido: ${ip}` }
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    resolvedIps,
  }
}

/**
 * Cliente HTTP seguro que previne SSRF, bloqueia redirecionamentos para redes internas
 * e aplica timeout estrito por requisição.
 */
export async function safeFetch(
  targetUrl: string,
  options: RequestInit & {
    timeoutMs?: number
    ssrfOptions?: SsrfOptions
    maxRedirects?: number
  } = {}
): Promise<Response> {
  const { timeoutMs = 8000, ssrfOptions = {}, maxRedirects = 3, ...fetchOptions } = options

  let currentUrl = targetUrl
  let redirectsCount = 0

  while (true) {
    // Validar destino atual antes de cada salto
    const validation = await validateSsrfUrl(currentUrl, ssrfOptions)
    if (!validation.valid) {
      throw new Error(`SSRF Blocked: ${validation.error}`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(currentUrl, {
        ...fetchOptions,
        redirect: "manual", // Intercepta redirects para validação obrigatória
        signal: controller.signal,
      })

      // Se for redirecionamento (301, 302, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirectsCount++
        if (redirectsCount > maxRedirects) {
          throw new Error(`Excedido o limite máximo de ${maxRedirects} redirecionamentos.`)
        }

        const locationHeader = response.headers.get("Location")
        if (!locationHeader) {
          throw new Error("Resposta de redirecionamento sem cabeçalho 'Location'.")
        }

        // Resolver URL relativa ou absoluta do redirecionamento
        const nextUrl = new URL(locationHeader, currentUrl).toString()

        // Loop continua para validar e efetuar requisição ao novo destino
        currentUrl = nextUrl
        continue
      }

      return response
    } finally {
      clearTimeout(timeout)
    }
  }
}
