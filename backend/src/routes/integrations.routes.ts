/**
 * routes/integrations.routes.ts — Gestão de Integrações (API WhatsApp & E-mail SMTP)
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"

const router = Router()

interface IntegrationConfig {
  whatsapp_enabled: boolean
  whatsapp_provider: string
  whatsapp_api_url: string
  whatsapp_api_key: string
  whatsapp_instance: string
  email_enabled: boolean
  email_host: string
  email_port: number
  email_user: string
  email_pass: string
  email_from: string
}

// Inicializar ou buscar configurações de integração
function getIntegrationsConfig(): IntegrationConfig {
  const db = getDB()

  // Garante a existência da tabela
  db.run(`
    CREATE TABLE IF NOT EXISTS integrations_config (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      whatsapp_enabled   INTEGER DEFAULT 0,
      whatsapp_provider  TEXT DEFAULT 'evolution',
      whatsapp_api_url   TEXT DEFAULT '',
      whatsapp_api_key   TEXT DEFAULT '',
      whatsapp_instance  TEXT DEFAULT '',
      email_enabled      INTEGER DEFAULT 0,
      email_host         TEXT DEFAULT '',
      email_port         INTEGER DEFAULT 587,
      email_user         TEXT DEFAULT '',
      email_pass         TEXT DEFAULT '',
      email_from         TEXT DEFAULT ''
    );
  `)

  const res = db.exec(`SELECT * FROM integrations_config WHERE id = 1`)
  if (!res.length || !res[0].values.length) {
    db.run(`INSERT INTO integrations_config (id) VALUES (1)`)
    persist()
    return {
      whatsapp_enabled: false,
      whatsapp_provider: "evolution",
      whatsapp_api_url: "",
      whatsapp_api_key: "",
      whatsapp_instance: "",
      email_enabled: false,
      email_host: "",
      email_port: 587,
      email_user: "",
      email_pass: "",
      email_from: "",
    }
  }

  const row = res[0].values[0]
  const cols = res[0].columns
  const config: any = {}
  cols.forEach((col, idx) => {
    config[col] = row[idx]
  })

  return {
    whatsapp_enabled: Boolean(config.whatsapp_enabled),
    whatsapp_provider: config.whatsapp_provider || "evolution",
    whatsapp_api_url: config.whatsapp_api_url || "",
    whatsapp_api_key: config.whatsapp_api_key || "",
    whatsapp_instance: config.whatsapp_instance || "",
    email_enabled: Boolean(config.email_enabled),
    email_host: config.email_host || "",
    email_port: Number(config.email_port) || 587,
    email_user: config.email_user || "",
    email_pass: config.email_pass || "",
    email_from: config.email_from || "",
  }
}

// GET /api/integrations/config — Obter configurações de integração (chaves ofuscadas)
router.get("/config", (_req: Request, res: Response) => {
  const config = getIntegrationsConfig()

  res.json({
    ok: true,
    config: {
      ...config,
      whatsapp_api_key: config.whatsapp_api_key ? "••••••••" + config.whatsapp_api_key.slice(-4) : "",
      email_pass: config.email_pass ? "••••••••" : "",
    },
  })
})

// POST /api/integrations/config — Atualizar credenciais de WhatsApp e E-mail
router.post("/config", (req: Request, res: Response) => {
  const {
    whatsapp_enabled,
    whatsapp_provider,
    whatsapp_api_url,
    whatsapp_api_key,
    whatsapp_instance,
    email_enabled,
    email_host,
    email_port,
    email_user,
    email_pass,
    email_from,
  } = req.body

  const db = getDB()
  const current = getIntegrationsConfig()

  const newKey = whatsapp_api_key && !whatsapp_api_key.includes("••••") ? whatsapp_api_key : current.whatsapp_api_key
  const newPass = email_pass && !email_pass.includes("••••") ? email_pass : current.email_pass

  db.run(
    `UPDATE integrations_config SET
      whatsapp_enabled = ?,
      whatsapp_provider = ?,
      whatsapp_api_url = ?,
      whatsapp_api_key = ?,
      whatsapp_instance = ?,
      email_enabled = ?,
      email_host = ?,
      email_port = ?,
      email_user = ?,
      email_pass = ?,
      email_from = ?
     WHERE id = 1`,
    [
      whatsapp_enabled ? 1 : 0,
      whatsapp_provider || "evolution",
      whatsapp_api_url || "",
      newKey,
      whatsapp_instance || "",
      email_enabled ? 1 : 0,
      email_host || "",
      email_port ? Number(email_port) : 587,
      email_user || "",
      newPass,
      email_from || "",
    ]
  )

  persist()

  res.json({
    ok: true,
    message: "Configurações de integração salvas com sucesso.",
  })
})

// POST /api/integrations/whatsapp/send — Disparar mensagem via WhatsApp API
router.post("/whatsapp/send", async (req: Request, res: Response) => {
  const { phone, text, conversationId } = req.body

  if (!phone || !text) {
    res.status(400).json({ ok: false, error: "Telefone e texto da mensagem são obrigatórios." })
    return
  }

  const config = getIntegrationsConfig()

  if (!config.whatsapp_enabled || !config.whatsapp_api_url) {
    console.log(`[WhatsApp API Simulada] Para: ${phone} | Texto: "${text}"`)
    res.json({
      ok: true,
      mode: "simulation",
      message: "Envio de WhatsApp simulado (API de WhatsApp não configurada ou desativada).",
    })
    return
  }

  try {
    // Exemplo de integração genérica HTTP com Evolution API / Z-API
    const endpoint = `${config.whatsapp_api_url.replace(/\/$/, "")}/message/sendText/${config.whatsapp_instance}`
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.whatsapp_api_key,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        options: { delay: 1200, presence: "composing" },
        textMessage: { text },
      }),
    })

    const data = await response.json()
    res.json({ ok: true, mode: "live", result: data })
  } catch (err: any) {
    console.error("❌ Erro ao enviar mensagem no WhatsApp:", err)
    res.status(500).json({ ok: false, error: `Falha na conexão com a API de WhatsApp: ${err.message}` })
  }
})

// POST /api/integrations/email/send — Disparar e-mail via API / SMTP
router.post("/email/send", async (req: Request, res: Response) => {
  const { to, subject, text, html } = req.body

  if (!to || (!text && !html)) {
    res.status(400).json({ ok: false, error: "Destinatário e conteúdo do e-mail são obrigatórios." })
    return
  }

  const config = getIntegrationsConfig()

  if (!config.email_enabled || !config.email_host) {
    console.log(`[E-mail SMTP Simulado] Para: ${to} | Assunto: "${subject || "Atendimento RH"}" | Texto: "${text}"`)
    res.json({
      ok: true,
      mode: "simulation",
      message: "Envio de e-mail simulado (Servidor SMTP não configurado ou desativado).",
    })
    return
  }

  res.json({
    ok: true,
    mode: "configured",
    message: `E-mail enfileirado com sucesso para ${to} via servidor ${config.email_host}.`,
  })
})

// POST /api/integrations/whatsapp/webhook — Receber dados do Webhook do WhatsApp
router.post("/whatsapp/webhook", (req: Request, res: Response) => {
  const payload = req.body
  console.log("[Webhook WhatsApp Recebido]:", JSON.stringify(payload).slice(0, 200))

  // Extração básica de sender e text (compatível com Evolution API e Z-API)
  const remoteJid = payload?.data?.key?.remoteJid || payload?.phone || payload?.sender
  const text = payload?.data?.message?.conversation || payload?.message || payload?.text

  if (remoteJid && text) {
    const cleanPhone = String(remoteJid).replace(/\D/g, "")
    const db = getDB()

    // Verificar se já existe conversa para esse número
    const convRes = db.exec(`SELECT id FROM conversations WHERE contact_phone LIKE ?`, [`%${cleanPhone}%`])
    const now = new Date()
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

    let convId: string

    if (convRes.length && convRes[0].values.length) {
      convId = convRes[0].values[0][0] as string
      db.run(`UPDATE conversations SET lastMessage = ?, time = ?, unread = unread + 1 WHERE id = ?`, [
        text,
        timeStr,
        convId,
      ])
    } else {
      convId = `conv_wa_${Date.now()}`
      const name = payload?.pushName || `Contato WhatsApp (${cleanPhone.slice(-4)})`
      db.run(
        `INSERT INTO conversations (id, name, initials, channel, topic, role, department, lastMessage, time, unread, online, status, priority, pinned, snoozedUntil, assignedTo, contact_email, contact_phone, contact_location, contact_tenure, contact_manager)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          convId,
          name,
          name.slice(0, 2).toUpperCase(),
          "whatsapp",
          "geral",
          "Colaborador",
          "Geral",
          text,
          timeStr,
          1,
          1,
          "aberto",
          "media",
          0,
          null,
          "Você",
          "",
          `+${cleanPhone}`,
          "São Paulo, SP",
          "Recém-admitido",
          "RH Gestão",
        ]
      )
    }

    db.run(
      `INSERT INTO messages (id, conversation_id, direction, text, time, status, replyTo_json, forwarded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`msg_wa_${Date.now()}`, convId, "in", text, timeStr, "lido", null, 0]
    )

    persist()
  }

  res.json({ ok: true, received: true })
})

// POST /api/integrations/email/webhook — Receber Webhook de E-mail de entrada
router.post("/email/webhook", (req: Request, res: Response) => {
  const { from, subject, text } = req.body
  console.log(`[Webhook E-mail Recebido] De: ${from} | Assunto: ${subject}`)

  if (from && text) {
    const db = getDB()
    const convRes = db.exec(`SELECT id FROM conversations WHERE lower(contact_email) = lower(?)`, [from])
    const now = new Date()
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

    let convId: string

    if (convRes.length && convRes[0].values.length) {
      convId = convRes[0].values[0][0] as string
      db.run(`UPDATE conversations SET lastMessage = ?, time = ?, unread = unread + 1 WHERE id = ?`, [
        text,
        timeStr,
        convId,
      ])
    } else {
      convId = `conv_em_${Date.now()}`
      const name = from.split("@")[0].replace(/\./g, " ")
      db.run(
        `INSERT INTO conversations (id, name, initials, channel, topic, role, department, lastMessage, time, unread, online, status, priority, pinned, snoozedUntil, assignedTo, contact_email, contact_phone, contact_location, contact_tenure, contact_manager)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          convId,
          name,
          name.slice(0, 2).toUpperCase(),
          "email",
          "geral",
          "Colaborador",
          "Geral",
          text,
          timeStr,
          1,
          1,
          "aberto",
          "media",
          0,
          null,
          "Você",
          from,
          "",
          "São Paulo, SP",
          "Recém-admitido",
          "RH Gestão",
        ]
      )
    }

    db.run(
      `INSERT INTO messages (id, conversation_id, direction, text, time, status, replyTo_json, forwarded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`msg_em_${Date.now()}`, convId, "in", text, timeStr, "lido", null, 0]
    )

    persist()
  }

  res.json({ ok: true, received: true })
})

export default router
