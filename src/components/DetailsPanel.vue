<script setup lang="ts">
import { ref } from "vue"
import {
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  UserCog,
  FileText,
  CalendarPlus,
  Tag,
  CheckCircle2,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from "lucide-vue-next"
import type { Conversation, Priority, Topic } from "../data"
import { channelLabels, topicLabels, priorityConfig } from "../data"
import {
  setStatus,
  setPriority,
  setTopic,
  sendMessage,
  resolveConversation,
  reopenConversation,
  deleteConversation,
} from "../store"
import ChannelBadge from "./ChannelBadge.vue"
import UserAvatar from "./UserAvatar.vue"

const props = defineProps<{
  conversation: Conversation
  showClose?: boolean
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const showTopicSelect = ref(false)
const toastText = ref<string | null>(null)
const showDeleteConfirm = ref(false)

function triggerToast(msg: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = null
  }, 2500)
}

function handleAction(type: string) {
  if (type === "resolve") {
    resolveConversation(props.conversation.id)
    triggerToast("Atendimento resolvido e arquivado com sucesso!")
  } else if (type === "reopen") {
    reopenConversation(props.conversation.id)
    triggerToast("Atendimento reaberto com sucesso!")
  } else if (type === "delete") {
    showDeleteConfirm.value = true
  } else if (type === "meeting") {
    sendMessage(props.conversation.id, "Agendei uma reunião com a equipe de RH para conversarmos melhor. Enviando convite...")
    triggerToast("Convite de reunião enviado na conversa!")
  } else if (type === "document") {
    sendMessage(props.conversation.id, "Documento gerado com sucesso! Você pode baixar sua declaração diretamente aqui no chat.")
    triggerToast("Declaração gerada e enviada!")
  } else if (type === "topic") {
    showTopicSelect.value = !showTopicSelect.value
  }
}

function handleConfirmDelete() {
  deleteConversation(props.conversation.id)
  showDeleteConfirm.value = false
  emit("close")
}

function changePriority(p: Priority) {
  setPriority(props.conversation.id, p)
  triggerToast(`Prioridade alterada para ${priorityConfig[p].label}`)
}

function changeTopic(t: Topic) {
  setTopic(props.conversation.id, t)
  showTopicSelect.value = false
  triggerToast(`Assunto alterado para ${topicLabels[t]}`)
}

const statusOptions: { value: "aberto" | "pendente" | "resolvido"; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "pendente", label: "Pendente" },
  { value: "resolvido", label: "Resolvido" },
]
</script>

<template>
  <aside class="flex h-full flex-col bg-card relative" aria-label="Detalhes do colaborador">
    <!-- Toast local -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="toastText"
        class="absolute top-3 left-1/2 z-50 -translate-x-1/2 w-[90%] rounded-lg bg-foreground px-3 py-1.5 text-center text-xs font-medium text-background shadow-lg"
      >
        {{ toastText }}
      </div>
    </transition>

    <header class="flex items-center justify-between border-b px-4 py-3">
      <h3 class="font-semibold">Detalhes</h3>
      <button
        v-if="showClose"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
        aria-label="Fechar detalhes"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto scrollbar-thin">
      <!-- Perfil -->
      <div class="flex flex-col items-center gap-2 border-b px-4 py-6 text-center">
        <div class="relative">
          <UserAvatar :initials="conversation.initials" :online="conversation.online" :size="72" />
          <span class="absolute bottom-0 right-0">
            <ChannelBadge :channel="conversation.channel" :size="24" show-ring />
          </span>
        </div>
        <div>
          <p class="text-lg font-semibold">{{ conversation.name }}</p>
          <p class="text-sm text-muted-foreground">{{ conversation.role }}</p>
        </div>
        <span
          class="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style="background-color: var(--color-primary-soft); color: var(--color-primary)"
        >
          {{ conversation.department }}
        </span>
      </div>

      <!-- Contato -->
      <div class="border-b px-4 py-4">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contato</p>
        <ul class="space-y-3 text-sm">
          <li class="flex items-center gap-3">
            <Mail :size="16" class="text-muted-foreground shrink-0" />
            <span class="truncate">{{ conversation.contact.email }}</span>
          </li>
          <li class="flex items-center gap-3">
            <Phone :size="16" class="text-muted-foreground shrink-0" />
            <span>{{ conversation.contact.phone }}</span>
          </li>
          <li class="flex items-center gap-3">
            <MapPin :size="16" class="text-muted-foreground shrink-0" />
            <span>{{ conversation.contact.location }}</span>
          </li>
        </ul>
      </div>

      <!-- Dados do vínculo -->
      <div class="border-b px-4 py-4">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vínculo</p>
        <ul class="space-y-3 text-sm">
          <li class="flex items-center gap-3">
            <Briefcase :size="16" class="text-muted-foreground shrink-0" />
            <span>{{ conversation.department }}</span>
          </li>
          <li class="flex items-center gap-3">
            <Clock :size="16" class="text-muted-foreground shrink-0" />
            <span>{{ conversation.contact.tenure }}</span>
          </li>
          <li class="flex items-center gap-3">
            <UserCog :size="16" class="text-muted-foreground shrink-0" />
            <span>Gestor: {{ conversation.contact.manager }}</span>
          </li>
        </ul>
      </div>

      <!-- Contexto do atendimento -->
      <div class="border-b px-4 py-4">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atendimento</p>
        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Status</span>
            <select
              :value="conversation.status"
              class="rounded-md border bg-background px-2 py-1 text-xs font-semibold outline-none cursor-pointer"
              @change="(e) => {
                const val = (e.target as HTMLSelectElement).value as any
                if (val === 'resolvido') {
                  resolveConversation(conversation.id)
                } else {
                  setStatus(conversation.id, val)
                }
              }"
            >
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Prioridade</span>
            <div class="flex gap-1">
              <button
                v-for="(meta, key) in priorityConfig"
                :key="key"
                class="rounded px-2 py-0.5 text-[11px] font-semibold transition-transform active:scale-95 cursor-pointer"
                :style="conversation.priority === key
                  ? { backgroundColor: meta.color, color: '#fff' }
                  : { backgroundColor: meta.soft, color: meta.color }"
                @click="changePriority(key as Priority)"
              >
                {{ meta.short }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Canal</span>
            <span class="flex items-center gap-1.5 font-medium">
              <ChannelBadge :channel="conversation.channel" :size="16" />
              {{ channelLabels[conversation.channel] }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Assunto</span>
            <span class="font-medium">{{ topicLabels[conversation.topic] }}</span>
          </div>

          <div v-if="showTopicSelect" class="rounded-lg border bg-background p-2 grid grid-cols-2 gap-1 text-xs">
            <button
              v-for="(lbl, t) in topicLabels"
              :key="t"
              class="rounded p-1 text-left hover:bg-muted font-medium cursor-pointer"
              @click="changeTopic(t as Topic)"
            >
              {{ lbl }}
            </button>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Responsável</span>
            <span class="font-medium">{{ conversation.assignedTo }}</span>
          </div>
        </div>
      </div>

      <!-- Ações Rápidas -->
      <div class="px-4 py-4">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações rápidas</p>
        <div class="grid grid-cols-2 gap-2">
          <!-- RESOLVER OU REABRIR ATENDIMENTO -->
          <button
            v-if="conversation.status !== 'resolvido'"
            class="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 transition-all hover:bg-emerald-100 active:scale-95 cursor-pointer"
            title="Finalizar atendimento e sumir da lista aberta"
            @click="handleAction('resolve')"
          >
            <CheckCircle2 :size="18" class="text-emerald-600" />
            Resolver
          </button>

          <button
            v-else
            class="flex flex-col items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-center text-xs font-semibold text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300 transition-all hover:bg-sky-100 active:scale-95 cursor-pointer"
            title="Reabrir este atendimento"
            @click="handleAction('reopen')"
          >
            <RotateCcw :size="18" class="text-sky-600" />
            Reabrir
          </button>

          <!-- EXCLUIR CONVERSA -->
          <button
            class="flex flex-col items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-center text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 transition-all hover:bg-rose-100 active:scale-95 cursor-pointer"
            title="Excluir permanentemente"
            @click="handleAction('delete')"
          >
            <Trash2 :size="18" class="text-rose-600" />
            Excluir
          </button>

          <button
            class="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium text-foreground/80 transition-all hover:bg-muted active:scale-95 cursor-pointer"
            @click="handleAction('meeting')"
          >
            <CalendarPlus :size="18" style="color: var(--color-primary)" />
            Agendar reunião
          </button>

          <button
            class="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium text-foreground/80 transition-all hover:bg-muted active:scale-95 cursor-pointer"
            @click="handleAction('document')"
          >
            <FileText :size="18" style="color: var(--color-primary)" />
            Gerar documento
          </button>

          <button
            class="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium text-foreground/80 transition-all hover:bg-muted active:scale-95 cursor-pointer col-span-2"
            @click="handleAction('topic')"
          >
            <Tag :size="18" style="color: var(--color-primary)" />
            Alterar assunto
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO -->
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
              Tem certeza de que deseja excluir permanentemente o atendimento com <strong>{{ conversation.name }}</strong>? Todas as mensagens serão removidas.
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
  </aside>
</template>
