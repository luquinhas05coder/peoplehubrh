<script setup lang="ts">
import { computed, ref } from "vue"
import {
  Folder,
  FolderPlus,
  Search,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  UserCheck,
  CreditCard,
  Hash,
  Download,
  Trash2,
  FileUp,
  X,
  LayoutGrid,
  List,
  Edit3,
  Award,
  Receipt,
  DollarSign,
  CalendarClock,
  FileCheck2,
} from "lucide-vue-next"
import type { DocCategory, EmployeeFolder } from "../data"
import { docCategoryLabels, contractTypeConfigs, workScheduleConfigs } from "../data"
import { employeeFolders, activeFolderId, addDocumentToFolder, deleteDocumentFromFolder, deleteEmployeeFolder, userRoleType, userPermissions } from "../store"
import UserAvatar from "./UserAvatar.vue"
import NewEmployeeFolderModal from "./NewEmployeeFolderModal.vue"
import HoleriteCard from "./HoleriteCard.vue"
import FolhaDePontoCard from "./FolhaDePontoCard.vue"
import EscalaContratoCard from "./EscalaContratoCard.vue"

const search = ref("")
const selectedDepartment = ref("todos")
const selectedStatus = ref("todos")
const selectedContractType = ref("todos")
const selectedWorkSchedule = ref("todos")
const viewMode = ref<"grid" | "table">("grid")

const showNewFolderModal = ref(false)
const activeFolderViewTab = ref<"ficha" | "escala_contrato" | "holerite" | "ponto">("ficha")

/* Títulos adaptados por Cargo */
const moduleTitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Meu Caderno de Colaborador & Equipe"
  if (userRoleType.value === "dp") return "Gestão Cadastral & Folha de Colaboradores"
  if (userRoleType.value === "ti") return "Gestão de Credenciais e Equipamentos — TI"
  return "Gestão Integrada de Colaboradores & DHO"
})

const moduleSubtitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Consulte seus dados cadastrais, holerite, banco de horas e o diretório de colegas de equipe."
  if (userRoleType.value === "dp") return "Controle fichas cadastrais, códigos CBO, folhas de pagamento, atestados e registros de ponto."
  if (userRoleType.value === "ti") return "Controle credenciais de acesso aos sistemas, e-mails corporativos e ativos de hardware."
  return "Repositório digital de pastas cadastrais, documentação de admissão e históricos funcionais."
})

/* Adicionar Documento Form State */
const showAddDocModal = ref(false)
const newDocName = ref("")
const newDocCategory = ref<DocCategory>("pessoais")
const newDocFileType = ref("PDF")
const activeDocTab = ref<DocCategory>("pessoais")
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const newDocSize = ref("")

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

function detectFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  if (["pdf"].includes(ext)) return "PDF"
  if (["doc", "docx"].includes(ext)) return "DOCX"
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLSX"
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) return "PNG"
  if (["txt", "rtf", "md"].includes(ext)) return "TXT"
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "ZIP"
  return ext.toUpperCase() || "DOC"
}

function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    selectedFile.value = file
    newDocName.value = file.name
    newDocSize.value = formatBytes(file.size)
    newDocFileType.value = detectFileType(file.name)
  }
}

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function clearSelectedFile() {
  selectedFile.value = null
  newDocSize.value = ""
  if (fileInputRef.value) fileInputRef.value.value = ""
}

const toastText = ref<string | null>(null)

function showToast(msg: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = null
  }, 2500)
}

const departments = ["todos", "Tecnologia", "Marketing", "Vendas", "Financeiro", "Administrativo", "Recursos Humanos"]

const filteredFolders = computed(() => {
  return employeeFolders.value.filter((f) => {
    const matchesDept = selectedDepartment.value === "todos" || f.department === selectedDepartment.value
    const matchesStatus = selectedStatus.value === "todos" || f.status === selectedStatus.value
    const matchesContract =
      selectedContractType.value === "todos" ||
      (f.contractType || "prazo_indeterminado") === selectedContractType.value
    const matchesSchedule =
      selectedWorkSchedule.value === "todos" ||
      (f.workSchedule || "escala_5x2") === selectedWorkSchedule.value
    const q = search.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.cpf.includes(q) ||
      f.registration.toLowerCase().includes(q) ||
      f.role.toLowerCase().includes(q) ||
      f.department.toLowerCase().includes(q)
    return matchesDept && matchesStatus && matchesContract && matchesSchedule && matchesSearch
  })
})

const activeFolder = computed(() => {
  if (!activeFolderId.value) return null
  return employeeFolders.value.find((f) => f.id === activeFolderId.value) ?? null
})

function openFolder(folderId: string) {
  showNewFolderModal.value = false
  activeFolderId.value = folderId
}

function closeFolder() {
  activeFolderId.value = null
}

function openNewFolderForm() {
  activeFolderId.value = null
  isEditingFolder.value = false
  folderToEdit.value = null
  showNewFolderModal.value = true
}

const folderToEdit = ref<EmployeeFolder | null>(null)
const isEditingFolder = ref(false)

function openEditFolder(folder: EmployeeFolder) {
  folderToEdit.value = folder
  isEditingFolder.value = true
}

function handleFolderUpdated(id: string) {
  isEditingFolder.value = false
  folderToEdit.value = null
  openFolder(id)
}

function handleCloseEdit() {
  isEditingFolder.value = false
  folderToEdit.value = null
}

function handleFolderCreated(id: string) {
  showNewFolderModal.value = false
  openFolder(id)
}

function handleAddDocument() {
  if (!activeFolderId.value || !newDocName.value.trim()) return
  const finalSize = newDocSize.value || `${(Math.random() * 2 + 0.5).toFixed(1)} MB`
  addDocumentToFolder(activeFolderId.value, {
    name: newDocName.value.trim(),
    category: newDocCategory.value,
    fileType: newDocFileType.value,
    size: finalSize,
    uploadedBy: "Analista de RH",
  })
  showToast(`Documento "${newDocName.value}" adicionado à pasta!`)
  newDocName.value = ""
  newDocSize.value = ""
  selectedFile.value = null
  showAddDocModal.value = false
}

function handleDeleteDocument(docId: string, docName: string) {
  if (!activeFolderId.value) return
  if (confirm(`Tem certeza que deseja remover o documento "${docName}" da pasta deste colaborador?`)) {
    deleteDocumentFromFolder(activeFolderId.value, docId)
  }
}

function handleDeleteFolder(id: string, name: string) {
  if (confirm(`Tem certeza que deseja excluir a pasta do colaborador ${name}?`)) {
    deleteEmployeeFolder(id)
    showToast(`Pasta de ${name} removida.`)
  }
}

const docsInCategory = computed(() => {
  if (!activeFolder.value) return []
  return activeFolder.value.documents.filter((d) => d.category === activeDocTab.value)
})

const statusBadgeStyles: Record<EmployeeFolder["status"], { bg: string; color: string; label: string }> = {
  ativo: { bg: "var(--color-success-soft)", color: "var(--color-success)", label: "Ativo" },
  ferias: { bg: "var(--color-accent-soft)", color: "var(--color-accent)", label: "Em Férias" },
  afastado: { bg: "var(--color-danger-soft)", color: "var(--color-danger)", label: "Afastado" },
  desligado: { bg: "var(--color-muted)", color: "var(--color-muted-foreground)", label: "Desligado" },
}
</script>

<template>
  <div class="flex h-full flex-col bg-background relative overflow-hidden">
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


    <!-- Modal Adicionar Documento -->
    <div v-if="showAddDocModal && activeFolder" class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div class="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-base flex items-center gap-2">
            <FileUp :size="18" style="color: var(--color-primary)" /> Adicionar Documento à Pasta
          </h3>
          <button class="rounded-lg p-1 text-muted-foreground hover:bg-muted" @click="showAddDocModal = false">
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="handleAddDocument" class="mt-4 space-y-3">
          <!-- Campo de Seleção de Arquivo do Computador -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Anexar Arquivo do Computador *
            </label>
            <input
              ref="fileInputRef"
              type="file"
              accept="*"
              class="hidden"
              @change="handleFileSelected"
            />
            <div
              class="border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all hover:bg-teal-500/5 hover:border-teal-500/50"
              :class="selectedFile ? 'border-teal-500 bg-teal-500/5' : 'border-muted-foreground/30 bg-muted/20'"
              @click="triggerFilePicker"
            >
              <div v-if="selectedFile" class="flex items-center justify-between">
                <div class="flex items-center gap-2.5 text-left min-w-0">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 font-bold text-xs">
                    {{ newDocFileType }}
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-foreground truncate">{{ selectedFile.name }}</p>
                    <p class="text-[11px] text-muted-foreground">{{ newDocSize }} · Selecionado</p>
                  </div>
                </div>
                <button
                  type="button"
                  class="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                  @click.stop="clearSelectedFile"
                  title="Remover arquivo selecionado"
                >
                  <X :size="16" />
                </button>
              </div>
              <div v-else class="space-y-1 py-1">
                <div class="flex justify-center text-teal-600">
                  <FileUp :size="22" />
                </div>
                <p class="text-xs font-semibold text-foreground">Clique para selecionar um arquivo</p>
                <p class="text-[10px] text-muted-foreground">Suporta todos os formatos (PDF, DOCX, XLSX, PNG, JPG, CSV, ZIP, TXT...)</p>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Nome do Arquivo / Documento *</label>
            <input
              v-model="newDocName"
              type="text"
              required
              placeholder="ex: CNH_Atualizada_2026.pdf"
              class="w-full rounded-lg border bg-background py-2 px-3 text-sm outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Categoria de Destino</label>
            <select
              v-model="newDocCategory"
              class="w-full rounded-lg border bg-background py-2 px-3 text-sm outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option v-for="(lbl, key) in docCategoryLabels" :key="key" :value="key">{{ lbl }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Formato de Arquivo</label>
            <select
              v-model="newDocFileType"
              class="w-full rounded-lg border bg-background py-2 px-3 text-sm outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option value="PDF">PDF (.pdf)</option>
              <option value="DOCX">Word (.docx, .doc)</option>
              <option value="XLSX">Excel / Planilha (.xlsx, .xls)</option>
              <option value="PNG">Imagem / Foto (.png, .jpg, .jpeg, .webp)</option>
              <option value="TXT">Texto / CSV (.txt, .csv)</option>
              <option value="ZIP">Arquivo Comprimido (.zip, .rar, .7z)</option>
              <option value="OUTROS">Outros Formatos (Todos)</option>
            </select>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t">
            <button type="button" class="rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer" @click="showAddDocModal = false">Cancelar</button>
            <button
              type="submit"
              class="rounded-lg px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow cursor-pointer"
              style="background-color: var(--color-primary)"
              :disabled="!newDocName.trim()"
            >
              Anexar Documento
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Cabeçalho Principal do Módulo (visível apenas na lista geral e na visualização da pasta) -->
    <header v-if="!showNewFolderModal && !isEditingFolder" class="border-b bg-card px-5 py-4 sm:px-8">
      <!-- 1. CABEÇALHO QUANDO VISUALIZANDO UM COLABORADOR ESPECÍFICO -->
      <div v-if="activeFolder" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          class="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow hover:bg-teal-700 hover:shadow-md transition-all active:scale-95 cursor-pointer self-start"
          @click="closeFolder"
          title="Voltar para a lista de colaboradores"
        >
          <ArrowLeft :size="17" /> Voltar para Colaboradores
        </button>

        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">Pasta ativa:</span>
          <span class="text-sm font-bold text-foreground">{{ activeFolder.name }}</span>
          <span
            class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :style="{ backgroundColor: statusBadgeStyles[activeFolder.status].bg, color: statusBadgeStyles[activeFolder.status].color }"
          >
            {{ statusBadgeStyles[activeFolder.status].label }}
          </span>
        </div>
      </div>

      <!-- 2. CABEÇALHO PADRÃO DA LISTA DE COLABORADORES -->
      <div v-else>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-bold tracking-tight sm:text-2xl">{{ moduleTitle }}</h1>
              <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" style="background-color: var(--color-primary-soft); color: var(--color-primary)">
                {{ employeeFolders.length }} Cadastros Ativos
              </span>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {{ moduleSubtitle }}
            </p>
          </div>

          <button
            v-if="!userPermissions.isColaborador"
            class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 font-semibold text-sm text-primary-foreground shadow transition-transform hover:-translate-y-0.5 active:scale-95 shrink-0 cursor-pointer"
            style="background-color: var(--color-primary)"
            @click="openNewFolderForm"
          >
            <FolderPlus :size="18" /> Nova Pasta de Colaborador
          </button>
        </div>

        <!-- Barra de Filtros & Busca (só aparece na listagem geral) -->
        <div class="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <Search :size="17" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="search"
              type="text"
              placeholder="Buscar por nome, CPF, matrícula, departamento ou cargo..."
              class="w-full rounded-xl border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <div class="flex items-center gap-2 overflow-x-auto">
            <select
              v-model="selectedDepartment"
              class="rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none shrink-0 cursor-pointer"
            >
              <option value="todos">Todos Departamentos</option>
              <option v-for="d in departments.filter(x => x !== 'todos')" :key="d" :value="d">{{ d }}</option>
            </select>

            <select
              v-model="selectedStatus"
              class="rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none shrink-0 cursor-pointer"
            >
              <option value="todos">Todos Status</option>
              <option value="ativo">Ativos</option>
              <option value="ferias">Em Férias</option>
              <option value="afastado">Afastados</option>
            </select>

            <select
              v-model="selectedContractType"
              class="rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none shrink-0 cursor-pointer"
            >
              <option value="todos">Todos Contratos</option>
              <option v-for="(cMeta, cKey) in contractTypeConfigs" :key="cKey" :value="cKey">
                {{ cMeta.label }}
              </option>
            </select>

            <select
              v-model="selectedWorkSchedule"
              class="rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none shrink-0 cursor-pointer"
            >
              <option value="todos">Todas Escalas</option>
              <option v-for="(sMeta, sKey) in workScheduleConfigs" :key="sKey" :value="sKey">
                {{ sMeta.label }}
              </option>
            </select>

            <div class="flex items-center rounded-xl border bg-background p-1 shrink-0">
              <button
                class="rounded-lg p-1.5 transition-colors cursor-pointer"
                :class="viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
                @click="viewMode = 'grid'"
                title="Visualização em Grade"
              >
                <LayoutGrid :size="16" />
              </button>
              <button
                class="rounded-lg p-1.5 transition-colors cursor-pointer"
                :class="viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
                @click="viewMode = 'table'"
                title="Visualização em Lista"
              >
                <List :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Conteúdo Principal: Cadastro In-Page, Edição In-Page, Inspector ou Lista de Pastas -->
    <div class="flex-1 overflow-y-auto p-5 sm:p-8 scrollbar-thin">
      <!-- MODO 1: EDIÇÃO DE PASTA EXISTENTE (IN-PAGE) -->
      <NewEmployeeFolderModal
        v-if="isEditingFolder && folderToEdit"
        :folder-to-edit="folderToEdit"
        @close="handleCloseEdit"
        @updated="handleFolderUpdated"
      />

      <!-- MODO 2: CRIAÇÃO DE NOVA PASTA (IN-PAGE) -->
      <NewEmployeeFolderModal
        v-else-if="showNewFolderModal"
        @close="showNewFolderModal = false"
        @created="handleFolderCreated"
      />

      <!-- MODO 3: VISUALIZADOR DA PASTA SELECIONADA (INSPECTOR) -->
      <section v-else-if="activeFolder" class="space-y-6">
        <!-- Banner do Colaborador (com as ÚNICAS ações da pasta) -->
        <div class="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <UserAvatar :initials="activeFolder.initials" :size="64" />
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-bold">{{ activeFolder.name }}</h2>
                <span
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  :style="{ backgroundColor: statusBadgeStyles[activeFolder.status].bg, color: statusBadgeStyles[activeFolder.status].color }"
                >
                  {{ statusBadgeStyles[activeFolder.status].label }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground">{{ activeFolder.role }} · <span class="font-medium text-foreground">{{ activeFolder.department }}</span></p>
              <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span class="flex items-center gap-1"><Hash :size="13" /> {{ activeFolder.registration }}</span>
                <span class="flex items-center gap-1"><CreditCard :size="13" /> CPF: {{ activeFolder.cpf }}</span>
                <span v-if="activeFolder.cbo" class="flex items-center gap-1 text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded">
                  <Award :size="13" class="text-teal-700" /> CBO: {{ activeFolder.cbo }}
                </span>
                <span
                  class="flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-xs"
                  :class="[contractTypeConfigs[activeFolder.contractType || 'prazo_indeterminado'].badgeBg, contractTypeConfigs[activeFolder.contractType || 'prazo_indeterminado'].badgeColor]"
                >
                  <FileCheck2 :size="13" /> {{ contractTypeConfigs[activeFolder.contractType || 'prazo_indeterminado'].label }}
                </span>
                <span
                  class="flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-xs"
                  :class="[workScheduleConfigs[activeFolder.workSchedule || 'escala_5x2'].badgeBg, workScheduleConfigs[activeFolder.workSchedule || 'escala_5x2'].badgeColor]"
                >
                  <Clock :size="13" /> {{ workScheduleConfigs[activeFolder.workSchedule || 'escala_5x2'].label }}
                </span>
                <span class="flex items-center gap-1"><Clock :size="13" /> Admissão: {{ activeFolder.admissionDate }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 border-t pt-3 sm:border-t-0 sm:pt-0">
            <button
              class="flex items-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-500/10 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-500/20 transition-all shadow-sm cursor-pointer"
              @click="openEditFolder(activeFolder)"
            >
              <Edit3 :size="15" /> Editar Colaborador
            </button>
            <button
              class="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              @click="showAddDocModal = true"
            >
              <FileUp :size="15" style="color: var(--color-primary)" /> Adicionar Arquivo
            </button>
            <button
              class="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              @click="handleDeleteFolder(activeFolder.id, activeFolder.name)"
            >
              <Trash2 :size="15" /> Excluir Pasta
            </button>
          </div>
        </div>

        <!-- Sub-navegação da Pasta do Colaborador (Ficha vs Escala vs Contra-Cheque vs Ponto) -->
        <div class="flex items-center gap-2 border-b pb-1 overflow-x-auto scrollbar-thin">
          <button
            class="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
            :class="activeFolderViewTab === 'ficha' ? 'bg-teal-500/15 text-teal-800 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeFolderViewTab = 'ficha'"
          >
            <Folder :size="15" />
            <span>Ficha & Documentos Digitais</span>
          </button>
          <button
            class="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
            :class="activeFolderViewTab === 'escala_contrato' ? 'bg-teal-500/15 text-teal-800 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeFolderViewTab = 'escala_contrato'"
          >
            <CalendarClock :size="15" class="text-teal-600" />
            <span>Escala & Tipo de Contrato</span>
            <span class="rounded-full bg-teal-500/20 text-teal-800 text-[10px] font-bold px-2 py-0.2">Jornada & Vínculo</span>
          </button>
          <button
            class="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
            :class="activeFolderViewTab === 'holerite' ? 'bg-teal-500/15 text-teal-800 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeFolderViewTab = 'holerite'"
          >
            <Receipt :size="15" class="text-teal-600" />
            <span>Contra-Cheque (Holerite)</span>
            <span class="rounded-full bg-emerald-500/20 text-emerald-800 text-[10px] font-bold px-2 py-0.2">Oficial CLT</span>
          </button>
          <button
            class="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
            :class="activeFolderViewTab === 'ponto' ? 'bg-teal-500/15 text-teal-800 border border-teal-500/30' : 'text-muted-foreground hover:bg-muted'"
            @click="activeFolderViewTab = 'ponto'"
          >
            <Clock :size="15" class="text-teal-600" />
            <span>Folha de Ponto (Espelho)</span>
            <span class="rounded-full bg-sky-500/20 text-sky-800 text-[10px] font-bold px-2 py-0.2">Ponto CLT</span>
          </button>
        </div>

        <!-- CONTEÚDO DA ABA: ESCALAS & TIPOS DE CONTRATOS -->
        <div v-if="activeFolderViewTab === 'escala_contrato'">
          <EscalaContratoCard :folder="activeFolder" @toast="showToast" />
        </div>

        <!-- CONTEÚDO DA ABA 2: DEMONSTRATIVO DO CONTRA-CHEQUE -->
        <div v-else-if="activeFolderViewTab === 'holerite'">
          <HoleriteCard :folder="activeFolder" @toast="showToast" />
        </div>

        <!-- CONTEÚDO DA ABA 3: ESPELHO DA FOLHA DE PONTO ELETRÔNICA -->
        <div v-else-if="activeFolderViewTab === 'ponto'">
          <FolhaDePontoCard :folder="activeFolder" @toast="showToast" />
        </div>

        <!-- CONTEÚDO DA ABA 1: GRID COM DADOS CADASTRAIS + ABAS DE DOCUMENTOS -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Coluna Esquerda: Dados de Vínculo e Contato -->
          <div class="space-y-4">
            <div class="rounded-2xl border bg-card p-5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Ficha de Dados do Colaborador</h3>
              <ul class="space-y-3 text-xs">
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><Mail :size="14" /> E-mail</span>
                  <span class="font-medium text-foreground truncate max-w-[160px]">{{ activeFolder.email }}</span>
                </li>
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><Phone :size="14" /> Telefone</span>
                  <span class="font-medium text-foreground">{{ activeFolder.phone }}</span>
                </li>
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><FileCheck2 :size="14" class="text-teal-600" /> Regime Contratual</span>
                  <span class="font-bold text-teal-800">{{ contractTypeConfigs[activeFolder.contractType || 'prazo_indeterminado']?.label }}</span>
                </li>
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><Clock :size="14" class="text-teal-600" /> Escala de Trabalho</span>
                  <span class="font-bold text-teal-800">{{ workScheduleConfigs[activeFolder.workSchedule || 'escala_5x2']?.label }}</span>
                </li>
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><DollarSign :size="14" class="text-teal-600" /> Salário Bruto</span>
                  <span class="font-bold text-emerald-700 font-mono">{{ activeFolder.salary || 'R$ 6.500,00' }}</span>
                </li>
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><MapPin :size="14" /> Endereço / Localidade</span>
                  <span class="font-medium text-foreground text-right truncate max-w-[200px]" :title="activeFolder.location">{{ activeFolder.location }}</span>
                </li>
                <li v-if="activeFolder.cep" class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><Hash :size="14" /> CEP</span>
                  <span class="font-medium font-mono text-foreground">{{ activeFolder.cep }}</span>
                </li>
                <li v-if="activeFolder.cbo" class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><Award :size="14" /> CBO (Ocupação)</span>
                  <span class="font-medium text-foreground text-right truncate max-w-[210px]" :title="activeFolder.cboTitle ? `${activeFolder.cbo} - ${activeFolder.cboTitle}` : activeFolder.cbo">
                    <span class="font-mono text-teal-700 font-bold mr-1">{{ activeFolder.cbo }}</span>
                    <span class="text-xs text-muted-foreground">{{ activeFolder.cboTitle || '' }}</span>
                  </span>
                </li>
                <li class="flex items-center justify-between border-b pb-2">
                  <span class="text-muted-foreground flex items-center gap-1.5"><Briefcase :size="14" /> Tempo de Casa</span>
                  <span class="font-medium text-foreground">{{ activeFolder.tenure }}</span>
                </li>
                <li class="flex items-center justify-between">
                  <span class="text-muted-foreground flex items-center gap-1.5"><UserCheck :size="14" /> Gestor Responsável</span>
                  <span class="font-medium text-foreground">{{ activeFolder.manager }}</span>
                </li>
              </ul>
            </div>

            <!-- Anotações do Prontuário -->
            <div class="rounded-2xl border bg-card p-5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Anotações do Prontuário</h3>
              <p class="text-xs text-muted-foreground leading-relaxed italic">
                "{{ activeFolder.notes || 'Sem observações registradas.' }}"
              </p>
            </div>
          </div>

          <!-- Coluna Direita: Repositório de Documentos por Categorias -->
          <div class="lg:col-span-2 rounded-2xl border bg-card p-5">
            <div class="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 class="font-bold text-sm">Pastas Digitais de Documentos</h3>
                <p class="text-xs text-muted-foreground">Documentos arquivados na pasta deste colaborador</p>
              </div>
              <span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {{ activeFolder.documents.length }} arquivos no total
              </span>
            </div>

            <!-- Abas de Categoria de Documentos -->
            <div class="flex gap-1 overflow-x-auto border-b pb-2 mb-4 scrollbar-thin">
              <button
                v-for="(lbl, cat) in docCategoryLabels"
                :key="cat"
                class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                :class="activeDocTab === cat ? 'bg-teal-500/10 text-teal-700 font-bold border border-teal-500/20' : 'text-muted-foreground hover:bg-muted'"
                @click="activeDocTab = cat as DocCategory"
              >
                {{ lbl }}
                <span class="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px]">
                  {{ activeFolder.documents.filter(d => d.category === cat).length }}
                </span>
              </button>
            </div>

            <!-- Lista de Arquivos da Categoria Selecionada -->
            <div class="space-y-2">
              <div v-if="!docsInCategory.length" class="py-10 text-center text-xs text-muted-foreground">
                Nenhum documento arquivado na categoria "{{ docCategoryLabels[activeDocTab] }}".
              </div>

              <div
                v-for="doc in docsInCategory"
                :key="doc.id"
                class="flex items-center justify-between rounded-xl border bg-background p-3 text-xs transition-colors hover:border-teal-500/30"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 font-bold text-[10px]">
                    {{ doc.fileType }}
                  </span>
                  <div class="min-w-0">
                    <p class="font-semibold text-foreground truncate">{{ doc.name }}</p>
                    <p class="text-[11px] text-muted-foreground">
                      Tamanho: {{ doc.size }} · Enviado em {{ doc.uploadedAt }} por {{ doc.uploadedBy }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    @click="showToast(`Download de ${doc.name} iniciado.`)"
                    title="Baixar documento"
                  >
                    <Download :size="13" /> Baixar
                  </button>
                  <button
                    class="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors cursor-pointer"
                    @click="handleDeleteDocument(doc.id, doc.name)"
                    title="Remover documento da pasta"
                  >
                    <Trash2 :size="13" /> Remover
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- MODO GRADE / TABELA DE PASTAS DE COLABORADORES -->
      <section v-else>
        <div v-if="!filteredFolders.length" class="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-3">
          <Folder :size="40" class="text-muted-foreground/30" />
          <div>
            <p class="font-bold text-foreground text-base">Nenhuma pasta de colaborador encontrada</p>
            <p class="text-xs text-muted-foreground mt-0.5">Cadastre o primeiro colaborador clicando no botão abaixo.</p>
          </div>
          <button
            v-if="userPermissions.canManagePeople"
            class="mt-1 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-all hover:opacity-95 cursor-pointer"
            style="background-color: var(--color-primary)"
            @click="showNewFolderModal = true"
          >
            <FolderPlus :size="15" /> Criar Nova Pasta
          </button>
        </div>

        <!-- MODO GRADE (CARDS DE PASTAS DIGITAIS) -->
        <div v-else-if="viewMode === 'grid'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="folder in filteredFolders"
            :key="folder.id"
            class="group relative flex flex-col justify-between rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            @click="openFolder(folder.id)"
          >
            <!-- Cabeçalho do Card -->
            <div>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3">
                  <UserAvatar :initials="folder.initials" :size="44" />
                  <div class="min-w-0">
                    <h3 class="font-bold text-sm text-foreground truncate group-hover:text-teal-700 transition-colors">
                      {{ folder.name }}
                    </h3>
                    <p class="text-xs text-muted-foreground truncate">{{ folder.role }}</p>
                  </div>
                </div>
              </div>

              <!-- Tags / Meta -->
              <div class="mt-4 space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Departamento:</span>
                  <span class="font-semibold text-foreground">{{ folder.department }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Matrícula:</span>
                  <span class="font-mono text-muted-foreground">{{ folder.registration }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Contrato:</span>
                  <span
                    class="rounded px-1.5 py-0.2 text-[10px] font-bold truncate max-w-[130px]"
                    :class="[contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].badgeBg, contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].badgeColor]"
                  >
                    {{ contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].short }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Escala:</span>
                  <span
                    class="rounded px-1.5 py-0.2 text-[10px] font-bold"
                    :class="[workScheduleConfigs[folder.workSchedule || 'escala_5x2'].badgeBg, workScheduleConfigs[folder.workSchedule || 'escala_5x2'].badgeColor]"
                  >
                    {{ workScheduleConfigs[folder.workSchedule || 'escala_5x2'].label }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Documentos:</span>
                  <span class="flex items-center gap-1 font-bold text-teal-700">
                    <Folder :size="13" /> {{ folder.documents.length }} arquivos
                  </span>
                </div>
              </div>
            </div>

            <!-- Rodapé do Card -->
            <div class="mt-4 flex items-center justify-between border-t pt-3">
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                :style="{ backgroundColor: statusBadgeStyles[folder.status].bg, color: statusBadgeStyles[folder.status].color }"
              >
                {{ statusBadgeStyles[folder.status].label }}
              </span>

              <span class="text-xs font-semibold text-teal-700 group-hover:underline">
                Abrir Pasta →
              </span>
            </div>
          </div>
        </div>

        <!-- MODO TABELA DETALHADA -->
        <div v-else class="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table class="w-full text-left text-xs">
            <thead class="border-b bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th class="p-3.5">Colaborador</th>
                <th class="p-3.5">Matrícula / CPF</th>
                <th class="p-3.5">Departamento & Cargo</th>
                <th class="p-3.5">Contrato & Escala</th>
                <th class="p-3.5">Documentos</th>
                <th class="p-3.5">Status</th>
                <th class="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="folder in filteredFolders"
                :key="folder.id"
                class="hover:bg-muted/40 transition-colors cursor-pointer"
                @click="openFolder(folder.id)"
              >
                <td class="p-3.5">
                  <div class="flex items-center gap-2.5">
                    <UserAvatar :initials="folder.initials" :size="36" />
                    <div>
                      <p class="font-bold text-foreground">{{ folder.name }}</p>
                      <p class="text-[11px] text-muted-foreground">{{ folder.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="p-3.5">
                  <p class="font-mono font-medium">{{ folder.registration }}</p>
                  <p class="text-[11px] text-muted-foreground">CPF: {{ folder.cpf }}</p>
                </td>
                <td class="p-3.5">
                  <p class="font-medium text-foreground">{{ folder.department }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ folder.role }}</p>
                </td>
                <td class="p-3.5">
                  <div class="space-y-1">
                    <span
                      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                      :class="[contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].badgeBg, contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].badgeColor]"
                    >
                      <FileCheck2 :size="11" /> {{ contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].short }}
                    </span>
                    <br />
                    <span
                      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                      :class="[workScheduleConfigs[folder.workSchedule || 'escala_5x2'].badgeBg, workScheduleConfigs[folder.workSchedule || 'escala_5x2'].badgeColor]"
                    >
                      <Clock :size="11" /> {{ workScheduleConfigs[folder.workSchedule || 'escala_5x2'].label }}
                    </span>
                  </div>
                </td>
                <td class="p-3.5">
                  <span class="inline-flex items-center gap-1 font-bold text-teal-700 bg-teal-500/10 px-2 py-0.5 rounded-full text-[11px]">
                    <Folder :size="12" /> {{ folder.documents.length }} docs
                  </span>
                </td>
                <td class="p-3.5">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    :style="{ backgroundColor: statusBadgeStyles[folder.status].bg, color: statusBadgeStyles[folder.status].color }"
                  >
                    {{ statusBadgeStyles[folder.status].label }}
                  </span>
                </td>
                <td class="p-3.5 text-right">
                  <button
                    class="rounded-lg border px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                    @click.stop="openFolder(folder.id)"
                  >
                    Ver Pasta
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
