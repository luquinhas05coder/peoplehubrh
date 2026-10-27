<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import { useRoute } from "vue-router"
import { MessagesSquare, WifiOff } from "lucide-vue-next"
import {
  chatOpen,
  totalUnread,
  isAuthenticated,
  authStep,
  activeToasts,
  currentUser,
  showToast,
  fetchAllFromBackend,
} from "./store"
import NavRail from "./components/NavRail.vue"
import HomeWorkspace from "./components/HomeWorkspace.vue"
import ChatPanel from "./components/ChatPanel.vue"
import LoginPage from "./components/LoginPage.vue"
import MfaVerification from "./components/MfaVerification.vue"
import FirstLoginPasswordModal from "./components/FirstLoginPasswordModal.vue"
import PublicJobsPage from "./components/PublicJobsPage.vue"

const route = useRoute()
const isPublicCareers = computed(() => {
  return route?.path === "/vagas-publicas" || route?.path === "/vagas"
})

const isOffline = ref(typeof navigator !== "undefined" ? !navigator.onLine : false)

function handleOnline() {
  isOffline.value = false
  showToast("Conexão restabelecida! Sincronizando dados...", "success")
  fetchAllFromBackend()
}

function handleOffline() {
  isOffline.value = true
  showToast("Você está sem conexão com a internet. Modo offline ativado.", "warning")
}

onMounted(() => {
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
})

onUnmounted(() => {
  window.removeEventListener("online", handleOnline)
  window.removeEventListener("offline", handleOffline)
})

function openChat() {
  chatOpen.value = true
}
function closeChat() {
  chatOpen.value = false
}
function toggleChat() {
  chatOpen.value = !chatOpen.value
}
</script>

<template>
  <!-- Link de Pulo para o Conteúdo Principal (WCAG 2.4.1) -->
  <a href="#main-content" class="ph-skip-link">Pular para o conteúdo principal</a>

  <!-- Offline Status Banner -->
  <div
    v-if="isOffline"
    role="status"
    aria-live="polite"
    class="fixed top-0 left-0 right-0 z-40 bg-amber-500 text-amber-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
  >
    <WifiOff :size="15" aria-hidden="true" />
    <span>Você está desconectado. As alterações serão sincronizadas assim que a conexão for restabelecida.</span>
  </div>

  <!-- Global Toast Notifications -->
  <div
    class="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 z-50 flex flex-col gap-2 pointer-events-none w-auto sm:max-w-sm"
    :class="{ 'mt-7': isOffline }"
    role="region"
    aria-label="Notificações do sistema"
    aria-live="polite"
  >
    <transition-group
      enter-active-class="transition duration-300 ease-out transform"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in transform"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-for="toast in activeToasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium text-white backdrop-blur-md transition-all"
        :class="{
          'bg-emerald-600/90 border-emerald-500': toast.type === 'success',
          'bg-sky-600/90 border-sky-500': toast.type === 'info',
          'bg-amber-600/90 border-amber-500': toast.type === 'warning',
          'bg-rose-600/90 border-rose-500': toast.type === 'error'
        }"
        :role="toast.type === 'error' ? 'alert' : 'status'"
      >
        <span>{{ toast.title }}</span>
      </div>
    </transition-group>
  </div>

  <!-- Portal Público de Vagas (sem necessidade de login) -->
  <template v-if="isPublicCareers">
    <PublicJobsPage />
  </template>

  <!-- Auth Guard -->
  <template v-else-if="!isAuthenticated">
    <LoginPage v-if="authStep === 'login'" />
    <MfaVerification v-else-if="authStep === 'mfa'" />
  </template>

  <!-- Guarda Obrigatória: Redefinição de Senha no Primeiro Login -->
  <template v-else-if="currentUser?.mustChangePassword">
    <FirstLoginPasswordModal />
  </template>

  <!-- Main App (só monta após autenticação e senha permanente definida) -->
  <div v-else class="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground">
    <NavRail
      :chat-open="chatOpen"
      @toggle-chat="toggleChat"
      @go-home="closeChat"
    />

    <!-- Área principal / workspace -->
    <main id="main-content" tabindex="-1" class="min-w-0 flex-1 outline-none flex flex-col h-full overflow-hidden" aria-label="Área de trabalho principal">
      <HomeWorkspace class="min-w-0 flex-1" @open-chat="openChat" />
    </main>

    <!-- Painel de chat recolhível -->
    <ChatPanel :open="chatOpen" @close="closeChat" />

    <!-- Botão flutuante para reabrir o atendimento -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0 translate-y-2"
    >
      <button
        v-if="!chatOpen"
        class="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-30 flex items-center gap-2 rounded-full py-2.5 px-3.5 sm:py-3 sm:pl-4 sm:pr-5 font-medium text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
        style="background-color: var(--color-primary)"
        aria-label="Abrir central de atendimento"
        :aria-expanded="chatOpen"
        aria-controls="chat-panel"
        @click="openChat"
      >
        <MessagesSquare :size="20" aria-hidden="true" />
        <span class="hidden sm:inline">Atendimento</span>
        <span
          v-if="totalUnread"
          class="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-accent-foreground animate-pulse"
          style="background-color: var(--color-accent)"
        >
          {{ totalUnread }}
          <span class="sr-only">mensagens não lidas</span>
        </span>
      </button>
    </transition>
  </div>
</template>
