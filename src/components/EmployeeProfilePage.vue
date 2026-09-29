<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  ArrowLeft,
  Edit3,
  Users,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  UserCheck,
  Mail,
  Phone,
  Hash,
  FileText,
  Palmtree,
  CalendarClock,
  History,
  Download,
  Eye,
  AlertCircle,
  FolderArchive,
  Plus,
  X,
  FileCheck2,
  Sparkles,
  ShieldAlert,
} from "lucide-vue-next"
import {
  apiFetch,
  userPermissions,
  currentUser,
  showToast,
} from "../store"
import type { EmployeeFolder, ContractType, WorkSchedule, DocCategory } from "../data"
import { contractTypeConfigs, workScheduleConfigs, docCategoryLabels } from "../data"
import UserAvatar from "./UserAvatar.vue"
import NewEmployeeFolderModal from "./NewEmployeeFolderModal.vue"
import ExportDossierModal from "./ExportDossierModal.vue"
import CorporateFeedModule from "./CorporateFeedModule.vue"

const route = useRoute()
const router = useRouter()

const employeeId = computed(() => String(route.params.id || ""))

interface EmployeeDetail {
  id: string
  name: string
  role: string
  department: string
  status: string
  email: string
  phone: string
  cpf: string
  hireDate: string
  terminationDate?: string
  salary: string
  manager: string
  location: string
  contractType?: string
  workSchedule?: string
  birthDate?: string
  address?: string
  city?: string
  state?: string
  cep?: string
  notes?: string
  tenure?: string
}

interface DocumentItem {
  id: string
  name: string
  category: string
  employeeName: string
  expiryDate?: string
  date: string
  status: string
  fileUrl: string
  type: string
}

interface RequestItem {
  id: string
  type: string
  requester: string
  department: string
  date: string
  status: string
  priority: string
  description: string
  details?: any
}

interface VacationData {
  diasDisponiveis: number
  diasUtilizados: number
  solicitacoesFerias: RequestItem[]
  proximoPeriodo: string
  temFeriasPendentes: boolean
}

interface HistoryItem {
  id: string
  type: string
  title: string
  description: string
  old_value?: string
  new_value?: string
  created_by?: string
  created_at: string
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)
const employee = ref<EmployeeDetail | null>(null)
const documents = ref<DocumentItem[]>([])
const requests = ref<RequestItem[]>([])
const vacation = ref<VacationData>({
  diasDisponiveis: 30,
  diasUtilizados: 0,
  solicitacoesFerias: [],
  proximoPeriodo: "Período Aquisitivo 2024/2025",
  temFeriasPendentes: false,
})
const history = ref<HistoryItem[]>([])

const activeTab = ref<
  "resumo" | "pessoais" | "profissionais" | "documentos" | "ferias" | "solicitacoes" | "historico" | "feed"
>("resumo")

const requestStatusFilter = ref("todos")
const showEditModal = ref(false)
const showExportDossierModal = ref(false)
const showAddDocModal = ref(false)
const previewDocModal = ref<DocumentItem | null>(null)

// Form de novo documento
const newDocName = ref("")
const newDocCategory = ref("pessoais")
const newDocValidity = ref("")

function getContractMeta(ct?: string) {
  const key = (ct as ContractType) || "prazo_indeterminado"
  return contractTypeConfigs[key] || contractTypeConfigs.prazo_indeterminado
}

function getScheduleMeta(ws?: string) {
  const key = (ws as WorkSchedule) || "escala_5x2"
  return workScheduleConfigs[key] || workScheduleConfigs.escala_5x2
}

function getCategoryLabel(cat?: string) {
  const key = cat as DocCategory
  return docCategoryLabels[key] || cat || "Documento"
}

async function fetchEmployeeProfile() {
  if (!employeeId.value) return
  loading.value = true
  errorMsg.value = null

  try {
    const res = await apiFetch(`/api/employees/${employeeId.value}`)
    const json = await res.json()

    if (json.ok && json.employee) {
      employee.value = json.employee
      documents.value = json.documents || []
      requests.value = json.requests || []
      if (json.vacation) vacation.value = json.vacation
      history.value = json.history || []
    } else {
      errorMsg.value = json.error || "Colaborador não encontrado na organização."
    }
  } catch (err: any) {
    errorMsg.value = err?.message || "Erro de conexão ao buscar dados do funcionário."
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchEmployeeProfile()
})

const employeeInitials = computed(() => {
  if (!employee.value?.name) return "US"
  return employee.value.name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
})

/* RBAC — Visualização de Salário */
const canViewSalary = computed(() => {
  if (userPermissions.value.canManagePayroll) return true
  if (currentUser.value?.email && employee.value?.email) {
    return currentUser.value.email.toLowerCase() === employee.value.email.toLowerCase()
  }
  return false
})

const maskedSalary = computed(() => {
  if (canViewSalary.value) return employee.value?.salary || "R$ 0,00"
  return "••••••••"
})

/* RBAC — Mascaramento de CPF */
const formattedCpf = computed(() => {
  const raw = employee.value?.cpf || ""
  if (canViewSalary.value) return raw
  if (raw.length >= 11) {
    return raw.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.***.***-$4")
  }
  return raw
})

/* Badge de Status */
const statusBadgeConfig = computed(() => {
  const st = (employee.value?.status || "ativo").toLowerCase()
  if (st === "ativo") {
    return { label: "Ativo", bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" }
  }
  if (st.includes("ferias") || st.includes("férias")) {
    return { label: "Em Férias", bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/30" }
  }
  if (st === "afastado") {
    return { label: "Afastado", bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/30" }
  }
  return { label: "Inativo / Desligado", bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", border: "border-rose-500/30" }
})

/* Solicitações filtradas */
const filteredRequests = computed(() => {
  if (requestStatusFilter.value === "todos") return requests.value
  return requests.value.filter(
    (r) => (r.status || "").toLowerCase().replace("_", " ") === requestStatusFilter.value.toLowerCase()
  )
})

/* Adaptador para NewEmployeeFolderModal */
const folderToEditAdapter = computed<EmployeeFolder | null>(() => {
  if (!employee.value) return null
  return {
    id: employee.value.id,
    name: employee.value.name,
    initials: employeeInitials.value,
    cpf: employee.value.cpf,
    registration: employee.value.id.replace("emp_", "") || "101",
    role: employee.value.role,
    department: employee.value.department,
    email: employee.value.email,
    phone: employee.value.phone,
    location: employee.value.location,
    tenure: employee.value.tenure || "1 ano",
    manager: employee.value.manager,
    admissionDate: employee.value.hireDate,
    status: (employee.value.status?.toLowerCase() === "ativo" ? "ativo" : "ativo") as any,
    documents: [],
    salary: employee.value.salary,
    contractType: (employee.value.contractType as any) || "prazo_indeterminado",
    workSchedule: (employee.value.workSchedule as any) || "escala_5x2",
    cep: employee.value.cep,
    street: employee.value.address,
    city: employee.value.city,
    state: employee.value.state,
    notes: employee.value.notes,
  }
})

function handleEmployeeUpdated() {
  showEditModal.value = false
  showToast("Dados do colaborador atualizados com sucesso!", "success")
  fetchEmployeeProfile()
}

function handleAddDocument() {
  if (!newDocName.value.trim() || !employee.value) return
  const newDoc: DocumentItem = {
    id: `doc_${Date.now()}`,
    name: newDocName.value,
    category: newDocCategory.value,
    employeeName: employee.value.name,
    expiryDate: newDocValidity.value || undefined,
    date: new Date().toISOString().split("T")[0],
    status: "Válido",
    fileUrl: "#",
    type: newDocName.value.toLowerCase().endsWith(".pdf") ? "PDF" : "DOC",
  }
  documents.value.unshift(newDoc)
  newDocName.value = ""
  newDocValidity.value = ""
  showAddDocModal.value = false
  showToast("Documento anexado com sucesso ao perfil!", "success")
}

function goBack() {
  router.push("/colaboradores")
}
</script>

<template>
  <main class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative">
    <!-- 1. LOADING SKELETON -->
    <div v-if="loading" class="p-6 sm:p-8 space-y-6 max-w-6xl mx-auto w-full animate-pulse">
      <div class="h-4 w-32 bg-muted rounded"></div>
      <div class="h-32 bg-card rounded-2xl border p-6 flex items-center gap-4">
        <div class="h-20 w-20 bg-muted rounded-2xl"></div>
        <div class="space-y-2 flex-1">
          <div class="h-6 w-48 bg-muted rounded"></div>
          <div class="h-4 w-36 bg-muted/60 rounded"></div>
        </div>
      </div>
      <div class="h-10 bg-muted/40 rounded-xl"></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-24 bg-card rounded-2xl border"></div>
      </div>
    </div>

    <!-- 2. ERRO DE CARREGAMENTO -->
    <div v-else-if="errorMsg" class="p-6 sm:p-12 max-w-2xl mx-auto w-full text-center space-y-4">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
        <AlertCircle :size="32" />
      </div>
      <h2 class="text-xl font-bold text-foreground">Colaborador não encontrado</h2>
      <p class="text-xs text-muted-foreground leading-relaxed">{{ errorMsg }}</p>
      <div class="pt-2">
        <button
          class="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition-colors cursor-pointer"
          @click="goBack"
        >
          <ArrowLeft :size="15" /> Voltar para a Lista de Colaboradores
        </button>
      </div>
    </div>

    <!-- 3. PERFIL COMPLETO DO COLABORADOR -->
    <div v-else-if="employee" class="w-full max-w-6xl mx-auto px-5 py-6 sm:px-8 space-y-6">
      <!-- Breadcrumb / Botão Voltar -->
      <div class="flex items-center justify-between">
        <button
          class="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          @click="goBack"
        >
          <ArrowLeft :size="16" /> Voltar para Lista de Colaboradores
        </button>

        <span class="text-xs text-muted-foreground">
          Matrícula: <strong class="font-mono text-foreground">{{ employee.id.replace('emp_', '') }}</strong>
        </span>
      </div>

      <!-- HEADER DO FUNCIONÁRIO -->
      <section class="rounded-3xl border bg-card p-6 shadow-sm">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <div class="relative">
              <UserAvatar :initials="employeeInitials" :size="72" />
              <span
                class="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card"
                :class="employee.status?.toLowerCase() === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'"
                :title="employee.status"
              ></span>
            </div>

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2.5">
                <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {{ employee.name }}
                </h1>
                <span
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border shadow-2xs"
                  :class="[statusBadgeConfig.bg, statusBadgeConfig.text, statusBadgeConfig.border]"
                >
                  {{ statusBadgeConfig.label }}
                </span>
              </div>

              <p class="text-sm font-medium text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                <span>{{ employee.role }}</span>
                <span>·</span>
                <span class="text-foreground font-semibold flex items-center gap-1">
                  <Building2 :size="14" class="text-teal-600" /> {{ employee.department }}
                </span>
              </p>

              <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span class="flex items-center gap-1 font-mono">
                  <Hash :size="13" /> ID: {{ employee.id.replace('emp_', '') }}
                </span>
                <span class="flex items-center gap-1">
                  <Mail :size="13" /> {{ employee.email }}
                </span>
                <span v-if="employee.phone" class="flex items-center gap-1">
                  <Phone :size="13" /> {{ employee.phone }}
                </span>
              </div>
            </div>
          </div>

          <!-- Ações do Header -->
          <div class="flex flex-wrap items-center gap-2.5 border-t pt-4 sm:border-t-0 sm:pt-0">
            <button
              class="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50/80 dark:bg-rose-950/40 dark:border-rose-700 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all shadow-2xs cursor-pointer"
              @click="router.push('/eventos-adversos')"
              title="Canal confidencial de ouvidoria e relato de eventos adversos"
            >
              <ShieldAlert :size="16" class="text-rose-600" />
              <span>Ouvidoria & Incidentes</span>
            </button>

            <button
              class="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 dark:border-indigo-700 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all shadow-2xs cursor-pointer"
              @click="showExportDossierModal = true"
              title="Exportar dossiê completo em PDF"
            >
              <FolderArchive :size="16" class="text-indigo-600" />
              <span>Dossiê PDF</span>
            </button>

            <button
              v-if="!userPermissions.isColaborador"
              class="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-700 transition-all active:scale-95 cursor-pointer"
              @click="showEditModal = true"
            >
              <Edit3 :size="15" />
              <span>Editar Funcionário</span>
            </button>
          </div>
        </div>

        <!-- NAVEGAÇÃO POR ABAS -->
        <div class="mt-6 flex gap-1 border-t pt-4 overflow-x-auto scrollbar-thin">
          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'resumo' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'resumo'"
          >
            <Users :size="15" />
            <span>1. Resumo</span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'pessoais' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'pessoais'"
          >
            <UserCheck :size="15" />
            <span>2. Dados Pessoais</span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'profissionais' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'profissionais'"
          >
            <Briefcase :size="15" />
            <span>3. Dados Profissionais</span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'documentos' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'documentos'"
          >
            <FileText :size="15" />
            <span>4. Documentos</span>
            <span class="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px]">{{ documents.length }}</span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'ferias' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'ferias'"
          >
            <Palmtree :size="15" />
            <span>5. Férias</span>
            <span v-if="vacation.diasDisponiveis" class="ml-1 rounded-full bg-teal-500/20 text-teal-800 px-1.5 py-0.2 text-[10px]">
              {{ vacation.diasDisponiveis }}d
            </span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'solicitacoes' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'solicitacoes'"
          >
            <CalendarClock :size="15" />
            <span>6. Solicitações</span>
            <span class="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px]">{{ requests.length }}</span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'historico' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'historico'"
          >
            <History :size="15" />
            <span>7. Histórico & Auditoria</span>
            <span class="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px]">{{ history.length }}</span>
          </button>

          <button
            class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="activeTab === 'feed' ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeTab = 'feed'"
          >
            <Sparkles :size="15" />
            <span>8. Feed & Comunicados</span>
          </button>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 1 — RESUMO -->
      <!-- ================================================== -->
      <section v-if="activeTab === 'resumo'" class="space-y-6">
        <!-- 4 CARDS RESUMIDOS -->
        <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div class="rounded-2xl border bg-card p-4 transition-all hover:shadow-2xs">
            <div class="flex items-center justify-between text-teal-700">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Férias Disponíveis</span>
              <Palmtree :size="18" />
            </div>
            <p class="mt-2 text-2xl font-bold text-foreground">{{ vacation.diasDisponiveis }} dias</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">{{ vacation.proximoPeriodo }}</p>
          </div>

          <div class="rounded-2xl border bg-card p-4 transition-all hover:shadow-2xs">
            <div class="flex items-center justify-between text-amber-600">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solicitações Pendentes</span>
              <CalendarClock :size="18" />
            </div>
            <p class="mt-2 text-2xl font-bold text-foreground">
              {{ requests.filter(r => ['pendente', 'em análise', 'em_analise'].includes(r.status?.toLowerCase())).length }}
            </p>
            <p class="text-[11px] text-muted-foreground mt-0.5">Em tramitação no RH</p>
          </div>

          <div class="rounded-2xl border bg-card p-4 transition-all hover:shadow-2xs">
            <div class="flex items-center justify-between text-blue-600">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documentos</span>
              <FileText :size="18" />
            </div>
            <p class="mt-2 text-2xl font-bold text-foreground">{{ documents.length }} arquivos</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">Dossiê arquivado</p>
          </div>

          <div class="rounded-2xl border bg-card p-4 transition-all hover:shadow-2xs">
            <div class="flex items-center justify-between text-emerald-600">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tempo de Empresa</span>
              <Clock :size="18" />
            </div>
            <p class="mt-2 text-2xl font-bold text-foreground">{{ employee.tenure }}</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">Desde {{ employee.hireDate }}</p>
          </div>
        </div>

        <!-- QUADRO DE DETALHES PRINCIPAIS -->
        <div class="rounded-3xl border bg-card p-6 shadow-2xs space-y-4">
          <h3 class="font-bold text-sm text-foreground flex items-center gap-2 border-b pb-3">
            <Briefcase :size="16" class="text-teal-600" />
            Informações Gerais do Vínculo
          </h3>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <div class="p-3 rounded-xl bg-background border space-y-1">
              <span class="text-muted-foreground font-semibold uppercase text-[10px]">Cargo Atual</span>
              <p class="font-bold text-sm text-foreground">{{ employee.role }}</p>
            </div>

            <div class="p-3 rounded-xl bg-background border space-y-1">
              <span class="text-muted-foreground font-semibold uppercase text-[10px]">Departamento</span>
              <p class="font-bold text-sm text-foreground">{{ employee.department }}</p>
            </div>

            <div class="p-3 rounded-xl bg-background border space-y-1">
              <span class="text-muted-foreground font-semibold uppercase text-[10px]">Data de Admissão</span>
              <p class="font-bold text-sm text-foreground">{{ employee.hireDate }}</p>
            </div>

            <div class="p-3 rounded-xl bg-background border space-y-1">
              <span class="text-muted-foreground font-semibold uppercase text-[10px]">Gestor / Responsável</span>
              <p class="font-bold text-sm text-foreground">{{ employee.manager }}</p>
            </div>

            <div class="p-3 rounded-xl bg-background border space-y-1">
              <span class="text-muted-foreground font-semibold uppercase text-[10px]">Salário Base (CLT)</span>
              <p class="font-bold text-sm font-mono text-emerald-700 dark:text-emerald-300">
                {{ maskedSalary }}
              </p>
            </div>

            <div class="p-3 rounded-xl bg-background border space-y-1">
              <span class="text-muted-foreground font-semibold uppercase text-[10px]">Email Corporativo</span>
              <p class="font-bold text-sm text-foreground truncate">{{ employee.email }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 2 — DADOS PESSOAIS -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'pessoais'" class="rounded-3xl border bg-card p-6 shadow-2xs space-y-6">
        <div class="border-b pb-3">
          <h3 class="font-bold text-base text-foreground flex items-center gap-2">
            <UserCheck :size="18" class="text-teal-600" />
            Dados Pessoais & Cadastrais
          </h3>
          <p class="text-xs text-muted-foreground">Informações de identificação civil do colaborador</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Nome Completo</span>
            <p class="font-bold text-sm text-foreground">{{ employee.name }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">CPF</span>
            <p class="font-mono font-bold text-sm text-foreground">{{ formattedCpf }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Data de Nascimento</span>
            <p class="font-bold text-sm text-foreground">{{ employee.birthDate || 'Não informada' }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">E-mail</span>
            <p class="font-bold text-sm text-foreground truncate">{{ employee.email }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Telefone</span>
            <p class="font-bold text-sm text-foreground">{{ employee.phone || 'Não informado' }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">CEP</span>
            <p class="font-mono font-bold text-sm text-foreground">{{ employee.cep || '01310-100' }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background sm:col-span-2">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Endereço Residencial</span>
            <p class="font-bold text-sm text-foreground">{{ employee.address || employee.location }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Cidade / Estado</span>
            <p class="font-bold text-sm text-foreground">
              {{ employee.city || 'São Paulo' }} / {{ employee.state || 'SP' }}
            </p>
          </div>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 3 — DADOS PROFISSIONAIS -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'profissionais'" class="rounded-3xl border bg-card p-6 shadow-2xs space-y-6">
        <div class="border-b pb-3">
          <h3 class="font-bold text-base text-foreground flex items-center gap-2">
            <Briefcase :size="18" class="text-teal-600" />
            Dados do Contrato de Trabalho
          </h3>
          <p class="text-xs text-muted-foreground">Parâmetros de contratação, jornada e remuneração</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Cargo / Função</span>
            <p class="font-bold text-sm text-foreground">{{ employee.role }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Departamento</span>
            <p class="font-bold text-sm text-foreground">{{ employee.department }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Tipo de Contrato</span>
            <div class="mt-1">
              <span
                class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold"
                :class="[getContractMeta(employee.contractType).badgeBg, getContractMeta(employee.contractType).badgeColor]"
              >
                <FileCheck2 :size="13" />
                {{ getContractMeta(employee.contractType).label }}
              </span>
            </div>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Escala de Trabalho</span>
            <div class="mt-1">
              <span
                class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold"
                :class="[getScheduleMeta(employee.workSchedule).badgeBg, getScheduleMeta(employee.workSchedule).badgeColor]"
              >
                <Clock :size="13" />
                {{ getScheduleMeta(employee.workSchedule).label }}
              </span>
            </div>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Data de Admissão</span>
            <p class="font-bold text-sm text-foreground">{{ employee.hireDate }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Data de Desligamento</span>
            <p class="font-bold text-sm text-foreground">{{ employee.terminationDate || 'Em vigor (Não aplicável)' }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Salário Base</span>
            <p class="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">{{ maskedSalary }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Gestor Imediato</span>
            <p class="font-bold text-sm text-foreground">{{ employee.manager }}</p>
          </div>

          <div class="space-y-1 p-3.5 rounded-xl border bg-background">
            <span class="text-muted-foreground uppercase text-[10px] font-semibold">Status Cadastral</span>
            <p class="font-bold text-sm text-foreground">{{ employee.status }}</p>
          </div>
        </div>

        <div v-if="employee.notes" class="p-4 rounded-2xl border bg-muted/40 text-xs">
          <span class="font-bold text-foreground uppercase tracking-wider text-[10px] block mb-1">Anotações do Prontuário</span>
          <p class="text-muted-foreground italic leading-relaxed">"{{ employee.notes }}"</p>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 4 — DOCUMENTOS -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'documentos'" class="rounded-3xl border bg-card p-6 shadow-2xs space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
          <div>
            <h3 class="font-bold text-base text-foreground flex items-center gap-2">
              <FileText :size="18" class="text-teal-600" />
              Documentos & Prontuário Digital
            </h3>
            <p class="text-xs text-muted-foreground">Documentos arquivados, contratos e atestados ocupacionais</p>
          </div>

          <button
            v-if="!userPermissions.isColaborador"
            class="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 transition-colors shadow cursor-pointer self-start"
            @click="showAddDocModal = true"
          >
            <Plus :size="15" /> Anexar Documento
          </button>
        </div>

        <div v-if="!documents.length" class="text-center py-12 text-xs text-muted-foreground space-y-2">
          <FileText :size="32" class="mx-auto text-muted-foreground/60" />
          <p class="font-medium">Nenhum documento cadastrado na pasta deste colaborador.</p>
        </div>

        <div v-else class="overflow-x-auto rounded-2xl border bg-background">
          <table class="w-full text-left text-xs">
            <thead class="border-b bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th class="p-3.5">Documento</th>
                <th class="p-3.5">Categoria</th>
                <th class="p-3.5">Data de Envio</th>
                <th class="p-3.5">Validade</th>
                <th class="p-3.5">Status</th>
                <th class="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="doc in documents" :key="doc.id" class="hover:bg-muted/30 transition-colors">
                <td class="p-3.5">
                  <div class="flex items-center gap-2.5">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 font-bold text-[10px]">
                      {{ doc.type || 'PDF' }}
                    </span>
                    <span class="font-semibold text-foreground truncate max-w-xs">{{ doc.name }}</span>
                  </div>
                </td>
                <td class="p-3.5">
                  <span class="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {{ getCategoryLabel(doc.category) }}
                  </span>
                </td>
                <td class="p-3.5 text-muted-foreground">{{ doc.date }}</td>
                <td class="p-3.5 text-muted-foreground">
                  <span v-if="doc.expiryDate" class="font-mono">{{ doc.expiryDate }}</span>
                  <span v-else class="text-muted-foreground/60">Indeterminada</span>
                </td>
                <td class="p-3.5">
                  <span
                    class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    :class="doc.status?.toLowerCase().includes('próximo') ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'"
                  >
                    {{ doc.status || 'Válido' }}
                  </span>
                </td>
                <td class="p-3.5 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                      @click="previewDocModal = doc"
                    >
                      <Eye :size="13" /> Visualizar
                    </button>
                    <button
                      class="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 transition-colors cursor-pointer"
                      @click="showToast(`Download de ${doc.name} iniciado.`)"
                    >
                      <Download :size="13" /> Baixar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 5 — FÉRIAS -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'ferias'" class="rounded-3xl border bg-card p-6 shadow-2xs space-y-6">
        <div class="border-b pb-3">
          <h3 class="font-bold text-base text-foreground flex items-center gap-2">
            <Palmtree :size="18" class="text-teal-600" />
            Controle & Saldo de Férias
          </h3>
          <p class="text-xs text-muted-foreground">Períodos aquisitivos, concessivos e histórico de solicitações</p>
        </div>

        <!-- Indicador de Saldo -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="rounded-2xl border bg-background p-4 flex items-center gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
              <Palmtree :size="24" />
            </span>
            <div>
              <span class="text-xs font-semibold text-muted-foreground">Dias Disponíveis</span>
              <p class="text-2xl font-bold text-foreground">{{ vacation.diasDisponiveis }} dias</p>
            </div>
          </div>

          <div class="rounded-2xl border bg-background p-4 flex items-center gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700">
              <Clock :size="24" />
            </span>
            <div>
              <span class="text-xs font-semibold text-muted-foreground">Dias Utilizados</span>
              <p class="text-2xl font-bold text-foreground">{{ vacation.diasUtilizados }} dias</p>
            </div>
          </div>

          <div class="rounded-2xl border bg-background p-4 flex items-center gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <Calendar :size="24" />
            </span>
            <div>
              <span class="text-xs font-semibold text-muted-foreground">Próximo Período</span>
              <p class="text-sm font-bold text-foreground">{{ vacation.proximoPeriodo }}</p>
            </div>
          </div>
        </div>

        <!-- Tabela de Solicitações de Férias -->
        <div class="space-y-3">
          <h4 class="font-bold text-xs uppercase tracking-wider text-muted-foreground">Solicitações de Férias do Colaborador</h4>

          <div v-if="!vacation.solicitacoesFerias.length" class="text-center py-8 text-xs text-muted-foreground">
            Nenhuma solicitação de férias cadastrada para este colaborador.
          </div>

          <div v-else class="overflow-x-auto rounded-2xl border bg-background">
            <table class="w-full text-left text-xs">
              <thead class="border-b bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th class="p-3.5">Protocolo</th>
                  <th class="p-3.5">Data do Pedido</th>
                  <th class="p-3.5">Período Solicitado</th>
                  <th class="p-3.5">Dias</th>
                  <th class="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="req in vacation.solicitacoesFerias" :key="req.id">
                  <td class="p-3.5 font-mono font-medium">{{ req.id }}</td>
                  <td class="p-3.5 text-muted-foreground">{{ req.date }}</td>
                  <td class="p-3.5 font-semibold text-foreground">{{ req.details?.period || req.description }}</td>
                  <td class="p-3.5 font-bold">{{ req.details?.days || 15 }} dias</td>
                  <td class="p-3.5">
                    <span
                      class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      :class="req.status?.toLowerCase() === 'aprovado' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'"
                    >
                      {{ req.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 6 — SOLICITAÇÕES -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'solicitacoes'" class="rounded-3xl border bg-card p-6 shadow-2xs space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
          <div>
            <h3 class="font-bold text-base text-foreground flex items-center gap-2">
              <CalendarClock :size="18" class="text-teal-600" />
              Solicitações & Chamados do Colaborador
            </h3>
            <p class="text-xs text-muted-foreground">Histórico de pedidos de férias, atestados, ponto e reembolsos</p>
          </div>

          <!-- Filtro por status -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Status:</span>
            <select
              v-model="requestStatusFilter"
              class="rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="em análise">Em análise</option>
              <option value="aprovado">Aprovado</option>
              <option value="recusado">Recusado</option>
            </select>
          </div>
        </div>

        <div v-if="!filteredRequests.length" class="text-center py-10 text-xs text-muted-foreground">
          Nenhuma solicitação encontrada com os filtros selecionados.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="req in filteredRequests"
            :key="req.id"
            class="rounded-2xl border bg-background p-4 text-xs transition-all hover:border-teal-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-mono text-[11px] font-bold text-muted-foreground">{{ req.id }}</span>
                <span class="rounded bg-teal-500/10 text-teal-800 dark:text-teal-300 font-bold px-2 py-0.5 text-[10px] uppercase">
                  {{ req.type }}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="req.status?.toLowerCase() === 'aprovado' ? 'bg-emerald-500/15 text-emerald-700' : req.status?.toLowerCase() === 'recusado' ? 'bg-red-500/15 text-red-700' : 'bg-amber-500/15 text-amber-700'"
                >
                  {{ req.status }}
                </span>
              </div>
              <p class="font-semibold text-foreground text-sm">{{ req.description }}</p>
              <p class="text-muted-foreground text-[11px]">Solicitado em {{ req.date }} · Prioridade: {{ req.priority }}</p>
            </div>

            <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <span class="text-xs text-muted-foreground">Responsável: <strong>RH Central</strong></span>
            </div>
          </div>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 7 — HISTÓRICO & AUDITORIA -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'historico'" class="rounded-3xl border bg-card p-6 shadow-2xs space-y-6">
        <div class="border-b pb-3">
          <h3 class="font-bold text-base text-foreground flex items-center gap-2">
            <History :size="18" class="text-teal-600" />
            Linha do Tempo Funcional & Auditoria
          </h3>
          <p class="text-xs text-muted-foreground">
            Registro imutável de alterações de cargo, reajustes salariais, transferências e marcos de admissão
          </p>
        </div>

        <div v-if="!history.length" class="text-center py-10 text-xs text-muted-foreground">
          Nenhum histórico registrado para este colaborador.
        </div>

        <!-- TIMELINE VERTICAL -->
        <div v-else class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
          <div
            v-for="item in history"
            :key="item.id"
            class="relative space-y-1.5"
          >
            <!-- Ponto da Timeline -->
            <span
              class="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-background"
              :class="{
                'bg-emerald-500': item.type === 'admissao',
                'bg-indigo-500': item.type === 'cargo',
                'bg-teal-500': item.type === 'salario',
                'bg-blue-500': item.type === 'departamento',
                'bg-amber-500': item.type === 'status',
                'bg-rose-500': item.type === 'desligamento',
              }"
            ></span>

            <div class="rounded-2xl border bg-background p-4 text-xs">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-2">
                <span class="font-bold text-sm text-foreground">{{ item.title }}</span>
                <span class="text-muted-foreground font-mono text-[11px]">{{ item.created_at }}</span>
              </div>

              <p class="text-muted-foreground leading-relaxed">{{ item.description }}</p>

              <div v-if="item.old_value || item.new_value" class="mt-2 pt-2 border-t flex flex-wrap items-center gap-4 text-[11px]">
                <span v-if="item.old_value" class="text-muted-foreground">
                  Anterior: <strong class="line-through">{{ item.old_value }}</strong>
                </span>
                <span v-if="item.new_value" class="text-emerald-700 dark:text-emerald-300 font-bold">
                  Novo: {{ item.new_value }}
                </span>
                <span v-if="item.created_by" class="ml-auto text-muted-foreground italic">
                  Registrado por: {{ item.created_by }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================================================== -->
      <!-- ABA 8 — FEED & COMUNICADOS -->
      <!-- ================================================== -->
      <section v-else-if="activeTab === 'feed'" class="rounded-3xl border bg-card p-4 sm:p-6 shadow-2xs space-y-6">
        <CorporateFeedModule />
      </section>
    </div>

    <!-- MODAL DE EDIÇÃO DE COLABORADOR (REAPROVEITANDO COMPONENTE EXISTENTE) -->
    <NewEmployeeFolderModal
      v-if="showEditModal && folderToEditAdapter"
      :folder-to-edit="folderToEditAdapter"
      @close="showEditModal = false"
      @updated="handleEmployeeUpdated"
    />

    <!-- MODAL DE EXPORTAÇÃO DE DOSSIÊ EM PDF -->
    <ExportDossierModal
      v-if="showExportDossierModal && folderToEditAdapter"
      :folder="folderToEditAdapter"
      :is-open="showExportDossierModal"
      @close="showExportDossierModal = false"
      @toast="showToast"
    />

    <!-- MODAL SIMPLES: ANEXAR DOCUMENTO -->
    <div
      v-if="showAddDocModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-sm text-foreground">Anexar Novo Documento</h3>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showAddDocModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Nome do Documento</label>
            <input
              v-model="newDocName"
              placeholder="Ex: Atestado_Medico_2024.pdf"
              class="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Categoria</label>
            <select
              v-model="newDocCategory"
              class="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option value="pessoais">Documentos Pessoais</option>
              <option value="contratos">Contratos & Aditivos</option>
              <option value="exames">Exames Médicos (ASO)</option>
              <option value="holerites">Holerites & Folha</option>
              <option value="certificados">Certificados & Cursos</option>
              <option value="declaracoes">Declarações & Dossiês</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Data de Validade (Opcional)</label>
            <input
              v-model="newDocValidity"
              type="date"
              class="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            class="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
            @click="showAddDocModal = false"
          >
            Cancelar
          </button>
          <button
            class="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow cursor-pointer disabled:opacity-50"
            :disabled="!newDocName.trim()"
            @click="handleAddDocument"
          >
            Salvar Documento
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL DE PREVIEW DE DOCUMENTO -->
    <div
      v-if="previewDocModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <span class="rounded bg-teal-500/10 text-teal-800 text-[10px] font-bold px-2 py-0.5">
              {{ previewDocModal.type }}
            </span>
            <h3 class="font-bold text-sm text-foreground truncate max-w-xs">{{ previewDocModal.name }}</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="previewDocModal = null">
            <X :size="18" />
          </button>
        </div>

        <div class="p-6 rounded-xl border bg-muted/40 text-center space-y-2">
          <FileText :size="48" class="mx-auto text-teal-600" />
          <p class="font-semibold text-xs text-foreground">{{ previewDocModal.name }}</p>
          <p class="text-[11px] text-muted-foreground">
            Documento digital arquivado no dossiê de {{ previewDocModal.employeeName }}.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            class="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
            @click="previewDocModal = null"
          >
            Fechar
          </button>
          <button
            class="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow cursor-pointer"
            @click="showToast('Download do documento iniciado.')"
          >
            <Download :size="13" class="inline mr-1" /> Baixar Arquivo
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
