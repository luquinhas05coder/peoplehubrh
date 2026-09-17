/**
 * index.ts — Entrypoint principal do Backend Independente PeopleHub RH
 */
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })
dotenv.config({ path: path.resolve(__dirname, "../../.env") })
dotenv.config()

import { initDB } from "./db/index.js"
import authRoutes from "./routes/auth.routes.js"
import conversationsRoutes from "./routes/conversations.routes.js"
import employeesRoutes from "./routes/employees.routes.js"
import requestsRoutes from "./routes/requests.routes.js"
import documentsRoutes from "./routes/documents.routes.js"
import onboardingRoutes from "./routes/onboarding.routes.js"
import reportsRoutes from "./routes/reports.routes.js"
import integrationsRoutes from "./routes/integrations.routes.js"
import cboRoutes from "./routes/cbo.routes.js"
import pdfRoutes from "./routes/pdf.routes.js"

import swaggerUi from "swagger-ui-express"
import { swaggerSpec } from "./swagger.js"

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173"

app.set("json spaces", 2)

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

// Documentação Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Log de requisições em ambiente dev
app.use((req, _res, next) => {
  console.log(`[API ${req.method}] ${req.url}`)
  next()
})

// Registro de rotas
app.use("/api/auth", authRoutes)
app.use("/api/conversations", conversationsRoutes)
app.use("/api/employees", employeesRoutes)
app.use("/api/requests", requestsRoutes)
app.use("/api/documents", documentsRoutes)
app.use("/api/onboarding", onboardingRoutes)
app.use("/api/reports", reportsRoutes)
app.use("/api/integrations", integrationsRoutes)
app.use("/api/cbo", cboRoutes)
app.use("/api/pdf", pdfRoutes)

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>PeopleHub RH — Backend API</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 600px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .status { display: inline-flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 6px 14px; border-radius: 9999px; font-weight: 600; font-size: 14px; }
        .status-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #4ade80; }
        h1 { margin: 16px 0 8px 0; font-size: 24px; color: #ffffff; }
        p { color: #94a3b8; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
        h2 { font-size: 16px; color: #cbd5e1; margin-top: 24px; margin-bottom: 12px; }
        ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        li a { display: flex; justify-content: space-between; align-items: center; background: #0f172a; border: 1px solid #334155; padding: 10px 16px; border-radius: 8px; color: #38bdf8; text-decoration: none; font-family: monospace; font-size: 14px; transition: all 0.2s; }
        li a:hover { border-color: #38bdf8; background: #1e293b; transform: translateY(-1px); }
        .badge { font-size: 11px; background: #334155; color: #94a3b8; padding: 2px 8px; border-radius: 4px; font-weight: normal; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status"><span class="status-dot"></span> Servidor Backend Online</div>
        <h1>PeopleHub RH — API Server</h1>
        <p>O backend independente do PeopleHub RH está rodando com sucesso na porta 3001 com banco de dados SQLite persistente.</p>
        
        <h2>Documentação Interativa (Swagger):</h2>
        <div style="margin-bottom: 20px;">
          <a href="/docs" target="_blank" style="display: block; background: #3b82f6; color: #ffffff; text-align: center; padding: 12px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
            📘 Abrir Swagger UI (Documentação Interativa)
          </a>
        </div>

        <h2>Endpoints Disponíveis:</h2>
        <ul>
          <li><a href="/api/health" target="_blank">GET /api/health <span class="badge">Health Check</span></a></li>
          <li><a href="/api/conversations" target="_blank">GET /api/conversations <span class="badge">Chat & Mensagens</span></a></li>
          <li><a href="/api/employees" target="_blank">GET /api/employees <span class="badge">Colaboradores</span></a></li>
          <li><a href="/api/requests" target="_blank">GET /api/requests <span class="badge">Solicitações & Chamados</span></a></li>
          <li><a href="/api/documents" target="_blank">GET /api/documents <span class="badge">Documentos de RH</span></a></li>
          <li><a href="/api/onboarding" target="_blank">GET /api/onboarding <span class="badge">Onboarding</span></a></li>
          <li><a href="/api/reports/metrics" target="_blank">GET /api/reports/metrics <span class="badge">Relatórios & Métricas</span></a></li>
        </ul>
      </div>
    </body>
    </html>
  `)
})

app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    service: "PeopleHub RH Backend API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  })
})

// Middleware para rotas não encontradas (404 em JSON)
app.use((req, res) => {
  if (req.accepts("json") || req.path.startsWith("/api")) {
    res.status(404).json({ ok: false, error: `Rota '${req.method} ${req.path}' não encontrada.` })
    return
  }
  res.status(404).send("Página não encontrada.")
})

// Middleware global de tratamento de erros
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("❌ Erro interno no servidor:", err)
  res.status(500).json({ ok: false, error: "Erro interno no servidor de API." })
})

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n==================================================`)
      console.log(`🚀 PeopleHub RH Backend rodando em http://localhost:${PORT}`)
      console.log(`📘 Swagger UI: http://localhost:${PORT}/docs`)
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`)
      console.log(`==================================================\n`)
    })
  })
  .catch((err) => {
    console.error("❌ Erro ao inicializar o banco de dados do backend:", err)
    process.exit(1)
  })
