<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Award,
  Target,
  Star,
  Plus,
  RefreshCw,
  X,
} from "lucide-vue-next"
import { apiFetch, showToast, activeUserRole, hasPermission, currentUser } from "../store"

export interface EvaluationCriterion {
  id: string
  name: string
  description?: string
  category: string
  weight: number
  scale_max: number
}

export interface PerformanceCycle {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  status: "planejado" | "em_andamento" | "encerrado"
  criteria?: EvaluationCriterion[]
}

export interface EvaluationItem {
  id: string
  cycle_id: string
  employee_id: string
  employee_name: string
  evaluator_id: string
  evaluator_name: string
  type: "autoavaliacao" | "lideranca" | "pares"
  status: "rascunho" | "concluido"
  scores: { criterion_id: string; score: number; comment?: string }[]
  final_score?: number
  feedback_text?: string
  submitted_at?: string
}

export interface IndividualGoal {
  id: string
  cycle_id?: string
  employee_id: string
  employee_name: string
  title: string
  description?: string
  metric_target: string
  current_progress: number
  due_date?: string
  status: "em_progresso" | "concluida" | "atrasada"
  comments?: string
}

const loading = ref(false)
const cycles = ref<PerformanceCycle[]>([])
const selectedCycleId = ref<string>("")
const activeTab = ref<"minhas" | "equipe" | "metas">("minhas")

const myEvaluations = ref<EvaluationItem[]>([])
const teamEvaluations = ref<EvaluationItem[]>([])
const goals = ref<IndividualGoal[]>([])

// Modais
const showEvalModal = ref(false)
const showGoalModal = ref(false)
const showCycleModal = ref(false)

// Formulário de Avaliação Ativa
const activeEvaluation = ref<{
  id?: string
  cycleId: string
  employeeId: string
  employeeName: string
  type: "autoavaliacao" | "lideranca"
  scores: Record<string, number>
  feedback: string
}>({
  cycleId: "",
  employeeId: "",
  employeeName: "",
  type: "autoavaliacao",
  scores: {},
  feedback: "",
})

// Formulário de Nova Meta
const newGoal = ref({
  employeeId: "",
  employeeName: "",
  title: "",
  description: "",
  metricTarget: "",
  dueDate: "",
})

// Formulário de Novo Ciclo
const newCycle = ref({
  title: "",
  description: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10),
})

const activeCycle = computed(() => {
  return cycles.value.find((c) => c.id === selectedCycleId.value) || cycles.value[0] || null
})

// Critérios do ciclo selecionado
const activeCriteria = computed(() => {
  return activeCycle.value?.criteria || []
})

// Média ponderada calculada em tempo real
const calculatedAverage = computed(() => {
  const criteria = activeCriteria.value
  if (!criteria.length) return 0

  let totalWeightedScore = 0
  let totalWeights = 0

  for (const c of criteria) {
    const score = activeEvaluation.value.scores[c.id] || 3
    const weight = c.weight || 1
    totalWeightedScore += score * weight
    totalWeights += weight
  }

  return totalWeights > 0 ? Number((totalWeightedScore / totalWeights).toFixed(2)) : 0
})

async function fetchCycles() {
  try {
    const res = await apiFetch("/api/performance/cycles")
    const data = await res.json()
    if (data.ok && Array.isArray(data.cycles) && data.cycles.length > 0) {
      cycles.value = data.cycles
      if (!selectedCycleId.value) {
        selectedCycleId.value = data.cycles[0].id
      }
    }
  } catch (_e) {}
}

async function fetchEvaluations() {
  try {
    const cycleParam = selectedCycleId.value ? `?cycleId=${selectedCycleId.value}` : ""
    const res = await apiFetch(`/api/performance/evaluations${cycleParam}`)
    const data = await res.json()
    if (data.ok && Array.isArray(data.evaluations)) {
      const all: EvaluationItem[] = data.evaluations
      const myName = (currentUser.value?.name || "").toLowerCase()

      myEvaluations.value = all.filter(
        (e) =>
          e.employee_name?.toLowerCase().includes(myName) ||
          e.evaluator_name?.toLowerCase().includes(myName) ||
          e.type === "autoavaliacao"
      )

      teamEvaluations.value = all.filter((e) => e.type === "lideranca")
    }
  } catch (_e) {}
}

async function fetchGoals() {
  try {
    const res = await apiFetch("/api/performance/goals")
    const data = await res.json()
    if (data.ok && Array.isArray(data.goals)) {
      goals.value = data.goals
    }
  } catch (_e) {}
}

async function loadData() {
  loading.value = true
  await fetchCycles()
  await Promise.all([fetchEvaluations(), fetchGoals()])
  loading.value = false
}

function openEvaluationForm(type: "autoavaliacao" | "lideranca", targetEmpName?: string, targetEmpId?: string) {
  const cycle = activeCycle.value
  if (!cycle) {
    showToast("Nenhum ciclo de avaliação ativo encontrado.", "warning")
    return
  }

  const scoresInit: Record<string, number> = {}
  ;(cycle.criteria || []).forEach((c) => {
    scoresInit[c.id] = 4
  })

  activeEvaluation.value = {
    cycleId: cycle.id,
    employeeId: targetEmpId || currentUser.value?.id || "usr_colab",
    employeeName: targetEmpName || currentUser.value?.name || "Colaborador",
    type,
    scores: scoresInit,
    feedback: "",
  }

  showEvalModal.value = true
}

const isSubmittingEval = ref(false)

async function submitEvaluation(asDraft = false) {
  if (isSubmittingEval.value) return
  if (!activeEvaluation.value.cycleId) {
    showToast("Ciclo de avaliação não selecionado.", "warning")
    return
  }

  const formattedScores = Object.entries(activeEvaluation.value.scores).map(([critId, score]) => ({
    criterion_id: critId,
    score,
  }))

  isSubmittingEval.value = true
  try {
    const res = await apiFetch("/api/performance/evaluations", {
      method: "POST",
      body: JSON.stringify({
        cycleId: activeEvaluation.value.cycleId,
        employeeId: activeEvaluation.value.employeeId,
        employeeName: activeEvaluation.value.employeeName,
        type: activeEvaluation.value.type,
        scores: formattedScores,
        feedback: activeEvaluation.value.feedback,
        status: asDraft ? "rascunho" : "concluido",
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.ok) {
      showToast(asDraft ? "Rascunho salvo com sucesso!" : "Avaliação oficial enviada com sucesso!", "success")
      showEvalModal.value = false
      await fetchEvaluations()
    } else {
      showToast(data.error || "Erro ao salvar avaliação.", "error")
    }
  } catch (err: any) {
    showToast("Falha de rede ao salvar avaliação: " + (err?.message || "conexão indisponível"), "error")
  } finally {
    isSubmittingEval.value = false
  }
}

async function updateGoalProgress(goal: IndividualGoal, newProgress: number) {
  const status = newProgress >= 100 ? "concluida" : "em_progresso"
  try {
    const res = await apiFetch(`/api/performance/goals/${goal.id}`, {
      method: "PATCH",
      body: JSON.stringify({ currentProgress: newProgress, status }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.ok) {
      goal.current_progress = newProgress
      goal.status = status
      showToast("Progresso da meta atualizado!", "success")
    } else {
      showToast(data.error || "Não foi possível atualizar o progresso da meta.", "error")
    }
  } catch (_e) {
    showToast("Falha de rede ao atualizar progresso da meta.", "error")
  }
}

const isSubmittingGoal = ref(false)

async function handleCreateGoal() {
  if (isSubmittingGoal.value) return
  if (!newGoal.value.title.trim() || !newGoal.value.metricTarget.trim()) {
    showToast("Título e métrica alvo são obrigatórios.", "warning")
    return
  }

  isSubmittingGoal.value = true
  try {
    const res = await apiFetch("/api/performance/goals", {
      method: "POST",
      body: JSON.stringify({
        ...newGoal.value,
        employeeId: newGoal.value.employeeId || currentUser.value?.id || "emp_1",
        employeeName: newGoal.value.employeeName || currentUser.value?.name || "Colaborador",
        cycleId: selectedCycleId.value || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.ok) {
      showToast("Meta individual criada com sucesso!", "success")
      showGoalModal.value = false
      newGoal.value = {
        employeeId: "",
        employeeName: "",
        title: "",
        description: "",
        metricTarget: "",
        dueDate: "",
      }
      await fetchGoals()
    } else {
      showToast(data.error || "Erro ao registrar meta.", "error")
    }
  } catch (err: any) {
    showToast("Falha ao salvar meta: " + (err?.message || "conexão indisponível"), "error")
  } finally {
    isSubmittingGoal.value = false
  }
}

const isSubmittingCycle = ref(false)

async function handleCreateCycle() {
  if (isSubmittingCycle.value) return
  if (!newCycle.value.title.trim()) {
    showToast("Informe o título do ciclo.", "warning")
    return
  }

  isSubmittingCycle.value = true
  try {
    const res = await apiFetch("/api/performance/cycles", {
      method: "POST",
      body: JSON.stringify({
        ...newCycle.value,
        criteria: [
          { name: "Entrega de Resultados & Foco", category: "Técnica", weight: 2.0 },
          { name: "Comunicação Assertiva & Transparência", category: "Comportamental", weight: 1.0 },
          { name: "Trabalho em Equipe & Colaboração", category: "Comportamental", weight: 1.0 },
          { name: "Inovação & Resolução de Problemas", category: "Inovação", weight: 1.5 },
        ],
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.ok) {
      showToast("Ciclo avaliativo criado com sucesso!", "success")
      showCycleModal.value = false
      newCycle.value = {
        title: "",
        description: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      }
      await fetchCycles()
    } else {
      showToast(data.error || "Erro ao criar ciclo.", "error")
    }
  } catch (err: any) {
    showToast("Falha de rede ao criar ciclo: " + (err?.message || "conexão indisponível"), "error")
  } finally {
    isSubmittingCycle.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex-1 overflow-y-auto scrollbar-thin p-3.5 sm:p-6 lg:p-8 bg-background space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Award :size="26" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Avaliação de Desempenho & Metas
            <span class="ph-badge-info text-xs">
              Competências & OKRs
            </span>
          </h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            Autoavaliação, avaliação da liderança por critérios ponderados e acompanhamento de metas individuais.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="loadData"
          :disabled="loading"
          class="ph-btn-secondary"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">Atualizar</span>
        </button>

        <button
          v-if="hasPermission('performance.create_cycle')"
          @click="showCycleModal = true"
          class="ph-btn-secondary"
        >
          <Plus :size="16" />
          <span>Novo Ciclo</span>
        </button>

        <button
          @click="openEvaluationForm('autoavaliacao')"
          class="ph-btn-primary"
        >
          <Star :size="18" />
          <span>Minha Autoavaliação</span>
        </button>
      </div>
    </div>

    <!-- Seletor de Ciclo e Abas de Navegação -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
      <div class="flex items-center gap-2">
        <Award :size="18" class="text-primary shrink-0" />
        <span class="text-xs font-semibold text-muted-foreground">Ciclo:</span>
        <select
          v-model="selectedCycleId"
          @change="fetchEvaluations"
          class="ph-select px-3 py-1.5 text-xs font-bold max-w-[280px] truncate"
        >
          <option v-for="c in cycles" :key="c.id" :value="c.id">
            {{ c.title }} ({{ c.status }})
          </option>
        </select>
      </div>

      <!-- Abas -->
      <div class="flex items-center gap-1 bg-muted p-1 rounded-lg">
        <button
          @click="activeTab = 'minhas'"
          class="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors"
          :class="activeTab === 'minhas' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'"
        >
          Minhas Avaliações
        </button>

        <button
          v-if="activeUserRole !== 'COLABORADOR'"
          @click="activeTab = 'equipe'"
          class="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors"
          :class="activeTab === 'equipe' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'"
        >
          Avaliações da Equipe
        </button>

        <button
          @click="activeTab = 'metas'"
          class="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors"
          :class="activeTab === 'metas' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'"
        >
          Metas & OKRs ({{ goals.length }})
        </button>
      </div>
    </div>

    <!-- Conteúdo da Aba 1: Minhas Avaliações -->
    <div v-if="activeTab === 'minhas'" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Card: Status da Autoavaliação -->
        <div class="p-5 rounded-2xl border bg-card text-card-foreground shadow-2xs space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Autoavaliação Individual
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              {{ activeCycle?.title || 'Ciclo 2026' }}
            </span>
          </div>

          <p class="text-xs text-muted-foreground leading-relaxed">
            Avalie suas entregas, evolução técnica e alinhamento cultural com base nos critérios estabelecidos pelo RH.
          </p>

          <div class="pt-2 border-t flex items-center justify-between">
            <span class="text-xs text-muted-foreground">Nota Final: <strong>{{ calculatedAverage > 0 ? calculatedAverage : 'Pendente' }}</strong></span>
            <button
              @click="openEvaluationForm('autoavaliacao')"
              class="px-4 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-2xs transition-colors"
            >
              Preencher / Editar Autoavaliação
            </button>
          </div>
        </div>

        <!-- Card: Parecer da Liderança -->
        <div class="p-5 rounded-2xl border bg-card text-card-foreground shadow-2xs space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Avaliação da Liderança Direta
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
              Feedback Oficial
            </span>
          </div>

          <div v-if="teamEvaluations.length" class="space-y-2">
            <div class="text-2xl font-black text-foreground">
              {{ teamEvaluations[0].final_score || '4.8' }} <span class="text-sm font-normal text-muted-foreground">/ 5.0</span>
            </div>
            <p class="text-xs text-muted-foreground italic bg-muted/30 p-2.5 rounded-lg border">
              "{{ teamEvaluations[0].feedback_text || 'Excelente comprometimento nas entregas e forte liderança técnica no time.' }}"
            </p>
          </div>
          <div v-else class="text-xs text-muted-foreground py-4 text-center">
            A liderança ainda está concluindo a rodada de feedback para este ciclo.
          </div>
        </div>
      </div>
    </div>

    <!-- Conteúdo da Aba 2: Avaliações da Equipe (Gestor & RH) -->
    <div v-if="activeTab === 'equipe'" class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-foreground">Colaboradores Sob Minha Liderança</h3>
        <button
          @click="openEvaluationForm('lideranca', 'Mariana Alcantara')"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 text-white hover:bg-teal-700"
        >
          <Plus :size="14" />
          Avaliar Colaborador
        </button>
      </div>

      <div class="bg-card rounded-2xl border divide-y overflow-hidden shadow-2xs">
        <div class="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 rounded-full bg-teal-500/10 text-teal-600 font-bold flex items-center justify-center text-xs">
              MA
            </div>
            <div>
              <h4 class="text-xs font-bold text-foreground">Mariana Alcantara</h4>
              <span class="text-[11px] text-muted-foreground">Analista de Recursos Humanos — RH</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Média: 4.8 / 5.0
            </span>
            <button
              @click="openEvaluationForm('lideranca', 'Mariana Alcantara')"
              class="px-3 py-1 text-xs font-semibold rounded-lg border hover:bg-muted"
            >
              Revisar Parecer
            </button>
          </div>
        </div>

        <div class="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 rounded-full bg-indigo-500/10 text-indigo-600 font-bold flex items-center justify-center text-xs">
              GS
            </div>
            <div>
              <h4 class="text-xs font-bold text-foreground">Gabriel Santos</h4>
              <span class="text-[11px] text-muted-foreground">Desenvolvedor de Software — TI</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Aguardando Avaliação
            </span>
            <button
              @click="openEvaluationForm('lideranca', 'Gabriel Santos')"
              class="px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white hover:bg-teal-700"
            >
              Avaliar Agora
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Conteúdo da Aba 3: Metas Individuais & OKRs -->
    <div v-if="activeTab === 'metas'" class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-foreground">Acompanhamento de Metas & OKRs</h3>
        <button
          v-if="hasPermission('performance.manage_goals')"
          @click="showGoalModal = true"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 text-white hover:bg-teal-700"
        >
          <Plus :size="14" />
          Nova Meta
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="goal in goals"
          :key="goal.id"
          class="p-4 rounded-xl border bg-card text-card-foreground shadow-2xs space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <h4 class="text-sm font-bold text-foreground">{{ goal.title }}</h4>
            <span
              class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
              :class="{
                'bg-emerald-500/15 text-emerald-700 border-emerald-500/30': goal.status === 'concluida',
                'bg-amber-500/15 text-amber-700 border-amber-500/30': goal.status === 'em_progresso',
                'bg-rose-500/15 text-rose-700 border-rose-500/30': goal.status === 'atrasada',
              }"
            >
              {{ goal.status.replace('_', ' ') }}
            </span>
          </div>

          <p v-if="goal.description" class="text-xs text-muted-foreground">{{ goal.description }}</p>

          <div class="text-xs text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-1.5">
            <Target :size="14" />
            Meta: {{ goal.metric_target }}
          </div>

          <!-- Barra de Progresso com Slider Interativo -->
          <div class="space-y-1.5 pt-1">
            <div class="flex justify-between text-xs font-bold text-foreground">
              <span>Progresso Realizado</span>
              <span>{{ goal.current_progress }}%</span>
            </div>
            <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-teal-500 rounded-full transition-all duration-300"
                :style="{ width: `${goal.current_progress}%` }"
              ></div>
            </div>

            <!-- Ajuste Rápido de Progresso -->
            <div class="flex items-center gap-1 pt-1 justify-end">
              <button
                @click="updateGoalProgress(goal, Math.min(100, goal.current_progress + 10))"
                class="px-2 py-0.5 text-[10px] font-bold rounded border bg-muted hover:bg-muted/80"
              >
                +10%
              </button>
              <button
                @click="updateGoalProgress(goal, 100)"
                class="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Concluir 100%
              </button>
            </div>
          </div>
        </div>

        <div v-if="!goals.length" class="col-span-2 text-center py-10 text-muted-foreground text-xs">
          Nenhuma meta individual cadastrada ainda.
        </div>
      </div>
    </div>

    <!-- Modal de Formulário de Avaliação (Autoavaliação ou Liderança) -->
    <div
      v-if="showEvalModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
    >
      <div class="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-xl max-h-[90dvh] my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-foreground">
        <div class="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div>
            <h2 class="text-base font-bold text-foreground flex items-center gap-2">
              <Star :size="18" class="text-primary" />
              {{ activeEvaluation.type === 'autoavaliacao' ? 'Formulário de Autoavaliação' : 'Avaliação da Liderança' }}
            </h2>
            <p class="text-xs text-muted-foreground">
              Colaborador: <strong class="text-foreground">{{ activeEvaluation.employeeName }}</strong>
            </p>
          </div>
          <button @click="showEvalModal = false" class="p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <div class="p-4 sm:p-6 overflow-y-auto scrollbar-thin space-y-5 flex-1">
          <!-- Box de Média Ponderada em Tempo Real -->
          <div class="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20">
            <div>
              <span class="text-xs font-bold text-primary uppercase">Média Ponderada Atual:</span>
              <div class="text-2xl font-black text-primary">
                {{ calculatedAverage }} <span class="text-xs font-normal text-muted-foreground">/ 5.0</span>
              </div>
            </div>
            <span class="text-xs text-muted-foreground text-right max-w-[200px]">
              Calculada automaticamente com base no peso de cada critério.
            </span>
          </div>

          <!-- Critérios Ponderados -->
          <div class="space-y-4">
            <h3 class="text-xs font-bold text-foreground uppercase tracking-wider">Critérios de Competências:</h3>

            <div
              v-for="crit in activeCriteria"
              :key="crit.id"
              class="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2"
            >
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="text-xs font-bold text-foreground">{{ crit.name }}</h4>
                  <span class="text-[10px] text-muted-foreground">Peso no cálculo: {{ crit.weight }}x | {{ crit.category }}</span>
                </div>
                <span class="text-xs font-bold px-2 py-0.5 rounded bg-background border border-border text-foreground">
                  Nota: {{ activeEvaluation.scores[crit.id] || 3 }} / 5
                </span>
              </div>

              <!-- Seletor de Nota (Estrelas / Escala 1-5) -->
              <div class="flex items-center gap-2 pt-1">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  @click="activeEvaluation.scores[crit.id] = n"
                  class="h-8 w-8 rounded-lg font-bold text-xs border transition-all cursor-pointer"
                  :class="activeEvaluation.scores[crit.id] === n
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-background hover:bg-muted text-muted-foreground border-border'"
                >
                  {{ n }}
                </button>
              </div>
            </div>
          </div>

          <!-- Parecer Qualitativo / PDI -->
          <div class="space-y-1.5 border-t border-border pt-4">
            <label class="text-xs font-bold text-foreground">Parecer Qualitativo & Plano de Desenvolvimento (PDI):</label>
            <textarea
              v-model="activeEvaluation.feedback"
              rows="3"
              placeholder="Descreva conquistas, pontos fortes e oportunidades de aprimoramento contínuo..."
              class="ph-input w-full p-2.5 text-xs"
            ></textarea>
          </div>
        </div>

        <div class="p-4 border-t border-border flex justify-end gap-2 bg-muted/20">
          <button
            @click="submitEvaluation(true)"
            :disabled="isSubmittingEval"
            class="ph-btn-secondary px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salvar Rascunho
          </button>
          <button
            @click="submitEvaluation(false)"
            :disabled="isSubmittingEval"
            class="ph-btn-primary px-5 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmittingEval ? "Enviando..." : "Enviar Avaliação Oficial" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Nova Meta -->
    <div
      v-if="showGoalModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
    >
      <div class="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl my-auto max-h-[90dvh] overflow-y-auto scrollbar-thin flex flex-col animate-in fade-in zoom-in-95 duration-200 text-foreground">
        <div class="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <h2 class="text-base font-bold text-foreground flex items-center gap-2">
            <Target :size="18" class="text-primary" />
            Cadastrar Nova Meta Individual
          </h2>
          <button @click="showGoalModal = false" class="p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <div class="p-5 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Título da Meta *</label>
            <input
              v-model="newGoal.title"
              type="text"
              placeholder="Ex.: Reduzir tempo médio de contratação (SLA)"
              class="ph-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Métrica Alvo *</label>
            <input
              v-model="newGoal.metricTarget"
              type="text"
              placeholder="Ex.: Redução para menos de 15 dias"
              class="ph-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Colaborador</label>
            <input
              v-model="newGoal.employeeName"
              type="text"
              placeholder="Nome do colaborador"
              class="ph-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Prazo Final</label>
            <input
              v-model="newGoal.dueDate"
              type="date"
              class="ph-input w-full px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div class="p-4 border-t border-border flex justify-end gap-2 bg-muted/20">
          <button @click="showGoalModal = false" class="ph-btn-secondary px-4 py-1.5 text-xs">
            Cancelar
          </button>
          <button
            @click="handleCreateGoal"
            :disabled="isSubmittingGoal"
            class="ph-btn-primary px-4 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmittingGoal ? "Salvando..." : "Salvar Meta" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Novo Ciclo Avaliativo -->
    <div
      v-if="showCycleModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
    >
      <div class="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl my-auto max-h-[90dvh] overflow-y-auto scrollbar-thin flex flex-col animate-in fade-in zoom-in-95 duration-200 text-foreground">
        <div class="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <h2 class="text-base font-bold text-foreground flex items-center gap-2">
            <Award :size="18" class="text-primary" />
            Novo Ciclo de Avaliação
          </h2>
          <button @click="showCycleModal = false" class="p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <div class="p-5 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Título do Ciclo *</label>
            <input
              v-model="newCycle.title"
              type="text"
              placeholder="Ex.: Ciclo 2026.2 - Competências e Metas"
              class="ph-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Descrição</label>
            <textarea
              v-model="newCycle.description"
              rows="2"
              placeholder="Objetivos e escopo do ciclo de avaliação..."
              class="ph-input w-full px-3 py-2 text-xs"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-foreground">Início</label>
              <input
                v-model="newCycle.startDate"
                type="date"
                class="ph-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-foreground">Término</label>
              <input
                v-model="newCycle.endDate"
                type="date"
                class="ph-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-border flex justify-end gap-2 bg-muted/20">
          <button @click="showCycleModal = false" class="ph-btn-secondary px-4 py-1.5 text-xs">
            Cancelar
          </button>
          <button
            @click="handleCreateCycle"
            :disabled="isSubmittingCycle"
            class="ph-btn-primary px-4 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmittingCycle ? "Criando..." : "Criar Ciclo" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
