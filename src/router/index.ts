import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router"
import { currentUser, showToast, hasRole, hasPermission, isAuthenticated, type UserRole } from "../store"

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "Home",
    component: () => import("../components/HomeWorkspace.vue"),
    meta: { tab: "home" },
  },
  {
    path: "/chat",
    name: "Chat",
    component: () => import("../components/ChatPanel.vue"),
    meta: { tab: "chat" },
  },
  {
    path: "/chat/:id",
    name: "ChatDetail",
    component: () => import("../components/ChatPanel.vue"),
    meta: { tab: "chat" },
  },
  {
    path: "/colaboradores",
    name: "Colaboradores",
    component: () => import("../components/EmployeesModule.vue"),
    meta: {
      tab: "colaboradores",
      requiresRoles: ["ADMIN", "RH", "DP", "GESTOR", "AUDITOR"] as UserRole[],
      permission: "employees.view_all",
    },
  },
  {
    path: "/documentos",
    name: "Documentos",
    component: () => import("../components/DocumentsModule.vue"),
    meta: { tab: "documentos", permission: "documents.view" },
  },
  {
    path: "/onboarding",
    name: "Onboarding",
    component: () => import("../components/OnboardingModule.vue"),
    meta: {
      tab: "onboarding",
      requiresRoles: ["ADMIN", "RH", "DP", "GESTOR"] as UserRole[],
    },
  },
  {
    path: "/autoatendimento",
    name: "Autoatendimento",
    component: () => import("../components/SelfServicePortal.vue"),
    meta: { tab: "autoatendimento" },
  },
  {
    path: "/solicitacoes",
    name: "Solicitacoes",
    component: () => import("../components/RequestsModule.vue"),
    meta: { tab: "solicitacoes", permission: "requests.view" },
  },
  {
    path: "/relatorios",
    name: "Relatorios",
    component: () => import("../components/ReportsModule.vue"),
    meta: {
      tab: "relatorios",
      requiresRoles: ["ADMIN", "RH", "DP", "GESTOR", "AUDITOR"] as UserRole[],
      permission: "reports.view",
    },
  },
  {
    path: "/workflows",
    name: "Workflows",
    component: () => import("../components/WorkflowsModule.vue"),
    meta: { tab: "workflows", permission: "workflows.view" },
  },
  {
    path: "/calendario",
    name: "Calendario",
    component: () => import("../components/CorporateCalendarModule.vue"),
    meta: { tab: "calendario", permission: "calendar.view" },
  },
  {
    path: "/desempenho",
    name: "Desempenho",
    component: () => import("../components/PerformanceModule.vue"),
    meta: { tab: "desempenho", permission: "performance.view" },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("../components/HomeWorkspace.vue"),
    meta: {
      tab: "dashboard",
      requiresRoles: ["ADMIN", "RH", "DP", "GESTOR", "AUDITOR"] as UserRole[],
      permission: "dashboard.view",
    },
  },
  {
    path: "/feed",
    name: "Feed",
    component: () => import("../components/CorporateFeedModule.vue"),
    meta: { tab: "feed" },
  },
  {
    path: "/eventos-adversos",
    name: "EventosAdversos",
    component: () => import("../components/AdverseEventsModule.vue"),
    meta: { tab: "eventos-adversos" },
  },
  {
    path: "/usuarios",
    name: "Usuarios",
    component: () => import("../components/UsersModule.vue"),
    meta: {
      tab: "usuarios",
      requiresRoles: ["ADMIN"] as UserRole[],
      permission: "users.manage_roles",
    },
  },
  {
    path: "/acesso-negado",
    name: "AcessoNegado",
    component: () => import("../components/AccessDeniedView.vue"),
    meta: { tab: "acesso-negado", isPublic: true },
  },
  {
    path: "/funcionarios/:id",
    name: "FuncionarioPerfil",
    component: () => import("../components/EmployeeProfilePage.vue"),
    meta: {
      tab: "perfil_funcionario",
      requiresRoles: ["ADMIN", "RH", "DP", "GESTOR", "AUDITOR"] as UserRole[],
    },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../components/LoginPage.vue"),
    meta: { tab: "login", isPublic: true },
  },
  {
    path: "/recrutamento",
    name: "Recrutamento",
    component: () => import("../components/RecruitmentModule.vue"),
    meta: {
      tab: "recrutamento",
      requiresRoles: ["ADMIN", "RH", "RECRUTADOR", "GESTOR", "AUDITOR"] as UserRole[],
      permission: "recruitment.view",
    },
  },
  {
    path: "/vagas-publicas",
    name: "VagasPublicas",
    component: () => import("../components/PublicJobsPage.vue"),
    meta: { tab: "vagas_publicas", isPublic: true },
  },
  {
    path: "/vagas",
    redirect: "/vagas-publicas",
  },
  {
    path: "/organograma",
    name: "Organograma",
    component: () => import("../components/OrgChartModule.vue"),
    meta: { tab: "organograma", permission: "org_chart.view" },
  },
  {
    path: "/offboarding",
    name: "Offboarding",
    component: () => import("../components/OffboardingModule.vue"),
    meta: {
      tab: "offboarding",
      requiresRoles: ["ADMIN", "RH", "DP", "GESTOR"] as UserRole[],
      permission: "offboarding.view",
    },
  },
  {
    path: "/treinamentos",
    name: "Treinamentos",
    component: () => import("../components/TrainingsModule.vue"),
    meta: { tab: "treinamentos", permission: "trainings.view" },
  },
  {
    path: "/clima",
    name: "Clima",
    component: () => import("../components/ClimateSurveyModule.vue"),
    meta: { tab: "clima", permission: "climate.view" },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/home",
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Proteção de rotas RBAC, prevenção de trap na tela de login e verificação de senha
router.beforeEach((to, _from, next) => {
  // 1. Prevenção de loop/trap: se o usuário já está logado e clica em Voltar voltando a /login, redireciona para /home
  if (isAuthenticated.value && to.path === "/login") {
    return next("/home")
  }

  const isPublicRoute = to.meta.isPublic === true || to.path === "/login" || to.path === "/vagas-publicas" || to.path === "/acesso-negado"

  // 2. Se o usuário NÃO está logado e tenta acessar rotas internas, vai para /login
  if (!isAuthenticated.value && !isPublicRoute) {
    return next("/login")
  }

  // 3. Usuário com redefinição de senha obrigatória
  if (currentUser.value?.mustChangePassword && !isPublicRoute) {
    showToast("Ação bloqueada: você deve redefinir sua senha obrigatória antes de navegar na plataforma.", "warning")
    return next(false)
  }

  // 4. Verificação de permissões granulares e roles RBAC
  const requiredRoles = to.meta.requiresRoles as UserRole[] | undefined
  const requiredPermission = to.meta.permission as string | undefined

  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Redirecionamento amigável para colaboradores comuns que tentam acessar /colaboradores
    if (to.path === "/colaboradores" && currentUser.value?.userRole === "COLABORADOR") {
      return next("/autoatendimento")
    }
    showToast(`Acesso negado: seu perfil não possui a permissão '${requiredPermission}' para acessar esta página.`, "error")
    return next("/acesso-negado")
  }

  if (requiredRoles && requiredRoles.length > 0) {
    // Se a rota define uma permissão específica e o usuário a possui (via role ou override), prevalece a permissão granular
    const hasExplicitPerm = requiredPermission ? hasPermission(requiredPermission) : false
    if (!hasExplicitPerm && !hasRole(requiredRoles)) {
      showToast(`Acesso negado: esta página requer um dos perfis: ${requiredRoles.join(", ")}.`, "error")
      return next("/acesso-negado")
    }
  }

  next()
})

export default router
