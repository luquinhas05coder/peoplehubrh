/**
 * constants/rbac.ts — Definições Centrais de Perfis e Permissões (RBAC) do PeopleHub RH
 *
 * Suporta os perfis canônicos:
 * - ADMIN: Controle total da plataforma e governança de acessos
 * - RH: Gestão operacional completa de pessoas, documentos, processos e vagas
 * - GESTOR: Gestão de equipe, aprovações, metas e avaliações dos subordinados
 * - RECRUTADOR: Gestão do ATS, vagas, candidatos, entrevistas e scorecards
 * - AUDITOR: Acesso estritamente de LEITURA e exportação em todos os módulos
 * - COLABORADOR: Autoatendimento pessoal (próprios dados, solicitações, documentos)
 */

import { getDB } from "../db/index.js"

export type Role = "ADMIN" | "RH" | "DP" | "GESTOR" | "COLABORADOR" | "RECRUTADOR" | "AUDITOR"

export type Permission =
  // Dashboard
  | "dashboard.view"
  // Usuários (Gestão de Acessos & RBAC)
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "users.manage_roles"
  | "users.manage_permissions"
  // Funcionários / Colaboradores
  | "employees.view_all"
  | "employees.view_team"
  | "employees.view_own"
  | "employees.create"
  | "employees.update"
  | "employees.delete"
  | "employees.view_sensitive"
  | "employees.export"
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
  | "documents.export"
  // Relatórios
  | "reports.view"
  | "reports.export"
  | "reports.custom_build"
  | "reports.saved_manage"
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
  | "requests.delete"
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
  // Recrutamento e Seleção (ATS)
  | "recruitment.view"
  | "recruitment.manage"
  | "recruitment.evaluate"
  | "recruitment.delete"
  // Ponto Eletrônico & Banco de Horas
  | "timeclock.view"
  | "timeclock.punch"
  | "timeclock.manage"
  // Benefícios
  | "benefits.view"
  | "benefits.enroll"
  | "benefits.manage"
  // Desligamento / Offboarding
  | "offboarding.view"
  | "offboarding.manage"
  // Treinamentos & NRs
  | "trainings.view"
  | "trainings.enroll"
  | "trainings.manage"
  // Pesquisa de Clima & eNPS
  | "climate.view"
  | "climate.respond"
  | "climate.manage"
  // Organograma
  | "orgchart.view"
  // Auditoria
  | "audit.view"
  // Configurações
  | "settings.view"
  | "settings.update"

export const ALL_PERMISSIONS: readonly Permission[] = [
  "dashboard.view",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "users.manage_roles",
  "users.manage_permissions",
  "employees.view_all",
  "employees.view_team",
  "employees.view_own",
  "employees.create",
  "employees.update",
  "employees.delete",
  "employees.view_sensitive",
  "employees.export",
  "schedules.view",
  "schedules.manage",
  "payroll.view",
  "payroll.manage",
  "documents.view",
  "documents.create",
  "documents.upload",
  "documents.delete",
  "documents.export",
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
  "requests.delete",
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
  "timeclock.view",
  "timeclock.punch",
  "timeclock.manage",
  "benefits.view",
  "benefits.enroll",
  "benefits.manage",
  "offboarding.view",
  "offboarding.manage",
  "trainings.view",
  "trainings.enroll",
  "trainings.manage",
  "climate.view",
  "climate.respond",
  "climate.manage",
  "orgchart.view",
  "audit.view",
  "settings.view",
  "settings.update",
]

/**
 * Matriz de módulos e ações para renderização no painel administrativo
 */
export interface ModulePermissionGroup {
  moduleKey: string
  moduleTitle: string
  actions: Array<{
    actionKey: "view" | "create" | "edit" | "delete" | "approve" | "export" | "admin"
    actionLabel: string
    permission: Permission
  }>
}

export const PERMISSION_GROUPS: ModulePermissionGroup[] = [
  {
    moduleKey: "dashboard",
    moduleTitle: "Dashboard Executivo",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Indicadores", permission: "dashboard.view" },
    ],
  },
  {
    moduleKey: "users",
    moduleTitle: "Gestão de Usuários & RBAC",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Usuários", permission: "users.view" },
      { actionKey: "create", actionLabel: "Criar Usuário", permission: "users.create" },
      { actionKey: "edit", actionLabel: "Editar Dados de Usuário", permission: "users.update" },
      { actionKey: "delete", actionLabel: "Desativar / Excluir", permission: "users.delete" },
      { actionKey: "admin", actionLabel: "Alterar Cargos/Perfis", permission: "users.manage_roles" },
      { actionKey: "admin", actionLabel: "Gerenciar Permissões da Matriz", permission: "users.manage_permissions" },
    ],
  },
  {
    moduleKey: "employees",
    moduleTitle: "Colaboradores & Pastas",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Todos", permission: "employees.view_all" },
      { actionKey: "view", actionLabel: "Visualizar Equipe", permission: "employees.view_team" },
      { actionKey: "view", actionLabel: "Visualizar Próprio", permission: "employees.view_own" },
      { actionKey: "view", actionLabel: "Visualizar Dados Sensíveis (Salário/CPF)", permission: "employees.view_sensitive" },
      { actionKey: "create", actionLabel: "Cadastrar Colaborador", permission: "employees.create" },
      { actionKey: "edit", actionLabel: "Editar Colaborador", permission: "employees.update" },
      { actionKey: "delete", actionLabel: "Desligar / Excluir", permission: "employees.delete" },
      { actionKey: "export", actionLabel: "Exportar Base CSV", permission: "employees.export" },
    ],
  },
  {
    moduleKey: "documents",
    moduleTitle: "Gestão de Documentos",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar e Baixar Documentos", permission: "documents.view" },
      { actionKey: "create", actionLabel: "Gerar Novo Documento", permission: "documents.create" },
      { actionKey: "create", actionLabel: "Fazer Upload de Anexos", permission: "documents.upload" },
      { actionKey: "delete", actionLabel: "Excluir Documento", permission: "documents.delete" },
      { actionKey: "export", actionLabel: "Exportar Documentos", permission: "documents.export" },
    ],
  },
  {
    moduleKey: "recruitment",
    moduleTitle: "Recrutamento & Seleção (ATS)",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Vagas e Candidatos", permission: "recruitment.view" },
      { actionKey: "create", actionLabel: "Criar e Publicar Vagas", permission: "recruitment.manage" },
      { actionKey: "edit", actionLabel: "Avaliar & Conduzir Etapas", permission: "recruitment.evaluate" },
      { actionKey: "delete", actionLabel: "Excluir Vagas/Candidatos", permission: "recruitment.delete" },
    ],
  },
  {
    moduleKey: "timeclock",
    moduleTitle: "Ponto Eletrônico & Banco de Horas",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Espelho de Ponto", permission: "timeclock.view" },
      { actionKey: "create", actionLabel: "Registrar Marcação / Bater Ponto", permission: "timeclock.punch" },
      { actionKey: "admin", actionLabel: "Gerenciar Ajustes e Banco de Horas", permission: "timeclock.manage" },
    ],
  },
  {
    moduleKey: "benefits",
    moduleTitle: "Gestão de Benefícios",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Benefícios Disponíveis", permission: "benefits.view" },
      { actionKey: "create", actionLabel: "Aderir / Solicitar Benefício", permission: "benefits.enroll" },
      { actionKey: "admin", actionLabel: "Gerenciar Catálogo de Benefícios", permission: "benefits.manage" },
    ],
  },
  {
    moduleKey: "offboarding",
    moduleTitle: "Desligamento & Rescisões",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Processos de Desligamento", permission: "offboarding.view" },
      { actionKey: "admin", actionLabel: "Iniciar & Conduzir Desligamentos", permission: "offboarding.manage" },
    ],
  },
  {
    moduleKey: "trainings",
    moduleTitle: "Treinamentos & Normas Regulamentadoras",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Treinamentos e NRs", permission: "trainings.view" },
      { actionKey: "create", actionLabel: "Inscrever-se em Cursos", permission: "trainings.enroll" },
      { actionKey: "admin", actionLabel: "Gerenciar Treinamentos & Certificados", permission: "trainings.manage" },
    ],
  },
  {
    moduleKey: "climate",
    moduleTitle: "Pesquisa de Clima & eNPS",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Resultados e eNPS", permission: "climate.view" },
      { actionKey: "create", actionLabel: "Responder Pesquisa Confidencial", permission: "climate.respond" },
      { actionKey: "admin", actionLabel: "Criar e Gerenciar Pesquisas", permission: "climate.manage" },
    ],
  },
  {
    moduleKey: "orgchart",
    moduleTitle: "Organograma Corporativo",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Árvore Hierárquica", permission: "orgchart.view" },
    ],
  },
  {
    moduleKey: "requests",
    moduleTitle: "Solicitações & Chamados",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Solicitações", permission: "requests.view" },
      { actionKey: "create", actionLabel: "Abrir Nova Solicitação", permission: "requests.create" },
      { actionKey: "approve", actionLabel: "Aprovar Chamados", permission: "requests.approve" },
      { actionKey: "approve", actionLabel: "Rejeitar Chamados", permission: "requests.reject" },
      { actionKey: "delete", actionLabel: "Cancelar / Excluir", permission: "requests.delete" },
    ],
  },
  {
    moduleKey: "workflows",
    moduleTitle: "Workflows RH",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Workflows", permission: "workflows.view" },
      { actionKey: "create", actionLabel: "Criar Workflow", permission: "workflows.create" },
      { actionKey: "edit", actionLabel: "Executar Etapa de Aprovação", permission: "workflows.execute" },
      { actionKey: "admin", actionLabel: "Gerenciar Modelos & SLAs", permission: "workflows.manage" },
    ],
  },
  {
    moduleKey: "performance",
    moduleTitle: "Desempenho & Metas",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Avaliações", permission: "performance.view" },
      { actionKey: "create", actionLabel: "Criar Ciclo de Avaliação", permission: "performance.create_cycle" },
      { actionKey: "edit", actionLabel: "Preencher Avaliação / Feedback", permission: "performance.evaluate" },
      { actionKey: "admin", actionLabel: "Gerenciar Metas Corporativas", permission: "performance.manage_goals" },
    ],
  },
  {
    moduleKey: "reports",
    moduleTitle: "Relatórios & Indicadores",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Relatórios Padrão", permission: "reports.view" },
      { actionKey: "export", actionLabel: "Exportar Dados (PDF/CSV)", permission: "reports.export" },
      { actionKey: "create", actionLabel: "Construir Relatório Personalizado", permission: "reports.custom_build" },
      { actionKey: "admin", actionLabel: "Gerenciar Relatórios Salvos", permission: "reports.saved_manage" },
    ],
  },
  {
    moduleKey: "audit",
    moduleTitle: "Trilha de Auditoria & Segurança",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Logs de Auditoria", permission: "audit.view" },
    ],
  },
  {
    moduleKey: "settings",
    moduleTitle: "Configurações da Plataforma",
    actions: [
      { actionKey: "view", actionLabel: "Visualizar Configurações", permission: "settings.view" },
      { actionKey: "admin", actionLabel: "Atualizar Configurações & Integrações", permission: "settings.update" },
    ],
  },
]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.update",
    "users.delete",
    "users.manage_roles",
    "users.manage_permissions",
    "employees.view_all",
    "employees.view_team",
    "employees.view_own",
    "employees.create",
    "employees.update",
    "employees.delete",
    "employees.view_sensitive",
    "employees.export",
    "schedules.view",
    "schedules.manage",
    "payroll.view",
    "payroll.manage",
    "documents.view",
    "documents.create",
    "documents.upload",
    "documents.delete",
    "documents.export",
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
    "requests.delete",
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
    "timeclock.view",
    "timeclock.punch",
    "timeclock.manage",
    "benefits.view",
    "benefits.enroll",
    "benefits.manage",
    "offboarding.view",
    "offboarding.manage",
    "trainings.view",
    "trainings.enroll",
    "trainings.manage",
    "climate.view",
    "climate.respond",
    "climate.manage",
    "orgchart.view",
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
    "employees.export",
    "schedules.view",
    "schedules.manage",
    "payroll.view",
    "payroll.manage",
    "documents.view",
    "documents.create",
    "documents.upload",
    "documents.delete",
    "documents.export",
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
    "timeclock.view",
    "timeclock.punch",
    "timeclock.manage",
    "benefits.view",
    "benefits.enroll",
    "benefits.manage",
    "offboarding.view",
    "offboarding.manage",
    "trainings.view",
    "trainings.enroll",
    "trainings.manage",
    "climate.view",
    "climate.respond",
    "climate.manage",
    "orgchart.view",
    "audit.view",
    "settings.view",
  ],
  DP: [
    "dashboard.view",
    // 1. Administração de Vínculos e Documentação (Admissão, Rescisão, LGPD / Dados Sensíveis)
    "employees.view_all",
    "employees.view_team",
    "employees.view_own",
    "employees.create",
    "employees.update",
    "employees.view_sensitive",
    "employees.export",
    // 2. Rotinas de Folha de Pagamento, Encargos & Benefícios
    "payroll.view",
    "payroll.manage",
    // 3. Controle de Jornada e Frequência (Apuração de ponto, banco de horas, escalas)
    "schedules.view",
    "schedules.manage",
    // 4. Gestão de Ausências & Férias
    "vacations.view",
    "vacations.request",
    "vacations.approve",
    "vacations.reject",
    // 5. Documentos, Contratos CLT e SST (CAT, ASO, Laudos, Atestados)
    "documents.view",
    "documents.create",
    "documents.upload",
    "documents.delete",
    "documents.export",
    // 6. Chamados e Solicitações de Colaboradores
    "requests.view",
    "requests.create",
    "requests.approve",
    "requests.reject",
    // 7. Workflows de Admissão, Desligamento e Homologação
    "workflows.view",
    "workflows.execute",
    // 8. Relatórios de Folha, Encargos Trabalhistas e Indicadores
    "reports.view",
    "reports.export",
    "reports.custom_build",
    // 9. Comunicações e Calendário
    "notifications.view",
    "calendar.view",
    "timeclock.view",
    "timeclock.punch",
    "timeclock.manage",
    "benefits.view",
    "benefits.enroll",
    "benefits.manage",
    "offboarding.view",
    "offboarding.manage",
    "trainings.view",
    "orgchart.view",
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
    "timeclock.view",
    "timeclock.manage",
    "benefits.view",
    "trainings.view",
    "trainings.enroll",
    "climate.view",
    "climate.respond",
    "orgchart.view",
  ],
  RECRUTADOR: [
    "recruitment.view",
    "recruitment.manage",
    "recruitment.evaluate",
    "recruitment.delete",
    "employees.view_own",
    "schedules.view",
    "payroll.view",
    "documents.view",
    "documents.upload",
    "vacations.view",
    "vacations.request",
    "requests.view",
    "requests.create",
    "calendar.view",
    "notifications.view",
    "performance.view",
    "timeclock.view",
    "timeclock.punch",
    "benefits.view",
    "trainings.view",
    "trainings.enroll",
    "climate.respond",
    "orgchart.view",
  ],
  AUDITOR: [
    "dashboard.view",
    "users.view",
    "employees.view_all",
    "employees.view_team",
    "employees.view_own",
    "employees.view_sensitive",
    "employees.export",
    "schedules.view",
    "payroll.view",
    "documents.view",
    "documents.export",
    "reports.view",
    "reports.export",
    "vacations.view",
    "requests.view",
    "workflows.view",
    "notifications.view",
    "calendar.view",
    "performance.view",
    "recruitment.view",
    "timeclock.view",
    "benefits.view",
    "offboarding.view",
    "trainings.view",
    "climate.view",
    "orgchart.view",
    "audit.view",
    "settings.view",
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
    "timeclock.view",
    "timeclock.punch",
    "benefits.view",
    "benefits.enroll",
    "trainings.view",
    "trainings.enroll",
    "climate.respond",
    "orgchart.view",
  ],
}

/**
 * Normaliza qualquer string ou role legada para uma das 6 roles oficiais.
 */
export function normalizeRole(rawRole?: string | null): Role {
  if (!rawRole) return "COLABORADOR"
  const upper = rawRole.trim().toUpperCase()
  if (upper === "ADMIN" || upper.includes("ADMINISTRADOR") || upper === "TI") return "ADMIN"
  if (upper === "AUDITOR" || upper.includes("AUDITORIA") || upper.includes("COMPLIANCE")) return "AUDITOR"
  if (upper === "RECRUTADOR" || upper.includes("RECRUITER") || upper.includes("SELECAO") || upper.includes("R&S")) return "RECRUTADOR"
  if (upper === "DP" || upper.includes("DEPARTAMENTO PESSOAL") || upper.includes("FOLHA") || upper.includes("PESSOAL")) return "DP"
  if (upper === "RH" || upper.includes("RECURSOS HUMANOS") || upper.includes("DHO")) return "RH"
  if (upper === "GESTOR" || upper.includes("GERENTE") || upper.includes("COORDENADOR") || upper.includes("LIDER")) return "GESTOR"
  return "COLABORADOR"
}

/**
 * Verifica se uma role possui uma determinada permissão estatisticamente.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

/**
 * Consulta as permissões efetivas do usuário no banco SQLite
 * (Permissões da Role + customizações salvas em role_permissions + user_permissions).
 */
export function getEffectivePermissionsForUser(userId: string, role: Role): Permission[] {
  try {
    const db = getDB()
    const baseRolePerms = new Set<Permission>(ROLE_PERMISSIONS[role] || [])

    // 1. Verificar se existem customizações para a role no banco
    const roleRows = db.exec(`SELECT permission FROM role_permissions WHERE role = ?`, [role])
    if (roleRows.length && roleRows[0].values.length) {
      baseRolePerms.clear()
      for (const row of roleRows[0].values) {
        baseRolePerms.add(row[0] as Permission)
      }
    }

    // 2. Aplicar overrides específicos do usuário (granted = 1 adiciona, granted = 0 revoga)
    const userRows = db.exec(`SELECT permission, granted FROM user_permissions WHERE user_id = ?`, [userId])
    if (userRows.length && userRows[0].values.length) {
      for (const row of userRows[0].values) {
        const perm = row[0] as Permission
        const granted = Boolean(row[1])
        if (granted) {
          baseRolePerms.add(perm)
        } else {
          baseRolePerms.delete(perm)
        }
      }
    }

    return Array.from(baseRolePerms)
  } catch (_e) {
    // Fallback gracioso para a matriz estática em caso de falha de banco
    return Array.from(ROLE_PERMISSIONS[role] || [])
  }
}

/**
 * Verifica se o usuário tem permissão efetiva ativa.
 */
export function userHasEffectivePermission(userId: string, role: Role, permission: Permission): boolean {
  const perms = getEffectivePermissionsForUser(userId, role)
  return perms.includes(permission)
}
