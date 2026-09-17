<script setup lang="ts">
import { ref, watch, computed } from "vue"
import {
  FolderPlus,
  User,
  CreditCard,
  Hash,
  Briefcase,
  Building,
  Mail,
  Phone,
  Calendar,
  UserCheck,
  FileText,
  MapPin,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Save,
  Award,
  X,
  DollarSign,
  FileCheck2,
  CalendarClock,
  ShieldCheck,
  Send,
} from "lucide-vue-next"
import type { EmployeeFolder, ContractType, WorkSchedule } from "../data"
import { contractTypeConfigs, workScheduleConfigs } from "../data"
import { createEmployeeFolder, updateEmployeeFolder, employeeFolders } from "../store"
import { searchCBO, fetchCBORelacaoTrabalhistaByCPF, type CBOItem } from "../cboData"

const props = defineProps<{
  folderToEdit?: EmployeeFolder | null
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "created", id: string): void
  (e: "updated", id: string): void
}>()

const isEditing = computed(() => !!props.folderToEdit)

// Registration generator helper (geração curta ex: 101, 102)
function generateMatricula(): string {
  const count = (employeeFolders.value?.length || 0) + 1
  return String(100 + count)
}

// Convert DD/MM/YYYY to YYYY-MM-DD for date input
function toDateInputValue(val?: string): string {
  if (!val) return new Date().toISOString().split("T")[0]
  if (val.includes("/")) {
    const parts = val.split("/")
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    }
  }
  return val
}

// Basic Info State
const name = ref(props.folderToEdit?.name || "")
const cpf = ref(props.folderToEdit?.cpf || "")
const email = ref(props.folderToEdit?.email || "")
const phone = ref(props.folderToEdit?.phone || "")
const emailManuallyEdited = ref(!!props.folderToEdit?.email)

// Envio de Credenciais por E-mail via SMTP (O RH não visualiza a senha do colaborador)
const sendAccessEmail = ref(true)

// CBO Autocomplete & ConectaGov API State
const cbo = ref(props.folderToEdit?.cbo || "")
const cboTitle = ref(props.folderToEdit?.cboTitle || "")
const cboSearchQuery = ref(
  props.folderToEdit?.cbo
    ? `${props.folderToEdit.cbo} - ${props.folderToEdit.cboTitle || ""}`
    : ""
)
const cboSuggestions = ref<CBOItem[]>([])
const isCboDropdownOpen = ref(false)
const selectedCboIndex = ref(-1)
const isSearchingCbo = ref(false)
const isSearchingConectaGov = ref(false)
const conectaGovStatus = ref<"idle" | "loading" | "found" | "error">("idle")
const conectaGovMessage = ref("")

// Job / Registration State
const registration = ref(props.folderToEdit?.registration || generateMatricula())
const isRegGenerated = ref(false)
const role = ref(props.folderToEdit?.role || "Analista")
const department = ref(props.folderToEdit?.department || "Recursos Humanos")
const admissionDate = ref(toDateInputValue(props.folderToEdit?.admissionDate))
const salary = ref(props.folderToEdit?.salary || "R$ 6.500,00")
const manager = ref(props.folderToEdit?.manager || "Gestão RH")
const contractType = ref<ContractType>(
  props.folderToEdit?.contractType || "prazo_indeterminado"
)
const workSchedule = ref<WorkSchedule>(
  props.folderToEdit?.workSchedule || "escala_5x2"
)
const status = ref<"ativo" | "ferias" | "afastado">(
  props.folderToEdit?.status === "desligado" ? "ativo" : props.folderToEdit?.status || "ativo"
)
const notes = ref(props.folderToEdit?.notes || "")

async function searchConectaGovCbo() {
  const cleanCpf = cpf.value.replace(/\D/g, "")
  if (cleanCpf.length !== 11) {
    conectaGovStatus.value = "error"
    conectaGovMessage.value = "Informe um CPF válido com 11 dígitos para consultar no ConectaGov."
    return
  }

  isSearchingConectaGov.value = true
  conectaGovStatus.value = "loading"
  conectaGovMessage.value = "Consultando CBO e vínculo na API ConectaGov (Serpro)..."

  try {
    const res = await fetchCBORelacaoTrabalhistaByCPF(cleanCpf)
    if (res.ok && res.relacoes && res.relacoes.length > 0) {
      const mainRel = res.relacoes[0]
      cbo.value = mainRel.cboCode
      cboTitle.value = mainRel.cboTitle
      cboSearchQuery.value = `${mainRel.cboCode} - ${mainRel.cboTitle}`

      if (mainRel.role) {
        role.value = mainRel.role
      }

      if (mainRel.admissionDate) {
        admissionDate.value = toDateInputValue(mainRel.admissionDate)
      }

      if (mainRel.family) {
        if (mainRel.family.includes("Tecnologia")) department.value = "Tecnologia"
        else if (mainRel.family.includes("Recursos Humanos")) department.value = "Recursos Humanos"
        else if (mainRel.family.includes("Marketing")) department.value = "Marketing"
        else if (mainRel.family.includes("Vendas") || mainRel.family.includes("Comercial")) department.value = "Vendas"
        else if (mainRel.family.includes("Finanças") || mainRel.family.includes("Contabilidade")) department.value = "Financeiro"
        else if (mainRel.family.includes("Administração")) department.value = "Administrativo"
      }

      if (mainRel.employerName) {
        notes.value = `Dados vinculados via ConectaGov Serpro. Empregador: ${mainRel.employerName}${mainRel.employerCnpj ? ' (' + mainRel.employerCnpj + ')' : ''}. Vínculo: ${mainRel.vinculoType || 'CLT'}.`
      }

      conectaGovStatus.value = "found"
      conectaGovMessage.value = `CBO ${mainRel.cboCode} (${mainRel.cboTitle}) importado do ConectaGov.`
    } else {
      conectaGovStatus.value = "error"
      conectaGovMessage.value = "Nenhum vínculo ou CBO encontrado para o CPF informado."
    }
  } catch (err: any) {
    conectaGovStatus.value = "error"
    conectaGovMessage.value = err.message || "Erro ao consultar a API do ConectaGov."
  } finally {
    isSearchingConectaGov.value = false
  }
}

// CBO Methods
function onCboInput(e: Event) {
  const target = e.target as HTMLInputElement
  cboSearchQuery.value = target.value
  const q = target.value.trim()

  if (q.length >= 2) {
    isSearchingCbo.value = true
    cboSuggestions.value = searchCBO(q, 15)
    isCboDropdownOpen.value = true
    selectedCboIndex.value = -1
    isSearchingCbo.value = false
  } else {
    cboSuggestions.value = []
    isCboDropdownOpen.value = false
    selectedCboIndex.value = -1
  }
}

function selectCBO(item: CBOItem) {
  cbo.value = item.code
  cboTitle.value = item.title
  cboSearchQuery.value = `${item.code} - ${item.title}`
  isCboDropdownOpen.value = false
  cboSuggestions.value = []
  selectedCboIndex.value = -1

  // Auto-fill role if generic or empty
  if (!role.value || role.value === "Analista" || role.value === "Colaborador") {
    role.value = item.title
  }

  // Auto-suggest department based on CBO family
  if (item.family) {
    if (item.family.includes("Tecnologia")) department.value = "Tecnologia"
    else if (item.family.includes("Recursos Humanos")) department.value = "Recursos Humanos"
    else if (item.family.includes("Marketing")) department.value = "Marketing"
    else if (item.family.includes("Vendas") || item.family.includes("Comercial")) department.value = "Vendas"
    else if (item.family.includes("Finanças") || item.family.includes("Contabilidade")) department.value = "Financeiro"
    else if (item.family.includes("Administração")) department.value = "Administrativo"
  }
}

function clearCBO() {
  cbo.value = ""
  cboTitle.value = ""
  cboSearchQuery.value = ""
  cboSuggestions.value = []
  isCboDropdownOpen.value = false
}

function onCboKeyDown(e: KeyboardEvent) {
  if (!isCboDropdownOpen.value || cboSuggestions.value.length === 0) return

  if (e.key === "ArrowDown") {
    e.preventDefault()
    selectedCboIndex.value = (selectedCboIndex.value + 1) % cboSuggestions.value.length
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    selectedCboIndex.value =
      (selectedCboIndex.value - 1 + cboSuggestions.value.length) % cboSuggestions.value.length
  } else if (e.key === "Enter") {
    if (selectedCboIndex.value >= 0 && selectedCboIndex.value < cboSuggestions.value.length) {
      e.preventDefault()
      selectCBO(cboSuggestions.value[selectedCboIndex.value])
    }
  } else if (e.key === "Escape") {
    isCboDropdownOpen.value = false
  }
}

function onCboBlur() {
  setTimeout(() => {
    isCboDropdownOpen.value = false
  }, 200)
}

// Address / ViaCEP State
const cep = ref(props.folderToEdit?.cep || "")
const street = ref(props.folderToEdit?.street || "")
const number = ref(props.folderToEdit?.number || "")
const complement = ref(props.folderToEdit?.complement || "")
const neighborhood = ref(props.folderToEdit?.neighborhood || "")
const city = ref(props.folderToEdit?.city || "")
const state = ref(props.folderToEdit?.state || "")
const isSearchingCep = ref(false)
const cepStatus = ref<"idle" | "loading" | "found" | "error">(
  props.folderToEdit?.city ? "found" : "idle"
)
const cepMessage = ref(
  props.folderToEdit?.city && props.folderToEdit?.state
    ? `${props.folderToEdit.city} - ${props.folderToEdit.state}`
    : ""
)

// Auto-suggest corporate email from employee name if not manually edited
watch(name, (newName) => {
  if (!emailManuallyEdited.value && !isEditing.value) {
    const clean = newName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(".")
    email.value = clean ? `${clean}@empresa.com` : ""
  }
})

function onEmailInput() {
  emailManuallyEdited.value = true
}

// CPF Formatting & Mask
function formatCpf(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function handleCpfInput(e: Event) {
  const input = e.target as HTMLInputElement
  cpf.value = formatCpf(input.value)
  const cleanCpf = cpf.value.replace(/\D/g, "")
  if (cleanCpf.length === 11 && conectaGovStatus.value !== "found" && !isSearchingConectaGov.value) {
    searchConectaGovCbo()
  }
}

// Phone Formatting & Mask
function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function handlePhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  phone.value = formatPhone(input.value)
}

// Salary Currency Mask & Formatting (ex: R$ 6.500,00)
function formatSalaryCurrency(val: string): string {
  const digits = val.replace(/\D/g, "")
  if (!digits) return ""
  const numberVal = parseFloat(digits) / 100
  return numberVal.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function handleSalaryInput(e: Event) {
  const input = e.target as HTMLInputElement
  salary.value = formatSalaryCurrency(input.value)
}

// Registration Generator Action
function handleGenerateRegistration() {
  registration.value = generateMatricula()
  isRegGenerated.value = true
  setTimeout(() => {
    isRegGenerated.value = false
  }, 2000)
}

// CEP Formatting & Mask
function formatCep(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

async function searchCep() {
  const cleanCep = cep.value.replace(/\D/g, "")
  if (cleanCep.length !== 8) {
    if (cleanCep.length > 0) {
      cepStatus.value = "error"
      cepMessage.value = "O CEP precisa conter 8 dígitos numéricos."
    }
    return
  }

  isSearchingCep.value = true
  cepStatus.value = "loading"
  cepMessage.value = "Consultando endereço no ViaCEP..."

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
    if (!res.ok) throw new Error("Erro na requisição ao ViaCEP")

    const data = await res.json()

    if (data.erro) {
      cepStatus.value = "error"
      cepMessage.value = "CEP não encontrado na base dos Correios. Por favor, preencha manualmente."
    } else {
      street.value = data.logradouro || ""
      neighborhood.value = data.bairro || ""
      city.value = data.localidade || ""
      state.value = data.uf || ""
      cepStatus.value = "found"
      cepMessage.value = `${data.localidade} - ${data.uf} (${data.bairro || "Bairro localizado"})`

      // Auto-focus number field for seamless UX
      setTimeout(() => {
        const numEl = document.getElementById("address-number") as HTMLInputElement | null
        if (numEl) numEl.focus()
      }, 100)
    }
  } catch (_err) {
    cepStatus.value = "error"
    cepMessage.value = "Não foi possível conectar ao ViaCEP. Preencha o endereço manualmente."
  } finally {
    isSearchingCep.value = false
  }
}

function handleCepInput(e: Event) {
  const input = e.target as HTMLInputElement
  cep.value = formatCep(input.value)
  const cleanCep = cep.value.replace(/\D/g, "")
  if (cleanCep.length === 8) {
    searchCep()
  } else {
    cepStatus.value = "idle"
    cepMessage.value = ""
  }
}

function getInitials(str: string) {
  const parts = str.trim().split(" ")
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return str.slice(0, 2).toUpperCase() || "RH"
}

async function submit() {
  if (!name.value.trim() || !cpf.value.trim()) return
  const initials = getInitials(name.value)
  const reg = registration.value.trim() || generateMatricula()
  const formattedDate = admissionDate.value.includes("-")
    ? admissionDate.value.split("-").reverse().join("/")
    : admissionDate.value

  // Format full address for location preview
  let loc = "São Paulo, SP"
  if (city.value && state.value) {
    if (street.value) {
      loc = `${street.value}${number.value ? ", " + number.value : ""} - ${
        neighborhood.value ? neighborhood.value + ", " : ""
      }${city.value}/${state.value}`
    } else {
      loc = `${city.value}, ${state.value}`
    }
  }

  if (props.folderToEdit) {
    await updateEmployeeFolder(props.folderToEdit.id, {
      name: name.value.trim(),
      initials,
      cpf: cpf.value.trim(),
      registration: reg,
      role: role.value.trim() || "Colaborador",
      department: department.value.trim() || "Recursos Humanos",
      email: email.value.trim() || `${name.value.toLowerCase().replace(/\s+/g, ".")}@empresa.com`,
      phone: phone.value.trim() || "+55 11 99999-0000",
      manager: manager.value.trim() || "Diretoria RH",
      admissionDate: formattedDate,
      status: status.value,
      notes: notes.value.trim() || "Pasta atualizada.",
      location: loc,
      cep: cep.value,
      street: street.value,
      number: number.value,
      complement: complement.value,
      neighborhood: neighborhood.value,
      city: city.value,
      state: state.value,
      cbo: cbo.value,
      cboTitle: cboTitle.value,
      salary: salary.value.trim() || "R$ 6.500,00",
      contractType: contractType.value,
      workSchedule: workSchedule.value,
    })

    emit("updated", props.folderToEdit.id)
    emit("close")
  } else {
    const created = await createEmployeeFolder({
      name: name.value.trim(),
      initials,
      cpf: cpf.value.trim(),
      registration: reg,
      role: role.value.trim() || "Colaborador",
      department: department.value.trim() || "Recursos Humanos",
      email: email.value.trim() || `${name.value.toLowerCase().replace(/\s+/g, ".")}@empresa.com`,
      phone: phone.value.trim() || "+55 11 99999-0000",
      manager: manager.value.trim() || "Diretoria RH",
      admissionDate: formattedDate,
      status: status.value,
      notes: notes.value.trim() || "Pasta criada via Central de Colaboradores.",
      location: loc,
      cep: cep.value,
      street: street.value,
      number: number.value,
      complement: complement.value,
      neighborhood: neighborhood.value,
      city: city.value,
      state: state.value,
      cbo: cbo.value,
      cboTitle: cboTitle.value,
      salary: salary.value.trim() || "R$ 6.500,00",
      contractType: contractType.value,
      workSchedule: workSchedule.value,
      sendEmail: sendAccessEmail.value,
    })

    emit("created", created.id)
    emit("close")
  }
}
</script>

<template>
  <div class="w-full max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
    <!-- Top Navigation / Header da Criação ou Edição em Página -->
    <div class="flex items-center justify-between border-b pb-4">
      <div>
        <button
          type="button"
          class="inline-flex items-center gap-2 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-500/10 hover:bg-teal-500/20 px-3.5 py-2 rounded-xl mb-3 transition-all group cursor-pointer"
          @click="emit('close')"
        >
          <ArrowLeft :size="16" class="transition-transform group-hover:-translate-x-1" />
          <span>{{ isEditing ? 'Voltar para os detalhes do colaborador' : 'Voltar para lista de colaboradores' }}</span>
        </button>
        <div class="flex items-center gap-3">
          <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 font-bold">
            <Save v-if="isEditing" :size="22" />
            <FolderPlus v-else :size="22" />
          </span>
          <div>
            <h2 class="text-xl font-bold tracking-tight text-foreground">
              {{ isEditing ? `Editar Colaborador — ${folderToEdit?.name}` : 'Nova Pasta de Colaborador' }}
            </h2>
            <p class="text-xs text-muted-foreground">
              {{ isEditing ? 'Atualize as informações cadastrais.' : 'Cadastre a ficha cadastral completa.' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Formulário Organizado em Seções Integradas -->
    <form @submit.prevent="submit" class="space-y-6">
      
      <!-- SEÇÃO 1: DADOS PESSOAIS & IDENTIFICAÇÃO -->
      <div class="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div class="flex items-center gap-2 border-b pb-3">
          <User :size="18" class="text-teal-600" />
          <h3 class="font-bold text-sm text-foreground">1. Identificação & Contato do Colaborador</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Nome Completo -->
          <div class="md:col-span-2 lg:col-span-2">
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Nome Completo do Colaborador <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <User :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="name"
                type="text"
                required
                placeholder="ex: Carlos Eduardo dos Santos"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <!-- CPF Formatado com Busca ConectaGov -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                CPF <span class="text-red-500">*</span>
              </label>
              <span v-if="cpf.length === 14" class="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 :size="12" /> Formatado
              </span>
            </div>
            <div class="flex rounded-xl border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 transition-all">
              <div class="flex items-center pl-3 pr-1 text-muted-foreground">
                <CreditCard :size="16" />
              </div>
              <input
                :value="cpf"
                @input="handleCpfInput"
                type="text"
                required
                maxlength="14"
                placeholder="000.000.000-00"
                class="w-full font-mono py-2.5 pr-2 text-sm bg-transparent outline-none"
              />
              <button
                type="button"
                class="px-3 border-l bg-teal-500/10 hover:bg-teal-500/20 text-xs font-bold text-teal-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                :disabled="isSearchingConectaGov"
                @click="searchConectaGovCbo"
                title="Consultar CBO e Relação Trabalhista no ConectaGov Serpro"
              >
                <Loader2 v-if="isSearchingConectaGov" :size="13" class="animate-spin text-teal-600" />
                <Sparkles v-else :size="13" class="text-teal-600" />
                <span>Buscar CBO</span>
              </button>
            </div>
          </div>

          <!-- Telefone / WhatsApp com Formatação -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Telefone / WhatsApp <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                :value="phone"
                @input="handlePhoneInput"
                type="text"
                required
                maxlength="15"
                placeholder="(11) 98888-0000"
                class="w-full font-mono rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <!-- E-mail Institucional / Login de Acesso -->
          <div :class="isEditing ? 'md:col-span-2' : ''">
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              E-mail Institucional (Login de Acesso) <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <Mail :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="email"
                @input="onEmailInput"
                type="email"
                required
                placeholder="carlos.santos@empresa.com"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>
        </div>

        <!-- Card de Disparo SMTP sem exibição de senha para o RH (Confidencialidade & LGPD) -->
        <div v-if="!isEditing" class="rounded-xl border border-teal-500/30 bg-teal-50/70 dark:bg-teal-950/20 p-4 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-500/15 pb-2.5">
            <div class="flex items-center gap-2 text-teal-900 dark:text-teal-200">
              <ShieldCheck :size="18" class="text-teal-600 shrink-0" />
              <span class="text-xs font-bold">Geração Automática de Credenciais & Envio via SMTP</span>
            </div>
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 self-start sm:self-auto">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Servidor SMTP Conectado
            </span>
          </div>

          <div class="flex items-start gap-2.5 text-xs text-teal-900/80 dark:text-teal-200/80">
            <p class="leading-relaxed text-[11px]">
              🔒 <strong>Confidencialidade & LGPD:</strong> O RH <strong>não visualiza</strong> a senha do colaborador. Ao salvar esta pasta funcional, o sistema gera automaticamente uma senha temporária criptografada de alta segurança e dispara um e-mail com as orientações de login diretamente para:
              <span class="font-bold text-foreground underline decoration-teal-500/60">{{ email || 'o e-mail do colaborador' }}</span>.
            </p>
          </div>

          <div class="pt-1 flex items-center justify-between">
            <label class="flex items-center gap-2 text-xs font-semibold text-teal-900 dark:text-teal-100 cursor-pointer select-none">
              <input
                v-model="sendAccessEmail"
                type="checkbox"
                class="rounded border-teal-400 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
              />
              <span class="flex items-center gap-1.5">
                <Send :size="13" class="text-teal-600" />
                Disparar e-mail de boas-vindas com a senha inicial via SMTP
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- SEÇÃO 2: MATRÍCULA & VÍNCULO CORPORATIVO + CBO -->
      <div class="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div class="flex items-center gap-2">
            <Briefcase :size="18" class="text-teal-600" />
            <h3 class="font-bold text-sm text-foreground">2. Matrícula & Vínculo Profissional</h3>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              :disabled="isSearchingConectaGov"
              @click="searchConectaGovCbo"
              title="Consultar CBO e Relação Trabalhista por CPF na API ConectaGov / Serpro"
            >
              <Loader2 v-if="isSearchingConectaGov" :size="13" class="animate-spin" />
              <Sparkles v-else :size="13" />
              <span>{{ isSearchingConectaGov ? 'Consultando ConectaGov...' : 'Buscar CBO via CPF (ConectaGov API)' }}</span>
            </button>
          </div>
        </div>

        <!-- Banner de Status da Consulta ConectaGov API -->
        <div
          v-if="conectaGovStatus !== 'idle'"
          class="text-xs p-2.5 rounded-xl flex items-center justify-between transition-all"
          :class="
            conectaGovStatus === 'found'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : conectaGovStatus === 'loading'
              ? 'bg-sky-50 text-sky-800 border border-sky-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          "
        >
          <div class="flex items-center gap-2">
            <Loader2 v-if="conectaGovStatus === 'loading'" :size="14" class="animate-spin text-sky-600" />
            <CheckCircle2 v-else-if="conectaGovStatus === 'found'" :size="14" class="text-emerald-600" />
            <AlertCircle v-else :size="14" class="text-rose-600" />
            <span class="font-medium">{{ conectaGovMessage }}</span>
          </div>
          <span class="text-[10px] font-mono uppercase bg-background/80 px-2 py-0.5 rounded border">API Serpro Gateway</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Campo com Autocomplete Dinâmico da CBO -->
          <div class="sm:col-span-2 lg:col-span-2 relative">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Classificação Brasileira de Ocupações (CBO)
              </label>
              <span v-if="cbo" class="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 :size="12" /> CBO: <span class="font-mono font-bold">{{ cbo }}</span>
              </span>
              <span v-else class="text-[11px] text-muted-foreground">
                Digite código ou nome da ocupação (mín. 2 letras)
              </span>
            </div>

            <div class="relative">
              <Award :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                :value="cboSearchQuery"
                @input="onCboInput"
                @keydown="onCboKeyDown"
                @focus="cboSearchQuery.length >= 2 && (isCboDropdownOpen = true)"
                @blur="onCboBlur"
                type="text"
                autocomplete="off"
                placeholder="Buscar CBO por código (ex: 2124-05) ou ocupação (ex: Analista de sistemas, RH...)"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-10 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
              <button
                v-if="cboSearchQuery"
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded transition-colors cursor-pointer"
                @click="clearCBO"
                title="Limpar CBO"
              >
                <X :size="14" />
              </button>
            </div>

            <!-- Dropdown Flutuante com Sugestões CBO -->
            <div
              v-if="isCboDropdownOpen"
              class="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-card p-1.5 shadow-2xl scrollbar-thin animate-in fade-in zoom-in-95 duration-150"
            >
              <div v-if="cboSuggestions.length === 0" class="p-4 text-center text-xs text-muted-foreground">
                <p class="font-medium text-foreground">Nenhuma ocupação CBO encontrada para "{{ cboSearchQuery }}".</p>
                <p class="mt-1 text-[11px]">Você pode continuar preenchendo o cargo manualmente ao lado.</p>
              </div>

              <div v-else class="space-y-1">
                <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between border-b pb-1">
                  <span>Ocupações CBO Sugeridas ({{ cboSuggestions.length }})</span>
                  <span>Use ↑ ↓ e Enter</span>
                </div>

                <button
                  v-for="(item, idx) in cboSuggestions"
                  :key="item.code"
                  type="button"
                  class="w-full text-left rounded-lg p-2.5 transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                  :class="idx === selectedCboIndex ? 'bg-teal-500/15 border-teal-500/30' : 'hover:bg-muted'"
                  @mousedown.prevent="selectCBO(item)"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-bold text-teal-700 bg-teal-500/10 px-2 py-0.5 rounded">
                        {{ item.code }}
                      </span>
                      <span class="text-xs font-bold text-foreground truncate">{{ item.title }}</span>
                    </div>
                    <div class="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span class="rounded bg-muted px-1.5 py-0.5">{{ item.family }}</span>
                      <span v-if="item.synonyms?.length" class="truncate">
                        Sinônimos: {{ item.synonyms.slice(0, 2).join(', ') }}
                      </span>
                    </div>
                  </div>

                  <span class="text-xs font-semibold text-teal-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1">
                    Selecionar <CheckCircle2 :size="14" />
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Matrícula com Botão de Geração Automática -->
          <div class="lg:col-span-1">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Matrícula Corporativa
              </label>
              <button
                type="button"
                class="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-teal-50 cursor-pointer"
                @click="handleGenerateRegistration"
                title="Clique para gerar uma nova matrícula automática"
              >
                <Sparkles :size="12" class="text-teal-600 animate-spin-slow" />
                <span>{{ isRegGenerated ? 'Matrícula Gerada!' : 'Gerar Matrícula' }}</span>
              </button>
            </div>

            <div class="flex rounded-xl border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
              <div class="flex items-center pl-3 pr-2 text-muted-foreground">
                <Hash :size="16" />
              </div>
              <input
                v-model="registration"
                type="text"
                placeholder="ex: 101"
                class="w-full font-mono py-2.5 pr-2 text-sm bg-transparent outline-none font-semibold text-teal-900"
              />
              <button
                type="button"
                class="px-3 border-l bg-muted/40 hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                @click="handleGenerateRegistration"
              >
                <Sparkles :size="13" class="text-teal-600" />
                <span class="hidden sm:inline">Auto</span>
              </button>
            </div>
          </div>

          <!-- Cargo / Função -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cargo / Função</label>
            <div class="relative">
              <Briefcase :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="role"
                type="text"
                placeholder="ex: Engenheiro de Software Pleno"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <!-- Departamento -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Departamento</label>
            <div class="relative">
              <Building :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                v-model="department"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              >
                <option value="Tecnologia">Tecnologia</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Marketing">Marketing</option>
                <option value="Vendas">Vendas</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Operações">Operações</option>
                <option value="Jurídico">Jurídico</option>
              </select>
            </div>
          </div>

          <!-- Data de Admissão -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Data de Admissão</label>
            <div class="relative">
              <Calendar :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="admissionDate"
                type="date"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <!-- Salário Bruto (R$) -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Salário Bruto (R$)</label>
            <div class="relative">
              <DollarSign :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="salary"
                @input="handleSalaryInput"
                type="text"
                placeholder="R$ 0,00"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:ring-2 transition-all font-mono"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <!-- Gestor Direto -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Gestor Direto</label>
            <div class="relative">
              <UserCheck :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="manager"
                type="text"
                placeholder="ex: Gestão de RH / Diretoria"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <!-- Status do Colaborador -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Status do Colaborador</label>
            <select
              v-model="status"
              class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option value="ativo">Ativo</option>
              <option value="ferias">Em Férias</option>
              <option value="afastado">Afastado</option>
            </select>
          </div>

          <!-- Tipo de Contrato de Trabalho -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tipo de Contrato <span class="text-red-500">*</span>
              </label>
              <span class="text-[10px] text-teal-700 font-semibold font-mono">
                {{ contractTypeConfigs[contractType]?.short }}
              </span>
            </div>
            <div class="relative">
              <FileCheck2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                v-model="contractType"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all font-medium"
                style="--tw-ring-color: var(--color-ring)"
              >
                <option v-for="(meta, key) in contractTypeConfigs" :key="key" :value="key">
                  {{ meta.label }}
                </option>
              </select>
            </div>
            <p class="mt-1 text-[10px] text-muted-foreground truncate" :title="contractTypeConfigs[contractType]?.description">
              {{ contractTypeConfigs[contractType]?.legalBasis }}
            </p>
          </div>

          <!-- Sistema de Escala no Brasil -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Escala de Trabalho <span class="text-red-500">*</span>
              </label>
              <span class="text-[10px] text-teal-700 font-semibold font-mono">
                {{ workScheduleConfigs[workSchedule]?.weeklyHours }}
              </span>
            </div>
            <div class="relative">
              <CalendarClock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                v-model="workSchedule"
                class="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 transition-all font-medium"
                style="--tw-ring-color: var(--color-ring)"
              >
                <option v-for="(meta, key) in workScheduleConfigs" :key="key" :value="key">
                  {{ meta.label }} ({{ meta.short }})
                </option>
              </select>
            </div>
            <p class="mt-1 text-[10px] text-muted-foreground truncate" :title="workScheduleConfigs[workSchedule]?.dsrRule">
              {{ workScheduleConfigs[workSchedule]?.dsrRule }}
            </p>
          </div>
        </div>
      </div>

      <!-- SEÇÃO 3: ENDEREÇO & LOCALIZAÇÃO COM VIACEP -->
      <div class="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div class="flex items-center gap-2">
            <MapPin :size="18" class="text-teal-600" />
            <h3 class="font-bold text-sm text-foreground">3. Endereço Residencial (Integração ViaCEP)</h3>
          </div>
          
          <!-- Badge de Status do ViaCEP -->
          <div class="flex items-center gap-1.5 text-xs">
            <span v-if="cepStatus === 'loading'" class="flex items-center gap-1.5 text-sky-600 font-semibold bg-sky-50 px-2.5 py-1 rounded-full">
              <Loader2 :size="13" class="animate-spin" /> Buscando no ViaCEP...
            </span>
            <span v-else-if="cepStatus === 'found'" class="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 :size="13" /> {{ cepMessage }}
            </span>
            <span v-else-if="cepStatus === 'error'" class="flex items-center gap-1.5 text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              <AlertCircle :size="13" /> {{ cepMessage }}
            </span>
            <span v-else class="text-muted-foreground text-[11px]">
              Digite o CEP para preenchimento automático
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- CEP -->
          <div class="sm:col-span-1">
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              CEP
            </label>
            <div class="flex rounded-xl border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
              <div class="flex items-center pl-3 pr-1 text-muted-foreground">
                <MapPin :size="16" />
              </div>
              <input
                :value="cep"
                @input="handleCepInput"
                type="text"
                maxlength="9"
                placeholder="00000-000"
                class="w-full font-mono py-2.5 pr-2 text-sm bg-transparent outline-none"
              />
              <button
                type="button"
                class="px-3 border-l bg-muted/40 hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                :disabled="isSearchingCep"
                @click="searchCep"
                title="Consultar CEP na API ViaCEP"
              >
                <Loader2 v-if="isSearchingCep" :size="14" class="animate-spin text-teal-600" />
                <Search v-else :size="14" class="text-teal-600" />
                <span class="hidden sm:inline">Buscar</span>
              </button>
            </div>
          </div>

          <!-- Logradouro / Rua -->
          <div class="sm:col-span-1 lg:col-span-3">
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Logradouro / Rua / Avenida
            </label>
            <input
              v-model="street"
              type="text"
              placeholder="ex: Avenida Paulista"
              class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <!-- Número -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Número
            </label>
            <input
              id="address-number"
              v-model="number"
              type="text"
              placeholder="ex: 1578"
              class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <!-- Complemento -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Complemento
            </label>
            <input
              v-model="complement"
              type="text"
              placeholder="ex: Bloco B, Apto 42"
              class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <!-- Bairro -->
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Bairro
            </label>
            <input
              v-model="neighborhood"
              type="text"
              placeholder="ex: Bela Vista"
              class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <!-- Cidade & UF -->
          <div>
            <div class="grid grid-cols-3 gap-2">
              <div class="col-span-2">
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Cidade
                </label>
                <input
                  v-model="city"
                  type="text"
                  placeholder="São Paulo"
                  class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 transition-all"
                  style="--tw-ring-color: var(--color-ring)"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  UF
                </label>
                <input
                  v-model="state"
                  type="text"
                  maxlength="2"
                  placeholder="SP"
                  class="w-full uppercase font-mono rounded-xl border bg-background py-2.5 px-2 text-center text-sm outline-none focus:ring-2 transition-all"
                  style="--tw-ring-color: var(--color-ring)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SEÇÃO 4: ANOTAÇÕES DO RH & PRONTUÁRIO -->
      <div class="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div class="flex items-center gap-2 border-b pb-3">
          <FileText :size="18" class="text-teal-600" />
          <h3 class="font-bold text-sm text-foreground">4. Anotações do RH & Observações</h3>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Observações do Prontuário Digital
          </label>
          <div class="relative">
            <textarea
              v-model="notes"
              rows="3"
              placeholder="Adicione informações relevantes sobre histórico, contratos anteriores, acordos de jornada híbrida ou pendências documentais..."
              class="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 resize-none transition-all"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>
        </div>
      </div>

      <!-- BOTÕES DE AÇÃO DO RODAPÉ -->
      <div class="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          class="w-full sm:w-auto rounded-xl border bg-card px-6 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 cursor-pointer"
          style="background-color: var(--color-primary)"
          :disabled="!name.trim() || !cpf.trim()"
        >
          <Save v-if="isEditing" :size="18" />
          <FolderPlus v-else :size="18" />
          <span>{{ isEditing ? 'Salvar Alterações' : 'Criar Pasta de Colaborador' }}</span>
        </button>
      </div>

    </form>
  </div>
</template>
