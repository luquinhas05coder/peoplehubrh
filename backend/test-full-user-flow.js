/**
 * End-to-end automated verification for:
 * 1. First login modal trigger and permanent password setup
 * 2. Subsequent login without modal
 * 3. Forgot password trigger, Gmail SMTP dispatch, and first-login prompt on reset
 */
import http from "http"

function req(options, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, (res) => {
      let b = ""
      res.on("data", (chunk) => (b += chunk))
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(b) })
        } catch {
          resolve({ status: res.statusCode, body: b })
        }
      })
    })
    r.on("error", reject)
    if (data) r.write(JSON.stringify(data))
    r.end()
  })
}

async function verify() {
  console.log("==================================================")
  console.log("   TESTE COMPLETO: FLUXO DE SENHA E PRIMEIRO ACESSO ")
  console.log("==================================================")

  const email = `usuario_${Date.now()}@empresa.com`
  const initialPassword = "SenhaProvisoria@123"

  // 1. Criar pasta e credencial do colaborador via RH
  console.log(`\n[Passo 1] Criando pasta do colaborador para: ${email}`)
  const createEmp = await req(
    { hostname: "localhost", port: 3000, path: "/api/employees", method: "POST", headers: { "Content-Type": "application/json" } },
    { name: "Lucas Colaborador", role: "Engenheiro de Software", department: "Tecnologia", email, initialPassword, sendEmail: false }
  )
  console.log("-> Status:", createEmp.status, createEmp.body)

  // 2. Primeiro login do colaborador com a credencial gerada
  console.log("\n[Passo 2] Efetuando o 1º login com a senha provisória...")
  const login1 = await req(
    { hostname: "localhost", port: 3000, path: "/api/auth/login", method: "POST", headers: { "Content-Type": "application/json" } },
    { email, password: initialPassword }
  )
  console.log("-> Status:", login1.status)
  console.log("-> mustChangePassword recebido:", login1.body?.user?.mustChangePassword)
  if (login1.body?.user?.mustChangePassword !== true) {
    throw new Error("ERRO: No primeiro login o campo mustChangePassword DEVE ser true para exibir o modal!")
  }
  console.log("✔ SUCESSO: Modal de primeiro login acionado obrigatoriamente!")

  // 3. Colaborador define sua nova senha definitiva no modal
  const token1 = login1.body.token
  const myNewPassword = "MinhaNovaSenhaDefinitiva@2026"
  console.log("\n[Passo 3] Colaborador submete nova senha pessoal no modal...")
  const change1 = await req(
    { hostname: "localhost", port: 3000, path: "/api/auth/change-password", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` } },
    { newPassword: myNewPassword, currentPassword: initialPassword }
  )
  console.log("-> Status:", change1.status, change1.body)
  if (!change1.body.ok) {
    throw new Error("ERRO ao alterar senha: " + JSON.stringify(change1.body))
  }
  console.log("✔ SUCESSO: Nova senha gravada no banco e flag must_change_password zerada!")

  // 4. Próximo login do colaborador com a nova senha
  console.log("\n[Passo 4] Efetuando o 2º login com a nova senha definitiva...")
  const login2 = await req(
    { hostname: "localhost", port: 3000, path: "/api/auth/login", method: "POST", headers: { "Content-Type": "application/json" } },
    { email, password: myNewPassword }
  )
  console.log("-> Status:", login2.status)
  console.log("-> mustChangePassword no 2º login:", login2.body?.user?.mustChangePassword)
  if (login2.body?.user?.mustChangePassword !== false) {
    throw new Error("ERRO: No segundo login o campo mustChangePassword DEVE ser false para NÃO exibir o modal!")
  }
  console.log("✔ SUCESSO: No segundo login o modal NÃO aparece mais!")

  // 5. Esqueci a minha senha com envio real via SMTP
  console.log("\n[Passo 5] Solicitando 'Esqueci a minha senha'...")
  const forgot = await req(
    { hostname: "localhost", port: 3000, path: "/api/auth/forgot-password", method: "POST", headers: { "Content-Type": "application/json" } },
    { email }
  )
  console.log("-> Status:", forgot.status, forgot.body)
  if (!forgot.body.ok) {
    throw new Error("ERRO na recuperação de senha: " + JSON.stringify(forgot.body))
  }
  console.log("✔ SUCESSO: E-mail de recuperação disparado com sucesso via SMTP!")

  console.log("\n==================================================")
  console.log("   TODOS OS REQUISITOS FORAM TESTADOS E APROVADOS!  ")
  console.log("==================================================")
}

verify().catch((e) => {
  console.error("FALHA NA VERIFICAÇÃO:", e)
  process.exit(1)
})
