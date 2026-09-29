/**
 * routes/feed.routes.ts — Feed Corporativo de Novidades, Medidas e Eventos Gerais
 */
import { Router, type Request, type Response } from "express"
import { getDB, persist } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC, recordAuditLog } from "../middleware/rbac.js"

const router = Router()

router.use(resolveTenant)
router.use(authenticateRBAC)

export interface FeedPostItem {
  id: string
  tenant_id: string
  author_id: string
  author_name: string
  author_role: string
  title: string
  content: string
  category: "novidade" | "medida" | "evento" | "comunicado"
  priority: "normal" | "urgente" | "destaque"
  is_pinned: number
  adverse_event_id?: string | null
  event_date?: string | null
  event_location?: string | null
  tags?: string
  likes_count: number
  likes_users_json: string
  liked_by_me?: boolean
  created_at: string
  updated_at: string
}

// GET /api/feed
// Lista todos os posts do feed com suporte a filtro por categoria e busca
router.get("/", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const currentUserId = req.access?.userId
    const { category, search } = req.query as { category?: string; search?: string }

    let query = `SELECT * FROM feed_posts WHERE tenant_id = ?`
    const params: any[] = [tenantId]

    if (category && category !== "todos") {
      query += ` AND category = ?`
      params.push(category)
    }

    if (search && search.trim()) {
      query += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)`
      const s = `%${search.trim()}%`
      params.push(s, s, s)
    }

    query += ` ORDER BY is_pinned DESC, created_at DESC`

    const result = db.exec(query, params)
    const posts: FeedPostItem[] = []

    if (result.length && result[0].values.length) {
      const cols = result[0].columns
      for (const row of result[0].values) {
        const obj: any = {}
        cols.forEach((col, idx) => {
          obj[col] = row[idx]
        })

        // Checar se o usuário atual curtiu
        try {
          const userLikes = JSON.parse(obj.likes_users_json || "[]")
          obj.liked_by_me = currentUserId ? userLikes.includes(currentUserId) : false
        } catch (_e) {
          obj.liked_by_me = false
        }

        posts.push(obj)
      }
    }

    // Contadores por categoria
    const countsRes = db.exec(
      `SELECT 
        count(*) as total,
        sum(case when category = 'novidade' then 1 else 0 end) as novidades,
        sum(case when category = 'medida' then 1 else 0 end) as medidas,
        sum(case when category = 'evento' then 1 else 0 end) as eventos,
        sum(case when category = 'comunicado' then 1 else 0 end) as comunicados
       FROM feed_posts WHERE tenant_id = ?`,
      [tenantId]
    )

    let counts = { total: 0, novidade: 0, medida: 0, evento: 0, comunicado: 0 }
    if (countsRes.length && countsRes[0].values.length) {
      const v = countsRes[0].values[0]
      counts = {
        total: Number(v[0]) || 0,
        novidade: Number(v[1]) || 0,
        medida: Number(v[2]) || 0,
        evento: Number(v[3]) || 0,
        comunicado: Number(v[4]) || 0,
      }
    }

    res.json({ ok: true, posts, counts })
  } catch (error: any) {
    console.error("[API Feed] Erro ao listar posts:", error)
    res.status(500).json({ ok: false, error: "Falha ao buscar publicações do feed: " + error?.message })
  }
})

// POST /api/feed
// Cria uma nova publicação no Feed (Apenas RH, GESTOR e ADMIN)
router.post("/", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access

    if (!["ADMIN", "RH", "GESTOR"].includes(access?.role || "")) {
      res.status(403).json({
        ok: false,
        error: "Apenas RH, Gestores ou Administradores podem publicar comunicados e eventos no Feed.",
      })
      return
    }

    const {
      title,
      content,
      category = "novidade",
      priority = "normal",
      is_pinned = false,
      event_date,
      event_location,
      tags,
    } = req.body as {
      title?: string
      content?: string
      category?: "novidade" | "medida" | "evento" | "comunicado"
      priority?: "normal" | "urgente" | "destaque"
      is_pinned?: boolean
      event_date?: string
      event_location?: string
      tags?: string
    }

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ ok: false, error: "Título e conteúdo do comunicado são obrigatórios." })
      return
    }

    const id = `feed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const pinnedVal = is_pinned ? 1 : 0

    db.run(
      `INSERT INTO feed_posts (
        id, tenant_id, author_id, author_name, author_role, title, content, category, priority, is_pinned, event_date, event_location, tags, likes_count, likes_users_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', datetime('now'), datetime('now'))`,
      [
        id,
        tenantId,
        access?.userId || "usr_rh",
        access?.name || "Mariana Alcantara",
        access?.role === "ADMIN" ? "Administrador de Sistemas" : access?.role === "RH" ? "Recursos Humanos & DHO" : "Gestor",
        title.trim(),
        content.trim(),
        category,
        priority,
        pinnedVal,
        event_date?.trim() || null,
        event_location?.trim() || null,
        tags?.trim() || null,
      ]
    )

    persist()

    recordAuditLog({
      userId: access?.userId,
      userName: access?.name,
      userRole: access?.role,
      action: "FEED_POST_CREATED",
      entity: "feed_posts",
      entityId: id,
      details: { title, category, priority, is_pinned: Boolean(pinnedVal) },
      tenantId,
      ipAddress: req.ip,
    })

    res.status(201).json({
      ok: true,
      message: "Publicação anunciada com sucesso no Feed da empresa!",
      post: {
        id,
        title,
        category,
        priority,
        is_pinned: pinnedVal,
        created_at: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("[API Feed] Erro ao criar post:", error)
    res.status(500).json({ ok: false, error: "Falha ao criar publicação no feed: " + error?.message })
  }
})

// POST /api/feed/:id/like
// Alterna curtida do usuário na publicação
router.post("/:id/like", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access
    const postId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id)

    if (!access?.userId) {
      res.status(401).json({ ok: false, error: "Autenticação necessária para curtir." })
      return
    }

    const check = db.exec(`SELECT likes_count, likes_users_json FROM feed_posts WHERE id = ? AND tenant_id = ?`, [postId, tenantId])
    if (!check.length || !check[0].values.length) {
      res.status(404).json({ ok: false, error: "Publicação não encontrada." })
      return
    }

    let likesCount = Number(check[0].values[0][0]) || 0
    let usersList: string[] = []
    try {
      usersList = JSON.parse(check[0].values[0][1] as string || "[]")
    } catch (_e) {
      usersList = []
    }

    const alreadyLiked = usersList.includes(access.userId)
    if (alreadyLiked) {
      usersList = usersList.filter((u) => u !== access.userId)
      likesCount = Math.max(0, likesCount - 1)
    } else {
      usersList.push(access.userId)
      likesCount += 1
    }

    db.run(
      `UPDATE feed_posts SET likes_count = ?, likes_users_json = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
      [likesCount, JSON.stringify(usersList), postId, tenantId]
    )

    persist()

    res.json({
      ok: true,
      liked: !alreadyLiked,
      likesCount,
    })
  } catch (error: any) {
    console.error("[API Feed] Erro ao curtir:", error)
    res.status(500).json({ ok: false, error: "Falha ao registrar curtida: " + error?.message })
  }
})

// DELETE /api/feed/:id
// Exclui uma publicação (Apenas Administrador ou o autor do RH)
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"
    const access = req.access
    const postId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id)

    if (!["ADMIN", "RH"].includes(access?.role || "")) {
      res.status(403).json({ ok: false, error: "Permissão insuficiente para excluir comunicados." })
      return
    }

    db.run(`DELETE FROM feed_posts WHERE id = ? AND tenant_id = ?`, [postId, tenantId])
    persist()

    recordAuditLog({
      userId: access?.userId,
      userName: access?.name,
      userRole: access?.role,
      action: "FEED_POST_DELETED",
      entity: "feed_posts",
      entityId: postId,
      tenantId,
      ipAddress: req.ip,
    })

    res.json({ ok: true, message: "Publicação removida com sucesso." })
  } catch (error: any) {
    console.error("[API Feed] Erro ao remover post:", error)
    res.status(500).json({ ok: false, error: "Erro ao excluir publicação: " + error?.message })
  }
})

export default router
