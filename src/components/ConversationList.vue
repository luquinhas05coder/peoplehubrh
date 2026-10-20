<script setup lang="ts">
import { computed, ref } from "vue"
import {
  Search,
  SlidersHorizontal,
  PenSquare,
  Check,
  Trash2,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  X,
  MessagesSquare,
} from "lucide-vue-next"
import type { Conversation, Topic } from "../data"
import { topicLabels } from "../data"
import {
  conversations,
  selectConversation,
  totalUnread,
  deleteConversation,
  resolveConversation,
  reopenConversation,
  userRoleType,
  startDirectChatForAttendance,
} from "../store"
import ChannelBadge from "./ChannelBadge.vue"
import UserAvatar from "./UserAvatar.vue"

defineProps<{
  activeId: string
}>()

const emit = defineEmits<{
  (e: "select", id: string): void
}>()

function handleSelect(id: string) {
  selectConversation(id)
  emit("select", id)
}

async function handleStartChat() {
  const newConv = await startDirectChatForAttendance()
  if (newConv) {
    emit("select", newConv.id)
  }
}

const search = ref("")
const showFilters = ref(false)
const activeTopic = ref<Topic | "todos">("todos")

const chatTitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Atendimento & Suporte"
  if (userRoleType.value === "dp") return "Fila de Atendimento DP"
  if (userRoleType.value === "ti") return "Fila de Suporte TI"
  return "Central de Atendimento RH"
})

// Filtro de status: "abertas" (padrão - somem as resolvidas!), "resolvidas", "todas"
const statusTab = ref<"abertas" | "resolvidas" | "todas">("abertas")

// Modal de confirmação de exclusão
const conversationToDelete = ref<Conversation | null>(null)

function promptDelete(conv: Conversation, e: Event) {
  e.stopPropagation()
  conversationToDelete.value = conv
}

function handleConfirmDelete() {
  if (conversationToDelete.value) {
    deleteConversation(conversationToDelete.value.id)
    conversationToDelete.value = null
  }
}

function handleQuickResolve(conv: Conversation, e: Event) {
  e.stopPropagation()
  resolveConversation(conv.id)
}

function handleQuickReopen(conv: Conversation, e: Event) {
  e.stopPropagation()
  reopenConversation(conv.id)
}

const topicFilters: (Topic | "todos")[] = ["todos", "ferias", "folha", "beneficios", "recrutamento", "desligamento", "geral"]

const openCount = computed(() => conversations.value.filter((c) => c.status !== "resolvido").length)
const resolvedCount = computed(() => conversations.value.filter((c) => c.status === "resolvido").length)

const filtered = computed(() =>
  conversations.value.filter((c) => {
    const matchesStatus =
      statusTab.value === "todas"
        ? true
        : statusTab.value === "resolvidas"
        ? c.status === "resolvido"
        : c.status !== "resolvido"
    const matchesTopic = activeTopic.value === "todos" || c.topic === activeTopic.value
    const matchesSearch =
      c.name.toLowerCase().includes(search.value.toLowerCase()) ||
      c.department.toLowerCase().includes(search.value.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.value.toLowerCase())
    return matchesStatus && matchesTopic && matchesSearch
  }),
)

function topicLabelFor(t: Topic | "todos") {
  return t === "todos" ? "Todos os assuntos" : topicLabels[t]
}

const statusStyles: Record<Conversation["status"], { bg: string; text: string; label: string }> = {
  aberto: { bg: "var(--color-primary-soft)", text: "var(--color-primary)", label: "Aberto" },
  pendente: { bg: "var(--color-accent-soft)", text: "var(--color-accent)", label: "Pendente" },
  resolvido: { bg: "var(--color-muted)", text: "var(--color-muted-foreground)", label: "Resolvido" },
}
</script>

<template>
  <div class="flex h-full flex-col bg-card relative">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-2.5 border-b px-4 pb-2.5 pt-3.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <MessagesSquare :size="20" class="text-primary" />
          <h1 class="text-lg font-bold tracking-tight">{{ chatTitle }}</h1>
          <span
            v-if="totalUnread"
            class="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-primary-foreground"
            style="background-color: var(--color-primary)"
          >
            {{ totalUnread }}
          </span>
        </div>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground transition-opacity hover:opacity-90 active:scale-95 cursor-pointer shadow-sm"
          style="background-color: var(--color-primary)"
          aria-label="Iniciar chat de atendimento"
          title="Iniciar chat para atendimento do RH"
          @click="handleStartChat"
        >
          <PenSquare :size="18" />
        </button>
      </div>

      <!-- Abas de Status: Em Aberto (somem as resolvidas) / Resolvidas / Todas -->
      <div class="flex items-center rounded-lg border bg-muted/50 p-1 text-xs">
        <button
          type="button"
          class="flex-1 rounded-md py-1.5 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          :class="statusTab === 'abertas'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'"
          @click="statusTab = 'abertas'"
        >
          <span>Em Aberto</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px]"
            :class="statusTab === 'abertas' ? 'bg-primary/15 text-primary font-bold' : 'bg-muted text-muted-foreground'"
          >
            {{ openCount }}
          </span>
        </button>

        <button
          type="button"
          class="flex-1 rounded-md py-1.5 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          :class="statusTab === 'resolvidas'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'"
          @click="statusTab = 'resolvidas'"
        >
          <span>Resolvidas</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px]"
            :class="statusTab === 'resolvidas' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold' : 'bg-muted text-muted-foreground'"
          >
            {{ resolvedCount }}
          </span>
        </button>

        <button
          type="button"
          class="px-2.5 rounded-md py-1.5 font-semibold transition-all cursor-pointer"
          :class="statusTab === 'todas'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'"
          @click="statusTab = 'todas'"
        >
          Todas
        </button>
      </div>

      <!-- Busca -->
      <div class="relative">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          type="text"
          placeholder="Buscar colaborador ou departamento..."
          class="w-full rounded-lg border bg-background py-2 pl-9 pr-9 text-xs outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2"
          style="--tw-ring-color: var(--color-ring)"
          aria-label="Buscar conversas internas"
        />
        <button
          class="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
          :class="showFilters || activeTopic !== 'todos' ? 'text-primary' : 'text-muted-foreground hover:bg-muted'"
          :style="showFilters || activeTopic !== 'todos' ? { backgroundColor: 'var(--color-primary-soft)' } : {}"
          aria-label="Filtrar por assunto"
          @click="showFilters = !showFilters"
        >
          <SlidersHorizontal :size="14" />
        </button>
      </div>

      <!-- Filtros de assunto (colapsável) -->
      <div v-if="showFilters" class="flex flex-wrap gap-1.5 pt-1 border-t">
        <button
          v-for="t in topicFilters"
          :key="t"
          class="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
          :class="activeTopic === t ? 'border-transparent' : 'text-muted-foreground hover:bg-muted'"
          :style="activeTopic === t
            ? { backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }
            : {}"
          @click="activeTopic = t"
        >
          <Check v-if="activeTopic === t" :size="11" />
          {{ topicLabelFor(t) }}
        </button>
      </div>
    </header>

    <!-- Lista de Conversas Internas -->
    <ul class="flex-1 overflow-y-auto scrollbar-thin" aria-label="Lista de conversas internas">
      <li v-if="!filtered.length" class="px-4 py-12 text-center text-sm text-muted-foreground">
        <div class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
          <CheckCircle2 v-if="statusTab === 'abertas'" :size="20" class="text-emerald-500" />
          <Search v-else :size="20" class="text-muted-foreground" />
        </div>
        <p class="font-medium text-foreground">
          {{ statusTab === 'abertas' ? 'Nenhuma conversa em aberto!' : 'Nenhuma conversa encontrada' }}
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          {{ statusTab === 'abertas' ? 'Todos os atendimentos estão resolvidos. Clique em "Resolvidas" para ver o histórico.' : 'Tente alterar os termos da busca ou filtros.' }}
        </p>
      </li>

      <li v-for="c in filtered" :key="c.id" class="group relative">
        <button
          class="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors cursor-pointer"
          :class="c.id === activeId ? '' : 'hover:bg-muted/60'"
          :style="c.id === activeId ? { backgroundColor: 'var(--color-primary-soft)' } : {}"
          @click="handleSelect(c.id)"
        >
          <div class="relative shrink-0">
            <UserAvatar :initials="c.initials" :online="c.online" :size="44" />
            <span class="absolute -bottom-1 -right-1">
              <ChannelBadge :channel="c.channel" :size="18" show-ring />
            </span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-semibold text-sm" :class="c.unread ? 'text-foreground font-bold' : 'text-foreground/90'">
                {{ c.name }}
              </span>
              <span class="shrink-0 text-[11px]" :style="{ color: c.unread ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }">
                {{ c.time }}
              </span>
            </div>

            <p class="mt-0.5 truncate text-xs" :class="c.unread ? 'font-semibold text-foreground' : 'text-muted-foreground'">
              {{ c.lastMessage }}
            </p>

            <div class="mt-1.5 flex items-center gap-1.5">
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                :style="{ backgroundColor: statusStyles[c.status].bg, color: statusStyles[c.status].text }"
              >
                {{ statusStyles[c.status].label }}
              </span>
              <span class="truncate text-[11px] text-muted-foreground">{{ c.department }}</span>
              <span class="text-muted-foreground/50 text-[10px]">·</span>
              <span class="truncate text-[11px] text-muted-foreground">{{ topicLabels[c.topic] }}</span>
              <span
                v-if="c.unread"
                class="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground animate-pulse"
                style="background-color: var(--color-primary)"
              >
                {{ c.unread }}
              </span>
            </div>
          </div>
        </button>

        <!-- Botões de Ação Rápida no Card (Hover) -->
        <div
          class="absolute right-2 top-2 hidden items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur-sm group-hover:flex"
        >
          <!-- Se aberta: botão de resolver rápido -->
          <button
            v-if="c.status !== 'resolvido'"
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
            title="Resolver atendimento (some da lista aberta)"
            @click="handleQuickResolve(c, $event)"
          >
            <CheckCircle2 :size="15" />
          </button>

          <!-- Se resolvida: botão de reabrir rápido -->
          <button
            v-else
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
            title="Reabrir atendimento"
            @click="handleQuickReopen(c, $event)"
          >
            <RotateCcw :size="14" />
          </button>

          <!-- Botão Excluir Conversa -->
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            title="Excluir conversa permanentemente"
            @click="promptDelete(c, $event)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </li>
    </ul>


    <!-- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO -->
    <div
      v-if="conversationToDelete"
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
              Tem certeza de que deseja excluir permanentemente o chat interno com <strong>{{ conversationToDelete.name }}</strong>? Todas as mensagens serão removidas.
            </p>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground cursor-pointer"
            @click="conversationToDelete = null"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
            @click="conversationToDelete = null"
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
  </div>
</template>
