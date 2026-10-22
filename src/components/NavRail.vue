<script setup lang="ts">
import { computed, ref } from "vue"
import { MessagesSquare, Home, Users, BarChart3, CalendarCheck, FileText, GraduationCap, Settings, LifeBuoy, LogOut, LayoutDashboard, Shield, Sparkles, ShieldAlert, GitMerge, Calendar, Award, Briefcase, UserCheck } from "lucide-vue-next"
import { totalUnread, activeTab, logoutUser, currentUser, userPermissions, activeUserRole } from "../store"
import UserAvatar from "./UserAvatar.vue"
import SettingsModal from "./SettingsModal.vue"
import HelpModal from "./HelpModal.vue"
import ProfileModal from "./ProfileModal.vue"
import NotificationsDropdown from "./NotificationsDropdown.vue"

defineProps<{
  chatOpen?: boolean
}>()

const emit = defineEmits<{
  (e: "toggle-chat"): void
  (e: "go-home"): void
}>()

const showSettingsModal = ref(false)
const showHelpModal = ref(false)
const showProfileModal = ref(false)

import { useRouter } from "vue-router"

const router = useRouter()

const items = computed(() => {
  const list = [
    { key: "home", icon: Home, label: "Início", path: "/home", allowed: true },
    { key: "autoatendimento", icon: UserCheck, label: "Autoatendimento", path: "/autoatendimento", allowed: true },
    { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", allowed: true },
    {
      key: "people",
      icon: Users,
      label: userPermissions.value.isColaborador ? "Minha Pasta" : "Colaboradores",
      path: "/colaboradores",
      allowed: true,
    },
    { key: "recrutamento", icon: Briefcase, label: "Recrutamento & Seleção", path: "/recrutamento", allowed: userPermissions.value.canViewRecruitment },
    { key: "requests", icon: CalendarCheck, label: "Solicitações", path: "/solicitacoes", allowed: true },
    { key: "workflows", icon: GitMerge, label: "Workflows RH", path: "/workflows", allowed: true },
    { key: "calendario", icon: Calendar, label: "Calendário", path: "/calendario", allowed: true },
    { key: "desempenho", icon: Award, label: "Desempenho & Metas", path: "/desempenho", allowed: true },
    { key: "docs", icon: FileText, label: "Documentos", path: "/documentos", allowed: userPermissions.value.canManageDocs },
    { key: "reports", icon: BarChart3, label: "Relatórios", path: "/relatorios", allowed: userPermissions.value.canViewReports },
    { key: "onboarding", icon: GraduationCap, label: "Onboarding", path: "/onboarding", allowed: activeUserRole.value !== "COLABORADOR" },
    { key: "feed", icon: Sparkles, label: "Feed Corporativo", path: "/feed", allowed: true },
    { key: "adverse_events", icon: ShieldAlert, label: "Ouvidoria & Incidentes", path: "/eventos-adversos", allowed: true },
    { key: "users", icon: Shield, label: "Usuários", path: "/usuarios", allowed: activeUserRole.value === "ADMIN" },
  ]
  return list.filter((i) => i.allowed)
})

function isItemActive(itemKey: string): boolean {
  if (activeTab.value === itemKey) return true
  if (itemKey === "autoatendimento" && activeTab.value === "autoatendimento") return true
  if (itemKey === "dashboard" && activeTab.value === "dashboard") return true
  if (itemKey === "people" && (activeTab.value === "colaboradores" || activeTab.value === "perfil_funcionario")) return true
  if (itemKey === "recrutamento" && (activeTab.value === "recrutamento" || activeTab.value === "recruitment")) return true
  if (itemKey === "requests" && activeTab.value === "solicitacoes") return true
  if (itemKey === "workflows" && activeTab.value === "workflows") return true
  if (itemKey === "calendario" && activeTab.value === "calendario") return true
  if (itemKey === "desempenho" && activeTab.value === "desempenho") return true
  if (itemKey === "docs" && activeTab.value === "documentos") return true
  if (itemKey === "reports" && activeTab.value === "relatorios") return true
  if (itemKey === "onboarding" && activeTab.value === "onboarding") return true
  if (itemKey === "feed" && activeTab.value === "feed") return true
  if (itemKey === "adverse_events" && (activeTab.value === "adverse_events" || activeTab.value === "eventos-adversos")) return true
  if (itemKey === "users" && (activeTab.value === "users" || activeTab.value === "usuarios")) return true
  return false
}

function handleNavClick(key: string) {
  if (currentUser.value?.mustChangePassword) {
    return
  }
  activeTab.value = key
  const target = items.value.find((i) => i.key === key)
  if (target?.path && router) {
    router.push(target.path)
  }
  if (key === "home") {
    emit("go-home")
  }
}
</script>

<template>
  <nav
    class="flex w-16 shrink-0 flex-col items-center gap-2 border-r bg-card py-4"
    aria-label="Navegação principal"
  >
    <button
      class="flex h-10 w-10 items-center justify-center rounded-xl font-bold text-primary-foreground transition-transform hover:scale-105 cursor-pointer"
      style="background-color: var(--color-primary)"
      aria-label="Início — PeopleHub"
      @click="handleNavClick('home')"
    >
      PH
    </button>

    <!-- Badge do Perfil Ativo (ADMIN / RH / GESTOR / COLAB) -->
    <span
      class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider border shadow-2xs mb-0.5"
      :class="{
        'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30': activeUserRole === 'ADMIN',
        'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30': activeUserRole === 'RH',
        'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30': activeUserRole === 'GESTOR',
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30': activeUserRole === 'COLABORADOR',
      }"
      :title="`Perfil RBAC: ${currentUser?.role || activeUserRole}`"
    >
      {{ activeUserRole === 'COLABORADOR' ? 'COLAB' : activeUserRole }}
    </span>

    <!-- Indicador de Organização / Tenant Ativo -->
    <div
      class="group relative flex items-center justify-center cursor-default mb-2"
      :title="`Organização: ${currentUser?.tenantName || 'PeopleHub Matriz'}`"
    >
      <span class="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/60 max-w-[56px] truncate text-center">
        🏢 {{ (currentUser?.tenantName || 'Matriz').split(' ')[0] }}
      </span>
      <span
        class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        🏢 {{ currentUser?.tenantName || 'PeopleHub Matriz' }}
      </span>
    </div>

    <!-- Central de Notificações com Badge e Dropdown -->
    <NotificationsDropdown />

    <!-- Botão dedicado da Central de Atendimento -->
    <button
      class="group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all"
      :class="chatOpen
        ? 'text-primary-foreground shadow-md'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
      :style="chatOpen ? { backgroundColor: 'var(--color-primary)' } : {}"
      aria-label="Central de Atendimento"
      :aria-pressed="chatOpen ? 'true' : 'false'"
      @click="emit('toggle-chat')"
    >
      <MessagesSquare :size="20" />
      <span
        v-if="totalUnread"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-accent-foreground animate-pulse"
        style="background-color: var(--color-accent)"
      >
        {{ totalUnread }}
      </span>
      <span
        class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        Central de Atendimento
      </span>
    </button>

    <div class="my-1 h-px w-8 bg-border" />

    <button
      v-for="item in items"
      :key="item.key"
      class="group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
      :class="isItemActive(item.key)
        ? 'bg-muted text-foreground font-bold'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
      :aria-label="item.label"
      @click="handleNavClick(item.key)"
    >
      <component :is="item.icon" :size="20" />
      <span
        class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        {{ item.label }}
      </span>
    </button>

    <div class="mt-auto flex flex-col items-center gap-2">
      <!-- Ajuda -->
      <button
        class="group relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Ajuda"
        @click="showHelpModal = true"
      >
        <LifeBuoy :size="20" />
        <span class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Ajuda</span>
      </button>

      <!-- Configurações (Apenas RH e TI) -->
      <button
        v-if="userPermissions.canManageSettings"
        class="group relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        aria-label="Configurações"
        @click="showSettingsModal = true"
      >
        <Settings :size="20" />
        <span class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Configurações</span>
      </button>

      <!-- Sair -->
      <button
        class="group relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
        aria-label="Sair da plataforma"
        @click="logoutUser"
      >
        <LogOut :size="20" />
        <span class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Sair</span>
      </button>

      <!-- Perfil (Avatar AD/VS) -->
      <button
        class="group relative flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:ring-2 focus:ring-primary"
        aria-label="Meu Perfil"
        @click="showProfileModal = true"
      >
        <UserAvatar :initials="currentUser?.initials ?? 'PH'" :size="36" />
        <span class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Meu Perfil</span>
      </button>
    </div>

    <!-- Modais -->
    <SettingsModal v-if="showSettingsModal" @close="showSettingsModal = false" />
    <HelpModal v-if="showHelpModal" @close="showHelpModal = false" />
    <ProfileModal v-if="showProfileModal" @close="showProfileModal = false" />
  </nav>
</template>
