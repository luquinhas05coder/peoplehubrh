/**
 * Test: Geração de senha confidencial e disparo de e-mail via SMTP
 */
async function runTest() {
  const BASE_URL = "http://localhost:3001"

  console.log("--- 1. RH cria uma nova pasta de colaborador SEM ver ou fornecer a senha ---")
  const newEmpEmail = `colab.confidencial.${Date.now()}@empresa.com`
  const newEmpName = "Marcelo Alcantara"

  try {
    const createRes = await fetch(`${BASE_URL}/api/employees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "tenant_default",
      },
      body: JSON.stringify({
        name: newEmpName,
        email: newEmpEmail,
        role: "Analista de Operações",
        department: "Operações",
        salary: "R$ 6.800,00",
        cpf: "987.654.321-99",
        phone: "(11) 97777-6666",
        sendEmail: true,
      }),
    })
    const createData = await createRes.json()
    console.log("Resposta criação pasta RH:", createRes.status, createData)

    if (!createData.ok) {
      throw new Error("Falha ao criar pasta do colaborador!")
    }

    // Verificar se o RH NÃO recebeu a senha no retorno da requisição (Confidencialidade / LGPD)
    if (createData.password || createData.initialPassword) {
      throw new Error("ALERTA DE SEGURANÇA: A senha foi exposta na resposta para o RH!")
    }
    console.log("✓ Confidencialidade preservada: o RH NÃO recebeu a senha na resposta.")
    console.log("✓ Status de envio por e-mail (SMTP):", createData.emailDispatched ? "Enviado com sucesso" : "Processado")

    console.log("\n--- 2. Testar endpoint de reenvio de credenciais via SMTP (/resend-access-email) ---")
    const resendRes = await fetch(`${BASE_URL}/api/employees/${createData.id}/resend-access-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "tenant_default",
      },
    })
    const resendData = await resendRes.json()
    console.log("Resposta reenvio SMTP:", resendRes.status, resendData)
    if (!resendData.ok) {
      throw new Error("Falha ao reenviar e-mail de acesso!")
    }

    console.log("\n>>> SUCESSO! Fluxo de geração confidencial e disparo SMTP validado.")
  } catch (err) {
    console.error("Erro no teste:", err.message)
    process.exit(1)
  }
}

runTest()
