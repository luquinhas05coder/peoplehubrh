/**
 * test-rbac-permissions.js
 * Teste automatizado abrangente para o sistema RBAC do PeopleHub RH.
 * Valida autenticação, perfis (ADMIN, RH, GESTOR, COLABORADOR),
 * bloqueios 401/403, anti-autoaprovação, escopos e auditoria.
 */
const BASE_URL = "http://localhost:3001"

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

async function runTests() {
  console.log("==================================================")
  console.log("INICIANDO BATERIA DE TESTES RBAC — PEOPLEHUB RH")
  console.log("==================================================")

  // 1. Testar requisições não autenticadas (HTTP 401)
  console.log("\n[TEST 1] Requisições não autenticadas devem retornar 401:")
  const noAuthUsers = await fetch(`${BASE_URL}/api/users`)
  assert(noAuthUsers.status === 401, "GET /api/users sem token retorna 401")

  const noAuthEmployees = await fetch(`${BASE_URL}/api/employees`)
  assert(noAuthEmployees.status === 401, "GET /api/employees sem token retorna 401")

  const noAuthRequests = await fetch(`${BASE_URL}/api/requests`)
  assert(noAuthRequests.status === 401, "GET /api/requests sem token retorna 401")

  // 2. Testar autenticação dos 4 perfis
  console.log("\n[TEST 2] Autenticação dos 4 perfis fundamentais:")
  const adminLogin = await login("admin@empresa.com")
  assert(adminLogin.status === 200 && adminLogin.token, "Login ADMIN realizado com sucesso", JSON.stringify(adminLogin.data))

  const rhLogin = await login("rh@peoplehub.com.br")
  assert(rhLogin.status === 200 && rhLogin.token, "Login RH realizado com sucesso", JSON.stringify(rhLogin.data))

  const gestorLogin = await login("gestor@peoplehub.com.br")
  assert(gestorLogin.status === 200 && gestorLogin.token, "Login GESTOR realizado com sucesso", JSON.stringify(gestorLogin.data))

  const colabLogin = await login("colaborador@peoplehub.com.br")
  assert(colabLogin.status === 200 && colabLogin.token, "Login COLABORADOR realizado com sucesso", JSON.stringify(colabLogin.data))

  const adminToken = adminLogin.token
  const rhToken = rhLogin.token
  const gestorToken = gestorLogin.token
  const colabToken = colabLogin.token

  // 3. Testar controle de acesso à rota /api/users (Apenas ADMIN)
  console.log("\n[TEST 3] Gestão de Usuários (/api/users):")
  const adminGetUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const adminUsersData = await adminGetUsers.json()
  assert(adminGetUsers.status === 200 && Array.isArray(adminUsersData.users), "ADMIN acessa GET /api/users com sucesso")

  const rhGetUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${rhToken}` },
  })
  assert(rhGetUsers.status === 403, "RH é bloqueado (403) em GET /api/users")

  const gestorGetUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${gestorToken}` },
  })
  assert(gestorGetUsers.status === 403, "GESTOR é bloqueado (403) em GET /api/users")

  const colabGetUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert(colabGetUsers.status === 403, "COLABORADOR é bloqueado (403) em GET /api/users")

  // 4. Testar criação de colaboradores (Apenas ADMIN e RH)
  console.log("\n[TEST 4] Criação de Colaboradores (/api/employees):")
  const newEmpPayload = {
    name: "Funcionario Teste RBAC",
    role: "Analista de Qualidade",
    department: "TI",
    email: `teste.rbac.${Date.now()}@peoplehub.com.br`,
    salary: "R$ 6.500,00",
    cpf: "123.456.789-00",
    sendEmail: false,
  }

  const colabCreateEmp = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: { Authorization: `Bearer ${colabToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(newEmpPayload),
  })
  assert(colabCreateEmp.status === 403, "COLABORADOR bloqueado (403) ao tentar criar colaborador")

  const gestorCreateEmp = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gestorToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(newEmpPayload),
  })
  assert(gestorCreateEmp.status === 403, "GESTOR bloqueado (403) ao tentar criar colaborador")

  const rhCreateEmp = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rhToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(newEmpPayload),
  })
  const rhCreateData = await rhCreateEmp.json()
  assert(rhCreateEmp.status === 201 && rhCreateData.ok, "RH cria colaborador com sucesso (201)")

  // 5. Testar Escopos e Mascaramento de Dados Sensíveis
  console.log("\n[TEST 5] Escopos de Dados e Mascaramento de Salário/CPF:")
  const adminEmpList = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json())

  const gestorEmpList = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${gestorToken}` },
  }).then((r) => r.json())

  const colabEmpList = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  }).then((r) => r.json())

  assert(adminEmpList.employees.length >= gestorEmpList.employees.length, "ADMIN visualiza quadro completo de funcionários")
  
  // GESTOR só pode ver departamento de TI ou liderados
  const gestorNonTi = gestorEmpList.employees.filter((e) => e.department && e.department !== "TI" && e.manager !== "Gestor TI" && e.email !== "gestor@peoplehub.com.br")
  assert(gestorNonTi.length === 0, "GESTOR tem escopo estrito TEAM (apenas TI ou liderados)")

  // Verificar se o GESTOR vê salários mascarados
  const otherInTeam = gestorEmpList.employees.find((e) => e.email !== "gestor@peoplehub.com.br")
  if (otherInTeam) {
    assert(otherInTeam.salary === "Confidencial", "Salário mascarado como 'Confidencial' para o GESTOR")
    assert(otherInTeam.cpf.includes("***"), "CPF mascarado para o GESTOR")
  }

  // COLABORADOR só pode ver a si mesmo
  assert(
    colabEmpList.employees.every((e) => e.email.toLowerCase() === "colaborador@peoplehub.com.br"),
    "COLABORADOR tem escopo estrito OWN (apenas seus próprios dados)"
  )

  // 6. Testar alteração de Role e Segurança de Auto-Despromoção
  console.log("\n[TEST 6] Alteração de Roles e Proteção de Auto-Despromoção:")
  // Encontrar usuário do colaborador
  const targetColabUser = adminUsersData.users.find((u) => u.email === "colaborador@peoplehub.com.br")
  const adminUser = adminUsersData.users.find((u) => u.email === "admin@empresa.com" || u.email === "admin@peoplehub.com.br")

  // Auto-despromoção do ADMIN deve ser bloqueada
  const selfDemoteRes = await fetch(`${BASE_URL}/api/users/${adminUser.id}/role`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "COLABORADOR" }),
  })
  assert(selfDemoteRes.status === 400, "ADMIN impedido de revogar o próprio acesso de administrador (400)")

  // ADMIN altera role do colaborador para GESTOR
  const changeRoleRes = await fetch(`${BASE_URL}/api/users/${targetColabUser.id}/role`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "GESTOR" }),
  })
  const changeRoleData = await changeRoleRes.json()
  assert(changeRoleRes.status === 200 && changeRoleData.role === "GESTOR", "ADMIN altera role do usuário com sucesso")

  // Restaurar role para COLABORADOR
  await fetch(`${BASE_URL}/api/users/${targetColabUser.id}/role`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "COLABORADOR" }),
  })

  // 7. Testar Desativação e Bloqueio de Acesso Imediato
  console.log("\n[TEST 7] Desativação de Usuário e Bloqueio Imediato:")
  // Desativar usuário do colaborador
  const deactRes = await fetch(`${BASE_URL}/api/users/${targetColabUser.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "inactive" }),
  })
  assert(deactRes.status === 200, "ADMIN desativa usuário com sucesso")

  // Tentativa do colaborador desativado acessar rotas com seu token
  const blockedRequest = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  assert(blockedRequest.status === 403, "Usuário desativado é bloqueado imediatamente (403)")

  // Reativar usuário
  const reactRes = await fetch(`${BASE_URL}/api/users/${targetColabUser.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "active" }),
  })
  assert(reactRes.status === 200, "ADMIN reativa usuário com sucesso")

  // 8. Testar Regra Anti Auto-Aprovação em Solicitações
  console.log("\n[TEST 8] Anti-Autoaprovação em Solicitações:")
  // Gestor cria uma solicitação em seu próprio nome
  const createReqRes = await fetch(`${BASE_URL}/api/requests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gestorToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "Férias",
      requester: "Gestor TI",
      department: "TI",
      priority: "Alta",
      description: "Solicitação de férias do próprio gestor",
    }),
  })
  const createReqData = await createReqRes.json()
  const gestorReqId = createReqData.id

  // Gestor tenta aprovar a própria solicitação
  const selfApproveRes = await fetch(`${BASE_URL}/api/requests/${gestorReqId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${gestorToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Aprovado" }),
  })
  assert(selfApproveRes.status === 403, "GESTOR impedido de aprovar sua própria solicitação (Anti-Autoaprovação)")

  // RH aprova a solicitação do gestor
  const rhApproveRes = await fetch(`${BASE_URL}/api/requests/${gestorReqId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rhToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Aprovado" }),
  })
  assert(rhApproveRes.status === 200, "RH aprova solicitação do gestor com sucesso (200)")

  // 9. Testar Auditoria de Ações Sensíveis
  console.log("\n[TEST 9] Trilha de Auditoria (/api/users/audit):")
  const auditRes = await fetch(`${BASE_URL}/api/users/audit`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const auditData = await auditRes.json()
  assert(auditRes.status === 200 && Array.isArray(auditData.logs), "ADMIN consulta trilha de auditoria com sucesso")
  
  const hasRoleChangeAudit = auditData.logs.some((l) => l.action === "ALTERAR_ROLE")
  assert(hasRoleChangeAudit, "Evento 'ALTERAR_ROLE' persistido nos logs de auditoria")

  const hasStatusChangeAudit = auditData.logs.some((l) => l.action === "DESATIVAR_USUARIO")
  assert(hasStatusChangeAudit, "Evento 'DESATIVAR_USUARIO' persistido nos logs de auditoria")

  console.log("\n==================================================")
  console.log(`RESULTADO FINAL: ${passed} PASSARAM, ${failed} FALHARAM`)
  console.log("==================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error("Erro fatal na execução dos testes:", err)
  process.exit(1)
})
