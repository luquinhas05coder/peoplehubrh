/**
 * routes/adverse_events.routes.ts — Canal de Denúncias e Eventos Adversos com Tratativa e Anúncio de Medidas
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"

const router = Router()

router.use(resolveTenant)
router.use(authenticateRBAC)

export interface AdverseEventItem {
  id: string
  protocol: string
  tenant_id: string
  reporter_id: string | null
  reporter_name: string | null
  reporter_email: string | null
  is_anonymous: number
  category: string
  severity: "baixa" | "media" | "alta" | "critica"
  title: string
  description: string
  incident_date: string
  incident_location?: string
  involved_parties?: string
  evidence_url?: string
  status: "registrado" | "em_analise" | "em_investigacao" | "medidas_adotadas" | "concluido" | "arquivado"
  tratativa_notes?: string
  tratativa_by?: string
  tratativa_updated_at?: string
  measures_taken?: string
  public_announcement?: string
  announced_to_feed: number
  created_at: string
  updated_at: string
}

// GET /api/adverse-events
// Lista os eventos adversos conforme o papel do usuário (ADMIN e RH veem todos; Colaborador vê os seus e os com medidas anunciadas)
router.get("/", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access

    let query = `SELECT * FROM adverse_events WHERE tenant_id = ?`
    const params: any[] = [tenantId]

    // Se for colaborador, vê seus próprios registros e também aqueles que tiveram medidas anunciadas publicamente
    if (access?.role === "COLABORADOR") {
      query += ` AND (reporter_id = ? OR (announced_to_feed = 1 AND measures_taken IS NOT NULL AND measures_taken != ''))`
      params.push(access.userId)
    }

    query += ` ORDER BY created_at DESC`

    const result = db.exec(query, params)
    const events: AdverseEventItem[] = []

    if (result.length && result[0].values.length) {
      const cols = result[0].columns
      for (const row of result[0].values) {
        const obj: any = {}
        cols.forEach((col, idx) => {
          obj[col] = row[idx]
        })

        // Anonimizar caso o relato seja anônimo e o usuário não seja Admin/RH ou mesmo se for anônimo para manter sigilo estrito
        if (obj.is_anonymous === 1) {
          obj.reporter_name = "Colaborador Anônimo"
          obj.reporter_email = null
          if (access?.role === "COLABORADOR" && obj.reporter_id !== access.userId) {
            obj.reporter_id = null
          }
        }

        events.push(obj)
      }
    }

    // Métricas resumidas para o painel de ouvidoria / eventos adversos
    const statsRes = db.exec(
      `SELECT 
        count(*) as total,
        sum(case when status = 'registrado' then 1 else 0 end) as novos,
        sum(case when status in ('em_analise', 'em_investigacao') then 1 else 0 end) as em_tratativa,
        sum(case when status = 'medidas_adotadas' then 1 else 0 end) as com_medidas,
        sum(case when status = 'concluido' then 1 else 0 end) as concluidos
       FROM adverse_events WHERE tenant_id = ?`,
      [tenantId]
    )

    let stats = { total: 0, novos: 0, em_tratativa: 0, com_medidas: 0, concluidos: 0 }
    if (statsRes.length && statsRes[0].values.length) {
      const v = statsRes[0].values[0]
      stats = {
        total: Number(v[0]) || 0,
        novos: Number(v[1]) || 0,
        em_tratativa: Number(v[2]) || 0,
        com_medidas: Number(v[3]) || 0,
        concluidos: Number(v[4]) || 0,
      }
    }

    res.json({ ok: true, events, stats })
  } catch (error: any) {
    console.error("[API Adverse Events] Erro ao listar eventos:", error)
    res.status(500).json({ ok: false, error: "Falha ao buscar eventos adversos." })
  }
})

// POST /api/adverse-events
// Registra um novo evento adverso / denúncia (qualquer colaborador autenticado ou anônimo)
router.post("/", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access

    const {
      title,
      description,
      category,
      severity = "media",
      incident_date,
      incident_location,
      involved_parties,
      is_anonymous = false,
      evidence_url,
    } = req.body as {
      title?: string
      description?: string
      category?: string
      severity?: "baixa" | "media" | "alta" | "critica"
      incident_date?: string
      incident_location?: string
      involved_parties?: string
      is_anonymous?: boolean
      evidence_url?: string
    }

    if (!title?.trim() || !description?.trim() || !category?.trim() || !incident_date?.trim()) {
      res.status(400).json({
        ok: false,
        error: "Título, categoria, data do ocorrido e descrição detalhada são obrigatórios.",
      })
      return
    }

    const id = `adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const currentYear = new Date().getFullYear()
    const randomProtocol = Math.floor(1000 + Math.random() * 9000)
    const protocol = `ADV-${currentYear}-${randomProtocol}`

    const anon = is_anonymous ? 1 : 0
    const reporterId = anon ? null : (access?.userId || null)
    const reporterName = anon ? "Colaborador Anônimo" : (access?.name || "Colaborador")
    const reporterEmail = anon ? null : (access?.email || null)

    db.run(
      `INSERT INTO adverse_events (
        id, protocol, tenant_id, reporter_id, reporter_name, reporter_email, is_anonymous, category, severity, title, description, incident_date, incident_location, involved_parties, evidence_url, status, tratativa_notes, tratativa_by, measures_taken, public_announcement, announced_to_feed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registrado', '', '', '', '', 0, datetime('now'), datetime('now'))`,
      [
        id,
        protocol,
        tenantId,
        reporterId,
        reporterName,
        reporterEmail,
        anon,
        category.trim(),
        severity,
        title.trim(),
        description.trim(),
        incident_date,
        incident_location?.trim() || null,
        involved_parties?.trim() || null,
        evidence_url?.trim() || null,
      ]
    )

    persist()

    recordAuditLog({
      userId: access?.userId,
      userName: anon ? "Anônimo" : access?.name,
      userRole: access?.role,
      action: "ADVERSE_EVENT_CREATED",
      entity: "adverse_events",
      entityId: id,
      details: { protocol, category, severity, is_anonymous: Boolean(anon) },
      tenantId,
      ipAddress: req.ip,
    })

    res.status(201).json({
      ok: true,
      protocol,
      message: `Relato registrado com sucesso sob o protocolo ${protocol}. A equipe de RH dará início às tratativas em sigilo.`,
      event: {
        id,
        protocol,
        title,
        category,
        severity,
        status: "registrado",
        incident_date,
        created_at: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("[API Adverse Events] Erro ao criar evento:", error)
    res.status(500).json({ ok: false, error: "Falha ao registrar evento adverso." })
  }
})

// PATCH /api/adverse-events/:id/tratativa
// Atualiza o andamento, notas de tratativa, medidas tomadas e status (Apenas RH, GESTOR e ADMIN)
router.patch("/:id/tratativa", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access
    const eventId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id)

    if (!["ADMIN", "RH", "GESTOR"].includes(access?.role || "")) {
      res.status(403).json({
        ok: false,
        error: "Acesso negado: apenas o RH, Gestor ou Administrador podem atualizar a tratativa de eventos adversos.",
      })
      return
    }

    const {
      status,
      tratativa_notes,
      measures_taken,
      public_announcement,
    } = req.body as {
      status?: "registrado" | "em_analise" | "em_investigacao" | "medidas_adotadas" | "concluido" | "arquivado"
      tratativa_notes?: string
      measures_taken?: string
      public_announcement?: string
    }

    const check = db.exec(`SELECT id, protocol FROM adverse_events WHERE id = ? AND tenant_id = ?`, [eventId, tenantId])
    if (!check.length || !check[0].values.length) {
      res.status(404).json({ ok: false, error: "Evento adverso não encontrado." })
      return
    }

    const protocol = check[0].values[0][1] as string
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19)

    db.run(
      `UPDATE adverse_events SET
        status = coalesce(?, status),
        tratativa_notes = coalesce(?, tratativa_notes),
        tratativa_by = ?,
        tratativa_updated_at = ?,
        measures_taken = coalesce(?, measures_taken),
        public_announcement = coalesce(?, public_announcement),
        updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [
        status || null,
        tratativa_notes !== undefined ? tratativa_notes : null,
        `${access?.name || "RH"} (${access?.role})`,
        nowStr,
        measures_taken !== undefined ? measures_taken : null,
        public_announcement !== undefined ? public_announcement : null,
        eventId,
        tenantId,
      ]
    )

    persist()

    recordAuditLog({
      userId: access?.userId,
      userName: access?.name,
      userRole: access?.role,
      action: "ADVERSE_EVENT_TRATATIVA_UPDATED",
      entity: "adverse_events",
      entityId: eventId,
      details: { protocol, status, measures_taken: Boolean(measures_taken) },
      tenantId,
      ipAddress: req.ip,
    })

    res.json({
      ok: true,
      message: `Tratativa do evento ${protocol} atualizada com sucesso.`,
    })
  } catch (error: any) {
    console.error("[API Adverse Events] Erro na tratativa:", error)
    res.status(500).json({ ok: false, error: "Falha ao atualizar tratativa do evento adverso." })
  }
})

// POST /api/adverse-events/:id/announce-feed
// Publica automaticamente as medidas e atualizações tomadas para este evento no Feed Corporativo (Apenas RH e ADMIN)
router.post("/:id/announce-feed", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access
    const eventId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id)

    if (!["ADMIN", "RH"].includes(access?.role || "")) {
      res.status(403).json({
        ok: false,
        error: "Apenas RH e Administrador podem publicar medidas no Feed Corporativo.",
      })
      return
    }

    const check = db.exec(`SELECT id, protocol, title, category, measures_taken, public_announcement FROM adverse_events WHERE id = ? AND tenant_id = ?`, [eventId, tenantId])
    if (!check.length || !check[0].values.length) {
      res.status(404).json({ ok: false, error: "Evento adverso não encontrado." })
      return
    }

    const [id, protocol, title, category, measuresTaken, publicAnnounce] = check[0].values[0] as [string, string, string, string, string | null, string | null]

    const announcementTitle = publicAnnounce?.trim() || `🛡️ Medida Corporativa: Resolução de Evento Adverso (${protocol})`
    const announcementContent = (measuresTaken?.trim() || publicAnnounce?.trim()) || `Informamos que as medidas cabíveis relativas ao reporte ${protocol} (${title}) foram devidamente adotadas pela equipe de Recursos Humanos e Segurança do Trabalho.`

    const feedId = `feed_adv_${Date.now()}`

    db.run(
      `INSERT INTO feed_posts (
        id, tenant_id, author_id, author_name, author_role, title, content, category, priority, is_pinned, adverse_event_id, tags, likes_count, likes_users_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'medida', 'destaque', 1, ?, ?, 0, '[]', datetime('now'), datetime('now'))`,
      [
        feedId,
        tenantId,
        access?.userId || "usr_rh",
        access?.name || "Mariana Alcantara",
        access?.role || "RH",
        announcementTitle,
        announcementContent,
        eventId,
        `Segurança, Resolução, Medida Corporativa, ${category}`,
      ]
    )

    db.run(
      `UPDATE adverse_events SET announced_to_feed = 1, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
      [eventId, tenantId]
    )

    persist()

    recordAuditLog({
      userId: access?.userId,
      userName: access?.name,
      userRole: access?.role,
      action: "ADVERSE_EVENT_ANNOUNCED_TO_FEED",
      entity: "adverse_events",
      entityId: eventId,
      details: { protocol, feedId },
      tenantId,
      ipAddress: req.ip,
    })

    res.json({
      ok: true,
      message: `As medidas adotadas para o protocolo ${protocol} foram anunciadas com destaque no Feed da empresa!`,
      feedId,
    })
  } catch (error: any) {
    console.error("[API Adverse Events] Erro ao anunciar no feed:", error)
    res.status(500).json({ ok: false, error: "Falha ao publicar medidas no feed corporativo." })
  }
})

export default router
