/**
 * index.ts — Express Server Entrypoint
 */
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { initDB } from "./db.js"
import authRoutes from "./routes/auth.js"

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use("/api/auth", authRoutes)

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] PeopleHub Express API server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("[Server] Error initializing database:", err)
  })
