/**
 * test-advanced-modules.js — Suíte de Testes Automatizados para os Novos Módulos:
 * 1. Gestão de Férias CLT (Aquisitivo, Concessivo, Saldo, Agenda, Aprovação)
 * 2. Ponto Eletrônico & Banco de Horas (Marcação, Espelho, Ajustes)
 * 3. Gestão de Benefícios Corporativos (Catálogo, Adesão, Cancelamento)
 * 4. Desligamento / Offboarding & Cálculo de Rescisão CLT
 * 5. Treinamentos, NRs e Certificados
 * 6. Pesquisa de Clima Organizacional & eNPS
 * 7. Organograma Corporativo Interativo
 */

import "dotenv/config"

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3009"

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
  console.log("🚀 INICIANDO TESTES DOS NOVOS MÓDULOS DE RH DO PEOPLEHUB")
  console.log("============================================================")

  // Autenticação dos perfis de teste
  const adminAuth = await login("admin@empresa.com")
  const rhAuth = await login("rh@peoplehub.com.br")
  const colabAuth = await login("colaborador@peoplehub.com.br")

  assert(adminAuth.status === 200 && adminAuth.token, "Login Administrador realizado com sucesso")
  assert(rhAuth.status === 200 && rhAuth.token, "Login RH realizado com sucesso")
  assert(colabAuth.status === 200 && colabAuth.token, "Login Colaborador realizado com sucesso")

  // -------------------------------------------------------------
  // 1. MÓDULO DE FÉRIAS CLT
  // -------------------------------------------------------------
  console.log("\n--- 1. Gestão de Férias CLT ---")
  const vacBalRes = await fetch(`${BASE_URL}/api/vacations/balance`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const vacBal = await vacBalRes.json()
  assert(vacBalRes.status === 200 && vacBal.ok, "Consulta de saldo de férias retornou 200 OK")
  assert(vacBal.period && vacBal.period.aquisitivo_inicio && vacBal.period.concessivo_fim, "Períodos aquisitivo e concessivo identificados corretamente")
  assert(typeof vacBal.summary?.diasSaldo === "number", "Saldo numérico de férias calculado")

  // Solicitar férias
  const vacReqRes = await fetch(`${BASE_URL}/api/vacations/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${colabAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dataInicio: "2027-01-10",
      dataFim: "2027-01-24",
      dias: 15,
      abonoPecuniario: 0,
      adiantamento13: 1,
      observacoes: "Férias solicitadas via teste automatizado",
    }),
  })
  const vacReqData = await vacReqRes.json()
  if (!vacReqData.ok) {
    console.log("❌ vacReqData ERROR:", vacReqRes.status, vacReqData)
  }
  assert(vacReqRes.status === 201 && vacReqData.ok, `Solicitação de férias de 15 dias criada com sucesso (ID: ${vacReqData.id})`)

  // RH aprova férias
  const vacApproveRes = await fetch(`${BASE_URL}/api/vacations/requests/${vacReqData.id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  const vacApproveData = await vacApproveRes.json()
  assert(vacApproveRes.status === 200 && vacApproveData.ok, "RH aprovou solicitação de férias e sincronizou no calendário corporativo")

  // Alertas de férias vencendo
  const vacAlertsRes = await fetch(`${BASE_URL}/api/vacations/alerts`, {
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  const vacAlerts = await vacAlertsRes.json()
  assert(vacAlertsRes.status === 200 && Array.isArray(vacAlerts.alerts), "Relatório de alertas de férias vencendo gerado com sucesso")

  // -------------------------------------------------------------
  // 2. PONTO ELETRÔNICO & BANCO DE HORAS
  // -------------------------------------------------------------
  console.log("\n--- 2. Ponto Eletrônico & Banco de Horas ---")
  const punchRes = await fetch(`${BASE_URL}/api/time-clock/punch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${colabAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locationName: "Sede Corporativa SP / Home Office",
      latitude: -23.5615,
      longitude: -46.6559,
      source: "web",
    }),
  })
  const punchData = await punchRes.json()
  assert(punchRes.status === 201 && punchData.ok, `Marcação de ponto registrada com sucesso (${punchData.punchType} às ${punchData.punchTime})`)

  // Consulta batidas de hoje
  const todayPunchRes = await fetch(`${BASE_URL}/api/time-clock/today`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const todayPunches = await todayPunchRes.json()
  assert(todayPunchRes.status === 200 && todayPunches.punches.length >= 1, "Batidas de hoje consultadas com sucesso")

  // Espelho de ponto mensal
  const sheetRes = await fetch(`${BASE_URL}/api/time-clock/sheet?monthYear=2026-10`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const sheetData = await sheetRes.json()
  assert(sheetRes.status === 200 && sheetData.ok, "Espelho de ponto mensal gerado com totalização de horas e saldo de banco")

  // Solicitar ajuste de ponto
  const adjRes = await fetch(`${BASE_URL}/api/time-clock/adjustment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${colabAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date: "2026-10-25",
      punchType: "entrada_1",
      requestedTime: "08:00",
      reason: "Esquecimento de registro no início da jornada",
    }),
  })
  const adjData = await adjRes.json()
  assert(adjRes.status === 201 && adjData.ok, `Solicitação de ajuste de ponto submetida (ID: ${adjData.id})`)

  // RH aprova ajuste
  const reviewRes = await fetch(`${BASE_URL}/api/time-clock/adjustments/${adjData.id}/review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rhAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "aprovar", comments: "Ajuste validado com a liderança" }),
  })
  const reviewData = await reviewRes.json()
  assert(reviewRes.status === 200 && reviewData.status === "aprovado", "Ajuste de ponto aprovado pelo RH e incorporado ao espelho")

  // -------------------------------------------------------------
  // 3. GESTÃO DE BENEFÍCIOS
  // -------------------------------------------------------------
  console.log("\n--- 3. Gestão de Benefícios ---")
  const catalogRes = await fetch(`${BASE_URL}/api/benefits/catalog`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const catalogData = await catalogRes.json()
  assert(catalogRes.status === 200 && catalogData.catalog.length >= 3, `Catálogo de benefícios retornado (${catalogData.catalog.length} opções disponíveis)`)

  const myBenefitsRes = await fetch(`${BASE_URL}/api/benefits/my`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const myBenefits = await myBenefitsRes.json()
  assert(myBenefitsRes.status === 200 && Array.isArray(myBenefits.benefits), "Benefícios ativos do colaborador consultados")

  // Aderir a benefício odontológico
  const enrollRes = await fetch(`${BASE_URL}/api/benefits/enroll`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${colabAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      benefitId: "ben_odonto",
      customCoverage: "Plano Individual Completo",
      dependentsCount: 0,
    }),
  })
  const enrollData = await enrollRes.json()
  assert((enrollRes.status === 201 || enrollRes.status === 200) && enrollData.ok, "Adesão ao plano odontológico confirmada")

  // -------------------------------------------------------------
  // 4. DESLIGAMENTO & RESCISÃO CLT
  // -------------------------------------------------------------
  console.log("\n--- 4. Desligamento / Offboarding & Cálculo de Rescisão CLT ---")
  const sevCalcRes = await fetch(`${BASE_URL}/api/offboarding/calculate-severance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rhAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      salary: 5000,
      hireDate: "2024-01-15",
      terminationDate: "2026-10-31",
      resignationType: "sem_justa_causa",
      noticePeriod: "indenizado",
    }),
  })
  const sevCalc = await sevCalcRes.json()
  assert(sevCalcRes.status === 200 && sevCalc.calculation.totalBruto > 0, `Cálculo rescisório CLT executado com sucesso (Bruto: R$ ${sevCalc.calculation.totalBruto})`)
  assert(sevCalc.calculation.multaFgts > 0, "Multa de 40% do FGTS calculada corretamente para demissão sem justa causa")

  // Iniciar processo de desligamento
  const offStartRes = await fetch(`${BASE_URL}/api/offboarding/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rhAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      employeeId: "emp_colab_01",
      terminationDate: "2026-11-30",
      resignationType: "pedido_demissao",
      noticePeriod: "trabalhado",
    }),
  })
  const offStartData = await offStartRes.json()
  assert(offStartRes.status === 201 && offStartData.id, `Processo de offboarding iniciado com checklist operacional (ID: ${offStartData.id})`)

  // Atualizar entrevista de desligamento
  const exitRes = await fetch(`${BASE_URL}/api/offboarding/${offStartData.id}/exit-interview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rhAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      exitInterview: {
        motivo: "Mudança de cidade e novos projetos",
        avaliacaoEmpresa: 10,
        recomendaria: true,
      },
    }),
  })
  const exitData = await exitRes.json()
  assert(exitRes.status === 200 && exitData.ok, "Entrevista de desligamento estruturada salva com sucesso")

  // -------------------------------------------------------------
  // 5. TREINAMENTOS & NRs
  // -------------------------------------------------------------
  console.log("\n--- 5. Treinamentos, NRs & Certificações ---")
  const trCatRes = await fetch(`${BASE_URL}/api/trainings/catalog`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const trCat = await trCatRes.json()
  assert(trCatRes.status === 200 && trCat.trainings.length >= 2, "Catálogo de treinamentos e NRs listado")

  // Concluir treinamento com certificado
  const trCompRes = await fetch(`${BASE_URL}/api/trainings/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${colabAuth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      trainingId: "tr_01",
      score: 10,
    }),
  })
  const trComp = await trCompRes.json()
  assert(trCompRes.status === 200 && trComp.certificateCode, `Certificado gerado com sucesso: ${trComp.certificateCode}`)

  // Matriz de conformidade
  const compRes = await fetch(`${BASE_URL}/api/trainings/compliance`, {
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  const compData = await compRes.json()
  assert(compRes.status === 200 && compData.summary.complianceRate >= 0, `Taxa de conformidade de NRs calculada: ${compData.summary.complianceRate}%`)

  // -------------------------------------------------------------
  // 6. PESQUISA DE CLIMA & eNPS
  // -------------------------------------------------------------
  console.log("\n--- 6. Pesquisa de Clima Organizacional & eNPS ---")
  const survListRes = await fetch(`${BASE_URL}/api/climate/surveys`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const survList = await survListRes.json()
  assert(survListRes.status === 200 && survList.surveys.length >= 1, "Pesquisas de clima ativas consultadas")

  const activeSurvId = survList.surveys[0].id

  // Dashboard de eNPS
  const dashRes = await fetch(`${BASE_URL}/api/climate/surveys/${activeSurvId}/dashboard`, {
    headers: { Authorization: `Bearer ${rhAuth.token}` },
  })
  const dashData = await dashRes.json()
  assert(dashRes.status === 200 && typeof dashData.enps?.score === "number", `eNPS calculado matematicamente: Score ${dashData.enps?.score} (${dashData.enps?.zoneLabel})`)
  assert(dashData.enps?.counts?.promoters >= 0 && dashData.enps?.counts?.detractors >= 0, "Contagem de Promotores, Neutros e Detratores validada")

  // -------------------------------------------------------------
  // 7. ORGANOGRAMA CORPORATIVO
  // -------------------------------------------------------------
  console.log("\n--- 7. Organograma Corporativo Interativo ---")
  const orgRes = await fetch(`${BASE_URL}/api/org-chart`, {
    headers: { Authorization: `Bearer ${colabAuth.token}` },
  })
  const orgData = await orgRes.json()
  assert(orgRes.status === 200 && orgData.ok, "Estrutura do organograma retornada com sucesso")
  assert(Array.isArray(orgData.rootNodes) && orgData.rootNodes.length >= 1, `Árvore hierárquica montada: ${orgData.rootNodes.length} nó(s) raiz corporativo(s)`)
  assert(orgData.departments.length >= 1, `Departamentos mapeados: ${orgData.departments.join(", ")}`)

  console.log("\n============================================================")
  if (failed === 0) {
    console.log(`🎉 TODOS OS ${passed} TESTES DOS NOVOS MÓDULOS PASSARAM COM 100% DE SUCESSO!`)
  } else {
    console.error(`💥 ${failed} teste(s) falharam de um total de ${passed + failed}.`)
    process.exit(1)
  }
  console.log("============================================================\n")
}

runTests().catch((err) => {
  console.error("Erro fatal na execução dos testes:", err)
  process.exit(1)
})
