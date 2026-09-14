/**
 * db/index.ts — SQLite database setup using sql.js for PeopleHub RH Backend
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import initSqlJs, { type Database } from "sql.js"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(__dirname, "../../", process.env.DATABASE_PATH)
  : path.join(__dirname, "../../peoplehub.db")

let db: Database

export async function initDB(): Promise<Database> {
  const SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
    console.log("[DB] Banco de dados existente carregado de:", DB_PATH)
  } else {
    db = new SQL.Database()
    console.log("[DB] Criando novo banco de dados em:", DB_PATH)
  }

  runMigrations()
  seedInitialData()
  persist()

  return db
}

export function getDB(): Database {
  if (!db) {
    throw new Error("Banco de dados não inicializado. Chame initDB() primeiro.")
  }
  return db
}

export function persist(): void {
  if (!db) return
  const data = db.export()
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function runMigrations(): void {
  // Users
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

  // MFA Codes
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

  // Conversations
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      initials         TEXT NOT NULL,
      channel          TEXT NOT NULL,
      topic            TEXT NOT NULL,
      role             TEXT NOT NULL,
      department       TEXT NOT NULL,
      lastMessage      TEXT NOT NULL,
      time             TEXT NOT NULL,
      unread           INTEGER DEFAULT 0,
      online           INTEGER DEFAULT 0,
      status           TEXT NOT NULL,
      priority         TEXT NOT NULL,
      pinned           INTEGER DEFAULT 0,
      snoozedUntil     TEXT,
      assignedTo       TEXT NOT NULL,
      contact_email    TEXT,
      contact_phone    TEXT,
      contact_location TEXT,
      contact_tenure   TEXT,
      contact_manager  TEXT
    );
  `)

  // Messages
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      direction       TEXT NOT NULL,
      text            TEXT NOT NULL,
      time            TEXT NOT NULL,
      status          TEXT,
      replyTo_json    TEXT,
      forwarded       INTEGER DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `)

  // Employees
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL,
      department   TEXT NOT NULL,
      status       TEXT NOT NULL,
      email        TEXT NOT NULL,
      phone        TEXT NOT NULL,
      cpf          TEXT NOT NULL,
      hireDate     TEXT NOT NULL,
      salary       TEXT NOT NULL,
      manager      TEXT NOT NULL,
      location     TEXT NOT NULL,
      contractType TEXT,
      workSchedule TEXT,
      customSchedulePattern TEXT
    );
  `)
  try {
    db.run(`ALTER TABLE employees ADD COLUMN contractType TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN workSchedule TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN customSchedulePattern TEXT;`)
  } catch (_e) {}

  // Requests
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      requester   TEXT NOT NULL,
      department  TEXT NOT NULL,
      date        TEXT NOT NULL,
      status      TEXT NOT NULL,
      priority    TEXT NOT NULL,
      description TEXT NOT NULL,
      details_json TEXT
    );
  `)

  // Documents
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      category     TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      date         TEXT NOT NULL,
      status       TEXT NOT NULL,
      fileUrl      TEXT NOT NULL,
      type         TEXT NOT NULL
    );
  `)

  // Onboarding
  db.run(`
    CREATE TABLE IF NOT EXISTS onboarding (
      id            TEXT PRIMARY KEY,
      candidateName TEXT NOT NULL,
      role          TEXT NOT NULL,
      department    TEXT NOT NULL,
      startDate     TEXT NOT NULL,
      mentor        TEXT NOT NULL,
      status        TEXT NOT NULL,
      progress      INTEGER NOT NULL,
      steps_json    TEXT NOT NULL
    );
  `)

  console.log("[DB] Tabelas criadas/verificadas com sucesso.")
}

function seedInitialData(): void {
  // Garantir a conta de Administrador para testes
  const adminHash = bcrypt.hashSync("admin123", 10)
  db.run(`DELETE FROM users WHERE lower(email) = 'admin@empresa.com'`)
  db.run(
    `INSERT INTO users (id, name, email, password, role, department, initials)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["u_admin", "Administrador PeopleHub", "admin@empresa.com", adminHash, "Administrador da Plataforma", "Tecnologia", "AD"]
  )
  console.log("[DB] Usuário Admin (admin@empresa.com / admin123) configurado com sucesso.")

  // Limpar tabelas de dados de demonstração/testes fictícios se existirem
  db.run(`DELETE FROM conversations`)
  db.run(`DELETE FROM messages`)
  db.run(`DELETE FROM employees WHERE id IN ('emp-1', 'emp-2')`)
  db.run(`DELETE FROM requests WHERE id IN ('REQ-001', 'REQ-002')`)
  db.run(`DELETE FROM documents WHERE id IN ('DOC-101', 'DOC-102')`)
  db.run(`DELETE FROM onboarding WHERE id IN ('ONB-01')`)
  persist()

  console.log("[DB] Banco de dados inicializado e limpo de dados de teste.")
}
