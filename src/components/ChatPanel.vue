<script setup lang="ts">
import { ref } from "vue"
import { Minus, X, MessagesSquare, PenSquare } from "lucide-vue-next"
import { activeId, activeConversation, totalUnread, selectConversation, startDirectChatForAttendance } from "../store"
import ConversationList from "./ConversationList.vue"
import ChatWindow from "./ChatWindow.vue"
import DetailsPanel from "./DetailsPanel.vue"

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const mobileView = ref<"list" | "chat">("list")
const showDetails = ref(false)

function onSelectConversation(id: string) {
  selectConversation(id)
  mobileView.value = "chat"
  showDetails.value = false
}

async function handleStartChat() {
  const newConv = await startDirectChatForAttendance()
  if (newConv) {
    onSelectConversation(newConv.id)
  }
}
</script>

<template>
  <!-- Backdrop -->
  <transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
      @click="emit('close')"
    />
  </transition>

  <!-- Painel deslizante -->
  <transition
    enter-active-class="transition-transform duration-300 ease-out"
    leave-active-class="transition-transform duration-300 ease-in"
    enter-from-class="translate-x-full"
    leave-to-class="translate-x-full"
  >
    <aside
      v-if="open"
      class="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col bg-background shadow-2xl"
      aria-label="Chat interno corporativo"
    >
      <!-- Cabeçalho do painel -->
      <header
        class="flex items-center gap-3 border-b px-4 py-3 text-primary-foreground"
        style="background-color: var(--color-primary)"
      >
        <MessagesSquare :size="20" />
        <div class="min-w-0 flex-1">
          <h2 class="truncate font-semibold leading-tight">Chat Interno de RH</h2>
          <p class="truncate text-xs text-primary-foreground/70">
            Comunicação corporativa direta
            <span v-if="totalUnread"> · {{ totalUnread }} não lidas</span>
          </p>
        </div>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
          aria-label="Recolher central de atendimento"
          @click="emit('close')"
        >
          <Minus :size="20" />
        </button>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
          aria-label="Fechar central de atendimento"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Conteúdo do chat -->
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- Lista de conversas -->
        <div
          class="w-full shrink-0 border-r md:w-72 lg:w-80"
          :class="mobileView === 'chat' ? 'hidden md:block' : 'block'"
        >
          <ConversationList
            :active-id="activeId"
            @select="onSelectConversation"
          />
        </div>

        <!-- Janela de chat -->
        <div
          class="min-w-0 flex-1"
          :class="mobileView === 'list' ? 'hidden md:block' : 'block'"
        >
          <ChatWindow
            v-if="activeConversation"
            :conversation="activeConversation"
            show-info-button
            @back="mobileView = 'list'"
            @toggle-info="showDetails = true"
          />
          <div v-else class="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessagesSquare :size="48" class="mb-3 opacity-40 text-primary" />
            <p class="font-medium text-foreground text-base">Nenhum atendimento em andamento</p>
            <p class="mt-1 text-sm max-w-sm">
              Inicie um chat interno diretamente para que a equipe de RH possa realizar o atendimento do colaborador.
            </p>
            <button
              type="button"
              class="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95 flex items-center gap-2 cursor-pointer"
              style="background-color: var(--color-primary)"
              @click="handleStartChat"
            >
              <PenSquare :size="15" />
              <span>Iniciar Chat para Atendimento</span>
            </button>
          </div>
        </div>

        <!-- Painel de detalhes (fixo em telas grandes) -->
        <div v-if="activeConversation" class="hidden w-72 shrink-0 border-l xl:block">
          <DetailsPanel :conversation="activeConversation" />
        </div>
      </div>

      <!-- Painel de detalhes (drawer em telas menores) -->
      <transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDetails"
          class="absolute inset-0 z-40 bg-foreground/40 xl:hidden"
          @click="showDetails = false"
        />
      </transition>
      <transition
        enter-active-class="transition-transform duration-300 ease-out"
        leave-active-class="transition-transform duration-300 ease-in"
        enter-from-class="translate-x-full"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="showDetails && activeConversation"
          class="absolute inset-y-0 right-0 z-50 w-[85%] max-w-sm border-l shadow-2xl xl:hidden"
        >
          <DetailsPanel :conversation="activeConversation" show-close @close="showDetails = false" />
        </div>
      </transition>
    </aside>
  </transition>
</template>
