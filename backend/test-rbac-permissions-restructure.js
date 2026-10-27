/**
 * test-rbac-permissions-restructure.js
 * Bateria Completa de Testes Automatizados de Reestruturação de Cargos, Perfis e Permissões (RBAC)
 * PeopleHubRH — Cobre rigorosamente os 15 cenários obrigatórios da Seção 8:
 *
 * 1. Colaborador visualiza seus próprios dados (/api/employees/me e /api/requests).
 * 2. Colaborador não consegue consultar dados privados de outro colaborador (Prevenção IDOR).
 * 3. Colaborador não acessa páginas e endpoints administrativos (/api/users, matriz, etc.).
 * 4. Usuário não autenticado não acessa rotas protegidas (HTTP 401).
 * 5. Gestor acessa apenas os recursos de equipe autorizados (Escopo TEAM).
 * 6. Usuário de RH executa somente as ações concedidas (Gestão de colaboradores permitida, Admin bloqueado).
 * 7. Auditor não consegue modificar dados quando possui apenas leitura (Bloqueio estrito de POST, PUT, DELETE).
 * 8. Administrador autorizado consegue gerenciar permissões e matriz RBAC (/api/users/roles/matrix).
 * 9. Usuário comum não consegue conceder privilégios a si próprio (Anti-Privilege Escalation).
 * 10. Usuário sem permissão não consegue executar operações pela API, mesmo via requisição manual.
 * 11. A revogação de uma permissão impede novas operações protegidas em tempo real.
 * 12. Usuários com múltiplas funções/overrides recebem somente as permissões efetivamente autorizadas.
 * 13. Alterações de IDs em URLs/parâmetros não permitem acesso indevido a registros.
 * 14. Logout e troca de usuário não deixam permissões da sessão anterior disponíveis.
 * 15. Falhas, perfis inválidos, anti-lockout do último admin e permissões ausentes são tratados com segurança.
 */

import "dotenv/config"
import jwt from "jsonwebtoken"

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3009"
const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta_jwt"

let passed = 0
let failed = 0

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✔ [PASS] ${testName}`)
    passed++
  } else {
    console.error(`  ✖ [FAIL] ${testName} - ${details}`)
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
  console.log("\n============================================================")
  console.log("🔒 INICIANDO BATERIA DE TESTES — REESTRUTURAÇÃO RBAC (15 CENÁRIOS)")
  console.log("============================================================")

  // -------------------------------------------------------------
  // CENÁRIO 4: Usuário não autenticado não acessa rotas protegidas (HTTP 401)
  // -------------------------------------------------------------
  console.log("\n--- Cenário 4: Usuário não autenticado não acessa rotas protegidas (HTTP 401) ---")
  const noAuthUsers = await fetch(`${BASE_URL}/api/users`)
  assert(noAuthUsers.status === 401, "GET /api/users sem token retorna 401 Unauthorized")

  const noAuthEmployees = await fetch(`${BASE_URL}/api/employees`)
  assert(noAuthEmployees.status === 401, "GET /api/employees sem token retorna 401 Unauthorized")

  const noAuthRequests = await fetch(`${BASE_URL}/api/requests`)
  assert(noAuthRequests.status === 401, "GET /api/requests sem token retorna 401 Unauthorized")

  const noAuthJobs = await fetch(`${BASE_URL}/api/recruitment/jobs`)
  assert(noAuthJobs.status === 401, "GET /api/recruitment/jobs sem token retorna 401 Unauthorized")

  // Autenticação das contas de teste para os próximos cenários
  const adminAuth = await login("admin@empresa.com")
  const rhAuth = await login("rh@peoplehub.com.br")
  const gestorAuth = await login("gestor@peoplehub.com.br")
  const colabAuth = await login("colaborador@peoplehub.com.br")
  const recrutadorAuth = await login("recrutador@peoplehub.com.br")
  const auditorAuth = await login("auditor@peoplehub.com.br")
  const dpAuth = await login("dp@peoplehub.com.br")

  assert(adminAuth.status === 200 && adminAuth.token, "Login ADMIN realizado com sucesso")
  assert(rhAuth.status === 200 && rhAuth.token, "Login RH realizado com sucesso")
  assert(gestorAuth.status === 200 && gestorAuth.token, "Login GESTOR realizado com sucesso")
  assert(colabAuth.status === 200 && colabAuth.token, "Login COLABORADOR realizado com sucesso")
  assert(recrutadorAuth.status === 200 && recrutadorAuth.token, "Login RECRUTADOR realizado com sucesso")
  assert(auditorAuth.status === 200 && auditorAuth.token, "Login AUDITOR realizado com sucesso")
  assert(dpAuth.status === 200 && dpAuth.token, "Login DP realizado com sucesso")

  // -------------------------------------------------------------
  // CENÁRIO 1: Colaborador visualiza seus próprios dados
  // -------------------------------------------------------------
  console.log("\n--- Cenário 1: Colaborador visualiza seus próprios dados (/me e solicitações) ---")
  const colabMeRes = await fetch(`${BASE_URL}/api/employees/me`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const colabMeData = await colabMeRes.json()
  assert(colabMeRes.status === 200 && colabMeData.ok, "Colaborador acessa GET /api/employees/me com sucesso (200)")
  assert(
    colabMeData.employee && colabMeData.employee.email === "colaborador@peoplehub.com.br",
    "Dados retornados em /me correspondem exatamente ao colaborador autenticado"
  )

  const colabRequestsRes = await fetch(`${BASE_URL}/api/requests`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const colabRequestsData = await colabRequestsRes.json()
  assert(colabRequestsRes.status === 200 && Array.isArray(colabRequestsData.requests), "Colaborador lista solicitações próprias com escopo OWN")
  const anyNonColabReq = colabRequestsData.requests.some(
    (r) =>
      r.requester.toLowerCase() !== "gabriel santos" &&
      r.requester.toLowerCase() !== "colaborador@peoplehub.com.br"
  )
  assert(!anyNonColabReq, "Nenhuma solicitação de outro colaborador é exibida para o perfil COLABORADOR")

  // Obter funcionários reais para validação de IDOR e escopos
  const allEmpsRes = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  const allEmpsData = await allEmpsRes.json()
  const allEmpsList = allEmpsData.employees || []
  const otherEmp = allEmpsList.find((e) => (e.email || "").toLowerCase() !== "colaborador@peoplehub.com.br") || { id: "emp_colab_01" }
  const nonTiEmp = allEmpsList.find((e) => (e.department || "").toLowerCase() !== "ti") || { id: "emp_01" }

  // -------------------------------------------------------------
  // CENÁRIO 2: Colaborador não consegue consultar dados privados de outro colaborador (IDOR)
  // -------------------------------------------------------------
  console.log("\n--- Cenário 2: Colaborador não consegue consultar dados privados de outro colaborador (IDOR) ---")
  const colabOtherEmpRes = await fetch(`${BASE_URL}/api/employees/${otherEmp.id}`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(
    colabOtherEmpRes.status === 403,
    `Tentativa de consultar colaborador externo (${otherEmp.id}) por COLABORADOR retorna 403 Forbidden`
  )

  // -------------------------------------------------------------
  // CENÁRIO 3: Colaborador não acessa endpoints/rotas administrativas
  // -------------------------------------------------------------
  console.log("\n--- Cenário 3: Colaborador não acessa endpoints administrativos ---")
  const colabGetUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(colabGetUsers.status === 403, "COLABORADOR é bloqueado (403) em GET /api/users")

  const colabGetMatrix = await fetch(`${BASE_URL}/api/users/roles/matrix`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(colabGetMatrix.status === 403, "COLABORADOR é bloqueado (403) em GET /api/users/roles/matrix")

  const colabWebhooks = await fetch(`${BASE_URL}/api/integrations/webhooks/endpoints`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(colabWebhooks.status === 403, "COLABORADOR é bloqueado (403) em configurações de webhooks")

  // -------------------------------------------------------------
  // CENÁRIO 5: Gestor acessa apenas os recursos de equipe autorizados
  // -------------------------------------------------------------
  console.log("\n--- Cenário 5: Gestor acessa apenas os recursos de equipe autorizados (Escopo TEAM) ---")
  const gestorListRes = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${gestorAuth.token}` },
  })
  const gestorListData = await gestorListRes.json()
  assert(gestorListRes.status === 200 && Array.isArray(gestorListData.employees), "GESTOR lista colaboradores autorizados")
  
  // Garantir que todos os colaboradores listados pertencem ao departamento do Gestor (TI) ou subordinados
  const nonTeamMember = gestorListData.employees.some(
    (e) => (e.department || "").toLowerCase() !== "ti" && (e.manager || "").toLowerCase() !== "gestor ti"
  )
  assert(!nonTeamMember, "GESTOR tem visualização restrita à sua própria equipe/departamento (TI)")

  // Gestor tentando acessar funcionário de outro departamento por ID
  const gestorOtherDeptRes = await fetch(`${BASE_URL}/api/employees/${nonTiEmp.id}`, {
    headers: { Authorization: `Bearer ${gestorAuth.token}` },
  })
  assert(
    gestorOtherDeptRes.status === 403,
    `GESTOR tentando acessar registro de outro departamento (${nonTiEmp.department || 'Outro'}) retorna 403 Forbidden`
  )

  // -------------------------------------------------------------
  // CENÁRIO 6: Usuário de RH executa somente as ações concedidas
  // -------------------------------------------------------------
  console.log("\n--- Cenário 6: Usuário de RH executa somente as ações concedidas ---")
  const rhListEmps = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  assert(rhListEmps.status === 200, "RH acessa listagem geral de colaboradores com sucesso (200)")

  const rhCreateEmp = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhAuth.token}`,
    },
    body: JSON.stringify({
      name: "Novo Contratado RH Teste",
      role: "Especialista em Benefícios",
      department: "Recursos Humanos",
      email: `rh.teste.${Date.now()}@peoplehub.com.br`,
      salary: "R$ 6.000,00",
      cpf: "111.222.333-44",
      sendEmail: false,
    }),
  })
  assert(rhCreateEmp.status === 201 || rhCreateEmp.status === 200, "RH possui permissão para cadastrar novo colaborador")

  // RH tentando acessar gestão de usuários do sistema (/api/users)
  const rhUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  assert(rhUsers.status === 403, "RH é impedido (403) de gerenciar usuários do sistema")

  const rhModifyMatrix = await fetch(`${BASE_URL}/api/users/roles/ADMIN/permissions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhAuth.token}`,
    },
    body: JSON.stringify({ permissions: [] }),
  })
  assert(rhModifyMatrix.status === 403, "RH é impedido (403) de alterar permissões de roles")

  // -------------------------------------------------------------
  // CENÁRIO 6.1: Departamento Pessoal (DP) executa rotinas burocráticas, folha, ponto e dados sensíveis
  // -------------------------------------------------------------
  console.log("\n--- Cenário 6.1: Departamento Pessoal (DP) — Rotinas Trabalhistas, Folha, Ponto, SST e LGPD ---")
  
  // 1. DP visualiza colaboradores com acesso a dados sensíveis (LGPD - salário e CPF não mascarados)
  const dpEmployeesRes = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${dpAuth.token}` },
  })
  assert(dpEmployeesRes.status === 200, "DP possui permissão para listar colaboradores (200 OK)")
  const dpEmployeesData = await dpEmployeesRes.json()
  const sampleEmp = (dpEmployeesData.employees || [])[0]
  assert(
    sampleEmp && sampleEmp.salary !== undefined,
    "DP possui permissão 'employees.view_sensitive' e visualiza dados contratuais/salariais"
  )

  // 2. DP possui permissão de Admissão (employees.create)
  const dpNewAdmission = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${dpAuth.token}`,
    },
    body: JSON.stringify({
      name: "Novo Colaborador CLT Admissao DP",
      email: `admissao.dp.${Date.now()}@peoplehub.com.br`,
      role: "Assistente Administrativo",
      department: "Operações",
      salary: 3200,
      cpf: "333.444.555-66",
      sendEmail: false,
    }),
  })
  assert(dpNewAdmission.status === 201 || dpNewAdmission.status === 200, "DP possui permissão para executar Admissão (employees.create)")

  // 3. DP possui acesso à gestão de solicitações (ponto, férias, atestados e benefícios)
  const dpRequestsRes = await fetch(`${BASE_URL}/api/requests`, {
    headers: { Authorization: `Bearer ${dpAuth.token}` },
  })
  assert(dpRequestsRes.status === 200, "DP possui permissão para consultar solicitações (requests.view / vacations.view)")

  // 4. DP é bloqueado (403) de gerenciar contas de usuários do sistema (/api/users)
  const dpUsersRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${dpAuth.token}` },
  })
  assert(dpUsersRes.status === 403, "DP é impedido (403) de gerenciar usuários e governança do sistema")

  // 5. DP é bloqueado (403) de excluir vagas do ATS (recrutamento é do Recrutador/RH)
  const dpDeleteJobRes = await fetch(`${BASE_URL}/api/recruitment/jobs/fake_job_id`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${dpAuth.token}` },
  })
  assert(dpDeleteJobRes.status === 403, "DP é impedido (403) de excluir vagas do módulo de R&S/ATS")

  // -------------------------------------------------------------
  // CENÁRIO 7: Auditor não consegue modificar dados quando possui apenas leitura
  // -------------------------------------------------------------
  console.log("\n--- Cenário 7: Auditor não consegue modificar dados (Acesso Estritamente Leitura) ---")
  const auditorReadEmps = await fetch(`${BASE_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${auditorAuth.token}` },
  })
  assert(auditorReadEmps.status === 200, "AUDITOR possui acesso de leitura aos colaboradores (200 OK)")

  const auditorReadReports = await fetch(`${BASE_URL}/api/reports`, {
    headers: { Authorization: `Bearer ${auditorAuth.token}` },
  })
  assert(auditorReadReports.status === 200, "AUDITOR possui acesso de leitura a relatórios corporativos")

  // Tentativas de mutação pelo Auditor devem ser bloqueadas com 403
  const auditorPostEmp = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auditorAuth.token}`,
    },
    body: JSON.stringify({ name: "Tentativa Auditor", role: "Dev", email: "aud@empresa.com" }),
  })
  assert(auditorPostEmp.status === 403, "AUDITOR é bloqueado (403) ao tentar executar POST /api/employees")

  const auditorPutEmp = await fetch(`${BASE_URL}/api/employees/emp_colab_01`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auditorAuth.token}`,
    },
    body: JSON.stringify({ name: "Tentativa Update" }),
  })
  assert(auditorPutEmp.status === 403, "AUDITOR é bloqueado (403) ao tentar executar PUT /api/employees/:id")

  const auditorDeleteEmp = await fetch(`${BASE_URL}/api/employees/emp_colab_01`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auditorAuth.token}` },
  })
  assert(auditorDeleteEmp.status === 403, "AUDITOR é bloqueado (403) ao tentar executar DELETE /api/employees/:id")

  const auditorPostReq = await fetch(`${BASE_URL}/api/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auditorAuth.token}`,
    },
    body: JSON.stringify({ type: "Teste", requester: "Arthur", description: "Audit Test" }),
  })
  assert(auditorPostReq.status === 403, "AUDITOR é bloqueado (403) ao tentar criar solicitações (POST /api/requests)")

  // -------------------------------------------------------------
  // CENÁRIO 8: Administrador autorizado consegue gerenciar permissões
  // -------------------------------------------------------------
  console.log("\n--- Cenário 8: Administrador autorizado gerencia permissões e matriz RBAC ---")
  const adminMatrixRes = await fetch(`${BASE_URL}/api/users/roles/matrix`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  })
  const adminMatrixData = await adminMatrixRes.json()
  assert(
    adminMatrixRes.status === 200 && adminMatrixData.roles && (adminMatrixData.groups || adminMatrixData.permissionGroups),
    "ADMIN consulta a matriz de perfis e permissões (/api/users/roles/matrix)"
  )

  // Atualizar permissões do perfil RECRUTADOR
  const newRecrutadorPerms = [
    "recruitment.view",
    "recruitment.create",
    "recruitment.edit",
    "recruitment.interviews",
    "notifications.view",
  ]
  const updateRolePermsRes = await fetch(`${BASE_URL}/api/users/roles/RECRUTADOR/permissions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.token}`,
    },
    body: JSON.stringify({ permissions: newRecrutadorPerms }),
  })
  const updateRolePermsData = await updateRolePermsRes.json()
  assert(
    updateRolePermsRes.status === 200 && updateRolePermsData.ok,
    "ADMIN atualiza permissões da role RECRUTADOR com sucesso"
  )

  // -------------------------------------------------------------
  // CENÁRIO 9: Usuário comum não consegue conceder privilégios a si próprio
  // -------------------------------------------------------------
  console.log("\n--- Cenário 9: Usuário comum não consegue conceder privilégios a si próprio ---")
  const colabEscalateRes = await fetch(`${BASE_URL}/api/users/usr_colab/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabAuth.token}`,
    },
    body: JSON.stringify({ permission: "users.manage", granted: true }),
  })
  assert(
    colabEscalateRes.status === 403,
    "COLABORADOR impedido (403) de conceder permissões para si próprio"
  )

  const gestorPromoteRes = await fetch(`${BASE_URL}/api/users/usr_gestor/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gestorAuth.token}`,
    },
    body: JSON.stringify({ role: "ADMIN" }),
  })
  assert(
    gestorPromoteRes.status === 403,
    "GESTOR impedido (403) de promover seu próprio perfil para ADMIN"
  )

  // -------------------------------------------------------------
  // CENÁRIO 10: Usuário sem permissão bloqueado mesmo via requisição manual direta
  // -------------------------------------------------------------
  console.log("\n--- Cenário 10: Usuário sem permissão bloqueado em requisições diretas à API ---")
  const recrutadorDeleteEmp = await fetch(`${BASE_URL}/api/employees/emp_colab_01`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${recrutadorAuth.token}` },
  })
  assert(
    recrutadorDeleteEmp.status === 403,
    "RECRUTADOR bloqueado (403) ao enviar requisição DELETE /api/employees"
  )

  const colabCreateJob = await fetch(`${BASE_URL}/api/recruitment/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabAuth.token}`,
    },
    body: JSON.stringify({ title: "Vaga Falsa", department: "TI" }),
  })
  assert(
    colabCreateJob.status === 403,
    "COLABORADOR bloqueado (403) ao enviar requisição POST /api/recruitment/jobs"
  )

  // -------------------------------------------------------------
  // CENÁRIO 11: Revogação de permissão impede novas operações protegidas imediatamente
  // -------------------------------------------------------------
  console.log("\n--- Cenário 11: Revogação de permissão tem efeito imediato no backend ---")
  // 1. Admin revoga explicitamente permissão 'requests.create' do colaborador
  const revokeRes = await fetch(`${BASE_URL}/api/users/usr_colab/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.token}`,
    },
    body: JSON.stringify({ permission: "requests.create", granted: false }),
  })
  assert(revokeRes.status === 200, "ADMIN revoga explicitamente a permissão 'requests.create' de usr_colab")

  // 2. Colaborador tenta criar solicitação -> deve receber 403
  const colabTryCreateReq = await fetch(`${BASE_URL}/api/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${colabAuth.token}`,
    },
    body: JSON.stringify({
      type: "Declaração de Trabalho",
      description: "Teste de permissão revogada",
    }),
  })
  assert(
    colabTryCreateReq.status === 403,
    "COLABORADOR é bloqueado (403 Forbidden) imediatamente após a revogação da permissão"
  )

  // 3. Restaurar permissão
  const restoreRes = await fetch(`${BASE_URL}/api/users/usr_colab/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.token}`,
    },
    body: JSON.stringify({ permission: "requests.create", granted: true }),
  })
  assert(restoreRes.status === 200, "ADMIN restaura permissão 'requests.create' com sucesso")

  // -------------------------------------------------------------
  // CENÁRIO 12: Usuários com múltiplas funções/overrides recebem somente o autorizado
  // -------------------------------------------------------------
  console.log("\n--- Cenário 12: Múltiplas funções/overrides concedem apenas o autorizado ---")
  // Conceder permissão pontual 'reports.view' para o colaborador
  const grantReportRes = await fetch(`${BASE_URL}/api/users/usr_colab/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.token}`,
    },
    body: JSON.stringify({ permission: "reports.view", granted: true }),
  })
  assert(grantReportRes.status === 200, "Permissão pontual 'reports.view' concedida ao colaborador")

  // Colaborador agora pode acessar /api/reports
  const colabReportsRes = await fetch(`${BASE_URL}/api/reports`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(
    colabReportsRes.status === 200,
    "COLABORADOR consegue acessar /api/reports graças ao override autorizado"
  )

  // Mas continua rigorosamente proibido em operações não autorizadas
  const colabStillBlockedUsers = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(
    colabStillBlockedUsers.status === 403,
    "COLABORADOR continua bloqueado (403) em /api/users sem ampliação indevida de privilégios"
  )

  // -------------------------------------------------------------
  // CENÁRIO 13: Alterações de IDs não permitem acesso indevido (IDOR Prevention)
  // -------------------------------------------------------------
  console.log("\n--- Cenário 13: Alterações de IDs em URLs não permitem acesso indevido (Anti-IDOR) ---")
  const idorDocRes = await fetch(`${BASE_URL}/api/documents/DOC-PRIVADO-RH-001/download`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(
    idorDocRes.status === 403 || idorDocRes.status === 404,
    "Tentativa de baixar documento confidencial de outro colaborador via alteração de ID é barrada com 403/404"
  )

  const idorDeleteReq = await fetch(`${BASE_URL}/api/requests/REQ-101/cancel`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  assert(
    idorDeleteReq.status === 403 || idorDeleteReq.status === 404,
    "Tentativa de cancelar chamado alheio via adulteração de ID é barrada com 403/404"
  )

  // -------------------------------------------------------------
  // CENÁRIO 14: Logout e troca de usuário não deixam permissões anteriores disponíveis
  // -------------------------------------------------------------
  console.log("\n--- Cenário 14: Logout e troca de usuário com sessões independentes ---")
  // Fazer login como Admin e depois acionar logout
  const adminTemp = await login("admin@empresa.com")
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminTemp.token}` },
  })
  assert(logoutRes.status === 200, "Logout da sessão executado com sucesso (/api/auth/logout)")

  // Trocar para sessão de Colaborador e verificar se a sessão reflete somente o papel atual
  const colabNewSession = await login("colaborador@peoplehub.com.br")
  const meNewRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${colabNewSession.token}` },
  })
  const meNewData = await meNewRes.json()
  assert(
    meNewData.user && meNewData.user.userRole === "COLABORADOR",
    "Nova sessão do colaborador reflete exatamente seu papel COLABORADOR e permissões restritas"
  )
  assert(
    !meNewData.user.permissions.includes("users.manage"),
    "Sessão do colaborador não herda permissões administrativas da sessão anterior"
  )

  // -------------------------------------------------------------
  // CENÁRIO 15: Falhas, perfis inválidos e Anti-Lockout do último Administrador
  // -------------------------------------------------------------
  console.log("\n--- Cenário 15: Falhas, perfis inválidos e Anti-Lockout do Administrador ---")
  // 1. Anti-Lockout: Tentativa de alterar o papel do único ADMIN ativo
  const demoteAdminRes = await fetch(`${BASE_URL}/api/users/u_admin/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.token}`,
    },
    body: JSON.stringify({ role: "COLABORADOR" }),
  })
  assert(
    demoteAdminRes.status === 400,
    "Anti-Lockout: Bloqueada com 400 tentativa de rebaixar cargo do único administrador ativo"
  )

  // 2. Anti-Lockout: Tentativa de desativar o status do único ADMIN ativo
  const deactivateAdminRes = await fetch(`${BASE_URL}/api/users/u_admin/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.token}`,
    },
    body: JSON.stringify({ status: "inactive" }),
  })
  assert(
    deactivateAdminRes.status === 400,
    "Anti-Lockout: Bloqueada com 400 tentativa de inativar o único administrador ativo"
  )

  // 3. Tentativa de escalonamento vertical: token forjado com role ADMIN para usuário comum
  const colabUserId = colabAuth.data?.user?.id || "usr_colab"
  const tamperedRoleToken = jwt.sign(
    {
      sub: colabUserId,
      userId: colabUserId,
      email: colabAuth.data?.user?.email || "colaborador@peoplehub.com.br",
      name: colabAuth.data?.user?.name || "Gabriel Santos",
      role: "ADMIN", // Tentativa de forjar cargo de ADMIN no token
      type: "session",
      tenant_id: "tenant_default",
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  )

  const tamperedAccess = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${tamperedRoleToken}` },
  })
  const tamperedBody = await tamperedAccess.text()
  assert(
    tamperedAccess.status === 403,
    "Tentativa de escalonamento via JWT forjado com role 'ADMIN' é bloqueada pelo servidor (403 Forbidden)",
    `Status retornado: ${tamperedAccess.status} - Corpo: ${tamperedBody}`
  )

  // 4. Token para usuário inexistente no banco de dados é rejeitado com 401
  const unknownUserToken = jwt.sign(
    {
      sub: "usuario_fantasma_999",
      email: "fantasma@fake.com",
      type: "session",
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  )
  const unknownUserAccess = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${unknownUserToken}` },
  })
  assert(
    unknownUserAccess.status === 401,
    "Token para usuário inexistente no banco de dados é rejeitado com 401 Unauthorized"
  )

  console.log("\n============================================================")
  if (failed === 0) {
    console.log(`🎉 TODOS OS ${passed} TESTES DE RBAC PASSARAM COM 100% DE SUCESSO!`)
  } else {
    console.error(`💥 ${failed} testes falharam de um total de ${passed + failed}.`)
    process.exit(1)
  }
  console.log("============================================================\n")
}

runTests().catch((err) => {
  console.error("Erro fatal na execução dos testes RBAC:", err)
  process.exit(1)
})
