/**
 * routes/org_chart.routes.ts — Organograma Corporativo Interativo & Árvore Hierárquica
 */
import { Router, type Request, type Response } from "express"
import { getDB } from "../db/index.js"
import { authenticateRBAC } from "../middleware/rbac.js"

const router = Router()
router.use(authenticateRBAC)

interface OrgNode {
  id: string
  name: string
  role: string
  department: string
  email: string
  phone: string
  location: string
  manager: string
  status: string
  avatarInitials: string
  directReportsCount: number
  totalTeamCount: number
  children: OrgNode[]
}

// GET /api/org-chart — Estrutura em árvore do organograma corporativo
router.get("/", (req: Request, res: Response) => {
  const tenantId = req.tenantId || "tenant_default"
  const db = getDB()

  const result = db.exec(
    `SELECT id, name, role, department, email, phone, location, manager, status FROM employees WHERE tenant_id = ? AND status != 'Desligado'`,
    [tenantId]
  )

  if (!result.length || !result[0].values.length) {
    res.json({ ok: true, rootNodes: [], totalEmployees: 0, departments: [] })
    return
  }

  const cols = result[0].columns
  const employees: any[] = []
  const departmentsSet = new Set<string>()

  for (const row of result[0].values) {
    const item: any = {}
    cols.forEach((c, idx) => { item[c] = row[idx] })
    if (item.department) departmentsSet.add(item.department)
    employees.push(item)
  }

  // Mapa de colaboradores por ID e por Nome
  const nodesMap: Record<string, OrgNode> = {}

  employees.forEach((emp) => {
    const parts = (emp.name || "").trim().split(" ")
    const initials = parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (emp.name || "PH").substring(0, 2).toUpperCase()

    nodesMap[emp.id] = {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      location: emp.location,
      manager: emp.manager || "",
      status: emp.status,
      avatarInitials: initials,
      directReportsCount: 0,
      totalTeamCount: 0,
      children: [],
    }
  })

  // Conectar subordinados aos seus gestores
  const rootNodes: OrgNode[] = []

  Object.values(nodesMap).forEach((node) => {
    // Tentar localizar gestor por ID ou por Nome aproximado
    let managerNode: OrgNode | undefined

    if (node.manager) {
      managerNode = nodesMap[node.manager]
      if (!managerNode) {
        // Buscar por nome correspondente
        managerNode = Object.values(nodesMap).find(
          (m) => m.name.toLowerCase() === node.manager.toLowerCase() ||
                 node.manager.toLowerCase().includes(m.name.toLowerCase()) ||
                 m.name.toLowerCase().includes(node.manager.toLowerCase())
        )
      }
    }

    if (managerNode && managerNode.id !== node.id) {
      managerNode.children.push(node)
      managerNode.directReportsCount += 1
    } else {
      rootNodes.push(node)
    }
  })

  // Calcular contagem recursiva de equipe total (diretos + indiretos)
  function computeTotalTeam(n: OrgNode): number {
    let sum = n.children.length
    for (const child of n.children) {
      sum += computeTotalTeam(child)
    }
    n.totalTeamCount = sum
    return sum
  }

  rootNodes.forEach((root) => computeTotalTeam(root))

  res.json({
    ok: true,
    totalEmployees: employees.length,
    departments: Array.from(departmentsSet).sort(),
    rootNodes,
  })
})

export default router
