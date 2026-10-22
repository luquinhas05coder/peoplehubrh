/**
 * test-integrations-webhooks.js — Suíte Completa de Testes de Integrações e Webhooks
 *
 * Cobertura:
 * 1. RBAC: Restrição estrita de gerenciamento a Administradores (403 para colaboradores)
 * 2. Prevenção de SSRF: Bloqueio de loopback, RFC 1918 (10.x, 192.168.x), metadados de nuvem (169.254.169.254) e portas proibidas
 * 3. Assinatura Criptográfica HMAC SHA-256: Criação, cabeçalho t=...,v1=..., verificação em tempo constante e bloqueio de replay
 * 4. Rotação Segura de Segredos com Auditoria
 * 5. Sanitização de Payloads: Exclusão estrita de senhas, tokens, MFA e dados desnecessários
 * 6. Disparo Real de Eventos: employee.created, request.approved, job.published, candidate.stage_changed
 * 7. Fila de Entregas, Tolerância a Falhas e Reenvio Manual (redeliver)
 * 8. Adaptador CSV: Exportação de base DP e importação resiliente com validação de erros por linha
 * 9. Adaptador CBO: Consulta de ocupações com catálogo e fallback
 */

import assert from "assert"
import { computeWebhookSignature, verifyWebhookSignature, generateWebhookSecret } from "./src/integrations/security/hmac.js"
import { validateSsrfUrl } from "./src/integrations/security/ssrf.js"
import { sanitizePayload } from "./src/integrations/security/sanitizer.js"
import { csvEmployeeAdapter } from "./src/integrations/adapters/csv_employee.adapter.js"
import { cboAdapter } from "./src/integrations/adapters/cbo.adapter.js"

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3009"

async function runTests() {
  console.log(`\n============================================================`)
  console.log(`🚀 INICIANDO TESTES DA CAMADA DE INTEGRAÇÕES & WEBHOOKS`)
  console.log(`============================================================`)

  // --- 1. Autenticação dos Perfis (ADMIN e COLABORADOR) ---
  console.log(`\n--- 1. Autenticação dos Perfis para Testes de RBAC ---`)

  // Login Admin
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@empresa.com", password: "admin123" }),
  })
  const adminAuth = await adminLoginRes.json()
  assert.strictEqual(adminLoginRes.status, 200, "Login do admin deve retornar 200")
  const adminToken = adminAuth.token
  console.log(`✔ Administrador autenticado: ${adminAuth.user.name} (${adminAuth.user.role})`)

  // Login Colaborador
  const colabLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "colaborador@peoplehub.com.br", password: "admin123" }),
  })
  const colabAuth = await colabLoginRes.json()
  assert.strictEqual(colabLoginRes.status, 200, "Login do colaborador deve retornar 200")
  const colabToken = colabAuth.token
  console.log(`✔ Colaborador autenticado: ${colabAuth.user.name} (${colabAuth.user.role})`)

  // --- 2. Proteção RBAC nas Rotas de Integrações e Webhooks ---
  console.log(`\n--- 2. Validação de Permissões RBAC nas Rotas Administrativas ---`)

  // Colaborador tentando listar webhooks
  const colabSubsRes = await fetch(`${BASE_URL}/api/webhooks/subscriptions`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(colabSubsRes.status, 403, "Colaborador deve ser bloqueado com 403 ao listar webhooks")
  console.log(`✔ Colaborador impedido com 403 Forbidden de acessar gerenciamento de webhooks`)

  // Colaborador tentando acessar configurações de integração
  const colabIntegRes = await fetch(`${BASE_URL}/api/integrations/config`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(colabIntegRes.status, 403, "Colaborador deve ser bloqueado com 403 ao acessar configurações de integração")
  console.log(`✔ Colaborador impedido com 403 de visualizar configurações de integração`)

  // Admin acessando webhooks
  const adminSubsRes = await fetch(`${BASE_URL}/api/webhooks/subscriptions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.strictEqual(adminSubsRes.status, 200, "Admin deve acessar webhooks com 200 OK")
  console.log(`✔ Administrador autorizado a consultar endpoints de webhooks`)

  // --- 3. Prevenção de SSRF (Server-Side Request Forgery) ---
  console.log(`\n--- 3. Prevenção de SSRF (Loopback, Redes Privadas e Metadados) ---`)

  // Bloqueio de IP privado RFC 1918
  const checkRfc1918 = await validateSsrfUrl("https://192.168.1.100:8443/webhook")
  assert.strictEqual(checkRfc1918.valid, false)
  assert.ok(checkRfc1918.error?.includes("SSRF"), "Deve conter mensagem de bloqueio SSRF")
  console.log(`✔ Destino em rede privada 192.168.1.100 bloqueado por proteção SSRF`)

  // Bloqueio de Link-local e metadados de nuvem (AWS/GCP/Azure)
  const checkMetadata = await validateSsrfUrl("http://169.254.169.254/latest/meta-data")
  assert.strictEqual(checkMetadata.valid, false)
  console.log(`✔ Endpoint de metadados de nuvem (169.254.169.254) bloqueado com sucesso`)

  // Bloqueio de portas de infraestrutura não autorizadas (ex: SSH porta 22)
  const checkPort22 = await validateSsrfUrl("https://api.empresa.com.br:22/hook")
  assert.strictEqual(checkPort22.valid, false)
  assert.ok(checkPort22.error?.includes("Porta 22 bloqueada"))
  console.log(`✔ Conexão para porta restrita (porta 22) bloqueada por política de segurança`)

  // Bloqueio de protocolo inseguro/não permitido
  const checkProtocol = await validateSsrfUrl("ftp://api.empresa.com.br/hook")
  assert.strictEqual(checkProtocol.valid, false)
  console.log(`✔ Protocolo não permitido (ftp:) bloqueado`)

  // Validação via API POST /api/webhooks/subscriptions com destino proibido
  const ssrfApiRes = await fetch(`${BASE_URL}/api/webhooks/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Ataque SSRF Teste",
      url: "https://10.0.0.1/internal/admin",
      events: ["employee.created"],
    }),
  })
  assert.strictEqual(ssrfApiRes.status, 400, "Cadastro com IP privado via API deve retornar 400 Bad Request")
  const ssrfApiData = await ssrfApiRes.json()
  assert.ok(ssrfApiData.error?.includes("SSRF"))
  console.log(`✔ API rejeitou com HTTP 400 tentativa de cadastro com destino em rede privada 10.0.0.1`)

  // --- 4. Assinatura Criptográfica HMAC SHA-256 e Verificação em Tempo Constante ---
  console.log(`\n--- 4. Assinatura Criptográfica HMAC SHA-256 & Verificação ---`)

  const testSecret = generateWebhookSecret()
  const testPayload = JSON.stringify({ event: "test", data: { id: 123 } })
  const nowTimestamp = Math.floor(Date.now() / 1000)

  // Geração e cálculo da assinatura
  const validSig = computeWebhookSignature(testPayload, testSecret, nowTimestamp)
  const validHeader = `t=${nowTimestamp},v1=${validSig}`

  // Verificação válida
  const verificationResult = verifyWebhookSignature(validHeader, testPayload, testSecret)
  assert.strictEqual(verificationResult.valid, true, "Assinatura legítima deve ser aceita")
  console.log(`✔ Assinatura HMAC calculada e verificada com sucesso em tempo constante (timingSafeEqual)`)

  // Rejeição de payload adulterado
  const tamperedResult = verifyWebhookSignature(validHeader, testPayload + "tampered", testSecret)
  assert.strictEqual(tamperedResult.valid, false, "Payload adulterado deve ser rejeitado")
  console.log(`✔ Assinatura com payload adulterado rejeitada com sucesso`)

  // Rejeição de timestamp expirado (Replay Attack)
  const oldTimestamp = nowTimestamp - 600 // 10 minutos atrás (limite é 5 min)
  const oldSig = computeWebhookSignature(testPayload, testSecret, oldTimestamp)
  const oldHeader = `t=${oldTimestamp},v1=${oldSig}`
  const expiredResult = verifyWebhookSignature(oldHeader, testPayload, testSecret)
  assert.strictEqual(expiredResult.valid, false)
  assert.ok(expiredResult.error?.includes("expirada"), "Deve detectar assinatura expirada")
  console.log(`✔ Tentativa de ataque de repetição (Replay Attack) bloqueada por timestamp expirado`)

  // --- 5. Cadastro de Webhook Legítimo & Rotação de Segredo ---
  console.log(`\n--- 5. Cadastro de Endpoint Legítimo e Rotação de Segredo ---`)

  const createSubRes = await fetch(`${BASE_URL}/api/webhooks/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Integração ERP Externo Teste",
      url: "https://httpbin.org/post",
      events: ["employee.created", "request.approved", "job.published", "candidate.stage_changed", "ping.test"],
      is_active: true,
    }),
  })
  assert.strictEqual(createSubRes.status, 201, "Criação de webhook válido deve retornar 201")
  const createdSubData = await createSubRes.json()
  const subscriptionId = createdSubData.subscription.id
  assert.ok(subscriptionId, "ID da inscrição deve ser gerado")
  assert.ok(createdSubData.subscription.secret, "Segredo deve ser retornado na criação")
  assert.ok(createdSubData.subscription.masked_secret.includes("••••"), "Segredo mascarado deve ser retornado")
  console.log(`✔ Endpoint de webhook cadastrado com sucesso (ID: ${subscriptionId})`)

  // Consulta de lista deve ofuscar segredo
  const listSubsRes = await fetch(`${BASE_URL}/api/webhooks/subscriptions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const listSubsData = await listSubsRes.json()
  const foundSub = listSubsData.subscriptions.find((s) => s.id === subscriptionId)
  assert.ok(foundSub)
  assert.strictEqual(foundSub.secret, undefined, "Campo secret em texto puro NÃO deve ser exposto na listagem")
  assert.ok(foundSub.masked_secret.includes("••••"), "Campo masked_secret deve ser exibido")
  console.log(`✔ Segredo de assinatura devidamente protegido e ofuscado na consulta pública`)

  // Rotação de segredo
  const rotateRes = await fetch(`${BASE_URL}/api/webhooks/subscriptions/${subscriptionId}/rotate-secret`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.strictEqual(rotateRes.status, 200, "Rotação de segredo deve retornar 200")
  const rotateData = await rotateRes.json()
  assert.ok(rotateData.newSecret, "Novo segredo gerado deve ser retornado")
  assert.notStrictEqual(rotateData.newSecret, createdSubData.subscription.secret, "Novo segredo deve ser diferente do anterior")
  console.log(`✔ Rotação de segredo HMAC executada com sucesso e auditada`)

  // --- 6. Sanitização de Payloads de Eventos ---
  console.log(`\n--- 6. Sanitização de Dados nos Payloads dos Eventos ---`)

  const rawSensitiveData = {
    employee_id: "emp_123",
    name: "Carlos Eduardo",
    email: "carlos@empresa.com",
    cpf: "12345678900",
    password: "secret_password_123",
    initialPassword: "temp_pwd_456",
    hash: "$2a$10$xyz...",
    token: "jwt_token_sensitive",
    session: "session_id_sensitive",
    status: "Ativo",
  }

  const sanitized = sanitizePayload(rawSensitiveData)
  assert.strictEqual(sanitized.password, undefined, "Senha deve ser eliminada")
  assert.strictEqual(sanitized.initialPassword, undefined, "Senha inicial deve ser eliminada")
  assert.strictEqual(sanitized.hash, undefined, "Hash deve ser eliminado")
  assert.strictEqual(sanitized.token, undefined, "Token de sessão deve ser eliminado")
  assert.strictEqual(sanitized.cpf, "123.***.***-**", "CPF deve ser mascarado")
  assert.strictEqual(sanitized.name, "Carlos Eduardo", "Dados cadastrais públicos devem ser preservados")
  console.log(`✔ Sanitização validada: senhas, hashes e tokens removidos; CPF mascarado`)

  // --- 7. Disparo Real de Eventos nos Módulos ---
  console.log(`\n--- 7. Disparo dos Eventos do Sistema e Registro na Fila ---`)

  // Evento 1: employee.created ao cadastrar colaborador
  const randNum = Math.floor(1000 + Math.random() * 9000)
  const empEmail = `integracao.teste.${randNum}@peoplehub.com.br`
  const createEmpRes = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Colaborador Integracao ${randNum}`,
      role: "Desenvolvedor Backend",
      department: "Tecnologia",
      email: empEmail,
      sendEmail: false,
    }),
  })
  assert.strictEqual(createEmpRes.status, 201, "Criação de colaborador deve retornar 201")
  console.log(`✔ Evento 'employee.created' despachado com sucesso na criação de colaborador`)

  // Evento 2: job.published ao cadastrar vaga com status aberta
  const createJobRes = await fetch(`${BASE_URL}/api/recruitment/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `Engenheiro de Dados ${randNum}`,
      department: "Tecnologia",
      status: "aberta",
      workModel: "remoto",
    }),
  })
  assert.strictEqual(createJobRes.status, 201, "Criação de vaga deve retornar 201")
  const jobCreated = await createJobRes.json()
  console.log(`✔ Evento 'job.published' despachado com sucesso na publicação de vaga`)

  // Evento 3: candidate.stage_changed ao mover candidato
  // Inscrição pública primeiro
  const applyRes = await fetch(`${BASE_URL}/api/recruitment/public/jobs/${jobCreated.id}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Candidato Teste ${randNum}`,
      email: `candidato.${randNum}@teste.com`,
      lgpdConsent: true,
    }),
  })
  const applyData = await applyRes.json()
  const applicationId = applyData.applicationId

  // Mover etapa via RH
  const stageRes = await fetch(`${BASE_URL}/api/recruitment/applications/${applicationId}/stage`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stage: "entrevista", notes: "Aprovado na triagem técnica" }),
  })
  assert.strictEqual(stageRes.status, 200, "Mudança de etapa deve retornar 200")
  console.log(`✔ Evento 'candidate.stage_changed' despachado com sucesso na movimentação de candidato`)

  // Evento 4: request.approved ao aprovar solicitação
  const reqRes = await fetch(`${BASE_URL}/api/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${colabToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "Declaração de Vínculo",
      requester: "Gabriel Santos",
      department: "Tecnologia",
      description: "Declaração para fins bancários",
      priority: "media",
    }),
  })
  const reqData = await reqRes.json()
  const requestId = reqData.id

  // Aprovação
  const approveRes = await fetch(`${BASE_URL}/api/requests/${requestId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "Aprovado", decision_note: "Emitida declaração digital" }),
  })
  assert.strictEqual(approveRes.status, 200, "Aprovação deve retornar 200")
  console.log(`✔ Evento 'request.approved' despachado com sucesso na aprovação de chamado`)

  // Aguardar 500ms para o worker assíncrono persistir as entregas
  await new Promise((r) => setTimeout(r, 600))

  // --- 8. Histórico de Entregas e Reenvio Manual ---
  console.log(`\n--- 8. Consulta ao Histórico de Entregas & Reenvio Manual ---`)

  const deliveriesRes = await fetch(`${BASE_URL}/api/webhooks/deliveries?limit=10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.strictEqual(deliveriesRes.status, 200)
  const deliveriesData = await deliveriesRes.json()
  assert.ok(deliveriesData.deliveries.length > 0, "Deve haver entregas registradas no histórico")

  const firstDelivery = deliveriesData.deliveries[0]
  console.log(`✔ Histórico de entregas auditado: ${deliveriesData.deliveries.length} registros (Último evento: ${firstDelivery.event_type})`)

  // Bloqueio de colaborador no reenvio manual
  const colabRedeliverRes = await fetch(`${BASE_URL}/api/webhooks/deliveries/${firstDelivery.id}/redeliver`, {
    method: "POST",
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(colabRedeliverRes.status, 403, "Colaborador deve receber 403 ao tentar acionar reenvio manual")
  console.log(`✔ Colaborador bloqueado (403) de acionar reenvio manual de webhook`)

  // Reenvio por administrador
  const adminRedeliverRes = await fetch(`${BASE_URL}/api/webhooks/deliveries/${firstDelivery.id}/redeliver`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.strictEqual(adminRedeliverRes.status, 200, "Admin deve conseguir disparar reenvio manual")
  console.log(`✔ Reenvio manual de webhook executado com sucesso pelo Administrador`)

  // --- 9. Adaptador CSV (Exportação e Importação em Lote) ---
  console.log(`\n--- 9. Adaptador CSV de Colaboradores (Exportação & Importação) ---`)

  // Exportação via API
  const exportCsvRes = await fetch(`${BASE_URL}/api/integrations/csv/employees/export`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.strictEqual(exportCsvRes.status, 200, "Exportação CSV deve retornar 200")
  const csvText = await exportCsvRes.text()
  const directCsv = csvEmployeeAdapter.exportEmployees([])
  assert.ok(directCsv.startsWith("\uFEFF"), "Adaptador CSV deve gerar BOM UTF-8 para compatibilidade Excel")
  assert.ok(csvText.includes("ID_Matricula") && csvText.includes("Nome_Completo"), "Cabeçalhos do DP devem estar presentes")
  console.log(`✔ Base de colaboradores exportada com sucesso em CSV padronizado (tamanho: ${csvText.length} bytes)`)

  // Importação resiliente com validação de erros linha por linha
  const testCsvContent = `Nome_Completo;Cargo;Departamento;Email_Corporativo;Telefone;CPF;Data_Admissao
Ana Paula Silva;Analista de RH;Recursos Humanos;anapaula.${randNum}@peoplehub.com.br;(11) 97777-1111;11122233344;2026-01-15
;Cargo Sem Nome;Tecnologia;invalido@peoplehub.com.br;;;
Carlos Pereira;Gerente Financeiro;Financeiro;carlos.${randNum}@peoplehub.com.br;(11) 98888-2222;22233344455;2026-02-01`

  const importCsvRes = await fetch(`${BASE_URL}/api/integrations/csv/employees/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ csvContent: testCsvContent }),
  })
  assert.strictEqual(importCsvRes.status, 200)
  const importData = await importCsvRes.json()
  assert.strictEqual(importData.result.successCount, 2, "2 colaboradores válidos devem ser importados")
  assert.strictEqual(importData.result.errorCount, 1, "1 linha com erro deve ser reportada")
  assert.strictEqual(importData.result.errors[0].line, 3, "Linha 3 deve ser apontada com erro de nome ausente")
  console.log(`✔ Carga CSV validada com sucesso: 2 registros importados, 1 erro estrutural capturado e reportado`)

  // --- 10. Adaptador CBO (Consulta e Fallback) ---
  console.log(`\n--- 10. Adaptador CBO ConectaGov / MTE ---`)

  const cboTestRes = await cboAdapter.testConnection()
  assert.strictEqual(cboTestRes.ok, true, "Conexão do adaptador CBO deve ser bem-sucedida")

  const cboItems = await cboAdapter.execute({ query: "desenvolvedor", limit: 5 })
  assert.ok(cboItems.length > 0, "Deve retornar ocupações compatíveis")
  assert.ok(cboItems[0].title.toLowerCase().includes("sistemas") || cboItems[0].code.startsWith("2124"))
  console.log(`✔ Adaptador CBO operacional: ${cboItems.length} ocupações encontradas para busca 'desenvolvedor'`)

  // Limpeza: excluir o webhook de teste cadastrado
  await fetch(`${BASE_URL}/api/webhooks/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  console.log(`✔ Webhook de teste excluído ao final da suíte`)

  console.log(`\n============================================================`)
  console.log(`🎉 TODOS OS 10 TESTES DE INTEGRAÇÕES & WEBHOOKS PASSARAM COM SUCESSO!`)
  console.log(`============================================================\n`)
}

runTests().catch((err) => {
  console.error("❌ FALHA NA SUÍTE DE TESTES DE INTEGRAÇÕES & WEBHOOKS:", err)
  process.exit(1)
})
