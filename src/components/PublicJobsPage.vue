<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Briefcase,
  Search,
  MapPin,
  Building2,
  DollarSign,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  X,
  ShieldCheck,
  Sparkles,
  LogIn,
} from "lucide-vue-next"
import { useRouter } from "vue-router"

const router = useRouter()

export interface PublicJob {
  id: string
  title: string
  department: string
  role: string
  work_model: "remoto" | "hibrido" | "presencial"
  contract_type: string
  location: string
  positions_count: number
  salary_min?: number
  salary_max?: number
  salary_is_confidential: number
  description: string
  requirements: string
  responsibilities: string
  benefits?: string
  published_at: string
}

const loading = ref(false)
const jobs = ref<PublicJob[]>([])
const searchQuery = ref("")
const selectedDepartment = ref("todos")
const selectedWorkModel = ref("todos")

// Modal de detalhes e candidatura
const selectedJob = ref<PublicJob | null>(null)
const showApplyModal = ref(false)
const submitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref<string | null>(null)

// Formulário de candidatura
const form = ref({
  fullName: "",
  email: "",
  phone: "",
  city: "",
  state: "SP",
  linkedinUrl: "",
  source: "site_carreiras",
  lgpdConsent: false,
})

const resumeFile = ref<File | null>(null)
const resumeBase64 = ref<string | null>(null)
const resumeFileName = ref<string | null>(null)
const resumeError = ref<string | null>(null)

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

async function fetchPublicJobs() {
  loading.value = true
  try {
    const res = await fetch("/api/recruitment/public/jobs")
    const data = await res.json()
    if (data.ok && Array.isArray(data.jobs)) {
      jobs.value = data.jobs
    }
  } catch (err) {
    console.error("Erro ao carregar vagas públicas:", err)
  } finally {
    loading.value = false
  }
}

const departments = computed(() => {
  const set = new Set<string>()
  jobs.value.forEach((j) => {
    if (j.department) set.add(j.department)
  })
  return Array.from(set)
})

const filteredJobs = computed(() => {
  return jobs.value.filter((job) => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.role.toLowerCase().includes(q) ||
      job.department.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      job.description.toLowerCase().includes(q)

    const matchesDept = selectedDepartment.value === "todos" || job.department === selectedDepartment.value
    const matchesModel = selectedWorkModel.value === "todos" || job.work_model === selectedWorkModel.value

    return matchesSearch && matchesDept && matchesModel
  })
})

function openJobDetail(job: PublicJob) {
  selectedJob.value = job
  showApplyModal.value = true
  submitSuccess.value = false
  submitError.value = null
  resetForm()
}

function closeApplyModal() {
  showApplyModal.value = false
  selectedJob.value = null
  submitSuccess.value = false
  submitError.value = null
  resetForm()
}

function resetForm() {
  form.value = {
    fullName: "",
    email: "",
    phone: "",
    city: "",
    state: "SP",
    linkedinUrl: "",
    source: "site_carreiras",
    lgpdConsent: false,
  }
  resumeFile.value = null
  resumeBase64.value = null
  resumeFileName.value = null
  resumeError.value = null
}

function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]
  resumeError.value = null

  if (file.size > MAX_FILE_SIZE) {
    resumeError.value = "O arquivo excede o limite máximo permitido de 5MB."
    resumeFile.value = null
    resumeBase64.value = null
    resumeFileName.value = null
    return
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
    resumeError.value = "Formato inválido. Envie um arquivo em PDF, Word (.docx) ou Texto (.txt)."
    resumeFile.value = null
    resumeBase64.value = null
    resumeFileName.value = null
    return
  }

  resumeFile.value = file
  resumeFileName.value = file.name

  const reader = new FileReader()
  reader.onload = () => {
    resumeBase64.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

async function submitApplication() {
  if (!selectedJob.value) return
  submitError.value = null

  if (!form.value.fullName.trim() || !form.value.email.trim() || !form.value.phone.trim()) {
    submitError.value = "Por favor, preencha todos os campos obrigatórios (Nome, E-mail e Telefone)."
    return
  }

  if (!form.value.lgpdConsent) {
    submitError.value = "Você precisa aceitar os termos de consentimento da LGPD para submeter sua candidatura."
    return
  }

  submitting.value = true
  try {
    const payload = {
      fullName: form.value.fullName.trim(),
      email: form.value.email.trim(),
      phone: form.value.phone.trim(),
      city: form.value.city.trim() || "São Paulo",
      state: form.value.state || "SP",
      linkedinUrl: form.value.linkedinUrl.trim(),
      source: form.value.source,
      lgpdConsent: form.value.lgpdConsent,
      resumeFileName: resumeFileName.value || undefined,
      resumeBase64: resumeBase64.value || undefined,
    }

    const res = await fetch(`/api/recruitment/public/jobs/${selectedJob.value.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Erro ao enviar candidatura.")
    }

    submitSuccess.value = true
  } catch (err: any) {
    submitError.value = err.message || "Ocorreu um erro ao processar sua candidatura. Tente novamente."
  } finally {
    submitting.value = false
  }
}

function formatSalary(job: PublicJob) {
  if (job.salary_is_confidential || (!job.salary_min && !job.salary_max)) {
    return "A combinar"
  }
  if (job.salary_min && job.salary_max) {
    return `R$ ${Number(job.salary_min).toLocaleString("pt-BR")} – R$ ${Number(job.salary_max).toLocaleString("pt-BR")}`
  }
  if (job.salary_min) {
    return `A partir de R$ ${Number(job.salary_min).toLocaleString("pt-BR")}`
  }
  return `Até R$ ${Number(job.salary_max).toLocaleString("pt-BR")}`
}

function formatDate(iso: string) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

onMounted(() => {
  fetchPublicJobs()
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
    <!-- Top Header -->
    <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-teal-600 flex items-center justify-center font-bold text-white shadow-lg shadow-teal-600/20">
            PH
          </div>
          <div>
            <span class="font-bold text-lg tracking-tight text-white flex items-center gap-2">
              PeopleHub <span class="text-teal-400 font-medium text-sm">Carreiras</span>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="router.push('/login')"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/80 text-sm font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <LogIn :size="16" />
            <span>Área do Colaborador</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative py-12 px-4 border-b border-slate-800/60 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-950 overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(13,148,136,0.15),rgba(255,255,255,0))] pointer-events-none"></div>
      
      <div class="max-w-4xl mx-auto text-center relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles :size="13" /> Oportunidades em Aberto
        </div>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
          Construa sua história com a gente
        </h1>
        <p class="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Valorizamos talentos, diversidade e inovação. Conheça as vagas disponíveis e faça parte de um time apaixonado por transformar o futuro.
        </p>

        <!-- Filtros e Busca -->
        <div class="mt-8 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md grid grid-cols-1 sm:grid-cols-12 gap-2 text-left">
          <div class="sm:col-span-6 relative">
            <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por cargo, palavra-chave ou cidade..."
              class="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <div class="sm:col-span-3">
            <select
              v-model="selectedDepartment"
              class="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
            >
              <option value="todos">Todos os Departamentos</option>
              <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>

          <div class="sm:col-span-3">
            <select
              v-model="selectedWorkModel"
              class="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
            >
              <option value="todos">Todas Modalidades</option>
              <option value="remoto">Remoto 100%</option>
              <option value="hibrido">Híbrido</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- Jobs Grid Section -->
    <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-10">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-white flex items-center gap-2">
          <Briefcase :size="20" class="text-teal-400" />
          Vagas Disponíveis
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-teal-400 font-semibold ml-2">
            {{ filteredJobs.length }}
          </span>
        </h2>
        <span class="text-xs text-slate-400 hidden sm:inline">
          Atualizado em tempo real pelo time de DHO
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <div class="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin"></div>
        <p class="text-sm">Carregando oportunidades...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredJobs.length === 0" class="py-16 text-center border border-dashed border-slate-800 rounded-2xl p-8 bg-slate-900/30">
        <Briefcase :size="40" class="mx-auto text-slate-600 mb-3" />
        <h3 class="text-lg font-semibold text-slate-300">Nenhuma vaga encontrada</h3>
        <p class="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Não encontramos vagas compatíveis com os filtros selecionados. Tente buscar por outros termos ou limpar os filtros.
        </p>
      </div>

      <!-- Jobs Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          v-for="job in filteredJobs"
          :key="job.id"
          class="group rounded-2xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-teal-500/40 p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 shadow-md hover:shadow-xl hover:shadow-teal-950/30"
        >
          <div>
            <!-- Badges -->
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span
                class="px-2.5 py-0.5 text-xs font-semibold rounded-md uppercase tracking-wider border"
                :class="{
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': job.work_model === 'remoto',
                  'bg-sky-500/10 text-sky-400 border-sky-500/20': job.work_model === 'hibrido',
                  'bg-amber-500/10 text-amber-400 border-amber-500/20': job.work_model === 'presencial',
                }"
              >
                {{ job.work_model }}
              </span>
              <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-800 text-slate-300 border border-slate-700/80">
                {{ job.contract_type }}
              </span>
              <span class="text-xs text-slate-500 ml-auto">
                Publicada em {{ formatDate(job.published_at) }}
              </span>
            </div>

            <!-- Title & Dept -->
            <h3 class="text-xl font-bold text-white group-hover:text-teal-400 transition-colors">
              {{ job.title }}
            </h3>
            <p class="text-sm text-slate-400 mt-1 flex items-center gap-4">
              <span class="flex items-center gap-1.5"><Building2 :size="14" class="text-slate-500" /> {{ job.department }}</span>
              <span class="flex items-center gap-1.5"><MapPin :size="14" class="text-slate-500" /> {{ job.location }}</span>
            </p>

            <!-- Description excerpt -->
            <p class="text-sm text-slate-300 mt-4 line-clamp-3 leading-relaxed">
              {{ job.description }}
            </p>

            <!-- Salary -->
            <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span class="flex items-center gap-1.5">
                <DollarSign :size="14" class="text-teal-400" />
                Remuneração: <strong class="text-slate-200">{{ formatSalary(job) }}</strong>
              </span>
              <span>{{ job.positions_count }} vaga(s)</span>
            </div>
          </div>

          <!-- Action Button -->
          <button
            @click="openJobDetail(job)"
            class="mt-6 w-full py-2.5 px-4 rounded-xl bg-teal-600/90 hover:bg-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-900/40 cursor-pointer"
          >
            <span>Ver Detalhes e Candidatar-se</span>
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </main>

    <!-- Modal de Detalhes da Vaga e Candidatura -->
    <div
      v-if="showApplyModal && selectedJob"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      @click.self="closeApplyModal"
    >
      <div class="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Modal Header -->
        <div class="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 text-xs font-semibold rounded bg-teal-500/10 text-teal-400 border border-teal-500/30 uppercase">
                {{ selectedJob.work_model }}
              </span>
              <span class="text-xs text-slate-400">{{ selectedJob.department }}</span>
            </div>
            <h2 class="text-xl font-bold text-white">{{ selectedJob.title }}</h2>
          </div>
          <button
            @click="closeApplyModal"
            class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          <!-- Success State -->
          <div v-if="submitSuccess" class="py-8 text-center space-y-4">
            <div class="h-16 w-16 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-teal-500/10">
              <CheckCircle2 :size="36" />
            </div>
            <h3 class="text-xl font-bold text-white">Candidatura Enviada com Sucesso!</h3>
            <p class="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
              Obrigado pelo interesse! Seu currículo e perfil foram recebidos com sucesso pelo nosso time de Recrutamento & Seleção. Você receberá atualizações no seu e-mail cadastrado.
            </p>
            <button
              @click="closeApplyModal"
              class="mt-4 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-all cursor-pointer"
            >
              Fechar e Ver Outras Vagas
            </button>
          </div>

          <!-- Application Form & Details -->
          <div v-else class="space-y-6">
            <!-- Job Specs -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <div>
                <span class="text-slate-500 block">Localização</span>
                <span class="font-semibold text-slate-200">{{ selectedJob.location }}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Tipo de Contrato</span>
                <span class="font-semibold text-slate-200">{{ selectedJob.contract_type }}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Remuneração</span>
                <span class="font-semibold text-slate-200">{{ formatSalary(selectedJob) }}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Vagas Disponíveis</span>
                <span class="font-semibold text-slate-200">{{ selectedJob.positions_count }}</span>
              </div>
            </div>

            <!-- Description -->
            <div>
              <h4 class="font-bold text-white mb-2 text-base">Sobre a Vaga</h4>
              <p class="text-slate-300 leading-relaxed whitespace-pre-line">{{ selectedJob.description }}</p>
            </div>

            <!-- Responsibilities -->
            <div v-if="selectedJob.responsibilities">
              <h4 class="font-bold text-white mb-2 text-base">Principais Responsabilidades</h4>
              <p class="text-slate-300 leading-relaxed whitespace-pre-line">{{ selectedJob.responsibilities }}</p>
            </div>

            <!-- Requirements -->
            <div v-if="selectedJob.requirements">
              <h4 class="font-bold text-white mb-2 text-base">Requisitos e Qualificações</h4>
              <p class="text-slate-300 leading-relaxed whitespace-pre-line">{{ selectedJob.requirements }}</p>
            </div>

            <!-- Benefits -->
            <div v-if="selectedJob.benefits">
              <h4 class="font-bold text-white mb-2 text-base">Benefícios Oferecidos</h4>
              <p class="text-slate-300 leading-relaxed whitespace-pre-line">{{ selectedJob.benefits }}</p>
            </div>

            <hr class="border-slate-800 my-6" />

            <!-- Application Form -->
            <div>
              <div class="flex items-center gap-2 mb-4">
                <FileText :size="20" class="text-teal-400" />
                <h3 class="text-lg font-bold text-white">Formulário de Inscrição</h3>
              </div>

              <!-- Submit Error Banner -->
              <div v-if="submitError" class="p-3.5 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle :size="16" class="shrink-0 mt-0.5 text-rose-400" />
                <span>{{ submitError }}</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
                  <input
                    v-model="form.fullName"
                    type="text"
                    required
                    placeholder="Ex: Ana Clara Ribeiro"
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">E-mail *</label>
                  <input
                    v-model="form.email"
                    type="email"
                    required
                    placeholder="ana.ribeiro@exemplo.com"
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Telefone / WhatsApp *</label>
                  <input
                    v-model="form.phone"
                    type="tel"
                    required
                    placeholder="(11) 98765-4321"
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Perfil do LinkedIn (opcional)</label>
                  <input
                    v-model="form.linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/seu-perfil"
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Cidade</label>
                  <input
                    v-model="form.city"
                    type="text"
                    placeholder="São Paulo"
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Estado</label>
                  <select
                    v-model="form.state"
                    class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="SP">São Paulo (SP)</option>
                    <option value="RJ">Rio de Janeiro (RJ)</option>
                    <option value="MG">Minas Gerais (MG)</option>
                    <option value="RS">Rio Grande do Sul (RS)</option>
                    <option value="PR">Paraná (PR)</option>
                    <option value="SC">Santa Catarina (SC)</option>
                    <option value="DF">Distrito Federal (DF)</option>
                    <option value="BA">Bahia (BA)</option>
                    <option value="Outro">Outro Estado</option>
                  </select>
                </div>
              </div>

              <!-- Upload de Currículo -->
              <div class="mt-4">
                <label class="block text-xs font-semibold text-slate-300 mb-1">Currículo (PDF, Word ou TXT até 5MB)</label>
                <div class="border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-xl p-4 text-center bg-slate-950/50 transition-colors">
                  <input
                    type="file"
                    id="resumeInput"
                    accept=".pdf,.doc,.docx,.txt"
                    class="hidden"
                    @change="handleFileUpload"
                  />
                  <label for="resumeInput" class="cursor-pointer flex flex-col items-center gap-1.5">
                    <UploadCloud :size="24" class="text-teal-400" />
                    <span v-if="resumeFileName" class="text-sm font-semibold text-teal-300">
                      {{ resumeFileName }}
                    </span>
                    <span v-else class="text-xs text-slate-300">
                      <strong class="text-teal-400">Clique para selecionar</strong> ou arraste seu arquivo de currículo
                    </span>
                    <span class="text-[11px] text-slate-500">Formatos aceitos: PDF, DOCX, DOC, TXT (máx. 5MB)</span>
                  </label>
                </div>
                <p v-if="resumeError" class="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle :size="13" /> {{ resumeError }}
                </p>
              </div>

              <!-- Checkbox LGPD -->
              <div class="mt-5 p-3 rounded-xl bg-teal-950/20 border border-teal-900/40">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    v-model="form.lgpdConsent"
                    type="checkbox"
                    required
                    class="mt-1 h-4 w-4 rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                  />
                  <span class="text-xs text-slate-300 leading-relaxed">
                    Declaro que li e <strong>concordo com o tratamento dos meus dados pessoais</strong> fornecidos neste formulário e currículo para fins exclusivos de avaliação de perfil e contato referente a processos seletivos desta organização, em estrita conformidade com a <strong>LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018)</strong>.
                  </span>
                </label>
              </div>

              <!-- Submit Button -->
              <div class="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  @click="closeApplyModal"
                  class="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  :disabled="submitting || !form.lgpdConsent"
                  @click="submitApplication"
                  class="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center gap-2 transition-all shadow-md shadow-teal-950 cursor-pointer"
                >
                  <span v-if="submitting" class="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>{{ submitting ? 'Enviando...' : 'Confirmar Candidatura' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-slate-900 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
      <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-slate-400">
          <ShieldCheck :size="16" class="text-teal-400" />
          <span>PeopleHub RH — Sistema de Recrutamento & Seleção em conformidade com a LGPD</span>
        </div>
        <div>
          <span>© 2026 PeopleHub RH. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  </div>
</template>
