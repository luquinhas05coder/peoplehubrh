/**
 * test-self-service.js — Bateria de Testes Automatizados do Portal de Autoatendimento do Colaborador
 *
 * Cobertura:
 * 1. Consulta ao próprio dossiê via GET /api/employees/me com escopo OWN
 * 2. Bloqueio de acesso a dossiê de outros colaboradores (IDOR Prevention)
 * 3. Abertura de solicitação de atualização cadastral sem aplicação imediata no banco
 * 4. Cancelamento de solicitação pendente pelo próprio colaborador
 * 5. Bloqueio de cancelamento de chamado alheio por colaborador comum
 * 6. Governança e Regra Anti-Autoaprovação (gestor/RH não pode aprovar seu próprio chamado)
 * 7. Solicitação de correções pelo RH com justificativa obrigatória
 * 8. Aprovação pelo RH de atualização cadastral com aplicação automática na tabela employees
 * 9. Upload de documento pessoal pelo colaborador com validação de formato e origem 'pessoal'
 * 10. Proteção IDOR no download de documentos (colaborador não pode baixar doc alheio)
 * 11. Adição de comentários e pendências na linha do tempo da solicitação
 */

import assert from "assert"

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3009"

async function runTests() {
  console.log(`\n============================================================`)
  console.log(`🚀 INICIANDO TESTES DO PORTAL DE AUTOATENDIMENTO (SELF-SERVICE)`)
  console.log(`============================================================`)

  // --- 1. Autenticação dos Perfis (Colaborador e RH) ---
  console.log(`\n--- 1. Autenticação de Usuários ---`)

  // Login Colaborador (colaborador@peoplehub.com.br)
  const loginColabRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "colaborador@peoplehub.com.br", password: "admin123" }),
  })
  const colabAuth = await loginColabRes.json()
  assert.strictEqual(loginColabRes.status, 200, "Login do colaborador deve retornar 200")
  const colabToken = colabAuth.token
  console.log(`✔ Colaboradora autenticada: ${colabAuth.user.name} (${colabAuth.user.role})`)

  // Login RH (rh@peoplehub.com.br)
  const loginRhRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rh@peoplehub.com.br", password: "admin123" }),
  })
  const rhAuth = await loginRhRes.json()
  assert.strictEqual(loginRhRes.status, 200, "Login do RH deve retornar 200")
  const rhToken = rhAuth.token
  console.log(`✔ Analista de RH autenticado: ${rhAuth.user.name} (${rhAuth.user.role})`)

  // --- 2. Consulta ao próprio dossiê via /api/employees/me ---
  console.log(`\n--- 2. Consulta ao Dossiê Pessoal (/api/employees/me) ---`)
  const meRes = await fetch(`${BASE_URL}/api/employees/me`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  const meData = await meRes.json()
  assert.strictEqual(meRes.status, 200, "GET /api/employees/me deve retornar 200")
  assert.strictEqual(meData.ok, true)
  assert.ok(meData.employee, "Dossiê do colaborador deve ser retornado")
  assert.strictEqual(meData.employee.email.toLowerCase(), "colaborador@peoplehub.com.br")
  assert.ok(Array.isArray(meData.documents), "Documentos devem vir como array")
  assert.ok(Array.isArray(meData.requests), "Solicitações devem vir como array")
  assert.ok(meData.vacation, "Dados de férias consolidados devem estar presentes")
  console.log(`✔ Dossiê pessoal consultado com sucesso: ${meData.employee.name} | Cargo: ${meData.employee.role || 'N/A'}`)

  // --- 3. Proteção IDOR no Perfil Individual (/api/employees/:id) ---
  console.log(`\n--- 3. Proteção IDOR em Perfis de Outros Colaboradores ---`)
  const allEmpsRes = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${rhToken}` },
  })
  const allEmpsData = await allEmpsRes.json()
  const otherEmp = allEmpsData.employees.find((e) => e.email.toLowerCase() !== "colaborador@peoplehub.com.br") || { id: "emp_other" }

  const idorEmpRes = await fetch(`${BASE_URL}/api/employees/${otherEmp.id}`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(idorEmpRes.status, 403, "Colaborador deve ser bloqueado com 403 ao tentar ver perfil de outro funcionário")
  console.log(`✔ Proteção IDOR ativa: Colaborador bloqueado (403) ao tentar consultar registro de ${otherEmp.name}`)

  // --- 4. Solicitação de Alteração Cadastral (sem alteração imediata no banco) ---
  console.log(`\n--- 4. Solicitação de Alteração Cadastral pelo Colaborador ---`)
  const originalPhone = meData.employee.phone || ""
  const randSuffix = Math.floor(1000 + Math.random() * 9000)
  const newPhone = `(11) 98888-${randSuffix}`
  const newAddress = `Avenida Paulista, ${randSuffix}, Apto 82`

  const reqCadRes = await fetch(`${BASE_URL}/api/employees/me/request-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({
      changes: {
        phone: newPhone,
        address: newAddress,
        city: "São Paulo",
        state: "SP",
      },
      justification: "Mudança recente de residência e número de celular.",
    }),
  })
  const reqCadData = await reqCadRes.json()
  assert.strictEqual(reqCadRes.status, 201, "Abertura de alteração cadastral deve retornar 201")
  assert.ok(reqCadData.id, "ID da solicitação deve ser gerado")
  const cadastralRequestId = reqCadData.id
  console.log(`✔ Solicitação cadastral criada: ${cadastralRequestId}`)

  // Garantir que a tabela employees NÃO foi alterada ainda
  const checkEmpRes = await fetch(`${BASE_URL}/api/employees/me`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  const checkEmpData = await checkEmpRes.json()
  assert.notStrictEqual(
    checkEmpData.employee.phone,
    newPhone,
    "Dados sensíveis/cadastrais NÃO podem ser alterados antes da aprovação do RH"
  )
  console.log(`✔ Integridade validada: Tabela employees permaneceu inalterada aguardando revisão do RH`)

  // --- 5. Adição de Comentários / Linha do Tempo ---
  console.log(`\n--- 5. Interação e Comentários na Solicitação ---`)
  const addCommentRes = await fetch(`${BASE_URL}/api/requests/${cadastralRequestId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({ comment: "Anexei também o novo comprovante de endereço." }),
  })
  assert.strictEqual(addCommentRes.status, 201, "Comentário deve retornar 201")

  const getCommentsRes = await fetch(`${BASE_URL}/api/requests/${cadastralRequestId}/comments`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  const commentsData = await getCommentsRes.json()
  assert.strictEqual(commentsData.ok, true)
  assert.strictEqual(commentsData.comments.length, 1)
  console.log(`✔ Linha do tempo registrada com sucesso: 1 comentário na solicitação ${cadastralRequestId}`)

  // --- 6. Solicitação de Correção pelo RH (com justificativa obrigatória) ---
  console.log(`\n--- 6. Solicitação de Correções pelo RH ---`)
  // Testar bloqueio se não enviar justificativa
  const invalidCorrectionRes = await fetch(`${BASE_URL}/api/requests/${cadastralRequestId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({ status: "Correção Solicitada", justification: "" }),
  })
  assert.strictEqual(invalidCorrectionRes.status, 400, "Solicitar correção sem justificativa deve retornar 400")
  console.log(`✔ Bloqueio validado: RH impedido de pedir correção sem justificativa (400)`)

  // Enviar correção com justificativa válida
  const validCorrectionRes = await fetch(`${BASE_URL}/api/requests/${cadastralRequestId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      status: "Correção Solicitada",
      justification: "Favor anexar conta de luz recente em seu nome para comprovar o novo endereço.",
    }),
  })
  assert.strictEqual(validCorrectionRes.status, 200)
  console.log(`✔ Status alterado para 'Correção Solicitada' com pendência documentada`)

  // --- 7. Aprovação pelo RH e Aplicação Automática na Tabela employees ---
  console.log(`\n--- 7. Aprovação pelo RH com Aplicação Automática Cadastral ---`)
  const approveRes = await fetch(`${BASE_URL}/api/requests/${cadastralRequestId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      status: "Aprovado",
      justification: "Documento conferido e alteração aprovada.",
    }),
  })
  assert.strictEqual(approveRes.status, 200, "Aprovação deve retornar 200")

  // Verificar se agora a tabela employees foi atualizada com o novo telefone e endereço!
  const finalEmpRes = await fetch(`${BASE_URL}/api/employees/me`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  const finalEmpData = await finalEmpRes.json()
  assert.strictEqual(finalEmpData.employee.phone, newPhone, "Telefone do colaborador deve ter sido atualizado no banco")
  assert.strictEqual(finalEmpData.employee.address, newAddress, "Endereço do colaborador deve ter sido atualizado no banco")
  console.log(`✔ Aplicação automática validada: Telefone atualizado para '${finalEmpData.employee.phone}' e Endereço para '${finalEmpData.employee.address}'`)

  // --- 8. Teste de Cancelamento de Solicitação pelo Colaborador ---
  console.log(`\n--- 8. Cancelamento de Solicitação pelo Próprio Colaborador ---`)
  // Criar uma nova solicitação simples de declaração
  const reqDeclRes = await fetch(`${BASE_URL}/api/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({
      type: "Declaração de Vínculo",
      requester: "Mariana Souza",
      description: "Declaração para matrícula em curso superior.",
      priority: "Baixa",
    }),
  })
  const reqDeclData = await reqDeclRes.json()
  const declRequestId = reqDeclData.id

  // Colaborador cancela a própria solicitação pendente
  const cancelRes = await fetch(`${BASE_URL}/api/requests/${declRequestId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({ status: "Cancelado" }),
  })
  assert.strictEqual(cancelRes.status, 200, "Colaborador deve conseguir cancelar sua própria solicitação pendente")
  console.log(`✔ Solicitação ${declRequestId} cancelada com sucesso pelo próprio solicitante`)

  // --- 9. Bloqueio de Cancelamento de Solicitação de Outro Usuário ---
  console.log(`\n--- 9. Bloqueio de Cancelamento de Chamado de Terceiros ---`)
  // RH cria uma solicitação interna
  const rhReqRes = await fetch(`${BASE_URL}/api/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      type: "Suporte RH",
      requester: rhAuth.user.name,
      description: "Chamado exclusivo de infraestrutura de RH.",
      priority: "Alta",
    }),
  })
  const rhReqData = await rhReqRes.json()

  // Colaborador comum tenta cancelar o chamado do RH
  const colabCancelOtherRes = await fetch(`${BASE_URL}/api/requests/${rhReqData.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({ status: "Cancelado" }),
  })
  assert.strictEqual(colabCancelOtherRes.status, 403, "Colaborador deve ser bloqueado com 403 ao tentar cancelar chamado de outro usuário")
  console.log(`✔ Segurança validada: Colaborador bloqueado (403) ao tentar cancelar solicitação de outro usuário`)

  // --- 10. Regra Anti-Autoaprovação (Governança Estrita) ---
  console.log(`\n--- 10. Regra Anti-Autoaprovação (Conflito de Interesses) ---`)
  // Usuário do RH tenta aprovar seu próprio chamado
  const rhSelfApproveRes = await fetch(`${BASE_URL}/api/requests/${rhReqData.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({ status: "Aprovado" }),
  })
  assert.strictEqual(rhSelfApproveRes.status, 403, "Aprovação do próprio chamado deve ser rejeitada com 403")
  const selfApproveData = await rhSelfApproveRes.json()
  assert.ok(selfApproveData.error.includes("Governança"), "Erro deve citar Violação de Governança")
  console.log(`✔ Anti-Autoaprovação em vigor: Usuário impedido de aprovar o próprio chamado (403)`)

  // --- 11. Upload Seguro de Documento Pessoal pelo Colaborador ---
  console.log(`\n--- 11. Upload de Documentos Pessoais & Validações ---`)
  const dummyBase64 = Buffer.from("conteudo ficticio de comprovante pdf").toString("base64")

  // Upload válido (PDF)
  const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({
      name: "Comprovante de Residência Atualizado",
      category: "Comprovantes",
      file_base64: dummyBase64,
      mime_type: "application/pdf",
      notes: "Enviado via portal de autoatendimento.",
    }),
  })
  const uploadData = await uploadRes.json()
  assert.strictEqual(uploadRes.status, 201, "Upload de documento pessoal deve retornar 201")
  assert.strictEqual(uploadData.document.origin, "pessoal", "Origem deve ser 'pessoal'")
  const uploadedDocId = uploadData.document.id
  console.log(`✔ Documento pessoal enviado com sucesso: ${uploadedDocId} (Origem: pessoal)`)

  // Tentativa de upload com extensão proibida (.exe / binary malicioso)
  const badUploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabToken}`,
    },
    body: JSON.stringify({
      name: "malware.exe",
      category: "Outros",
      file_base64: dummyBase64,
      mime_type: "application/x-msdownload",
    }),
  })
  assert.strictEqual(badUploadRes.status, 400, "Upload de formato inválido deve retornar 400")
  console.log(`✔ Bloqueio de arquivos maliciosos/não suportados validado com 400`)

  // --- 12. Proteção IDOR no Acesso e Download de Documentos Privados ---
  console.log(`\n--- 12. Proteção IDOR no Acesso e Download de Documentos Privados ---`)
  // Colaborador tenta consultar documento que pertence a outro usuário
  // Criar um documento do RH
  const rhDocRes = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      name: "Relatório Confidencial de Folha",
      category: "Financeiro",
      employeeName: rhAuth.user.name,
      file_base64: dummyBase64,
      mime_type: "application/pdf",
    }),
  })
  const rhDocData = await rhDocRes.json()
  const rhDocId = rhDocData.document.id

  // Mariana tenta consultar o documento confidencial de Victor
  const idorDocGetRes = await fetch(`${BASE_URL}/api/documents/${rhDocId}`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(idorDocGetRes.status, 403, "Colaborador deve receber 403 ao tentar visualizar documento de outro funcionário")

  // Mariana tenta fazer o download do documento confidencial de Victor
  const idorDocDlRes = await fetch(`${BASE_URL}/api/documents/${rhDocId}/download`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(idorDocDlRes.status, 403, "Colaborador deve receber 403 ao tentar baixar documento de outro funcionário")
  console.log(`✔ Proteção IDOR ativa: Tentativa de leitura e download de documento privado bloqueadas com 403`)

  // Mariana baixa seu próprio documento pessoal
  const myDocDlRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}/download`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert.strictEqual(myDocDlRes.status, 200, "Colaborador deve conseguir baixar seu próprio documento")
  const buffer = await myDocDlRes.arrayBuffer()
  assert.ok(buffer.byteLength > 0, "Conteúdo binário deve ser retornado com sucesso")
  console.log(`✔ Download do próprio documento autorizado e verificado com sucesso (${buffer.byteLength} bytes)`)

  console.log(`\n============================================================`)
  console.log(`🎉 TODOS OS 12 TESTES DO PORTAL DE AUTOATENDIMENTO PASSARAM COM 100% DE SUCESSO!`)
  console.log(`============================================================\n`)
}

runTests().catch((err) => {
  console.error("\n❌ FALHA NOS TESTES DE AUTOATENDIMENTO:", err)
  process.exit(1)
})
