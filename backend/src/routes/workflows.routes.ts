/**
 * routes/workflows.routes.ts — Gestão e Execução Visual de Workflows de RH
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"
import { roleHasPermission } from "../constants/rbac.js"

const router = Router()
router.use(authenticateRBAC)

// GET /api/workflows — Listagem de processos com filtros e isolamento multi-tenant
router.get("/", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()
  const { status, category, employeeId, search } = req.query

  let sql = `SELECT * FROM workflows WHERE tenant_id = ?`
  const params: any[] = [tenantId]

  if (status && status !== "todos") {
    sql += ` AND status = ?`
    params.push(String(status))
  }

  if (category && category !== "todos") {
    sql += ` AND category = ?`
    params.push(String(category))
  }

  if (employeeId) {
    sql += ` AND employee_id = ?`
    params.push(String(employeeId))
  }

  if (search) {
    sql += ` AND (title LIKE ? OR employee_name LIKE ? OR description LIKE ?)`
    const term = `%${search}%`
    params.push(term, term, term)
  }

  sql += ` ORDER BY created_at DESC`

  const result = db.exec(sql, params)
  const workflows: any[] = []

  if (result.length && result[0].values.length) {
    const cols = result[0].columns
    for (const row of result[0].values) {
      const item: any = {}
      cols.forEach((col, idx) => {
        item[col] = row[idx]
      })

      // Buscar total de etapas e concluídas para progresso
      const stepCounts = db.exec(
        `SELECT count(*) as total, sum(case when status = 'concluido' then 1 else 0 end) as completed
         FROM workflow_steps WHERE workflow_id = ? AND tenant_id = ?`,
        [item.id, tenantId]
      )
      if (stepCounts.length && stepCounts[0].values.length) {
        const total = (stepCounts[0].values[0][0] as number) || 0
        const completed = (stepCounts[0].values[0][1] as number) || 0
        item.total_steps = total
        item.completed_steps = completed
        item.progress = total > 0 ? Math.round((completed / total) * 100) : 0
      } else {
        item.total_steps = 0
        item.completed_steps = 0
        item.progress = 0
      }

      workflows.push(item)
    }
  }

  res.json({ ok: true, workflows })
})

// GET /api/workflows/:id — Detalhes completos do workflow, etapas e histórico
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const wfRes = db.exec(`SELECT * FROM workflows WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!wfRes.length || !wfRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Processo de workflow não encontrado." })
    return
  }

  const wfCols = wfRes[0].columns
  const workflow: any = {}
  wfCols.forEach((col, idx) => {
    workflow[col] = wfRes[0].values[0][idx]
  })

  // Etapas ordenadas
  const stepsRes = db.exec(
    `SELECT * FROM workflow_steps WHERE workflow_id = ? AND tenant_id = ? ORDER BY order_index ASC`,
    [id, tenantId]
  )
  const steps: any[] = []
  if (stepsRes.length && stepsRes[0].values.length) {
    const sCols = stepsRes[0].columns
    for (const sRow of stepsRes[0].values) {
      const step: any = {}
      sCols.forEach((c, idx) => {
        step[c] = sRow[idx]
      })
      steps.push(step)
    }
  }

  // Histórico de auditoria / movimentações
  const histRes = db.exec(
    `SELECT * FROM workflow_history WHERE workflow_id = ? AND tenant_id = ? ORDER BY created_at DESC`,
    [id, tenantId]
  )
  const history: any[] = []
  if (histRes.length && histRes[0].values.length) {
    const hCols = histRes[0].columns
    for (const hRow of histRes[0].values) {
      const h: any = {}
      hCols.forEach((c, idx) => {
        h[c] = hRow[idx]
      })
      history.push(h)
    }
  }

  workflow.steps = steps
  workflow.history = history

  res.json({ ok: true, workflow })
})

// POST /api/workflows — Criação de novo processo com etapas
router.post("/", (req: Request, res: Response) => {
  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "workflows.create")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para criar processos de workflow." })
    return
  }

  const tenantId = req.tenantId || "tenant_default"
  const { title, category, description, employeeId, employeeName, dueDate, steps } = req.body

  if (!title || !category || !Array.isArray(steps) || steps.length === 0) {
    res.status(400).json({ ok: false, error: "Título, categoria e ao menos uma etapa são obrigatórios." })
    return
  }

  const db = getDB()
  const wfId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const firstStepId = `step_${Date.now()}_1`

  db.run(
    `INSERT INTO workflows (id, tenant_id, title, category, description, employee_id, employee_name, current_step_id, status, due_date, created_by_id, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'em_andamento', ?, ?, ?)`,
    [
      wfId,
      tenantId,
      title,
      category,
      description || null,
      employeeId || null,
      employeeName || null,
      firstStepId,
      dueDate || null,
      req.access?.userId,
      req.access?.name,
    ]
  )

  steps.forEach((step: any, index: number) => {
    const sId = index === 0 ? firstStepId : `step_${Date.now()}_${index + 1}`
    db.run(
      `INSERT INTO workflow_steps (id, workflow_id, tenant_id, order_index, title, description, assignee_role, assignee_name, status, due_date, required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sId,
        wfId,
        tenantId,
        index + 1,
        step.title,
        step.description || null,
        step.assigneeRole || "RH",
        step.assigneeName || null,
        index === 0 ? "em_execucao" : "pendente",
        step.dueDate || null,
        step.required === false ? 0 : 1,
      ]
    )
  })

  // Registrar histórico inicial
  db.run(
    `INSERT INTO workflow_history (id, workflow_id, tenant_id, step_id, step_title, action, actor_id, actor_name, actor_role, comments)
     VALUES (?, ?, ?, ?, ?, 'CRIACAO', ?, ?, ?, ?)`,
    [
      `wfh_${Date.now()}`,
      wfId,
      tenantId,
      firstStepId,
      steps[0]?.title || "Início",
      req.access?.userId,
      req.access?.name,
      userRole,
      "Processo de workflow iniciado pelo usuário.",
    ]
  )

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: "WORKFLOW_CREATE",
    entity: "workflows",
    entityId: wfId,
    details: { title, category, employeeName, stepsCount: steps.length },
    tenantId,
  })

  res.status(201).json({ ok: true, id: wfId, message: "Workflow criado com sucesso." })
})

// PATCH /api/workflows/:id/steps/:stepId/execute — Transição de etapa
router.patch("/:id/steps/:stepId/execute", (req: Request, res: Response) => {
  const id = String(req.params.id)
  const stepId = String(req.params.stepId)
  const tenantId = req.tenantId || "tenant_default"
  const { action, comments } = req.body // action: 'concluir' | 'iniciar' | 'rejeitar'

  const userRole = req.access?.role || "COLABORADOR"
  if (!roleHasPermission(userRole, "workflows.execute")) {
    res.status(403).json({ ok: false, error: "Acesso negado: Perfil sem permissão para executar etapas de workflow." })
    return
  }

  const db = getDB()
  const wfRes = db.exec(`SELECT * FROM workflows WHERE id = ? AND tenant_id = ?`, [id, tenantId])
  if (!wfRes.length || !wfRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Workflow não encontrado." })
    return
  }

  const wfEmployeeId = wfRes[0].values[0][wfRes[0].columns.indexOf("employee_id")] as string | null
  const stepRes = db.exec(`SELECT * FROM workflow_steps WHERE id = ? AND workflow_id = ? AND tenant_id = ?`, [
    stepId,
    id,
    tenantId,
  ])

  if (!stepRes.length || !stepRes[0].values.length) {
    res.status(404).json({ ok: false, error: "Etapa de workflow não encontrada." })
    return
  }

  const stepCols = stepRes[0].columns
  const stepData: any = {}
  stepCols.forEach((col, idx) => {
    stepData[col] = stepRes[0].values[0][idx]
  })

  // Regra Anti-autoaprovação se o usuário for o funcionário avaliado no workflow
  if (action === "concluir" && wfEmployeeId && req.access?.userId === wfEmployeeId && userRole !== "ADMIN") {
    res.status(403).json({
      ok: false,
      error: "Violação de Governança: Você não tem permissão para aprovar ou concluir uma etapa do seu próprio processo.",
    })
    return
  }

  const now = new Date().toISOString()
  let newStepStatus = "em_execucao"
  let actionLog = "INICIADA"

  if (action === "concluir") {
    newStepStatus = "concluido"
    actionLog = "CONCLUIDA"
  } else if (action === "rejeitar") {
    newStepStatus = "rejeitado"
    actionLog = "REJEITADA"
  } else if (action === "iniciar") {
    newStepStatus = "em_execucao"
    actionLog = "EM_EXECUCAO"
  }

  db.run(
    `UPDATE workflow_steps
     SET status = ?, completed_at = ?, completed_by_id = ?, completed_by_name = ?, comments = ?
     WHERE id = ? AND workflow_id = ? AND tenant_id = ?`,
    [
      newStepStatus,
      action === "concluir" ? now : null,
      action === "concluir" ? req.access?.userId : null,
      action === "concluir" ? req.access?.name : null,
      comments || stepData.comments,
      stepId,
      id,
      tenantId,
    ]
  )

  // Gravar histórico da movimentação
  db.run(
    `INSERT INTO workflow_history (id, workflow_id, tenant_id, step_id, step_title, action, actor_id, actor_name, actor_role, comments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `wfh_${Date.now()}`,
      id,
      tenantId,
      stepId,
      stepData.title,
      actionLog,
      req.access?.userId,
      req.access?.name,
      userRole,
      comments || null,
    ]
  )

  // Avançar para a próxima etapa ou concluir o workflow
  if (action === "concluir") {
    const nextSteps = db.exec(
      `SELECT id, title, assignee_role FROM workflow_steps
       WHERE workflow_id = ? AND tenant_id = ? AND order_index > ? AND status != 'concluido'
       ORDER BY order_index ASC LIMIT 1`,
      [id, tenantId, stepData.order_index]
    )

    if (nextSteps.length && nextSteps[0].values.length) {
      const nextStepId = nextSteps[0].values[0][0] as string
      const nextTitle = nextSteps[0].values[0][1] as string
      db.run(
        `UPDATE workflow_steps SET status = 'em_execucao' WHERE id = ? AND workflow_id = ? AND tenant_id = ?`,
        [nextStepId, id, tenantId]
      )
      db.run(
        `UPDATE workflows SET current_step_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
        [nextStepId, now, id, tenantId]
      )

      // Criar notificação para os responsáveis da próxima etapa
      db.run(
        `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
         VALUES (?, ?, ?, ?, 'workflow', 'alta', ?)`,
        [
          `notif_${Date.now()}`,
          tenantId,
          "Nova Etapa de Workflow Aguardando Ação",
          `Etapa '${nextTitle}' liberada para execução no processo #${id}.`,
          `/workflows`,
        ]
      )
    } else {
      // Todas as etapas concluídas!
      db.run(
        `UPDATE workflows SET status = 'concluido', updated_at = ? WHERE id = ? AND tenant_id = ?`,
        [now, id, tenantId]
      )

      db.run(
        `INSERT INTO notifications (id, tenant_id, title, description, category, priority, link)
         VALUES (?, ?, ?, ?, 'workflow', 'media', ?)`,
        [
          `notif_${Date.now()}`,
          tenantId,
          "Processo de Workflow Concluído",
          `O fluxo de processos #${id} foi finalizado com sucesso por todas as instâncias.`,
          `/workflows`,
        ]
      )
    }
  } else if (action === "rejeitar") {
    db.run(
      `UPDATE workflows SET status = 'cancelado', updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [now, id, tenantId]
    )
  }

  persist()

  recordAuditLog({
    userId: req.access?.userId,
    userName: req.access?.name,
    userRole,
    action: `WORKFLOW_STEP_${actionLog}`,
    entity: "workflow_steps",
    entityId: stepId,
    details: { workflowId: id, stepTitle: stepData.title, comments },
    tenantId,
  })

  res.json({ ok: true, message: `Etapa ${actionLog.toLowerCase()} com sucesso.` })
})

export default router
