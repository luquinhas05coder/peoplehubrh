/**
 * routes/dashboard.routes.ts — Endpoints de Métricas do Dashboard Principal PeopleHub RH
 */
import { Router, type Request, type Response } from "express"
import { getDB } from "../db/index.js"
import { resolveTenant } from "../middleware/auth.js"
import { authenticateRBAC } from "../middleware/rbac.js"

const router = Router()

// Aplicar identificação do tenant e autenticação RBAC em todas as rotas de métricas
router.use(resolveTenant)
router.use(authenticateRBAC)

export interface DashboardResponse {
  ok: boolean
  totalFuncionarios: number
  funcionariosAtivos: number
  funcionariosInativos: number
  contratacoesMes: number
  desligamentosMes: number
  solicitacoesPendentes: number
  feriasPendentes: number
  documentosVencendo: number
  funcionariosPorDepartamento: Array<{ departamento: string; total: number }>
  contratacoesPorMes: Array<{ mes: string; total: number }>
  desligamentosPorMes: Array<{ mes: string; total: number }>
  funcionariosPorStatus: Array<{ status: string; total: number }>
  evolucaoQuadro?: Array<{ mes: string; total: number }>
  distribuicaoPorCargo?: Array<{ cargo: string; total: number }>
  timestamp: string
}

// GET /api/dashboard
router.get("/", (req: Request, res: Response) => {
  try {
    const db = getDB()
    const tenantId = req.tenantId || "tenant_default"

    // 1, 2, 3: Contagem consolidada de funcionários em uma única consulta agregada
    const empCountRes = db.exec(
      `SELECT 
        count(*) as total,
        sum(case when lower(status) = 'ativo' then 1 else 0 end) as ativos,
        sum(case when lower(status) != 'ativo' then 1 else 0 end) as inativos
       FROM employees WHERE tenant_id = ?`,
      [tenantId]
    )
    let totalFuncionarios = 0
    let funcionariosAtivos = 0
    let funcionariosInativos = 0
    if (empCountRes.length && empCountRes[0].values.length) {
      const v = empCountRes[0].values[0]
      totalFuncionarios = Number(v[0]) || 0
      funcionariosAtivos = Number(v[1]) || 0
      funcionariosInativos = Number(v[2]) || 0
    }

    // 4. Mês atual para contratações e desligamentos
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0")
    const currentYearMonth = `${currentYear}-${currentMonthNum}` // "YYYY-MM"

    // Busca os registros de datas de admissão e rescisão do tenant em uma única consulta
    const datesRes = db.exec(
      `SELECT hireDate, terminationDate, status FROM employees WHERE tenant_id = ?`,
      [tenantId]
    )
    const empDates: Array<{ hireDate: string; terminationDate: string | null; status: string }> = []
    if (datesRes.length && datesRes[0].values.length) {
      datesRes[0].values.forEach((row) => {
        empDates.push({
          hireDate: String(row[0] || ""),
          terminationDate: row[1] ? String(row[1]) : null,
          status: String(row[2] || "").toLowerCase(),
        })
      })
    }

    const contratacoesMes = empDates.filter(
      (e) => e.hireDate.startsWith(currentYearMonth) || e.hireDate.includes(`/${currentMonthNum}/${currentYear}`)
    ).length

    const desligamentosMes = empDates.filter(
      (e) =>
        (e.terminationDate && (e.terminationDate.startsWith(currentYearMonth) || e.terminationDate.includes(`/${currentMonthNum}/${currentYear}`))) ||
        (["inativo", "desligado"].includes(e.status) && (e.hireDate.startsWith(currentYearMonth) || e.hireDate.includes(`/${currentMonthNum}/${currentYear}`)))
    ).length

    // 5 & 6: Solicitações e férias pendentes em uma única consulta agregada
    const reqRes = db.exec(
      `SELECT 
        sum(case when lower(status) IN ('pendente', 'em análise', 'em_analise') then 1 else 0 end) as solicitacoes,
        sum(case when (lower(type) LIKE '%ferias%' OR lower(type) LIKE '%férias%') AND lower(status) IN ('pendente', 'em análise', 'em_analise') then 1 else 0 end) as ferias
       FROM requests WHERE tenant_id = ?`,
      [tenantId]
    )
    let solicitacoesPendentes = 0
    let feriasPendentes = 0
    if (reqRes.length && reqRes[0].values.length) {
      const v = reqRes[0].values[0]
      solicitacoesPendentes = Number(v[0]) || 0
      feriasPendentes = Number(v[1]) || 0
    }

    // 7. Documentos Próximos do Vencimento (próximos 30 dias ou status = 'Próximo do vencimento')
    const nowIso = now.toISOString().split("T")[0]
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0]
    const docsVencendoRes = db.exec(
      `SELECT count(*) FROM documents WHERE tenant_id = ? AND (
        lower(status) LIKE '%próximo%' 
        OR lower(status) LIKE '%vencendo%'
        OR (expiryDate IS NOT NULL AND expiryDate != '' AND expiryDate BETWEEN ? AND ?)
      )`,
      [tenantId, nowIso, in30Days]
    )
    const documentosVencendo = docsVencendoRes.length && docsVencendoRes[0].values.length ? Number(docsVencendoRes[0].values[0][0]) : 0

    // 8. Funcionários por Departamento
    const deptRes = db.exec(
      `SELECT department, count(*) as total FROM employees WHERE tenant_id = ? GROUP BY department ORDER BY total DESC`,
      [tenantId]
    )
    const funcionariosPorDepartamento: Array<{ departamento: string; total: number }> = []
    if (deptRes.length && deptRes[0].values.length) {
      deptRes[0].values.forEach((row) => {
        funcionariosPorDepartamento.push({
          departamento: String(row[0] || "Outros"),
          total: Number(row[1] || 0),
        })
      })
    }

    // 9. Funcionários por Status
    const statusRes = db.exec(
      `SELECT status, count(*) as total FROM employees WHERE tenant_id = ? GROUP BY status ORDER BY total DESC`,
      [tenantId]
    )
    const funcionariosPorStatus: Array<{ status: string; total: number }> = []
    if (statusRes.length && statusRes[0].values.length) {
      statusRes[0].values.forEach((row) => {
        const rawStatus = String(row[0] || "Ativo")
        const label = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
        funcionariosPorStatus.push({
          status: label,
          total: Number(row[1] || 0),
        })
      })
    }

    // 10. Contratações por Mês (Últimos 6 meses) calculadas em memória a partir de empDates
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    const contratacoesPorMes: Array<{ mes: string; total: number }> = []
    const desligamentosPorMes: Array<{ mes: string; total: number }> = []
    const evolucaoQuadro: Array<{ mes: string; total: number }> = []

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const yr = targetDate.getFullYear()
      const moNum = String(targetDate.getMonth() + 1).padStart(2, "0")
      const label = `${mesesNomes[targetDate.getMonth()]}/${String(yr).slice(-2)}`
      const prefixIso = `${yr}-${moNum}`
      const suffixBr = `/${moNum}/${yr}`

      const cTotal = empDates.filter(
        (e) => e.hireDate.startsWith(prefixIso) || e.hireDate.includes(suffixBr)
      ).length
      contratacoesPorMes.push({ mes: label, total: cTotal })

      const dTotal = empDates.filter(
        (e) =>
          (e.terminationDate && (e.terminationDate.startsWith(prefixIso) || e.terminationDate.includes(suffixBr))) ||
          (["inativo", "desligado"].includes(e.status) && (e.hireDate.startsWith(prefixIso) || e.hireDate.includes(suffixBr)))
      ).length
      desligamentosPorMes.push({ mes: label, total: dTotal })
    }

    // Evolução cumulativa aproximada do quadro
    let acumulado = Math.max(totalFuncionarios - contratacoesPorMes.reduce((acc, curr) => acc + curr.total, 0) + desligamentosPorMes.reduce((acc, curr) => acc + curr.total, 0), 0)
    for (let i = 0; i < contratacoesPorMes.length; i++) {
      acumulado += contratacoesPorMes[i].total - desligamentosPorMes[i].total
      evolucaoQuadro.push({
        mes: contratacoesPorMes[i].mes,
        total: Math.max(acumulado, totalFuncionarios > 0 ? 1 : 0),
      })
    }

    // 11. Distribuição por Cargo
    const roleRes = db.exec(
      `SELECT role, count(*) as total FROM employees WHERE tenant_id = ? GROUP BY role ORDER BY total DESC LIMIT 6`,
      [tenantId]
    )
    const distribuicaoPorCargo: Array<{ cargo: string; total: number }> = []
    if (roleRes.length && roleRes[0].values.length) {
      roleRes[0].values.forEach((row) => {
        distribuicaoPorCargo.push({
          cargo: String(row[0] || "Outros"),
          total: Number(row[1] || 0),
        })
      })
    }

    const payload: DashboardResponse = {
      ok: true,
      totalFuncionarios,
      funcionariosAtivos,
      funcionariosInativos,
      contratacoesMes,
      desligamentosMes,
      solicitacoesPendentes,
      feriasPendentes,
      documentosVencendo,
      funcionariosPorDepartamento,
      contratacoesPorMes,
      desligamentosPorMes,
      funcionariosPorStatus,
      evolucaoQuadro,
      distribuicaoPorCargo,
      timestamp: new Date().toISOString(),
    }

    res.json(payload)
  } catch (error: any) {
    console.error("[API Dashboard] Erro ao consolidar métricas:", error)
    res.status(500).json({
      ok: false,
      error: "Falha ao processar métricas reais do dashboard: " + (error?.message || "Erro interno"),
    })
  }
})

export default router
