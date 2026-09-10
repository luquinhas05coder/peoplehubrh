<script setup lang="ts">
import {
  MessagesSquare,
  Users,
  CalendarCheck,
  BarChart3,
  GraduationCap,
  FileText,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Inbox,
} from "lucide-vue-next"
import { conversations, totalUnread, activeTab, currentUser, userPermissions, userRoleType } from "../store"
import { computed, ref, onMounted, watch } from "vue"
import { useRouter, useRoute } from "vue-router"
import EmployeesModule from "./EmployeesModule.vue"
import RequestsModule from "./RequestsModule.vue"
import DocumentsModule from "./DocumentsModule.vue"
import ReportsModule from "./ReportsModule.vue"
import OnboardingModule from "./OnboardingModule.vue"

const emit = defineEmits<{
  (e: "open-chat"): void
}>()

const toastText = ref<string | null>(null)

function showToast(msg: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = null
  }, 2500)
}

const openCount = computed(
  () => conversations.value.filter((c) => c.status === "aberto").length,
)
const pendingCount = computed(
  () => conversations.value.filter((c) => c.status === "pendente").length,
)
const resolvedCount = computed(
  () => conversations.value.filter((c) => c.status === "resolvido").length,
)

const stats = computed(() => [
  { label: "Não lidas", value: totalUnread.value, icon: Inbox, color: "var(--color-accent)" },
  { label: "Em aberto", value: openCount.value, icon: Clock, color: "var(--color-primary)" },
  { label: "Pendentes", value: pendingCount.value, icon: MessagesSquare, color: "var(--color-instagram)" },
  { label: "Resolvidas", value: resolvedCount.value, icon: CheckCircle2, color: "var(--color-success)" },
])

const modules = [
  {
    key: "chat",
    title: "Chat Interno",
    desc: "Comunicação corporativa direta e instantânea com colaboradores e equipes.",
    icon: MessagesSquare,
    color: "var(--color-primary)",
    active: true,
  },
  {
    key: "people",
    title: "Colaboradores",
    desc: "Ferramenta de criação e gestão de pastas com os dados e documentos de cada colaborador.",
    icon: Users,
    color: "var(--color-telegram)",
    active: true,
  },
  {
    key: "requests",
    title: "Solicitações",
    desc: "Férias, benefícios e folha em um fluxo de aprovação organizado.",
    icon: CalendarCheck,
    color: "var(--color-instagram)",
    active: true,
  },
  {
    key: "reports",
    title: "Relatórios",
    desc: "Indicadores de atendimento, SLA e satisfação da equipe.",
    icon: BarChart3,
    color: "var(--color-accent)",
    active: true,
  },
  {
    key: "onboarding",
    title: "Onboarding",
    desc: "Trilhas de integração e checklists para novos colaboradores.",
    icon: GraduationCap,
    color: "var(--color-success)",
    active: true,
  },
  {
    key: "docs",
    title: "Documentos",
    desc: "Declarações, contratos e modelos gerados automaticamente.",
    icon: FileText,
    color: "var(--color-email)",
    active: true,
  },
]

const router = useRouter()
const route = useRoute()

onMounted(() => {
  if (route?.meta?.tab) {
    activeTab.value = route.meta.tab as string
  }
})

watch(() => route.path, () => {
  if (route?.meta?.tab) {
    activeTab.value = route.meta.tab as string
  }
})

function onModuleClick(mod: typeof modules[0]) {
  if (mod.key === "chat") {
    emit("open-chat")
  } else {
    activeTab.value = mod.key
    const routeMap: Record<string, string> = {
      home: "/home",
      people: "/colaboradores",
      requests: "/solicitacoes",
      docs: "/documentos",
      reports: "/relatorios",
      onboarding: "/onboarding",
    }
    if (routeMap[mod.key] && router) {
      router.push(routeMap[mod.key])
    }
    if (mod.key !== "people" && mod.key !== "requests" && mod.key !== "docs" && mod.key !== "reports" && mod.key !== "onboarding") {
      showToast(`Módulo "${mod.title}" selecionado`)
    }
  }
}

const roleHeaderInfo = computed(() => {
  const role = userRoleType.value
  switch (role) {
    case "dp":
      return {
        badge: "Departamento Pessoal",
        badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        title: "Painel de Departamento Pessoal & Folha",
        subtitle: "Controle de folha de pagamento, espelho de ponto, férias e relações trabalhistas (CLT/eSocial).",
      }
    case "ti":
      return {
        badge: "T.I. & Segurança",
        badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
        title: "Painel de Tecnologia & Infraestrutura",
        subtitle: "Gestão de acessos, provisionamento de equipamentos no onboarding, conformidade LGPD e backups.",
      }
    case "colaborador":
      return {
        badge: "Portal do Colaborador",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        title: "Portal do Colaborador — Autoatendimento",
        subtitle: "Consulte seus holerites, bata ponto, solicite férias, participe de treinamentos e contate o RH.",
      }
    default:
      return {
        badge: "Recursos Humanos",
        badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
        title: "Plataforma de RH — PeopleHub",
        subtitle: "Gestão do clima, DHO, trilhas de capacitação corporativa e comunicação interna.",
      }
  }
})

const visibleModules = computed(() => {
  return modules.filter((m) => {
    if (m.key === "people") return userPermissions.value.canManagePeople
    if (m.key === "reports") return userPermissions.value.canViewReports
    return true
  })
})
</script>

<template>
  <!-- Módulos Específicos -->
  <EmployeesModule v-if="activeTab === 'people'" />
  <RequestsModule v-else-if="activeTab === 'requests'" />
  <DocumentsModule v-else-if="activeTab === 'docs'" />
  <ReportsModule v-else-if="activeTab === 'reports'" />
  <OnboardingModule v-else-if="activeTab === 'onboarding'" />

  <!-- Workspace Padrão / Dashboard Inicial -->
  <main v-else class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative">
    <!-- Toast local -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="toastText"
        class="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-xl"
      >
        {{ toastText }}
      </div>
    </transition>

    <!-- Cabeçalho -->
    <header class="border-b bg-card px-5 py-5 sm:px-8">
      <div class="flex items-center gap-2">
        <p class="text-sm text-muted-foreground">Olá, <strong>{{ currentUser?.name || 'Usuário' }}</strong> 👋</p>
        <span
          class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shadow-2xs"
          :class="roleHeaderInfo.badgeClass"
        >
          {{ roleHeaderInfo.badge }}
        </span>
      </div>
      <h1 class="mt-0.5 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
        {{ roleHeaderInfo.title }}
      </h1>
      <p class="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">
        {{ roleHeaderInfo.subtitle }}
      </p>
    </header>

    <div class="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
      <!-- Visão do Módulo Ativo (para outros módulos genéricos) -->
      <section v-if="activeTab !== 'home' && activeTab !== 'chat'" class="mb-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold capitalize">Módulo: {{ activeTab }}</h2>
          <button
            class="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            @click="activeTab = 'home'"
          >
            Voltar ao Início
          </button>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          Gestão centralizada de {{ activeTab }} com relatórios e indicadores sincronizados com a central de atendimento omnichannel.
        </p>
        <div class="mt-4 flex gap-3">
          <button
            class="flex items-center gap-2 rounded-xl py-2 px-4 text-sm font-semibold text-primary-foreground shadow"
            style="background-color: var(--color-primary)"
            @click="emit('open-chat')"
          >
            <MessagesSquare :size="18" /> Ver Atendimentos do Módulo
          </button>
        </div>
      </section>

      <!-- Indicadores -->
      <section aria-label="Indicadores de atendimento">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div
            v-for="s in stats"
            :key="s.label"
            class="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:shadow-sm"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              :style="{ backgroundColor: s.color + '1a', color: s.color }"
            >
              <component :is="s.icon" :size="20" />
            </span>
            <div class="min-w-0">
              <p class="text-2xl font-bold leading-none">{{ s.value }}</p>
              <p class="mt-1 truncate text-xs text-muted-foreground">{{ s.label }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Módulos -->
      <section class="mt-8" aria-label="Módulos da plataforma">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Módulos</h2>
          <button
            class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            @click="showToast('Adição de novos módulos personalizada disponível no plano Enterprise.')"
          >
            <Plus :size="16" /> Novo módulo
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="m in visibleModules"
            :key="m.key"
            class="group flex flex-col items-start rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            :class="activeTab === m.key || (m.key === 'chat' && activeTab === 'home') ? 'ring-2' : ''"
            :style="activeTab === m.key || (m.key === 'chat' && activeTab === 'home') ? { '--tw-ring-color': m.color } : {}"
            :aria-label="m.title"
            @click="onModuleClick(m)"
          >
            <div class="flex w-full items-start justify-between">
              <span
                class="flex h-11 w-11 items-center justify-center rounded-xl"
                :style="{ backgroundColor: m.color + '1a', color: m.color }"
              >
                <component :is="m.icon" :size="22" />
              </span>
              <span
                v-if="m.key === 'chat' && totalUnread"
                class="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold text-accent-foreground animate-pulse"
                style="background-color: var(--color-accent)"
              >
                {{ totalUnread }}
              </span>
              <span
                v-else-if="!m.active"
                class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Em breve
              </span>
            </div>

            <h3 class="mt-4 font-semibold">{{ m.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ m.desc }}</p>

            <span
              class="mt-4 flex items-center gap-1 text-sm font-medium"
              :style="{ color: m.color }"
            >
              {{ m.key === 'chat' ? 'Abrir atendimento' : 'Acessar módulo' }}
              <ArrowRight :size="15" class="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
