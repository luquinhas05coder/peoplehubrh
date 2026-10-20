/**
 * db.ts — SQLite database setup using sql.js (pure JS/WASM, no native binaries)
 *
 * Database is persisted to disk as `server/peoplehub.db` using Node's `fs` module.
 * On startup: creates tables if not present, then seeds initial users.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import initSqlJs, { type Database } from "sql.js"
import bcrypt from "bcryptjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, "peoplehub.db")

let db: Database

/**
 * Load DB from disk or create a fresh one, then run migrations + seed.
 */
export async function initDB(): Promise<Database> {
  const SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
    console.log("[DB] Loaded existing database from", DB_PATH)
  } else {
    db = new SQL.Database()
    console.log("[DB] Creating new database at", DB_PATH)
  }

  runMigrations()
  seedUsers()
  persist()

  return db
}

/** Write the current in-memory DB state to disk. */
export function persist(): void {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function runMigrations(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL,
      department TEXT NOT NULL,
      initials   TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS mfa_codes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      code       TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used       INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  console.log("[DB] Migrations complete")
}

interface SeedUser {
  id: string
  name: string
  email: string
  password: string
  role: string
  department: string
  initials: string
}

const SEED_USERS: SeedUser[] = [
  {
    id: "u1",
    name: "Victor Silva",
    email: "rh@empresa.com",
    password: "rh@2026",
    role: "Analista de RH",
    department: "Recursos Humanos",
    initials: "VS",
  },
  {
    id: "u2",
    name: "Admin PeopleHub",
    email: "admin@empresa.com",
    password: "admin@2026",
    role: "Administrador da Plataforma",
    department: "Tecnologia",
    initials: "AP",
  },
]

function seedUsers(): void {
  for (const u of SEED_USERS) {
    const exists = db.exec(`SELECT id FROM users WHERE email = ?`, [u.email])
    if (exists.length === 0 || exists[0].values.length === 0) {
      const hash = bcrypt.hashSync(u.password, 10)
      db.run(
        `INSERT INTO users (id, name, email, password, role, department, initials)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.name, u.email, hash, u.role, u.department, u.initials],
      )
      console.log(`[DB] Seeded user: ${u.email}`)
    }
  }
}

// ─── Query helpers ───────────────────────────────────────────────────────────

export interface DBUser {
  id: string
  name: string
  email: string
  password: string
  role: string
  department: string
  initials: string
}

export function findUserByEmail(email: string): DBUser | null {
  const res = db.exec(
    `SELECT id, name, email, password, role, department, initials
     FROM users WHERE lower(email) = lower(?)`,
    [email],
  )
  if (!res.length || !res[0].values.length) return null
  const [id, name, em, password, role, department, initials] = res[0].values[0] as string[]
  return { id, name, email: em, password, role, department, initials }
}

export function saveMfaCode(userId: string, code: string, expiresAt: Date): string {
  const id = `mfa_${Date.now()}_${Math.random().toString(36).slice(2)}`
  // Invalidate previous unused codes for this user
  db.run(`UPDATE mfa_codes SET used = 1 WHERE user_id = ? AND used = 0`, [userId])
  db.run(
    `INSERT INTO mfa_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)`,
    [id, userId, code, expiresAt.toISOString()],
  )
  persist()
  return id
}

export function validateMfaCode(userId: string, code: string): boolean {
  const res = db.exec(
    `SELECT id FROM mfa_codes
     WHERE user_id = ?
       AND code = ?
       AND used = 0
       AND expires_at > datetime('now')
     ORDER BY expires_at DESC LIMIT 1`,
    [userId, code],
  )
  if (!res.length || !res[0].values.length) return false
  const mfaId = res[0].values[0][0] as string
  db.run(`UPDATE mfa_codes SET used = 1 WHERE id = ?`, [mfaId])
  persist()
  return true
}
