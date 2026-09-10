<script setup lang="ts">
import { nextTick, ref, watch, onMounted } from "vue"
import {
  ArrowLeft,
  Phone,
  Paperclip,
  Smile,
  Send,
  CheckCheck,
  Check,
  Info,
  Sparkles,
  CheckCircle2,
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
} from "lucide-vue-next"
import type { Conversation } from "../data"
import { topicLabels } from "../data"
import {
  sendMessage,
  markAsRead,
  resolveConversation,
  reopenConversation,
  deleteConversation,
} from "../store"
import ChannelBadge from "./ChannelBadge.vue"
import UserAvatar from "./UserAvatar.vue"

const props = defineProps<{
  conversation: Conversation
  showInfoButton?: boolean
}>()

const emit = defineEmits<{
  (e: "back"): void
  (e: "toggle-info"): void
}>()

const draft = ref("")
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const toastMessage = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const quickReplies = [
  "Vou verificar e retorno em instantes.",
  "Sua solicitação foi encaminhada para aprovação.",
  "Poderia enviar o documento, por favor?",
]

watch(
  () => props.conversation.id,
  (id) => {
    markAsRead(id)
    scrollToBottom()
  },
  { immediate: true },
)

watch(
  () => props.conversation.messages.length,
  () => {
    scrollToBottom()
  },
)

onMounted(() => {
  markAsRead(props.conversation.id)
  scrollToBottom()
})

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

function handleSend() {
  const text = draft.value.trim()
  if (!text) return
  sendMessage(props.conversation.id, text)
  draft.value = ""
  scrollToBottom()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    if ((e as any).isComposing || (e as KeyboardEvent).keyCode === 229) return
    e.preventDefault()
    handleSend()
  }
}

function useQuickReply(text: string) {
  draft.value = text
}

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = null
  }, 2500)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    sendMessage(props.conversation.id, `📎 Anexo: ${file.name}`)
    showToast(`Arquivo "${file.name}" anexado e enviado.`)
    input.value = ""
  }
}

function addEmoji(emoji: string) {
  draft.value += emoji
}

function handleResolve() {
  resolveConversation(props.conversation.id)
}

function handleReopen() {
  reopenConversation(props.conversation.id)
}

function handleConfirmDelete() {
  deleteConversation(props.conversation.id)
  showDeleteConfirm.value = false
  emit("back")
}
</script>

<template>
  <section class="flex h-full flex-col bg-background relative" aria-label="Conversa">
    <!-- Toast Feedback -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="toastMessage"
        class="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background shadow-lg"
      >
        {{ toastMessage }}
      </div>
    </transition>

    <!-- Cabeçalho -->
    <header class="flex items-center gap-3 border-b bg-card px-3 py-2.5 sm:px-4">
      <button
        class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted md:hidden"
        aria-label="Voltar para a lista"
        @click="emit('back')"
      >
        <ArrowLeft :size="20" />
      </button>

      <div class="relative">
        <UserAvatar :initials="conversation.initials" :online="conversation.online" :size="42" />
        <span class="absolute -bottom-1 -right-1">
          <ChannelBadge :channel="conversation.channel" :size="18" show-ring />
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h2 class="truncate font-semibold leading-tight">{{ conversation.name }}</h2>
          <span
            v-if="conversation.status === 'resolvido'"
            class="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider"
          >
            Resolvido
          </span>
        </div>
        <p class="truncate text-xs text-muted-foreground">
          {{ conversation.role }} ·
          <span :style="{ color: conversation.online ? 'var(--color-success)' : undefined }">
            {{ conversation.online ? "Online agora" : "Offline" }}
          </span>
          · {{ conversation.department }} · Chat Interno
        </p>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- BOTÃO RESOLVER (Se não estiver resolvida, fecha e arquiva/faz sumir) -->
        <button
          v-if="conversation.status !== 'resolvido'"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          title="Marcar conversa como resolvida (ela sumirá da lista aberta)"
          @click="handleResolve"
        >
          <CheckCircle2 :size="14" />
          <span class="hidden sm:inline">Resolver</span>
        </button>

        <!-- BOTÃO REABRIR (Se estiver resolvida) -->
        <button
          v-else
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          title="Reabrir este atendimento"
          @click="handleReopen"
        >
          <RotateCcw :size="14" />
          <span class="hidden sm:inline">Reabrir</span>
        </button>

        <!-- BOTÃO EXCLUIR CONVERSA -->
        <button
          type="button"
          class="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 px-2.5 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          title="Excluir esta conversa permanentemente"
          @click="showDeleteConfirm = true"
        >
          <Trash2 :size="14" />
          <span class="hidden md:inline">Excluir</span>
        </button>

        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
          aria-label="Ligar"
          title="Iniciar chamada"
          @click="showToast('Iniciando chamada com colaborador...')"
        >
          <Phone :size="18" />
        </button>

        <button
          v-if="showInfoButton"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted xl:hidden cursor-pointer"
          aria-label="Detalhes do colaborador"
          @click="emit('toggle-info')"
        >
          <Info :size="18" />
        </button>
      </div>
    </header>

    <!-- Faixa de assunto -->
    <div class="flex items-center gap-2 border-b bg-card/60 px-4 py-1.5">
      <span class="text-xs text-muted-foreground">Assunto:</span>
      <span
        class="rounded-full px-2 py-0.5 text-xs font-medium"
        style="background-color: var(--color-accent-soft); color: var(--color-accent)"
      >
        {{ topicLabels[conversation.topic] }}
      </span>
      <span class="ml-auto text-xs text-muted-foreground">Atribuído a: {{ conversation.assignedTo }}</span>
    </div>

    <!-- BANNER QUANDO A CONVERSA ESTÁ RESOLVIDA -->
    <div
      v-if="conversation.status === 'resolvido'"
      class="flex items-center justify-between gap-2 border-b bg-emerald-500/10 px-4 py-2 text-xs text-emerald-900 dark:text-emerald-200"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 :size="16" class="text-emerald-600 shrink-0" />
        <span>Este atendimento foi resolvido e arquivado.</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="font-bold underline hover:no-underline cursor-pointer"
          @click="handleReopen"
        >
          Reabrir
        </button>
        <button
          type="button"
          class="text-rose-600 hover:text-rose-700 font-bold underline hover:no-underline cursor-pointer ml-2"
          @click="showDeleteConfirm = true"
        >
          Excluir
        </button>
      </div>
    </div>

    <!-- Mensagens -->
    <div ref="scroller" class="flex-1 space-y-3 overflow-y-auto scrollbar-thin px-3 py-4 sm:px-6">
      <div class="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        {{ conversation.status === 'resolvido' ? 'Atendimento finalizado' : 'Atendimento ativo' }}
      </div>

      <div
        v-for="m in conversation.messages"
        :key="m.id"
        class="flex"
        :class="m.direction === 'out' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%]"
          :class="m.direction === 'out'
            ? 'rounded-br-sm text-primary-foreground'
            : 'rounded-bl-sm border bg-card text-card-foreground'"
          :style="m.direction === 'out' ? { backgroundColor: 'var(--color-primary)' } : {}"
        >
          <p class="whitespace-pre-wrap leading-relaxed">{{ m.text }}</p>
          <div
            class="mt-1 flex items-center justify-end gap-1 text-[10px]"
            :class="m.direction === 'out' ? 'text-primary-foreground/70' : 'text-muted-foreground'"
          >
            <span>{{ m.time }}</span>
            <CheckCheck v-if="m.direction === 'out' && m.status === 'lido'" :size="13" />
            <Check v-else-if="m.direction === 'out'" :size="13" />
          </div>
        </div>
      </div>
    </div>

    <!-- Respostas rápidas -->
    <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-thin border-t bg-card px-3 py-2 sm:px-4">
      <span class="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
        <Sparkles :size="13" style="color: var(--color-accent)" /> Rápidas:
      </span>
      <button
        v-for="(q, i) in quickReplies"
        :key="i"
        class="shrink-0 rounded-full border px-3 py-1 text-xs text-foreground/80 transition-colors hover:bg-muted active:scale-95 cursor-pointer"
        @click="useQuickReply(q)"
      >
        {{ q }}
      </button>
    </div>

    <!-- Composer -->
    <footer class="border-t bg-card px-3 py-3 sm:px-4">
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        @change="handleFileSelect"
      />
      <div class="flex items-end gap-2">
        <button
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
          aria-label="Anexar arquivo"
          title="Anexar arquivo"
          @click="fileInput?.click()"
        >
          <Paperclip :size="20" />
        </button>

        <div class="flex flex-1 items-end rounded-xl border bg-background px-2 focus-within:ring-2" style="--tw-ring-color: var(--color-ring)">
          <textarea
            v-model="draft"
            rows="1"
            placeholder="Digite uma mensagem..."
            class="max-h-32 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Mensagem"
            @keydown="onKeydown"
          />
          <div class="relative group">
            <button
              class="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
              aria-label="Emoji"
            >
              <Smile :size="19" />
            </button>
            <div class="absolute bottom-10 right-0 hidden group-hover:flex gap-1 rounded-lg border bg-card p-1.5 shadow-lg">
              <button
                v-for="e in ['👍', '😊', '🙏', '👏', '✅']"
                :key="e"
                type="button"
                class="hover:bg-muted p-1 rounded cursor-pointer"
                @click="addEmoji(e)"
              >
                {{ e }}
              </button>
            </div>
          </div>
        </div>

        <button
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
          style="background-color: var(--color-primary)"
          aria-label="Enviar mensagem"
          :disabled="!draft.trim()"
          @click="handleSend"
        >
          <Send :size="19" />
        </button>
      </div>
    </footer>

    <!-- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DA CONVERSA -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl border space-y-4 animate-in fade-in zoom-in duration-150">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <AlertTriangle :size="20" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm text-foreground">Excluir conversa?</h3>
            <p class="text-xs text-muted-foreground mt-1">
              Tem certeza de que deseja excluir permanentemente o atendimento com <strong>{{ conversation.name }}</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground cursor-pointer"
            @click="showDeleteConfirm = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
            @click="showDeleteConfirm = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow cursor-pointer transition-all"
            @click="handleConfirmDelete"
          >
            <Trash2 :size="14" />
            Excluir Conversa
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
