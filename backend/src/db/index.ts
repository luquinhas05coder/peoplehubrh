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
  // Tenants (Organizações / Empresas)
  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT UNIQUE NOT NULL,
      cnpj       TEXT,
      plan       TEXT DEFAULT 'pro',
      status     TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

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
      tenant_id  TEXT,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      must_change_password INTEGER DEFAULT 0,
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
      contact_manager  TEXT,
      tenant_id        TEXT
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
      customSchedulePattern TEXT,
      tenant_id    TEXT
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
      details_json TEXT,
      tenant_id   TEXT
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
      type         TEXT NOT NULL,
      tenant_id    TEXT
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
      steps_json    TEXT NOT NULL,
      tenant_id     TEXT
    );
  `)

  // Migrações dinâmicas para adicionar tenant_id em bases já existentes
  const tablesWithTenant = ["users", "conversations", "employees", "requests", "documents", "onboarding"]
  for (const table of tablesWithTenant) {
    try {
      db.run(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT;`)
    } catch (_e) {}
  }

  // Suporte a 2FA TOTP (Google Authenticator)
  try {
    db.run(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;`)
  } catch (_e) {}

  // Índices para garantir rapidez e eficiência nos filtros por tenant_id
  const tenantIndexes = [
    "CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_requests_tenant ON requests(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON onboarding(tenant_id);",
  ]
  for (const idxSql of tenantIndexes) {
    try {
      db.run(idxSql)
    } catch (_e) {}
  }

  console.log("[DB] Tabelas e índices criados/verificados com sucesso.")
}

function seedInitialData(): void {
  // Garantir existência dos Tenants padrão
  db.run(`
    INSERT OR IGNORE INTO tenants (id, name, slug, cnpj, plan, status)
    VALUES 
      ('tenant_default', 'PeopleHub Matriz', 'matriz', '12.345.678/0001-90', 'enterprise', 'active'),
      ('tenant_techcorp', 'TechCorp Inovações', 'techcorp', '98.765.432/0001-10', 'pro', 'active');
  `)

  // Garantir a existência de contas de usuários padrão para teste
  const defaultUsers = [
    {
      id: "u_admin",
      name: "Administrador PeopleHub",
      email: "admin@empresa.com",
      password: "admin123",
      role: "Administrador da Plataforma",
      department: "Tecnologia",
      initials: "AD",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_rh",
      name: "Mariana Alcantara",
      email: "rh@peoplehub.com.br",
      password: "admin123",
      role: "Gestora de RH & DHO",
      department: "Recursos Humanos",
      initials: "MA",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_dp",
      name: "Carlos Eduardo Souza",
      email: "dp@peoplehub.com.br",
      password: "admin123",
      role: "Especialista em DP & Folha",
      department: "Departamento Pessoal",
      initials: "CS",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_ti",
      name: "Lucas Barros",
      email: "ti@peoplehub.com.br",
      password: "admin123",
      role: "Administrador de Sistemas & TI",
      department: "Tecnologia da Informação",
      initials: "LB",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_colab",
      name: "Gabriel Santos",
      email: "colaborador@peoplehub.com.br",
      password: "admin123",
      role: "Colaborador",
      department: "Operações",
      initials: "GS",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_techcorp_admin",
      name: "Fernanda Lima",
      email: "admin@techcorp.com.br",
      password: "admin123",
      role: "Diretora de RH",
      department: "Gestão Corporativa",
      initials: "FL",
      tenant_id: "tenant_techcorp",
    },
  ]

  for (const u of defaultUsers) {
    const userCheck = db.exec(`SELECT id FROM users WHERE lower(email) = lower(?)`, [u.email])
    if (!userCheck.length || !userCheck[0].values.length) {
      const hash = bcrypt.hashSync(u.password, 10)
      db.run(
        `INSERT INTO users (id, name, email, password, role, department, initials, tenant_id, two_factor_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [u.id, u.name, u.email, hash, u.role, u.department, u.initials, u.tenant_id]
      )
    }
  }
  console.log("[DB] Usuários padrão (admin, rh, dp, ti, colaborador) configurados com senha 'admin123'.")

  // Vincular registros legados ao tenant padrão
  const tables = ["users", "conversations", "employees", "requests", "documents", "onboarding"]
  for (const t of tables) {
    try {
      db.run(`UPDATE ${t} SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL OR tenant_id = '';`)
    } catch (_e) {}
  }

  // Limpar tabelas de dados de demonstração/testes fictícios se existirem
  db.run(`DELETE FROM conversations WHERE id IN ('conv-1', 'conv-2')`)
  db.run(`DELETE FROM messages WHERE id IN ('msg-1', 'msg-2')`)
  db.run(`DELETE FROM employees WHERE id IN ('emp-1', 'emp-2')`)
  db.run(`DELETE FROM requests WHERE id IN ('REQ-001', 'REQ-002')`)
  db.run(`DELETE FROM documents WHERE id IN ('DOC-101', 'DOC-102')`)
  db.run(`DELETE FROM onboarding WHERE id IN ('ONB-01')`)
  persist()

  console.log("[DB] Banco de dados inicializado com suporte a Multi-Tenancy.")
}
