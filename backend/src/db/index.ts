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
      status     TEXT DEFAULT 'active',
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN last_login TEXT;`)
  } catch (_e) {}

  // Audit Logs (RBAC & Ações Sensíveis)
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      user_name    TEXT,
      user_role    TEXT,
      action       TEXT NOT NULL,
      entity       TEXT NOT NULL,
      entity_id    TEXT,
      details_json TEXT,
      tenant_id    TEXT,
      ip_address   TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);`)
  } catch (_e) {}

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
      customMonthlyOverrides TEXT,
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
  try {
    db.run(`ALTER TABLE employees ADD COLUMN customMonthlyOverrides TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN birthDate TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN terminationDate TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN address TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN city TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN state TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN cep TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE employees ADD COLUMN notes TEXT;`)
  } catch (_e) {}

  // Employee History / Auditoria Funcional
  db.run(`
    CREATE TABLE IF NOT EXISTS employee_history (
      id          TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      tenant_id   TEXT,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      created_by  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_employee_history_emp ON employee_history(employee_id);`)
  } catch (_e) {}
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_employee_history_tenant ON employee_history(tenant_id);`)
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
      employee_id  TEXT,
      expiryDate   TEXT,
      date         TEXT NOT NULL,
      status       TEXT NOT NULL,
      fileUrl      TEXT NOT NULL,
      type         TEXT NOT NULL,
      tenant_id    TEXT
    );
  `)
  try {
    db.run(`ALTER TABLE documents ADD COLUMN employee_id TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE documents ADD COLUMN expiryDate TEXT;`)
  } catch (_e) {}

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

  // Contra-Cheques (Histórico Imutável Linear e Suporte a Recurso/Pedido de Vista)
  db.run(`
    CREATE TABLE IF NOT EXISTS contracheques (
      id                   TEXT PRIMARY KEY,
      tenant_id            TEXT NOT NULL,
      employee_id          TEXT NOT NULL,
      employee_name        TEXT NOT NULL,
      cpf                  TEXT,
      role                 TEXT,
      department           TEXT,
      admission_date       TEXT,
      cbo                  TEXT,
      month                TEXT NOT NULL,
      year_month           TEXT NOT NULL,
      salary_base          TEXT NOT NULL,
      holerite_json        TEXT NOT NULL,
      version              INTEGER DEFAULT 1,
      status               TEXT NOT NULL,
      is_immutable         INTEGER DEFAULT 0,
      generated_at         TEXT NOT NULL,
      contest_deadline_at  TEXT NOT NULL,
      contest_requested_at TEXT,
      contest_reason       TEXT,
      contest_resolution   TEXT,
      hash_signature       TEXT
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_contracheques_linear ON contracheques(employee_id, year_month ASC, generated_at ASC, version ASC);`)
  } catch (_e) {}
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_contracheques_tenant ON contracheques(tenant_id);`)
  } catch (_e) {}

  // Triggers SQLite para Imutabilidade Estrita: Nenhum CC imutável pode sofrer UPDATE ou DELETE
  try {
    db.run(`
      CREATE TRIGGER IF NOT EXISTS trg_contracheques_immutable_block_update
      BEFORE UPDATE ON contracheques
      FOR EACH ROW
      WHEN OLD.is_immutable = 1
      BEGIN
        SELECT RAISE(ABORT, 'Erro de Imutabilidade: Contra-cheques imutáveis/passados não podem ser alterados.');
      END;
    `)
  } catch (_e) {}

  try {
    db.run(`
      CREATE TRIGGER IF NOT EXISTS trg_contracheques_immutable_block_delete
      BEFORE DELETE ON contracheques
      FOR EACH ROW
      WHEN OLD.is_immutable = 1
      BEGIN
        SELECT RAISE(ABORT, 'Erro de Imutabilidade: Contra-cheques imutáveis/passados não podem ser excluídos.');
      END;
    `)
  } catch (_e) {}

  // Prazo estimado pelo cliente (tenant) para pedido de vista e recurso do CC
  try {
    db.run(`ALTER TABLE tenants ADD COLUMN contest_deadline_days INTEGER DEFAULT 10;`)
  } catch (_e) {}

  // Migrações dinâmicas para adicionar tenant_id em bases já existentes
  const tablesWithTenant = ["users", "conversations", "employees", "requests", "documents", "onboarding", "contracheques"]
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

  // Canal de Eventos Adversos / Incidentes e Denúncias
  db.run(`
    CREATE TABLE IF NOT EXISTS adverse_events (
      id                   TEXT PRIMARY KEY,
      protocol             TEXT UNIQUE NOT NULL,
      tenant_id            TEXT NOT NULL,
      reporter_id          TEXT,
      reporter_name        TEXT,
      reporter_email       TEXT,
      is_anonymous         INTEGER DEFAULT 0,
      category             TEXT NOT NULL,
      severity             TEXT NOT NULL,
      title                TEXT NOT NULL,
      description          TEXT NOT NULL,
      incident_date        TEXT NOT NULL,
      incident_location    TEXT,
      involved_parties     TEXT,
      evidence_url         TEXT,
      status               TEXT NOT NULL DEFAULT 'registrado',
      tratativa_notes      TEXT,
      tratativa_by         TEXT,
      tratativa_updated_at TEXT,
      measures_taken       TEXT,
      public_announcement  TEXT,
      announced_to_feed    INTEGER DEFAULT 0,
      created_at           TEXT DEFAULT (datetime('now')),
      updated_at           TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_adverse_events_tenant ON adverse_events(tenant_id, created_at DESC);`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_adverse_events_status ON adverse_events(tenant_id, status);`)
  } catch (_e) {}

  // Feed Corporativo / Novidades, Medidas e Eventos Gerais
  db.run(`
    CREATE TABLE IF NOT EXISTS feed_posts (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      author_id        TEXT NOT NULL,
      author_name      TEXT NOT NULL,
      author_role      TEXT NOT NULL,
      title            TEXT NOT NULL,
      content          TEXT NOT NULL,
      category         TEXT NOT NULL,
      priority         TEXT DEFAULT 'normal',
      is_pinned        INTEGER DEFAULT 0,
      adverse_event_id TEXT,
      event_date       TEXT,
      event_location   TEXT,
      tags             TEXT,
      likes_count      INTEGER DEFAULT 0,
      likes_users_json TEXT DEFAULT '[]',
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_feed_posts_tenant ON feed_posts(tenant_id, is_pinned DESC, created_at DESC);`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_feed_posts_cat ON feed_posts(tenant_id, category);`)
  } catch (_e) {}

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

  // Garantir a existência de contas de usuários padrão para teste (com as 4 roles principais)
  const defaultUsers = [
    {
      id: "u_admin",
      name: "Administrador PeopleHub",
      email: "admin@empresa.com",
      password: "admin123",
      role: "ADMIN",
      department: "Tecnologia",
      initials: "AD",
      tenant_id: "tenant_default",
    },
  ]

  for (const u of defaultUsers) {
    const userCheck = db.exec(`SELECT id FROM users WHERE id = ? OR lower(email) = lower(?)`, [u.id, u.email])
    if (!userCheck.length || !userCheck[0].values.length) {
      try {
        const hash = bcrypt.hashSync(u.password, 10)
        db.run(
          `INSERT OR IGNORE INTO users (id, name, email, password, role, department, initials, tenant_id, two_factor_enabled, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active')`,
          [u.id, u.name, u.email, hash, u.role, u.department, u.initials, u.tenant_id]
        )
      } catch (_e) {}
    }
  }
  console.log("[DB] Usuário administrador configurado com senha 'admin123'.")

  // Vincular registros legados ao tenant padrão
  const tables = ["users", "conversations", "employees", "requests", "documents", "onboarding"]
  for (const t of tables) {
    try {
      db.run(`UPDATE ${t} SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL OR tenant_id = '';`)
    } catch (_e) {}
  }

  persist()
  console.log("[DB] Banco de dados configurado limpo: apenas Administrador ativo.")
}

