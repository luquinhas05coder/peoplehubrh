<script setup lang="ts">
import { ref, computed } from "vue"
import {
  GraduationCap,
  Users,
  CheckCircle2,
  Plus,
  Search,
  BookOpen,
  Laptop,
  Award,
  X,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  Edit3,
  UserPlus,
} from "lucide-vue-next"
import jsPDF from "jspdf"
import {
  onboardingItems,
  onboardingTracks,
  toggleOnboardingStep,
  createOnboardingItem,
  createOnboardingTrack,
  updateOnboardingTrack,
  deleteOnboardingTrack,
  enrollEmployeeInTrack,
  deleteOnboardingItem,
  employeeFolders,
  userPermissions,
  userRoleType,
} from "../store"
import type { OnboardingItem, OnboardingStatus, OnboardingTrack } from "../data"
import { onboardingStatusLabels } from "../data"
import UserAvatar from "./UserAvatar.vue"

/* ─── Títulos e Subtítulos Adaptados por Cargo ─── */
const onboardingTitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Meu Onboarding & Trilhas de Integração"
  if (userRoleType.value === "ti") return "Checklist de Infraestrutura & Provisionamento TI"
  if (userRoleType.value === "dp") return "Checklist de Admissão & Documentação DP"
  return "Módulo de Onboarding & Integração de Pessoas"
})

const onboardingSubtitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Acompanhe suas tarefas de boas-vindas, conclua suas trilhas de treinamento e certifique-se com a equipe."
  if (userRoleType.value === "ti") return "Provisione e-mails corporativos, acessos aos sistemas, entrega de notebooks e liberação de VPN."
  if (userRoleType.value === "dp") return "Valide carteira de trabalho (CTPS), exame admissional ASO, conta salário e cadastros legais."
  return "Gestão de trilhas de treinamento, acompanhamento de recém-admitidos, apadrinhamento e checklists."
})

/* ─── Sub-Tabs com RBAC ─── */
type SubTab = "colaboradores" | "trilhas" | "checklist_ti"
const activeTab = ref<SubTab>(
  userRoleType.value === "ti" ? "checklist_ti" : userRoleType.value === "colaborador" ? "trilhas" : "colaboradores"
)

const subTabsList = computed(() => {
  if (userPermissions.value.isColaborador) {
    return [{ id: "trilhas" as SubTab, label: "Minhas Trilhas & Treinamentos", icon: BookOpen }]
  }
  if (userPermissions.value.isTI) {
    return [
      { id: "checklist_ti" as SubTab, label: "Infraestrutura & TI", icon: Laptop },
      { id: "trilhas" as SubTab, label: "Trilhas de Treinamento", icon: BookOpen },
      { id: "colaboradores" as SubTab, label: "Recém-Admitidos", icon: Users },
    ]
  }
  return [
    { id: "colaboradores" as SubTab, label: "Recém-Admitidos", icon: Users },
    { id: "trilhas" as SubTab, label: "Trilhas de Treinamento", icon: BookOpen },
    { id: "checklist_ti" as SubTab, label: "Infraestrutura & TI", icon: Laptop },
  ]
})

/* ─── Filtros e Busca de Colaboradores ─── */
const search = ref("")
const selectedStatus = ref<string>("todos")
const selectedDepartment = ref<string>("todos")
const toastText = ref<string | null>(null)

/* ─── Filtros e Busca de Trilhas ─── */
const trackSearch = ref("")
const trackDeptFilter = ref("todos")
const trackDepartments = ["todos", "Tecnologia", "Marketing", "Vendas", "Financeiro", "Recursos Humanos", "Geral / Todos"]

const filteredTracks = computed(() => {
  return onboardingTracks.value.filter((t) => {
    const matchesDept = trackDeptFilter.value === "todos" || t.department === trackDeptFilter.value
    const q = trackSearch.value.toLowerCase().trim()
    const matchesQ =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.recommendedFor.toLowerCase().includes(q) ||
      t.modulesList.some((m) => m.toLowerCase().includes(q))
    return matchesDept && matchesQ
  })
})

function getEnrolledCount(trackTitle: string): number {
  return onboardingItems.value.filter((i) => i.trackTitle === trackTitle).length
}

function getTrackEnrolledItems(trackTitle: string): OnboardingItem[] {
  return onboardingItems.value.filter((i) => i.trackTitle === trackTitle)
}

/* ─── Portal do Aluno / Colaborador (Matrículas e Progresso) ─── */
const userEnrollments = ref<Record<string, { enrolled: boolean; completedModules: string[] }>>({
  "trk-1": {
    enrolled: true,
    completedModules: ["Cultura Corporativa & Valores", "Políticas Internas & Código de Conduta", "Segurança da Informação Básica"],
  },
})

function isCourseEnrolled(trackId: string): boolean {
  return !!userEnrollments.value[trackId]?.enrolled
}

function enrollInCourse(trk: OnboardingTrack) {
  if (!userEnrollments.value[trk.id]) {
    userEnrollments.value[trk.id] = { enrolled: true, completedModules: [] }
  } else {
    userEnrollments.value[trk.id].enrolled = true
  }
  showToast(`Matrícula realizada com sucesso no curso "${trk.title}"! Bons estudos!`)
}

function isCourseModuleDone(trackId: string, modTitle: string): boolean {
  const item = userEnrollments.value[trackId]
  return item ? item.completedModules.includes(modTitle) : false
}

function toggleCourseModuleDone(trackId: string, modTitle: string, trk: OnboardingTrack) {
  if (!userEnrollments.value[trackId]) {
    userEnrollments.value[trackId] = { enrolled: true, completedModules: [] }
  }
  const item = userEnrollments.value[trackId]
  if (item.completedModules.includes(modTitle)) {
    item.completedModules = item.completedModules.filter((m) => m !== modTitle)
  } else {
    item.completedModules.push(modTitle)
    if (item.completedModules.length === trk.modulesList.length) {
      showToast(`Parabéns! Você concluiu 100% do curso "${trk.title}"! Certificado liberado!`)
    }
  }
}

function getCourseProgress(trk: OnboardingTrack): number {
  const item = userEnrollments.value[trk.id]
  if (!item || !trk.modulesList.length) return 0
  return Math.round((item.completedModules.length / trk.modulesList.length) * 100)
}

/* ─── Modais ─── */
const showNewEmployeeModal = ref(false)
const showNewTrackModal = ref(false)
const selectedDetailItem = ref<OnboardingItem | null>(null)

/* ─── Modal Editar Trilha ─── */
const editingTrack = ref<OnboardingTrack | null>(null)
const editTrackTitle = ref("")
const editTrackDept = ref("Tecnologia")
const editTrackDuration = ref(10)
const editTrackDesc = ref("")
const editTrackRecommended = ref("")
const editTrackModules = ref<string[]>([])
const newModuleText = ref("")

function openEditTrackModal(trk: OnboardingTrack) {
  editingTrack.value = trk
  editTrackTitle.value = trk.title
  editTrackDept.value = trk.department
  editTrackDuration.value = trk.durationDays
  editTrackDesc.value = trk.description
  editTrackRecommended.value = trk.recommendedFor
  editTrackModules.value = [...trk.modulesList]
  newModuleText.value = ""
}

function addModuleToEdit() {
  if (!newModuleText.value.trim()) return
  editTrackModules.value.push(newModuleText.value.trim())
  newModuleText.value = ""
}

function removeModuleFromEdit(idx: number) {
  editTrackModules.value.splice(idx, 1)
}

function saveTrackEdits() {
  if (!editingTrack.value) return
  if (!editTrackTitle.value.trim() || !editTrackDesc.value.trim()) {
    showToast("Por favor, preencha o título e a descrição da trilha.")
    return
  }

  updateOnboardingTrack(editingTrack.value.id, {
    title: editTrackTitle.value.trim(),
    department: editTrackDept.value,
    durationDays: editTrackDuration.value || 7,
    description: editTrackDesc.value.trim(),
    recommendedFor: editTrackRecommended.value.trim() || "Colaboradores do departamento",
    modulesList: editTrackModules.value.length > 0 ? editTrackModules.value : ["Módulo Geral"],
  })

  editingTrack.value = null
  showToast("Trilha de treinamento atualizada com sucesso!")
}

function handleDeleteTrack(trackId: string) {
  if (confirm("Tem certeza que deseja excluir esta trilha de treinamento?")) {
    deleteOnboardingTrack(trackId)
    if (editingTrack.value?.id === trackId) {
      editingTrack.value = null
    }
    showToast("Trilha de treinamento excluída.")
  }
}

/* ─── Modal Atribuir Trilha a Colaborador ─── */
const assigningTrack = ref<OnboardingTrack | null>(null)
const selectedEmpName = ref("")

function openAssignModal(trk: OnboardingTrack) {
  assigningTrack.value = trk
  selectedEmpName.value = employeeFolders.value[0]?.name || ""
}

function confirmAssign() {
  if (!assigningTrack.value || !selectedEmpName.value) return
  enrollEmployeeInTrack(selectedEmpName.value, assigningTrack.value.title)
  assigningTrack.value = null
}

/* ─── Emissão de Certificado em PDF (jsPDF) ─── */
function generateCertificatePdf(trk: OnboardingTrack, studentName?: string) {
  const name = studentName || (employeeFolders.value[0]?.name || "Colaborador em Destaque")
  showToast(`Gerando Certificado de Conclusão da ${trk.title}...`)

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    })

    // Moldura externa elegante
    doc.setDrawColor(20, 80, 75)
    doc.setLineWidth(2)
    doc.rect(10, 10, 277, 190)

    doc.setDrawColor(200, 160, 80)
    doc.setLineWidth(0.8)
    doc.rect(14, 14, 269, 182)

    // Cabeçalho da Empresa
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.setTextColor(20, 80, 75)
    doc.text("PEOPLEHUB GESTÃO DE PESSOAS S/A", 148.5, 32, { align: "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    doc.text("CNPJ: 12.345.678/0001-90 — PROGRAMA DE DESENVOLVIMENTO CORPORATIVO", 148.5, 39, { align: "center" })

    // Título do Certificado
    doc.setFontSize(26)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 40, 50)
    doc.text("CERTIFICADO DE CONCLUSÃO", 148.5, 60, { align: "center" })

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(70, 70, 70)
    doc.text("Certificamos com distinção corporativa que o(a) colaborador(a)", 148.5, 75, { align: "center" })

    // Nome do Colaborador
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(20, 80, 75)
    doc.text(name.toUpperCase(), 148.5, 90, { align: "center" })

    // Linha sob o nome
    doc.setDrawColor(200, 160, 80)
    doc.setLineWidth(0.5)
    doc.line(70, 94, 227, 94)

    // Texto descritivo
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 60, 60)
    const hours = (trk.durationDays * 2).toString()
    const desc = `concluiu com êxito todos os ${trk.totalModules} módulos da capacitação em "${trk.title}", promovida pelo departamento de ${trk.department}, perfazendo uma carga horária estimada de ${hours} horas de atividades práticas, teóricas e avaliativas com 100% de aproveitamento.`
    const splitDesc = doc.splitTextToSize(desc, 200)
    doc.text(splitDesc, 148.5, 106, { align: "center" })

    // Data e Hash
    const dateStr = new Date().toLocaleDateString("pt-BR")
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    doc.text(`Emitido em ${dateStr} · Código de Validação: PHB-CERT-${Date.now().toString(36).toUpperCase()}`, 148.5, 138, { align: "center" })

    // Assinaturas
    doc.line(45, 165, 115, 165)
    doc.text("Diretoria de Recursos Humanos", 80, 171, { align: "center" })
    doc.text("PeopleHub Gestão de Pessoas S/A", 80, 176, { align: "center" })

    doc.line(182, 165, 252, 165)
    doc.text("Gestor de Treinamento & Carreira", 217, 171, { align: "center" })
    doc.text(`Área de ${trk.department}`, 217, 176, { align: "center" })

    const cleanTitle = trk.title.replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    doc.save(`Certificado_${cleanTitle}_${Date.now()}.pdf`)
    showToast("Certificado gerado e baixado com sucesso!", "success")
  } catch (err) {
    console.error("Erro ao gerar certificado:", err)
    showToast("Falha ao gerar certificado em PDF.")
  }
}

/* ─── Forms ─── */
const newEmpForm = ref({
  employeeName: "",
  employeeInitials: "",
  role: "",
  department: "Tecnologia",
  startDate: new Date().toLocaleDateString("pt-BR"),
  buddy: "Victor Silva",
  trackTitle: "Trilha Institucional de Cultura & RH",
  notes: "",
})

const newTrackForm = ref({
  title: "",
  department: "Tecnologia",
  durationDays: 10,
  description: "",
  modulesRaw: "",
  recommendedFor: "",
})

function showToast(msg: string, _type?: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = null
  }, 2500)
}

/* ─── Computados / Indicadores ─── */
const totalInOnboarding = computed(() => onboardingItems.value.filter((i) => i.status !== "concluido").length)
const totalCompleted = computed(() => onboardingItems.value.filter((i) => i.status === "concluido").length)

const avgProgress = computed(() => {
  if (!onboardingItems.value.length) return 0
  const sum = onboardingItems.value.reduce((acc, item) => {
    const completed = item.checklist.filter((s) => s.completed).length
    const total = item.checklist.length || 1
    return acc + (completed / total) * 100
  }, 0)
  return Math.round(sum / onboardingItems.value.length)
})

const pendingTiStepsCount = computed(() => {
  return onboardingItems.value.reduce((acc, item) => {
    const pendingTi = item.checklist.filter((s) => s.category === "ti" && !s.completed).length
    return acc + pendingTi
  }, 0)
})

/* Computado de Itens Filtrados */
const filteredItems = computed(() => {
  return onboardingItems.value.filter((item) => {
    const matchesStatus = selectedStatus.value === "todos" || item.status === selectedStatus.value
    const matchesDept = selectedDepartment.value === "todos" || item.department === selectedDepartment.value
    const q = search.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      item.employeeName.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q) ||
      item.trackTitle.toLowerCase().includes(q) ||
      item.buddy.toLowerCase().includes(q)
    return matchesStatus && matchesDept && matchesSearch
  })
})

/* Helper de Progresso por Item */
function getItemProgress(item: OnboardingItem): number {
  if (!item.checklist || item.checklist.length === 0) return 0
  const completed = item.checklist.filter((s) => s.completed).length
  return Math.round((completed / item.checklist.length) * 100)
}

function getStatusBadgeClass(status: OnboardingStatus) {
  switch (status) {
    case "concluido":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    case "em_andamento":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
    case "atrasado":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
    case "aguardando_ti":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse"
  }
}

function handleToggleStep(itemId: string, stepId: string) {
  toggleOnboardingStep(itemId, stepId)
  showToast("Status da tarefa atualizado!")
}

function handleCreateEmployee() {
  if (!newEmpForm.value.employeeName || !newEmpForm.value.role) {
    showToast("Por favor, preencha o nome e o cargo do colaborador.")
    return
  }

  const initials = newEmpForm.value.employeeInitials || newEmpForm.value.employeeName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()

  createOnboardingItem({
    employeeName: newEmpForm.value.employeeName,
    employeeInitials: initials,
    role: newEmpForm.value.role,
    department: newEmpForm.value.department,
    startDate: newEmpForm.value.startDate,
    buddy: newEmpForm.value.buddy,
    trackTitle: newEmpForm.value.trackTitle,
    notes: newEmpForm.value.notes,
  })

  showNewEmployeeModal.value = false
  newEmpForm.value.employeeName = ""
  newEmpForm.value.role = ""
  showToast("Novo processo de Onboarding iniciado!")
}

function handleCreateTrack() {
  if (!newTrackForm.value.title || !newTrackForm.value.description) {
    showToast("Por favor, informe o título e a descrição da trilha.")
    return
  }

  const modules = newTrackForm.value.modulesRaw
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean)

  createOnboardingTrack({
    title: newTrackForm.value.title,
    department: newTrackForm.value.department,
    durationDays: Number(newTrackForm.value.durationDays) || 7,
    description: newTrackForm.value.description,
    modulesList: modules.length > 0 ? modules : ["Treinamento Geral de Boas-Vindas"],
    recommendedFor: newTrackForm.value.recommendedFor || "Novos colaboradores do departamento",
  })

  showNewTrackModal.value = false
  newTrackForm.value.title = ""
  newTrackForm.value.description = ""
  newTrackForm.value.modulesRaw = ""
  showToast("Nova trilha de integração criada com sucesso!")
}

function handleDeleteItem(id: string) {
  if (confirm("Tem certeza que deseja remover este colaborador do onboarding?")) {
    deleteOnboardingItem(id)
    if (selectedDetailItem.value?.id === id) {
      selectedDetailItem.value = null
    }
    showToast("Registro de onboarding removido.")
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative">
    <!-- Toast de Feedback -->
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

    <!-- Cabeçalho Principal do Módulo -->
    <header class="border-b bg-card px-5 py-5 sm:px-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-emerald-600 dark:text-emerald-400"
              style="background-color: rgba(16, 185, 129, 0.15)"
            >
              <GraduationCap :size="20" />
            </span>
            <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
              {{ onboardingTitle }}
            </h1>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ onboardingSubtitle }}
          </p>
        </div>

        <!-- Ações do Cabeçalho -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="userPermissions.canManageTraining"
            class="flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted cursor-pointer"
            @click="showNewTrackModal = true"
          >
            <BookOpen :size="15" />
            <span>Nova Trilha</span>
          </button>

          <button
            v-if="userPermissions.canManagePeople"
            class="flex items-center gap-1.5 rounded-xl py-2 px-4 text-xs font-semibold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 cursor-pointer"
            style="background-color: var(--color-primary)"
            @click="showNewEmployeeModal = true"
          >
            <Plus :size="16" />
            <span>Iniciar Onboarding</span>
          </button>
        </div>
      </div>

      <!-- Navegação por Sub-Tabs -->
      <nav class="mt-6 flex items-center gap-2 border-b border-border/40 pb-0.5 overflow-x-auto scrollbar-none">
        <button
          v-for="st in subTabsList"
          :key="st.id"
          class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
          :class="activeTab === st.id
            ? 'border-primary text-primary font-bold'
            : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = st.id as SubTab"
        >
          <component :is="st.icon" :size="16" />
          {{ st.label }}
        </button>
      </nav>
    </header>

    <!-- Conteúdo Principal -->
    <main class="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 space-y-6">

      <!-- ─── CARDS DE KPI DE TOPO ─── -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex flex-col rounded-2xl border bg-card p-4 shadow-xs">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Em Onboarding</span>
            <Users :size="16" class="text-blue-500" />
          </div>
          <p class="mt-2 text-2xl font-bold tracking-tight">{{ totalInOnboarding }} <span class="text-xs font-normal text-muted-foreground">colaboradores</span></p>
          <p class="mt-1 text-[11px] text-muted-foreground">Em processo de integração</p>
        </div>

        <div class="flex flex-col rounded-2xl border bg-card p-4 shadow-xs">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Progresso Médio</span>
            <Award :size="16" class="text-emerald-500" />
          </div>
          <p class="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{{ avgProgress }}%</p>
          <p class="mt-1 text-[11px] text-emerald-600 font-medium">Conclusão de tarefas de boas-vindas</p>
        </div>

        <div class="flex flex-col rounded-2xl border bg-card p-4 shadow-xs">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Pendências de TI</span>
            <Laptop :size="16" class="text-amber-500" />
          </div>
          <p class="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{{ pendingTiStepsCount }}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">Notebooks ou acessos pendentes</p>
        </div>

        <div class="flex flex-col rounded-2xl border bg-card p-4 shadow-xs">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Integrações Concluídas</span>
            <CheckCircle2 :size="16" class="text-teal-500" />
          </div>
          <p class="mt-2 text-2xl font-bold tracking-tight">{{ totalCompleted }}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">Finalizados com sucesso no prazo</p>
        </div>
      </div>

      <!-- ─── TAB 1: ACOMPANHAMENTO DE RECÉM-ADMITIDOS ─── -->
      <section v-if="activeTab === 'colaboradores'" class="space-y-6">
        <!-- Barra de Busca & Filtros -->
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="relative flex-1 max-w-md">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="search"
              type="text"
              placeholder="Buscar por colaborador, cargo, mentor ou trilha..."
              class="w-full rounded-xl border bg-card pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <!-- Filtro de Status -->
            <select
              v-model="selectedStatus"
              class="rounded-xl border bg-card px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todos os Status</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="aguardando_ti">Aguardando TI</option>
              <option value="concluido">Concluído</option>
              <option value="atrasado">Com Atraso</option>
            </select>

            <!-- Filtro de Departamento -->
            <select
              v-model="selectedDepartment"
              class="rounded-xl border bg-card px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todos os Departamentos</option>
              <option value="Tecnologia">Tecnologia</option>
              <option value="Marketing">Marketing</option>
              <option value="Vendas">Vendas</option>
              <option value="Financeiro">Financeiro</option>
            </select>
          </div>
        </div>

        <!-- Lista de Cards de Colaboradores em Onboarding -->
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs transition-all hover:shadow-md"
          >
            <div>
              <!-- Cabeçalho do Card -->
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <UserAvatar :initials="item.employeeInitials" :size="42" />
                  <div>
                    <h3 class="font-bold text-base text-foreground leading-tight">{{ item.employeeName }}</h3>
                    <p class="text-xs text-muted-foreground">{{ item.role }} • {{ item.department }}</p>
                  </div>
                </div>

                <span
                  class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                  :class="getStatusBadgeClass(item.status)"
                >
                  {{ onboardingStatusLabels[item.status] }}
                </span>
              </div>

              <!-- Trilha & Mentor -->
              <div class="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-3 text-xs">
                <div>
                  <p class="text-muted-foreground">Trilha de Integração:</p>
                  <p class="font-semibold text-foreground truncate mt-0.5">{{ item.trackTitle }}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Mentor / Padrinho RH:</p>
                  <p class="font-semibold text-foreground truncate mt-0.5">👤 {{ item.buddy }}</p>
                </div>
              </div>

              <!-- Barra de Progresso do Checklist -->
              <div class="mt-4 space-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="font-semibold text-muted-foreground">Progresso do Checklist:</span>
                  <span class="font-bold text-primary">{{ getItemProgress(item) }}%</span>
                </div>
                <div class="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    style="background-color: var(--color-primary)"
                    :style="{ width: `${getItemProgress(item)}%` }"
                  />
                </div>
              </div>

              <!-- Preview de Tarefas do Checklist -->
              <div class="mt-4 space-y-2 border-t pt-3">
                <p class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Etapas de Boas-Vindas ({{ item.checklist.filter(s=>s.completed).length }}/{{ item.checklist.length }})</p>
                <div
                  v-for="step in item.checklist.slice(0, 3)"
                  :key="step.id"
                  class="flex items-center justify-between text-xs py-1 cursor-pointer hover:bg-muted/40 px-2 rounded-lg transition-colors"
                  @click="handleToggleStep(item.id, step.id)"
                >
                  <span class="flex items-center gap-2" :class="step.completed ? 'line-through text-muted-foreground' : 'font-medium text-foreground'">
                    <component :is="step.completed ? CheckSquare : Square" :size="15" :class="step.completed ? 'text-emerald-500' : 'text-muted-foreground'" />
                    {{ step.title }}
                  </span>
                  <span v-if="step.dueDate && !step.completed" class="text-[10px] text-amber-600 font-medium">Prazo: {{ step.dueDate }}</span>
                </div>

                <p v-if="item.checklist.length > 3" class="text-[11px] text-primary font-medium text-right pt-1 cursor-pointer hover:underline" @click="selectedDetailItem = item">
                  + {{ item.checklist.length - 3 }} tarefas adicionais...
                </p>
              </div>
            </div>

            <!-- Footer do Card -->
            <div class="mt-5 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>Admitido em: <strong>{{ item.startDate }}</strong></span>

              <div class="flex items-center gap-2">
                <button
                  class="rounded-lg border px-2.5 py-1 font-semibold text-muted-foreground hover:text-rose-500 hover:bg-muted transition-colors"
                  title="Remover onboarding"
                  @click="handleDeleteItem(item.id)"
                >
                  <Trash2 :size="14" />
                </button>
                <button
                  class="flex items-center gap-1 rounded-lg border bg-card px-3 py-1 font-semibold text-foreground hover:bg-muted transition-colors"
                  @click="selectedDetailItem = item"
                >
                  <Eye :size="14" /> Ver Detalhes
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── TAB 2: TRILHAS DE TREINAMENTO ─── -->
      <section v-else-if="activeTab === 'trilhas'" class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h3 class="text-lg font-bold flex items-center gap-2">
              <GraduationCap :size="22" class="text-primary" />
              <span>Trilhas de Capacitação & Treinamento</span>
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Matrizes de aprendizagem, cronogramas de módulos corporativos e emissão de certificados
            </p>
          </div>
          <button
            class="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold text-white shadow transition-transform active:scale-95 cursor-pointer self-start sm:self-auto"
            style="background-color: var(--color-primary)"
            @click="showNewTrackModal = true"
          >
            <Plus :size="15" /> Criar Nova Trilha
          </button>
        </div>

        <!-- Filtros e Busca de Trilhas -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              v-for="dept in trackDepartments"
              :key="dept"
              class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer"
              :class="trackDeptFilter === dept ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-card text-muted-foreground hover:bg-muted border'"
              @click="trackDeptFilter = dept"
            >
              {{ dept === 'todos' ? 'Todos os Departamentos' : dept }}
            </button>
          </div>

          <div class="relative min-w-[240px]">
            <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="trackSearch"
              type="text"
              placeholder="Buscar trilha ou módulo..."
              class="w-full rounded-xl border bg-card py-1.5 pl-9 pr-3 text-xs outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>
        </div>

        <!-- Cards das Trilhas -->
        <div v-if="!filteredTracks.length" class="text-center py-12 border rounded-2xl bg-card">
          <GraduationCap :size="32" class="mx-auto text-muted-foreground/50 mb-2" />
          <p class="font-bold text-sm text-foreground">Nenhuma trilha encontrada</p>
          <p class="text-xs text-muted-foreground mt-1">Tente ajustar a busca ou o departamento selecionado.</p>
        </div>

        <div v-else class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="trk in filteredTracks"
            :key="trk.id"
            class="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs hover:shadow-md transition-shadow relative group"
          >
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {{ trk.department }}
                </span>
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-muted-foreground">
                    ⏱️ <strong>{{ trk.durationDays }} dias</strong>
                  </span>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="getEnrolledCount(trk.title) > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
                  >
                    👥 {{ getEnrolledCount(trk.title) }} matriculado(s)
                  </span>
                </div>
              </div>

              <h4 class="mt-3 font-bold text-base text-foreground leading-snug">{{ trk.title }}</h4>
              <p class="mt-1 text-xs text-muted-foreground leading-relaxed">{{ trk.description }}</p>

              <!-- Módulos de Treinamento -->
              <div class="mt-4 space-y-1.5 border-t pt-3">
                <div class="flex items-center justify-between">
                  <p class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Módulos Curriculares ({{ trk.modulesList.length }})
                  </p>
                  <span class="text-[10px] text-muted-foreground">Carga est. {{ trk.durationDays * 2 }}h</span>
                </div>

                <!-- Lista Interativa para o Colaborador Aluno -->
                <ul v-if="userPermissions.isColaborador" class="space-y-1 text-xs max-h-48 overflow-y-auto pr-1">
                  <li
                    v-for="(mod, idx) in trk.modulesList"
                    :key="idx"
                    class="flex items-center gap-2 font-medium py-1 px-2 rounded-lg transition-colors border bg-muted/20"
                    :class="isCourseModuleDone(trk.id, mod) ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'"
                  >
                    <input
                      type="checkbox"
                      :disabled="!isCourseEnrolled(trk.id)"
                      :checked="isCourseModuleDone(trk.id, mod)"
                      class="rounded border-muted-foreground text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      @change="toggleCourseModuleDone(trk.id, mod, trk)"
                    />
                    <span :class="isCourseModuleDone(trk.id, mod) ? 'line-through text-emerald-700 dark:text-emerald-400 font-bold' : 'text-foreground'" class="truncate text-xs">
                      {{ mod }}
                    </span>
                  </li>
                </ul>

                <!-- Lista Padrão de Leitura para Gestores (RH, DP, TI) -->
                <ul v-else class="space-y-1 text-xs max-h-40 overflow-y-auto pr-1">
                  <li
                    v-for="(mod, idx) in trk.modulesList"
                    :key="idx"
                    class="flex items-center gap-2 text-foreground font-medium py-1 px-1.5 rounded hover:bg-muted/40 transition-colors"
                  >
                    <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {{ idx + 1 }}
                    </span>
                    <span class="truncate">{{ mod }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Footer com Ações da Trilha -->
            <div class="mt-5 border-t pt-3 space-y-2">
              <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                <span class="truncate max-w-[200px]" :title="trk.recommendedFor">
                  Público: <strong>{{ trk.recommendedFor }}</strong>
                </span>
                <button
                  v-if="userPermissions.canManageTraining"
                  type="button"
                  class="text-rose-600 hover:text-rose-700 text-xs font-semibold cursor-pointer flex items-center gap-1"
                  title="Excluir trilha"
                  @click="handleDeleteTrack(trk.id)"
                >
                  <Trash2 :size="12" /> Excluir
                </button>
              </div>

              <!-- ─── VISÃO COLABORADOR / ALUNO ─── -->
              <div v-if="userPermissions.isColaborador" class="space-y-2 pt-1">
                <!-- Se NÃO estiver matriculado -->
                <div v-if="!isCourseEnrolled(trk.id)">
                  <button
                    type="button"
                    class="w-full flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-xs font-bold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 cursor-pointer"
                    style="background-color: var(--color-primary)"
                    @click="enrollInCourse(trk)"
                  >
                    <GraduationCap :size="16" /> Inscrever-se no Curso
                  </button>
                </div>

                <!-- Se JÁ estiver matriculado -->
                <div v-else class="space-y-2">
                  <!-- Barra de Progresso do Aluno -->
                  <div class="rounded-xl border bg-muted/30 p-2.5 space-y-1.5">
                    <div class="flex items-center justify-between text-xs font-bold">
                      <span class="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 :size="14" /> Matriculado
                      </span>
                      <span class="text-foreground">{{ getCourseProgress(trk) }}% Concluído</span>
                    </div>
                    <div class="w-full bg-muted rounded-full h-2 overflow-hidden border">
                      <div
                        class="bg-emerald-500 h-full transition-all duration-300"
                        :style="{ width: getCourseProgress(trk) + '%' }"
                      />
                    </div>
                  </div>

                  <!-- Botão de Emissão de Certificado -->
                  <button
                    v-if="getCourseProgress(trk) === 100"
                    type="button"
                    class="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-extrabold text-amber-950 bg-amber-400 hover:bg-amber-500 shadow-md transition-transform hover:-translate-y-0.5 cursor-pointer"
                    @click="generateCertificatePdf(trk)"
                  >
                    <Award :size="18" /> Emitir / Baixar Meu Certificado (PDF)
                  </button>
                  <button
                    v-else
                    disabled
                    type="button"
                    class="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 px-4 text-xs font-semibold bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                  >
                    <Award :size="14" /> Conclua 100% dos módulos para emitir o certificado
                  </button>
                </div>
              </div>

              <!-- ─── VISÃO GESTORES (RH / DP / TI) ─── -->
              <div v-else class="grid grid-cols-3 gap-1.5 pt-1">
                <!-- Editar Trilha & Módulos -->
                <button
                  type="button"
                  class="flex items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-all shadow-2xs"
                  @click="openEditTrackModal(trk)"
                >
                  <Edit3 :size="13" class="text-primary" />
                  <span>Editar</span>
                </button>

                <!-- Atribuir Trilha -->
                <button
                  type="button"
                  class="flex items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer transition-all shadow-2xs"
                  @click="openAssignModal(trk)"
                >
                  <UserPlus :size="13" />
                  <span>Matricular</span>
                </button>

                <!-- Emitir Certificado Modelo PDF -->
                <button
                  type="button"
                  class="flex items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer transition-all shadow-2xs"
                  title="Emitir e baixar certificado de conclusão"
                  @click="generateCertificatePdf(trk)"
                >
                  <Award :size="13" />
                  <span>Certificado</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── TAB 3: CHECKLIST DE INFRAESTRUTURA & TI ─── -->
      <section v-else-if="activeTab === 'checklist_ti'" class="space-y-6">
        <div class="rounded-2xl border bg-gradient-to-r from-amber-500/10 via-card to-card p-6 shadow-xs">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-bold">Checklist de Equipamentos & Acessos de TI</h3>
              <p class="mt-1 text-sm text-muted-foreground">
                Garantia de que 100% dos novos colaboradores recebam notebook, e-mail, crachá e credenciais antes do 1º dia de trabalho.
              </p>
            </div>
            <span class="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              {{ pendingTiStepsCount }} Pendência(s) Ativas
            </span>
          </div>
        </div>

        <!-- Tabela de Controle de Equipamentos -->
        <div class="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div class="border-b px-6 py-4">
            <h4 class="font-bold text-sm">Status de Provisionamento por Colaborador</h4>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th class="px-6 py-3.5">Colaborador</th>
                  <th class="px-6 py-3.5">Departamento</th>
                  <th class="px-6 py-3.5 text-center">Status TI</th>
                  <th class="px-6 py-3.5">Tarefas Pendentes de TI</th>
                  <th class="px-6 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="item in onboardingItems" :key="item.id" class="hover:bg-muted/30">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <UserAvatar :initials="item.employeeInitials" :size="34" />
                      <div>
                        <p class="font-semibold text-foreground">{{ item.employeeName }}</p>
                        <p class="text-xs text-muted-foreground">{{ item.role }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-xs font-medium">{{ item.department }}</td>
                  <td class="px-6 py-4 text-center">
                    <span
                      class="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                      :class="item.checklist.some(s=>s.category==='ti' && !s.completed) ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'"
                    >
                      {{ item.checklist.some(s=>s.category==='ti' && !s.completed) ? 'Pendente' : 'Equipamento Entregue' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-xs">
                    <ul class="space-y-1">
                      <li v-for="s in item.checklist.filter(s=>s.category==='ti')" :key="s.id" class="flex items-center gap-2">
                        <component :is="s.completed ? CheckSquare : Square" :size="14" :class="s.completed ? 'text-emerald-500' : 'text-amber-500'" />
                        <span :class="s.completed ? 'line-through text-muted-foreground' : 'font-semibold text-foreground'">{{ s.title }}</span>
                      </li>
                    </ul>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button
                      class="rounded-lg border px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                      @click="selectedDetailItem = item"
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>

    <!-- ─── MODAL 1: INICIAR NOVO ONBOARDING DE COLABORADOR ─── -->
    <div
      v-if="showNewEmployeeModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4 my-8">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <Plus :size="20" class="text-primary" />
            <h3 class="text-lg font-bold">Iniciar Onboarding de Novo Colaborador</h3>
          </div>
          <button class="rounded-lg p-1 text-muted-foreground hover:bg-muted" @click="showNewEmployeeModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-sm">
          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Nome do Colaborador *</label>
            <input
              v-model="newEmpForm.employeeName"
              type="text"
              placeholder="Ex: Roberto Carlos Silva"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Cargo *</label>
              <input
                v-model="newEmpForm.role"
                type="text"
                placeholder="Ex: Analista de RH"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Departamento</label>
              <select
                v-model="newEmpForm.department"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Tecnologia">Tecnologia</option>
                <option value="Marketing">Marketing</option>
                <option value="Vendas">Vendas</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Administrativo">Administrativo</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Data de Admissão</label>
              <input
                v-model="newEmpForm.startDate"
                type="text"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Mentor / Padrinho</label>
              <input
                v-model="newEmpForm.buddy"
                type="text"
                placeholder="Ex: Victor Silva"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Trilha Atribuída</label>
            <select
              v-model="newEmpForm.trackTitle"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option v-for="trk in onboardingTracks" :key="trk.id" :value="trk.title">
                {{ trk.title }} ({{ trk.department }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Observações Adicionais</label>
            <textarea
              v-model="newEmpForm.notes"
              rows="2"
              placeholder="Instruções de TI ou necessidades específicas de integração..."
              class="w-full rounded-xl border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t pt-4">
          <button
            class="rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            @click="showNewEmployeeModal = false"
          >
            Cancelar
          </button>
          <button
            class="flex items-center gap-2 rounded-xl py-2 px-5 text-sm font-bold text-primary-foreground shadow transition-transform active:scale-95"
            style="background-color: var(--color-primary)"
            @click="handleCreateEmployee"
          >
            Iniciar Processo
          </button>
        </div>
      </div>
    </div>

    <!-- ─── MODAL 2: CRIAR NOVA TRILHA ─── -->
    <div
      v-if="showNewTrackModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4 my-8">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <BookOpen :size="20" class="text-primary" />
            <h3 class="text-lg font-bold">Criar Nova Trilha de Integração</h3>
          </div>
          <button class="rounded-lg p-1 text-muted-foreground hover:bg-muted" @click="showNewTrackModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-sm">
          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Título da Trilha *</label>
            <input
              v-model="newTrackForm.title"
              type="text"
              placeholder="Ex: Trilha Avançada de Data Engineering"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Departamento</label>
              <select
                v-model="newTrackForm.department"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Tecnologia">Tecnologia</option>
                <option value="Marketing">Marketing</option>
                <option value="Vendas">Vendas</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Geral / Todos">Geral / Todos</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Duração (Dias)</label>
              <input
                v-model.number="newTrackForm.durationDays"
                type="number"
                min="1"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Descrição Breve *</label>
            <textarea
              v-model="newTrackForm.description"
              rows="2"
              placeholder="Descreva o objetivo desta trilha de integração..."
              class="w-full rounded-xl border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Módulos (Um por linha)</label>
            <textarea
              v-model="newTrackForm.modulesRaw"
              rows="3"
              placeholder="Módulo 1: Setup e Ferramentas&#10;Módulo 2: Treinamento de Produto&#10;Módulo 3: Primeiro Projeto Guiado"
              class="w-full rounded-xl border bg-background p-3 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t pt-4">
          <button
            class="rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            @click="showNewTrackModal = false"
          >
            Cancelar
          </button>
          <button
            class="flex items-center gap-2 rounded-xl py-2 px-5 text-sm font-bold text-primary-foreground shadow transition-transform active:scale-95"
            style="background-color: var(--color-primary)"
            @click="handleCreateTrack"
          >
            Salvar Trilha
          </button>
        </div>
      </div>
    </div>

    <!-- ─── MODAL 3: GERENCIAR CHECKLIST E DETALHES DO COLABORADOR ─── -->
    <div
      v-if="selectedDetailItem"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between border-b pb-4">
          <div class="flex items-center gap-3">
            <UserAvatar :initials="selectedDetailItem.employeeInitials" :size="48" />
            <div>
              <h3 class="text-xl font-bold text-foreground">{{ selectedDetailItem.employeeName }}</h3>
              <p class="text-xs text-muted-foreground">{{ selectedDetailItem.role }} • {{ selectedDetailItem.department }}</p>
            </div>
          </div>
          <button class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" @click="selectedDetailItem = null">
            <X :size="18" />
          </button>
        </div>

        <!-- Info Geral -->
        <div class="grid grid-cols-3 gap-3 border rounded-xl p-4 bg-muted/20 text-xs">
          <div>
            <p class="text-muted-foreground">Data de Admissão</p>
            <p class="font-bold text-foreground mt-0.5">{{ selectedDetailItem.startDate }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Mentor / Padrinho</p>
            <p class="font-bold text-foreground mt-0.5">👤 {{ selectedDetailItem.buddy }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Trilha de Integração</p>
            <p class="font-bold text-primary mt-0.5 truncate">{{ selectedDetailItem.trackTitle }}</p>
          </div>
        </div>

        <!-- Checklist Interativo Completo -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-sm">Checklist de Integração do Colaborador</h4>
            <span class="text-xs font-bold text-primary">{{ getItemProgress(selectedDetailItem) }}% Concluído</span>
          </div>

          <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
            <div
              v-for="step in selectedDetailItem.checklist"
              :key="step.id"
              class="flex items-center justify-between rounded-xl border p-3 text-xs transition-colors hover:bg-muted/40 cursor-pointer"
              @click="handleToggleStep(selectedDetailItem.id, step.id)"
            >
              <div class="flex items-center gap-3">
                <component :is="step.completed ? CheckSquare : Square" :size="18" :class="step.completed ? 'text-emerald-500' : 'text-muted-foreground'" />
                <div>
                  <p class="font-semibold" :class="step.completed ? 'line-through text-muted-foreground' : 'text-foreground'">{{ step.title }}</p>
                  <p class="text-[10px] text-muted-foreground capitalize">Categoria: {{ step.category }}</p>
                </div>
              </div>

              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="step.completed ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'"
              >
                {{ step.completed ? 'Concluído' : 'Pendente' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Observações -->
        <div v-if="selectedDetailItem.notes" class="border-t pt-4">
          <h4 class="font-bold text-xs text-muted-foreground uppercase mb-1">Observações do RH</h4>
          <p class="text-xs bg-muted/30 p-3 rounded-xl border leading-relaxed">{{ selectedDetailItem.notes }}</p>
        </div>

        <!-- Rodapé do Modal -->
        <div class="flex items-center justify-end gap-2 border-t pt-4">
          <button
            class="rounded-xl border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            @click="selectedDetailItem = null"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>

    <!-- ─── MODAL 4: EDITAR TRILHA & GERENCIAR MÓDULOS ─── -->
    <div
      v-if="editingTrack"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <Edit3 :size="20" class="text-primary" />
            <div>
              <h3 class="text-lg font-bold">Editar Trilha de Treinamento</h3>
              <p class="text-xs text-muted-foreground">{{ editingTrack.title }}</p>
            </div>
          </div>
          <button class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer" @click="editingTrack = null">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-4 text-sm">
          <!-- Título -->
          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Título da Trilha *</label>
            <input
              v-model="editTrackTitle"
              type="text"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Departamento</label>
              <select
                v-model="editTrackDept"
                class="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="Tecnologia">Tecnologia</option>
                <option value="Marketing">Marketing</option>
                <option value="Vendas">Vendas</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Geral / Todos">Geral / Todos</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Duração (Dias)</label>
              <input
                v-model.number="editTrackDuration"
                type="number"
                min="1"
                class="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Recomendado Para</label>
              <input
                v-model="editTrackRecommended"
                type="text"
                class="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <!-- Descrição -->
          <div>
            <label class="block font-semibold mb-1 text-xs text-muted-foreground uppercase">Descrição Breve *</label>
            <textarea
              v-model="editTrackDesc"
              rows="2"
              class="w-full rounded-xl border bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <!-- Gerenciador de Módulos Curriculares -->
          <div class="border-t pt-3 space-y-2">
            <div class="flex items-center justify-between">
              <label class="block font-bold text-xs text-foreground uppercase tracking-wider">
                Módulos Curriculares ({{ editTrackModules.length }})
              </label>
              <span class="text-xs text-muted-foreground">Adicione ou remova etapas de treinamento</span>
            </div>

            <div class="flex gap-2">
              <input
                v-model="newModuleText"
                type="text"
                placeholder="Nome do novo módulo... (ex: Segurança de Dados e LGPD)"
                class="flex-1 rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                @keydown.enter.prevent="addModuleToEdit"
              />
              <button
                type="button"
                class="rounded-xl px-4 py-2 bg-primary text-primary-foreground text-xs font-bold shadow hover:opacity-90 cursor-pointer"
                @click="addModuleToEdit"
              >
                + Adicionar
              </button>
            </div>

            <ul class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              <li
                v-for="(_mod, idx) in editTrackModules"
                :key="idx"
                class="flex items-center justify-between gap-2 p-2 rounded-xl border bg-muted/20 text-xs"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {{ idx + 1 }}
                  </span>
                  <input
                    v-model="editTrackModules[idx]"
                    type="text"
                    class="w-full bg-transparent border-b border-transparent focus:border-primary outline-none font-medium"
                  />
                </div>
                <button
                  type="button"
                  class="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                  title="Remover módulo"
                  @click="removeModuleFromEdit(idx)"
                >
                  <Trash2 :size="14" />
                </button>
              </li>
            </ul>
          </div>

          <!-- Colaboradores Matriculados nesta Trilha -->
          <div class="border-t pt-3">
            <h4 class="font-bold text-xs text-foreground uppercase tracking-wider mb-2">
              Colaboradores Inscritos nesta Trilha ({{ getTrackEnrolledItems(editingTrack.title).length }})
            </h4>

            <div v-if="!getTrackEnrolledItems(editingTrack.title).length" class="text-xs text-muted-foreground italic py-2">
              Nenhum colaborador matriculado diretamente ainda. Clique em "Matricular" para inscrever membros da equipe.
            </div>

            <div v-else class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              <div
                v-for="enrolled in getTrackEnrolledItems(editingTrack.title)"
                :key="enrolled.id"
                class="flex items-center justify-between p-2 rounded-xl border bg-muted/20 text-xs"
              >
                <div>
                  <span class="font-bold">{{ enrolled.employeeName }}</span>
                  <span class="text-muted-foreground ml-2">({{ enrolled.department }})</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-primary text-[11px]">{{ getItemProgress(enrolled) }}%</span>
                  <button
                    type="button"
                    class="text-amber-700 dark:text-amber-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    title="Emitir certificado para este colaborador"
                    @click="generateCertificatePdf(editingTrack!, enrolled.employeeName)"
                  >
                    <Award :size="13" /> Certificado
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t pt-4">
          <button
            type="button"
            class="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            @click="handleDeleteTrack(editingTrack.id)"
          >
            <Trash2 :size="14" /> Excluir Trilha
          </button>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              @click="editingTrack = null"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-xl py-2 px-5 text-xs font-bold text-primary-foreground shadow transition-transform active:scale-95 cursor-pointer"
              style="background-color: var(--color-primary)"
              @click="saveTrackEdits"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── MODAL 5: MATRICULAR COLABORADOR NA TRILHA ─── -->
    <div
      v-if="assigningTrack"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <UserPlus :size="20" class="text-emerald-600" />
            <h3 class="text-base font-bold">Matricular na Trilha</h3>
          </div>
          <button class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer" @click="assigningTrack = null">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div class="rounded-xl border p-3 bg-muted/20 space-y-1">
            <p class="font-bold text-sm text-foreground">{{ assigningTrack.title }}</p>
            <p class="text-muted-foreground">{{ assigningTrack.department }} · ⏱️ {{ assigningTrack.durationDays }} dias de duração ({{ assigningTrack.totalModules }} módulos)</p>
          </div>

          <div>
            <label class="block font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
              Selecione o Colaborador para Iniciar a Trilha *
            </label>
            <select
              v-if="employeeFolders.length"
              v-model="selectedEmpName"
              class="w-full rounded-xl border bg-background p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option v-for="emp in employeeFolders" :key="emp.id" :value="emp.name">
                {{ emp.name }} — {{ emp.role }} ({{ emp.department }})
              </option>
            </select>
            <input
              v-else
              v-model="selectedEmpName"
              type="text"
              placeholder="Digite o nome completo do colaborador..."
              class="w-full rounded-xl border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t pt-3">
          <button
            type="button"
            class="rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
            @click="assigningTrack = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow cursor-pointer bg-emerald-600 hover:bg-emerald-700 transition-all"
            :disabled="!selectedEmpName"
            @click="confirmAssign"
          >
            <UserPlus :size="14" /> Matricular Agora
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
