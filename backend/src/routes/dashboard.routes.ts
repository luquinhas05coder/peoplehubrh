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

    // 1. Total de Funcionários
    const totalEmpRes = db.exec(
      `SELECT count(*) FROM employees WHERE tenant_id = ?`,
      [tenantId]
    )
    const totalFuncionarios = totalEmpRes.length && totalEmpRes[0].values.length ? Number(totalEmpRes[0].values[0][0]) : 0

    // 2. Funcionários Ativos
    const ativosRes = db.exec(
      `SELECT count(*) FROM employees WHERE tenant_id = ? AND lower(status) = 'ativo'`,
      [tenantId]
    )
    const funcionariosAtivos = ativosRes.length && ativosRes[0].values.length ? Number(ativosRes[0].values[0][0]) : 0

    // 3. Funcionários Inativos (desligados, afastados, etc.)
    const inativosRes = db.exec(
      `SELECT count(*) FROM employees WHERE tenant_id = ? AND lower(status) != 'ativo'`,
      [tenantId]
    )
    const funcionariosInativos = inativosRes.length && inativosRes[0].values.length ? Number(inativosRes[0].values[0][0]) : 0

    // 4. Mês atual para contratações e desligamentos
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0")
    const currentYearMonth = `${currentYear}-${currentMonthNum}` // "YYYY-MM"

    // Contratações no mês atual
    const hireRes = db.exec(
      `SELECT count(*) FROM employees WHERE tenant_id = ? AND (hireDate LIKE ? OR hireDate LIKE ?)`,
      [tenantId, `${currentYearMonth}%`, `%/${currentMonthNum}/${currentYear}%`]
    )
    const contratacoesMes = hireRes.length && hireRes[0].values.length ? Number(hireRes[0].values[0][0]) : 0

    // Desligamentos no mês atual
    const termRes = db.exec(
      `SELECT count(*) FROM employees WHERE tenant_id = ? AND (
        (terminationDate IS NOT NULL AND (terminationDate LIKE ? OR terminationDate LIKE ?))
        OR (lower(status) IN ('inativo', 'desligado') AND (hireDate LIKE ? OR hireDate LIKE ?))
      )`,
      [tenantId, `${currentYearMonth}%`, `%/${currentMonthNum}/${currentYear}%`, `${currentYearMonth}%`, `%/${currentMonthNum}/${currentYear}%`]
    )
    const desligamentosMes = termRes.length && termRes[0].values.length ? Number(termRes[0].values[0][0]) : 0

    // 5. Solicitações Pendentes (status em 'pendente' ou 'em análise')
    const pendingReqRes = db.exec(
      `SELECT count(*) FROM requests WHERE tenant_id = ? AND lower(status) IN ('pendente', 'em análise', 'em_analise')`,
      [tenantId]
    )
    const solicitacoesPendentes = pendingReqRes.length && pendingReqRes[0].values.length ? Number(pendingReqRes[0].values[0][0]) : 0

    // 6. Férias Pendentes
    const pendingFeriasRes = db.exec(
      `SELECT count(*) FROM requests WHERE tenant_id = ? 
       AND (lower(type) LIKE '%ferias%' OR lower(type) LIKE '%férias%')
       AND lower(status) IN ('pendente', 'em análise', 'em_analise')`,
      [tenantId]
    )
    const feriasPendentes = pendingFeriasRes.length && pendingFeriasRes[0].values.length ? Number(pendingFeriasRes[0].values[0][0]) : 0

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

    // 10. Contratações por Mês (Últimos 6 meses)
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

      // Contratações no mês i
      const cRes = db.exec(
        `SELECT count(*) FROM employees WHERE tenant_id = ? AND (hireDate LIKE ? OR hireDate LIKE ?)`,
        [tenantId, `${prefixIso}%`, `%${suffixBr}%`]
      )
      const cTotal = cRes.length && cRes[0].values.length ? Number(cRes[0].values[0][0]) : 0
      contratacoesPorMes.push({ mes: label, total: cTotal })

      // Desligamentos no mês i
      const dRes = db.exec(
        `SELECT count(*) FROM employees WHERE tenant_id = ? AND (
          (terminationDate IS NOT NULL AND (terminationDate LIKE ? OR terminationDate LIKE ?))
          OR (lower(status) IN ('inativo', 'desligado') AND (hireDate LIKE ? OR hireDate LIKE ?))
        )`,
        [tenantId, `${prefixIso}%`, `%${suffixBr}%`, `${prefixIso}%`, `%${suffixBr}%`]
      )
      const dTotal = dRes.length && dRes[0].values.length ? Number(dRes[0].values[0][0]) : 0
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
