/**
 * test-runner.js — Utilitário de orquestração de testes de backend
 * Inicia o servidor automaticamente caso não esteja rodando e executa as suítes especificadas.
 */
import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.TEST_PORT || 3009
const BASE_URL = `http://localhost:${PORT}`

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning()) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

async function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32"
    const cmd = isWindows ? (command === "npx" ? "npx.cmd" : command) : command
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: isWindows,
      env: { ...process.env, PORT: String(PORT), TEST_BASE_URL: BASE_URL },
    })

    child.on("close", (code) => {
      resolve(code ?? 0)
    })

    child.on("error", (err) => {
      console.error(`Erro ao executar ${command} ${args.join(" ")}:`, err)
      resolve(1)
    })
  })
}

async function main() {
  const mode = process.argv[2] || "all"
  console.log(`\n▶ [TEST-RUNNER] Modo selecionado: ${mode}`)

  let serverProcess = null
  let isManagedServer = false

  const alreadyRunning = await isServerRunning()
  if (alreadyRunning) {
    console.log(`✔ [TEST-RUNNER] Servidor de backend já ativo em ${BASE_URL}`)
  } else {
    console.log(`⚙ [TEST-RUNNER] Inicializando servidor de backend PeopleHub em ${BASE_URL}...`)
    const isWindows = process.platform === "win32"
    const npxCmd = isWindows ? "npx.cmd" : "npx"
    serverProcess = spawn(npxCmd, ["tsx", "src/index.ts"], {
      cwd: __dirname,
      stdio: "pipe",
      shell: isWindows,
      env: { ...process.env, PORT: String(PORT) },
    })
    isManagedServer = true

    serverProcess.stderr?.on("data", (d) => {
      const msg = d.toString()
      if (msg.includes("Error:") || msg.includes("ERR_")) {
        console.error(`[SERVER ERR] ${msg}`)
      }
    })

    const started = await waitForServer(20000)
    if (!started) {
      console.error("✖ [TEST-RUNNER] Falha ao iniciar servidor de backend para testes.")
      if (serverProcess) serverProcess.kill()
      process.exit(1)
    }
    console.log(`✔ [TEST-RUNNER] Servidor inicializado e respondendo com sucesso!`)
  }

  let testFiles = []
  if (mode === "security") {
    testFiles = ["test-security-audit.js"]
  } else if (mode === "backend") {
    testFiles = ["test-cc-immutability.js", "test-rbac-permissions.js", "test-security-audit.js", "test-recruitment.js"]
  } else if (mode === "all") {
    testFiles = [
      "test-cc-immutability.js",
      "test-rbac-permissions.js",
      "test-security-audit.js",
      "test-rh-access-provisioning.js",
      "test-recruitment.js",
    ]
  } else {
    testFiles = [mode]
  }

  let totalFailed = 0

  try {
    for (const file of testFiles) {
      console.log(`\n============================================================`)
      console.log(`🏃 Executando suíte: ${file}`)
      console.log(`============================================================`)
      const code = await runCommand("npx", ["tsx", file], __dirname)
      if (code !== 0) {
        console.error(`✖ Suíte ${file} falhou com código ${code}`)
        totalFailed++
      } else {
        console.log(`✔ Suíte ${file} concluída com sucesso!`)
      }
    }
  } finally {
    if (isManagedServer && serverProcess) {
      console.log(`\n⏹ [TEST-RUNNER] Finalizando servidor de testes gerenciado...`)
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"])
      } else {
        serverProcess.kill("SIGTERM")
      }
    }
  }

  console.log(`\n============================================================`)
  if (totalFailed === 0) {
    console.log(`🎉 TODAS AS SUÍTES DE BACKEND PASSARAM COM SUCESSO!`)
    console.log(`============================================================\n`)
    process.exit(0)
  } else {
    console.error(`💥 ${totalFailed} suíte(s) falharam nos testes de backend.`)
    console.log(`============================================================\n`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Erro fatal no test-runner:", err)
  process.exit(1)
})
