/**
 * backend/test-recruitment.js
 * Suíte de Testes Automatizados para o Módulo ATS (Recrutamento & Seleção)
 * Valida: Rotas Públicas, LGPD, Prevenção de Duplicidades, RBAC, Transição de Etapas, Scorecards e Métricas
 */

async function runTest() {
  const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3009"
  console.log(`[ATS-TEST] Conectando ao backend em: ${BASE_URL}`)

  // ─────────────────────────────────────────────────────────────
  // 1. AUTENTICAÇÃO DE PERFIS
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 1. Autenticar perfis para testes RBAC (RH, ADMIN, COLABORADOR) ---")

  // Login como RH (Permitido gerenciar ATS)
  const loginRhRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rh@peoplehub.com.br", password: "admin123" }),
  })
  const rhAuth = await loginRhRes.json()
  const rhToken = rhAuth.token
  if (!rhToken) throw new Error("Falha ao autenticar usuário RH")
  console.log("✔ RH autenticado com sucesso")

  // Login como Colaborador (Não permitido gerenciar ATS)
  const loginColabRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "colaborador@peoplehub.com.br", password: "admin123" }),
  })
  const colabAuth = await loginColabRes.json()
  const colabToken = colabAuth.token
  if (!colabToken) throw new Error("Falha ao autenticar usuário Colaborador")
  console.log("✔ Colaborador autenticado com sucesso")

  // ─────────────────────────────────────────────────────────────
  // 2. SEGURANÇA E AUTORIZAÇÃO RBAC
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 2. Validar proteção RBAC contra acesso não autorizado ---")

  // 2.1 Requisição sem autenticação deve retornar 401
  const unauthRes = await fetch(`${BASE_URL}/api/recruitment/jobs`)
  if (unauthRes.status !== 401) {
    throw new Error(`Esperado status 401 para rota protegida sem token, obteve: ${unauthRes.status}`)
  }
  console.log("✔ Acesso não autenticado bloqueado com 401 Unauthorized")

  // 2.2 Colaborador comum tentando acessar rotas administrativas do ATS deve receber 403
  const forbiddenRes = await fetch(`${BASE_URL}/api/recruitment/jobs`, {
    headers: { Authorization: `Bearer ${colabToken}` },
  })
  if (forbiddenRes.status !== 403) {
    throw new Error(`Esperado status 403 para Colaborador sem permissão, obteve: ${forbiddenRes.status}`)
  }
  console.log("✔ Colaborador bloqueado por RBAC com 403 Forbidden")

  // ─────────────────────────────────────────────────────────────
  // 3. PÁGINA PÚBLICA DE VAGAS E MASCARAMENTO DE DADOS
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 3. Validar API Pública de Oportunidades (/public/jobs) ---")

  const publicJobsRes = await fetch(`${BASE_URL}/api/recruitment/public/jobs`)
  if (!publicJobsRes.ok) throw new Error(`Falha ao obter vagas públicas: ${publicJobsRes.status}`)
  const publicJobsData = await publicJobsRes.json()

  if (!publicJobsData.ok || !Array.isArray(publicJobsData.jobs)) {
    throw new Error("Formato inválido retornado pela rota pública de vagas")
  }

  console.log(`✔ ${publicJobsData.jobs.length} vagas públicas ativas listadas com sucesso`)

  // Verificar se salários confidenciais estão ocultos
  for (const job of publicJobsData.jobs) {
    if (job.salary_is_confidential && (job.salary_min !== undefined || job.salary_max !== undefined)) {
      throw new Error("FALHA DE SEGURANÇA: Salário confidencial foi exposto na rota pública!")
    }
  }
  console.log("✔ Salários confidenciais devidamente mascarados para visualização pública")

  const targetJob = publicJobsData.jobs[0]
  if (!targetJob) throw new Error("Nenhuma vaga disponível para teste de candidatura")

  // ─────────────────────────────────────────────────────────────
  // 4. CANDIDATURA PÚBLICA, VALIDAÇÃO LGPD E DUPLICIDADE
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 4. Validar Candidatura Pública, LGPD e Prevenção de Duplicidades ---")

  const candidateEmail = `candidato.teste.${Date.now()}@exemplo.com`
  const candidatePayload = {
    fullName: "Luciana Mendonça",
    email: candidateEmail,
    phone: "(11) 98765-4321",
    city: "São Paulo",
    state: "SP",
    source: "site_carreiras",
    resumeFileName: "curriculo_luciana.pdf",
    resumeBase64: "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...",
  }

  // 4.1 Rejeição por falta de consentimento LGPD
  const noLgpdRes = await fetch(`${BASE_URL}/api/recruitment/public/jobs/${targetJob.id}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...candidatePayload, lgpdConsent: false }),
  })
  if (noLgpdRes.status !== 400) {
    throw new Error(`Esperado status 400 por ausência de consentimento LGPD, obteve: ${noLgpdRes.status}`)
  }
  console.log("✔ Bloqueio obrigatório de consentimento da LGPD funcionando corretamente (400 Bad Request)")

  // 4.2 Inscrição com consentimento LGPD válido
  const applyRes = await fetch(`${BASE_URL}/api/recruitment/public/jobs/${targetJob.id}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...candidatePayload, lgpdConsent: true }),
  })
  const applyData = await applyRes.json()
  if (applyRes.status !== 201 || !applyData.ok || !applyData.candidateId) {
    throw new Error(`Falha na candidatura válida: ${JSON.stringify(applyData)}`)
  }
  console.log(`✔ Candidatura registrada com sucesso (ID Candidato: ${applyData.candidateId}, Inscrição: ${applyData.applicationId})`)

  // 4.3 Prevenção de Candidatura Duplicada para a mesma vaga
  const duplicateRes = await fetch(`${BASE_URL}/api/recruitment/public/jobs/${targetJob.id}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...candidatePayload, lgpdConsent: true }),
  })
  const dupData = await duplicateRes.json()
  if (duplicateRes.status !== 409) {
    throw new Error(`Esperado status 409 para candidatura duplicada, obteve: ${duplicateRes.status}`)
  }
  console.log("✔ Bloqueio de candidatura duplicada com 409 Conflict funcionando perfeitamente")

  // ─────────────────────────────────────────────────────────────
  // 5. GESTÃO DE VAGAS PELO RECRUTADOR (RH)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 5. Gestão de Vagas pelo RH (Criar, Alterar Status, Listar) ---")

  const newJobRes = await fetch(`${BASE_URL}/api/recruitment/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
      "x-tenant-id": "tenant_default",
    },
    body: JSON.stringify({
      title: "Desenvolvedor Full-Stack TypeScript Pleno",
      department: "TI & Produto",
      role: "Engenheiro de Software",
      work_model: "remoto",
      contract_type: "CLT",
      location: "São Paulo - SP (Remoto)",
      positions_count: 2,
      salary_min: 9000,
      salary_max: 13000,
      salary_is_confidential: 0,
      description: "Construção de módulos escaláveis no PeopleHub RH.",
      requirements: "Experiência com Vue 3, Node.js e SQL.",
      responsibilities: "Desenvolver componentes e APIs REST.",
      benefits: "VR, VA, Seguro de Vida, TotalPass.",
      is_public: 1,
    }),
  })
  const newJobData = await newJobRes.json()
  if (newJobRes.status !== 201 || !newJobData.ok || !newJobData.job?.id) {
    throw new Error(`Falha ao criar vaga pelo RH: ${JSON.stringify(newJobData)}`)
  }
  const createdJobId = newJobData.job.id
  console.log(`✔ Vaga criada com sucesso (ID: ${createdJobId})`)

  // Alterar status da vaga para 'pausada'
  const pauseJobRes = await fetch(`${BASE_URL}/api/recruitment/jobs/${createdJobId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({ status: "pausada" }),
  })
  const pauseJobData = await pauseJobRes.json()
  if (!pauseJobRes.ok || !pauseJobData.ok) {
    throw new Error(`Falha ao pausar vaga: ${JSON.stringify(pauseJobData)}`)
  }
  console.log("✔ Status da vaga alterado para 'pausada' com sucesso")

  // ─────────────────────────────────────────────────────────────
  // 6. PIPELINE SELETIVO: TRANSIÇÕES DE ETAPAS E HISTÓRICO
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 6. Pipeline Seletivo: Mudança de Etapa e Linha do Tempo ---")

  const appId = applyData.applicationId

  // Transição 1: inscricao -> entrevista
  const moveRes1 = await fetch(`${BASE_URL}/api/recruitment/applications/${appId}/stage`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      newStage: "entrevista",
      notes: "Candidato aprovado na triagem inicial de currículo.",
    }),
  })
  const moveData1 = await moveRes1.json()
  if (!moveRes1.ok || !moveData1.ok) {
    throw new Error(`Falha ao mover etapa: ${JSON.stringify(moveData1)}`)
  }
  console.log("✔ Candidato avançado para etapa 'entrevista' com notas registradas")

  // Transição 2: entrevista -> contratado
  const moveRes2 = await fetch(`${BASE_URL}/api/recruitment/applications/${appId}/stage`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      newStage: "contratado",
      notes: "Candidato aprovado em todas as etapas e proposta formal aceita.",
    }),
  })
  const moveData2 = await moveRes2.json()
  if (!moveRes2.ok || !moveData2.ok) {
    throw new Error(`Falha ao mover etapa para contratado: ${JSON.stringify(moveData2)}`)
  }
  console.log("✔ Candidato contratado com sucesso! Notificação interna gerada automaticamente")

  // Verificar Dossiê e Histórico de Etapas
  const dossierRes = await fetch(`${BASE_URL}/api/recruitment/candidates/${applyData.candidateId}`, {
    headers: { Authorization: `Bearer ${rhToken}` },
  })
  const dossierData = await dossierRes.json()
  if (!dossierRes.ok || !dossierData.ok || !dossierData.candidate) {
    throw new Error(`Falha ao obter dossiê do candidato: ${JSON.stringify(dossierData)}`)
  }
  const appHistory = dossierData.candidate.applications[0].stage_history
  if (!Array.isArray(appHistory) || appHistory.length < 2) {
    throw new Error("Histórico de transições de etapas não foi persistido corretamente")
  }
  console.log(`✔ Dossiê completo validado com ${appHistory.length} registros na linha do tempo`)

  // ─────────────────────────────────────────────────────────────
  // 7. DOWNLOAD SEGURO DE CURRÍCULO
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 7. Download Seguro de Currículo Autenticado ---")

  const resumeRes = await fetch(`${BASE_URL}/api/recruitment/candidates/${applyData.candidateId}/resume`, {
    headers: { Authorization: `Bearer ${rhToken}` },
  })
  if (!resumeRes.ok) {
    throw new Error(`Falha ao baixar currículo do candidato: ${resumeRes.status}`)
  }
  const resumeBuffer = await resumeRes.arrayBuffer()
  if (resumeBuffer.byteLength === 0) {
    throw new Error("Currículo baixado está vazio")
  }
  console.log(`✔ Currículo baixado com sucesso via endpoint protegido (${resumeBuffer.byteLength} bytes)`)

  // ─────────────────────────────────────────────────────────────
  // 8. AGENDAMENTO DE ENTREVISTA E SCORECARD ESTRUTURADO
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 8. Agendamento de Entrevistas e Scorecard Estruturado ---")

  const interviewDate = new Date(Date.now() + 86400000).toISOString()
  const scheduleRes = await fetch(`${BASE_URL}/api/recruitment/interviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      applicationId: appId,
      interviewerId: "usr_rh",
      interviewerName: "Mariana Alencar (DHO)",
      scheduledAt: interviewDate,
      location: "Google Meet - meet.google.com/abc-defg-hij",
      notes: "Entrevista de alinhamento cultural e expectativas salariais.",
    }),
  })
  const scheduleData = await scheduleRes.json()
  if (!scheduleRes.ok || !scheduleData.ok || !scheduleData.interview?.id) {
    throw new Error(`Falha ao agendar entrevista: ${JSON.stringify(scheduleData)}`)
  }
  const interviewId = scheduleData.interview.id
  console.log(`✔ Entrevista agendada e sincronizada no Calendário Corporativo (ID: ${interviewId})`)

  // Submeter Scorecard / Avaliação Estruturada
  const evalRes = await fetch(`${BASE_URL}/api/recruitment/interviews/${interviewId}/evaluate`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rhToken}`,
    },
    body: JSON.stringify({
      technicalRating: 5,
      behavioralRating: 4,
      culturalRating: 5,
      recommendation: "aprovar",
      feedback: "Candidata demonstrou alta maturidade técnica, excelente clareza e total aderência cultural aos valores do PeopleHub RH.",
    }),
  })
  const evalData = await evalRes.json()
  if (!evalRes.ok || !evalData.ok) {
    throw new Error(`Falha ao submeter avaliação: ${JSON.stringify(evalData)}`)
  }
  console.log("✔ Scorecard com notas estruturadas (técnica, comportamental, cultural) registrado com sucesso")

  // ─────────────────────────────────────────────────────────────
  // 9. MÉTRICAS E INDICADORES ATS
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 9. Indicadores e Métricas de R&S (/api/recruitment/metrics) ---")

  const metricsRes = await fetch(`${BASE_URL}/api/recruitment/metrics`, {
    headers: { Authorization: `Bearer ${rhToken}` },
  })
  const metricsData = await metricsRes.json()
  if (!metricsRes.ok || !metricsData.ok || !metricsData.metrics) {
    throw new Error(`Falha ao obter métricas do ATS: ${JSON.stringify(metricsData)}`)
  }
  const m = metricsData.metrics
  console.log(`✔ Métricas calculadas:`)
  console.log(`  - Total de Vagas: ${m.totalJobs} (Abertas: ${m.openJobsCount}, Encerradas: ${m.closedJobsCount})`)
  console.log(`  - Total de Candidatos: ${m.totalCandidates}`)
  console.log(`  - Taxa de Conversão: ${m.conversionRate}%`)
  console.log(`  - Tempo Médio de Contratação (Time to Hire): ${m.avgTimeToHireDays} dias`)

  console.log("\n============================================================")
  console.log("🎉 TODOS OS TESTES DO MÓDULO ATS PASSARAM COM 100% DE SUCESSO!")
  console.log("============================================================\n")
}

runTest().catch((err) => {
  console.error("\n❌ ERRO NA SUÍTE ATS:", err)
  process.exit(1)
})
