<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import { MessagesSquare, Home, Users, BarChart3, CalendarCheck, FileText, GraduationCap, Settings, LifeBuoy, LogOut, LayoutDashboard, Shield, Sparkles, ShieldAlert, GitMerge, Calendar, Award, Briefcase, UserCheck, Menu, X, Network, Smile, UserMinus, BookOpen } from "lucide-vue-next"
import { totalUnread, activeTab, logoutUser, currentUser, userPermissions, activeUserRole, hasPermission } from "../store"
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
const mobileMenuOpen = ref(false)

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && mobileMenuOpen.value) {
    mobileMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown)
})

import { useRouter } from "vue-router"

const router = useRouter()

const items = computed(() => {
  const currentRole = activeUserRole.value
  const list = [
    { key: "home", icon: Home, label: "Início", path: "/home", allowed: true },
    { key: "autoatendimento", icon: UserCheck, label: "Portal do Colaborador", path: "/autoatendimento", allowed: true },
    { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", allowed: hasPermission("dashboard.view") },
    {
      key: "people",
      icon: Users,
      label: currentRole === "COLABORADOR" ? "Minha Pasta" : "Colaboradores",
      path: currentRole === "COLABORADOR" ? "/autoatendimento" : "/colaboradores",
      allowed: hasPermission("employees.view_all") || hasPermission("employees.view_team") || currentRole === "COLABORADOR",
    },
    { key: "organograma", icon: Network, label: "Organograma", path: "/organograma", allowed: true },
    { key: "recrutamento", icon: Briefcase, label: "Recrutamento & Seleção", path: "/recrutamento", allowed: hasPermission("recruitment.view") },
    { key: "requests", icon: CalendarCheck, label: "Solicitações", path: "/solicitacoes", allowed: hasPermission("requests.view") },
    { key: "workflows", icon: GitMerge, label: "Workflows RH", path: "/workflows", allowed: hasPermission("workflows.view") && currentRole !== "COLABORADOR" },
    { key: "calendario", icon: Calendar, label: "Calendário", path: "/calendario", allowed: hasPermission("calendar.view") },
    { key: "desempenho", icon: Award, label: "Desempenho & Metas", path: "/desempenho", allowed: hasPermission("performance.view") },
    { key: "treinamentos", icon: BookOpen, label: "Treinamentos & NRs", path: "/treinamentos", allowed: true },
    { key: "clima", icon: Smile, label: "Pesquisa de Clima", path: "/clima", allowed: true },
    { key: "docs", icon: FileText, label: "Documentos", path: "/documentos", allowed: hasPermission("documents.view") && currentRole !== "COLABORADOR" },
    { key: "reports", icon: BarChart3, label: "Relatórios", path: "/relatorios", allowed: hasPermission("reports.view") },
    { key: "onboarding", icon: GraduationCap, label: "Onboarding", path: "/onboarding", allowed: ["ADMIN", "RH", "GESTOR"].includes(currentRole) },
    { key: "offboarding", icon: UserMinus, label: "Desligamento", path: "/offboarding", allowed: ["ADMIN", "RH", "DP", "GESTOR"].includes(currentRole) },
    { key: "feed", icon: Sparkles, label: "Feed Corporativo", path: "/feed", allowed: true },
    { key: "adverse_events", icon: ShieldAlert, label: "Ouvidoria & Incidentes", path: "/eventos-adversos", allowed: true },
    { key: "users", icon: Shield, label: "Usuários & RBAC", path: "/usuarios", allowed: hasPermission("users.view") },
  ]
  return list.filter((i) => i.allowed)
})

function isItemActive(itemKey: string): boolean {
  if (activeTab.value === itemKey) return true
  if (itemKey === "autoatendimento" && activeTab.value === "autoatendimento") return true
  if (itemKey === "dashboard" && activeTab.value === "dashboard") return true
  if (itemKey === "people" && (activeTab.value === "colaboradores" || activeTab.value === "perfil_funcionario")) return true
  if (itemKey === "organograma" && activeTab.value === "organograma") return true
  if (itemKey === "recrutamento" && (activeTab.value === "recrutamento" || activeTab.value === "recruitment")) return true
  if (itemKey === "requests" && activeTab.value === "solicitacoes") return true
  if (itemKey === "workflows" && activeTab.value === "workflows") return true
  if (itemKey === "calendario" && activeTab.value === "calendario") return true
  if (itemKey === "desempenho" && activeTab.value === "desempenho") return true
  if (itemKey === "treinamentos" && activeTab.value === "treinamentos") return true
  if (itemKey === "clima" && activeTab.value === "clima") return true
  if (itemKey === "docs" && activeTab.value === "documentos") return true
  if (itemKey === "reports" && activeTab.value === "relatorios") return true
  if (itemKey === "onboarding" && activeTab.value === "onboarding") return true
  if (itemKey === "offboarding" && activeTab.value === "offboarding") return true
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

function handleMobileNavClick(key: string) {
  handleNavClick(key)
  mobileMenuOpen.value = false
}
</script>

<template>
  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- 1. MOBILE TOP HEADER (< md)                                         -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  <header
    class="flex md:hidden h-14 w-full shrink-0 items-center justify-between border-b bg-card px-3 z-30"
    aria-label="Barra de navegação móvel"
  >
    <div class="flex items-center gap-2.5">
      <!-- Botão Hambúrguer para Abrir o Drawer -->
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
        aria-label="Abrir menu de navegação"
        @click="mobileMenuOpen = true"
      >
        <Menu :size="20" />
      </button>

      <!-- Logo & Tenant Info -->
      <button
        type="button"
        class="flex items-center gap-2 text-left cursor-pointer hover:opacity-90 transition-opacity"
        @click="handleNavClick('home')"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs text-primary-foreground shadow-2xs"
          style="background-color: var(--color-primary)"
        >
          PH
        </span>
        <div class="flex flex-col">
          <span class="text-xs font-bold leading-none tracking-tight text-foreground">PeopleHub RH</span>
          <span class="text-[10px] text-muted-foreground leading-tight truncate max-w-[110px]">
            {{ currentUser?.tenantName || 'Matriz' }}
          </span>
        </div>
      </button>
    </div>

    <div class="flex items-center gap-1.5">
      <!-- Role Badge Reduzido -->
      <span
        class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shadow-2xs"
        :class="{
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30': activeUserRole === 'ADMIN',
          'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30': activeUserRole === 'RH',
          'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30': activeUserRole === 'DP',
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30': activeUserRole === 'GESTOR',
          'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30': activeUserRole === 'RECRUTADOR',
          'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30': activeUserRole === 'AUDITOR',
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30': activeUserRole === 'COLABORADOR',
        }"
      >
        {{ activeUserRole === 'COLABORADOR' ? 'COLAB' : activeUserRole === 'RECRUTADOR' ? 'RECRUT' : activeUserRole }}
      </span>

      <!-- Notificações -->
      <NotificationsDropdown placement="header" />

      <!-- Avatar Perfil -->
      <button
        type="button"
        class="flex items-center justify-center rounded-full p-0.5 transition-transform active:scale-95 cursor-pointer"
        aria-label="Abrir perfil"
        @click="showProfileModal = true"
      >
        <UserAvatar :initials="currentUser?.initials ?? 'PH'" :size="30" />
      </button>
    </div>
  </header>

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- 2. MOBILE SLIDE-OVER DRAWER (< md)                                  -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  <transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
      @click="mobileMenuOpen = false"
    />
  </transition>

  <transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="mobileMenuOpen"
      class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between border-r bg-card p-4 shadow-2xl md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navegação móvel"
      tabindex="-1"
      @keydown.esc="mobileMenuOpen = false"
    >
      <!-- Topo do Drawer: Logo, Tenant & Botão Fechar -->
      <div>
        <div class="flex items-center justify-between border-b pb-3 mb-3">
          <div class="flex items-center gap-2.5">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm text-primary-foreground shadow"
              style="background-color: var(--color-primary)"
            >
              PH
            </span>
            <div>
              <p class="font-bold text-sm leading-tight text-foreground">PeopleHub RH</p>
              <p class="text-[11px] text-muted-foreground leading-tight truncate max-w-[150px]">
                {{ currentUser?.tenantName || 'Matriz' }}
              </p>
            </div>
          </div>

          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Fechar menu de navegação"
            @click="mobileMenuOpen = false"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Role Badge + Central de Atendimento -->
        <div class="flex items-center justify-between gap-2 mb-3 bg-muted/40 p-2 rounded-xl border border-border/60">
          <div class="flex items-center gap-1.5 min-w-0">
            <UserAvatar :initials="currentUser?.initials ?? 'PH'" :size="26" />
            <div class="min-w-0">
              <p class="text-xs font-bold text-foreground truncate">{{ currentUser?.name || 'Usuário' }}</p>
              <p class="text-[10px] text-muted-foreground uppercase font-bold">{{ activeUserRole }}</p>
            </div>
          </div>

          <button
            type="button"
            class="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-primary-foreground shadow-2xs shrink-0 cursor-pointer"
            style="background-color: var(--color-primary)"
            @click="emit('toggle-chat'); mobileMenuOpen = false"
          >
            <MessagesSquare :size="13" />
            <span>Chat</span>
          </button>
        </div>

        <!-- Lista de Módulos Autorizados com Labels de Texto -->
        <nav class="flex flex-col gap-1 max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-thin pr-1">
            <button
              v-for="item in items"
              :key="item.key"
              type="button"
              class="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer text-left min-h-[44px]"
              :class="isItemActive(item.key)
                ? 'bg-muted text-foreground font-bold shadow-2xs'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'"
              :aria-current="isItemActive(item.key) ? 'page' : undefined"
              @click="handleMobileNavClick(item.key)"
            >
              <component :is="item.icon" :size="18" class="shrink-0" aria-hidden="true" />
              <span class="truncate">{{ item.label }}</span>
            </button>
        </nav>
      </div>

      <!-- Rodapé do Drawer: Ações Rápidas -->
      <div class="border-t border-border/60 pt-3 flex flex-col gap-1">
        <button
          type="button"
          class="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer min-h-[40px]"
          @click="showHelpModal = true; mobileMenuOpen = false"
        >
          <LifeBuoy :size="17" />
          <span>Ajuda & Suporte</span>
        </button>

        <button
          v-if="userPermissions.canManageSettings"
          type="button"
          class="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer min-h-[40px]"
          @click="showSettingsModal = true; mobileMenuOpen = false"
        >
          <Settings :size="17" />
          <span>Configurações</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer min-h-[40px]"
          @click="showProfileModal = true; mobileMenuOpen = false"
        >
          <UserCheck :size="17" />
          <span>Meu Perfil</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer min-h-[40px]"
          @click="logoutUser"
        >
          <LogOut :size="17" />
          <span>Sair da Plataforma</span>
        </button>
      </div>
    </aside>
  </transition>

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- 3. DESKTOP SIDEBAR RAIL (md:)                                       -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  <nav
    class="hidden md:flex md:w-16 md:shrink-0 md:flex-col items-center gap-2 border-r bg-card py-4 relative z-40"
    aria-label="Navegação principal desktop"
  >
    <button
      class="flex h-10 w-10 items-center justify-center rounded-xl font-bold text-primary-foreground transition-transform hover:scale-105 cursor-pointer"
      style="background-color: var(--color-primary)"
      aria-label="Início — PeopleHub"
      @click="handleNavClick('home')"
    >
      PH
    </button>

    <!-- Badge do Perfil Ativo (ADMIN / RH / GESTOR / RECRUTADOR / AUDITOR / COLAB) -->
    <span
      class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider border shadow-2xs mb-0.5"
      :class="{
        'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30': activeUserRole === 'ADMIN',
        'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30': activeUserRole === 'RH',
        'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30': activeUserRole === 'DP',
        'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30': activeUserRole === 'GESTOR',
        'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30': activeUserRole === 'RECRUTADOR',
        'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30': activeUserRole === 'AUDITOR',
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30': activeUserRole === 'COLABORADOR',
      }"
      :title="`Perfil RBAC: ${currentUser?.role || activeUserRole}`"
    >
      {{ activeUserRole === 'COLABORADOR' ? 'COLAB' : activeUserRole === 'RECRUTADOR' ? 'RECRUT' : activeUserRole === 'AUDITOR' ? 'AUDIT' : activeUserRole }}
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
    <NotificationsDropdown placement="rail" />

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

    <div class="my-1 h-px w-8 bg-border shrink-0" />

    <!-- Lista de Itens de Navegação Rolável em Telas Menores -->
    <div class="flex-1 w-full min-h-0 overflow-y-auto scrollbar-thin flex flex-col items-center gap-1.5 py-1">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors cursor-pointer"
        :class="isItemActive(item.key)
          ? 'bg-muted text-foreground font-bold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
        :aria-label="item.label"
        :title="item.label"
        :aria-current="isItemActive(item.key) ? 'page' : undefined"
        @click="handleNavClick(item.key)"
      >
        <component :is="item.icon" :size="19" aria-hidden="true" />
        <span
          class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          {{ item.label }}
        </span>
      </button>
    </div>

    <div class="mt-auto shrink-0 flex flex-col items-center gap-2 pt-2 border-t border-border/60 w-full">
      <!-- Ajuda -->
      <button
        class="group relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
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
        class="group relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-red-500 cursor-pointer"
        aria-label="Sair da plataforma"
        @click="logoutUser"
      >
        <LogOut :size="20" />
        <span class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Sair</span>
      </button>

      <!-- Perfil (Avatar AD/VS) -->
      <button
        class="group relative flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:ring-2 focus:ring-primary cursor-pointer"
        aria-label="Meu Perfil"
        @click="showProfileModal = true"
      >
        <UserAvatar :initials="currentUser?.initials ?? 'PH'" :size="36" />
        <span class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Meu Perfil</span>
      </button>
    </div>
  </nav>

  <!-- Modais Compartilhados (Desktop + Mobile) -->
  <SettingsModal v-if="showSettingsModal" @close="showSettingsModal = false" />
  <HelpModal v-if="showHelpModal" @close="showHelpModal = false" />
  <ProfileModal v-if="showProfileModal" @close="showProfileModal = false" />
</template>
