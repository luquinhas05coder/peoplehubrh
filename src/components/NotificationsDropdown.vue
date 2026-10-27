<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import { Bell, CheckCheck, Clock, Calendar, GitMerge, Award, FileText, CheckCircle2, X } from "lucide-vue-next"
import {
  activeTab,
  systemNotifications as notifications,
  unreadNotificationsCount as unreadCount,
  fetchSystemNotifications,
  markNotificationAsRead as storeMarkAsRead,
  markAllNotificationsAsRead as storeMarkAllAsRead,
} from "../store"

export interface NotificationItem {
  id: string
  title: string
  description: string
  category: string
  priority: "baixa" | "media" | "alta"
  link?: string
  read: boolean
  created_at: string
}

const props = withDefaults(
  defineProps<{
    placement?: "rail" | "header" | "auto"
  }>(),
  {
    placement: "auto",
  }
)

const router = useRouter()
const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const loading = ref(false)

const popoverPositionClass = computed(() => {
  if (props.placement === "rail") {
    return "absolute left-16 top-0 w-80 sm:w-96"
  }
  if (props.placement === "header") {
    return "fixed inset-x-3 top-16 sm:inset-auto sm:right-3 sm:top-14 w-auto sm:w-96"
  }
  return "fixed inset-x-3 top-16 sm:inset-auto sm:right-3 sm:top-14 md:absolute md:inset-auto md:left-16 md:top-0 w-auto md:w-96"
})

async function fetchNotifications(force = false) {
  loading.value = true
  try {
    await fetchSystemNotifications(force)
  } finally {
    loading.value = false
  }
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    fetchNotifications(true)
  }
}

function closeDropdown() {
  isOpen.value = false
}

async function markAsRead(item: NotificationItem) {
  await storeMarkAsRead(item)
  if (item.link) {
    isOpen.value = false
    const cleanPath = item.link.replace(/^\//, "")
    if (cleanPath) {
      activeTab.value = cleanPath
    }
    if (router) {
      router.push(item.link).catch(() => {})
    }
  }
}

async function markAllAsRead() {
  await storeMarkAllAsRead()
}

function getCategoryIcon(cat: string) {
  switch (cat?.toLowerCase()) {
    case "workflow":
      return GitMerge
    case "calendar":
      return Calendar
    case "performance":
      return Award
    case "document":
      return FileText
    default:
      return Clock
  }
}

function handleOutsideClick(e: MouseEvent) {
  if (!isOpen.value) return
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isOpen.value) {
    isOpen.value = false
  }
}

let pollInterval: any = null

onMounted(() => {
  fetchNotifications()
  document.addEventListener("click", handleOutsideClick)
  document.addEventListener("keydown", handleKeydown)
  // Polling suave de fallback apenas se a aba estiver visível (120s)
  pollInterval = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      fetchNotifications()
    }
  }, 120000)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick)
  document.removeEventListener("keydown", handleKeydown)
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div ref="containerRef" class="relative inline-block">
    <button
      type="button"
      class="group relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      :class="{ 'text-foreground bg-muted ring-1 ring-border': isOpen }"
      aria-label="Notificações do Sistema"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click.stop="toggleDropdown"
    >
      <Bell :size="20" aria-hidden="true" />
      <span
        v-if="unreadCount > 0"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white bg-teal-600 animate-pulse pointer-events-none"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
      <span
        class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        :class="{ '!hidden': isOpen }"
      >
        Notificações ({{ unreadCount }})
      </span>
    </button>

    <!-- Painel de Notificações Popover -->
    <div
      v-if="isOpen"
      role="dialog"
      aria-modal="false"
      aria-label="Central de Notificações"
      :class="[
        popoverPositionClass,
        'rounded-2xl bg-card border shadow-2xl z-[70] overflow-hidden flex flex-col max-h-[85dvh] animate-in fade-in zoom-in-95 duration-150'
      ]"
    >
      <!-- Header do Popover -->
      <div class="p-3.5 border-b bg-muted/30 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Bell :size="16" class="text-teal-500" aria-hidden="true" />
          <h3 class="font-bold text-sm text-foreground">Central de Notificações</h3>
          <span
            v-if="unreadCount > 0"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30"
          >
            {{ unreadCount }} nova{{ unreadCount > 1 ? 's' : '' }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="unreadCount > 0"
            type="button"
            @click="markAllAsRead"
            class="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded px-1 py-0.5"
            aria-label="Marcar todas as notificações como lidas"
          >
            <CheckCheck :size="14" aria-hidden="true" />
            <span>Ler todas</span>
          </button>
          <button
            type="button"
            @click="closeDropdown"
            class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Fechar notificações"
          >
            <X :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- Lista de Notificações -->
      <div class="divide-y overflow-y-auto scrollbar-thin flex-1 max-h-[380px]">
        <div
          v-for="item in notifications"
          :key="item.id"
          role="button"
          tabindex="0"
          @click="markAsRead(item)"
          @keydown.enter="markAsRead(item)"
          @keydown.space.prevent="markAsRead(item)"
          class="p-3.5 transition-colors cursor-pointer hover:bg-muted/50 flex items-start gap-3 relative focus:outline-hidden focus-visible:bg-muted/70"
          :class="{ 'bg-teal-500/5': !item.read }"
        >
          <div
            class="p-2 rounded-lg shrink-0 mt-0.5"
            :class="{
              'bg-teal-500/10 text-teal-600 dark:text-teal-400': !item.read,
              'bg-muted text-muted-foreground': item.read,
            }"
          >
            <component :is="getCategoryIcon(item.category)" :size="16" aria-hidden="true" />
          </div>

          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center justify-between gap-1">
              <h4 class="text-xs font-bold text-foreground truncate" :class="{ 'font-black': !item.read }">
                {{ item.title }}
              </h4>
              <span
                v-if="!item.read"
                class="h-2 w-2 rounded-full bg-teal-500 shrink-0"
                title="Não lida"
                aria-label="Não lida"
              ></span>
            </div>
            <p class="text-xs text-muted-foreground line-clamp-2">
              {{ item.description }}
            </p>
            <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
              <span>{{ new Date(item.created_at).toLocaleString('pt-BR') }}</span>
              <span
                v-if="item.priority === 'alta'"
                class="font-bold text-rose-600 uppercase text-[9px]"
              >
                Alta Prioridade
              </span>
            </div>
          </div>
        </div>

        <div v-if="!notifications.length" class="p-8 text-center text-muted-foreground space-y-2">
          <CheckCircle2 :size="32" class="mx-auto text-muted-foreground/40" aria-hidden="true" />
          <p class="text-xs font-medium">Tudo em dia! Nenhuma notificação encontrada.</p>
        </div>
      </div>
    </div>
  </div>
</template>
