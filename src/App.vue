<script setup lang="ts">
import { MessagesSquare } from "lucide-vue-next"
import { chatOpen, totalUnread, isAuthenticated, authStep, activeToasts } from "./store"
import NavRail from "./components/NavRail.vue"
import HomeWorkspace from "./components/HomeWorkspace.vue"
import ChatPanel from "./components/ChatPanel.vue"
import LoginPage from "./components/LoginPage.vue"
import MfaVerification from "./components/MfaVerification.vue"

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
  <!-- Global Toast Notifications -->
  <div class="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
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
      >
        <span>{{ toast.title }}</span>
      </div>
    </transition-group>
  </div>

  <!-- Auth Guard -->
  <template v-if="!isAuthenticated">
    <LoginPage v-if="authStep === 'login'" />
    <MfaVerification v-else-if="authStep === 'mfa'" />
  </template>

  <!-- Main App -->
  <div v-else class="flex h-screen w-full overflow-hidden bg-background text-foreground">
    <NavRail
      :chat-open="chatOpen"
      @toggle-chat="toggleChat"
      @go-home="closeChat"
    />

    <!-- Área principal / workspace -->
    <HomeWorkspace class="min-w-0 flex-1" @open-chat="openChat" />

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
        class="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full py-3 pl-4 pr-5 font-medium text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95"
        style="background-color: var(--color-primary)"
        aria-label="Abrir central de atendimento"
        @click="openChat"
      >
        <MessagesSquare :size="20" />
        <span class="hidden sm:inline">Atendimento</span>
        <span
          v-if="totalUnread"
          class="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-accent-foreground animate-pulse"
          style="background-color: var(--color-accent)"
        >
          {{ totalUnread }}
        </span>
      </button>
    </transition>
  </div>
</template>
