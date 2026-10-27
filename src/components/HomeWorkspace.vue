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
  LayoutDashboard,
  Shield,
  Sparkles,
  ShieldAlert,
  Briefcase,
  GitMerge,
  Calendar as CalendarIcon,
  Award,
  UserCheck,
} from "lucide-vue-next"
import { totalUnread, activeTab, currentUser, activeUserRole, hasPermission, showToast } from "../store"
import { computed, onMounted, watch, defineAsyncComponent } from "vue"
import { useRouter, useRoute } from "vue-router"

const EmployeesModule = defineAsyncComponent(() => import("./EmployeesModule.vue"))
const RequestsModule = defineAsyncComponent(() => import("./RequestsModule.vue"))
const DocumentsModule = defineAsyncComponent(() => import("./DocumentsModule.vue"))
const ReportsModule = defineAsyncComponent(() => import("./ReportsModule.vue"))
const OnboardingModule = defineAsyncComponent(() => import("./OnboardingModule.vue"))
const DashboardView = defineAsyncComponent(() => import("./DashboardView.vue"))
const EmployeeProfilePage = defineAsyncComponent(() => import("./EmployeeProfilePage.vue"))
const UsersModule = defineAsyncComponent(() => import("./UsersModule.vue"))
const CorporateFeedModule = defineAsyncComponent(() => import("./CorporateFeedModule.vue"))
const AdverseEventsModule = defineAsyncComponent(() => import("./AdverseEventsModule.vue"))
const WorkflowsModule = defineAsyncComponent(() => import("./WorkflowsModule.vue"))
const CorporateCalendarModule = defineAsyncComponent(() => import("./CorporateCalendarModule.vue"))
const PerformanceModule = defineAsyncComponent(() => import("./PerformanceModule.vue"))
const RecruitmentModule = defineAsyncComponent(() => import("./RecruitmentModule.vue"))
const SelfServicePortal = defineAsyncComponent(() => import("./SelfServicePortal.vue"))

const emit = defineEmits<{
  (e: "open-chat"): void
}>()

const modules = [
  {
    key: "dashboard",
    title: "Dashboard",
    desc: "Visão executiva com indicadores de RH, movimentações e métricas em tempo real.",
    icon: LayoutDashboard,
    color: "var(--color-primary)",
    active: true,
  },
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
    key: "recrutamento",
    title: "Recrutamento & Seleção",
    desc: "Pipeline de candidatos, vagas abertas, agendamento de entrevistas e métricas ATS.",
    icon: Briefcase,
    color: "#a855f7",
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
    key: "workflows",
    title: "Workflows RH",
    desc: "Esteiras de aprovação multinível, admissão, rescisão e mudanças de função.",
    icon: GitMerge,
    color: "#3b82f6",
    active: true,
  },
  {
    key: "calendario",
    title: "Calendário Corporativo",
    desc: "Visão unificada de férias, feriados, treinamentos, entrevistas e marcos da empresa.",
    icon: CalendarIcon,
    color: "#06b6d4",
    active: true,
  },
  {
    key: "desempenho",
    title: "Desempenho & Metas",
    desc: "Ciclos de avaliação de desempenho 360°, autoavaliação, feedbacks e metas/OKRs.",
    icon: Award,
    color: "#f59e0b",
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
  {
    key: "feed",
    title: "Feed Corporativo",
    desc: "Novidades, eventos da empresa, comunicados gerais e anúncios de medidas.",
    icon: Sparkles,
    color: "#8b5cf6",
    active: true,
  },
  {
    key: "adverse_events",
    title: "Ouvidoria & Incidentes",
    desc: "Canal seguro para comunicar eventos adversos, acompanhar investigações e medidas tomadas.",
    icon: ShieldAlert,
    color: "#f43f5e",
    active: true,
  },
]

const router = useRouter()
const route = useRoute()

const isEmployeeProfileRoute = computed(() => {
  return Boolean(route?.path && route.path.startsWith("/funcionarios/"))
})

function syncTabWithRoute() {
  if (route.path.startsWith("/funcionarios/")) {
    activeTab.value = "perfil_funcionario"
  } else if (route.path === "/dashboard") {
    activeTab.value = "dashboard"
  } else if (route.path === "/feed") {
    activeTab.value = "feed"
  } else if (route.path === "/eventos-adversos") {
    activeTab.value = "eventos-adversos"
  } else if (route.path === "/workflows") {
    activeTab.value = "workflows"
  } else if (route.path === "/recrutamento") {
    activeTab.value = "recrutamento"
  } else if (route.path === "/calendario") {
    activeTab.value = "calendario"
  } else if (route.path === "/desempenho") {
    activeTab.value = "desempenho"
  } else if (route.path === "/colaboradores") {
    activeTab.value = "colaboradores"
  } else if (route.path === "/solicitacoes") {
    activeTab.value = "solicitacoes"
  } else if (route.path === "/documentos") {
    activeTab.value = "documentos"
  } else if (route.path === "/relatorios") {
    activeTab.value = "relatorios"
  } else if (route.path === "/onboarding") {
    activeTab.value = "onboarding"
  } else if (route.path === "/autoatendimento") {
    activeTab.value = "autoatendimento"
  } else if (route.path === "/usuarios") {
    activeTab.value = "usuarios"
  } else if (route.meta?.tab) {
    activeTab.value = route.meta.tab as string
  }
}

onMounted(() => {
  syncTabWithRoute()
})

watch(() => route.path, () => {
  syncTabWithRoute()
})

function onModuleClick(mod: typeof modules[0]) {
  if (mod.key === "chat") {
    emit("open-chat")
  } else {
    activeTab.value = mod.key
    const routeMap: Record<string, string> = {
      home: "/home",
      autoatendimento: "/autoatendimento",
      dashboard: "/dashboard",
      people: "/colaboradores",
      recrutamento: "/recrutamento",
      requests: "/solicitacoes",
      workflows: "/workflows",
      calendario: "/calendario",
      desempenho: "/desempenho",
      docs: "/documentos",
      reports: "/relatorios",
      onboarding: "/onboarding",
      users: "/usuarios",
      feed: "/feed",
      adverse_events: "/eventos-adversos",
    }
    if (routeMap[mod.key] && router) {
      router.push(routeMap[mod.key])
    }
  }
}

const roleHeaderInfo = computed(() => {
  const currentRole = activeUserRole.value
  switch (currentRole) {
    case "ADMIN":
      return {
        badge: "Administrador Geral",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        title: "Painel de Administração & Segurança",
        subtitle: "Gestão completa de usuários, controle de permissões (RBAC) e auditoria de eventos.",
      }
    case "RH":
      return {
        badge: "Recursos Humanos",
        badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
        title: "Plataforma de RH — PeopleHub",
        subtitle: "Gestão do clima, pastas de colaboradores, contracheques, férias e comunicados.",
      }
    case "DP":
      return {
        badge: "Departamento Pessoal",
        badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
        title: "Painel de Departamento Pessoal & Rotinas Trabalhistas",
        subtitle: "Gestão burocrática, admissões, rescisões, cálculo da folha, ponto, férias e SST.",
      }
    case "GESTOR":
      return {
        badge: "Gestor de Equipe",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        title: "Painel de Gestão de Equipe",
        subtitle: "Acompanhamento da sua equipe, aprovação de solicitações de férias e escala mensal.",
      }
    case "RECRUTADOR":
      return {
        badge: "Recrutamento & Seleção (ATS)",
        badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
        title: "Painel de Atração & Seleção — ATS",
        subtitle: "Gestão do pipeline de candidatos, publicação de vagas, condução de entrevistas e scorecards.",
      }
    case "AUDITOR":
      return {
        badge: "Auditoria & Compliance",
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
        title: "Painel de Auditoria, Conformidade & Logs",
        subtitle: "Acesso unificado de consulta a registros funcionais, trilhas de auditoria e relatórios analíticos.",
      }
    case "COLABORADOR":
    default:
      return {
        badge: "Portal do Colaborador",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        title: "Portal do Colaborador — Autoatendimento",
        subtitle: "Consulte seus contracheques, espelho de ponto, solicite férias e acompanhe chamados.",
      }
  }
})

const visibleModules = computed(() => {
  const currentRole = activeUserRole.value
  const list = [
    {
      key: "autoatendimento",
      title: "Portal do Colaborador",
      desc: "Autoatendimento, alterações cadastrais, solicitações e documentos pessoais.",
      icon: UserCheck,
      color: "#10b981",
      active: true,
    },
    {
      key: "dashboard",
      title: "Dashboard",
      desc: "Visão executiva com indicadores de RH, movimentações e métricas em tempo real.",
      icon: LayoutDashboard,
      color: "var(--color-primary)",
      active: hasPermission("dashboard.view"),
    },
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
      title: currentRole === "COLABORADOR" ? "Minha Pasta" : "Colaboradores",
      desc: currentRole === "COLABORADOR"
        ? "Consulte seus dados funcionais, documentos e histórico de contracheques."
        : "Ferramenta de criação e gestão de pastas com os dados e documentos de cada colaborador.",
      icon: Users,
      color: "var(--color-telegram)",
      active: hasPermission("employees.view_all") || hasPermission("employees.view_team") || currentRole === "COLABORADOR",
    },
    {
      key: "recrutamento",
      title: "Recrutamento & Seleção",
      desc: "Pipeline de candidatos, publicação de vagas abertas, entrevistas e métricas do ATS.",
      icon: Briefcase,
      color: "#a855f7",
      active: hasPermission("recruitment.view"),
    },
    {
      key: "requests",
      title: "Solicitações",
      desc: "Férias, benefícios e folha em um fluxo de aprovação organizado.",
      icon: CalendarCheck,
      color: "var(--color-instagram)",
      active: hasPermission("requests.view"),
    },
    {
      key: "workflows",
      title: "Workflows RH",
      desc: "Esteiras de aprovação multinível, admissão, rescisão e movimentações com SLA.",
      icon: GitMerge,
      color: "#3b82f6",
      active: hasPermission("workflows.view") && currentRole !== "COLABORADOR",
    },
    {
      key: "calendario",
      title: "Calendário Corporativo",
      desc: "Visão integrada de férias, feriados, treinamentos, entrevistas e eventos da empresa.",
      icon: CalendarIcon,
      color: "#06b6d4",
      active: hasPermission("calendar.view"),
    },
    {
      key: "desempenho",
      title: "Desempenho & Metas",
      desc: "Ciclos de avaliação de desempenho, autoavaliações, feedback 1:1 e metas/OKRs.",
      icon: Award,
      color: "#f59e0b",
      active: hasPermission("performance.view"),
    },
    {
      key: "docs",
      title: "Documentos",
      desc: "Declarações, contratos e modelos gerados automaticamente.",
      icon: FileText,
      color: "var(--color-email)",
      active: hasPermission("documents.view") && currentRole !== "COLABORADOR",
    },
    {
      key: "reports",
      title: "Relatórios",
      desc: "Indicadores de atendimento, SLA, custos e construtor dinâmico.",
      icon: BarChart3,
      color: "var(--color-accent)",
      active: hasPermission("reports.view"),
    },
    {
      key: "onboarding",
      title: "Onboarding",
      desc: "Trilhas de integração e checklists para novos colaboradores.",
      icon: GraduationCap,
      color: "var(--color-success)",
      active: ["ADMIN", "RH", "GESTOR"].includes(currentRole),
    },
    {
      key: "users",
      title: "Gestão de Usuários & RBAC",
      desc: "Controle de acessos baseado em perfis, alteração de funções e auditoria.",
      icon: Shield,
      color: "#f43f5e",
      active: hasPermission("users.view"),
    },
    {
      key: "feed",
      title: "Feed Corporativo",
      desc: "Novidades, eventos da empresa, comunicados gerais e anúncios de medidas.",
      icon: Sparkles,
      color: "#8b5cf6",
      active: true,
    },
    {
      key: "adverse_events",
      title: "Ouvidoria & Incidentes",
      desc: "Canal seguro para comunicar eventos adversos, acompanhar investigações e medidas tomadas.",
      icon: ShieldAlert,
      color: "#f43f5e",
      active: true,
    },
  ]
  return list.filter((m) => m.active)
})

const activeModuleComponent = computed(() => {
  if (activeTab.value === "perfil_funcionario" || isEmployeeProfileRoute.value) return EmployeeProfilePage
  if (activeTab.value === "people" || activeTab.value === "colaboradores") return EmployeesModule
  if (activeTab.value === "requests" || activeTab.value === "solicitacoes") return RequestsModule
  if (activeTab.value === "recrutamento" || activeTab.value === "recruitment") return RecruitmentModule
  if (activeTab.value === "autoatendimento") return SelfServicePortal
  if (activeTab.value === "workflows") return WorkflowsModule
  if (activeTab.value === "calendario") return CorporateCalendarModule
  if (activeTab.value === "desempenho") return PerformanceModule
  if (activeTab.value === "docs" || activeTab.value === "documentos") return DocumentsModule
  if (activeTab.value === "reports" || activeTab.value === "relatorios") return ReportsModule
  if (activeTab.value === "onboarding") return OnboardingModule
  if (activeTab.value === "users" || activeTab.value === "usuarios") return UsersModule
  if (activeTab.value === "feed") return CorporateFeedModule
  if (activeTab.value === "adverse_events" || activeTab.value === "eventos-adversos") return AdverseEventsModule
  return null
})
</script>

<template>
  <!-- Módulos Específicos -->
  <main v-if="activeTab === 'dashboard'" class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative p-3.5 sm:p-6 lg:p-8">
    <div class="mx-auto w-full max-w-6xl">
      <DashboardView />
    </div>
  </main>
  <KeepAlive v-else-if="activeModuleComponent" :max="6">
    <component :is="activeModuleComponent" :key="activeTab" />
  </KeepAlive>

  <!-- Workspace Padrão / Início apenas com os Módulos (como estava antes) -->
  <main v-else class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative">
    <!-- Cabeçalho -->
    <header class="border-b bg-card px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="text-sm text-muted-foreground">Olá, <strong>{{ currentUser?.name || 'Usuário' }}</strong> 👋</p>
        <span
          class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shadow-2xs"
          :class="roleHeaderInfo.badgeClass"
        >
          {{ roleHeaderInfo.badge }}
        </span>
      </div>
      <h1 class="mt-0.5 text-balance text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
        {{ roleHeaderInfo.title }}
      </h1>
      <p class="mt-1 max-w-2xl text-pretty text-xs sm:text-sm text-muted-foreground">
        {{ roleHeaderInfo.subtitle }}
      </p>
    </header>

    <div class="mx-auto w-full max-w-6xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8">
      <!-- Módulos -->
      <section aria-label="Módulos da plataforma">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base sm:text-lg font-semibold">Módulos</h2>
          <button
            class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
            @click="showToast('Adição de novos módulos personalizada disponível no plano Enterprise.')"
          >
            <Plus :size="16" /> Novo módulo
          </button>
        </div>

        <div class="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="m in visibleModules"
            :key="m.key"
            class="group flex flex-col items-start rounded-2xl border bg-card p-4 sm:p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
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
