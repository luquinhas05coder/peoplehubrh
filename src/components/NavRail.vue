<script setup lang="ts">
import { computed, ref } from "vue"
import { MessagesSquare, Home, Users, BarChart3, CalendarCheck, FileText, GraduationCap, Settings, LifeBuoy, LogOut } from "lucide-vue-next"
import { totalUnread, activeTab, logoutUser, currentUser, userPermissions, userRoleType } from "../store"
import UserAvatar from "./UserAvatar.vue"
import SettingsModal from "./SettingsModal.vue"
import HelpModal from "./HelpModal.vue"
import ProfileModal from "./ProfileModal.vue"

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
    { key: "people", icon: Users, label: "Colaboradores", path: "/colaboradores", allowed: userPermissions.value.canManagePeople },
    { key: "requests", icon: CalendarCheck, label: "Solicitações", path: "/solicitacoes", allowed: true },
    { key: "docs", icon: FileText, label: "Documentos", path: "/documentos", allowed: userPermissions.value.canManageDocs },
    { key: "reports", icon: BarChart3, label: "Relatórios", path: "/relatorios", allowed: userPermissions.value.canViewReports },
    { key: "onboarding", icon: GraduationCap, label: "Onboarding", path: "/onboarding", allowed: true },
  ]
  return list.filter((i) => i.allowed)
})

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

    <!-- Badge do Perfil Ativo (RH / DP / TI / COLAB) -->
    <span
      class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider border shadow-2xs mb-0.5"
      :class="{
        'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30': userRoleType === 'rh',
        'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30': userRoleType === 'dp',
        'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30': userRoleType === 'ti',
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30': userRoleType === 'colaborador',
      }"
      :title="`Perfil de Acesso: ${currentUser?.role || userRoleType}`"
    >
      {{ userRoleType === 'colaborador' ? 'COLAB' : userRoleType.toUpperCase() }}
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
      :class="(activeTab === item.key || (item.key === 'people' && activeTab === 'colaboradores') || (item.key === 'requests' && activeTab === 'solicitacoes') || (item.key === 'docs' && activeTab === 'documentos') || (item.key === 'reports' && activeTab === 'relatorios'))
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
