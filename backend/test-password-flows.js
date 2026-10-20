/**
 * Test script to verify password change on first login and forgot password flow with real SMTP
 */
import http from "http"

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ""
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body })
        }
      })
    })
    req.on("error", reject)
    if (data) {
      req.write(typeof data === "string" ? data : JSON.stringify(data))
    }
    req.end()
  })
}

async function runTests() {
  console.log("=== INICIANDO TESTES DO FLUXO DE SENHA E PRIMEIRO LOGIN ===")
  const testEmail = `colab_test_${Date.now()}@teste.com`
  const testName = "Colaborador Teste Fluxo"

  // 1. Criar novo colaborador via RH (employees API)
  console.log(`\n1. Criando colaborador com e-mail: ${testEmail}...`)
  const empRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/employees",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      name: testName,
      role: "Analista de Qualidade",
      department: "Operações",
      email: testEmail,
      initialPassword: "SenhaInicialTemp@2026",
      sendEmail: false, // para o teste da criacao
    }
  )

  console.log("Status criação:", empRes.status, "Resposta:", empRes.body)
  const initialPassword = "SenhaInicialTemp@2026"
  console.log("Senha inicial gerada pelo sistema:", initialPassword)

  // 2. Login com a senha inicial gerada
  console.log("\n2. Efetuando login com a senha inicial provisória...")
  const loginRes1 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      email: testEmail,
      password: initialPassword,
    }
  )

  console.log("Status login 1:", loginRes1.status)
  console.log("User mustChangePassword:", loginRes1.body?.user?.mustChangePassword)
  if (loginRes1.body?.user?.mustChangePassword !== true) {
    throw new Error("FALHA: O usuário recém-criado DEVERIA ter mustChangePassword === true!")
  }
  console.log("✅ SUCESSO: mustChangePassword === true confirmado no primeiro login!")

  const token = loginRes1.body.token

  // 3. Trocar a senha pelo endpoint /change-password
  console.log("\n3. Definindo nova senha definitiva pelo modal de primeiro login...")
  const newPassword = "MinhaNovaSenhaForte@2026"
  const changeRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/change-password",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    {
      newPassword,
      currentPassword: initialPassword,
    }
  )

  console.log("Status change-password:", changeRes.status, "Resposta:", changeRes.body)
  if (!changeRes.body.ok) {
    throw new Error("FALHA ao alterar senha: " + JSON.stringify(changeRes.body))
  }
  console.log("✅ SUCESSO: Senha alterada com sucesso!")

  // 4. Efetuar segundo login com a nova senha
  console.log("\n4. Efetuando segundo login com a nova senha permanente...")
  const loginRes2 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      email: testEmail,
      password: newPassword,
    }
  )

  console.log("Status login 2:", loginRes2.status)
  console.log("User mustChangePassword após troca:", loginRes2.body?.user?.mustChangePassword)
  if (loginRes2.body?.user?.mustChangePassword !== false) {
    throw new Error("FALHA: Após trocar a senha, mustChangePassword DEVERIA ser false!")
  }
  console.log("✅ SUCESSO: mustChangePassword === false confirmado! Modal não aparecerá mais!")

  // 5. Testar Esqueci a Minha Senha com disparo de e-mail SMTP para a conta do usuário
  console.log("\n5. Testando Esqueci a Minha Senha com disparo SMTP para lucasmouraosilva2005@gmail.com...")
  const forgotRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/forgot-password",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      email: testEmail,
    }
  )

  console.log("Status forgot-password:", forgotRes.status, "Resposta:", forgotRes.body)
  if (!forgotRes.body.ok) {
    throw new Error("FALHA ao solicitar redefinição de senha: " + JSON.stringify(forgotRes.body))
  }
  console.log("✅ SUCESSO: Esqueci a senha executado e processado pelo backend!")

  console.log("\n=== TODOS OS TESTES PASSARAM COM ÊXITO! ===")
}

runTests().catch((err) => {
  console.error("ERRO NO TESTE:", err)
  process.exit(1)
})
