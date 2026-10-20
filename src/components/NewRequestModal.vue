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

const error = ref<string | null>(null)

const departments = ["Recursos Humanos", "Tecnologia", "Marketing", "Vendas", "Financeiro", "Administrativo", "Departamento Pessoal"]

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

async function handleSubmit() {
  error.value = null
  
  if (isColaborador.value) {
    if (!customEmployeeName.value.trim()) {
      error.value = "Por favor, informe seu nome."
      return
    }
    if (!description.value.trim()) {
      error.value = "Por favor, informe a descrição e detalhes da sua solicitação."
      return
    }
    if (!title.value.trim()) {
      title.value = `Solicitação: ${requestTypeLabels[type.value] || "Documento"}`
    }
  } else {
    if (!title.value.trim()) {
      error.value = "Por favor, informe o título da solicitação."
      return
    }
    if (!description.value.trim()) {
      error.value = "Por favor, informe a descrição ou justificativa."
      return
    }
  }

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
  } else if (selectedEmployeeId.value === "custom") {
    if (!customEmployeeName.value.trim()) {
      error.value = "Por favor, informe o nome do colaborador."
      return
    }
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

  const req = await createRequest({
    employeeName: empName,
    employeeInitials: empInitials,
    employeeRole: empRole,
    department: empDept,
    type: type.value,
    title: title.value.trim() || `Solicitação de ${requestTypeLabels[type.value]}`,
    description: description.value.trim(),
    startDate: !isColaborador.value && startDate.value ? new Date(startDate.value).toLocaleDateString("pt-BR") : undefined,
    endDate: !isColaborador.value && endDate.value ? new Date(endDate.value).toLocaleDateString("pt-BR") : undefined,
    amount: !isColaborador.value && amount.value ? (amount.value.includes("R$") ? amount.value : `R$ ${amount.value}`) : undefined,
    priority: isColaborador.value ? "media" : priority.value,
    attachment: isColaborador.value ? undefined : fileName.value,
  })

  emit("created", `Solicitação "${req.protocol}" enviada com sucesso!`)
  emit("close")
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="emit('close')" />

    <!-- Modal Container -->
    <div class="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border shadow-2xl z-10 p-6 sm:p-8 text-foreground">
      <div class="flex items-center justify-between border-b pb-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText v-if="isColaborador" :size="24" />
            <CalendarCheck v-else :size="24" />
          </div>
          <div>
            <h2 class="text-xl font-bold">
              {{ isColaborador ? 'Solicitar Documento / Atendimento' : 'Nova Solicitação de RH/DP/TI' }}
            </h2>
            <p class="text-xs text-muted-foreground">
              {{ isColaborador ? 'Preencha seu nome e os detalhes do documento ou serviço que você precisa.' : 'Abra uma nova solicitação para análise e aprovação das equipes.' }}
            </p>
          </div>
        </div>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Error Alert -->
      <div v-if="error" class="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive font-medium">
        <AlertCircle :size="18" />
        <span>{{ error }}</span>
      </div>

      <!-- Form (Colaborador Mode - Streamlined) -->
      <form v-if="isColaborador" class="mt-6 space-y-5" @submit.prevent="handleSubmit">
        <!-- Badge indicativo de autoatendimento -->
        <div class="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
          <UserCheck :size="16" />
          <span>Modo Autoatendimento: Apenas seu nome e a descrição são necessários!</span>
        </div>

        <!-- Nome da Solicitante -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Nome do Solicitante
          </label>
          <input
            v-model="customEmployeeName"
            type="text"
            placeholder="Escreva seu nome completo"
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <!-- Tipo da Solicitação / Documento -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Tipo de Documento ou Serviço
          </label>
          <select
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
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Descrição e Detalhes
          </label>
          <textarea
            v-model="description"
            rows="4"
            placeholder="Escreva aqui os detalhes da sua solicitação (Ex: Preciso de uma declaração de vínculo empregatício com finalidade de financiamento bancário)..."
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            required
          />
        </div>

        <!-- Footer Buttons -->
        <div class="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            class="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="rounded-xl py-2.5 px-6 text-sm font-bold text-primary-foreground shadow transition-transform hover:-translate-y-0.5"
            style="background-color: var(--color-primary)"
          >
            Enviar Solicitação
          </button>
        </div>
      </form>

      <!-- Form (Gestor / Administrative Mode: RH / DP / TI) -->
      <form v-else class="mt-6 space-y-5" @submit.prevent="handleSubmit">
        <!-- Colaborador Select -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Colaborador Solicitante</label>
          <select
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
            <label class="block text-xs font-medium text-muted-foreground mb-1">Nome Completo</label>
            <input v-model="customEmployeeName" type="text" placeholder="Ex: Roberto Alves" class="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">Cargo</label>
            <input v-model="customEmployeeRole" type="text" placeholder="Ex: Analista de Vendas" class="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">Departamento</label>
            <select v-model="customDepartment" class="w-full rounded-lg border bg-background px-3 py-2 text-sm">
              <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Tipo de Solicitação -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tipo da Solicitação</label>
            <select
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
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Prioridade / Urgência</label>
            <select
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
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Título Resumido</label>
          <input
            v-model="title"
            type="text"
            placeholder="Ex: Emissão de Contra-Cheque 08/2026 / Solicitação de Férias"
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <!-- Período / Valor / Competência Condicionais -->
        <div v-if="type === 'contracheque'">
          <label class="block text-xs font-medium text-muted-foreground mb-1">Mês/Ano de Competência</label>
          <select v-model="referenceMonth" class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium cursor-pointer" @change="onTypeChange">
            <option value="08/2026">08/2026 (Mês Atual)</option>
            <option value="07/2026">07/2026</option>
            <option value="06/2026">06/2026</option>
            <option value="05/2026">05/2026</option>
            <option value="13º/2025">13º Salário / 2025</option>
          </select>
        </div>

        <div v-if="type === 'ferias' || type === 'atestado' || type === 'ponto'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">Data de Início</label>
            <input v-model="startDate" type="date" class="w-full rounded-xl border bg-background px-3.5 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">Data de Término</label>
            <input v-model="endDate" type="date" class="w-full rounded-xl border bg-background px-3.5 py-2 text-sm" />
          </div>
        </div>

        <div v-if="type === 'reembolso'">
          <label class="block text-xs font-medium text-muted-foreground mb-1">Valor Solicitado (R$)</label>
          <input v-model="amount" type="text" placeholder="Ex: 350,00" class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium" />
        </div>

        <!-- Descrição / Justificativa -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Descrição / Detalhes</label>
          <textarea
            v-model="description"
            rows="3"
            placeholder="Descreva os detalhes da solicitação, motivos ou dados relevantes..."
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <!-- Anexo File Upload -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Anexo / Comprovante (opcional)</label>
          <div class="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-background border px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted"
              @click="fileInput?.click()"
            >
              <Upload :size="16" /> Selecionar Arquivo
            </button>
            <input ref="fileInput" type="file" class="hidden" @change="onFileSelect" />
            <span class="text-xs text-muted-foreground truncate">{{ fileName }}</span>
          </div>
        </div>

        <!-- Footer Buttons -->
        <div class="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            class="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="rounded-xl py-2.5 px-6 text-sm font-semibold text-primary-foreground shadow transition-transform hover:-translate-y-0.5"
            style="background-color: var(--color-primary)"
          >
            Criar Solicitação
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

