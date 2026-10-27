<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  UserCheck,
  FileText,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Download,
  UploadCloud,
  Eye,
  ArrowRight,
  Shield,
  ShieldAlert,
  MessageSquare,
  Send,
  RefreshCw,
  FileUp,
  Building,
  MapPin,
  Calendar,
  Briefcase,
  Sparkles,
  AlertCircle,
  X,
} from "lucide-vue-next"
import {
  apiFetch,
  currentUser,
  activeUserRole,
  showToast,
} from "../store"

/* ─── Interfaces ─── */
interface EmployeeProfile {
  id: string
  name: string
  email: string
  role?: string
  department?: string
  manager?: string
  hireDate?: string
  status?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  cep?: string
  location?: string
  tenure?: string
  contractType?: string
  workSchedule?: string
  notes?: string
  emergencyContact?: string
}

interface RequestRecord {
  id: string
  type: string
  requester: string
  department: string
  date: string
  status: string
  priority: string
  description: string
  justification?: string
  review_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  attachment_name?: string
  details?: {
    created_by_id?: string
    created_by_email?: string
    created_by_name?: string
    changes?: Record<string, string>
    original?: Record<string, string>
    justification?: string
    attachment_name?: string
    attachment_base64?: string
    attachment_mime?: string
  }
}

interface DocumentRecord {
  id: string
  name: string
  category: string
  employeeName: string
  date: string
  status: string
  fileUrl: string
  type: string
  origin: "pessoal" | "administrativo"
  file_size?: number
  notes?: string
}

interface RequestComment {
  id: string
  request_id: string
  author_id: string
  author_name: string
  author_role: string
  comment: string
  created_at: string
}

/* ─── State Principal ─── */
const activeTab = ref<"dados" | "solicitacoes" | "aprovacoes" | "documentos">("dados")
const loading = ref(true)
const loadError = ref<string | null>(null)

const employee = ref<EmployeeProfile | null>(null)
const requests = ref<RequestRecord[]>([])
const documents = ref<DocumentRecord[]>([])
const vacationInfo = ref({
  diasDisponiveis: 30,
  diasUtilizados: 0,
  proximoPeriodo: "Período Aquisitivo Vigente",
  temFeriasPendentes: false,
})

// Aba de Aprovações (para RH / Gestores / Admin)
const hrRequests = ref<RequestRecord[]>([])
const hrLoading = ref(false)

// Filtros
const reqSearch = ref("")
const reqStatusFilter = ref<string>("todos")
const hrStatusFilter = ref<string>("todos")
const hrSearch = ref("")
const docFilterOrigin = ref<"todos" | "pessoal" | "administrativo">("todos")
const docSearch = ref("")

// Modais
const showCadastralModal = ref(false)
const showNewRequestModal = ref(false)
const showDetailModal = ref(false)
const showUploadDocModal = ref(false)
const showDecisionModal = ref(false)

const selectedRequest = ref<RequestRecord | null>(null)
const selectedRequestComments = ref<RequestComment[]>([])
const newCommentText = ref("")
const sendingComment = ref(false)

// Decisão do RH
const decisionType = ref<"aprovado" | "rejeitado" | "correção solicitada">("aprovado")
const decisionJustification = ref("")
const submittingDecision = ref(false)

// Form de Alteração Cadastral
const cadastralForm = ref({
  phone: "",
  address: "",
  city: "",
  state: "",
  cep: "",
  emergencyContact: "",
  justification: "",
})
const submittingCadastral = ref(false)

// Form de Nova Solicitação
const newReqForm = ref({
  type: "Atualização Cadastral",
  priority: "Média",
  description: "",
  justification: "",
  attachmentName: "",
  attachmentBase64: "",
  attachmentMime: "",
})
const submittingNewReq = ref(false)

// Form de Upload de Documento
const uploadForm = ref({
  name: "",
  category: "Comprovantes",
  file_base64: "",
  mime_type: "application/pdf",
  file_size: 0,
  notes: "",
  fileName: "",
})
const submittingUpload = ref(false)

/* ─── Computed Helpers ─── */
const isHrOrManager = computed(() => {
  const role = activeUserRole.value
  return role === "ADMIN" || role === "RH" || role === "GESTOR"
})

const filteredRequests = computed(() => {
  return requests.value.filter((r) => {
    const matchStatus = reqStatusFilter.value === "todos" || r.status.toLowerCase() === reqStatusFilter.value.toLowerCase()
    const q = reqSearch.value.toLowerCase().trim()
    const matchSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })
})

const filteredHrRequests = computed(() => {
  return hrRequests.value.filter((r) => {
    const matchStatus = hrStatusFilter.value === "todos" || r.status.toLowerCase() === hrStatusFilter.value.toLowerCase()
    const q = hrSearch.value.toLowerCase().trim()
    const matchSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.requester.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })
})

const filteredDocuments = computed(() => {
  return documents.value.filter((d) => {
    const matchOrigin = docFilterOrigin.value === "todos" || d.origin === docFilterOrigin.value
    const q = docSearch.value.toLowerCase().trim()
    const matchSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    return matchOrigin && matchSearch
  })
})

const pendingRequestsCount = computed(() => {
  return requests.value.filter((r) => ["pendente", "em análise", "em_analise", "correção solicitada"].includes(r.status.toLowerCase())).length
})

const correctionRequestsCount = computed(() => {
  return requests.value.filter((r) => r.status.toLowerCase().includes("correção")).length
})

const hrPendingCount = computed(() => {
  return hrRequests.value.filter((r) => ["pendente", "em análise", "em_analise", "correção solicitada"].includes(r.status.toLowerCase())).length
})

/* ─── Carregamento de Dados ─── */
async function loadPortalData() {
  loading.value = true
  loadError.value = null

  try {
    const res = await apiFetch("/api/employees/me")
    const data = await res.json()

    if (data.ok) {
      employee.value = data.employee || null
      requests.value = data.requests || []
      documents.value = data.documents || []
      if (data.vacation) vacationInfo.value = data.vacation
    } else {
      loadError.value = data.error || "Erro ao carregar dados do colaborador."
    }
  } catch (err: any) {
    loadError.value = "Não foi possível conectar ao servidor de autoatendimento."
  } finally {
    loading.value = false
  }

  // Se for RH/Gestor, carregar lista de solicitações pendentes para aprovação
  if (isHrOrManager.value) {
    loadHrApprovals()
  }
}

async function loadHrApprovals() {
  hrLoading.value = true
  try {
    const res = await apiFetch("/api/requests")
    const data = await res.json()
    if (data.ok) {
      hrRequests.value = data.requests || []
    }
  } catch (_e) {
  } finally {
    hrLoading.value = false
  }
}

onMounted(() => {
  loadPortalData()
})

/* ─── Fluxo de Alteração Cadastral ─── */
function openCadastralModal() {
  if (employee.value) {
    cadastralForm.value = {
      phone: employee.value.phone || "",
      address: employee.value.address || "",
      city: employee.value.city || "",
      state: employee.value.state || "",
      cep: employee.value.cep || "",
      emergencyContact: employee.value.emergencyContact || "",
      justification: "",
    }
  }
  showCadastralModal.value = true
}

const cadastralDiff = computed(() => {
  if (!employee.value) return []
  const diffs: { field: string; label: string; oldVal: string; newVal: string }[] = []

  const fields = [
    { key: "phone", label: "Telefone" },
    { key: "address", label: "Endereço Residencial" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "Estado (UF)" },
    { key: "cep", label: "CEP" },
    { key: "emergencyContact", label: "Contato de Emergência" },
  ]

  for (const f of fields) {
    const oldV = (employee.value as any)[f.key] || ""
    const newV = (cadastralForm.value as any)[f.key] || ""
    if (newV.trim() !== oldV.trim()) {
      diffs.push({ field: f.key, label: f.label, oldVal: oldV || "Não informado", newVal: newV || "Em branco" })
    }
  }
  return diffs
})

async function submitCadastralUpdate() {
  if (cadastralDiff.value.length === 0) {
    showToast("Nenhuma alteração foi realizada nos campos cadastrais.", "warning")
    return
  }
  if (!cadastralForm.value.justification.trim()) {
    showToast("Por favor, informe uma justificativa para a alteração cadastral.", "warning")
    return
  }

  submittingCadastral.value = true
  try {
    const changes: Record<string, string> = {}
    for (const d of cadastralDiff.value) {
      changes[d.field] = (cadastralForm.value as any)[d.field]
    }

    const res = await apiFetch("/api/employees/me/request-update", {
      method: "POST",
      body: JSON.stringify({
        changes,
        justification: cadastralForm.value.justification.trim(),
      }),
    })
    const data = await res.json()

    if (res.ok && data.ok) {
      showToast("Solicitação de alteração cadastral enviada com sucesso para análise do RH!", "success")
      showCadastralModal.value = false
      await loadPortalData()
      activeTab.value = "solicitacoes"
    } else {
      showToast(data.error || "Erro ao registrar alteração cadastral.", "error")
    }
  } catch (err) {
    showToast("Falha na comunicação com o servidor.", "error")
  } finally {
    submittingCadastral.value = false
  }
}

/* ─── Fluxo de Nova Solicitação Genérica ─── */
function openNewRequestModal(defaultType = "Declaração de Vínculo") {
  newReqForm.value = {
    type: defaultType,
    priority: "Média",
    description: "",
    justification: "",
    attachmentName: "",
    attachmentBase64: "",
    attachmentMime: "",
  }
  showNewRequestModal.value = true
}

function handleRequestFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    showToast("O arquivo não pode exceder 5MB.", "warning")
    target.value = ""
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const base64Str = (reader.result as string).split(",")[1]
    newReqForm.value.attachmentName = file.name
    newReqForm.value.attachmentBase64 = base64Str
    newReqForm.value.attachmentMime = file.type || "application/pdf"
  }
  reader.readAsDataURL(file)
}

async function submitNewRequest() {
  if (!newReqForm.value.description.trim()) {
    showToast("Informe a descrição e os detalhes do seu pedido.", "warning")
    return
  }

  submittingNewReq.value = true
  try {
    const payload = {
      type: newReqForm.value.type,
      priority: newReqForm.value.priority,
      description: newReqForm.value.description.trim(),
      details: {
        justification: newReqForm.value.justification.trim(),
        attachment_name: newReqForm.value.attachmentName || undefined,
        attachment_base64: newReqForm.value.attachmentBase64 || undefined,
        attachment_mime: newReqForm.value.attachmentMime || undefined,
      },
    }

    const res = await apiFetch("/api/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (res.ok && data.ok) {
      showToast(`Solicitação ${data.id} aberta com sucesso!`, "success")
      showNewRequestModal.value = false
      await loadPortalData()
      activeTab.value = "solicitacoes"
    } else {
      showToast(data.error || "Erro ao registrar solicitação.", "error")
    }
  } catch (_e) {
    showToast("Erro ao abrir solicitação.", "error")
  } finally {
    submittingNewReq.value = false
  }
}

/* ─── Cancelamento pelo Colaborador ─── */
async function cancelMyRequest(reqItem: RequestRecord) {
  if (!confirm(`Tem certeza que deseja cancelar a solicitação ${reqItem.id}?`)) {
    return
  }

  try {
    const res = await apiFetch(`/api/requests/${reqItem.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Cancelado" }),
    })
    const data = await res.json()

    if (res.ok && data.ok) {
      showToast(`Solicitação ${reqItem.id} cancelada com sucesso.`, "info")
      if (selectedRequest.value?.id === reqItem.id) {
        selectedRequest.value.status = "Cancelado"
      }
      await loadPortalData()
    } else {
      showToast(data.error || "Não foi possível cancelar a solicitação.", "error")
    }
  } catch (_e) {
    showToast("Falha ao comunicar com o servidor.", "error")
  }
}

/* ─── Detalhes & Linha do Tempo / Comentários ─── */
async function openRequestDetail(reqItem: RequestRecord) {
  selectedRequest.value = reqItem
  showDetailModal.value = true
  selectedRequestComments.value = []
  newCommentText.value = ""

  try {
    const res = await apiFetch(`/api/requests/${reqItem.id}/comments`)
    const data = await res.json()
    if (data.ok) {
      selectedRequestComments.value = data.comments || []
    }
  } catch (_e) {}
}

async function submitComment() {
  if (!selectedRequest.value || !newCommentText.value.trim()) return

  sendingComment.value = true
  try {
    const res = await apiFetch(`/api/requests/${selectedRequest.value.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ comment: newCommentText.value.trim() }),
    })
    const data = await res.json()

    if (res.ok && data.ok) {
      selectedRequestComments.value.push(data.comment)
      newCommentText.value = ""
      showToast("Comentário adicionado à linha do tempo.", "success")
    } else {
      showToast(data.error || "Erro ao registrar comentário.", "error")
    }
  } catch (_e) {
    showToast("Erro ao enviar comentário.", "error")
  } finally {
    sendingComment.value = false
  }
}

/* ─── Fluxo de Decisão do RH ─── */
function openDecisionModal(reqItem: RequestRecord, type: "aprovado" | "rejeitado" | "correção solicitada") {
  selectedRequest.value = reqItem
  decisionType.value = type
  decisionJustification.value = ""
  showDecisionModal.value = true
}

const isSelfRequester = computed(() => {
  if (!selectedRequest.value || !currentUser.value) return false
  const userEmail = (currentUser.value.email || "").toLowerCase()
  const userName = (currentUser.value.name || "").toLowerCase()
  const reqEmail = (selectedRequest.value.details?.created_by_email || "").toLowerCase()
  const reqName = (selectedRequest.value.requester || "").toLowerCase()

  return userEmail === reqEmail || userName === reqName || reqName.includes(userName)
})

async function submitHrDecision() {
  if (!selectedRequest.value) return

  if (isSelfRequester.value && decisionType.value === "aprovado") {
    showToast("Violação de Governança: Você não pode aprovar sua própria solicitação.", "error")
    return
  }

  if (
    (decisionType.value === "rejeitado" || decisionType.value.includes("correção")) &&
    !decisionJustification.value.trim()
  ) {
    showToast("Justificativa obrigatória para rejeição ou solicitação de correções.", "warning")
    return
  }

  submittingDecision.value = true
  try {
    const formattedStatus =
      decisionType.value === "aprovado"
        ? "Aprovado"
        : decisionType.value === "rejeitado"
        ? "Rejeitado"
        : "Correção Solicitada"

    const res = await apiFetch(`/api/requests/${selectedRequest.value.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: formattedStatus,
        justification: decisionJustification.value.trim(),
      }),
    })
    const data = await res.json()

    if (res.ok && data.ok) {
      showToast(`Solicitação atualizada para "${formattedStatus}" com sucesso!`, "success")
      showDecisionModal.value = false
      if (showDetailModal.value) showDetailModal.value = false
      await loadPortalData()
      if (isHrOrManager.value) await loadHrApprovals()
    } else {
      showToast(data.error || "Erro ao processar decisão.", "error")
    }
  } catch (_e) {
    showToast("Falha na comunicação com o servidor.", "error")
  } finally {
    submittingDecision.value = false
  }
}

/* ─── Upload de Documentos Pessoais ─── */
function openUploadDocModal() {
  uploadForm.value = {
    name: "",
    category: "Comprovantes",
    file_base64: "",
    mime_type: "application/pdf",
    file_size: 0,
    notes: "",
    fileName: "",
  }
  showUploadDocModal.value = true
}

function handleDocFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  if (!allowed.includes(file.type)) {
    showToast("Formato não suportado. Envie PDF, JPG, PNG ou DOCX.", "warning")
    target.value = ""
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast("O arquivo não pode exceder 5MB.", "warning")
    target.value = ""
    return
  }

  uploadForm.value.fileName = file.name
  if (!uploadForm.value.name) {
    uploadForm.value.name = file.name.replace(/\.[^/.]+$/, "")
  }
  uploadForm.value.file_size = file.size
  uploadForm.value.mime_type = file.type

  const reader = new FileReader()
  reader.onload = () => {
    uploadForm.value.file_base64 = (reader.result as string).split(",")[1]
  }
  reader.readAsDataURL(file)
}

async function submitDocUpload() {
  if (!uploadForm.value.name.trim() || !uploadForm.value.file_base64) {
    showToast("Informe o nome do documento e selecione o arquivo.", "warning")
    return
  }

  submittingUpload.value = true
  try {
    const res = await apiFetch("/api/documents/upload", {
      method: "POST",
      body: JSON.stringify({
        name: uploadForm.value.name.trim(),
        category: uploadForm.value.category,
        file_base64: uploadForm.value.file_base64,
        mime_type: uploadForm.value.mime_type,
        file_size: uploadForm.value.file_size,
        notes: uploadForm.value.notes.trim() || undefined,
      }),
    })
    const data = await res.json()

    if (res.ok && data.ok) {
      showToast("Documento pessoal anexado com sucesso!", "success")
      showUploadDocModal.value = false
      await loadPortalData()
    } else {
      showToast(data.error || "Erro ao realizar upload do documento.", "error")
    }
  } catch (_e) {
    showToast("Falha ao comunicar com o servidor.", "error")
  } finally {
    submittingUpload.value = false
  }
}

async function downloadDocument(doc: DocumentRecord) {
  try {
    const res = await apiFetch(`/api/documents/${doc.id}/download`)
    if (!res.ok) {
      const err = await res.json()
      showToast(err.error || "Erro ao baixar arquivo.", "error")
      return
    }

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const json = await res.json()
      showToast(json.message || "Documento verificado.", "info")
      return
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${doc.name}.${doc.type?.toLowerCase() || 'pdf'}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
    showToast(`Download de "${doc.name}" iniciado.`, "success")
  } catch (_e) {
    showToast("Erro durante o download do documento.", "error")
  }
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === "aprovado") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
  if (s === "rejeitado" || s === "recusado") return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
  if (s.includes("correção")) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse"
  if (s === "cancelado") return "bg-muted text-muted-foreground border-border"
  return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
}
</script>

<template>
  <main class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background text-foreground" id="self-service-portal">
    <!-- Cabeçalho Principal do Portal -->
    <header class="border-b bg-card px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
              Portal de Autoatendimento
            </h1>
            <span
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-2xs"
              :class="{
                'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30': activeUserRole === 'COLABORADOR',
                'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30': activeUserRole === 'RH',
                'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30': activeUserRole === 'GESTOR',
                'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30': activeUserRole === 'ADMIN',
              }"
            >
              <UserCheck :size="13" />
              {{ activeUserRole === 'COLABORADOR' ? 'Área do Colaborador' : `Visão Integrada (${activeUserRole})` }}
            </span>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            Acesse seus dados cadastrais, abra solicitações com acompanhamento em tempo real e consulte documentos autorizados.
          </p>
        </div>

        <!-- Ações Rápidas -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            @click="loadPortalData"
            :disabled="loading"
            title="Atualizar dados"
          >
            <RefreshCw :size="15" :class="{ 'animate-spin': loading }" />
            Atualizar
          </button>

          <button
            class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
            @click="openNewRequestModal('Declaração de Vínculo')"
          >
            <Plus :size="16" />
            Nova Solicitação
          </button>
        </div>
      </div>

      <!-- Métricas / Indicadores Rápidos -->
      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Solicitações Ativas</span>
            <CalendarCheck :size="16" class="text-primary" />
          </div>
          <p class="mt-1.5 text-2xl font-bold">{{ pendingRequestsCount }}</p>
        </div>

        <div class="rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Férias Disponíveis</span>
            <Sparkles :size="16" class="text-emerald-500" />
          </div>
          <p class="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {{ vacationInfo.diasDisponiveis }} dias
          </p>
        </div>

        <div class="rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Documentos Salvos</span>
            <FileText :size="16" class="text-blue-500" />
          </div>
          <p class="mt-1.5 text-2xl font-bold">{{ documents.length }}</p>
        </div>

        <div class="rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <div class="flex items-center justify-between text-muted-foreground">
            <span class="text-xs font-medium">Correções Pendentes</span>
            <AlertTriangle :size="16" :class="correctionRequestsCount > 0 ? 'text-amber-500' : 'text-muted-foreground'" />
          </div>
          <p class="mt-1.5 text-2xl font-bold" :class="correctionRequestsCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''">
            {{ correctionRequestsCount }}
          </p>
        </div>
      </div>

      <!-- Abas de Navegação -->
      <nav class="mt-6 flex space-x-1 border-b border-border/40 overflow-x-auto scrollbar-thin pb-px" aria-label="Abas do Portal">
        <button
          class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shrink-0"
          :class="activeTab === 'dados'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          @click="activeTab = 'dados'"
        >
          <UserCheck :size="16" />
          Meus Dados
        </button>

        <button
          class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shrink-0"
          :class="activeTab === 'solicitacoes'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          @click="activeTab = 'solicitacoes'"
        >
          <CalendarCheck :size="16" />
          Minhas Solicitações
          <span
            v-if="pendingRequestsCount > 0"
            class="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold"
          >
            {{ pendingRequestsCount }}
          </span>
        </button>

        <button
          class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shrink-0"
          :class="activeTab === 'documentos'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          @click="activeTab = 'documentos'"
        >
          <FileText :size="16" />
          Meus Documentos
        </button>

        <!-- Aba de Aprovações para Perfis com Governança (RH / Gestor / Admin) -->
        <button
          v-if="isHrOrManager"
          class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shrink-0"
          :class="activeTab === 'aprovacoes'
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          @click="activeTab = 'aprovacoes'"
        >
          <Shield :size="16" />
          Aprovações do RH
          <span
            v-if="hrPendingCount > 0"
            class="ml-1 rounded-full bg-indigo-500 text-white px-1.5 py-0.2 text-[10px] font-bold"
          >
            {{ hrPendingCount }}
          </span>
        </button>
      </nav>
    </header>

    <!-- Conteúdo Principal -->
    <div class="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
      <!-- Loading Skeleton State -->
      <div v-if="loading" class="space-y-6 animate-pulse">
        <div class="h-44 rounded-2xl bg-muted/60"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="h-64 rounded-2xl bg-muted/60"></div>
          <div class="h-64 rounded-2xl bg-muted/60"></div>
        </div>
      </div>

      <!-- Erro de Carregamento -->
      <div v-else-if="loadError" class="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <AlertCircle :size="36" class="mx-auto text-destructive mb-2" />
        <h3 class="text-lg font-semibold text-destructive">Não foi possível carregar o portal</h3>
        <p class="mt-1 text-sm text-muted-foreground">{{ loadError }}</p>
        <button
          class="mt-4 rounded-xl bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors"
          @click="loadPortalData"
        >
          Tentar novamente
        </button>
      </div>

      <!-- Conteúdo das Abas -->
      <div v-else>
        <!-- ========================================== -->
        <!-- ABA 1: MEUS DADOS PESSOAIS E FUNCIONAIS     -->
        <!-- ========================================== -->
        <section v-if="activeTab === 'dados'" class="space-y-6">
          <!-- Card Hero de Apresentação -->
          <div class="rounded-2xl border bg-card p-6 shadow-2xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-bold border border-primary/20">
                  {{ employee?.name ? employee.name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'CL' }}
                </div>
                <div>
                  <h2 class="text-xl font-bold">{{ employee?.name || currentUser?.name || 'Colaborador' }}</h2>
                  <p class="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building :size="14" />
                    {{ employee?.department || currentUser?.department || 'Departamento Geral' }}
                    <span v-if="employee?.role" class="text-border">•</span>
                    <span v-if="employee?.role">{{ employee.role }}</span>
                  </p>
                </div>
              </div>

              <!-- Botão Solicitar Atualização Cadastral -->
              <button
                class="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                @click="openCadastralModal"
              >
                <FileUp :size="16" />
                Solicitar Atualização Cadastral
              </button>
            </div>
          </div>

          <!-- Grid de Informações -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Informações Funcionais / Cargo -->
            <div class="rounded-2xl border bg-card p-6 shadow-2xs">
              <h3 class="text-base font-bold flex items-center gap-2 mb-4">
                <Briefcase :size="18" class="text-primary" />
                Vínculo & Lotação
              </h3>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div v-if="employee?.role">
                  <dt class="text-xs text-muted-foreground">Cargo Oficial</dt>
                  <dd class="font-medium mt-0.5">{{ employee.role }}</dd>
                </div>
                <div v-if="employee?.department">
                  <dt class="text-xs text-muted-foreground">Departamento</dt>
                  <dd class="font-medium mt-0.5">{{ employee.department }}</dd>
                </div>
                <div v-if="employee?.manager">
                  <dt class="text-xs text-muted-foreground">Gestor Imediato</dt>
                  <dd class="font-medium mt-0.5">{{ employee.manager }}</dd>
                </div>
                <div v-if="employee?.hireDate">
                  <dt class="text-xs text-muted-foreground">Data de Admissão</dt>
                  <dd class="font-medium mt-0.5">{{ employee.hireDate }}</dd>
                </div>
                <div v-if="employee?.tenure">
                  <dt class="text-xs text-muted-foreground">Tempo de Empresa</dt>
                  <dd class="font-medium mt-0.5">{{ employee.tenure }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Modalidade Contratual</dt>
                  <dd class="font-medium mt-0.5">{{ employee?.contractType || 'CLT Padrão' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Jornada de Trabalho</dt>
                  <dd class="font-medium mt-0.5">{{ employee?.workSchedule || 'Segunda a Sexta (44h)' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Unidade / Localização</dt>
                  <dd class="font-medium mt-0.5">{{ employee?.location || 'Matriz — São Paulo, SP' }}</dd>
                </div>
              </dl>
            </div>

            <!-- Dados de Contato & Residência -->
            <div class="rounded-2xl border bg-card p-6 shadow-2xs">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold flex items-center gap-2">
                  <MapPin :size="18" class="text-primary" />
                  Contato & Residência
                </h3>
                <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Dados Pessoais</span>
              </div>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-xs text-muted-foreground">E-mail Corporativo</dt>
                  <dd class="font-medium mt-0.5 truncate" :title="employee?.email || currentUser?.email">
                    {{ employee?.email || currentUser?.email }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Telefone de Contato</dt>
                  <dd class="font-medium mt-0.5">{{ employee?.phone || 'Não cadastrado' }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs text-muted-foreground">Endereço Residencial</dt>
                  <dd class="font-medium mt-0.5">{{ employee?.address || 'Não cadastrado' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Cidade / UF</dt>
                  <dd class="font-medium mt-0.5">
                    {{ employee?.city ? `${employee.city} - ${employee.state || 'SP'}` : 'Não cadastrado' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">CEP</dt>
                  <dd class="font-medium mt-0.5">{{ employee?.cep || 'Não cadastrado' }}</dd>
                </div>
                <div class="sm:col-span-2" v-if="employee?.emergencyContact">
                  <dt class="text-xs text-muted-foreground">Contato de Emergência</dt>
                  <dd class="font-medium mt-0.5">{{ employee.emergencyContact }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <!-- Card de Férias Consolidado -->
          <div class="rounded-2xl border bg-card p-6 shadow-2xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 class="text-base font-bold flex items-center gap-2">
                  <Sparkles :size="18" class="text-emerald-500" />
                  Saldo de Férias & Período Aquisitivo
                </h3>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ vacationInfo.proximoPeriodo }} • Saldo calculado conforme CLT
                </p>
              </div>
              <button
                class="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                @click="openNewRequestModal('Férias')"
              >
                <Calendar :size="15" />
                Agendar Férias
              </button>
            </div>

            <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="p-4 rounded-xl bg-muted/40 border border-border/50">
                <span class="text-xs text-muted-foreground">Dias Disponíveis</span>
                <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {{ vacationInfo.diasDisponiveis }} dias
                </p>
              </div>
              <div class="p-4 rounded-xl bg-muted/40 border border-border/50">
                <span class="text-xs text-muted-foreground">Dias Usufruídos</span>
                <p class="text-2xl font-bold text-muted-foreground mt-1">
                  {{ vacationInfo.diasUtilizados }} dias
                </p>
              </div>
              <div class="p-4 rounded-xl bg-muted/40 border border-border/50">
                <span class="text-xs text-muted-foreground">Status do Período</span>
                <p class="text-sm font-semibold text-primary mt-2">
                  {{ vacationInfo.temFeriasPendentes ? 'Solicitação em análise' : 'Regular' }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- ========================================== -->
        <!-- ABA 2: MINHAS SOLICITAÇÕES                 -->
        <!-- ========================================== -->
        <section v-if="activeTab === 'solicitacoes'" class="space-y-6">
          <!-- Barra de Busca e Filtros -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div class="relative flex-1 max-w-md">
              <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="reqSearch"
                type="text"
                placeholder="Buscar por protocolo, categoria ou descrição..."
                class="w-full rounded-xl border bg-card pl-9 pr-4 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Filtro de Status -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                v-for="st in [
                  { label: 'Todas', val: 'todos' },
                  { label: 'Em Análise', val: 'em análise' },
                  { label: 'Aprovadas', val: 'aprovado' },
                  { label: 'Correção', val: 'correção solicitada' },
                  { label: 'Canceladas', val: 'cancelado' }
                ]"
                :key="st.val"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border"
                :class="reqStatusFilter === st.val
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'"
                @click="reqStatusFilter = st.val"
              >
                {{ st.label }}
              </button>
            </div>
          </div>

          <!-- Lista de Solicitações -->
          <div v-if="filteredRequests.length > 0" class="space-y-3">
            <div
              v-for="r in filteredRequests"
              :key="r.id"
              class="group rounded-2xl border bg-card p-5 hover:border-primary/50 transition-all hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
              @click="openRequestDetail(r)"
            >
              <div class="flex items-start gap-3.5">
                <div class="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                  <CalendarCheck :size="20" />
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-mono font-bold text-muted-foreground">{{ r.id }}</span>
                    <span class="text-sm font-bold">{{ r.type }}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full border font-semibold" :class="getStatusBadge(r.status)">
                      {{ r.status }}
                    </span>
                    <span class="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {{ r.priority }}
                    </span>
                  </div>
                  <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ r.description }}</p>
                  
                  <!-- Alerta se houver justificativa de revisão / pendência -->
                  <div v-if="r.review_notes" class="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 inline-block">
                    💬 Retorno do RH: {{ r.review_notes }}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0 self-end md:self-center">
                <span class="text-xs text-muted-foreground">{{ r.date }}</span>

                <!-- Botão de Cancelar se ainda estiver em análise -->
                <button
                  v-if="['pendente', 'em análise', 'em_analise', 'correção solicitada'].includes(r.status.toLowerCase())"
                  class="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-xs font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
                  @click.stop="cancelMyRequest(r)"
                  title="Cancelar esta solicitação"
                >
                  Cancelar
                </button>

                <button class="text-muted-foreground group-hover:text-foreground">
                  <ArrowRight :size="16" />
                </button>
              </div>
            </div>
          </div>

          <!-- Estado Vazio -->
          <div v-else class="rounded-2xl border border-dashed p-10 text-center">
            <CalendarCheck :size="36" class="mx-auto text-muted-foreground mb-2 opacity-50" />
            <h4 class="font-semibold text-base">Nenhuma solicitação encontrada</h4>
            <p class="text-sm text-muted-foreground mt-1">
              {{ reqSearch || reqStatusFilter !== 'todos' ? 'Nenhum chamado corresponde aos filtros aplicados.' : 'Você ainda não possui solicitações abertas.' }}
            </p>
            <button
              class="mt-4 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              @click="openNewRequestModal()"
            >
              <Plus :size="16" />
              Abrir Solicitação
            </button>
          </div>
        </section>

        <!-- ========================================== -->
        <!-- ABA 3: MEUS DOCUMENTOS                     -->
        <!-- ========================================== -->
        <section v-if="activeTab === 'documentos'" class="space-y-6">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <!-- Alternador de Origem (Administrativos vs Pessoais) -->
            <div class="flex items-center gap-1.5 border rounded-xl p-1 bg-card">
              <button
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                :class="docFilterOrigin === 'todos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="docFilterOrigin = 'todos'"
              >
                Todos ({{ documents.length }})
              </button>
              <button
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                :class="docFilterOrigin === 'administrativo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="docFilterOrigin = 'administrativo'"
              >
                Institucionais & RH
              </button>
              <button
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                :class="docFilterOrigin === 'pessoal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="docFilterOrigin = 'pessoal'"
              >
                Pessoais & Comprovantes
              </button>
            </div>

            <!-- Upload de Documento Pessoal -->
            <button
              class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-all cursor-pointer"
              @click="openUploadDocModal"
            >
              <UploadCloud :size="16" />
              Enviar Documento Pessoal
            </button>
          </div>

          <!-- Lista de Documentos -->
          <div v-if="filteredDocuments.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="d in filteredDocuments"
              :key="d.id"
              class="rounded-2xl border bg-card p-5 hover:border-primary/40 transition-all hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <div class="p-2 rounded-xl bg-primary/10 text-primary">
                      <FileText :size="18" />
                    </div>
                    <span
                      class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      :class="d.origin === 'pessoal'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                        : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'"
                    >
                      {{ d.origin === 'pessoal' ? 'Pessoal' : 'Institucional' }}
                    </span>
                  </div>
                  <span class="text-xs font-mono text-muted-foreground">{{ d.type || 'PDF' }}</span>
                </div>

                <h4 class="font-bold text-base mt-3 line-clamp-1" :title="d.name">{{ d.name }}</h4>
                <p class="text-xs text-muted-foreground mt-0.5">{{ d.category }} • Emitido em {{ d.date }}</p>
                <p v-if="d.notes" class="text-xs text-muted-foreground mt-2 italic bg-muted/30 p-2 rounded">
                  "{{ d.notes }}"
                </p>
              </div>

              <!-- Ação de Download Seguro -->
              <div class="mt-4 pt-3 border-t flex items-center justify-between">
                <span class="text-xs text-muted-foreground font-mono">
                  {{ d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : 'Autorizado' }}
                </span>
                <button
                  class="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer"
                  @click="downloadDocument(d)"
                >
                  <Download :size="13" />
                  Baixar Arquivo
                </button>
              </div>
            </div>
          </div>

          <!-- Estado Vazio de Documentos -->
          <div v-else class="rounded-2xl border border-dashed p-10 text-center">
            <FileText :size="36" class="mx-auto text-muted-foreground mb-2 opacity-50" />
            <h4 class="font-semibold text-base">Nenhum documento disponível</h4>
            <p class="text-sm text-muted-foreground mt-1">
              Envie atestados, certificados ou comprovantes no formato PDF ou imagem.
            </p>
            <button
              class="mt-4 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              @click="openUploadDocModal"
            >
              <UploadCloud :size="16" />
              Enviar Documento
            </button>
          </div>
        </section>

        <!-- ========================================== -->
        <!-- ABA 4: ÁREA DE APROVAÇÕES DO RH (GOVERNANÇA)-->
        <!-- ========================================== -->
        <section v-if="activeTab === 'aprovacoes' && isHrOrManager" class="space-y-6">
          <div class="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-start gap-3">
            <Shield :size="20" class="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h4 class="font-bold text-sm text-indigo-900 dark:text-indigo-200">Painel de Decisão de RH & Governança</h4>
              <p class="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                Revise solicitações pendentes, confira justificativas e certifique-se da conformidade cadastral.
                A aprovação de solicitações de <strong>Atualização Cadastral</strong> aplica as alterações diretamente no cadastro do colaborador.
              </p>
            </div>
          </div>

          <!-- Barra de Filtros do RH -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div class="relative flex-1 max-w-md">
              <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="hrSearch"
                type="text"
                placeholder="Buscar por colaborador, protocolo ou tipo..."
                class="w-full rounded-xl border bg-card pl-9 pr-4 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>

            <div class="flex items-center gap-1.5 overflow-x-auto">
              <button
                v-for="st in [
                  { label: 'Todos', val: 'todos' },
                  { label: 'Pendentes / Em Análise', val: 'em análise' },
                  { label: 'Correção Solicitada', val: 'correção solicitada' },
                  { label: 'Aprovados', val: 'aprovado' }
                ]"
                :key="st.val"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border"
                :class="hrStatusFilter === st.val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'"
                @click="hrStatusFilter = st.val"
              >
                {{ st.label }}
              </button>
            </div>
          </div>

          <!-- Fila de Solicitações do RH -->
          <div v-if="filteredHrRequests.length > 0" class="space-y-3">
            <div
              v-for="r in filteredHrRequests"
              :key="r.id"
              class="rounded-2xl border bg-card p-5 hover:border-indigo-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div class="flex items-start gap-3.5">
                <div class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0 mt-0.5">
                  <UserCheck :size="20" />
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-mono font-bold text-muted-foreground">{{ r.id }}</span>
                    <span class="text-sm font-bold">{{ r.requester }}</span>
                    <span class="text-xs text-muted-foreground">({{ r.department }})</span>
                    <span class="text-xs px-2 py-0.5 rounded-full border font-semibold" :class="getStatusBadge(r.status)">
                      {{ r.status }}
                    </span>
                  </div>
                  <p class="text-sm font-semibold text-primary mt-1">{{ r.type }}</p>
                  <p class="text-xs text-muted-foreground line-clamp-2 mt-0.5">{{ r.description }}</p>

                  <!-- Preview de alterações cadastrais quando aplicável -->
                  <div v-if="r.details?.changes" class="mt-2 text-xs bg-muted/60 p-2 rounded-lg border flex flex-wrap gap-2">
                    <span class="font-bold text-foreground">Alterações solicitadas:</span>
                    <span v-for="(val, key) in r.details.changes" :key="key" class="bg-card px-1.5 py-0.5 rounded border text-[11px]">
                      <strong>{{ key }}:</strong> {{ val }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Ações de Decisão -->
              <div class="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  class="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                  @click="openRequestDetail(r)"
                >
                  <Eye :size="14" class="inline mr-1" />
                  Ver Detalhes
                </button>

                <template v-if="['pendente', 'em análise', 'em_analise', 'correção solicitada'].includes(r.status.toLowerCase())">
                  <button
                    class="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/20 transition-colors cursor-pointer"
                    @click="openDecisionModal(r, 'correção solicitada')"
                  >
                    Pedir Correção
                  </button>

                  <button
                    class="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
                    @click="openDecisionModal(r, 'rejeitado')"
                  >
                    Rejeitar
                  </button>

                  <button
                    class="rounded-lg bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                    @click="openDecisionModal(r, 'aprovado')"
                  >
                    Aprovar
                  </button>
                </template>
              </div>
            </div>
          </div>

          <div v-else class="rounded-2xl border border-dashed p-10 text-center">
            <CheckCircle2 :size="36" class="mx-auto text-emerald-500 mb-2 opacity-60" />
            <h4 class="font-semibold text-base">Nenhuma solicitação pendente</h4>
            <p class="text-sm text-muted-foreground mt-1">Todas as solicitações de colaboradores foram analisadas.</p>
          </div>
        </section>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: SOLICITAR ATUALIZAÇÃO CADASTRAL                   -->
    <!-- ======================================================== -->
    <div
      v-if="showCadastralModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      @click.self="showCadastralModal = false"
    >
      <div class="w-full max-w-2xl rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <FileUp :size="20" class="text-primary" />
            <h3 class="text-lg font-bold">Solicitar Alteração Cadastral</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showCadastralModal = false">
            <X :size="20" />
          </button>
        </div>

        <p class="text-xs text-muted-foreground mt-2">
          Atualize seus dados de contato e residência. Por governança corporativa, as alterações serão avaliadas pelo RH antes de serem efetivadas na sua ficha funcional.
        </p>

        <form @submit.prevent="submitCadastralUpdate" class="mt-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold mb-1">Telefone / Celular</label>
              <input
                v-model="cadastralForm.phone"
                type="text"
                placeholder="(11) 98888-0000"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold mb-1">Contato de Emergência</label>
              <input
                v-model="cadastralForm.emergencyContact"
                type="text"
                placeholder="Nome e telefone de parente"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold mb-1">Endereço Residencial</label>
              <input
                v-model="cadastralForm.address"
                type="text"
                placeholder="Rua, número, complemento e bairro"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold mb-1">Cidade</label>
              <input
                v-model="cadastralForm.city"
                type="text"
                placeholder="São Paulo"
                class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold mb-1">Estado (UF)</label>
                <input
                  v-model="cadastralForm.state"
                  type="text"
                  placeholder="SP"
                  maxlength="2"
                  class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden uppercase"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold mb-1">CEP</label>
                <input
                  v-model="cadastralForm.cep"
                  type="text"
                  placeholder="00000-000"
                  class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Justificativa da Alteração *</label>
            <textarea
              v-model="cadastralForm.justification"
              rows="2"
              required
              placeholder="Ex.: Mudança de endereço recente para novo apartamento."
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            ></textarea>
          </div>

          <!-- Preview do Diff Antes de Enviar -->
          <div v-if="cadastralDiff.length > 0" class="rounded-xl border bg-muted/30 p-3.5">
            <h4 class="text-xs font-bold flex items-center gap-1.5 text-primary mb-2">
              <Eye :size="14" />
              Comparativo das Alterações Solicitadas:
            </h4>
            <div class="space-y-1.5 text-xs">
              <div v-for="d in cadastralDiff" :key="d.field" class="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-1">
                <span class="font-semibold text-muted-foreground">{{ d.label }}:</span>
                <div class="flex items-center gap-2">
                  <span class="line-through text-rose-500">{{ d.oldVal }}</span>
                  <ArrowRight :size="12" class="text-muted-foreground" />
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ d.newVal }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showCadastralModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1.5"
              :disabled="submittingCadastral || cadastralDiff.length === 0"
            >
              <RefreshCw v-if="submittingCadastral" :size="14" class="animate-spin" />
              Enviar Solicitação ao RH
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: NOVA SOLICITAÇÃO                                  -->
    <!-- ======================================================== -->
    <div
      v-if="showNewRequestModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      @click.self="showNewRequestModal = false"
    >
      <div class="w-full max-w-xl rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <Plus :size="20" class="text-primary" />
            <h3 class="text-lg font-bold">Abrir Nova Solicitação</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showNewRequestModal = false">
            <X :size="20" />
          </button>
        </div>

        <form @submit.prevent="submitNewRequest" class="mt-4 space-y-4">
          <div>
            <label class="block text-xs font-semibold mb-1">Categoria do Pedido *</label>
            <select
              v-model="newReqForm.type"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              <option value="Declaração de Vínculo">Declaração de Vínculo Empregatício</option>
              <option value="Comprovante de Rendimentos">Comprovante / Informe de Rendimentos</option>
              <option value="Férias">Agendamento de Férias / Abono</option>
              <option value="Reembolso de Despesas">Reembolso de Despesas Corporativas</option>
              <option value="Ajuste de Ponto">Ajuste de Ponto / Espelho de Ponto</option>
              <option value="Suporte e Outros">Outros / Atendimento Geral</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Prioridade</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                v-for="p in ['Baixa', 'Média', 'Alta']"
                :key="p"
                class="rounded-xl border py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                :class="newReqForm.priority === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'"
                @click="newReqForm.priority = p"
              >
                {{ p }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Descrição e Detalhes *</label>
            <textarea
              v-model="newReqForm.description"
              rows="3"
              required
              placeholder="Descreva com detalhes o que você precisa..."
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            ></textarea>
          </div>

          <!-- Anexo Opcional -->
          <div>
            <label class="block text-xs font-semibold mb-1">Anexo / Comprovante (opcional)</label>
            <div class="flex items-center gap-3">
              <label class="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors">
                <FileUp :size="15" />
                {{ newReqForm.attachmentName ? 'Trocar arquivo' : 'Selecionar arquivo (máx 5MB)' }}
                <input type="file" class="hidden" @change="handleRequestFileSelect" />
              </label>
              <span v-if="newReqForm.attachmentName" class="text-xs text-primary font-medium truncate max-w-xs">
                📎 {{ newReqForm.attachmentName }}
              </span>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showNewRequestModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1.5"
              :disabled="submittingNewReq"
            >
              <RefreshCw v-if="submittingNewReq" :size="14" class="animate-spin" />
              Abrir Solicitação
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: DETALHES DA SOLICITAÇÃO & LINHA DO TEMPO          -->
    <!-- ======================================================== -->
    <div
      v-if="showDetailModal && selectedRequest"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      @click.self="showDetailModal = false"
    >
      <div class="w-full max-w-2xl rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto scrollbar-thin flex flex-col my-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold text-muted-foreground">{{ selectedRequest.id }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full border font-semibold" :class="getStatusBadge(selectedRequest.status)">
                {{ selectedRequest.status }}
              </span>
            </div>
            <h3 class="text-lg font-bold mt-1">{{ selectedRequest.type }}</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showDetailModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="mt-4 space-y-4 flex-1">
          <div class="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-xl border">
            <div>
              <span class="text-muted-foreground">Solicitante:</span>
              <p class="font-bold mt-0.5">{{ selectedRequest.requester }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">Departamento:</span>
              <p class="font-bold mt-0.5">{{ selectedRequest.department }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">Data de Abertura:</span>
              <p class="font-bold mt-0.5">{{ selectedRequest.date }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">Prioridade:</span>
              <p class="font-bold mt-0.5">{{ selectedRequest.priority }}</p>
            </div>
          </div>

          <div>
            <h4 class="text-xs font-bold text-muted-foreground uppercase mb-1">Descrição do Pedido</h4>
            <p class="text-sm bg-card p-3 rounded-xl border">{{ selectedRequest.description }}</p>
          </div>

          <!-- Parecer / Justificativa do RH -->
          <div v-if="selectedRequest.review_notes" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <h4 class="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle :size="14" />
              Retorno do RH / Análise de Governança:
            </h4>
            <p class="text-sm text-foreground mt-1">{{ selectedRequest.review_notes }}</p>
            <p v-if="selectedRequest.reviewed_by" class="text-[11px] text-muted-foreground mt-1">
              Avaliado por {{ selectedRequest.reviewed_by }} em {{ selectedRequest.reviewed_at || 'recente' }}
            </p>
          </div>

          <!-- Linha do Tempo e Comentários -->
          <div class="pt-2">
            <h4 class="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <MessageSquare :size="14" />
              Linha do Tempo & Interações ({{ selectedRequestComments.length }})
            </h4>

            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div
                v-for="c in selectedRequestComments"
                :key="c.id"
                class="rounded-xl p-3 text-xs border"
                :class="c.author_role === 'COLABORADOR' ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-border'"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold">{{ c.author_name }} ({{ c.author_role }})</span>
                  <span class="text-muted-foreground text-[10px]">{{ c.created_at }}</span>
                </div>
                <p class="text-foreground leading-relaxed">{{ c.comment }}</p>
              </div>

              <div v-if="selectedRequestComments.length === 0" class="text-xs text-muted-foreground italic text-center py-3">
                Nenhum comentário registrado nesta solicitação.
              </div>
            </div>

            <!-- Adicionar Comentário -->
            <div class="mt-3 flex gap-2">
              <input
                v-model="newCommentText"
                type="text"
                placeholder="Escreva um comentário ou resposta de pendência..."
                class="flex-1 rounded-xl border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-hidden"
                @keyup.enter="submitComment"
              />
              <button
                class="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1"
                @click="submitComment"
                :disabled="sendingComment || !newCommentText.trim()"
              >
                <Send :size="12" />
                Enviar
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t mt-4">
          <!-- Botão Cancelar (se o usuário for o dono e estiver pendente) -->
          <div>
            <button
              v-if="['pendente', 'em análise', 'em_analise', 'correção solicitada'].includes(selectedRequest.status.toLowerCase())"
              class="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
              @click="cancelMyRequest(selectedRequest)"
            >
              Cancelar Solicitação
            </button>
          </div>

          <button
            class="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted cursor-pointer"
            @click="showDetailModal = false"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: DECISÃO DO RH (APROVAR / REJEITAR / CORREÇÃO)     -->
    <!-- ======================================================== -->
    <div
      v-if="showDecisionModal && selectedRequest"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      @click.self="showDecisionModal = false"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <Shield :size="20" class="text-indigo-600" />
            <h3 class="text-lg font-bold">
              {{ decisionType === 'aprovado' ? 'Aprovar Solicitação' : decisionType === 'rejeitado' ? 'Rejeitar Solicitação' : 'Solicitar Correções' }}
            </h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showDecisionModal = false">
            <X :size="20" />
          </button>
        </div>

        <!-- Alerta de Conflito de Interesses / Anti-Autoaprovação -->
        <div v-if="isSelfRequester && decisionType === 'aprovado'" class="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-2.5">
          <ShieldAlert :size="20" class="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 class="text-xs font-bold text-rose-800 dark:text-rose-300">Violação de Governança Corporativa</h4>
            <p class="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
              Você é o solicitante deste pedido. A política de governança do PeopleHub impede que um usuário aprove o próprio chamado. Outro analista ou gestor deve tomar esta decisão.
            </p>
          </div>
        </div>

        <form @submit.prevent="submitHrDecision" class="mt-4 space-y-4">
          <div class="text-xs bg-muted/40 p-3 rounded-xl border">
            <p><strong>Solicitante:</strong> {{ selectedRequest.requester }}</p>
            <p class="mt-0.5"><strong>Tipo:</strong> {{ selectedRequest.type }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">
              {{ decisionType === 'aprovado' ? 'Observações de Aprovação (opcional)' : 'Justificativa Obrigatória *' }}
            </label>
            <textarea
              v-model="decisionJustification"
              rows="3"
              :required="decisionType !== 'aprovado'"
              :placeholder="decisionType === 'aprovado' ? 'Parecer favorável...' : 'Explique detalhadamente o motivo da rejeição ou quais documentos precisam ser corrigidos...'"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showDecisionModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              :class="decisionType === 'aprovado'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
                : decisionType === 'rejeitado'
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-amber-600 text-white hover:bg-amber-700'"
              :disabled="submittingDecision || (isSelfRequester && decisionType === 'aprovado')"
            >
              <RefreshCw v-if="submittingDecision" :size="14" class="animate-spin" />
              Confirmar Decisão
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: UPLOAD DE DOCUMENTO PESSOAL                       -->
    <!-- ======================================================== -->
    <div
      v-if="showUploadDocModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      @click.self="showUploadDocModal = false"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <UploadCloud :size="20" class="text-primary" />
            <h3 class="text-lg font-bold">Enviar Documento Pessoal</h3>
          </div>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer" @click="showUploadDocModal = false">
            <X :size="20" />
          </button>
        </div>

        <form @submit.prevent="submitDocUpload" class="mt-4 space-y-4">
          <div>
            <label class="block text-xs font-semibold mb-1">Nome do Documento *</label>
            <input
              v-model="uploadForm.name"
              type="text"
              required
              placeholder="Ex.: Comprovante de Residência - Outubro 2026"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Categoria *</label>
            <select
              v-model="uploadForm.category"
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              <option value="Comprovantes">Comprovante de Residência</option>
              <option value="Atestados">Atestado Médico / Declaração</option>
              <option value="Certificados">Certificado / Diploma</option>
              <option value="Documentos Pessoais">Documento de Identidade (RG/CNH)</option>
              <option value="Outros">Outros Documentos</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Arquivo * (PDF, JPG, PNG, DOCX - máx 5MB)</label>
            <input
              type="file"
              required
              accept=".pdf,image/jpeg,image/png,image/webp,.docx"
              class="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              @change="handleDocFileSelect"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1">Observações (opcional)</label>
            <input
              v-model="uploadForm.notes"
              type="text"
              placeholder="Ex.: Conta de energia recente para comprovação de endereço."
              class="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              @click="showUploadDocModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1.5"
              :disabled="submittingUpload || !uploadForm.file_base64"
            >
              <RefreshCw v-if="submittingUpload" :size="14" class="animate-spin" />
              Enviar Documento
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
