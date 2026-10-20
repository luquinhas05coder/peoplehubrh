/**
 * routes/custom_reports.routes.ts — Construtor de Relatórios Customizados com Segurança e Multi-tenancy
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// Whitelist de tabelas e colunas permitidas para evitar qualquer SQL Injection
const ALLOWED_ENTITIES: Record<string, { table: string; allowedColumns: string[] }> = {
  employees: {
    table: "employees",
    allowedColumns: [
      "id",
      "name",
      "role",
      "department",
      "status",
      "hireDate",
      "salary",
      "manager",
      "location",
      "contractType",
      "workSchedule",
      "city",
      "state",
    ],
  },
  requests: {
    table: "requests",
    allowedColumns: ["id", "requester", "type", "status", "date", "priority", "department", "created_at"],
  },
  workflows: {
    table: "workflows",
    allowedColumns: [
      "id",
      "title",
      "category",
      "status",
      "employee_name",
      "due_date",
      "created_by_name",
      "created_at",
      "updated_at",
    ],
  },
  evaluations: {
    table: "evaluations",
    allowedColumns: [
      "id",
      "cycle_id",
      "employee_name",
      "evaluator_name",
      "type",
      "status",
      "final_score",
      "submitted_at",
      "updated_at",
    ],
  },
  adverse_events: {
    table: "adverse_events",
    allowedColumns: [
      "id",
      "title",
      "severity",
      "category",
      "status",
      "reported_by",
      "department",
      "created_at",
    ],
  },
  job_postings: {
    table: "job_postings",
    allowedColumns: [
      "id",
      "title",
      "department",
      "role",
      "status",
      "work_model",
      "contract_type",
      "positions_count",
      "published_at",
      "created_at",
    ],
  },
  candidates: {
    table: "candidates",
    allowedColumns: [
      "id",
      "full_name",
      "email",
      "phone",
      "city",
      "state",
      "source",
      "created_at",
    ],
  },
}

// Sanitização de valores para exportação segura em CSV (Prevenção de CSV Formula Injection)
function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return ""
  let str = String(val).replace(/"/g, '""')
  // Se começar com caracteres de fórmula (=, +, -, @, tab, CR), prefixa com apóstrofo
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str}"`
}

// POST /api/reports/custom/query — Execução de consulta customizada
router.post("/query", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "reports.view") && !roleHasPermission(userRole, "reports.custom_build")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para gerar relatórios." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const {
    entity = "employees",
    columns = [],
    filters = [],
    groupBy,
    aggregateFn,
    aggregateCol,
    orderBy,
    orderDir = "ASC",
    limit = 200,
  } = req.body

  const entityConfig = ALLOWED_ENTITIES[entity]
  if (!entityConfig) {
    res.status(400).json({
      ok: false,
      error: `Entidade inválida. Entidades suportadas: ${Object.keys(ALLOWED_ENTITIES).join(", ")}`,
    })
    return
  }

  const db = getDB()
  const params: any[] = [tenantId]

  // Validar colunas solicitadas
  const selectedCols: string[] = []
  if (Array.isArray(columns) && columns.length > 0) {
    for (const c of columns) {
      if (entityConfig.allowedColumns.includes(c)) {
        selectedCols.push(c)
      }
    }
  }

  // Se groupBy foi especificado
  let selectClause = ""
  if (groupBy && entityConfig.allowedColumns.includes(groupBy)) {
    let agg = "COUNT(*)"
    if (aggregateFn && aggregateCol && entityConfig.allowedColumns.includes(aggregateCol)) {
      const fn = ["AVG", "SUM", "MIN", "MAX", "COUNT"].includes(aggregateFn.toUpperCase())
        ? aggregateFn.toUpperCase()
        : "COUNT"
      agg = `${fn}(${aggregateCol})`
    }
    selectClause = `${groupBy} AS agrupamento, ${agg} AS total_metrica, COUNT(*) as qtd`
  } else {
    const finalCols = selectedCols.length > 0 ? selectedCols : entityConfig.allowedColumns
    selectClause = finalCols.join(", ")
  }

  let sql = `SELECT ${selectClause} FROM ${entityConfig.table} WHERE tenant_id = ?`

  // Processar filtros dinâmicos de forma segura
  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (!f || !f.column || !entityConfig.allowedColumns.includes(f.column)) continue
      const operator = (f.operator || "=").toUpperCase()
      const val = f.value

      if (operator === "=" || operator === "!=" || operator === ">" || operator === "<" || operator === ">=" || operator === "<=") {
        sql += ` AND ${f.column} ${operator} ?`
        params.push(val)
      } else if (operator === "LIKE" || operator === "CONTAINS") {
        sql += ` AND ${f.column} LIKE ?`
        params.push(`%${val}%`)
      } else if (operator === "IN" && Array.isArray(val) && val.length > 0) {
        const placeholders = val.map(() => "?").join(", ")
        sql += ` AND ${f.column} IN (${placeholders})`
        params.push(...val)
      }
    }
  }

  if (groupBy && entityConfig.allowedColumns.includes(groupBy)) {
    sql += ` GROUP BY ${groupBy}`
  }

  if (orderBy && entityConfig.allowedColumns.includes(orderBy)) {
    const dir = orderDir?.toUpperCase() === "DESC" ? "DESC" : "ASC"
    sql += ` ORDER BY ${orderBy} ${dir}`
  } else if (!groupBy) {
    sql += ` ORDER BY rowid DESC`
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500)
  sql += ` LIMIT ${safeLimit}`

  try {
    const result = db.exec(sql, params)
    const rows: any[] = []

    if (result.length && result[0].values.length) {
      const colNames = result[0].columns
      for (const r of result[0].values) {
        const item: any = {}
        colNames.forEach((c, idx) => {
          item[c] = r[idx]
        })
        rows.push(item)
      }
    }

    res.json({
      ok: true,
      entity,
      total: rows.length,
      columns: result.length ? result[0].columns : entityConfig.allowedColumns,
      rows,
    })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Falha ao executar consulta: " + err.message })
  }
})

// GET /api/reports/custom/saved — Listar relatórios salvos
router.get("/saved", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT * FROM saved_reports WHERE tenant_id = ? ORDER BY created_at DESC`,
    [tenantId]
  )

  const reports: any[] = []
  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const r of result[0].values) {
      const item: any = {}
      cols.forEach((c, idx) => {
        item[c] = r[idx]
      })
      try {
        item.filters = JSON.parse(item.filters_json || "[]")
      } catch {
        item.filters = []
      }
      try {
        item.columns = JSON.parse(item.columns_json || "[]")
      } catch {
        item.columns = []
      }
      reports.push(item)
    }
  }

  res.json({ ok: true, reports })
})

// POST /api/reports/custom/saved — Salvar novo modelo de relatório
router.post("/saved", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "reports.saved_manage") && !roleHasPermission(userRole, "reports.custom_build")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para salvar modelos de relatório." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { title, description, entityType, filters, columns, groupBy, chartType } = req.body

  if (!title || !entityType) {
    res.status(400).json({ ok: false, error: "Título e entidade do relatório são obrigatórios." })
    return
  }

  const db = getDB()
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  db.run(
    `INSERT INTO saved_reports (id, tenant_id, title, description, entity_type, filters_json, columns_json, group_by, chart_type, created_by_id, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reportId,
      tenantId,
      title,
      description || null,
      entityType,
      JSON.stringify(filters || []),
      JSON.stringify(columns || []),
      groupBy || null,
      chartType || "bar",
      req.access?.userId,
      req.access?.name,
    ]
  )
  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "REPORT_TEMPLATE_CREATE",
    entity: "saved_reports",
    entityId: reportId,
    details: { title, entityType },
    tenantId,
  })

  res.status(201).json({ ok: true, id: reportId, message: "Modelo de relatório salvo com sucesso." })
})

// DELETE /api/reports/custom/saved/:id — Excluir modelo salvo
router.delete("/saved/:id", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "reports.saved_manage")) {
    res.status(403).json({ ok: false, error: "Acesso negado." })
    return
  }

  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  db.run(`DELETE FROM saved_reports WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  persist()

  res.json({ ok: true, message: "Modelo de relatório excluído." })
})

// POST /api/reports/custom/export/csv — Exportar dados em CSV com sanitização
router.post("/export/csv", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "reports.export")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para exportar dados." })
    return
  }

  const { title = "relatorio", columns = [], rows = [] } = req.body

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ ok: false, error: "Nenhum dado fornecido para exportação." })
    return
  }

  const actualColumns = columns.length > 0 ? columns : Object.keys(rows[0])
  const headerLine = actualColumns.map((c: string) => sanitizeCsvValue(c)).join(";")

  const dataLines = rows.map((r: any) => {
    return actualColumns.map((col: string) => sanitizeCsvValue(r[col])).join(";")
  })

  // BOM UTF-8 (\uFEFF) para visualização correta de acentuação no Microsoft Excel
  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n")

  const filename = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  res.send(csvContent)
})

export default router
