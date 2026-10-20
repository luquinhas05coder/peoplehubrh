import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router"
import { currentUser, showToast, hasRole, isAuthenticated, type UserRole } from "../store"

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
    meta: { tab: "colaboradores" },
  },
  {
    path: "/documentos",
    name: "Documentos",
    component: () => import("../components/DocumentsModule.vue"),
    meta: { tab: "documentos" },
  },
  {
    path: "/onboarding",
    name: "Onboarding",
    component: () => import("../components/OnboardingModule.vue"),
    meta: { tab: "onboarding", requiresRoles: ["ADMIN", "RH", "GESTOR"] as UserRole[] },
  },
  {
    path: "/solicitacoes",
    name: "Solicitacoes",
    component: () => import("../components/RequestsModule.vue"),
    meta: { tab: "solicitacoes" },
  },
  {
    path: "/relatorios",
    name: "Relatorios",
    component: () => import("../components/ReportsModule.vue"),
    meta: { tab: "relatorios", requiresRoles: ["ADMIN", "RH", "GESTOR"] as UserRole[] },
  },
  {
    path: "/workflows",
    name: "Workflows",
    component: () => import("../components/WorkflowsModule.vue"),
    meta: { tab: "workflows" },
  },
  {
    path: "/calendario",
    name: "Calendario",
    component: () => import("../components/CorporateCalendarModule.vue"),
    meta: { tab: "calendario" },
  },
  {
    path: "/desempenho",
    name: "Desempenho",
    component: () => import("../components/PerformanceModule.vue"),
    meta: { tab: "desempenho" },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("../components/HomeWorkspace.vue"),
    meta: { tab: "dashboard" },
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
    meta: { tab: "usuarios", requiresRoles: ["ADMIN"] as UserRole[] },
  },
  {
    path: "/acesso-negado",
    name: "AcessoNegado",
    component: () => import("../components/AccessDeniedView.vue"),
    meta: { tab: "acesso-negado" },
  },
  {
    path: "/funcionarios/:id",
    name: "FuncionarioPerfil",
    component: () => import("../components/EmployeeProfilePage.vue"),
    meta: { tab: "perfil_funcionario" },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../components/LoginPage.vue"),
    meta: { tab: "login" },
  },
  {
    path: "/recrutamento",
    name: "Recrutamento",
    component: () => import("../components/RecruitmentModule.vue"),
    meta: { tab: "recrutamento", requiresRoles: ["ADMIN", "RH", "GESTOR"] as UserRole[] },
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

  const isPublicRoute = to.meta.isPublic === true || to.path === "/login" || to.path === "/vagas-publicas"

  // 2. Se o usuário NÃO está logado e tenta acessar rotas internas, vai para /login
  if (!isAuthenticated.value && !isPublicRoute) {
    return next("/login")
  }

  // 3. Usuário com redefinição de senha obrigatória
  if (currentUser.value?.mustChangePassword && !isPublicRoute) {
    showToast("Ação bloqueada: você deve redefinir sua senha obrigatória antes de navegar na plataforma.", "warning")
    return next(false)
  }

  // 4. Verificação de permissões RBAC por perfil
  const requiredRoles = to.meta.requiresRoles as UserRole[] | undefined
  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasRole(requiredRoles)) {
      showToast(`Acesso negado: esta página requer o perfil ${requiredRoles.join(" ou ")}.`, "error")
      return next("/acesso-negado")
    }
  }

  next()
})

export default router
