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

let persistTimer: NodeJS.Timeout | null = null

export function persist(immediate = process.env.NODE_ENV === "test"): void {
  if (!db) return
  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    const data = db.export()
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DB_PATH, Buffer.from(data))
    return
  }

  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      const data = db.export()
      const dir = path.dirname(DB_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(DB_PATH, Buffer.from(data))
    } catch (e) {
      console.error("[DB] Erro ao persistir banco de dados:", e)
    }
  }, 100)
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
  try { db.run(`ALTER TABLE requests ADD COLUMN justification TEXT;`) } catch (_e) {}
  try { db.run(`ALTER TABLE requests ADD COLUMN review_notes TEXT;`) } catch (_e) {}
  try { db.run(`ALTER TABLE requests ADD COLUMN reviewed_by TEXT;`) } catch (_e) {}
  try { db.run(`ALTER TABLE requests ADD COLUMN reviewed_at TEXT;`) } catch (_e) {}
  try { db.run(`ALTER TABLE requests ADD COLUMN attachment_name TEXT;`) } catch (_e) {}
  try { db.run(`ALTER TABLE requests ADD COLUMN attachment_base64 TEXT;`) } catch (_e) {}
  try { db.run(`ALTER TABLE requests ADD COLUMN attachment_mime TEXT;`) } catch (_e) {}

  // Request Comments / Pendências e Linha do Tempo de Chamados
  db.run(`
    CREATE TABLE IF NOT EXISTS request_comments (
      id          TEXT PRIMARY KEY,
      request_id  TEXT NOT NULL,
      author_id   TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      comment     TEXT NOT NULL,
      tenant_id   TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `)
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_req_comments_req ON request_comments(request_id);`) } catch (_e) {}

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
  try {
    db.run(`ALTER TABLE documents ADD COLUMN origin TEXT DEFAULT 'administrativo';`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE documents ADD COLUMN file_base64 TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE documents ADD COLUMN mime_type TEXT;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE documents ADD COLUMN file_size INTEGER;`)
  } catch (_e) {}
  try {
    db.run(`ALTER TABLE documents ADD COLUMN notes TEXT;`)
  } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_requests_tenant_status ON requests(tenant_id, status);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_requests_tenant_req ON requests(tenant_id, requester);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_documents_tenant_emp ON documents(tenant_id, employeeName);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_documents_tenant_cat ON documents(tenant_id, category);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_employees_tenant_dept ON employees(tenant_id, department);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON employees(tenant_id, status);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id, status);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conversation_id);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON onboarding(tenant_id, status);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_feed_tenant_pin_date ON feed_posts(tenant_id, is_pinned DESC, created_at DESC);`) } catch (_e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_contracheques_deadline ON contracheques(tenant_id, is_immutable, contest_deadline_at);`) } catch (_e) {}

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
  // 1. MÓDULO: Workflows Visuais de RH
  db.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      title           TEXT NOT NULL,
      category        TEXT NOT NULL,
      description     TEXT,
      employee_id     TEXT,
      employee_name   TEXT,
      current_step_id TEXT,
      status          TEXT NOT NULL DEFAULT 'em_andamento',
      due_date        TEXT,
      created_by_id   TEXT,
      created_by_name TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_workflows_tenant_status ON workflows(tenant_id, status);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id                TEXT PRIMARY KEY,
      workflow_id       TEXT NOT NULL,
      tenant_id         TEXT NOT NULL,
      order_index       INTEGER NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      assignee_role     TEXT NOT NULL,
      assignee_id       TEXT,
      assignee_name     TEXT,
      status            TEXT NOT NULL DEFAULT 'pendente',
      due_date          TEXT,
      completed_at      TEXT,
      completed_by_id   TEXT,
      completed_by_name TEXT,
      comments          TEXT,
      required          INTEGER DEFAULT 1,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_wf ON workflow_steps(workflow_id, order_index ASC);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_history (
      id          TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      tenant_id   TEXT NOT NULL,
      step_id     TEXT,
      step_title  TEXT,
      action      TEXT NOT NULL,
      actor_id    TEXT,
      actor_name  TEXT,
      actor_role  TEXT,
      comments    TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_workflow_history_wf ON workflow_history(workflow_id, created_at DESC);`)
  } catch (_e) {}

  // 2. MÓDULO: Central de Notificações & Calendário Corporativo
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      user_id     TEXT,
      user_email  TEXT,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      category    TEXT NOT NULL,
      priority    TEXT NOT NULL DEFAULT 'media',
      link        TEXT,
      read        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(tenant_id, user_id, read, created_at DESC);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      category        TEXT NOT NULL,
      start_date      TEXT NOT NULL,
      end_date        TEXT NOT NULL,
      department      TEXT,
      employee_id     TEXT,
      employee_name   TEXT,
      is_all_day      INTEGER DEFAULT 1,
      location        TEXT,
      created_by_id   TEXT,
      created_by_name TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_date ON calendar_events(tenant_id, start_date ASC);`)
  } catch (_e) {}

  // 3. MÓDULO: Avaliação de Desempenho & Metas Individuais
  db.run(`
    CREATE TABLE IF NOT EXISTS performance_cycles (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT,
      start_date       TEXT NOT NULL,
      end_date         TEXT NOT NULL,
      departments_json TEXT DEFAULT '[]',
      status           TEXT NOT NULL DEFAULT 'planejado',
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_perf_cycles_tenant_status ON performance_cycles(tenant_id, status);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluation_criteria (
      id          TEXT PRIMARY KEY,
      cycle_id    TEXT NOT NULL,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      category    TEXT NOT NULL,
      weight      REAL DEFAULT 1.0,
      scale_max   INTEGER DEFAULT 5,
      FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id             TEXT PRIMARY KEY,
      cycle_id       TEXT NOT NULL,
      tenant_id      TEXT NOT NULL,
      employee_id    TEXT NOT NULL,
      employee_name  TEXT NOT NULL,
      evaluator_id   TEXT NOT NULL,
      evaluator_name TEXT NOT NULL,
      type           TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'rascunho',
      scores_json    TEXT DEFAULT '[]',
      final_score    REAL,
      feedback_text  TEXT,
      submitted_at   TEXT,
      updated_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_evaluations_cycle_emp ON evaluations(cycle_id, employee_id, evaluator_id);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS individual_goals (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      cycle_id         TEXT,
      employee_id      TEXT NOT NULL,
      employee_name    TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT,
      metric_target    TEXT NOT NULL,
      current_progress INTEGER DEFAULT 0,
      due_date         TEXT,
      status           TEXT NOT NULL DEFAULT 'em_progresso',
      comments         TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_individual_goals_emp ON individual_goals(tenant_id, employee_id);`)
  } catch (_e) {}

  // 4. MÓDULO: Relatórios Personalizados Salvos
  db.run(`
    CREATE TABLE IF NOT EXISTS saved_reports (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      entity_type     TEXT NOT NULL,
      filters_json    TEXT DEFAULT '{}',
      columns_json    TEXT DEFAULT '[]',
      group_by        TEXT,
      chart_type      TEXT DEFAULT 'bar',
      created_by_id   TEXT,
      created_by_name TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_saved_reports_tenant ON saved_reports(tenant_id, created_at DESC);`)
  } catch (_e) {}

  // 5. MÓDULO: Recrutamento e Seleção Profissional (ATS)
  db.run(`
    CREATE TABLE IF NOT EXISTS job_postings (
      id                     TEXT PRIMARY KEY,
      tenant_id              TEXT NOT NULL,
      title                  TEXT NOT NULL,
      department             TEXT NOT NULL,
      role                   TEXT,
      work_model             TEXT NOT NULL DEFAULT 'hibrido',
      contract_type          TEXT NOT NULL DEFAULT 'CLT',
      location               TEXT DEFAULT 'São Paulo, SP',
      positions_count        INTEGER DEFAULT 1,
      status                 TEXT NOT NULL DEFAULT 'aberta',
      salary_min             REAL,
      salary_max             REAL,
      salary_is_confidential INTEGER DEFAULT 1,
      description            TEXT,
      requirements           TEXT,
      responsibilities       TEXT,
      benefits               TEXT,
      is_public              INTEGER DEFAULT 1,
      published_at           TEXT,
      closed_at              TEXT,
      created_by_id          TEXT,
      created_by_name        TEXT,
      created_at             TEXT DEFAULT (datetime('now')),
      updated_at             TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON job_postings(tenant_id, status);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id                 TEXT PRIMARY KEY,
      tenant_id          TEXT NOT NULL,
      name               TEXT NOT NULL,
      email              TEXT NOT NULL,
      phone              TEXT,
      linkedin_url       TEXT,
      portfolio_url      TEXT,
      city               TEXT,
      state              TEXT,
      source             TEXT NOT NULL DEFAULT 'site_carreiras',
      resume_filename    TEXT,
      resume_data_base64 TEXT,
      resume_mime_type   TEXT,
      lgpd_consent       INTEGER DEFAULT 1,
      lgpd_consent_date  TEXT,
      notes              TEXT,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_candidates_tenant_email ON candidates(tenant_id, email);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS job_applications (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      job_id           TEXT NOT NULL,
      candidate_id     TEXT NOT NULL,
      stage            TEXT NOT NULL DEFAULT 'inscricao',
      rejection_reason TEXT,
      rating           REAL DEFAULT 0,
      applied_at       TEXT DEFAULT (datetime('now')),
      hired_at         TEXT,
      updated_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, job_id, candidate_id)
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_applications_job_stage ON job_applications(tenant_id, job_id, stage);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS application_stage_history (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      application_id  TEXT NOT NULL,
      from_stage      TEXT,
      to_stage        TEXT NOT NULL,
      changed_by_id   TEXT,
      changed_by_name TEXT,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_stage_history_app ON application_stage_history(application_id, created_at DESC);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS interviews (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      application_id    TEXT NOT NULL,
      candidate_name    TEXT NOT NULL,
      job_title         TEXT NOT NULL,
      interviewer_id    TEXT,
      interviewer_name  TEXT NOT NULL,
      scheduled_at      TEXT NOT NULL,
      duration_minutes  INTEGER DEFAULT 45,
      meeting_link      TEXT,
      status            TEXT NOT NULL DEFAULT 'agendada',
      technical_rating  INTEGER DEFAULT 0,
      behavioral_rating INTEGER DEFAULT 0,
      cultural_rating   INTEGER DEFAULT 0,
      recommendation    TEXT DEFAULT 'pendente',
      feedback_notes    TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_interviews_tenant_date ON interviews(tenant_id, scheduled_at ASC);`)
  } catch (_e) {}

  // 6. MÓDULO: Webhooks de Saída e Integrações Externas
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      name            TEXT NOT NULL,
      url             TEXT NOT NULL,
      secret          TEXT NOT NULL,
      events_json     TEXT NOT NULL,
      is_active       INTEGER DEFAULT 1,
      created_by_id   TEXT,
      created_by_name TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_wh_sub_tenant ON webhook_subscriptions(tenant_id, is_active);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      subscription_id   TEXT NOT NULL,
      event_id          TEXT NOT NULL,
      event_type        TEXT NOT NULL,
      payload_json      TEXT NOT NULL,
      attempt_count     INTEGER DEFAULT 0,
      max_attempts      INTEGER DEFAULT 3,
      next_attempt_at   TEXT DEFAULT (datetime('now')),
      status            TEXT NOT NULL DEFAULT 'pending',
      response_code     INTEGER,
      response_body     TEXT,
      execution_time_ms INTEGER,
      last_error        TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      delivered_at      TEXT,
      FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_wh_del_tenant_status ON webhook_deliveries(tenant_id, status);`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_wh_del_event ON webhook_deliveries(event_id);`)
  } catch (_e) {}

  // 7. MÓDULO: Governança RBAC & Matriz Dinâmica de Permissões
  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role        TEXT NOT NULL,
      permission  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (role, permission)
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_role_perms ON role_permissions(role);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id     TEXT NOT NULL,
      permission  TEXT NOT NULL,
      granted     INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, permission)
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_user_perms ON user_permissions(user_id);`)
  } catch (_e) {}

  // 8. MÓDULO: Gestão de Férias (Períodos Aquisitivos, Concessivos & Solicitações)
  db.run(`
    CREATE TABLE IF NOT EXISTS vacation_periods (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      employee_id       TEXT NOT NULL,
      employee_name     TEXT NOT NULL,
      aquisitivo_inicio TEXT NOT NULL,
      aquisitivo_fim    TEXT NOT NULL,
      concessivo_inicio TEXT NOT NULL,
      concessivo_fim    TEXT NOT NULL,
      dias_direito      INTEGER DEFAULT 30,
      dias_gozados      INTEGER DEFAULT 0,
      dias_saldo        INTEGER DEFAULT 30,
      status            TEXT NOT NULL DEFAULT 'adquirido',
      created_at        TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_vacation_periods_emp ON vacation_periods(tenant_id, employee_id);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS vacation_requests (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      period_id        TEXT NOT NULL,
      employee_id      TEXT NOT NULL,
      employee_name    TEXT NOT NULL,
      data_inicio      TEXT NOT NULL,
      data_fim         TEXT NOT NULL,
      dias             INTEGER NOT NULL,
      abono_pecuniario INTEGER DEFAULT 0,
      adiantamento_13  INTEGER DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'pendente',
      observacoes      TEXT,
      solicitada_em    TEXT DEFAULT (datetime('now')),
      aprovada_por     TEXT,
      aprovada_em      TEXT,
      motivo_rejeicao  TEXT,
      FOREIGN KEY (period_id) REFERENCES vacation_periods(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_vacation_req_emp ON vacation_requests(tenant_id, employee_id, status);`)
  } catch (_e) {}

  // 9. MÓDULO: Ponto Eletrônico & Banco de Horas
  db.run(`
    CREATE TABLE IF NOT EXISTS time_records (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      employee_id   TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      date          TEXT NOT NULL,
      punch_type    TEXT NOT NULL,
      punch_time    TEXT NOT NULL,
      timestamp     TEXT NOT NULL,
      latitude      REAL,
      longitude     REAL,
      location_name TEXT,
      ip_address    TEXT,
      source        TEXT DEFAULT 'web',
      status        TEXT DEFAULT 'regular',
      justification TEXT,
      approved_by   TEXT,
      approved_at   TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_time_records_emp_date ON time_records(tenant_id, employee_id, date);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS time_adjustments (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      employee_id       TEXT NOT NULL,
      employee_name     TEXT NOT NULL,
      date              TEXT NOT NULL,
      punch_type        TEXT NOT NULL,
      requested_time    TEXT NOT NULL,
      reason            TEXT NOT NULL,
      attachment_url    TEXT,
      status            TEXT DEFAULT 'pendente',
      reviewed_by       TEXT,
      reviewed_at       TEXT,
      reviewer_comments TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_time_adj_emp ON time_adjustments(tenant_id, employee_id, status);`)
  } catch (_e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS time_bank_balances (
      id                      TEXT PRIMARY KEY,
      tenant_id               TEXT NOT NULL,
      employee_id             TEXT NOT NULL,
      month_year              TEXT NOT NULL,
      expected_minutes        INTEGER DEFAULT 0,
      worked_minutes          INTEGER DEFAULT 0,
      month_balance_minutes   INTEGER DEFAULT 0,
      accumulated_balance_min INTEGER DEFAULT 0,
      updated_at              TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, employee_id, month_year)
    );
  `)

  // 10. MÓDULO: Gestão de Benefícios
  db.run(`
    CREATE TABLE IF NOT EXISTS benefits_catalog (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      code             TEXT NOT NULL,
      name             TEXT NOT NULL,
      category         TEXT NOT NULL,
      provider         TEXT NOT NULL,
      description      TEXT,
      company_cost     REAL DEFAULT 0,
      employee_cost    REAL DEFAULT 0,
      copay_percentage REAL DEFAULT 0,
      is_active        INTEGER DEFAULT 1,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS employee_benefits (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      employee_id       TEXT NOT NULL,
      employee_name     TEXT NOT NULL,
      benefit_id        TEXT NOT NULL,
      status            TEXT DEFAULT 'ativo',
      enrollment_date   TEXT,
      cancellation_date TEXT,
      custom_coverage   TEXT,
      dependents_count  INTEGER DEFAULT 0,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (benefit_id) REFERENCES benefits_catalog(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_emp_benefits ON employee_benefits(tenant_id, employee_id, status);`)
  } catch (_e) {}

  // 11. MÓDULO: Desligamento & Offboarding
  db.run(`
    CREATE TABLE IF NOT EXISTS offboardings (
      id                    TEXT PRIMARY KEY,
      tenant_id             TEXT NOT NULL,
      employee_id           TEXT NOT NULL,
      employee_name         TEXT NOT NULL,
      role                  TEXT NOT NULL,
      department            TEXT NOT NULL,
      hire_date             TEXT NOT NULL,
      termination_date      TEXT NOT NULL,
      resignation_type      TEXT NOT NULL,
      notice_period         TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'em_andamento',
      checklist_json        TEXT DEFAULT '[]',
      equipment_status_json TEXT DEFAULT '[]',
      severance_calc_json   TEXT DEFAULT '{}',
      exit_interview_json   TEXT DEFAULT '{}',
      created_by_name       TEXT,
      created_at            TEXT DEFAULT (datetime('now')),
      updated_at            TEXT DEFAULT (datetime('now'))
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_offboardings_tenant ON offboardings(tenant_id, status);`)
  } catch (_e) {}

  // 12. MÓDULO: Treinamentos & Normas Regulamentadoras (NRs)
  db.run(`
    CREATE TABLE IF NOT EXISTS trainings (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      category          TEXT NOT NULL,
      nr_code           TEXT,
      workload_hours    INTEGER DEFAULT 8,
      validity_months   INTEGER DEFAULT 12,
      is_mandatory      INTEGER DEFAULT 0,
      target_roles_json TEXT DEFAULT '[]',
      created_at        TEXT DEFAULT (datetime('now'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS employee_trainings (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      employee_id      TEXT NOT NULL,
      employee_name    TEXT NOT NULL,
      training_id      TEXT NOT NULL,
      status           TEXT DEFAULT 'inscrito',
      started_at       TEXT,
      completed_at     TEXT,
      expiry_date      TEXT,
      score            REAL,
      certificate_code TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_emp_trainings ON employee_trainings(tenant_id, employee_id, status);`)
  } catch (_e) {}

  // 13. MÓDULO: Pesquisa de Clima Organizacional & eNPS
  db.run(`
    CREATE TABLE IF NOT EXISTS climate_surveys (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      start_date        TEXT NOT NULL,
      end_date          TEXT NOT NULL,
      status            TEXT DEFAULT 'aberta',
      is_anonymous      INTEGER DEFAULT 1,
      target_department TEXT DEFAULT 'Todos',
      created_by_name   TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS survey_responses (
      id              TEXT PRIMARY KEY,
      survey_id       TEXT NOT NULL,
      tenant_id       TEXT NOT NULL,
      nps_score       INTEGER NOT NULL,
      comment         TEXT,
      ratings_json    TEXT DEFAULT '{}',
      respondent_hash TEXT NOT NULL,
      submitted_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (survey_id) REFERENCES climate_surveys(id) ON DELETE CASCADE,
      UNIQUE(survey_id, respondent_hash)
    );
  `)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_survey_resp ON survey_responses(survey_id);`)
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
    {
      id: "usr_admin",
      name: "Administrador Geral",
      email: "admin@peoplehub.com.br",
      password: "admin123",
      role: "ADMIN",
      department: "Tecnologia da Informação",
      initials: "AD",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_rh",
      name: "Mariana Alcantara",
      email: "rh@peoplehub.com.br",
      password: "admin123",
      role: "RH",
      department: "Recursos Humanos",
      initials: "MA",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_dp",
      name: "Carlos Eduardo Souza",
      email: "dp@peoplehub.com.br",
      password: "admin123",
      role: "DP",
      department: "Departamento Pessoal",
      initials: "CS",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_gestor",
      name: "Gestor TI",
      email: "gestor@peoplehub.com.br",
      password: "admin123",
      role: "GESTOR",
      department: "TI",
      initials: "GT",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_colab",
      name: "Gabriel Santos",
      email: "colaborador@peoplehub.com.br",
      password: "admin123",
      role: "COLABORADOR",
      department: "TI",
      initials: "GS",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_recrutador",
      name: "Renata Recrutadora",
      email: "recrutador@peoplehub.com.br",
      password: "admin123",
      role: "RECRUTADOR",
      department: "Recrutamento & Seleção",
      initials: "RR",
      tenant_id: "tenant_default",
    },
    {
      id: "usr_auditor",
      name: "Arthur Auditor",
      email: "auditor@peoplehub.com.br",
      password: "admin123",
      role: "AUDITOR",
      department: "Compliance & Auditoria",
      initials: "AA",
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

  // Garantir que as contas canônicas possuam suas roles oficiais restauradas
  try {
    db.run(`UPDATE users SET role = 'ADMIN' WHERE lower(email) = 'admin@empresa.com' OR lower(email) = 'admin@peoplehub.com.br'`)
    db.run(`UPDATE users SET role = 'RH' WHERE lower(email) = 'rh@peoplehub.com.br'`)
    db.run(`UPDATE users SET role = 'DP' WHERE lower(email) = 'dp@peoplehub.com.br'`)
    db.run(`UPDATE users SET role = 'GESTOR' WHERE lower(email) = 'gestor@peoplehub.com.br'`)
    db.run(`UPDATE users SET role = 'COLABORADOR' WHERE lower(email) = 'colaborador@peoplehub.com.br'`)
    db.run(`UPDATE users SET role = 'RECRUTADOR' WHERE lower(email) = 'recrutador@peoplehub.com.br'`)
    db.run(`UPDATE users SET role = 'AUDITOR' WHERE lower(email) = 'auditor@peoplehub.com.br'`)
  } catch (_e) {}

  // Garantir cadastro de colaborador para Gabriel Santos (colaborador padrão)
  try {
    const colabEmpCheck = db.exec(`SELECT id FROM employees WHERE lower(email) = 'colaborador@peoplehub.com.br'`)
    if (!colabEmpCheck.length || !colabEmpCheck[0].values.length) {
      db.run(
        `INSERT OR IGNORE INTO employees (id, name, role, department, status, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, tenant_id, address, city, state, cep)
         VALUES ('emp_colab_01', 'Gabriel Santos', 'Desenvolvedor Full-Stack', 'TI', 'Ativo', 'colaborador@peoplehub.com.br', '(11) 98765-4321', '123.456.789-00', '2023-03-15', 'R$ 7.200,00', 'Gestor TI', 'São Paulo, SP', 'CLT', '5x2', 'tenant_default', 'Rua das Flores, 120', 'São Paulo', 'SP', '01310-100')`
      )
    }
  } catch (_e) {}

  console.log("[DB] Usuários padrão e colaborador base configurados com sucesso.")

  // Vincular registros legados ao tenant padrão
  const tables = [
    "users",
    "conversations",
    "employees",
    "requests",
    "documents",
    "onboarding",
    "workflows",
    "calendar_events",
    "performance_cycles",
    "saved_reports",
  ]
  for (const t of tables) {
    try {
      db.run(`UPDATE ${t} SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL OR tenant_id = '';`)
    } catch (_e) {}
  }

  // Seed de Workflows
  try {
    const wfCheck = db.exec(`SELECT count(*) FROM workflows WHERE tenant_id = 'tenant_default'`)
    if (wfCheck.length && wfCheck[0].values[0][0] === 0) {
      const wf1Id = "wf_adm_01"
      db.run(
        `INSERT INTO workflows (id, tenant_id, title, category, description, employee_id, employee_name, current_step_id, status, due_date, created_by_id, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wf1Id,
          "tenant_default",
          "Admissão de Desenvolvedor Full-Stack",
          "Admissão",
          "Processo de ingresso, coleta de documentos e provisionamento de acessos",
          "emp_lucas_01",
          "Lucas Mendes",
          "step_adm_02",
          "em_andamento",
          "2026-11-15",
          "u_admin",
          "Administrador",
        ]
      )

      db.run(
        `INSERT INTO workflow_steps (id, workflow_id, tenant_id, order_index, title, description, assignee_role, status, due_date, completed_at, completed_by_name, comments)
         VALUES 
          ('step_adm_01', ?, 'tenant_default', 1, 'Coleta e Validação de Documentos', 'CTPS, CPF, comprovante de residência e ASO', 'RH', 'concluido', '2026-10-10', '2026-10-09', 'Mariana Alcantara', 'Documentação conferida e aprovada'),
          ('step_adm_02', ?, 'tenant_default', 2, 'Provisionamento de TI e Equipamentos', 'Criação de e-mail corporativo, notebook e crachá', 'ADMIN', 'em_execucao', '2026-10-25', NULL, NULL, 'Notebook em preparação pelo time de TI'),
          ('step_adm_03', ?, 'tenant_default', 3, 'Alinhamento com Liderança Imediata', 'Definição de metas e mentor de onboarding', 'GESTOR', 'pendente', '2026-11-01', NULL, NULL, NULL),
          ('step_adm_04', ?, 'tenant_default', 4, 'Assinatura Digital do Contrato CLT', 'Envio via portal PeopleHub e coleta de assinatura', 'RH', 'pendente', '2026-11-05', NULL, NULL, NULL)`,
        [wf1Id, wf1Id, wf1Id, wf1Id]
      )

      db.run(
        `INSERT INTO workflow_history (id, workflow_id, tenant_id, step_id, step_title, action, actor_name, actor_role, comments)
         VALUES 
          ('wfh_01', ?, 'tenant_default', 'step_adm_01', 'Coleta e Validação de Documentos', 'CONCLUIDA', 'Mariana Alcantara', 'RH', 'Documentos admitidos no prontuário digital'),
          ('wfh_02', ?, 'tenant_default', 'step_adm_02', 'Provisionamento de TI', 'INICIADA', 'Lucas Mendes', 'ADMIN', 'Iniciada configuração de ambiente')`,
        [wf1Id, wf1Id]
      )
    }
  } catch (_e) {}

  // Seed de Calendário Corporativo
  try {
    const calCheck = db.exec(`SELECT count(*) FROM calendar_events WHERE tenant_id = 'tenant_default'`)
    if (calCheck.length && calCheck[0].values[0][0] === 0) {
      db.run(
        `INSERT INTO calendar_events (id, tenant_id, title, description, category, start_date, end_date, department, employee_name, is_all_day, location)
         VALUES 
          ('cal_01', 'tenant_default', 'Férias Programadas — Mariana Alcantara', 'Período aquisitivo 2024/2025 aprovado pelo RH', 'ferias', '2026-11-01', '2026-11-15', 'Recursos Humanos', 'Mariana Alcantara', 1, 'Remoto / Recesso'),
          ('cal_02', 'tenant_default', 'Onboarding Turma Nov/2026', 'Boas-vindas institucionais e tour da cultura corporativa', 'onboarding', '2026-11-03', '2026-11-04', 'Geral', 'Vários Colaboradores', 0, 'Auditório Principal & Teams'),
          ('cal_03', 'tenant_default', 'Prazo Final: Autoavaliação Ciclo 2026.1', 'Encerramento do prazo para submissão das notas pelos liderados', 'performance_deadline', '2026-11-10', '2026-11-10', 'Tecnologia', 'Equipe TI', 1, 'Portal PeopleHub'),
          ('cal_04', 'tenant_default', 'Renovação ASO Periódico — Operações', 'Exames médicos ocupacionais regulamentares (NR-7)', 'doc_expiry', '2026-11-20', '2026-11-20', 'Operações', 'Equipe Operacional', 0, 'Ambulatório Corporativo')`
      )
    }
  } catch (_e) {}

  // Seed de Avaliação de Desempenho & Metas
  try {
    const perfCheck = db.exec(`SELECT count(*) FROM performance_cycles WHERE tenant_id = 'tenant_default'`)
    if (perfCheck.length && perfCheck[0].values[0][0] === 0) {
      const cycleId = "cycle_2026_1"
      db.run(
        `INSERT INTO performance_cycles (id, tenant_id, title, description, start_date, end_date, departments_json, status)
         VALUES (?, 'tenant_default', 'Ciclo de Desempenho & Metas Corporativas 2026.1', 'Avaliação semestral por competências e entregas estratégicas', '2026-09-01', '2026-12-15', ?, 'em_andamento')`,
        [cycleId, JSON.stringify(["Tecnologia", "Recursos Humanos", "Operações", "Financeiro"])]
      )

      db.run(
        `INSERT INTO evaluation_criteria (id, cycle_id, tenant_id, name, description, category, weight, scale_max)
         VALUES 
          ('crit_01', ?, 'tenant_default', 'Comunicação e Transparência', 'Clareza na transmissão de ideias e alinhamento contínuo', 'Comportamental', 1.0, 5),
          ('crit_02', ?, 'tenant_default', 'Qualidade Técnica e Entregas', 'Rigor metodológico, ausência de retrabalho e boas práticas', 'Técnica', 1.5, 5),
          ('crit_03', ?, 'tenant_default', 'Trabalho em Equipe e Colaboração', 'Disposição para apoiar pares e compartilhar conhecimento', 'Comportamental', 1.0, 5),
          ('crit_04', ?, 'tenant_default', 'Inovação e Solução de Problemas', 'Capacidade analítica frente a desafios imprevistos', 'Estratégica', 1.0, 5),
          ('crit_05', ?, 'tenant_default', 'Cumprimento de Prazos e SLAs', 'Pontualidade e responsabilidade nos compromissos assumidos', 'Operacional', 1.0, 5)`,
        [cycleId, cycleId, cycleId, cycleId, cycleId]
      )

      db.run(
        `INSERT INTO individual_goals (id, tenant_id, cycle_id, employee_id, employee_name, title, description, metric_target, current_progress, due_date, status, comments)
         VALUES 
          ('goal_01', 'tenant_default', ?, 'emp_01', 'Gabriel Santos', 'Automatizar Cobertura de Testes para 85%', 'Implementar suíte completa de testes no PeopleHub', '85% Cobertura', 75, '2026-11-30', 'em_progresso', 'Vitest e runner de backend configurados'),
          ('goal_02', 'tenant_default', ?, 'emp_02', 'Mariana Alcantara', 'Reduzir Tempo Médio de Admissão em 20%', 'Otimizar o fluxo de onboarding e prontuários digitais', 'Redução de 20%', 80, '2026-12-10', 'em_progresso', 'Workflows digitais em fase de adoção')`,
        [cycleId, cycleId]
      )
    }
  } catch (_e) {}

  // Seed de Notificações
  try {
    const notifCheck = db.exec(`SELECT count(*) FROM notifications WHERE tenant_id = 'tenant_default'`)
    if (notifCheck.length && notifCheck[0].values[0][0] === 0) {
      db.run(
        `INSERT INTO notifications (id, tenant_id, user_email, title, description, category, priority, link, read)
         VALUES 
          ('notif_01', 'tenant_default', 'admin@empresa.com', 'Nova Etapa de Workflow Atribuída', 'Você é o responsável pela etapa Provisionamento de TI no fluxo de Admissão.', 'workflow', 'alta', '/workflows', 0),
          ('notif_02', 'tenant_default', 'admin@empresa.com', 'Ciclo de Desempenho 2026.1 Aberto', 'O ciclo semestral de avaliação foi aberto para todas as equipes.', 'performance', 'media', '/desempenho', 0),
          ('notif_03', 'tenant_default', 'admin@empresa.com', 'Contrato a Vencer (< 30 dias)', 'O contrato de estágio do setor de Operações vencerá em 25 dias.', 'document', 'media', '/documentos', 1)`
      )
    }
  } catch (_e) {}

  // Seed de Relatórios Salvos
  try {
    const repCheck = db.exec(`SELECT count(*) FROM saved_reports WHERE tenant_id = 'tenant_default'`)
    if (repCheck.length && repCheck[0].values[0][0] === 0) {
      db.run(
        `INSERT INTO saved_reports (id, tenant_id, title, description, entity_type, filters_json, columns_json, group_by, chart_type, created_by_name)
         VALUES 
          ('rep_01', 'tenant_default', 'Distribuição de Colaboradores por Departamento', 'Quadro completo de headcount agrupado por departamento', 'employees', '{}', '["name", "role", "department", "salary", "status"]', 'department', 'doughnut', 'Administrador'),
          ('rep_02', 'tenant_default', 'Acompanhamento de Solicitações do Mês', 'Visão consolidada de pedidos de férias e abonos pendentes vs aprovados', 'requests', '{"status": "todos"}', '["id", "type", "requester", "department", "status", "date"]', 'status', 'bar', 'Administrador')`
      )
    }
  } catch (_e) {}

  // Seed de Recrutamento & Seleção (ATS)
  try {
    const jobCheck = db.exec(`SELECT count(*) FROM job_postings WHERE tenant_id = 'tenant_default'`)
    if (jobCheck.length && jobCheck[0].values[0][0] === 0) {
      // 1. Vagas
      db.run(`
        INSERT INTO job_postings (id, tenant_id, title, department, role, work_model, contract_type, location, positions_count, status, salary_min, salary_max, salary_is_confidential, description, requirements, responsibilities, benefits, is_public, published_at, created_by_name)
        VALUES
          ('job_01', 'tenant_default', 'Desenvolvedor(a) Full Stack Sênior', 'Tecnologia da Informação', 'Engenheiro de Software', 'hibrido', 'CLT', 'São Paulo, SP', 2, 'aberta', 14000, 18000, 1, 'Buscamos profissional sênior para arquitetar soluções cloud e evoluir nossa plataforma PeopleHub.', 'Experiência sólida com Node.js, TypeScript, Vue/React, bancos relacionais e microsserviços.', 'Desenvolver funcionalidades escaláveis, mentorar desenvolvedores plenos e zelar pela segurança das aplicações.', 'Vale Refeição, Plano de Saúde Bradesco Top Nacional, Gympass, Auxílio Home Office, PLR anual.', 1, datetime('now', '-10 days'), 'Mariana Alcantara'),
          ('job_02', 'tenant_default', 'Especialista em Atração & Seleção (DHO)', 'Recursos Humanos', 'Analista de R&S', 'remoto', 'CLT', 'Remoto (Brasil)', 1, 'aberta', 7500, 9500, 0, 'Responsável por conduzir processos seletivos estratégicos e implementar metodologias ágeis de contratação.', 'Experiência em recrutamento tech e corporativo, hunting no LinkedIn e condução de dinâmicas estruturadas.', 'Alinhamento de perfil com gestores, triagem ativa, entrevistas por competências e gestão de indicadores de SLA.', 'Vale Refeição flexível, Seguro de Vida, TotalPass, Auxílio Educação e Day Off no Aniversário.', 1, datetime('now', '-5 days'), 'Mariana Alcantara'),
          ('job_03', 'tenant_default', 'Coordenador(a) de Operações e Logística', 'Operações', 'Coordenador de Operações', 'presencial', 'CLT', 'Campinas, SP', 1, 'aberta', 11000, 13500, 1, 'Liderança de times operacionais e otimização contínua de processos logísticos e de distribuição.', 'Superior completo em Engenharia ou Administração, sólida vivência em gestão de frotas e centros de distribuição.', 'Coordenação de equipes de campo, controle de SLAs operacionais e gestão de custos.', 'Plano de Saúde, Carro corporativo, Vale Alimentação e Previdência Privada.', 1, datetime('now', '-2 days'), 'Mariana Alcantara');
      `)

      // 2. Candidatos
      db.run(`
        INSERT INTO candidates (id, tenant_id, name, email, phone, linkedin_url, portfolio_url, city, state, source, resume_filename, resume_mime_type, lgpd_consent, lgpd_consent_date, notes)
        VALUES
          ('cand_01', 'tenant_default', 'Lucas Martins Oliveira', 'lucas.martins@exemplo.com', '(11) 98888-1111', 'https://linkedin.com/in/lucasmartins-tech', 'https://github.com/lucasmartins', 'São Paulo', 'SP', 'linkedin', 'curriculo_lucas_martins.pdf', 'application/pdf', 1, datetime('now', '-9 days'), 'Excelente comunicação e perfil sênior sólido em Vue e TypeScript.'),
          ('cand_02', 'tenant_default', 'Fernanda Lima Souza', 'fernanda.lima@exemplo.com', '(11) 97777-2222', 'https://linkedin.com/in/fernandalima-dev', 'https://fernandadev.io', 'Campinas', 'SP', 'site_carreiras', 'curriculo_fernanda_lima.pdf', 'application/pdf', 1, datetime('now', '-7 days'), 'Testes técnicos com pontuação 98% e bom fit cultural com o time.'),
          ('cand_03', 'tenant_default', 'Rafael Nogueira Mendes', 'rafael.nogueira@exemplo.com', '(21) 96666-3333', 'https://linkedin.com/in/rafael-nogueira-rh', '', 'Rio de Janeiro', 'RJ', 'indicacao', 'curriculo_rafael_nogueira.pdf', 'application/pdf', 1, datetime('now', '-4 days'), 'Indicado pelo diretor de operações; perfil voltado a hunting executivo.'),
          ('cand_04', 'tenant_default', 'Camila Duarte Rocha', 'camila.duarte@exemplo.com', '(31) 95555-4444', 'https://linkedin.com/in/camila-duarte', '', 'Belo Horizonte', 'MG', 'gupy', 'curriculo_camila_duarte.pdf', 'application/pdf', 1, datetime('now', '-6 days'), 'Aprovada em comitê executivo com recomendação FORTE_SIM.'),
          ('cand_05', 'tenant_default', 'Rodrigo Silveira Ramos', 'rodrigo.silveira@exemplo.com', '(41) 94444-5555', 'https://linkedin.com/in/rodrigo-silveira-ops', '', 'Curitiba', 'PR', 'linkedin', 'curriculo_rodrigo_silveira.pdf', 'application/pdf', 1, datetime('now', '-15 days'), 'Contratado para a vaga de Operações; documentação enviada para Onboarding.');
      `)

      // 3. Candidaturas e Etapas
      db.run(`
        INSERT INTO job_applications (id, tenant_id, job_id, candidate_id, stage, rating, applied_at, hired_at)
        VALUES
          ('app_01', 'tenant_default', 'job_01', 'cand_01', 'entrevista', 4.5, datetime('now', '-9 days'), NULL),
          ('app_02', 'tenant_default', 'job_01', 'cand_02', 'teste_tecnico', 4.8, datetime('now', '-7 days'), NULL),
          ('app_03', 'tenant_default', 'job_02', 'cand_03', 'triagem', 3.5, datetime('now', '-4 days'), NULL),
          ('app_04', 'tenant_default', 'job_02', 'cand_04', 'aprovado', 5.0, datetime('now', '-6 days'), NULL),
          ('app_05', 'tenant_default', 'job_03', 'cand_05', 'contratado', 4.7, datetime('now', '-15 days'), datetime('now', '-1 days'));
      `)

      // 4. Histórico de Etapas
      db.run(`
        INSERT INTO application_stage_history (id, tenant_id, application_id, from_stage, to_stage, changed_by_name, notes)
        VALUES
          ('hist_app_01', 'tenant_default', 'app_01', 'triagem', 'entrevista', 'Mariana Alcantara', 'Triagem positiva. Agendada entrevista com liderança técnica.'),
          ('hist_app_02', 'tenant_default', 'app_02', 'entrevista', 'teste_tecnico', 'Mariana Alcantara', 'Entrevista inicial realizada com feedback positivo. Enviado desafio técnico.'),
          ('hist_app_04', 'tenant_default', 'app_04', 'teste_tecnico', 'aprovado', 'Mariana Alcantara', 'Aprovada na entrevista final. Emissão de carta proposta formal.'),
          ('hist_app_05', 'tenant_default', 'app_05', 'aprovado', 'contratado', 'Mariana Alcantara', 'Proposta aceita e integração com pasta funcional iniciada.');
      `)

      // 5. Entrevistas & Avaliações
      db.run(`
        INSERT INTO interviews (id, tenant_id, application_id, candidate_name, job_title, interviewer_name, scheduled_at, duration_minutes, meeting_link, status, technical_rating, behavioral_rating, cultural_rating, recommendation, feedback_notes)
        VALUES
          ('int_01', 'tenant_default', 'app_01', 'Lucas Martins Oliveira', 'Desenvolvedor(a) Full Stack Sênior', 'Mariana Alcantara & Tech Lead', datetime('now', '+1 day', 'start of day', '+14 hours'), 60, 'https://meet.google.com/ph-tech-int', 'agendada', 4, 5, 5, 'forte_sim', 'Candidato demonstrou ótima desenvoltura e clareza de raciocínio lógico.'),
          ('int_02', 'tenant_default', 'app_04', 'Camila Duarte Rocha', 'Especialista em Atração & Seleção (DHO)', 'Mariana Alcantara', datetime('now', '-2 days'), 45, 'https://meet.google.com/ph-rh-int', 'realizada', 5, 5, 5, 'forte_sim', 'Perfil excelente, ampla experiência com hunting tech e gestão por competências.');
      `)
    }
  } catch (_e) {}

  // 6. Seed de Gestão de Férias
  try {
    const vacCheck = db.exec(`SELECT count(*) FROM vacation_periods WHERE tenant_id = 'tenant_default'`)
    if (vacCheck.length && vacCheck[0].values[0][0] === 0) {
      db.run(`
        INSERT INTO vacation_periods (id, tenant_id, employee_id, employee_name, aquisitivo_inicio, aquisitivo_fim, concessivo_inicio, concessivo_fim, dias_direito, dias_gozados, dias_saldo, status)
        VALUES
          ('vac_per_colab_01', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', '2025-03-15', '2026-03-14', '2026-03-15', '2027-03-14', 30, 10, 20, 'adquirido'),
          ('vac_per_mariana_01', 'tenant_default', 'emp_02', 'Mariana Alcantara', '2024-11-01', '2025-10-31', '2025-11-01', '2026-10-31', 30, 15, 15, 'vencendo');
      `)

      db.run(`
        INSERT INTO vacation_requests (id, tenant_id, period_id, employee_id, employee_name, data_inicio, data_fim, dias, abono_pecuniario, adiantamento_13, status, observacoes, solicitada_em, aprovada_por, aprovada_em)
        VALUES
          ('vac_req_01', 'tenant_default', 'vac_per_colab_01', 'emp_colab_01', 'Gabriel Santos', '2026-11-10', '2026-11-19', 10, 0, 0, 'aprovada', 'Primeira parcela das férias anuais', datetime('now', '-10 days'), 'Mariana Alcantara', datetime('now', '-8 days')),
          ('vac_req_02', 'tenant_default', 'vac_per_colab_01', 'emp_colab_01', 'Gabriel Santos', '2026-12-20', '2026-12-29', 10, 0, 1, 'pendente', 'Segunda fração de férias de final de ano', datetime('now', '-2 days'), NULL, NULL);
      `)
    }
  } catch (_e) {}

  // 7. Seed de Ponto Eletrônico & Banco de Horas
  try {
    const timeCheck = db.exec(`SELECT count(*) FROM time_records WHERE tenant_id = 'tenant_default'`)
    if (timeCheck.length && timeCheck[0].values[0][0] === 0) {
      const today = new Date().toISOString().split("T")[0]
      db.run(`
        INSERT INTO time_records (id, tenant_id, employee_id, employee_name, date, punch_type, punch_time, timestamp, location_name, source, status)
        VALUES
          ('time_01', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', ?, 'entrada_1', '08:03', ? || 'T08:03:00.000Z', 'Escritório Sede SP', 'web', 'regular'),
          ('time_02', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', ?, 'saida_1', '12:05', ? || 'T12:05:00.000Z', 'Escritório Sede SP', 'web', 'regular'),
          ('time_03', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', ?, 'entrada_2', '13:08', ? || 'T13:08:00.000Z', 'Escritório Sede SP', 'web', 'regular');
      `, [today, today, today, today, today, today])

      db.run(`
        INSERT INTO time_bank_balances (id, tenant_id, employee_id, month_year, expected_minutes, worked_minutes, month_balance_minutes, accumulated_balance_min)
        VALUES ('tb_colab_01', 'tenant_default', 'emp_colab_01', '2026-10', 10560, 10830, 270, 750);
      `)
    }
  } catch (_e) {}

  // 8. Seed de Catálogo de Benefícios & Adesões
  try {
    const benCheck = db.exec(`SELECT count(*) FROM benefits_catalog WHERE tenant_id = 'tenant_default'`)
    if (benCheck.length && benCheck[0].values[0][0] === 0) {
      db.run(`
        INSERT INTO benefits_catalog (id, tenant_id, code, name, category, provider, description, company_cost, employee_cost, copay_percentage, is_active)
        VALUES
          ('ben_vr', 'tenant_default', 'BEN-VR-01', 'Vale Refeição Flexível', 'refeicao', 'Flash Benefícios', 'Crédito diário de R$ 42,00 para refeição em restaurantes e aplicativos.', 924.00, 0.00, 0, 1),
          ('ben_va', 'tenant_default', 'BEN-VA-01', 'Vale Alimentação Supermercado', 'alimentacao', 'Flash Benefícios', 'Crédito mensal de R$ 550,00 para supermercados e padarias.', 550.00, 0.00, 0, 1),
          ('ben_saude', 'tenant_default', 'BEN-SAUDE-TOP', 'Plano de Saúde Nacional Top', 'saude', 'Bradesco Saúde', 'Assistência médica completa nacional em quarto individual (Apartamento) e coparticipação 15%.', 780.00, 117.00, 15, 1),
          ('ben_odonto', 'tenant_default', 'BEN-ODONTO', 'Plano Odontológico Integral', 'odonto', 'OdontoPrev', 'Cobertura odontológica integral com próteses, ortodontia e urgências.', 48.00, 12.00, 0, 1),
          ('ben_vt', 'tenant_default', 'BEN-VT', 'Vale Transporte SPTrans / EMTU', 'transporte', 'SPTrans / CPTM', 'Passe transporte público com desconto legal CLT de até 6% do salário base.', 320.00, 0.00, 6, 1),
          ('ben_gym', 'tenant_default', 'BEN-GYM', 'TotalPass & Academias', 'gympass', 'TotalPass', 'Acesso ilimitado a redes BioRitmo, SmartFit e estúdios esportivos.', 120.00, 39.90, 0, 1),
          ('ben_vida', 'tenant_default', 'BEN-VIDA', 'Seguro de Vida em Grupo', 'vida', 'MetLife Brasil', 'Apólice coletiva com indenização integral e assistência funeral familiar.', 35.00, 0.00, 0, 1);
      `)

      db.run(`
        INSERT INTO employee_benefits (id, tenant_id, employee_id, employee_name, benefit_id, status, enrollment_date, custom_coverage, dependents_count)
        VALUES
          ('eb_01', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', 'ben_vr', 'ativo', '2023-03-15', 'Cartão Flash Mastercard', 0),
          ('eb_02', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', 'ben_saude', 'ativo', '2023-03-15', 'Titular - Quarto Individual', 1),
          ('eb_03', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', 'ben_gym', 'ativo', '2024-01-10', 'Plano TP3 TotalPass', 0);
      `)
    }
  } catch (_e) {}

  // 9. Seed de Desligamento / Offboarding
  try {
    const offCheck = db.exec(`SELECT count(*) FROM offboardings WHERE tenant_id = 'tenant_default'`)
    if (offCheck.length && offCheck[0].values[0][0] === 0) {
      db.run(`
        INSERT INTO offboardings (id, tenant_id, employee_id, employee_name, role, department, hire_date, termination_date, resignation_type, notice_period, status, checklist_json, equipment_status_json, severance_calc_json, exit_interview_json, created_by_name)
        VALUES (
          'off_01',
          'tenant_default',
          'emp_legacy_09',
          'Renata Meirelles',
          'Analista Financeiro Pleno',
          'Financeiro',
          '2024-02-01',
          '2026-09-30',
          'pedido_demissao',
          'trabalhado',
          'concluido',
          '[{"id":"c1","task":"Revogação de acessos de e-mail e VPN","completed":true,"assignedRole":"TI"},{"id":"c2","task":"Exame Médico Demissional (ASO)","completed":true,"assignedRole":"RH"},{"id":"c3","task":"Homologação e Assinatura do TRCT","completed":true,"assignedRole":"DP"},{"id":"c4","task":"Baixa na Carteira de Trabalho Digital (eSocial)","completed":true,"assignedRole":"DP"}]',
          '[{"item":"Notebook Dell Latitude 5420","serial":"BR-5420-991","returned":true},{"item":"Crachá Corporativo","serial":"CR-4019","returned":true}]',
          '{"saldoSalario":3800,"decimoTerceiroProp":2533.33,"feriasProp":1900,"tercoConstitucional":633.33,"totalBruto":8866.66,"totalLiquido":7645.12}',
          '{"motivoPrincipal":"Proposta profissional com desafio internacional","ambienteAvaliacao":9,"liderancaAvaliacao":9,"recomendariaEmpresa":true,"feedback":"Excelente cultura e acolhimento dos líderes."}',
          'Mariana Alcantara'
        );
      `)
    }
  } catch (_e) {}

  // 10. Seed de Treinamentos & NRs
  try {
    const trCheck = db.exec(`SELECT count(*) FROM trainings WHERE tenant_id = 'tenant_default'`)
    if (trCheck.length && trCheck[0].values[0][0] === 0) {
      db.run(`
        INSERT INTO trainings (id, tenant_id, title, description, category, nr_code, workload_hours, validity_months, is_mandatory, target_roles_json)
        VALUES
          ('tr_01', 'tenant_default', 'NR-06 — Uso, Guarda e Conservação de EPIs', 'Diretrizes legais e práticas seguras para manuseio e proteção individual.', 'norma_regulamentadora', 'NR-06', 4, 12, 1, '["Operador de Logística", "Técnico de Manutenção", "Engenheiro"]'),
          ('tr_02', 'tenant_default', 'LGPD & Segurança da Informação no Ambiente Corporativo', 'Práticas de tratamento de dados sensíveis e conformidade legal com a Lei Geral de Proteção de Dados.', 'compliance', NULL, 6, 24, 1, '["Todos"]'),
          ('tr_03', 'tenant_default', 'NR-10 — Segurança em Instalações e Serviços em Eletricidade', 'Curso regulamentar de prevenção de riscos elétricos e primeiros socorros.', 'norma_regulamentadora', 'NR-10', 40, 24, 1, '["Eletricista", "Técnico de Manutenção"]'),
          ('tr_04', 'tenant_default', 'Liderança Humanizada, Feedback & Comunicação Não-Violenta', 'Desenvolvimento de competências para gestores e líderes de equipes no PeopleHub.', 'lideranca', NULL, 16, 36, 0, '["Gestor TI", "Coordenador de Operações", "Líder de Equipe"]');
      `)

      db.run(`
        INSERT INTO employee_trainings (id, tenant_id, employee_id, employee_name, training_id, status, started_at, completed_at, expiry_date, score, certificate_code)
        VALUES
          ('et_01', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', 'tr_02', 'concluido', '2025-04-01', '2025-04-05', '2027-04-05', 9.8, 'CERT-LGPD-2025-GS99'),
          ('et_02', 'tenant_default', 'emp_colab_01', 'Gabriel Santos', 'tr_04', 'em_andamento', '2026-10-15', NULL, NULL, NULL, NULL);
      `)
    }
  } catch (_e) {}

  // 11. Seed de Pesquisa de Clima Organizacional & eNPS
  try {
    const survCheck = db.exec(`SELECT count(*) FROM climate_surveys WHERE tenant_id = 'tenant_default'`)
    if (survCheck.length && survCheck[0].values[0][0] === 0) {
      const survId = "surv_2026_q3"
      db.run(`
        INSERT INTO climate_surveys (id, tenant_id, title, description, start_date, end_date, status, is_anonymous, target_department, created_by_name)
        VALUES (?, 'tenant_default', 'Pesquisa de Clima Organizacional & Pulso de eNPS — 2º Semestre/2026', 'Avaliação confidencial de satisfação, cultura, liderança e benefícios para aprimoramento contínuo.', '2026-09-01', '2026-11-30', 'aberta', 1, 'Todos', 'Mariana Alcantara');
      `, [survId])

      db.run(`
        INSERT INTO survey_responses (id, survey_id, tenant_id, nps_score, comment, ratings_json, respondent_hash)
        VALUES
          ('sr_01', ?, 'tenant_default', 10, 'A empresa oferece excelente equilíbrio entre vida pessoal e profissional. Time muito unido.', '{"lideranca":5,"ambiente":5,"beneficios":4,"oportunidades":5}', 'hash_anon_1111'),
          ('sr_02', ?, 'tenant_default', 9, 'Ótima infraestrutura de trabalho e transparência da diretoria.', '{"lideranca":5,"ambiente":4,"beneficios":4,"oportunidades":4}', 'hash_anon_2222'),
          ('sr_03', ?, 'tenant_default', 8, 'Gosto muito de trabalhar aqui. Seria ótimo aumentar o auxílio creche.', '{"lideranca":4,"ambiente":4,"beneficios":3,"oportunidades":4}', 'hash_anon_3333'),
          ('sr_04', ?, 'tenant_default', 9, 'Processos de feedback claros e oportunidades reais de crescimento.', '{"lideranca":5,"ambiente":5,"beneficios":5,"oportunidades":4}', 'hash_anon_4444'),
          ('sr_05', ?, 'tenant_default', 6, 'A comunicação entre áreas operacionais e administrativas precisa melhorar um pouco.', '{"lideranca":3,"ambiente":4,"beneficios":3,"oportunidades":3}', 'hash_anon_5555');
      `, [survId, survId, survId, survId, survId])
    }
  } catch (_e) {}

  persist()
  console.log("[DB] Banco de dados configurado limpo: dados iniciais e sementes verificados.")
}

