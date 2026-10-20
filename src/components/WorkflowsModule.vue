<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  GitMerge,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  ShieldCheck,
  RefreshCw,
  X,
  History,
  FileCheck,
  ChevronRight,
} from "lucide-vue-next"
import { apiFetch, showToast, activeUserRole, hasPermission } from "../store"

export interface WorkflowStep {
  id: string
  workflow_id: string
  order_index: number
  title: string
  description?: string
  assignee_role: "ADMIN" | "RH" | "GESTOR" | "COLABORADOR"
  assignee_name?: string
  status: "pendente" | "em_execucao" | "concluido" | "rejeitado"
  due_date?: string
  completed_at?: string
  completed_by_name?: string
  comments?: string
  required?: number
}

export interface WorkflowHistoryItem {
  id: string
  workflow_id: string
  step_title?: string
  action: string
  actor_name?: string
  actor_role?: string
  comments?: string
  created_at: string
}

export interface WorkflowItem {
  id: string
  title: string
  category: string
  description?: string
  employee_id?: string
  employee_name?: string
  current_step_id?: string
  status: "em_andamento" | "concluido" | "cancelado"
  due_date?: string
  created_by_name?: string
  created_at: string
  updated_at: string
  total_steps?: number
  completed_steps?: number
  progress?: number
  steps?: WorkflowStep[]
  history?: WorkflowHistoryItem[]
}

const loading = ref(false)
const workflows = ref<WorkflowItem[]>([])
const selectedWorkflow = ref<WorkflowItem | null>(null)
const showDetailModal = ref(false)
const showNewModal = ref(false)

// Filtros
const searchTerm = ref("")
const selectedCategory = ref("todos")
const selectedStatus = ref("todos")

// Form de Execução de Etapa
const executionComments = ref("")
const executingStep = ref(false)

// Form de Criação de Novo Workflow
const newWf = ref({
  title: "",
  category: "Admissão",
  description: "",
  employee_name: "",
  due_date: "",
  template: "admissao",
  steps: [
    { title: "Exame Admissional & ASO", assignee_role: "RH", description: "Verificação de aptidão médica" },
    { title: "Coleta e Validação de Documentos", assignee_role: "RH", description: "RG, CPF, Carteira de Trabalho" },
    { title: "Criação de Acessos & Equipamentos", assignee_role: "ADMIN", description: "Setup de e-mail e infraestrutura de TI" },
    { title: "Integração & Alinhamento com Gestor", assignee_role: "GESTOR", description: "Apresentação de metas e equipe" },
  ],
})

const TEMPLATES: Record<string, { title: string; category: string; steps: any[] }> = {
  admissao: {
    title: "Processo de Onboarding e Admissão",
    category: "Admissão",
    steps: [
      { title: "Exame Admissional & ASO", assignee_role: "RH", description: "Verificação de aptidão médica" },
      { title: "Coleta e Validação de Documentos", assignee_role: "RH", description: "RG, CPF, Carteira de Trabalho" },
      { title: "Criação de Acessos & Equipamentos", assignee_role: "ADMIN", description: "Setup de e-mail e infraestrutura de TI" },
      { title: "Integração & Alinhamento com Gestor", assignee_role: "GESTOR", description: "Apresentação de metas e equipe" },
    ],
  },
  ferias: {
    title: "Programação e Homologação de Férias",
    category: "Férias",
    steps: [
      { title: "Validação de Saldo Aquisitivo", assignee_role: "RH", description: "Conferência de período aquisitivo" },
      { title: "Aprovação da Liderança Direta", assignee_role: "GESTOR", description: "Alinhamento de escala da equipe" },
      { title: "Cálculo do Aviso de Férias & 1/3", assignee_role: "RH", description: "Emissão de holerite de férias e pagamento" },
    ],
  },
  desligamento: {
    title: "Esteira de Offboarding & Rescisão",
    category: "Desligamento",
    steps: [
      { title: "Aviso Prévio & Notificação", assignee_role: "RH", description: "Formalização do termo rescisório" },
      { title: "Revogação de Acessos de TI", assignee_role: "ADMIN", description: "Bloqueio imediato de contas corporativas" },
      { title: "Exame Demissional", assignee_role: "RH", description: "Atestado de saúde ocupacional demissional" },
      { title: "Entrevista de Desligamento", assignee_role: "RH", description: "Pesquisa de clima e devolução de ativos" },
    ],
  },
  promocao: {
    title: "Promoção & Revisão Salarial",
    category: "Promoção",
    steps: [
      { title: "Parecer da Liderança", assignee_role: "GESTOR", description: "Justificativa técnica e avaliação de mérito" },
      { title: "Aprovação Orçamentária e Enquadramento CBO", assignee_role: "RH", description: "Validação na tabela salarial e CBO" },
      { title: "Aprovação da Diretoria", assignee_role: "ADMIN", description: "Chancela executiva da alteração funcional" },
    ],
  },
}

function handleTemplateChange() {
  const tpl = TEMPLATES[newWf.value.template]
  if (tpl) {
    newWf.value.title = tpl.title
    newWf.value.category = tpl.category
    newWf.value.steps = JSON.parse(JSON.stringify(tpl.steps))
  }
}

function addStepToNewWf() {
  newWf.value.steps.push({
    title: "Nova Etapa",
    assignee_role: "RH",
    description: "",
  })
}

function removeStepFromNewWf(index: number) {
  if (newWf.value.steps.length <= 1) {
    showToast("O workflow precisa ter pelo menos 1 etapa.", "warning")
    return
  }
  newWf.value.steps.splice(index, 1)
}

async function fetchWorkflows() {
  loading.value = true
  try {
    const res = await apiFetch("/api/workflows")
    const data = await res.json()
    if (data.ok && Array.isArray(data.workflows)) {
      workflows.value = data.workflows
    }
  } catch (err: any) {
    showToast("Falha ao carregar processos de workflow: " + err.message, "error")
  } finally {
    loading.value = false
  }
}

async function openWorkflowDetails(wf: WorkflowItem) {
  try {
    const res = await apiFetch(`/api/workflows/${wf.id}`)
    const data = await res.json()
    if (data.ok) {
      selectedWorkflow.value = {
        ...data.workflow,
        steps: data.steps,
        history: data.history,
      }
      executionComments.value = ""
      showDetailModal.value = true
    } else {
      showToast(data.error || "Erro ao carregar detalhes.", "error")
    }
  } catch (err: any) {
    showToast("Falha de rede: " + err.message, "error")
  }
}

async function handleExecuteStep(action: "concluir" | "iniciar" | "rejeitar", stepId: string) {
  if (!selectedWorkflow.value) return
  executingStep.value = true
  try {
    const res = await apiFetch(`/api/workflows/${selectedWorkflow.value.id}/steps/${stepId}/execute`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        comments: executionComments.value,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(data.message || "Etapa executada com sucesso!", "success")
      await openWorkflowDetails(selectedWorkflow.value)
      await fetchWorkflows()
    } else {
      showToast(data.error || "Falha ao executar etapa.", "error")
    }
  } catch (err: any) {
    showToast("Erro ao processar: " + err.message, "error")
  } finally {
    executingStep.value = false
  }
}

async function handleCreateWorkflow() {
  if (!newWf.value.title.trim()) {
    showToast("Informe o título do processo.", "warning")
    return
  }
  if (!newWf.value.steps.length) {
    showToast("Adicione ao menos uma etapa.", "warning")
    return
  }

  try {
    const res = await apiFetch("/api/workflows", {
      method: "POST",
      body: JSON.stringify({
        title: newWf.value.title,
        category: newWf.value.category,
        description: newWf.value.description,
        employeeName: newWf.value.employee_name || undefined,
        dueDate: newWf.value.due_date || undefined,
        steps: newWf.value.steps,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast("Processo de workflow iniciado com sucesso!", "success")
      showNewModal.value = false
      await fetchWorkflows()
    } else {
      showToast(data.error || "Erro ao criar workflow.", "error")
    }
  } catch (err: any) {
    showToast("Falha de rede ao criar workflow: " + err.message, "error")
  }
}

// Filtros Reativos
const filteredWorkflows = computed(() => {
  return workflows.value.filter((w) => {
    const matchesSearch =
      !searchTerm.value ||
      w.title.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (w.employee_name && w.employee_name.toLowerCase().includes(searchTerm.value.toLowerCase())) ||
      w.category.toLowerCase().includes(searchTerm.value.toLowerCase())

    const matchesCategory = selectedCategory.value === "todos" || w.category === selectedCategory.value
    const matchesStatus = selectedStatus.value === "todos" || w.status === selectedStatus.value

    return matchesSearch && matchesCategory && matchesStatus
  })
})

const workflowsByColumn = computed(() => {
  return {
    em_andamento: filteredWorkflows.value.filter((w) => w.status === "em_andamento"),
    concluido: filteredWorkflows.value.filter((w) => w.status === "concluido"),
    cancelado: filteredWorkflows.value.filter((w) => w.status === "cancelado"),
  }
})

// KPIs
const stats = computed(() => {
  const total = workflows.value.length
  const emAndamento = workflows.value.filter((w) => w.status === "em_andamento").length
  const concluidos = workflows.value.filter((w) => w.status === "concluido").length
  const rate = total > 0 ? Math.round((concluidos / total) * 100) : 100
  return { total, emAndamento, concluidos, rate }
})

function canUserExecuteStep(step: WorkflowStep): boolean {
  const currentRole = activeUserRole.value
  if (currentRole === "ADMIN") return true
  if (currentRole === "RH" && (step.assignee_role === "RH" || step.assignee_role === "COLABORADOR")) return true
  if (currentRole === "GESTOR" && (step.assignee_role === "GESTOR" || step.assignee_role === "COLABORADOR")) return true
  return currentRole === step.assignee_role
}

function getCategoryColor(cat: string): string {
  switch (cat?.toLowerCase()) {
    case "admissão":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    case "férias":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    case "desligamento":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
    case "promoção":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
    default:
      return "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
  }
}

onMounted(() => {
  fetchWorkflows()
})
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-background space-y-6">
    <!-- Header Principal -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
      <div>
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            <GitMerge :size="26" />
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Workflows & Processos de RH
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                Visual Kanban
              </span>
            </h1>
            <p class="text-sm text-muted-foreground mt-0.5">
              Esteiras automatizadas com aprovações por alçada, controle de prazos e auditoria linear.
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="fetchWorkflows"
          :disabled="loading"
          class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Recarregar processos"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">Atualizar</span>
        </button>

        <button
          v-if="hasPermission('workflows.create')"
          @click="showNewModal = true"
          class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all hover:shadow"
        >
          <Plus :size="18" />
          <span>Novo Processo</span>
        </button>
      </div>
    </div>

    <!-- Cards de Métricas / KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="p-4 rounded-xl border bg-card text-card-foreground shadow-2xs">
        <div class="flex items-center justify-between text-muted-foreground mb-1">
          <span class="text-xs font-medium uppercase tracking-wider">Total de Processos</span>
          <GitMerge :size="18" class="text-teal-500" />
        </div>
        <div class="text-2xl font-black text-foreground">{{ stats.total }}</div>
        <span class="text-xs text-muted-foreground">Iniciados no sistema</span>
      </div>

      <div class="p-4 rounded-xl border bg-card text-card-foreground shadow-2xs">
        <div class="flex items-center justify-between text-muted-foreground mb-1">
          <span class="text-xs font-medium uppercase tracking-wider">Em Andamento</span>
          <Clock :size="18" class="text-amber-500" />
        </div>
        <div class="text-2xl font-black text-amber-600 dark:text-amber-400">{{ stats.emAndamento }}</div>
        <span class="text-xs text-muted-foreground">Requerem acompanhamento</span>
      </div>

      <div class="p-4 rounded-xl border bg-card text-card-foreground shadow-2xs">
        <div class="flex items-center justify-between text-muted-foreground mb-1">
          <span class="text-xs font-medium uppercase tracking-wider">Concluídos</span>
          <CheckCircle2 :size="18" class="text-emerald-500" />
        </div>
        <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">{{ stats.concluidos }}</div>
        <span class="text-xs text-muted-foreground">Com todas etapas aprovadas</span>
      </div>

      <div class="p-4 rounded-xl border bg-card text-card-foreground shadow-2xs">
        <div class="flex items-center justify-between text-muted-foreground mb-1">
          <span class="text-xs font-medium uppercase tracking-wider">Taxa de Conclusão</span>
          <FileCheck :size="18" class="text-indigo-500" />
        </div>
        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">{{ stats.rate }}%</div>
        <span class="text-xs text-muted-foreground">Eficiência das esteiras</span>
      </div>
    </div>

    <!-- Barra de Filtros e Busca -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
      <div class="relative flex-1">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Buscar por colaborador, título ou categoria..."
          class="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="selectedCategory"
          class="px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
        >
          <option value="todos">Todas as Categorias</option>
          <option value="Admissão">Admissão</option>
          <option value="Férias">Férias</option>
          <option value="Desligamento">Desligamento</option>
          <option value="Promoção">Promoção</option>
          <option value="Transferência">Transferência</option>
          <option value="Geral">Geral</option>
        </select>
      </div>
    </div>

    <!-- Quadro Kanban de Workflows -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <!-- Coluna: Em Andamento -->
      <div class="flex flex-col bg-muted/40 rounded-xl border p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full bg-amber-500"></span>
            <h2 class="font-bold text-sm text-foreground">Em Andamento</h2>
          </div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            {{ workflowsByColumn.em_andamento.length }}
          </span>
        </div>

        <div class="space-y-3 flex-1 overflow-y-auto">
          <div
            v-for="wf in workflowsByColumn.em_andamento"
            :key="wf.id"
            @click="openWorkflowDetails(wf)"
            class="p-4 rounded-xl bg-card border border-border/80 hover:border-teal-500/50 shadow-2xs hover:shadow transition-all cursor-pointer group space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border" :class="getCategoryColor(wf.category)">
                {{ wf.category }}
              </span>
              <span class="text-[10px] font-mono text-muted-foreground">#{{ wf.id.slice(-6) }}</span>
            </div>

            <h3 class="font-bold text-sm text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2">
              {{ wf.title }}
            </h3>

            <div v-if="wf.employee_name" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User :size="13" class="text-teal-500" />
              <span class="font-medium text-foreground truncate">{{ wf.employee_name }}</span>
            </div>

            <!-- Barra de Progresso -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] text-muted-foreground">
                <span>Progresso</span>
                <span class="font-bold text-foreground">{{ wf.completed_steps || 0 }} de {{ wf.total_steps || 0 }} ({{ wf.progress || 0 }}%)</span>
              </div>
              <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-teal-500 rounded-full transition-all duration-300"
                  :style="{ width: `${wf.progress || 0}%` }"
                ></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span v-if="wf.due_date" class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Calendar :size="12" /> Prazo: {{ new Date(wf.due_date).toLocaleDateString('pt-BR') }}
              </span>
              <span v-else>Sem prazo definido</span>

              <span class="text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Ver detalhes <ChevronRight :size="14" />
              </span>
            </div>
          </div>

          <div v-if="!workflowsByColumn.em_andamento.length" class="text-center py-10 text-muted-foreground text-xs">
            Nenhum processo em andamento no momento.
          </div>
        </div>
      </div>

      <!-- Coluna: Concluídos -->
      <div class="flex flex-col bg-muted/40 rounded-xl border p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full bg-emerald-500"></span>
            <h2 class="font-bold text-sm text-foreground">Concluídos</h2>
          </div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            {{ workflowsByColumn.concluido.length }}
          </span>
        </div>

        <div class="space-y-3 flex-1 overflow-y-auto">
          <div
            v-for="wf in workflowsByColumn.concluido"
            :key="wf.id"
            @click="openWorkflowDetails(wf)"
            class="p-4 rounded-xl bg-card border border-border/80 hover:border-emerald-500/50 shadow-2xs hover:shadow transition-all cursor-pointer group space-y-3 opacity-90 hover:opacity-100"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border" :class="getCategoryColor(wf.category)">
                {{ wf.category }}
              </span>
              <span class="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 :size="14" /> 100%
              </span>
            </div>

            <h3 class="font-bold text-sm text-foreground group-hover:text-emerald-600 transition-colors line-clamp-2">
              {{ wf.title }}
            </h3>

            <div v-if="wf.employee_name" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User :size="13" class="text-emerald-500" />
              <span class="font-medium text-foreground truncate">{{ wf.employee_name }}</span>
            </div>

            <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Finalizado com sucesso</span>
              <span class="text-emerald-600 font-semibold flex items-center gap-0.5">
                Histórico <ChevronRight :size="14" />
              </span>
            </div>
          </div>

          <div v-if="!workflowsByColumn.concluido.length" class="text-center py-10 text-muted-foreground text-xs">
            Nenhum processo concluído ainda.
          </div>
        </div>
      </div>

      <!-- Coluna: Cancelados / Arquivados -->
      <div class="flex flex-col bg-muted/40 rounded-xl border p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full bg-rose-500"></span>
            <h2 class="font-bold text-sm text-foreground">Cancelados / Arquivados</h2>
          </div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            {{ workflowsByColumn.cancelado.length }}
          </span>
        </div>

        <div class="space-y-3 flex-1 overflow-y-auto">
          <div
            v-for="wf in workflowsByColumn.cancelado"
            :key="wf.id"
            @click="openWorkflowDetails(wf)"
            class="p-4 rounded-xl bg-card border border-border/80 hover:border-rose-500/50 shadow-2xs hover:shadow transition-all cursor-pointer group space-y-3 opacity-75 hover:opacity-100"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border" :class="getCategoryColor(wf.category)">
                {{ wf.category }}
              </span>
              <span class="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                <XCircle :size="14" /> Cancelado
              </span>
            </div>

            <h3 class="font-bold text-sm text-foreground line-clamp-2">
              {{ wf.title }}
            </h3>

            <div v-if="wf.employee_name" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User :size="13" class="text-rose-500" />
              <span class="font-medium text-foreground truncate">{{ wf.employee_name }}</span>
            </div>

            <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Processo interrompido</span>
              <span class="text-rose-600 font-semibold flex items-center gap-0.5">
                Ver motivo <ChevronRight :size="14" />
              </span>
            </div>
          </div>

          <div v-if="!workflowsByColumn.cancelado.length" class="text-center py-10 text-muted-foreground text-xs">
            Nenhum processo cancelado.
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Detalhes e Execução de Etapas -->
    <div
      v-if="showDetailModal && selectedWorkflow"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-card w-full max-w-3xl rounded-2xl border shadow-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- Topo do Modal -->
        <div class="p-5 border-b flex items-center justify-between bg-muted/20">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-md border" :class="getCategoryColor(selectedWorkflow.category)">
                {{ selectedWorkflow.category }}
              </span>
              <span class="text-xs font-mono text-muted-foreground">#{{ selectedWorkflow.id }}</span>
            </div>
            <h2 class="text-lg font-bold text-foreground">{{ selectedWorkflow.title }}</h2>
            <p v-if="selectedWorkflow.employee_name" class="text-xs text-muted-foreground">
              Colaborador: <strong class="text-foreground">{{ selectedWorkflow.employee_name }}</strong>
            </p>
          </div>
          <button
            @click="showDetailModal = false"
            class="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Conteúdo com Stepper Visual e Histórico -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- Stepper de Etapas -->
          <div>
            <h3 class="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <GitMerge :size="16" class="text-teal-500" />
              Esteira de Aprovação & Execução
            </h3>

            <div class="space-y-4">
              <div
                v-for="(step, idx) in selectedWorkflow.steps"
                :key="step.id"
                class="p-4 rounded-xl border transition-all"
                :class="{
                  'bg-emerald-500/5 border-emerald-500/30': step.status === 'concluido',
                  'bg-amber-500/10 border-amber-500/40 shadow-xs ring-1 ring-amber-500/20': step.status === 'em_execucao',
                  'bg-rose-500/5 border-rose-500/30': step.status === 'rejeitado',
                  'bg-card border-border/70 opacity-80': step.status === 'pendente',
                }"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                      :class="{
                        'bg-emerald-500 text-white': step.status === 'concluido',
                        'bg-amber-500 text-white animate-pulse': step.status === 'em_execucao',
                        'bg-rose-500 text-white': step.status === 'rejeitado',
                        'bg-muted text-muted-foreground': step.status === 'pendente',
                      }"
                    >
                      <CheckCircle2 v-if="step.status === 'concluido'" :size="16" />
                      <XCircle v-else-if="step.status === 'rejeitado'" :size="16" />
                      <span v-else>{{ idx + 1 }}</span>
                    </div>

                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-bold text-foreground">{{ step.title }}</h4>
                        <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">
                          Alçada: {{ step.assignee_role }}
                        </span>
                      </div>
                      <p v-if="step.description" class="text-xs text-muted-foreground">{{ step.description }}</p>

                      <!-- Detalhes de Conclusão -->
                      <div v-if="step.completed_at" class="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-1">
                        ✓ Concluído por {{ step.completed_by_name || 'Responsável' }} em {{ new Date(step.completed_at).toLocaleString('pt-BR') }}
                      </div>
                      <div v-if="step.comments" class="text-xs bg-background/80 p-2 rounded border mt-2 text-foreground italic">
                        "{{ step.comments }}"
                      </div>
                    </div>
                  </div>

                  <span
                    class="text-xs font-semibold px-2 py-1 rounded-md capitalize"
                    :class="{
                      'text-emerald-600 bg-emerald-500/10': step.status === 'concluido',
                      'text-amber-600 bg-amber-500/10': step.status === 'em_execucao',
                      'text-rose-600 bg-rose-500/10': step.status === 'rejeitado',
                      'text-muted-foreground bg-muted': step.status === 'pendente',
                    }"
                  >
                    {{ step.status.replace('_', ' ') }}
                  </span>
                </div>

                <!-- Painel de Ação para o Usuário Autorizado -->
                <div
                  v-if="step.status === 'em_execucao' && selectedWorkflow.status === 'em_andamento'"
                  class="mt-4 pt-3 border-t border-amber-500/20 space-y-3"
                >
                  <div v-if="canUserExecuteStep(step)">
                    <label class="block text-xs font-medium text-foreground mb-1">
                      Parecer / Justificativa da Alçada (Opcional):
                    </label>
                    <textarea
                      v-model="executionComments"
                      rows="2"
                      placeholder="Descreva o parecer de aprovação ou motivo de recusa..."
                      class="w-full text-xs p-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    ></textarea>

                    <div class="flex items-center justify-end gap-2 mt-2">
                      <button
                        @click="handleExecuteStep('rejeitar', step.id)"
                        :disabled="executingStep"
                        class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/30 transition-colors disabled:opacity-50"
                      >
                        Rejeitar / Reprovar
                      </button>
                      <button
                        @click="handleExecuteStep('concluir', step.id)"
                        :disabled="executingStep"
                        class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 :size="14" />
                        Aprovar e Avançar Etapa
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg border flex items-center gap-2">
                    <ShieldCheck :size="16" class="text-amber-500" />
                    Esta etapa aguarda ação de um usuário com alçada <strong>{{ step.assignee_role }}</strong>.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Trilha de Histórico & Auditoria -->
          <div v-if="selectedWorkflow.history && selectedWorkflow.history.length" class="border-t pt-5">
            <h3 class="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <History :size="16" class="text-teal-500" />
              Linha do Tempo de Auditoria
            </h3>
            <div class="space-y-2">
              <div
                v-for="h in selectedWorkflow.history"
                :key="h.id"
                class="flex items-start gap-3 text-xs p-2.5 rounded-lg bg-muted/30 border border-border/40"
              >
                <div class="font-bold text-foreground min-w-[130px]">
                  {{ new Date(h.created_at).toLocaleString('pt-BR') }}
                </div>
                <div class="flex-1 space-y-0.5">
                  <div class="font-medium text-foreground">
                    {{ h.actor_name || 'Usuário' }} ({{ h.actor_role }}) —
                    <span class="text-teal-600 font-bold uppercase">{{ h.action.replace('WORKFLOW_STEP_', '') }}</span>
                    em "{{ h.step_title }}"
                  </div>
                  <div v-if="h.comments" class="text-muted-foreground italic">"{{ h.comments }}"</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Criação de Novo Workflow -->
    <div
      v-if="showNewModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-card w-full max-w-2xl rounded-2xl border shadow-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="p-5 border-b flex items-center justify-between bg-muted/20">
          <div>
            <h2 class="text-lg font-bold text-foreground flex items-center gap-2">
              <GitMerge :size="20" class="text-teal-500" />
              Abrir Novo Processo de RH
            </h2>
            <p class="text-xs text-muted-foreground">Selecione um template corporativo ou customize as etapas de aprovação.</p>
          </div>
          <button @click="showNewModal = false" class="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
            <X :size="20" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto space-y-4 flex-1">
          <!-- Template Selector -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground">Modelo Pré-definido:</label>
            <select
              v-model="newWf.template"
              @change="handleTemplateChange"
              class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            >
              <option value="admissao">Esteira de Admissão & Onboarding (4 etapas)</option>
              <option value="ferias">Programação e Homologação de Férias (3 etapas)</option>
              <option value="desligamento">Offboarding & Rescisão Contratual (4 etapas)</option>
              <option value="promocao">Promoção & Revisão de Cargo/Salário (3 etapas)</option>
            </select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Título do Processo *</label>
              <input
                v-model="newWf.title"
                type="text"
                placeholder="Ex.: Admissão Desenvolvedor Frontend"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Colaborador Associado</label>
              <input
                v-model="newWf.employee_name"
                type="text"
                placeholder="Nome completo do colaborador"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Categoria</label>
              <select
                v-model="newWf.category"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              >
                <option value="Admissão">Admissão</option>
                <option value="Férias">Férias</option>
                <option value="Desligamento">Desligamento</option>
                <option value="Promoção">Promoção</option>
                <option value="Transferência">Transferência</option>
                <option value="Geral">Geral</option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Prazo Final Limite</label>
              <input
                v-model="newWf.due_date"
                type="date"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          </div>

          <!-- Etapas Personalizáveis -->
          <div class="border-t pt-4 space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground">Etapas e Alçadas de Aprovação:</label>
              <button
                type="button"
                @click="addStepToNewWf"
                class="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline"
              >
                <Plus :size="14" /> Adicionar Etapa
              </button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(st, idx) in newWf.steps"
                :key="idx"
                class="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30"
              >
                <span class="text-xs font-bold w-5 text-center text-muted-foreground">{{ idx + 1 }}.</span>
                <input
                  v-model="st.title"
                  type="text"
                  placeholder="Nome da etapa"
                  class="flex-1 px-2.5 py-1.5 text-xs rounded border bg-background"
                />
                <select
                  v-model="st.assignee_role"
                  class="px-2 py-1.5 text-xs rounded border bg-background font-semibold"
                >
                  <option value="RH">RH</option>
                  <option value="ADMIN">ADMIN / TI</option>
                  <option value="GESTOR">GESTOR</option>
                  <option value="COLABORADOR">COLABORADOR</option>
                </select>
                <button
                  type="button"
                  @click="removeStepFromNewWf(idx)"
                  class="p-1 text-muted-foreground hover:text-rose-500"
                  title="Remover etapa"
                >
                  <X :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <button
            @click="showNewModal = false"
            class="px-4 py-2 text-sm font-semibold rounded-lg border hover:bg-muted transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            @click="handleCreateWorkflow"
            class="px-5 py-2 text-sm font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            Criar & Iniciar Workflow
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
