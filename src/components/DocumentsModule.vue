<script setup lang="ts">
import { ref, computed } from "vue"
import {
  FileText,
  FileCheck,
  Sparkles,
  Search,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  Shield,
  CalendarCheck,
  Briefcase,
  LayoutGrid,
  List,
  X,
  Upload,
  FileUp,
  User,
  Plus,
  Edit3,
} from "lucide-vue-next"
import type { DocumentCategory, SystemDocument, DocumentTemplate } from "../data"
import { documentCategoryLabels } from "../data"
import {
  systemDocuments,
  documentTemplates,
  deleteSystemDocument,
  importPdfDocument,
  employeeFolders,
  createDocumentTemplate,
  updateDocumentTemplate,
  deleteDocumentTemplate,
  userRoleType,
  userPermissions,
  currentUser,
} from "../store"
import UserAvatar from "./UserAvatar.vue"
import GenerateDocumentModal from "./GenerateDocumentModal.vue"
import NewRequestModal from "./NewRequestModal.vue"

const activeMainTab = ref<"acervo" | "importar" | "modelos">("acervo")
const search = ref("")
const selectedCategory = ref<string>("todos")
const viewMode = ref<"grid" | "table">("grid")

const showGenerateModal = ref(false)
const showRequestModal = ref(false)
const selectedTemplateIdForModal = ref<string | null>(null)
const previewDoc = ref<SystemDocument | null>(null)

/* Títulos adaptados por Cargo */
const docTitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Meus Documentos & Certidões Assinadas"
  if (userRoleType.value === "dp") return "Acervo de Documentos Oficiais — DP & Folha"
  if (userRoleType.value === "ti") return "Políticas de TI, Termos de Uso & Segurança"
  return "Repositório & Gerador de Documentos — RH"
})

const docSubtitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Consulte suas declarações emitidas, contratos e solicite novos documentos oficiais sem burocracia."
  if (userRoleType.value === "dp") return "Gerencie holerites mensais, comprovantes de rendimento, termos de rescisão e relatórios fiscais."
  if (userRoleType.value === "ti") return "Gerencie termos de uso de equipamentos, política de segurança da informação e diretrizes LGPD."
  return "Central de emissão, acervo de minutas e importação de documentos oficiais em PDF."
})

/* Gerenciamento de Modelos de RH (Criar, Editar, Importar, Excluir) */
const showTemplateModal = ref(false)
const templateModalMode = ref<"create" | "edit" | "import">("create")
const editingTemplateId = ref<string | null>(null)

const tplFormTitle = ref("")
const tplFormCategory = ref<DocumentCategory>("declaracoes")
const tplFormDescription = ref("")
const tplFormText = ref("")
const tplFormFieldsInput = ref("")
const tplFileInputRef = ref<HTMLInputElement | null>(null)

function openCreateTemplateModal() {
  editingTemplateId.value = null
  templateModalMode.value = "create"
  tplFormTitle.value = ""
  tplFormCategory.value = "declaracoes"
  tplFormDescription.value = ""
  tplFormText.value = "Declaramos para os devidos fins que o(a) Sr(a). {nome}, inscrito(a) no CPF sob o nº {cpf}, exerce o cargo de {cargo} no departamento de {department}."
  tplFormFieldsInput.value = "nome, cpf, cargo, departamento"
  showTemplateModal.value = true
}

function openEditTemplateModal(tpl: DocumentTemplate) {
  editingTemplateId.value = tpl.id
  templateModalMode.value = "edit"
  tplFormTitle.value = tpl.title
  tplFormCategory.value = tpl.category
  tplFormDescription.value = tpl.description
  tplFormText.value = tpl.templateText
  tplFormFieldsInput.value = tpl.fields.join(", ")
  showTemplateModal.value = true
}

function openImportTemplateModal() {
  editingTemplateId.value = null
  templateModalMode.value = "import"
  tplFormTitle.value = ""
  tplFormCategory.value = "declaracoes"
  tplFormDescription.value = ""
  tplFormText.value = ""
  tplFormFieldsInput.value = ""
  showTemplateModal.value = true
}

function handleDeleteTemplate(tpl: DocumentTemplate) {
  if (confirm(`Tem certeza que deseja excluir o modelo "${tpl.title}"?`)) {
    deleteDocumentTemplate(tpl.id)
  }
}

function handleSaveTemplate() {
  if (!tplFormTitle.value.trim() || !tplFormText.value.trim()) {
    showToast("Título e texto do modelo são obrigatórios.")
    return
  }

  const fieldsArray = tplFormFieldsInput.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (templateModalMode.value === "edit" && editingTemplateId.value) {
    updateDocumentTemplate(editingTemplateId.value, {
      title: tplFormTitle.value.trim(),
      category: tplFormCategory.value,
      description: tplFormDescription.value.trim() || "Modelo de documento RH customizado.",
      templateText: tplFormText.value.trim(),
      fields: fieldsArray.length > 0 ? fieldsArray : undefined,
    })
  } else {
    createDocumentTemplate({
      title: tplFormTitle.value.trim(),
      category: tplFormCategory.value,
      description: tplFormDescription.value.trim() || "Novo modelo de documento RH oficial.",
      templateText: tplFormText.value.trim(),
      fields: fieldsArray.length > 0 ? fieldsArray : undefined,
    })
  }

  showTemplateModal.value = false
}

function onTplFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (!content) return

      try {
        const json = JSON.parse(content)
        if (json.title && json.templateText) {
          createDocumentTemplate({
            title: json.title,
            category: json.category || "declaracoes",
            description: json.description || "Modelo importado via arquivo JSON.",
            templateText: json.templateText,
            fields: json.fields || [],
          })
          showTemplateModal.value = false
          return
        }
      } catch (_err) {}

      const titleFromFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
      createDocumentTemplate({
        title: titleFromFileName,
        category: "declaracoes",
        description: `Modelo de RH importado do arquivo ${file.name}`,
        templateText: content,
      })
      showTemplateModal.value = false
    }
    reader.readAsText(file)
  }
}

const toastText = ref<string | null>(null)

// State da Aba de Importação de PDF
const uploadFile = ref<File | null>(null)
const uploadFileName = ref("")
const uploadFileSize = ref("")
const uploadDocTitle = ref("")
const uploadDocCategory = ref<DocumentCategory>("contratos")
const uploadSelectedEmployeeId = ref("")
const uploadNotes = ref("")
const isDragging = ref(false)
const isUploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function showToast(msg: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = null
  }, 2500)
}

/* Indicadores */
const totalDocs = computed(() => systemDocuments.value.length)
const importedDocs = computed(() => systemDocuments.value.filter((d) => d.id.startsWith("doc-imp-")))
const importedDocsCount = computed(() => importedDocs.value.length)
const generatedDocsCount = computed(() => systemDocuments.value.filter((d) => !d.id.startsWith("doc-imp-")).length)
const totalTemplates = computed(() => documentTemplates.value.length)

/* Filtros do Acervo */
const filteredDocs = computed(() => {
  return systemDocuments.value.filter((d) => {
    // Se for colaborador, exibe apenas os documentos emitidos para ele ou gerais da empresa
    if (userPermissions.value.isColaborador) {
      const colabName = (currentUser.value?.name || "Gabriel Santos").toLowerCase()
      const docName = (d.employeeName || "").toLowerCase()
      const isMine =
        docName.includes(colabName) ||
        colabName.includes(docName) ||
        docName === "geral / empresa" ||
        docName === "todos os colaboradores" ||
        docName.includes("geral") ||
        docName === "rh"

      if (!isMine) return false
    }

    const matchesCat = selectedCategory.value === "todos" || d.category === selectedCategory.value
    const q = search.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      d.code.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.employeeName.toLowerCase().includes(q) ||
      d.department.toLowerCase().includes(q)
    return matchesCat && matchesSearch
  })
})

function getCategoryIcon(cat: DocumentCategory) {
  switch (cat) {
    case "contratos":
      return FileText
    case "declaracoes":
      return FileCheck
    case "ferias":
      return CalendarCheck
    case "rescisao":
      return Briefcase
    case "politicas":
      return Shield
    default:
      return FileText
  }
}

function openGenerateModal(templateId?: string) {
  selectedTemplateIdForModal.value = templateId || null
  showGenerateModal.value = true
}

function handleDeleteDoc(doc: SystemDocument) {
  if (confirm(`Deseja excluir o documento ${doc.code}?`)) {
    deleteSystemDocument(doc.id)
    showToast(`Documento ${doc.code} removido.`)
    if (previewDoc.value?.id === doc.id) {
      previewDoc.value = null
    }
  }
}

function handleGenerated(msg: string) {
  showToast(msg)
}

/* Lógica de Upload / Importação de PDF */
function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    handleSelectedFile(input.files[0])
  }
}

function onFileDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    handleSelectedFile(e.dataTransfer.files[0])
  }
}

function handleSelectedFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    showToast("Por favor, selecione um arquivo válido com extensão .PDF")
    return
  }
  uploadFile.value = file
  uploadFileName.value = file.name
  const sizeInMb = (file.size / (1024 * 1024)).toFixed(2)
  uploadFileSize.value = `${sizeInMb} MB`
  uploadDocTitle.value = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ")
}

function clearUploadForm() {
  uploadFile.value = null
  uploadFileName.value = ""
  uploadFileSize.value = ""
  uploadDocTitle.value = ""
  uploadNotes.value = ""
  uploadSelectedEmployeeId.value = ""
  if (fileInputRef.value) fileInputRef.value.value = ""
}

async function handleImportSubmit() {
  if (!uploadDocTitle.value.trim()) {
    showToast("Por favor, informe o título do documento.")
    return
  }
  isUploading.value = true

  await importPdfDocument({
    title: uploadDocTitle.value.trim(),
    category: uploadDocCategory.value,
    employeeId: uploadSelectedEmployeeId.value || undefined,
    fileName: uploadFileName.value || `${uploadDocTitle.value}.pdf`,
    fileSize: uploadFileSize.value || "1.5 MB",
    contentSnippet: uploadNotes.value.trim() || `Arquivo PDF importado: ${uploadDocTitle.value}`,
  })

  isUploading.value = false
  clearUploadForm()
  activeMainTab.value = "acervo"
}
</script>

<template>
  <main class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative text-foreground">
    <!-- Toast local -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="toastText"
        class="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-2xl"
      >
        {{ toastText }}
      </div>
    </transition>

    <!-- Modal de Solicitação de Documento (Autoatendimento do Colaborador) -->
    <NewRequestModal
      v-if="showRequestModal"
      :is-document-only="true"
      @close="showRequestModal = false"
      @created="(msg) => showToast(msg)"
    />

    <!-- Modal de Geração de Documentos -->
    <GenerateDocumentModal
      v-if="showGenerateModal"
      :initial-template-id="selectedTemplateIdForModal"
      @close="showGenerateModal = false"
      @generated="handleGenerated"
    />

    <!-- Header Principal -->
    <header class="border-b bg-card px-5 py-5 sm:px-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText :size="16" class="text-primary" />
            <span>Módulo de Gestão de Documentos • {{ userRoleType.toUpperCase() }}</span>
          </div>
          <h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {{ docTitle }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ docSubtitle }}
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            v-if="userPermissions.isColaborador"
            class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4.5 font-semibold text-sm text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 active:scale-95 shrink-0 cursor-pointer"
            style="background-color: var(--color-primary)"
            @click="showRequestModal = true"
          >
            <Plus :size="17" />
            <span>Solicitar Novo Documento</span>
          </button>

          <template v-else>
            <button
              class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 font-semibold text-sm border bg-card text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
              @click="activeMainTab = 'importar'"
            >
              <Upload :size="16" class="text-teal-600" />
              <span>Importar PDF</span>
            </button>
            <button
              class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4.5 font-semibold text-sm text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 active:scale-95 shrink-0 cursor-pointer"
              style="background-color: var(--color-primary)"
              @click="openGenerateModal()"
            >
              <Sparkles :size="17" />
              <span>Gerar Novo Documento</span>
            </button>
          </template>
        </div>
      </div>

      <!-- Abas de Navegação do Módulo -->
      <div class="mt-6 flex items-center gap-6 border-b">
        <button
          class="pb-3 text-sm font-bold transition-colors border-b-2 cursor-pointer"
          :class="activeMainTab === 'acervo' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeMainTab = 'acervo'"
        >
          {{ userPermissions.isColaborador ? 'Meus Documentos Assinados & Emitidos' : 'Acervo de Documentos' }} ({{ totalDocs }})
        </button>
        <button
          v-if="!userPermissions.isColaborador"
          class="pb-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 cursor-pointer"
          :class="activeMainTab === 'importar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeMainTab = 'importar'"
        >
          <FileUp :size="16" />
          <span>Importar Documentos PDF</span>
          <span class="rounded-full bg-teal-500/15 text-teal-700 text-[10px] font-bold px-2 py-0.5">.PDF</span>
        </button>
        <button
          v-if="!userPermissions.isColaborador"
          class="pb-3 text-sm font-bold transition-colors border-b-2 cursor-pointer"
          :class="activeMainTab === 'modelos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeMainTab = 'modelos'"
        >
          Modelos de RH Prontos ({{ totalTemplates }})
        </button>
      </div>
    </header>

    <div class="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 space-y-6">
      <!-- Indicadores Rápidos (Ocultos para o colaborador) -->
      <section v-if="!userPermissions.isColaborador" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none">{{ totalDocs }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Documentos no Acervo</p>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700">
            <FileUp :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none text-teal-700">{{ importedDocsCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">PDFs Importados</p>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
            <CheckCircle2 :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none text-blue-600">{{ generatedDocsCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Gerados pelo RH</p>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600">
            <Sparkles :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none text-purple-600">{{ totalTemplates }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Modelos Oficiais</p>
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- ABA 1: ACERVO DE DOCUMENTOS EMITIDOS                               -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <template v-if="activeMainTab === 'acervo'">
        <!-- Barra de Filtros e Busca (sem status de assinatura) -->
        <section class="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative flex-1">
              <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="search"
                type="text"
                placeholder="Buscar documento por código, título, colaborador ou departamento..."
                class="w-full rounded-xl border bg-background pl-10 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div class="flex items-center gap-2">
              <div class="flex items-center rounded-xl border bg-background p-1">
                <button
                  class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer"
                  :class="viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
                  @click="viewMode = 'grid'"
                  title="Visualização em Grade"
                >
                  <LayoutGrid :size="16" />
                </button>
                <button
                  class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer"
                  :class="viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
                  @click="viewMode = 'table'"
                  title="Visualização em Tabela"
                >
                  <List :size="16" />
                </button>
              </div>
            </div>
          </div>

          <!-- Abas de Categorias -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-t pt-3">
            <button
              class="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
              :class="selectedCategory === 'todos' ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="selectedCategory = 'todos'"
            >
              Todas as Categorias
            </button>
            <button
              v-for="(label, catKey) in documentCategoryLabels"
              :key="catKey"
              class="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
              :class="selectedCategory === catKey ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="selectedCategory = catKey"
            >
              {{ label }}
            </button>
          </div>
        </section>

        <!-- Grid de Documentos -->
        <section v-if="viewMode === 'grid'">
          <div v-if="filteredDocs.length === 0" class="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card p-12 text-center">
            <FileText :size="48" class="text-muted-foreground/40 mb-3" />
            <h3 class="text-lg font-bold">
              {{ userPermissions.isColaborador ? 'Nenhum documento emitido até o momento' : 'Nenhum documento encontrado' }}
            </h3>
            <p class="text-sm text-muted-foreground mt-1 max-w-md">
              {{ userPermissions.isColaborador ? 'Você não possui documentos em seu acervo no momento. Caso precise de uma declaração de vínculo, contra-cheque ou comprovante, faça um pedido à equipe.' : 'Tente ajustar os termos da busca, importe um arquivo PDF ou gere uma nova minuta.' }}
            </p>
            
            <!-- Botão de Ação para o Colaborador (Autoatendimento) -->
            <div v-if="userPermissions.isColaborador" class="mt-4">
              <button
                class="rounded-xl py-2.5 px-5 text-xs font-bold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 cursor-pointer"
                style="background-color: var(--color-primary)"
                @click="showRequestModal = true"
              >
                + Solicitar Novo Documento
              </button>
            </div>

            <!-- Botões de Ação para Gestores (RH / DP / TI) -->
            <div v-else class="mt-4 flex items-center gap-3">
              <button class="rounded-xl py-2 px-4 text-xs font-semibold border bg-card hover:bg-muted cursor-pointer" @click="activeMainTab = 'importar'">
                Importar PDF
              </button>
              <button class="rounded-xl py-2 px-4 text-xs font-semibold text-primary-foreground cursor-pointer" style="background-color: var(--color-primary)" @click="openGenerateModal()">
                + Gerar Novo Documento
              </button>
            </div>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="doc in filteredDocs"
              :key="doc.id"
              class="group flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div>
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="text-[11px] font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {{ doc.code }}
                  </span>
                  <span class="rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5">
                    {{ doc.fileType || 'PDF' }} ({{ doc.fileSize }})
                  </span>
                </div>

                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <component :is="getCategoryIcon(doc.category)" :size="20" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                      {{ doc.title }}
                    </h3>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ documentCategoryLabels[doc.category] }}
                    </p>
                  </div>
                </div>

                <p class="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                  "{{ doc.contentSnippet }}"
                </p>
              </div>

              <div class="mt-5 border-t pt-4">
                <div class="flex items-center justify-between gap-2 mb-3">
                  <div class="flex items-center gap-2 min-w-0">
                    <UserAvatar :initials="doc.employeeInitials" :size="28" />
                    <div class="min-w-0">
                      <p class="text-xs font-semibold truncate">{{ doc.employeeName }}</p>
                      <p class="text-[10px] text-muted-foreground truncate">{{ doc.department }}</p>
                    </div>
                  </div>
                  <span class="text-[10px] text-muted-foreground shrink-0">{{ doc.generatedAt }}</span>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    class="flex-1 rounded-xl border bg-background py-1.5 px-2 text-xs font-semibold text-foreground hover:bg-muted flex items-center justify-center gap-1 cursor-pointer"
                    @click="previewDoc = doc"
                  >
                    <Eye :size="14" /> Visualizar
                  </button>
                  <button
                    class="rounded-xl border bg-background py-1.5 px-3 text-xs font-semibold text-primary hover:bg-primary/10 flex items-center justify-center gap-1 cursor-pointer"
                    title="Baixar PDF"
                    @click="showToast(`Download do PDF ${doc.code} concluído.`)"
                  >
                    <Download :size="14" /> PDF
                  </button>
                  <button
                    v-if="!userPermissions.isColaborador"
                    class="rounded-xl border border-red-200 bg-background hover:bg-red-50 text-red-600 py-1.5 px-2 text-xs font-semibold flex items-center justify-center cursor-pointer"
                    title="Excluir Documento"
                    @click="handleDeleteDoc(doc)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Tabela de Documentos -->
        <section v-else class="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-muted/50 border-b font-semibold uppercase text-muted-foreground">
                <tr>
                  <th class="px-4 py-3">Código</th>
                  <th class="px-4 py-3">Documento</th>
                  <th class="px-4 py-3">Colaborador / Destinatário</th>
                  <th class="px-4 py-3">Categoria</th>
                  <th class="px-4 py-3">Formato</th>
                  <th class="px-4 py-3">Data</th>
                  <th class="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="doc in filteredDocs" :key="doc.id" class="hover:bg-muted/30 transition-colors">
                  <td class="px-4 py-3 font-mono font-bold">{{ doc.code }}</td>
                  <td class="px-4 py-3 font-semibold text-foreground">{{ doc.title }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <UserAvatar :initials="doc.employeeInitials" :size="26" />
                      <span>{{ doc.employeeName }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">{{ documentCategoryLabels[doc.category] }}</td>
                  <td class="px-4 py-3 font-mono text-[11px] font-semibold">{{ doc.fileType || 'PDF' }} ({{ doc.fileSize }})</td>
                  <td class="px-4 py-3 text-muted-foreground">{{ doc.generatedAt }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Visualizar" @click="previewDoc = doc">
                        <Eye :size="15" />
                      </button>
                      <button class="p-1.5 rounded-lg hover:bg-muted text-primary" title="Baixar PDF" @click="showToast(`Download de ${doc.code} realizado.`)">
                        <Download :size="15" />
                      </button>
                      <button v-if="!userPermissions.isColaborador" class="p-1.5 rounded-lg hover:bg-red-50 text-red-600 cursor-pointer" title="Excluir" @click="handleDeleteDoc(doc)">
                        <Trash2 :size="15" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- ABA 2: IMPORTAR DOCUMENTOS PDF PRONTOS                             -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <template v-else-if="activeMainTab === 'importar'">
        <section class="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div class="flex items-center justify-between border-b pb-4">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                <FileUp :size="24" />
              </div>
              <div>
                <h2 class="text-xl font-bold tracking-tight">Importação de Documentos PDF</h2>
                <p class="text-xs text-muted-foreground">Envie contratos assinados, atestados, exames admissionais, holerites ou certificados em formato .PDF.</p>
              </div>
            </div>
            <span class="rounded-full bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 border border-teal-200">
              Formato: .PDF
            </span>
          </div>

          <!-- Hidden File Input -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,application/pdf"
            class="hidden"
            @change="onFilePicked"
          />

          <!-- Drag and Drop Box -->
          <div
            class="relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer group"
            :class="isDragging ? 'border-teal-500 bg-teal-50/50 scale-[1.01]' : uploadFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-border hover:border-teal-500 hover:bg-muted/30'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onFileDrop"
            @click="triggerFileInput"
          >
            <!-- Quando nenhum arquivo foi selecionado ainda -->
            <div v-if="!uploadFile" class="flex flex-col items-center justify-center space-y-3">
              <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 group-hover:scale-110 transition-transform">
                <Upload :size="32" />
              </div>
              <div>
                <p class="text-base font-bold text-foreground">Arraste e solte o arquivo PDF aqui</p>
                <p class="text-xs text-muted-foreground mt-0.5">ou clique para procurar no seu computador</p>
              </div>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Documentos suportados: .pdf (até 25 MB)
              </span>
            </div>

            <!-- Quando o arquivo foi selecionado com sucesso -->
            <div v-else class="flex flex-col sm:flex-row items-center justify-between gap-4 p-2" @click.stop>
              <div class="flex items-center gap-3 text-left">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 font-bold">
                  PDF
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-bold text-foreground">{{ uploadFileName }}</p>
                    <span class="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5">Pronto para importar</span>
                  </div>
                  <p class="text-xs text-muted-foreground mt-0.5">Tamanho: {{ uploadFileSize }}</p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  @click="triggerFileInput"
                >
                  Trocar Arquivo
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                  @click="clearUploadForm"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>

          <!-- Formulário de Metadados do Documento Importado -->
          <form @submit.prevent="handleImportSubmit" class="space-y-4 pt-2">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- Título do Documento -->
              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Título / Nome do Documento <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                  <FileText :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    v-model="uploadDocTitle"
                    type="text"
                    required
                    placeholder="ex: Contrato de Trabalho Assinado - Carlos Santos"
                    class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                    style="--tw-ring-color: var(--color-ring)"
                  />
                </div>
              </div>

              <!-- Categoria -->
              <div>
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Categoria de RH <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="uploadDocCategory"
                  class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all font-medium"
                  style="--tw-ring-color: var(--color-ring)"
                >
                  <option value="contratos">Contratos & Aditivos</option>
                  <option value="declaracoes">Declarações Oficiais</option>
                  <option value="ferias">Férias & Licenças</option>
                  <option value="rescisao">Rescisão & Desligamento</option>
                  <option value="politicas">Políticas & Regulamentos</option>
                </select>
              </div>

              <!-- Vincular Colaborador -->
              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Vincular a Colaborador Específico (Opcional)
                </label>
                <div class="relative">
                  <User :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select
                    v-model="uploadSelectedEmployeeId"
                    class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                    style="--tw-ring-color: var(--color-ring)"
                  >
                    <option value="">Documento Geral da Empresa (Sem colaborador específico)</option>
                    <option v-for="emp in employeeFolders" :key="emp.id" :value="emp.id">
                      {{ emp.name }} — {{ emp.role }} ({{ emp.department }})
                    </option>
                  </select>
                </div>
              </div>

              <!-- Observações -->
              <div class="md:col-span-3">
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Observações / Resumo do Conteúdo
                </label>
                <textarea
                  v-model="uploadNotes"
                  rows="2"
                  placeholder="Descreva observações sobre o documento importado, histórico ou autenticação..."
                  class="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 resize-none transition-all"
                  style="--tw-ring-color: var(--color-ring)"
                />
              </div>
            </div>

            <!-- Ações -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                class="rounded-xl border px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                @click="clearUploadForm"
              >
                Limpar Campos
              </button>
              <button
                type="submit"
                class="flex items-center gap-2 rounded-xl px-7 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                style="background-color: var(--color-primary)"
                :disabled="!uploadDocTitle.trim() || isUploading"
              >
                <FileUp :size="16" />
                <span>{{ isUploading ? 'Salvando Documento...' : 'Concluir e Salvar no Acervo' }}</span>
              </button>
            </div>
          </form>
        </section>

        <!-- Histórico de Documentos Importados Recentemente -->
        <section v-if="importedDocs.length > 0" class="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b pb-3">
            <h3 class="text-sm font-bold text-foreground">Documentos PDF Importados Recentemente ({{ importedDocs.length }})</h3>
            <button class="text-xs text-primary font-semibold hover:underline" @click="activeMainTab = 'acervo'">
              Ver todos no acervo →
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="doc in importedDocs.slice(0, 6)"
              :key="doc.id"
              class="flex items-center justify-between rounded-xl border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                  PDF
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-foreground truncate">{{ doc.title }}</p>
                  <p class="text-[10px] text-muted-foreground truncate">{{ doc.employeeName }} · {{ doc.generatedAt }}</p>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button class="p-1 rounded text-muted-foreground hover:text-foreground" title="Visualizar" @click="previewDoc = doc">
                  <Eye :size="14" />
                </button>
                <button class="p-1 rounded text-primary hover:bg-primary/10" title="Baixar PDF" @click="showToast(`Download de ${doc.title} iniciado.`)">
                  <Download :size="14" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- ABA 3: MODELOS OFICIAIS DE RH                                      -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <template v-else-if="activeMainTab === 'modelos'">
        <!-- Barra Superior de Gestão de Modelos -->
        <section class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm mb-4">
          <div>
            <h2 class="text-base font-bold text-foreground">Modelos de Minutas & Documentos Oficiais</h2>
            <p class="text-xs text-muted-foreground">Crie, edite, exclua, importe novos modelos ou gere minutas em papel timbrado.</p>
          </div>

          <div class="flex items-center gap-2">
            <!-- Importar Arquivo de Modelo -->
            <button
              class="flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
              @click="openImportTemplateModal"
            >
              <FileUp :size="15" class="text-teal-600" />
              <span>Importar Modelo (TXT / JSON)</span>
            </button>

            <!-- Criar Novo Modelo -->
            <button
              class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              style="background-color: var(--color-primary)"
              @click="openCreateTemplateModal"
            >
              <Plus :size="16" />
              <span>+ Criar Novo Modelo</span>
            </button>
          </div>
        </section>

        <!-- Grid de Cards de Modelos de RH -->
        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="tpl in documentTemplates"
            :key="tpl.id"
            class="flex flex-col justify-between rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div>
              <div class="flex items-center justify-between gap-2 mb-4">
                <span class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {{ documentCategoryLabels[tpl.category] }}
                </span>
                <div class="flex items-center gap-1">
                  <span class="text-xs font-mono text-muted-foreground mr-1">ID: {{ tpl.id }}</span>
                  <button
                    class="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                    title="Editar este modelo"
                    @click="openEditTemplateModal(tpl)"
                  >
                    <Edit3 :size="15" />
                  </button>
                  <button
                    class="p-1 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Excluir este modelo"
                    @click="handleDeleteTemplate(tpl)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </div>

              <h3 class="text-lg font-bold leading-snug text-foreground">{{ tpl.title }}</h3>
              <p class="mt-2 text-xs text-muted-foreground leading-relaxed">{{ tpl.description }}</p>

              <div class="mt-4 flex flex-wrap gap-1.5">
                <span v-for="f in tpl.fields" :key="f" class="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  &#123;&#123; {{ f }} &#125;&#125;
                </span>
              </div>
            </div>

            <div class="mt-6 border-t pt-4 flex items-center justify-between gap-2">
              <button
                class="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                @click="openEditTemplateModal(tpl)"
              >
                <Edit3 :size="13" /> Editar Modelo
              </button>
              <button
                class="flex items-center gap-1.5 rounded-xl py-2 px-4 text-xs font-semibold text-primary-foreground shadow transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                style="background-color: var(--color-primary)"
                @click="openGenerateModal(tpl.id)"
              >
                <Sparkles :size="14" /> Usar / Gerar
              </button>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- Modal Criar / Editar / Importar Modelo de RH -->
    <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-foreground/40 backdrop-blur-sm">
      <div class="relative w-full max-w-2xl rounded-2xl bg-card border shadow-2xl z-10 p-6 sm:p-8 text-foreground max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b pb-4">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 font-bold">
              <Edit3 v-if="templateModalMode === 'edit'" :size="22" />
              <FileUp v-else-if="templateModalMode === 'import'" :size="22" />
              <Sparkles v-else :size="22" />
            </div>
            <div>
              <h2 class="text-xl font-bold">
                {{ templateModalMode === 'edit' ? 'Editar Modelo de RH' : templateModalMode === 'import' ? 'Importar Novo Modelo de RH' : 'Criar Novo Modelo de RH' }}
              </h2>
              <p class="text-xs text-muted-foreground">
                {{ templateModalMode === 'import' ? 'Envie um arquivo de minuta (.txt / .json) ou preencha os dados abaixo.' : 'Configure o título, categoria, variáveis e o texto padrão em papel timbrado.' }}
              </p>
            </div>
          </div>
          <button class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" @click="showTemplateModal = false">
            <X :size="20" />
          </button>
        </div>

        <!-- Se for modo importar, caixa de arquivo rápida -->
        <div v-if="templateModalMode === 'import'" class="mt-4 p-4 rounded-xl border-2 border-dashed bg-muted/20 text-center space-y-2">
          <input ref="tplFileInputRef" type="file" accept=".txt,.json,.md" class="hidden" @change="onTplFilePicked" />
          <FileUp :size="28" class="mx-auto text-teal-600" />
          <p class="text-xs font-bold">Selecione um arquivo de modelo (.TXT ou .JSON)</p>
          <p class="text-[11px] text-muted-foreground">O conteúdo do arquivo será importado automaticamente como um modelo oficial de RH.</p>
          <button type="button" class="rounded-xl border bg-card px-4 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 cursor-pointer" @click="tplFileInputRef?.click()">
            Procurar Arquivo no Computador
          </button>
        </div>

        <form @submit.prevent="handleSaveTemplate" class="mt-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Título do Modelo -->
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Título do Modelo *</label>
              <input
                v-model="tplFormTitle"
                type="text"
                required
                placeholder="ex: Termo de Entrega de Equipamentos & Notebook"
                class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>

            <!-- Categoria -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Categoria de RH *</label>
              <select
                v-model="tplFormCategory"
                class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              >
                <option value="contratos">Contratos & Aditivos</option>
                <option value="declaracoes">Declarações Oficiais</option>
                <option value="ferias">Férias & Licenças</option>
                <option value="rescisao">Rescisão & Desligamento</option>
                <option value="politicas">Políticas & Regulamentos</option>
              </select>
            </div>

            <!-- Variáveis / Variáveis aceitas (Fields) -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Variáveis (Tags)</label>
              <input
                v-model="tplFormFieldsInput"
                type="text"
                placeholder="ex: nome, cpf, cargo, departamento"
                class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 font-mono text-xs"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>

            <!-- Descrição -->
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Descrição Breve do Modelo</label>
              <input
                v-model="tplFormDescription"
                type="text"
                placeholder="ex: Modelo padrão para termo de responsabilidade de equipamentos de informática."
                class="w-full rounded-xl border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>

            <!-- Conteúdo do Modelo / Texto da Minuta -->
            <div class="md:col-span-2">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Texto do Modelo / Minuta *</label>
                <span class="text-[11px] text-muted-foreground">Use tags como &#123;nome&#125;, &#123;cpf&#125;, &#123;cargo&#125; para substituição dinâmica</span>
              </div>
              <textarea
                v-model="tplFormText"
                rows="6"
                required
                placeholder="Digite aqui o texto do modelo. Exemplo: Declaramos para os devidos fins que o(a) colaborador(a) {nome}, inscrito(a) no CPF {cpf}, atua no cargo de {cargo}..."
                class="w-full rounded-xl border bg-background p-3.5 text-sm outline-none focus:ring-2 font-serif transition-all resize-y"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t">
            <button type="button" class="rounded-xl border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer" @click="showTemplateModal = false">
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-xl px-6 py-2 text-xs font-semibold text-primary-foreground shadow flex items-center gap-1.5 cursor-pointer"
              style="background-color: var(--color-primary)"
              :disabled="!tplFormTitle.trim() || !tplFormText.trim()"
            >
              <Sparkles :size="15" />
              <span>{{ templateModalMode === 'edit' ? 'Salvar Alterações' : 'Criar Modelo' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de Pré-visualização de Documento -->
    <div v-if="previewDoc" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="previewDoc = null" />
      <div class="relative w-full max-w-3xl rounded-2xl bg-card border shadow-2xl z-10 p-6 sm:p-8 text-foreground max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{{ previewDoc.code }}</span>
              <h2 class="text-lg font-bold">{{ previewDoc.title }}</h2>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">Destinatário: {{ previewDoc.employeeName }} · {{ previewDoc.department }}</p>
          </div>
          <button class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" @click="previewDoc = null">
            <X :size="20" />
          </button>
        </div>

        <div class="rounded-xl border bg-white text-slate-900 p-6 font-serif text-sm shadow-inner min-h-[300px] flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div class="flex items-center gap-2 font-sans font-bold text-xs">
                <div class="h-6 w-6 rounded bg-teal-800 text-white flex items-center justify-center">PH</div>
                <span>PEOPLEHUB RH S/A</span>
              </div>
              <span class="font-sans text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-500">DOCUMENTO OFICIAL</span>
            </div>

            <h3 class="font-sans font-bold text-center uppercase tracking-wide text-slate-800 mb-4">{{ previewDoc.title }}</h3>
            <p class="text-justify text-slate-800 leading-relaxed font-normal whitespace-pre-line">{{ previewDoc.contentSnippet }}</p>
          </div>

          <div class="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between font-sans text-xs">
            <div>
              <p class="text-[10px] text-slate-500">Emitido em {{ previewDoc.generatedAt }}</p>
              <p class="font-bold text-slate-800 mt-0.5">Recursos Humanos — PeopleHub</p>
            </div>
            <span class="text-[11px] font-mono text-slate-400">{{ previewDoc.fileType || 'PDF' }} · {{ previewDoc.fileSize }}</span>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-3 border-t pt-4">
          <button class="rounded-xl border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer" @click="previewDoc = null">
            Fechar
          </button>
          <button
            class="flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold text-primary-foreground shadow cursor-pointer"
            style="background-color: var(--color-primary)"
            @click="showToast(`Download de ${previewDoc.code} realizado com sucesso.`)"
          >
            <Download :size="15" /> Baixar Documento PDF
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
