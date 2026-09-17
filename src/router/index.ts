import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router"
import { currentUser, showToast } from "../store"

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
    meta: { tab: "onboarding" },
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
    meta: { tab: "relatorios" },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../components/LoginPage.vue"),
    meta: { tab: "login" },
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

// Proteção de rota: bloqueia qualquer navegação caso o usuário precise redefinir sua senha obrigatória
router.beforeEach((_to, _from, next) => {
  if (currentUser.value?.mustChangePassword) {
    showToast("Ação bloqueada: você deve redefinir sua senha obrigatória antes de navegar na plataforma.", "warning")
    return next(false)
  }
  next()
})

export default router
