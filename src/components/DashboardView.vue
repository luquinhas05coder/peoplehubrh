<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  CalendarCheck,
  Palmtree,
  FileWarning,
  Building2,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Briefcase,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
} from "lucide-vue-next"
import { apiFetch } from "../store"
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
} from "chart.js"
import { Bar, Doughnut, Line } from "vue-chartjs"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

export interface DashboardData {
  totalFuncionarios: number
  funcionariosAtivos: number
  funcionariosInativos: number
  contratacoesMes: number
  desligamentosMes: number
  solicitacoesPendentes: number
  feriasPendentes: number
  documentosVencendo: number
  funcionariosPorDepartamento: Array<{ departamento: string; total: number }>
  contratacoesPorMes: Array<{ mes: string; total: number }>
  desligamentosPorMes: Array<{ mes: string; total: number }>
  funcionariosPorStatus: Array<{ status: string; total: number }>
  evolucaoQuadro?: Array<{ mes: string; total: number }>
  distribuicaoPorCargo?: Array<{ cargo: string; total: number }>
  timestamp?: string
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)
const data = ref<DashboardData | null>(null)
const lastUpdated = ref<string>("")

async function fetchDashboardData() {
  loading.value = true
  errorMsg.value = null

  try {
    const res = await apiFetch("/api/dashboard")
    const text = await res.text()
    let json: any = null

    try {
      json = text ? JSON.parse(text) : null
    } catch (_parseErr) {
      if (!res.ok) {
        throw new Error(`Servidor retornou erro (${res.status} ${res.statusText}).`)
      }
      throw new Error("Resposta inválida ou vazia do servidor.")
    }

    if (res.ok && json?.ok) {
      data.value = json
      lastUpdated.value = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } else {
      errorMsg.value = json?.error || (res.status === 401 ? "Sessão expirada. Faça login novamente." : "Não foi possível carregar as métricas do Dashboard.")
    }
  } catch (err: any) {
    errorMsg.value = err?.message || "Erro de conexão com o servidor da API."
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})

/* Paleta de Cores do PeopleHub RH */
const chartPalette = [
  "#0d9488", // Teal principal
  "#0284c7", // Sky blue
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#64748b", // Slate
]

/* 1. Gráfico: Funcionários por Departamento */
const deptChartData = computed(() => {
  const depts = data.value?.funcionariosPorDepartamento || []
  const labels = depts.length ? depts.map((d) => d.departamento) : ["Sem dados"]
  const values = depts.length ? depts.map((d) => d.total) : [0]

  return {
    labels,
    datasets: [
      {
        label: "Colaboradores",
        data: values,
        backgroundColor: chartPalette.slice(0, labels.length),
        borderRadius: 8,
        borderWidth: 0,
      },
    ],
  }
})

/* 2. Gráfico: Contratações vs Desligamentos por Mês */
const hiringTurnoverChartData = computed(() => {
  const contratacoes = data.value?.contratacoesPorMes || []
  const desligamentos = data.value?.desligamentosPorMes || []
  const labels = contratacoes.map((c) => c.mes)

  return {
    labels: labels.length ? labels : ["Últimos 6 meses"],
    datasets: [
      {
        label: "Contratações",
        data: contratacoes.map((c) => c.total),
        backgroundColor: "#10b981",
        borderRadius: 6,
      },
      {
        label: "Desligamentos",
        data: desligamentos.map((d) => d.total),
        backgroundColor: "#ef4444",
        borderRadius: 6,
      },
    ],
  }
})

/* 3. Gráfico: Distribuição por Status */
const statusChartData = computed(() => {
  const statuses = data.value?.funcionariosPorStatus || []
  const labels = statuses.length ? statuses.map((s) => s.status) : ["Sem dados"]
  const values = statuses.length ? statuses.map((s) => s.total) : [0]

  const statusColors = labels.map((st) => {
    const s = st.toLowerCase()
    if (s.includes("ativo")) return "#10b981"
    if (s.includes("férias") || s.includes("ferias")) return "#0284c7"
    if (s.includes("afastado")) return "#f59e0b"
    if (s.includes("inativo") || s.includes("desligado")) return "#ef4444"
    return "#64748b"
  })

  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: statusColors,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.8)",
      },
    ],
  }
})

/* 4. Gráfico: Evolução do Quadro */
const evolucaoChartData = computed(() => {
  const evol = data.value?.evolucaoQuadro || []
  const labels = evol.map((e) => e.mes)
  const values = evol.map((e) => e.total)

  return {
    labels: labels.length ? labels : ["Histórico"],
    datasets: [
      {
        label: "Efetivo Total",
        data: values,
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.15)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#0d9488",
      },
    ],
  }
})

/* Configurações Responsivas do Chart.js */
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        boxWidth: 12,
        font: { size: 11, family: "inherit" },
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 12, weight: "bold" as const },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(148, 163, 184, 0.15)" },
      ticks: { stepSize: 1, font: { size: 11 } },
    },
  },
}

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        boxWidth: 12,
        font: { size: 11, family: "inherit" },
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      padding: 10,
      cornerRadius: 8,
    },
  },
  cutout: "68%",
}
</script>

<template>
  <div class="space-y-6">
    <!-- Barra de Controle do Dashboard -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <BarChart3 :size="24" class="text-teal-600" />
            Dashboard Executivo de RH
          </h2>
          <span class="rounded-full bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30 px-2.5 py-0.5 text-xs font-semibold">
            Tempo Real
          </span>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Indicadores operacionais consolidados diretamente da base oficial de colaboradores e solicitações.
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <span v-if="lastUpdated" class="text-xs text-muted-foreground hidden md:inline">
          Última atualização: <strong class="text-foreground">{{ lastUpdated }}</strong>
        </span>
        <button
          class="flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          :disabled="loading"
          @click="fetchDashboardData"
          title="Recarregar dados reais da API"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
          <span>Atualizar Dados</span>
        </button>
      </div>
    </div>

    <!-- 1. ESTADO DE ERRO -->
    <div
      v-if="errorMsg && !loading"
      class="rounded-2xl border border-red-300 bg-red-50/80 p-5 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
    >
      <div class="flex items-start gap-3">
        <AlertCircle :size="20" class="text-red-600 shrink-0 mt-0.5" />
        <div class="space-y-1">
          <h3 class="font-bold text-sm">Não foi possível carregar os dados do Dashboard</h3>
          <p class="text-xs text-red-700 dark:text-red-300 leading-relaxed">{{ errorMsg }}</p>
          <button
            class="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
            @click="fetchDashboardData"
          >
            <RefreshCw :size="13" /> Tentar Novamente
          </button>
        </div>
      </div>
    </div>

    <!-- 2. SKELETON / LOADING STATE -->
    <div v-else-if="loading" class="space-y-6 animate-pulse">
      <!-- Skeleton Cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="i in 8"
          :key="i"
          class="rounded-2xl border bg-card/60 p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <div class="h-3 w-24 bg-muted rounded"></div>
            <div class="h-9 w-9 bg-muted rounded-xl"></div>
          </div>
          <div class="h-7 w-16 bg-muted rounded"></div>
          <div class="h-2.5 w-32 bg-muted/60 rounded"></div>
        </div>
      </div>

      <!-- Skeleton Charts -->
      <div class="grid gap-5 md:grid-cols-2">
        <div class="rounded-2xl border bg-card/60 p-5 h-80 space-y-3">
          <div class="h-4 w-36 bg-muted rounded"></div>
          <div class="h-60 bg-muted/40 rounded-xl"></div>
        </div>
        <div class="rounded-2xl border bg-card/60 p-5 h-80 space-y-3">
          <div class="h-4 w-36 bg-muted rounded"></div>
          <div class="h-60 bg-muted/40 rounded-xl"></div>
        </div>
      </div>
    </div>

    <!-- 3. CONTEÚDO PRINCIPAL (DADOS REAIS CARREGADOS) -->
    <div v-else-if="data" class="space-y-6">
      <!-- 8 CARDS DE MÉTRICAS OPERACIONAIS -->
      <div class="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
        <!-- 1. Total de Funcionários -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Total Funcionários</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                {{ data.totalFuncionarios }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
              <Users :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <span class="font-medium text-teal-700">{{ data.funcionariosAtivos }} ativos</span>
            <span>·</span>
            <span class="truncate">Base total</span>
          </div>
        </div>

        <!-- 2. Funcionários Ativos -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Ativos</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-emerald-600">
                {{ data.funcionariosAtivos }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <UserCheck :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <CheckCircle2 :size="12" class="text-emerald-600 shrink-0" />
            <span class="truncate">Em exercício regular</span>
          </div>
        </div>

        <!-- 3. Funcionários Inativos -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Inativos</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-600">
                {{ data.funcionariosInativos }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
              <UserX :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <span class="truncate">Desligados/afastados</span>
          </div>
        </div>

        <!-- 4. Contratações no Mês -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Contratações</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-blue-600">
                {{ data.contratacoesMes }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <UserPlus :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <TrendingUp :size="12" class="text-blue-600 shrink-0" />
            <span class="truncate">Admissões recentes</span>
          </div>
        </div>

        <!-- 5. Desligamentos no Mês -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Desligamentos</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-rose-600">
                {{ data.desligamentosMes }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <UserX :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <span class="truncate">Turnover do período</span>
          </div>
        </div>

        <!-- 6. Solicitações Pendentes -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Solicitações</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-amber-600">
                {{ data.solicitacoesPendentes }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <CalendarCheck :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <span class="truncate">Parecer pendente</span>
          </div>
        </div>

        <!-- 7. Férias Pendentes -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">Férias</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-indigo-600">
                {{ data.feriasPendentes }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
              <Palmtree :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <span class="truncate">Em análise/aprovação</span>
          </div>
        </div>

        <!-- 8. Documentos Próximos do Vencimento -->
        <div class="flex flex-col justify-between rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm">
          <div class="flex items-start justify-between gap-1.5 sm:gap-2">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">A Vencer</p>
              <h3 class="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-orange-600">
                {{ data.documentosVencendo }}
              </h3>
            </div>
            <span class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <FileWarning :size="17" class="sm:scale-115" />
            </span>
          </div>
          <div class="mt-2.5 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground border-t pt-2">
            <span class="truncate">ASO / CNH (&lt; 30d)</span>
          </div>
        </div>
      </div>

      <!-- SEÇÃO DE GRÁFICOS INTERATIVOS -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- 1. Funcionários por Departamento -->
        <div class="rounded-2xl border bg-card p-5 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 class="font-bold text-sm text-foreground flex items-center gap-2">
                <Building2 :size="16" class="text-teal-600" />
                Funcionários por Departamento
              </h3>
              <p class="text-xs text-muted-foreground">Distribuição atual do efetivo por setor</p>
            </div>
            <span class="rounded-full bg-teal-500/10 text-teal-700 px-2 py-0.5 text-xs font-bold">
              {{ data.funcionariosPorDepartamento.length }} Departamentos
            </span>
          </div>

          <div class="h-64 sm:h-72 w-full">
            <Bar :data="deptChartData" :options="baseChartOptions" />
          </div>
        </div>

        <!-- 2. Contratações vs Desligamentos por Mês -->
        <div class="rounded-2xl border bg-card p-5 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 class="font-bold text-sm text-foreground flex items-center gap-2">
                <TrendingUp :size="16" class="text-blue-600" />
                Contratações e Desligamentos por Mês
              </h3>
              <p class="text-xs text-muted-foreground">Histórico comparativo dos últimos 6 meses</p>
            </div>
            <span class="rounded-full bg-blue-500/10 text-blue-700 px-2 py-0.5 text-xs font-bold">
              Semestral
            </span>
          </div>

          <div class="h-64 sm:h-72 w-full">
            <Bar :data="hiringTurnoverChartData" :options="baseChartOptions" />
          </div>
        </div>

        <!-- 3. Distribuição por Status -->
        <div class="rounded-2xl border bg-card p-5 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 class="font-bold text-sm text-foreground flex items-center gap-2">
                <PieChartIcon :size="16" class="text-emerald-600" />
                Distribuição por Status
              </h3>
              <p class="text-xs text-muted-foreground">Situação cadastral dos colaboradores na organização</p>
            </div>
            <span class="rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5 text-xs font-bold">
              Total: {{ data.totalFuncionarios }}
            </span>
          </div>

          <div class="h-64 sm:h-72 w-full flex items-center justify-center">
            <Doughnut :data="statusChartData" :options="doughnutChartOptions" />
          </div>
        </div>

        <!-- 4. Evolução do Quadro de Funcionários -->
        <div class="rounded-2xl border bg-card p-5 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 class="font-bold text-sm text-foreground flex items-center gap-2">
                <Users :size="16" class="text-teal-600" />
                Evolução do Quadro de Funcionários
              </h3>
              <p class="text-xs text-muted-foreground">Variação líquida do headcount ao longo dos meses</p>
            </div>
            <span class="rounded-full bg-teal-500/10 text-teal-700 px-2 py-0.5 text-xs font-bold">
              Headcount
            </span>
          </div>

          <div class="h-64 sm:h-72 w-full">
            <Line :data="evolucaoChartData" :options="baseChartOptions" />
          </div>
        </div>
      </div>

      <!-- 5. DISTRIBUIÇÃO POR CARGO (SE EXISTIREM DADOS) -->
      <div v-if="data.distribuicaoPorCargo && data.distribuicaoPorCargo.length" class="rounded-2xl border bg-card p-5 shadow-2xs">
        <div class="flex items-center justify-between border-b pb-3 mb-4">
          <div>
            <h3 class="font-bold text-sm text-foreground flex items-center gap-2">
              <Briefcase :size="16" class="text-indigo-600" />
              Principais Funções & Distribuição por Cargo
            </h3>
            <p class="text-xs text-muted-foreground">Cargos com maior volume de colaboradores alocados</p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(c, idx) in data.distribuicaoPorCargo"
            :key="idx"
            class="flex items-center justify-between rounded-xl border bg-background p-3 text-xs"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-700 font-bold text-[11px]">
                #{{ idx + 1 }}
              </span>
              <span class="font-semibold text-foreground truncate" :title="c.cargo">{{ c.cargo }}</span>
            </div>
            <span class="rounded-full bg-muted px-2.5 py-0.5 font-bold text-foreground shrink-0">
              {{ c.total }} colab.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. ESTADO VAZIO -->
    <div
      v-else
      class="rounded-2xl border bg-card p-12 text-center space-y-3"
    >
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Users :size="28" />
      </div>
      <h3 class="font-bold text-base text-foreground">Nenhum dado encontrado no Dashboard</h3>
      <p class="text-xs text-muted-foreground max-w-md mx-auto">
        Não há registros de colaboradores ou solicitações cadastrados nesta organização para exibir as métricas.
      </p>
      <button
        class="inline-flex items-center gap-1.5 rounded-xl border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
        @click="fetchDashboardData"
      >
        <RefreshCw :size="14" /> Recarregar
      </button>
    </div>
  </div>
</template>
