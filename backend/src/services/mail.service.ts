/**
 * services/mail.service.ts — Serviço de Envio de E-mails via SMTP com Nodemailer
 */
import nodemailer, { type Transporter } from "nodemailer"
import crypto from "crypto"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../../.env") })
dotenv.config({ path: path.resolve(__dirname, "../../../.env") })
dotenv.config()

export interface SendWelcomeEmailParams {
  to: string
  name: string
  temporaryPassword: string
  role?: string
  department?: string
  tenantName?: string
}

/**
 * Gera uma senha aleatória segura e forte para o colaborador
 * Formato amigável e de alta entropia (ex: Ph#9x4k!2w)
 */
export function generateSecureRandomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz"
  const uppers = "ABCDEFGHJKMNPQRSTUVWXYZ"
  const numbers = "23456789"
  const symbols = "!@#$%&*"

  let pwd = ""
  pwd += uppers.charAt(crypto.randomInt(0, uppers.length))
  pwd += chars.charAt(crypto.randomInt(0, chars.length))
  pwd += symbols.charAt(crypto.randomInt(0, symbols.length))
  pwd += numbers.charAt(crypto.randomInt(0, numbers.length))

  const allChars = chars + uppers + numbers + symbols
  for (let i = 0; i < 6; i++) {
    pwd += allChars.charAt(crypto.randomInt(0, allChars.length))
  }

  // Embaralhar caracteres
  return pwd.split("").sort(() => 0.5 - Math.random()).join("")
}

/**
 * Cria ou recupera o transporte SMTP configurado
 */
export function getMailTransporter(): Transporter {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT) || 587
  const secure = process.env.SMTP_SECURE === "true" || port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    const cleanPass = pass.replace(/\s+/g, "")
    const isGmail = host.toLowerCase().includes("gmail")

    if (isGmail) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass: cleanPass },
      })
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: cleanPass },
      tls: {
        rejectUnauthorized: false, // Evita falhas em certificados auto-assinados de intranet
      },
    })
  }

  // Fallback para desenvolvimento / simulação caso SMTP não esteja configurado no .env
  return nodemailer.createTransport({
    streamTransport: true,
    newline: "windows",
    buffer: true,
  })
}

/**
 * Envia e-mail de boas-vindas com as credenciais de acesso via SMTP
 */
export async function sendWelcomeEmployeeEmail(params: SendWelcomeEmailParams): Promise<{
  ok: boolean
  messageId?: string
  simulated?: boolean
  error?: string
}> {
  const { to, name, temporaryPassword, role, department, tenantName } = params
  const from = process.env.SMTP_FROM
    ? process.env.SMTP_FROM.replace(/^"|"$/g, "").trim()
    : `"PeopleHub RH" <${process.env.SMTP_USER || "rh@empresa.com"}>`
  const appUrl = process.env.APP_URL || "http://localhost:5173"
  const orgName = tenantName || "PeopleHub Matriz"

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Acesso à Plataforma PeopleHub RH</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.25); }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .cred-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .cred-item { margin-bottom: 14px; }
    .cred-item:last-child { margin-bottom: 0; }
    .cred-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #0f766e; }
    .cred-value { font-size: 16px; font-family: monospace; font-weight: 700; color: #134e4a; margin-top: 4px; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px dashed #5eead4; word-break: break-all; display: inline-block; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #0f766e; color: #ffffff !important; text-decoration: none; padding: 12px 32px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25); }
    .alert { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #92400e; margin-top: 24px; line-height: 1.5; }
    .footer { background: #f8fafc; padding: 20px 28px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">✦ PeopleHub RH · ${orgName}</div>
      <h1>Bem-vindo(a) à Plataforma!</h1>
      <p>Sua pasta funcional foi criada com sucesso pelo setor de RH</p>
    </div>
    <div class="content">
      <div class="greeting">Olá, ${name}!</div>
      <p class="text">
        O setor de Recursos Humanos criou sua pasta funcional digital e seus acessos à plataforma <strong>PeopleHub</strong>.
        ${role ? `Você foi cadastrado(a) no cargo de <strong>${role}</strong>` : ""}
        ${department ? ` no departamento de <strong>${department}</strong>.` : "."}
      </p>

      <div class="cred-box">
        <div class="cred-item">
          <div class="cred-label">Seu E-mail de Login</div>
          <div class="cred-value">${to}</div>
        </div>
        <div class="cred-item">
          <div class="cred-label">Sua Senha Inicial / Temporária</div>
          <div class="cred-value">${temporaryPassword}</div>
        </div>
      </div>

      <div class="btn-container">
        <a href="${appUrl}" class="btn" target="_blank">Acessar a Plataforma PeopleHub</a>
      </div>

      <div class="alert">
        <strong>🔒 Segurança e Privacidade:</strong><br/>
        Por diretriz de segurança corporativa e LGPD, o RH não tem acesso visual à sua senha. Recomendamos que você altere sua senha no seu primeiro login nas configurações do perfil.
      </div>
    </div>
    <div class="footer">
      Mensagem enviada automaticamente pelo sistema PeopleHub RH para <strong>${to}</strong>.<br/>
      ${orgName} · © ${new Date().getFullYear()} Todos os direitos reservados.
    </div>
  </div>
</body>
</html>
`

  try {
    const transporter = getMailTransporter()
    const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

    const info = await transporter.sendMail({
      from,
      to,
      subject: `[PeopleHub] Credenciais de Acesso à Plataforma — ${name}`,
      text: `Olá, ${name}!\n\nSeu acesso à plataforma PeopleHub RH foi criado.\n\nE-mail de Login: ${to}\nSenha Inicial: ${temporaryPassword}\n\nAcesse: ${appUrl}\n\nRecomendamos alterar sua senha no primeiro acesso.`,
      html: htmlContent,
    })

    if (isConfigured) {
      console.log(`[SMTP] E-mail corporativo enviado com sucesso para ${to}. ID: ${info.messageId}`)
      return { ok: true, messageId: info.messageId, simulated: false }
    } else {
      console.log(`[SMTP SIMULADO] Disparo de e-mail realizado para ${to}:`)
      console.log(`  -> Para: ${to} (${name})`)
      console.log(`  -> Senha Gerada: ${temporaryPassword}`)
      console.log(`  -> Assunto: [PeopleHub] Credenciais de Acesso à Plataforma — ${name}`)
      console.log(`  -> (Para envio real pela internet, preencha SMTP_HOST, SMTP_USER e SMTP_PASS no arquivo .env)`)
      return { ok: true, simulated: true, messageId: "simulated_" + Date.now() }
    }
  } catch (err: any) {
    console.error("[SMTP ERRO] Falha ao enviar e-mail corporativo:", err.message)
    return { ok: false, error: err.message }
  }
}

export interface SendForgotPasswordEmailParams {
  to: string
  name: string
  temporaryPassword: string
  tenantName?: string
}

/**
 * Envia e-mail de recuperação de senha com credencial temporária para redefinição no login
 */
export async function sendForgotPasswordEmail(params: SendForgotPasswordEmailParams): Promise<{
  ok: boolean
  messageId?: string
  simulated?: boolean
  error?: string
}> {
  const { to, name, temporaryPassword, tenantName } = params
  const from = process.env.SMTP_FROM
    ? process.env.SMTP_FROM.replace(/^"|"$/g, "").trim()
    : `"PeopleHub RH" <${process.env.SMTP_USER || "rh@empresa.com"}>`
  const appUrl = process.env.APP_URL || "http://localhost:5173"
  const orgName = tenantName || "PeopleHub Matriz"

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Redefinição de Senha — PeopleHub RH</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.25); }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .cred-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .cred-item { margin-bottom: 14px; }
    .cred-item:last-child { margin-bottom: 0; }
    .cred-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #0f766e; }
    .cred-value { font-size: 16px; font-family: monospace; font-weight: 700; color: #134e4a; margin-top: 4px; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px dashed #5eead4; word-break: break-all; display: inline-block; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #0f766e; color: #ffffff !important; text-decoration: none; padding: 12px 32px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25); }
    .alert { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #92400e; margin-top: 24px; line-height: 1.5; }
    .footer { background: #f8fafc; padding: 20px 28px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">✦ PeopleHub RH · ${orgName}</div>
      <h1>Redefinição de Senha</h1>
      <p>Solicitação de recuperação de acesso à sua conta</p>
    </div>
    <div class="content">
      <div class="greeting">Olá, ${name}!</div>
      <p class="text">
        Recebemos uma solicitação de redefinição de senha para o seu acesso corporativo na plataforma <strong>PeopleHub</strong>.
        Para garantir a segurança dos seus dados, geramos uma nova credencial provisória para você entrar e redefinir sua senha definitiva.
      </p>

      <div class="cred-box">
        <div class="cred-item">
          <div class="cred-label">Seu E-mail</div>
          <div class="cred-value">${to}</div>
        </div>
        <div class="cred-item">
          <div class="cred-label">Senha Temporária de Acesso</div>
          <div class="cred-value">${temporaryPassword}</div>
        </div>
      </div>

      <div class="btn-container">
        <a href="${appUrl}" class="btn" target="_blank">Acessar e Redefinir Senha</a>
      </div>

      <div class="alert">
        <strong>🔒 Importante:</strong><br/>
        Assim que você efetuar o login com esta senha temporária, a plataforma solicitará obrigatoriamente que você crie sua nova senha pessoal definitiva.
      </div>
    </div>
    <div class="footer">
      Se você não solicitou esta redefinição, avise imediatamente o setor de TI ou RH.<br/>
      ${orgName} · © ${new Date().getFullYear()} Todos os direitos reservados.
    </div>
  </div>
</body>
</html>
`

  try {
    const transporter = getMailTransporter()
    const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

    const info = await transporter.sendMail({
      from,
      to,
      subject: `[PeopleHub] Redefinição de Senha — ${name}`,
      text: `Olá, ${name}!\n\nRecebemos uma solicitação de redefinição de senha.\n\nE-mail: ${to}\nSenha Temporária: ${temporaryPassword}\n\nAcesse: ${appUrl}\n\nAo entrar, o sistema solicitará a definição da sua nova senha pessoal.`,
      html: htmlContent,
    })

    if (isConfigured) {
      console.log(`[SMTP] E-mail de redefinição enviado com sucesso para ${to}. ID: ${info.messageId}`)
      return { ok: true, messageId: info.messageId, simulated: false }
    } else {
      console.log(`[SMTP SIMULADO] Disparo de redefinição de senha para ${to}:`)
      console.log(`  -> Para: ${to} (${name})`)
      console.log(`  -> Senha Temporária: ${temporaryPassword}`)
      return { ok: true, simulated: true, messageId: "simulated_" + Date.now() }
    }
  } catch (err: any) {
    console.error("[SMTP ERRO] Falha ao enviar e-mail de redefinição:", err.message)
    return { ok: false, error: err.message }
  }
}
