<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Briefcase,
  Users,
  Search,
  Plus,
  Filter,
  Clock,
  Calendar,
  Star,
  ExternalLink,
  Download,
  TrendingUp,
  MapPin,
  Building2,
  Video,
  FileText,
  UserCheck,
  RefreshCw,
  X,
  Link as LinkIcon,
  Award,
} from "lucide-vue-next"
import { apiFetch, showToast, activeUserRole, hasPermission } from "../store"

export interface JobPosting {
  id: string
  title: string
  department: string
  role: string
  work_model: "remoto" | "hibrido" | "presencial"
  contract_type: string
  location: string
  positions_count: number
  status: "aberta" | "pausada" | "encerrada" | "rascunho"
  salary_min?: number
  salary_max?: number
  salary_is_confidential: boolean
  description?: string
  requirements?: string
  responsibilities?: string
  benefits?: string
  is_public: boolean
  published_at?: string
  created_at: string
  candidate_counts?: Record<string, number>
  total_candidates?: number
}

export interface CandidateItem {
  id: string
  name: string
  email: string
  phone?: string
  linkedin_url?: string
  portfolio_url?: string
  city?: string
  state?: string
  source: string
  resume_filename?: string
  lgpd_consent: boolean
  notes?: string
  created_at: string
  application_id: string
  job_id: string
  stage: "inscricao" | "triagem" | "entrevista" | "teste_tecnico" | "aprovado" | "reprovado" | "contratado"
  rating: number
  applied_at: string
  job_title?: string
  job_department?: string
}

export interface InterviewItem {
  id: string
  application_id: string
  candidate_name: string
  job_title: string
  interviewer_id?: string
  interviewer_name: string
  scheduled_at: string
  duration_minutes: number
  meeting_link: string
  status: "agendada" | "realizada" | "cancelada"
  technical_rating?: number
  behavioral_rating?: number
  cultural_rating?: number
  recommendation?: "forte_sim" | "sim" | "nao"
  feedback_notes?: string
}

export interface RecruitmentMetrics {
  totalJobs: number
  openJobsCount: number
  closedJobsCount: number
  totalCandidates: number
  jobsByStatus: Record<string, number>
  candidatesByStage: Record<string, number>
  candidatesBySource: Record<string, number>
  avgTimeToHireDays: number
  conversionRate: number
}

const activeTab = ref<"pipeline" | "vagas" | "entrevistas" | "metricas">("pipeline")
const loading = ref(false)

const jobs = ref<JobPosting[]>([])
const candidates = ref<CandidateItem[]>([])
const interviews = ref<InterviewItem[]>([])
const metrics = ref<RecruitmentMetrics | null>(null)

// Filtros
const selectedJobFilter = ref<string>("todos")
const searchQuery = ref("")
const selectedSourceFilter = ref<string>("todos")

// Modais
const showNewJobModal = ref(false)
const showScheduleModal = ref(false)
const showEvaluateModal = ref(false)
const showCandidateDetailsModal = ref(false)

// Estados para ações
const selectedCandidate = ref<CandidateItem | null>(null)
const candidateFullData = ref<any>(null)
const selectedInterview = ref<InterviewItem | null>(null)

// Formulário de Nova Vaga
const jobForm = ref({
  title: "",
  department: "Tecnologia da Informação",
  role: "",
  workModel: "hibrido",
  contractType: "CLT",
  location: "São Paulo, SP",
  positionsCount: 1,
  status: "aberta",
  salaryMin: "",
  salaryMax: "",
  salaryIsConfidential: true,
  description: "",
  requirements: "",
  responsibilities: "",
  benefits: "Vale Refeição, Plano de Saúde, Seguro de Vida, Gympass",
  isPublic: true,
})

// Formulário de Agendamento de Entrevista
const scheduleForm = ref({
  applicationId: "",
  scheduledAt: "",
  durationMinutes: 45,
  meetingLink: "https://meet.google.com/ph-entrevista",
  interviewerName: "",
})

// Formulário de Scorecard / Avaliação
const evalForm = ref({
  technicalRating: 4,
  behavioralRating: 4,
  culturalRating: 4,
  recommendation: "sim",
  feedbackNotes: "",
})

// Etapas do Pipeline
const stagesList = [
  { id: "inscricao", label: "Inscrições", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "triagem", label: "Triagem", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  { id: "entrevista", label: "Entrevistas", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { id: "teste_tecnico", label: "Teste Técnico", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { id: "aprovado", label: "Aprovados", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { id: "contratado", label: "Contratados", color: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" },
  { id: "reprovado", label: "Banco de Talentos", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
]

async function loadData() {
  loading.value = true
  try {
    const [jobsRes, candRes, intRes, metRes] = await Promise.all([
      apiFetch("/api/recruitment/jobs"),
      apiFetch("/api/recruitment/candidates"),
      apiFetch("/api/recruitment/interviews"),
      apiFetch("/api/recruitment/metrics"),
    ])

    const jobsData = await jobsRes.json()
    const candData = await candRes.json()
    const intData = await intRes.json()
    const metData = await metRes.json()

    if (jobsData.ok && jobsData.jobs) {
      jobs.value = jobsData.jobs
    }
    if (candData.ok && candData.candidates) {
      candidates.value = candData.candidates
    }
    if (intData.ok && intData.interviews) {
      interviews.value = intData.interviews
    }
    if (metData.ok && metData.metrics) {
      metrics.value = metData.metrics
    }
  } catch (err: any) {
    showToast(err.message || "Erro ao carregar módulo de Recrutamento", "error")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const filteredCandidates = computed(() => {
  return candidates.value.filter((c) => {
    if (selectedJobFilter.value !== "todos" && c.job_id !== selectedJobFilter.value) {
      return false
    }
    if (selectedSourceFilter.value !== "todos" && c.source !== selectedSourceFilter.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const matchName = c.name.toLowerCase().includes(q)
      const matchEmail = c.email.toLowerCase().includes(q)
      const matchJob = c.job_title?.toLowerCase().includes(q) || false
      if (!matchName && !matchEmail && !matchJob) return false
    }
    return true
  })
})

function getCandidatesByStage(stageId: string) {
  return filteredCandidates.value.filter((c) => c.stage === stageId)
}

async function moveCandidateStage(candidate: CandidateItem, newStage: string) {
  try {
    const res = await apiFetch(`/api/recruitment/applications/${candidate.application_id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({
        stage: newStage,
        notes: `Candidato avançado para ${newStage} via Pipeline Visual.`,
      }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      candidate.stage = newStage as any
      showToast(data.message || `Candidato movido para ${newStage}`, "success")
      loadData()
    } else {
      showToast(data.error || "Não foi possível alterar a etapa", "error")
    }
  } catch (err: any) {
    showToast(err.message || "Falha na comunicação com o servidor", "error")
  }
}

async function viewCandidateDetails(c: CandidateItem) {
  selectedCandidate.value = c
  candidateFullData.value = null
  showCandidateDetailsModal.value = true
  try {
    const res = await apiFetch(`/api/recruitment/candidates/${c.id}`)
    const data = await res.json()
    if (res.ok && data.ok) {
      candidateFullData.value = data
    }
  } catch (err: any) {
    showToast(err.message || "Erro ao carregar detalhes do candidato", "error")
  }
}

function openScheduleInterview(c: CandidateItem) {
  selectedCandidate.value = c
  scheduleForm.value.applicationId = c.application_id
  const now = new Date()
  now.setDate(now.getDate() + 1)
  now.setHours(14, 0, 0, 0)
  scheduleForm.value.scheduledAt = now.toISOString().slice(0, 16)
  showScheduleModal.value = true
}

async function submitScheduleInterview() {
  if (!scheduleForm.value.scheduledAt) {
    showToast("Selecione a data e hora da entrevista.", "warning")
    return
  }
  try {
    const res = await apiFetch("/api/recruitment/interviews", {
      method: "POST",
      body: JSON.stringify(scheduleForm.value),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      showToast("Entrevista agendada com sucesso!", "success")
      showScheduleModal.value = false
      loadData()
    } else {
      showToast(data.error || "Erro ao agendar entrevista", "error")
    }
  } catch (err: any) {
    showToast(err.message || "Erro de conexão", "error")
  }
}

function openEvaluateModal(interview: InterviewItem) {
  selectedInterview.value = interview
  evalForm.value.technicalRating = interview.technical_rating || 4
  evalForm.value.behavioralRating = interview.behavioral_rating || 4
  evalForm.value.culturalRating = interview.cultural_rating || 4
  evalForm.value.recommendation = interview.recommendation || "sim"
  evalForm.value.feedbackNotes = interview.feedback_notes || ""
  showEvaluateModal.value = true
}

async function submitEvaluation() {
  if (!selectedInterview.value) return
  try {
    const res = await apiFetch(`/api/recruitment/interviews/${selectedInterview.value.id}/evaluate`, {
      method: "PATCH",
      body: JSON.stringify(evalForm.value),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      showToast("Scorecard e avaliação registrados com sucesso!", "success")
      showEvaluateModal.value = false
      loadData()
    } else {
      showToast(data.error || "Erro ao salvar avaliação", "error")
    }
  } catch (err: any) {
    showToast(err.message || "Erro de conexão", "error")
  }
}

async function submitNewJob() {
  if (!jobForm.value.title || !jobForm.value.department) {
    showToast("Preencha o título e o departamento da vaga.", "warning")
    return
  }
  try {
    const res = await apiFetch("/api/recruitment/jobs", {
      method: "POST",
      body: JSON.stringify({
        ...jobForm.value,
        salaryMin: jobForm.value.salaryMin ? Number(jobForm.value.salaryMin) : undefined,
        salaryMax: jobForm.value.salaryMax ? Number(jobForm.value.salaryMax) : undefined,
      }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      showToast("Vaga criada e publicada com sucesso!", "success")
      showNewJobModal.value = false
      // Reset
      jobForm.value.title = ""
      jobForm.value.role = ""
      jobForm.value.description = ""
      jobForm.value.requirements = ""
      loadData()
    } else {
      showToast(data.error || "Erro ao cadastrar vaga", "error")
    }
  } catch (err: any) {
    showToast(err.message || "Erro de conexão", "error")
  }
}

async function toggleJobStatus(job: JobPosting) {
  const nextStatus = job.status === "aberta" ? "pausada" : job.status === "pausada" ? "encerrada" : "aberta"
  try {
    const res = await apiFetch(`/api/recruitment/jobs/${job.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      job.status = nextStatus as any
      showToast(`Status da vaga alterado para "${nextStatus}".`, "info")
      loadData()
    }
  } catch (err: any) {
    showToast(err.message || "Erro ao atualizar vaga", "error")
  }
}

function copyPublicLink(jobId?: string) {
  const url = `${window.location.origin}/vagas${jobId ? `?job=${jobId}` : ""}`
  navigator.clipboard.writeText(url)
  showToast("Link público copiado para a área de transferência!", "success")
}
</script>

<template>
  <main class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative p-4 sm:p-7">
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <!-- Cabeçalho do Módulo -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <Briefcase :size="22" />
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Recrutamento & Seleção (ATS)</h1>
                <span class="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 border border-purple-500/20">
                  Talent Acquisition
                </span>
              </div>
              <p class="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Pipeline seletivo integrado, publicação de vagas, scorecards de avaliação e funil analítico.
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground transition-all hover:bg-muted hover:shadow-2xs cursor-pointer"
            title="Abrir ou compartilhar portal público de vagas"
            @click="copyPublicLink()"
          >
            <LinkIcon :size="16" class="text-purple-600" />
            <span>Portal de Vagas</span>
          </button>

          <button
            class="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground transition-all hover:bg-muted cursor-pointer"
            @click="loadData"
          >
            <RefreshCw :size="15" :class="{ 'animate-spin': loading }" />
            <span>Atualizar</span>
          </button>

          <button
            v-if="hasPermission('recruitment.manage') || activeUserRole === 'ADMIN' || activeUserRole === 'RH'"
            class="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 hover:shadow-md cursor-pointer"
            @click="showNewJobModal = true"
          >
            <Plus :size="16" />
            <span>Nova Vaga</span>
          </button>
        </div>
      </div>

      <!-- Abas de Navegação -->
      <div class="flex items-center gap-2 border-b overflow-x-auto scrollbar-none pb-px text-sm">
        <button
          class="flex items-center gap-2 px-4 py-2.5 font-medium transition-all border-b-2 cursor-pointer"
          :class="activeTab === 'pipeline' ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-lg' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'pipeline'"
        >
          <Users :size="17" />
          <span>Pipeline de Candidatos (Kanban)</span>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{{ candidates.length }}</span>
        </button>

        <button
          class="flex items-center gap-2 px-4 py-2.5 font-medium transition-all border-b-2 cursor-pointer"
          :class="activeTab === 'vagas' ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-lg' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'vagas'"
        >
          <Briefcase :size="17" />
          <span>Vagas Abertas</span>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{{ jobs.length }}</span>
        </button>

        <button
          class="flex items-center gap-2 px-4 py-2.5 font-medium transition-all border-b-2 cursor-pointer"
          :class="activeTab === 'entrevistas' ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-lg' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'entrevistas'"
        >
          <Calendar :size="17" />
          <span>Agenda de Entrevistas</span>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{{ interviews.length }}</span>
        </button>

        <button
          class="flex items-center gap-2 px-4 py-2.5 font-medium transition-all border-b-2 cursor-pointer"
          :class="activeTab === 'metricas' ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-lg' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'metricas'"
        >
          <TrendingUp :size="17" />
          <span>Métricas & Funil</span>
        </button>
      </div>

      <!-- ========================================== -->
      <!-- ABA 1: PIPELINE / KANBAN DE CANDIDATOS -->
      <!-- ========================================== -->
      <section v-if="activeTab === 'pipeline'" class="space-y-4">
        <!-- Barra de Filtros -->
        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between rounded-xl border bg-card p-3 shadow-2xs">
          <div class="flex flex-wrap items-center gap-2.5">
            <div class="relative min-w-[240px]">
              <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar candidato por nome ou vaga..."
                class="w-full rounded-lg border bg-background py-1.5 pl-9 pr-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div class="flex items-center gap-1.5 text-xs">
              <Filter :size="14" class="text-muted-foreground" />
              <select
                v-model="selectedJobFilter"
                class="rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="todos">Todas as Vagas ({{ jobs.length }})</option>
                <option v-for="j in jobs" :key="j.id" :value="j.id">
                  {{ j.title }} ({{ j.department }})
                </option>
              </select>
            </div>

            <select
              v-model="selectedSourceFilter"
              class="rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="todos">Todas as Origens</option>
              <option value="site_carreiras">Site de Carreiras</option>
              <option value="linkedin">LinkedIn</option>
              <option value="indicacao">Indicação Interna</option>
              <option value="gupy">Gupy / Plataformas</option>
            </select>
          </div>

          <div class="text-xs text-muted-foreground self-center">
            Exibindo <strong>{{ filteredCandidates.length }}</strong> de {{ candidates.length }} candidaturas
          </div>
        </div>

        <!-- Kanban Board Horizontal com Scroll Suave -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3.5 overflow-x-auto pb-4">
          <div
            v-for="st in stagesList"
            :key="st.id"
            class="flex flex-col rounded-2xl border bg-card/60 backdrop-blur-xs p-3 min-w-[210px] shadow-2xs"
          >
            <!-- Topo da Coluna -->
            <div class="flex items-center justify-between pb-2.5 border-b mb-2.5">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold">{{ st.label }}</span>
                <span
                  class="rounded-full px-2 py-0.2 text-[10px] font-bold border"
                  :class="st.color"
                >
                  {{ getCandidatesByStage(st.id).length }}
                </span>
              </div>
            </div>

            <!-- Lista de Cards da Etapa -->
            <div class="flex-1 flex flex-col gap-2.5 min-h-[300px]">
              <div
                v-for="cand in getCandidatesByStage(st.id)"
                :key="cand.id"
                class="group rounded-xl border bg-card p-3 shadow-2xs hover:shadow-md transition-all space-y-2 border-border/80"
              >
                <!-- Nome e Estrelas -->
                <div class="flex items-start justify-between gap-1">
                  <button
                    class="font-semibold text-xs sm:text-sm hover:text-primary transition-colors text-left line-clamp-1 cursor-pointer"
                    @click="viewCandidateDetails(cand)"
                  >
                    {{ cand.name }}
                  </button>
                  <div class="flex items-center gap-0.5 text-amber-500 shrink-0 text-[11px] font-bold">
                    <Star :size="12" class="fill-amber-400" />
                    <span>{{ cand.rating ? cand.rating.toFixed(1) : '-' }}</span>
                  </div>
                </div>

                <!-- Vaga Vinculada -->
                <p class="text-[11px] font-medium text-muted-foreground truncate" :title="cand.job_title">
                  {{ cand.job_title || 'Vaga Não Definida' }}
                </p>

                <!-- Badges de Origem & Currículo -->
                <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  <span class="uppercase tracking-wide font-medium bg-muted px-1.5 py-0.5 rounded">
                    {{ cand.source.replace('_', ' ') }}
                  </span>
                  <span v-if="cand.resume_filename" class="text-purple-600 font-medium flex items-center gap-0.5">
                    <FileText :size="11" /> CV
                  </span>
                </div>

                <!-- Botões de Ação Rápida no Card -->
                <div class="flex items-center justify-between gap-1 pt-1 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    class="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary py-1 px-1.5 rounded hover:bg-muted cursor-pointer"
                    title="Agendar Entrevista"
                    @click="openScheduleInterview(cand)"
                  >
                    <Calendar :size="12" /> Entrevista
                  </button>

                  <!-- Menu dropdown rápido de avançar etapa -->
                  <select
                    :value="cand.stage"
                    class="rounded border bg-background text-[10px] py-0.5 px-1 font-semibold text-primary focus:outline-none cursor-pointer"
                    @change="(e) => moveCandidateStage(cand, (e.target as HTMLSelectElement).value)"
                  >
                    <option v-for="opt in stagesList" :key="opt.id" :value="opt.id">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Empty State da Coluna -->
              <div
                v-if="getCandidatesByStage(st.id).length === 0"
                class="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground/70"
              >
                Nenhum candidato nesta fase
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ========================================== -->
      <!-- ABA 2: GESTÃO DE VAGAS -->
      <!-- ========================================== -->
      <section v-else-if="activeTab === 'vagas'" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="job in jobs"
            :key="job.id"
            class="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-2xs hover:shadow-md transition-all space-y-4"
          >
            <div>
              <div class="flex items-start justify-between gap-2">
                <span
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border"
                  :class="{
                    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20': job.status === 'aberta',
                    'bg-amber-500/10 text-amber-600 border-amber-500/20': job.status === 'pausada',
                    'bg-muted text-muted-foreground border-border': job.status === 'encerrada',
                  }"
                >
                  {{ job.status }}
                </span>
                <span class="text-xs text-muted-foreground flex items-center gap-1">
                  <Users :size="13" /> {{ job.positions_count }} {{ job.positions_count === 1 ? 'vaga' : 'vagas' }}
                </span>
              </div>

              <h3 class="text-base font-bold mt-2.5 text-foreground leading-snug">
                {{ job.title }}
              </h3>

              <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
                <span class="flex items-center gap-1"><Building2 :size="13" /> {{ job.department }}</span>
                <span class="flex items-center gap-1"><MapPin :size="13" /> {{ job.location }} ({{ job.work_model }})</span>
              </div>

              <p v-if="job.description" class="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                {{ job.description }}
              </p>

              <!-- Mini Pipeline Contagem de Candidatos -->
              <div class="mt-4 pt-3 border-t">
                <div class="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Candidatos por etapa:</span>
                  <span class="font-bold text-foreground">{{ job.total_candidates || 0 }} total</span>
                </div>
                <div class="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <div class="bg-muted/70 rounded p-1">
                    <span class="block font-bold">{{ job.candidate_counts?.inscricao || 0 }}</span>
                    <span class="text-muted-foreground">Inscritos</span>
                  </div>
                  <div class="bg-muted/70 rounded p-1">
                    <span class="block font-bold">{{ job.candidate_counts?.entrevista || 0 }}</span>
                    <span class="text-muted-foreground">Entrevistas</span>
                  </div>
                  <div class="bg-muted/70 rounded p-1">
                    <span class="block font-bold text-emerald-600">{{ job.candidate_counts?.aprovado || 0 }}</span>
                    <span class="text-muted-foreground">Aprovados</span>
                  </div>
                  <div class="bg-muted/70 rounded p-1">
                    <span class="block font-bold text-teal-600">{{ job.candidate_counts?.contratado || 0 }}</span>
                    <span class="text-muted-foreground">Contratados</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Rodapé de Ações da Vaga -->
            <div class="flex items-center justify-between pt-3 border-t gap-2 text-xs">
              <button
                class="flex items-center gap-1 text-purple-600 hover:text-purple-700 font-semibold cursor-pointer"
                @click="copyPublicLink(job.id)"
              >
                <LinkIcon :size="13" /> Link Candidato
              </button>

              <button
                class="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                @click="toggleJobStatus(job)"
              >
                {{ job.status === 'aberta' ? 'Pausar Vaga' : 'Reabrir Vaga' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ========================================== -->
      <!-- ABA 3: AGENDA DE ENTREVISTAS & SCORECARDS -->
      <!-- ========================================== -->
      <section v-else-if="activeTab === 'entrevistas'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">Entrevistas Agendadas e Realizadas</h2>
        </div>

        <div class="rounded-2xl border bg-card overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th class="p-3.5 font-semibold">Candidato / Vaga</th>
                  <th class="p-3.5 font-semibold">Data & Horário</th>
                  <th class="p-3.5 font-semibold">Entrevistador</th>
                  <th class="p-3.5 font-semibold">Status / Score</th>
                  <th class="p-3.5 font-semibold">Link de Chamada</th>
                  <th class="p-3.5 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="int in interviews" :key="int.id" class="hover:bg-muted/30 transition-colors">
                  <td class="p-3.5 font-medium">
                    <div class="font-bold text-foreground">{{ int.candidate_name }}</div>
                    <div class="text-xs text-muted-foreground">{{ int.job_title }}</div>
                  </td>
                  <td class="p-3.5 text-muted-foreground">
                    <div class="flex items-center gap-1.5 font-medium text-foreground">
                      <Clock :size="14" class="text-purple-600" />
                      {{ new Date(int.scheduled_at).toLocaleDateString('pt-BR') }} às
                      {{ new Date(int.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
                    </div>
                    <span class="text-[11px] text-muted-foreground">Duração: {{ int.duration_minutes }} min</span>
                  </td>
                  <td class="p-3.5 text-foreground font-medium">
                    {{ int.interviewer_name }}
                  </td>
                  <td class="p-3.5">
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      :class="{
                        'bg-blue-500/10 text-blue-600': int.status === 'agendada',
                        'bg-emerald-500/10 text-emerald-600': int.status === 'realizada',
                        'bg-rose-500/10 text-rose-600': int.status === 'cancelada',
                      }"
                    >
                      {{ int.status }}
                      <span v-if="int.technical_rating" class="font-bold">
                        (★ {{ (((int.technical_rating || 0) + (int.behavioral_rating || 0) + (int.cultural_rating || 0)) / 3).toFixed(1) }})
                      </span>
                    </span>
                  </td>
                  <td class="p-3.5">
                    <a
                      v-if="int.meeting_link"
                      :href="int.meeting_link"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:underline"
                    >
                      <Video :size="14" /> Entrar na Sala
                    </a>
                    <span v-else class="text-muted-foreground text-xs">-</span>
                  </td>
                  <td class="p-3.5 text-right">
                    <button
                      class="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      @click="openEvaluateModal(int)"
                    >
                      {{ int.status === 'realizada' ? 'Ver Scorecard' : 'Avaliar Entrevista' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="interviews.length === 0">
                  <td colspan="6" class="p-8 text-center text-muted-foreground">
                    Nenhuma entrevista cadastrada no momento.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ========================================== -->
      <!-- ABA 4: MÉTRICAS & FUNIL DE RECRUTAMENTO -->
      <!-- ========================================== -->
      <section v-else-if="activeTab === 'metricas'" class="space-y-6">
        <!-- Indicadores Chave -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="rounded-2xl border bg-card p-4 shadow-2xs">
            <span class="text-xs text-muted-foreground font-medium">Vagas Ativas</span>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground">
              {{ metrics?.openJobsCount || 0 }}
            </div>
            <span class="text-[11px] text-muted-foreground">de {{ metrics?.totalJobs || 0 }} cadastradas</span>
          </div>

          <div class="rounded-2xl border bg-card p-4 shadow-2xs">
            <span class="text-xs text-muted-foreground font-medium">Total de Candidatos</span>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-purple-600">
              {{ metrics?.totalCandidates || 0 }}
            </div>
            <span class="text-[11px] text-muted-foreground">Em todos os processos</span>
          </div>

          <div class="rounded-2xl border bg-card p-4 shadow-2xs">
            <span class="text-xs text-muted-foreground font-medium">Tempo Médio de Contratação</span>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600">
              {{ metrics?.avgTimeToHireDays || 14 }} dias
            </div>
            <span class="text-[11px] text-muted-foreground">Time to Hire (SLA)</span>
          </div>

          <div class="rounded-2xl border bg-card p-4 shadow-2xs">
            <span class="text-xs text-muted-foreground font-medium">Conversão de Contratação</span>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {{ metrics?.conversionRate || 0 }}%
            </div>
            <span class="text-[11px] text-muted-foreground">Inscrição -> Contratação</span>
          </div>
        </div>

        <!-- Funil Visual de Candidatos -->
        <div class="rounded-2xl border bg-card p-5 shadow-2xs space-y-4">
          <h3 class="text-base font-bold">Funil de Conversão por Etapa (ATS)</h3>
          <div class="space-y-2.5">
            <div
              v-for="st in stagesList"
              :key="st.id"
              class="flex items-center gap-3 text-xs sm:text-sm"
            >
              <div class="w-32 sm:w-44 font-semibold text-muted-foreground">{{ st.label }}</div>
              <div class="flex-1 bg-muted rounded-full h-4 overflow-hidden relative">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="{
                    'bg-blue-500': st.id === 'inscricao',
                    'bg-indigo-500': st.id === 'triagem',
                    'bg-purple-500': st.id === 'entrevista',
                    'bg-amber-500': st.id === 'teste_tecnico',
                    'bg-emerald-500': st.id === 'aprovado',
                    'bg-teal-500': st.id === 'contratado',
                    'bg-rose-500': st.id === 'reprovado',
                  }"
                  :style="{
                    width: `${Math.min(100, Math.max(5, ((metrics?.candidatesByStage[st.id] || 0) / Math.max(1, metrics?.totalCandidates || 1)) * 100))}%`
                  }"
                />
              </div>
              <div class="w-16 font-bold text-right">
                {{ metrics?.candidatesByStage[st.id] || 0 }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ========================================== -->
    <!-- MODAL: NOVA VAGA -->
    <!-- ========================================== -->
    <div
      v-if="showNewJobModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="text-lg font-bold">Cadastrar Nova Vaga de Trabalho</h3>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showNewJobModal = false">
            <X :size="20" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitNewJob">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold mb-1">Título da Vaga *</label>
              <input
                v-model="jobForm.title"
                type="text"
                required
                placeholder="Ex: Engenheiro de Software Sênior"
                class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold mb-1">Departamento *</label>
              <select
                v-model="jobForm.department"
                class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="Tecnologia da Informação">Tecnologia da Informação</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Operações">Operações</option>
                <option value="Comercial / Vendas">Comercial / Vendas</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold mb-1">Modelo de Trabalho</label>
              <select
                v-model="jobForm.workModel"
                class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="hibrido">Híbrido</option>
                <option value="remoto">Remoto</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold mb-1">Regime Contratual</label>
              <select
                v-model="jobForm.contractType"
                class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estágio">Estágio</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold mb-1">Nº de Posições</label>
              <input
                v-model="jobForm.positionsCount"
                type="number"
                min="1"
                class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Descrição e Objetivo da Vaga</label>
            <textarea
              v-model="jobForm.description"
              rows="3"
              placeholder="Descreva as principais atribuições e o desafio da oportunidade..."
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            ></textarea>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Requisitos & Conhecimentos Desejados</label>
            <textarea
              v-model="jobForm.requirements"
              rows="2"
              placeholder="Ex: Formação superior, experiência com TypeScript, boa comunicação..."
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showNewJobModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-95 cursor-pointer"
            >
              Publicar Vaga
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL: AGENDAR ENTREVISTA -->
    <!-- ========================================== -->
    <div
      v-if="showScheduleModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="text-base font-bold">Agendar Entrevista</h3>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showScheduleModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="text-xs text-muted-foreground bg-muted p-2.5 rounded-lg">
          Candidato: <strong class="text-foreground">{{ selectedCandidate?.name }}</strong><br />
          Vaga: <span class="text-foreground">{{ selectedCandidate?.job_title }}</span>
        </div>

        <form class="space-y-4" @submit.prevent="submitScheduleInterview">
          <div>
            <label class="block text-xs font-semibold mb-1">Data e Hora *</label>
            <input
              v-model="scheduleForm.scheduledAt"
              type="datetime-local"
              required
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Entrevistador Responsável</label>
            <input
              v-model="scheduleForm.interviewerName"
              type="text"
              placeholder="Ex: Gestor de TI & RH"
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Link da Reunião (Meet / Teams)</label>
            <input
              v-model="scheduleForm.meetingLink"
              type="url"
              placeholder="https://meet.google.com/..."
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showScheduleModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-95 cursor-pointer"
            >
              Confirmar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL: SCORECARD / AVALIAÇÃO ESTRUTURADA -->
    <!-- ========================================== -->
    <div
      v-if="showEvaluateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <Award :size="20" class="text-amber-500" />
            <h3 class="text-base font-bold">Scorecard de Entrevista</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showEvaluateModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="text-xs bg-muted p-2.5 rounded-lg">
          Candidato: <strong class="text-foreground">{{ selectedInterview?.candidate_name }}</strong><br />
          Vaga: {{ selectedInterview?.job_title }}
        </div>

        <form class="space-y-4" @submit.prevent="submitEvaluation">
          <!-- Avaliações 1 a 5 -->
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-xs font-semibold mb-1">
                <span>Avaliação Técnica & Domínio da Função:</span>
                <span class="text-amber-500 font-bold">{{ evalForm.technicalRating }} / 5</span>
              </div>
              <input
                v-model="evalForm.technicalRating"
                type="range"
                min="1"
                max="5"
                class="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div class="flex justify-between text-xs font-semibold mb-1">
                <span>Competências Comportamentais:</span>
                <span class="text-amber-500 font-bold">{{ evalForm.behavioralRating }} / 5</span>
              </div>
              <input
                v-model="evalForm.behavioralRating"
                type="range"
                min="1"
                max="5"
                class="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div class="flex justify-between text-xs font-semibold mb-1">
                <span>Fit Cultural e Valores PeopleHub:</span>
                <span class="text-amber-500 font-bold">{{ evalForm.culturalRating }} / 5</span>
              </div>
              <input
                v-model="evalForm.culturalRating"
                type="range"
                min="1"
                max="5"
                class="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Recomendação do Comitê</label>
            <select
              v-model="evalForm.recommendation"
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="forte_sim">⭐ Forte Sim (Aprovação Imediata)</option>
              <option value="sim">👍 Sim (Recomendado)</option>
              <option value="nao">👎 Não Recomendado</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Parecer e Pontos Fortes / A Desenvolver</label>
            <textarea
              v-model="evalForm.feedbackNotes"
              rows="3"
              placeholder="Registre a síntese da avaliação para visualização do comitê..."
              class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showEvaluateModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-95 cursor-pointer"
            >
              Salvar Avaliação
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL: DETALHES DO CANDIDATO -->
    <!-- ========================================== -->
    <div
      v-if="showCandidateDetailsModal && selectedCandidate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <UserCheck :size="20" class="text-purple-600" />
            <h3 class="text-lg font-bold">{{ selectedCandidate.name }}</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showCandidateDetailsModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-3 text-xs sm:text-sm">
          <div class="grid grid-cols-2 gap-3 bg-muted/50 p-3 rounded-xl border">
            <div>
              <span class="text-muted-foreground text-xs block">E-mail:</span>
              <strong class="text-foreground">{{ selectedCandidate.email }}</strong>
            </div>
            <div>
              <span class="text-muted-foreground text-xs block">Telefone:</span>
              <strong class="text-foreground">{{ selectedCandidate.phone || 'Não informado' }}</strong>
            </div>
            <div>
              <span class="text-muted-foreground text-xs block">Localização:</span>
              <span>{{ selectedCandidate.city || '-' }} / {{ selectedCandidate.state || '-' }}</span>
            </div>
            <div>
              <span class="text-muted-foreground text-xs block">Origem:</span>
              <span class="capitalize">{{ selectedCandidate.source.replace('_', ' ') }}</span>
            </div>
          </div>

          <div v-if="selectedCandidate.linkedin_url || selectedCandidate.portfolio_url" class="flex flex-wrap gap-2 pt-1">
            <a
              v-if="selectedCandidate.linkedin_url"
              :href="selectedCandidate.linkedin_url"
              target="_blank"
              class="flex items-center gap-1 text-xs text-blue-600 hover:underline border px-2.5 py-1 rounded-lg"
            >
              <ExternalLink :size="13" /> Perfil no LinkedIn
            </a>
            <a
              v-if="selectedCandidate.portfolio_url"
              :href="selectedCandidate.portfolio_url"
              target="_blank"
              class="flex items-center gap-1 text-xs text-purple-600 hover:underline border px-2.5 py-1 rounded-lg"
            >
              <ExternalLink :size="13" /> Portfólio / GitHub
            </a>
          </div>

          <!-- Currículo Anexado -->
          <div v-if="selectedCandidate.resume_filename" class="rounded-xl border bg-purple-500/5 border-purple-500/20 p-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <FileText :size="18" class="text-purple-600" />
              <div>
                <span class="font-semibold text-xs block">{{ selectedCandidate.resume_filename }}</span>
                <span class="text-[10px] text-muted-foreground">Documento verificado sob conformidade LGPD</span>
              </div>
            </div>
            <a
              :href="`/api/recruitment/candidates/${selectedCandidate.id}/resume`"
              target="_blank"
              class="flex items-center gap-1 rounded-lg bg-purple-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-purple-700 cursor-pointer"
            >
              <Download :size="13" /> Baixar
            </a>
          </div>

          <!-- Histórico de Etapas do Candidato -->
          <div v-if="candidateFullData?.applications?.[0]?.stage_history" class="space-y-2 pt-2 border-t">
            <h4 class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Histórico no Pipeline</h4>
            <div class="space-y-2">
              <div
                v-for="h in candidateFullData.applications[0].stage_history"
                :key="h.id"
                class="flex items-start gap-2.5 text-xs border-l-2 border-purple-500 pl-3 py-1"
              >
                <div class="flex-1">
                  <span class="font-bold text-foreground capitalize">{{ h.to_stage }}</span>
                  <p class="text-muted-foreground text-[11px]">{{ h.notes }}</p>
                </div>
                <span class="text-[10px] text-muted-foreground shrink-0">
                  {{ new Date(h.created_at).toLocaleDateString('pt-BR') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-3 border-t">
          <button
            class="rounded-xl bg-muted px-4 py-2 text-xs font-semibold hover:bg-muted/80 cursor-pointer"
            @click="showCandidateDetailsModal = false"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
