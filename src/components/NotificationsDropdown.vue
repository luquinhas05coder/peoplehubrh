<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import { Bell, CheckCheck, Clock, Calendar, GitMerge, Award, FileText, CheckCircle2 } from "lucide-vue-next"
import { apiFetch, showToast } from "../store"

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

const router = useRouter()
const isOpen = ref(false)
const notifications = ref<NotificationItem[]>([])
const unreadCount = ref(0)

async function fetchNotifications() {
  try {
    const res = await apiFetch("/api/notifications")
    const data = await res.json()
    if (data.ok && Array.isArray(data.notifications)) {
      notifications.value = data.notifications
      unreadCount.value = data.unreadCount || 0
    }
  } catch (_e) {}
}

async function markAsRead(item: NotificationItem) {
  if (!item.read) {
    try {
      await apiFetch(`/api/notifications/${item.id}/read`, { method: "PATCH" })
      item.read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (_e) {}
  }
  if (item.link) {
    isOpen.value = false
    router.push(item.link)
  }
}

async function markAllAsRead() {
  try {
    await apiFetch("/api/notifications/read-all", { method: "PATCH" })
    notifications.value.forEach((n) => (n.read = true))
    unreadCount.value = 0
    showToast("Todas as notificações foram marcadas como lidas.", "success")
  } catch (_e) {}
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
  const el = document.getElementById("notifications-dropdown-container")
  if (el && !el.contains(e.target as Node)) {
    isOpen.value = false
  }
}

let pollInterval: any = null

onMounted(() => {
  fetchNotifications()
  document.addEventListener("click", handleOutsideClick)
  pollInterval = setInterval(fetchNotifications, 30000)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick)
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div id="notifications-dropdown-container" class="relative">
    <button
      class="group relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground cursor-pointer"
      :class="{ 'text-foreground bg-muted': isOpen }"
      aria-label="Notificações do Sistema"
      @click="isOpen = !isOpen"
    >
      <Bell :size="20" />
      <span
        v-if="unreadCount > 0"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white bg-teal-600 animate-pulse"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
      <span
        class="pointer-events-none absolute left-14 z-[60] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        Notificações ({{ unreadCount }})
      </span>
    </button>

    <!-- Painel de Notificações Popover -->
    <div
      v-if="isOpen"
      class="absolute left-16 bottom-0 sm:bottom-auto sm:top-0 w-80 sm:w-96 rounded-2xl bg-card border shadow-2xl z-[70] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header do Popover -->
      <div class="p-3.5 border-b bg-muted/30 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Bell :size="16" class="text-teal-500" />
          <h3 class="font-bold text-sm text-foreground">Central de Notificações</h3>
          <span
            v-if="unreadCount > 0"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30"
          >
            {{ unreadCount }} nova{{ unreadCount > 1 ? 's' : '' }}
          </span>
        </div>

        <button
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
        >
          <CheckCheck :size="14" />
          Ler todas
        </button>
      </div>

      <!-- Lista de Notificações -->
      <div class="divide-y overflow-y-auto flex-1 max-h-[380px]">
        <div
          v-for="item in notifications"
          :key="item.id"
          @click="markAsRead(item)"
          class="p-3.5 transition-colors cursor-pointer hover:bg-muted/50 flex items-start gap-3 relative"
          :class="{ 'bg-teal-500/5': !item.read }"
        >
          <div
            class="p-2 rounded-lg shrink-0 mt-0.5"
            :class="{
              'bg-teal-500/10 text-teal-600 dark:text-teal-400': !item.read,
              'bg-muted text-muted-foreground': item.read,
            }"
          >
            <component :is="getCategoryIcon(item.category)" :size="16" />
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
          <CheckCircle2 :size="32" class="mx-auto text-muted-foreground/40" />
          <p class="text-xs font-medium">Tudo em dia! Nenhuma notificação encontrada.</p>
        </div>
      </div>
    </div>
  </div>
</template>
