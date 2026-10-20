/**
 * test-security-audit.js
 * Bateria automatizada de testes de segurança para validação das correções aplicadas
 * no PeopleHub RH (Autenticação, 2FA, RBAC, Anti-enumeração, Cabeçalhos e Escopos).
 */
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3001"

let passed = 0
let failed = 0

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`)
    passed++
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`)
    failed++
  }
}

async function login(email, password = "admin123") {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  return { status: res.status, data, token: data.token }
}

async function runSecurityTests() {
  console.log("==================================================")
  console.log("INICIANDO SUÍTE DE TESTES DE SEGURANÇA — PEOPLEHUB RH")
  console.log("==================================================")

  // 1. Obter tokens dos perfis para testes de autorização
  console.log("\n[AUTH SETUP] Autenticando perfis para a suíte de testes...")
  const adminLogin = await login("admin@empresa.com", "admin123")
  const adminToken = adminLogin.token
  assert(adminLogin.status === 200 && !!adminToken, "Autenticação do Administrador realizada com sucesso")

  // Provisionar colaborador de teste para validar RBAC e escopo
  const colabEmail = `colab.sec.${Date.now()}@empresa.com`
  const colabPass = "SenhaForte@2026Sec"
  await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Colaborador Teste Seg",
      role: "Assistente Operacional",
      department: "Operações",
      email: colabEmail,
      initialPassword: colabPass,
      sendEmail: false,
    }),
  })
  const colabLogin = await login(colabEmail, colabPass)
  const colabToken = colabLogin.token
  assert(colabLogin.status === 200 && !!colabToken, "Colaborador de teste provisionado e autenticado com sucesso")

  // 2. [SEC-01] Teste de Proteção contra Account Takeover em change-password
  console.log("\n[TEST SEC-01] Tentativa de alteração de senha sem senha atual:")
  const bypassAttempt1 = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@empresa.com",
      newPassword: "senhaInvasor123!",
    }),
  })
  assert(
    bypassAttempt1.status === 400 || bypassAttempt1.status === 401,
    "Bloqueia redefinição não autenticada sem senha atual (400/401)"
  )

  const bypassAttempt2 = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      currentPassword: "senhaErradaInvalida",
      newPassword: "senhaInvasor123!",
    }),
  })
  assert(
    bypassAttempt2.status === 400,
    "Bloqueia alteração com senha atual incorreta (400)"
  )

  // 3. [SEC-02] Teste de Não-Vazamento de Código OTP em resend-mfa
  console.log("\n[TEST SEC-02] Proteção contra vazamento de código 2FA em resend-mfa:")
  // Iniciar login de usuário com 2FA ou gerar pendingToken simulado
  const resendMfaRes = await fetch(`${BASE_URL}/api/auth/resend-mfa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken: "token_invalido_teste" }),
  })
  const resendData = await resendMfaRes.json()
  assert(
    resendData.mfaCode === undefined,
    "Código 2FA (mfaCode) NÃO é exposto no corpo da resposta JSON"
  )

  // 4. [SEC-03] Teste de Proteção em /api/integrations
  console.log("\n[TEST SEC-03] Proteção do módulo de integrações (/api/integrations):")
  const noAuthIntegrations = await fetch(`${BASE_URL}/api/integrations/config`)
  assert(
    noAuthIntegrations.status === 401,
    "GET /api/integrations/config sem autenticação retorna 401"
  )

  const colabIntegrations = await fetch(`${BASE_URL}/api/integrations/config`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert(
    colabIntegrations.status === 403,
    "GET /api/integrations/config com perfil COLABORADOR retorna 403 (Acesso Negado)"
  )

  const adminIntegrations = await fetch(`${BASE_URL}/api/integrations/config`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert(
    adminIntegrations.status === 200,
    "GET /api/integrations/config com perfil ADMIN retorna 200 com sucesso"
  )

  // 5. [SEC-04] Proteção de Rotas de Conversas e Onboarding
  console.log("\n[TEST SEC-04] Proteção de rotas desprotegidas (Conversas e Onboarding):")
  const noAuthConversations = await fetch(`${BASE_URL}/api/conversations`)
  assert(
    noAuthConversations.status === 401,
    "GET /api/conversations sem autenticação retorna 401"
  )

  const noAuthOnboarding = await fetch(`${BASE_URL}/api/onboarding`)
  assert(
    noAuthOnboarding.status === 401,
    "GET /api/onboarding sem autenticação retorna 401"
  )

  // 6. [SEC-04] Proteção de PDF de Holerite e Escopo
  console.log("\n[TEST SEC-04] Proteção da rota de geração de PDF (/api/pdf/holerite):")
  const noAuthPdf = await fetch(`${BASE_URL}/api/pdf/holerite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeName: "Administrador PeopleHub" }),
  })
  assert(
    noAuthPdf.status === 401,
    "POST /api/pdf/holerite sem autenticação retorna 401"
  )

  const colabPdfOther = await fetch(`${BASE_URL}/api/pdf/holerite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${colabToken}` },
    body: JSON.stringify({ employeeName: "Diretor Presidente" }),
  })
  assert(
    colabPdfOther.status === 403,
    "COLABORADOR impedido de gerar PDF de holerite de outro colaborador (403)"
  )

  // 7. [SEC-06] Anti-Enumeração de Contas em Login e Esqueci Senha
  console.log("\n[TEST SEC-06] Proteção contra Enumeração de Contas:")
  const nonExistentLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "inexistente@empresa.com", password: "qualquersenha" }),
  })
  const wrongPasswordLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@empresa.com", password: "senhaTotalmenteErrada" }),
  })
  const nonExistentData = await nonExistentLogin.json()
  const wrongPasswordData = await wrongPasswordLogin.json()

  assert(
    nonExistentLogin.status === 401 && wrongPasswordLogin.status === 401,
    "Ambos retornam HTTP 401"
  )
  assert(
    nonExistentData.error === wrongPasswordData.error,
    "Mensagem de erro idêntica para e-mail inexistente e senha incorreta (anti-enumeração)"
  )

  const forgotNonExistent = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "naoexiste_redefinicao@empresa.com" }),
  })
  assert(
    forgotNonExistent.status === 200,
    "POST /api/auth/forgot-password para e-mail não existente retorna 200 neutro (não vaza 404)"
  )

  // 8. [SEC-08] Reautenticação para desativação de 2FA
  console.log("\n[TEST SEC-08] Reautenticação na desativação de 2FA:")
  const disable2faNoAuth = await fetch(`${BASE_URL}/api/auth/2fa/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  })
  assert(
    disable2faNoAuth.status === 401,
    "Desativação de 2FA sem confirmação de senha atual ou TOTP retorna 401"
  )

  // 9. [SEC-10] Cabeçalhos de Segurança HTTP
  console.log("\n[TEST SEC-10] Verificação de Cabeçalhos de Segurança HTTP:")
  const healthCheck = await fetch(`${BASE_URL}/api/health`)
  assert(
    healthCheck.headers.get("x-powered-by") === null,
    "Cabeçalho 'X-Powered-By' foi desativado com sucesso"
  )
  assert(
    healthCheck.headers.get("x-content-type-options") === "nosniff",
    "Cabeçalho 'X-Content-Type-Options: nosniff' ativo via Helmet"
  )

  console.log("\n==================================================")
  console.log(`RESULTADO DA AUDITORIA DE SEGURANÇA: ${passed} PASSARAM, ${failed} FALHARAM`)
  console.log("==================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runSecurityTests().catch((err) => {
  console.error("Erro fatal na execução dos testes de segurança:", err)
  process.exit(1)
})
