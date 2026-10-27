<script setup lang="ts">
import { ref, computed } from "vue"
import { X, CalendarCheck, Upload, AlertCircle, FileText, UserCheck } from "lucide-vue-next"
import type { RequestType, RequestPriority } from "../data"
import { requestTypeLabels } from "../data"
import { createRequest, employeeFolders, currentUser, userPermissions } from "../store"

const props = defineProps<{
  isDocumentOnly?: boolean
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "created", msg: string): void
}>()

const isColaborador = computed(() => userPermissions.value.isColaborador || props.isDocumentOnly)

const selectedEmployeeId = ref(employeeFolders.value[0]?.id || "")
const customEmployeeName = ref(currentUser.value?.name || "")
const customEmployeeRole = ref(currentUser.value?.role || "")
const customDepartment = ref(currentUser.value?.department || "")

const type = ref<RequestType>("documento")
const title = ref("")
const description = ref("")
const startDate = ref("")
const endDate = ref("")
const amount = ref("")
const referenceMonth = ref("08/2026")
const priority = ref<RequestPriority>("media")
const fileName = ref("Documento_Anexo.pdf")
const fileInput = ref<HTMLInputElement | null>(null)

const formErrors = ref<{
  name?: string
  title?: string
  description?: string
  dateRange?: string
  amount?: string
}>({})
const error = ref<string | null>(null)
const isSubmitting = ref(false)

const departments = ["Recursos Humanos", "Tecnologia", "Marketing", "Vendas", "Financeiro", "Administrativo", "Departamento Pessoal"]

function formatDateString(val: string): string | undefined {
  if (!val) return undefined
  const parts = val.split("-")
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return val
}

function onTypeChange() {
  if (type.value === "contracheque") {
    if (!title.value) {
      title.value = `Emissão de Contra-Cheque ${referenceMonth.value}`
    }
    if (!description.value && isColaborador.value) {
      description.value = `Solicito a emissão do meu demonstrativo de pagamento referente à competência de ${referenceMonth.value}.`
    }
  } else if (isColaborador.value && !title.value) {
    title.value = `Solicitação de ${requestTypeLabels[type.value] || "Documento"}`
  }
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    fileName.value = target.files[0].name
  }
}

function validateForm(): boolean {
  formErrors.value = {}
  error.value = null

  if (isColaborador.value) {
    if (!customEmployeeName.value.trim()) {
      formErrors.value.name = "Por favor, informe seu nome completo."
    }
    if (!description.value.trim()) {
      formErrors.value.description = "Por favor, informe a descrição e detalhes da sua solicitação."
    }
  } else {
    if (selectedEmployeeId.value === "custom" && !customEmployeeName.value.trim()) {
      formErrors.value.name = "Por favor, informe o nome do colaborador."
    }
    if (!title.value.trim()) {
      formErrors.value.title = "Por favor, informe o título da solicitação."
    }
    if (!description.value.trim()) {
      formErrors.value.description = "Por favor, informe a descrição ou justificativa."
    }

    if (["ferias", "atestado", "ponto"].includes(type.value)) {
      if (startDate.value && endDate.value && startDate.value > endDate.value) {
        formErrors.value.dateRange = "A data de término não pode ser anterior à data de início."
      }
    }
  }

  if (Object.keys(formErrors.value).length > 0) {
    error.value = Object.values(formErrors.value)[0] || "Por favor, corrija os campos destacados."
    return false
  }

  return true
}

async function handleSubmit() {
  if (isSubmitting.value) return
  if (!validateForm()) return

  let empName = ""
  let empInitials = "RH"
  let empRole = ""
  let empDept = ""

  if (isColaborador.value) {
    empName = customEmployeeName.value.trim()
    const parts = empName.split(" ")
    empInitials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : empName.slice(0, 2).toUpperCase()
    empRole = currentUser.value?.role || "Colaborador"
    empDept = currentUser.value?.department || "Operações"
    if (!title.value.trim()) {
      title.value = `Solicitação: ${requestTypeLabels[type.value] || "Documento"}`
    }
  } else if (selectedEmployeeId.value === "custom") {
    empName = customEmployeeName.value.trim()
    const parts = empName.split(" ")
    empInitials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : empName.slice(0, 2).toUpperCase()
    empRole = customEmployeeRole.value.trim() || "Colaborador"
    empDept = customDepartment.value
  } else {
    const folder = employeeFolders.value.find((f) => f.id === selectedEmployeeId.value)
    if (folder) {
      empName = folder.name
      empInitials = folder.initials
      empRole = folder.role
      empDept = folder.department
    } else {
      empName = currentUser.value?.name || "Victor Silva"
      empInitials = currentUser.value?.initials || "VS"
      empRole = currentUser.value?.role || "Analista de RH"
      empDept = currentUser.value?.department || "Recursos Humanos"
    }
  }

  isSubmitting.value = true
  try {
    const req = await createRequest({
      employeeName: empName,
      employeeInitials: empInitials,
      employeeRole: empRole,
      department: empDept,
      type: type.value,
      title: title.value.trim() || `Solicitação de ${requestTypeLabels[type.value]}`,
      description: description.value.trim(),
      startDate: !isColaborador.value && startDate.value ? formatDateString(startDate.value) : undefined,
      endDate: !isColaborador.value && endDate.value ? formatDateString(endDate.value) : undefined,
      amount: !isColaborador.value && amount.value ? (amount.value.includes("R$") ? amount.value : `R$ ${amount.value}`) : undefined,
      priority: isColaborador.value ? "media" : priority.value,
      attachment: isColaborador.value ? undefined : fileName.value,
    })

    if (!req) {
      // Backend returned failure; message is shown in toast, preserve input data
      return
    }

    emit("created", `Solicitação "${req.protocol}" enviada com sucesso!`)
    emit("close")
  } catch (err: any) {
    error.value = err?.message || "Erro ao registrar solicitação. Tente novamente."
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-request-title"
    tabindex="-1"
    @keydown.esc="emit('close')"
  >
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="emit('close')" />

    <!-- Modal Container -->
    <div class="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto scrollbar-thin rounded-2xl bg-card border shadow-2xl z-10 p-4 sm:p-8 text-foreground my-auto">
      <div class="flex items-center justify-between border-b pb-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText v-if="isColaborador" :size="24" aria-hidden="true" />
            <CalendarCheck v-else :size="24" aria-hidden="true" />
          </div>
          <div>
            <h2 id="modal-request-title" class="text-xl font-bold">
              {{ isColaborador ? 'Solicitar Documento / Atendimento' : 'Nova Solicitação de RH/DP/TI' }}
            </h2>
            <p class="text-xs text-muted-foreground">
              {{ isColaborador ? 'Preencha seu nome e os detalhes do documento ou serviço que você precisa.' : 'Abra uma nova solicitação para análise e aprovação das equipes.' }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Fechar modal de solicitação"
          @click="emit('close')"
        >
          <X :size="20" aria-hidden="true" />
        </button>
      </div>

      <!-- Error Alert -->
      <div v-if="error" id="req-error-alert" role="alert" class="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive font-medium">
        <AlertCircle :size="18" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <!-- Form (Colaborador Mode - Streamlined) -->
      <form v-if="isColaborador" class="mt-6 space-y-5" @submit.prevent="handleSubmit">
        <!-- Badge indicativo de autoatendimento -->
        <div class="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
          <UserCheck :size="16" aria-hidden="true" />
          <span>Modo Autoatendimento: Apenas seu nome e a descrição são necessários!</span>
        </div>

        <!-- Nome da Solicitante -->
        <div>
          <label for="req-colab-name" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Nome do Solicitante <span class="text-rose-500">*</span>
          </label>
          <input
            id="req-colab-name"
            v-model="customEmployeeName"
            type="text"
            placeholder="Escreva seu nome completo"
            :aria-invalid="!!formErrors.name"
            :aria-describedby="formErrors.name ? 'err-colab-name' : undefined"
            :class="['w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2', formErrors.name ? 'border-rose-500 focus:ring-rose-500' : 'focus:ring-primary']"
          />
          <p v-if="formErrors.name" id="err-colab-name" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
            <AlertCircle :size="12" aria-hidden="true" /> {{ formErrors.name }}
          </p>
        </div>

        <!-- Tipo da Solicitação / Documento -->
        <div>
          <label for="req-colab-type" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Tipo de Documento ou Serviço
          </label>
          <select
            id="req-colab-type"
            v-model="type"
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            @change="onTypeChange"
          >
            <option v-for="(label, key) in requestTypeLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>

        <!-- Descrição / Detalhes -->
        <div>
          <label for="req-colab-desc" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Descrição e Detalhes <span class="text-rose-500">*</span>
          </label>
          <textarea
            id="req-colab-desc"
            v-model="description"
            rows="4"
            placeholder="Escreva aqui os detalhes da sua solicitação (Ex: Preciso de uma declaração de vínculo empregatício com finalidade de financiamento bancário)..."
            :aria-invalid="!!formErrors.description"
            :aria-describedby="formErrors.description ? 'err-colab-desc' : undefined"
            :class="['w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 resize-none', formErrors.description ? 'border-rose-500 focus:ring-rose-500' : 'focus:ring-primary']"
          />
          <p v-if="formErrors.description" id="err-colab-desc" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
            <AlertCircle :size="12" aria-hidden="true" /> {{ formErrors.description }}
          </p>
        </div>

        <!-- Footer Buttons -->
        <div class="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            class="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-6 text-sm font-bold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style="background-color: var(--color-primary)"
          >
            <span v-if="isSubmitting" class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
            <span>{{ isSubmitting ? 'Enviando...' : 'Enviar Solicitação' }}</span>
          </button>
        </div>
      </form>

      <!-- Form (Gestor / Administrative Mode: RH / DP / TI) -->
      <form v-else class="mt-6 space-y-5" @submit.prevent="handleSubmit">
        <!-- Colaborador Select -->
        <div>
          <label for="req-admin-employee" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Colaborador Solicitante</label>
          <select
            id="req-admin-employee"
            v-model="selectedEmployeeId"
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option v-for="f in employeeFolders" :key="f.id" :value="f.id">
              {{ f.name }} ({{ f.role }} — {{ f.department }})
            </option>
            <option value="custom">+ Outro Colaborador / Digitar Manualmente</option>
          </select>
        </div>

        <!-- Custom Employee Fields -->
        <div v-if="selectedEmployeeId === 'custom'" class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 border">
          <div>
            <label for="req-admin-custom-name" class="block text-xs font-medium text-muted-foreground mb-1">Nome Completo <span class="text-rose-500">*</span></label>
            <input
              id="req-admin-custom-name"
              v-model="customEmployeeName"
              type="text"
              placeholder="Ex: Roberto Alves"
              :aria-invalid="!!formErrors.name"
              :class="['w-full rounded-lg border bg-background px-3 py-2 text-sm', formErrors.name ? 'border-rose-500' : '']"
            />
            <p v-if="formErrors.name" class="mt-1 text-[11px] text-rose-500 font-medium">
              {{ formErrors.name }}
            </p>
          </div>
          <div>
            <label for="req-admin-custom-role" class="block text-xs font-medium text-muted-foreground mb-1">Cargo</label>
            <input id="req-admin-custom-role" v-model="customEmployeeRole" type="text" placeholder="Ex: Analista de Vendas" class="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label for="req-admin-custom-dept" class="block text-xs font-medium text-muted-foreground mb-1">Departamento</label>
            <select id="req-admin-custom-dept" v-model="customDepartment" class="w-full rounded-lg border bg-background px-3 py-2 text-sm">
              <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Tipo de Solicitação -->
          <div>
            <label for="req-admin-type" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tipo da Solicitação</label>
            <select
              id="req-admin-type"
              v-model="type"
              class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              @change="onTypeChange"
            >
              <option v-for="(label, key) in requestTypeLabels" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>

          <!-- Prioridade -->
          <div>
            <label for="req-admin-priority" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Prioridade / Urgência</label>
            <select
              id="req-admin-priority"
              v-model="priority"
              class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="baixa">Baixa (Atendimento normal)</option>
              <option value="media">Média (Padrão)</option>
              <option value="alta">Alta (Requer atenção rápida)</option>
              <option value="urgente">Urgente (Prazo crítico)</option>
            </select>
          </div>
        </div>

        <!-- Título -->
        <div>
          <label for="req-admin-title" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Título Resumido <span class="text-rose-500">*</span>
          </label>
          <input
            id="req-admin-title"
            v-model="title"
            type="text"
            placeholder="Ex: Emissão de Contra-Cheque 08/2026 / Solicitação de Férias"
            :aria-invalid="!!formErrors.title"
            :aria-describedby="formErrors.title ? 'err-admin-title' : undefined"
            :class="['w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2', formErrors.title ? 'border-rose-500 focus:ring-rose-500' : 'focus:ring-primary']"
          />
          <p v-if="formErrors.title" id="err-admin-title" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
            <AlertCircle :size="12" aria-hidden="true" /> {{ formErrors.title }}
          </p>
        </div>

        <!-- Período / Valor / Competência Condicionais -->
        <div v-if="type === 'contracheque'">
          <label for="req-admin-month" class="block text-xs font-medium text-muted-foreground mb-1">Mês/Ano de Competência</label>
          <select id="req-admin-month" v-model="referenceMonth" class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium cursor-pointer" @change="onTypeChange">
            <option value="08/2026">08/2026 (Mês Atual)</option>
            <option value="07/2026">07/2026</option>
            <option value="06/2026">06/2026</option>
            <option value="05/2026">05/2026</option>
            <option value="13º/2025">13º Salário / 2025</option>
          </select>
        </div>

        <div v-if="type === 'ferias' || type === 'atestado' || type === 'ponto'" class="space-y-1.5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="req-admin-start-date" class="block text-xs font-medium text-muted-foreground mb-1">Data de Início</label>
              <input id="req-admin-start-date" v-model="startDate" type="date" :class="['w-full rounded-xl border bg-background px-3.5 py-2 text-sm', formErrors.dateRange ? 'border-rose-500' : '']" />
            </div>
            <div>
              <label for="req-admin-end-date" class="block text-xs font-medium text-muted-foreground mb-1">Data de Término</label>
              <input id="req-admin-end-date" v-model="endDate" type="date" :class="['w-full rounded-xl border bg-background px-3.5 py-2 text-sm', formErrors.dateRange ? 'border-rose-500' : '']" />
            </div>
          </div>
          <p v-if="formErrors.dateRange" class="text-xs text-rose-500 flex items-center gap-1 font-medium">
            <AlertCircle :size="12" aria-hidden="true" /> {{ formErrors.dateRange }}
          </p>
        </div>

        <div v-if="type === 'reembolso'">
          <label for="req-admin-amount" class="block text-xs font-medium text-muted-foreground mb-1">Valor Solicitado (R$)</label>
          <input id="req-admin-amount" v-model="amount" type="text" placeholder="Ex: 350,00" class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium" />
        </div>

        <!-- Descrição / Justificativa -->
        <div>
          <label for="req-admin-desc" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Descrição / Detalhes <span class="text-rose-500">*</span>
          </label>
          <textarea
            id="req-admin-desc"
            v-model="description"
            rows="3"
            placeholder="Descreva os detalhes da solicitação, motivos ou dados relevantes..."
            :aria-invalid="!!formErrors.description"
            :aria-describedby="formErrors.description ? 'err-admin-desc' : undefined"
            :class="['w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 resize-none', formErrors.description ? 'border-rose-500 focus:ring-rose-500' : 'focus:ring-primary']"
          />
          <p v-if="formErrors.description" id="err-admin-desc" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
            <AlertCircle :size="12" aria-hidden="true" /> {{ formErrors.description }}
          </p>
        </div>

        <!-- Anexo File Upload -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Anexo / Comprovante (opcional)</label>
          <div class="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-background border px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted cursor-pointer"
              aria-label="Selecionar arquivo de anexo ou comprovante"
              @click="fileInput?.click()"
            >
              <Upload :size="16" aria-hidden="true" /> Selecionar Arquivo
            </button>
            <input ref="fileInput" type="file" aria-label="Upload de anexo" class="hidden" @change="onFileSelect" />
            <span class="text-xs text-muted-foreground truncate">{{ fileName }}</span>
          </div>
        </div>

        <!-- Footer Buttons -->
        <div class="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            class="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-6 text-sm font-bold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style="background-color: var(--color-primary)"
          >
            <span v-if="isSubmitting" class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
            <span>{{ isSubmitting ? 'Enviando...' : 'Abrir Solicitação' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

