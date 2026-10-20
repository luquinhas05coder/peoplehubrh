/**
 * constants/rbac.ts — Definições Centrais de Perfis e Permissões (RBAC) do PeopleHub RH
 */

export type Role = "ADMIN" | "RH" | "GESTOR" | "COLABORADOR"

export type Permission =
  // Dashboard
  | "dashboard.view"
  // Usuários (Gestão de Acessos)
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "users.manage_roles"
  // Funcionários
  | "employees.view_all"
  | "employees.view_team"
  | "employees.view_own"
  | "employees.create"
  | "employees.update"
  | "employees.delete"
  | "employees.view_sensitive"
  // Escalas & Horários
  | "schedules.view"
  | "schedules.manage"
  // Folha de Pagamento & Contra-Cheques
  | "payroll.view"
  | "payroll.manage"
  // Documentos
  | "documents.view"
  | "documents.create"
  | "documents.upload"
  | "documents.delete"
  // Relatórios
  | "reports.view"
  | "reports.export"
  // Férias
  | "vacations.view"
  | "vacations.request"
  | "vacations.approve"
  | "vacations.reject"
  // Solicitações
  | "requests.view"
  | "requests.create"
  | "requests.approve"
  | "requests.reject"
  // Workflows Visuais de RH
  | "workflows.view"
  | "workflows.create"
  | "workflows.execute"
  | "workflows.manage"
  // Notificações & Calendário
  | "notifications.view"
  | "notifications.manage"
  | "calendar.view"
  | "calendar.manage"
  // Avaliação de Desempenho & Metas
  | "performance.view"
  | "performance.create_cycle"
  | "performance.evaluate"
  | "performance.manage_goals"
  // Relatórios Customizados
  | "reports.custom_build"
  | "reports.saved_manage"
  // Recrutamento e Seleção (ATS)
  | "recruitment.view"
  | "recruitment.manage"
  | "recruitment.evaluate"
  | "recruitment.delete"
  // Auditoria
  | "audit.view"
  // Configurações
  | "settings.view"
  | "settings.update"

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.update",
    "users.delete",
    "users.manage_roles",
    "employees.view_all",
    "employees.view_team",
    "employees.view_own",
    "employees.create",
    "employees.update",
    "employees.delete",
    "employees.view_sensitive",
    "schedules.view",
    "schedules.manage",
    "payroll.view",
    "payroll.manage",
    "documents.view",
    "documents.create",
    "documents.upload",
    "documents.delete",
    "reports.view",
    "reports.export",
    "reports.custom_build",
    "reports.saved_manage",
    "vacations.view",
    "vacations.request",
    "vacations.approve",
    "vacations.reject",
    "requests.view",
    "requests.create",
    "requests.approve",
    "requests.reject",
    "workflows.view",
    "workflows.create",
    "workflows.execute",
    "workflows.manage",
    "notifications.view",
    "notifications.manage",
    "calendar.view",
    "calendar.manage",
    "performance.view",
    "performance.create_cycle",
    "performance.evaluate",
    "performance.manage_goals",
    "recruitment.view",
    "recruitment.manage",
    "recruitment.evaluate",
    "recruitment.delete",
    "audit.view",
    "settings.view",
    "settings.update",
  ],
  RH: [
    "dashboard.view",
    "employees.view_all",
    "employees.view_team",
    "employees.view_own",
    "employees.create",
    "employees.update",
    "employees.delete",
    "employees.view_sensitive",
    "schedules.view",
    "schedules.manage",
    "payroll.view",
    "payroll.manage",
    "documents.view",
    "documents.create",
    "documents.upload",
    "documents.delete",
    "reports.view",
    "reports.export",
    "reports.custom_build",
    "reports.saved_manage",
    "vacations.view",
    "vacations.request",
    "vacations.approve",
    "vacations.reject",
    "requests.view",
    "requests.create",
    "requests.approve",
    "requests.reject",
    "workflows.view",
    "workflows.create",
    "workflows.execute",
    "workflows.manage",
    "notifications.view",
    "notifications.manage",
    "calendar.view",
    "calendar.manage",
    "performance.view",
    "performance.create_cycle",
    "performance.evaluate",
    "performance.manage_goals",
    "recruitment.view",
    "recruitment.manage",
    "recruitment.evaluate",
    "recruitment.delete",
    "audit.view",
    "settings.view",
  ],
  GESTOR: [
    "dashboard.view",
    "employees.view_team",
    "employees.view_own",
    "schedules.view",
    "schedules.manage",
    "documents.view",
    "documents.upload",
    "reports.view",
    "reports.custom_build",
    "vacations.view",
    "vacations.approve",
    "vacations.reject",
    "requests.view",
    "requests.create",
    "requests.approve",
    "requests.reject",
    "workflows.view",
    "workflows.execute",
    "notifications.view",
    "calendar.view",
    "performance.view",
    "performance.evaluate",
    "performance.manage_goals",
    "recruitment.view",
    "recruitment.evaluate",
  ],
  COLABORADOR: [
    "employees.view_own",
    "schedules.view",
    "payroll.view",
    "documents.view",
    "documents.upload",
    "vacations.view",
    "vacations.request",
    "requests.view",
    "requests.create",
    "workflows.view",
    "notifications.view",
    "calendar.view",
    "performance.view",
    "performance.evaluate",
  ],
}

/**
 * Normaliza qualquer string ou role legada para uma das 4 roles oficiais.
 */
export function normalizeRole(rawRole?: string | null): Role {
  if (!rawRole) return "COLABORADOR"
  const upper = rawRole.trim().toUpperCase()
  if (upper === "ADMIN" || upper.includes("ADMINISTRADOR")) return "ADMIN"
  if (upper === "RH" || upper.includes("RECURSOS HUMANOS") || upper.includes("DHO") || upper === "DP") return "RH"
  if (upper === "GESTOR" || upper.includes("GERENTE") || upper.includes("COORDENADOR") || upper.includes("LIDER")) return "GESTOR"
  return "COLABORADOR"
}

/**
 * Verifica se uma role possui uma determinada permissão.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}
