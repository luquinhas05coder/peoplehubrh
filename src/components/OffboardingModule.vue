<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  UserMinus,
  Calculator,
  ClipboardCheck,
  Laptop,
  MessageSquare,
  CheckCircle2,
  DollarSign,
  Plus,
  RefreshCw,
  FileText
} from "lucide-vue-next"
import { showToast } from "../store"

interface OffboardingItem {
  id: string
  employee_id: string
  employee_name: string
  tipo_rescisao: string
  data_aviso: string
  data_desligamento: string
  motivo: string
  status: string
  checklist_ti: number
  checklist_rh: number
  checklist_financeiro: number
  equipamentos_devolvidos: number
  severance_calculation?: string
  exit_interview?: string
}

const activeTab = ref<"processos" | "simulador" | "novo">("processos")
const isLoading = ref(true)
const offboardings = ref<OffboardingItem[]>([])
const selectedOffboarding = ref<OffboardingItem | null>(null)
const isDetailOpen = ref(false)

// Simulador de rescisão
const simSalary = ref(6500)
const simHireDate = ref("2023-03-15")
const simDismissalDate = ref("2026-10-31")
const simReason = ref("sem_justa_causa")
const simNoticeType = ref("indenizado")
const simFgtsBalance = ref(15000)
const isCalculating = ref(false)
const simResult = ref<any>(null)

// Formulário de novo desligamento
const newEmpId = ref("emp_03")
const newEmpName = ref("Gabriel Santos")
const newTipo = ref("sem_justa_causa")
const newAvisoDate = ref(new Date().toISOString().split("T")[0])
const newDesligDate = ref(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0])
const newMotivo = ref("Reestruturação da equipe / Solicitação mútua")
const isSubmitting = ref(false)

// Entrevista de saída
const exitReason = ref("melhor_proposta")
const exitFeedback = ref("Ambiente muito colaborativo e ótima liderança técnica.")
const exitRating = ref(9)
const isSavingInterview = ref(false)

async function loadOffboardings() {
  isLoading.value = true
  try {
    const res = await fetch("/api/offboarding")
    if (res.ok) {
      const data = await res.json()
      offboardings.value = data.offboardings || []
    }
  } catch (err: any) {
    showToast(`Erro ao carregar desligamentos: ${err.message}`, "error")
  } finally {
    isLoading.value = false
  }
}

async function runSeveranceSimulation() {
  isCalculating.value = true
  try {
    const res = await fetch("/api/offboarding/calculate-severance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salary: Number(simSalary.value),
        hireDate: simHireDate.value,
        dismissalDate: simDismissalDate.value,
        reason: simReason.value,
        noticeType: simNoticeType.value,
        fgtsBalance: Number(simFgtsBalance.value),
      }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      simResult.value = data.result
      showToast("Cálculo rescisório apurado com base nas regras CLT!", "success")
    } else {
      showToast(data.error || "Erro ao calcular rescisão.", "error")
    }
  } catch (err: any) {
    showToast(`Falha no cálculo: ${err.message}`, "error")
  } finally {
    isCalculating.value = false
  }
}

async function createOffboarding() {
  isSubmitting.value = true
  try {
    const res = await fetch("/api/offboarding/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: newEmpId.value,
        employeeName: newEmpName.value,
        tipoRescisao: newTipo.value,
        dataAviso: newAvisoDate.value,
        dataDesligamento: newDesligDate.value,
        motivo: newMotivo.value,
      }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      showToast("Processo de desligamento iniciado com sucesso!", "success")
      activeTab.value = "processos"
      await loadOffboardings()
    } else {
      showToast(data.error || "Erro ao criar desligamento.", "error")
    }
  } catch (err: any) {
    showToast(`Falha ao registrar: ${err.message}`, "error")
  } finally {
    isSubmitting.value = false
  }
}

async function toggleChecklist(item: OffboardingItem, area: "ti" | "rh" | "financeiro") {
  const currentVal = area === "ti" ? item.checklist_ti : area === "rh" ? item.checklist_rh : item.checklist_financeiro
  const newVal = currentVal ? 0 : 1

  try {
    const res = await fetch(`/api/offboarding/${item.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, completed: Boolean(newVal) }),
    })
    if (res.ok) {
      if (area === "ti") item.checklist_ti = newVal
      if (area === "rh") item.checklist_rh = newVal
      if (area === "financeiro") item.checklist_financeiro = newVal
      showToast(`Checklist de ${area.toUpperCase()} atualizado!`, "success")
    }
  } catch (err: any) {
    showToast(`Erro ao atualizar checklist: ${err.message}`, "error")
  }
}

async function toggleEquipment(item: OffboardingItem) {
  const newVal = item.equipamentos_devolvidos ? 0 : 1
  try {
    const res = await fetch(`/api/offboarding/${item.id}/equipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returned: Boolean(newVal) }),
    })
    if (res.ok) {
      item.equipamentos_devolvidos = newVal
      showToast("Status de devolução de ativos atualizado!", "success")
    }
  } catch (err: any) {
    showToast(`Erro ao atualizar ativos: ${err.message}`, "error")
  }
}

async function saveExitInterview(offboardingId: string) {
  isSavingInterview.value = true
  try {
    const res = await fetch(`/api/offboarding/${offboardingId}/exit-interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mainReason: exitReason.value,
        feedback: exitFeedback.value,
        companyRating: Number(exitRating.value),
      }),
    })
    if (res.ok) {
      showToast("Entrevista de saída registrada com sucesso!", "success")
      isDetailOpen.value = false
      await loadOffboardings()
    }
  } catch (err: any) {
    showToast(`Erro ao salvar entrevista: ${err.message}`, "error")
  } finally {
    isSavingInterview.value = false
  }
}

function formatCurrency(val?: number) {
  if (typeof val !== "number") return "R$ 0,00"
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

onMounted(() => {
  loadOffboardings()
  runSeveranceSimulation()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
      <div>
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <UserMinus :size="24" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">Desligamento & Offboarding</h1>
            <p class="text-xs text-muted-foreground">
              Checklists operacionais, cálculo rescisório CLT e entrevistas de desligamento
            </p>
          </div>
        </div>
      </div>

      <!-- Abas de Navegação -->
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border text-xs">
        <button
          type="button"
          @click="activeTab = 'processos'"
          :class="activeTab === 'processos' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
        >
          Processos Ativos
        </button>
        <button
          type="button"
          @click="activeTab = 'simulador'"
          :class="activeTab === 'simulador' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Calculator :size="13" />
          Simulador CLT
        </button>
        <button
          type="button"
          @click="activeTab = 'novo'"
          :class="activeTab === 'novo' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Plus :size="13" />
          Iniciar Saída
        </button>
      </div>
    </div>

    <!-- 1. TAB: PROCESSOS ATIVOS -->
    <div v-if="activeTab === 'processos'" class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck :size="16" class="text-teal-500" />
          Desligamentos em Trâmite
        </h3>
        <button
          type="button"
          @click="loadOffboardings"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': isLoading }" />
          Atualizar
        </button>
      </div>

      <div v-if="isLoading" class="text-center py-16 text-muted-foreground">
        <RefreshCw :size="24" class="animate-spin mx-auto mb-2 text-teal-500" />
        <span class="text-xs">Carregando processos de offboarding...</span>
      </div>

      <div v-else-if="offboardings.length === 0" class="text-center py-16 text-muted-foreground rounded-2xl border bg-card/40">
        <CheckCircle2 :size="36" class="mx-auto text-emerald-500 mb-2" />
        <p class="text-sm font-semibold">Nenhum processo de desligamento em aberto no momento.</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-3">
        <div
          v-for="off in offboardings"
          :key="off.id"
          class="p-4 rounded-2xl border bg-card hover:border-border/80 transition-all space-y-3"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-foreground">{{ off.employee_name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  {{ off.tipo_rescisao.replace(/_/g, ' ') }}
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                  Status: {{ off.status }}
                </span>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                Data do Desligamento: <strong>{{ off.data_desligamento }}</strong> · Aviso: {{ off.data_aviso }}
              </p>
            </div>

            <button
              type="button"
              @click="selectedOffboarding = off; isDetailOpen = true"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-muted transition-colors cursor-pointer self-start sm:self-center"
            >
              Entrevista & Detalhes
            </button>
          </div>

          <!-- Checklists Operacionais -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <button
              type="button"
              @click="toggleChecklist(off, 'ti')"
              class="p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer"
              :class="off.checklist_ti ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-muted/40 text-muted-foreground'"
            >
              <span class="flex items-center gap-1.5 font-medium">
                <Laptop :size="14" /> TI: Acessos
              </span>
              <CheckCircle2 v-if="off.checklist_ti" :size="14" class="text-emerald-600" />
              <span v-else class="text-[10px]">Pendente</span>
            </button>

            <button
              type="button"
              @click="toggleChecklist(off, 'rh')"
              class="p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer"
              :class="off.checklist_rh ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-muted/40 text-muted-foreground'"
            >
              <span class="flex items-center gap-1.5 font-medium">
                <ClipboardCheck :size="14" /> RH: Exame Dem.
              </span>
              <CheckCircle2 v-if="off.checklist_rh" :size="14" class="text-emerald-600" />
              <span v-else class="text-[10px]">Pendente</span>
            </button>

            <button
              type="button"
              @click="toggleChecklist(off, 'financeiro')"
              class="p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer"
              :class="off.checklist_financeiro ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-muted/40 text-muted-foreground'"
            >
              <span class="flex items-center gap-1.5 font-medium">
                <DollarSign :size="14" /> DP: TRCT & FGTS
              </span>
              <CheckCircle2 v-if="off.checklist_financeiro" :size="14" class="text-emerald-600" />
              <span v-else class="text-[10px]">Pendente</span>
            </button>

            <button
              type="button"
              @click="toggleEquipment(off)"
              class="p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer"
              :class="off.equipamentos_devolvidos ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-muted/40 text-muted-foreground'"
            >
              <span class="flex items-center gap-1.5 font-medium">
                <Laptop :size="14" /> Ativos Devolvidos
              </span>
              <CheckCircle2 v-if="off.equipamentos_devolvidos" :size="14" class="text-emerald-600" />
              <span v-else class="text-[10px]">Pendente</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. TAB: SIMULADOR DE RESCISÃO CLT -->
    <div v-if="activeTab === 'simulador'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1 p-5 rounded-2xl border bg-card space-y-4">
        <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
          <Calculator :size="16" class="text-teal-500" />
          Parâmetros Contratuais
        </h3>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Último Salário Base (R$):</label>
            <input
              v-model="simSalary"
              type="number"
              class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Tipo de Rescisão CLT:</label>
            <select
              v-model="simReason"
              class="w-full px-3 py-2 rounded-xl border bg-background text-xs cursor-pointer focus:ring-2 focus:ring-teal-500"
            >
              <option value="sem_justa_causa">Demissão sem justa causa (pelo empregador)</option>
              <option value="com_justa_causa">Demissão com justa causa</option>
              <option value="pedido_demissao">Pedido de demissão (pelo empregado)</option>
              <option value="acordo_mutuo">Acordo Mútuo (Art. 484-A CLT)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Aviso Prévio:</label>
            <select
              v-model="simNoticeType"
              class="w-full px-3 py-2 rounded-xl border bg-background text-xs cursor-pointer focus:ring-2 focus:ring-teal-500"
            >
              <option value="indenizado">Indenizado pelo Empregador</option>
              <option value="trabalhado">Trabalhado</option>
              <option value="dispensado">Dispensado</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-semibold text-muted-foreground mb-1">Data Admissão:</label>
              <input
                v-model="simHireDate"
                type="date"
                class="w-full px-2 py-1.5 rounded-xl border bg-background text-xs"
              />
            </div>
            <div>
              <label class="block font-semibold text-muted-foreground mb-1">Data Demissão:</label>
              <input
                v-model="simDismissalDate"
                type="date"
                class="w-full px-2 py-1.5 rounded-xl border bg-background text-xs"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Saldo da Conta FGTS (para cálculo da multa):</label>
            <input
              v-model="simFgtsBalance"
              type="number"
              class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="button"
            @click="runSeveranceSimulation"
            :disabled="isCalculating"
            class="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw v-if="isCalculating" :size="14" class="animate-spin" />
            <Calculator v-else :size="14" />
            Calcular Verbas Rescisórias CLT
          </button>
        </div>
      </div>

      <!-- Resultado Detalhado da Rescisão -->
      <div class="lg:col-span-2 p-5 rounded-2xl border bg-card space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText :size="16" class="text-teal-500" />
            Demonstrativo de Verbas Rescisórias
          </h3>
          <span class="text-xs text-muted-foreground">
            Conforme Lei 13.467/2017 & CLT
          </span>
        </div>

        <div v-if="!simResult" class="text-center py-20 text-muted-foreground text-xs">
          Preencha os parâmetros e clique em calcular para visualizar o demonstrativo.
        </div>

        <div v-else class="space-y-4 text-xs">
          <!-- Card Totalizadores -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-3.5 rounded-xl border bg-emerald-500/10 text-emerald-900 dark:text-emerald-300">
              <span class="text-[11px] font-semibold text-muted-foreground block">Total Bruto de Proventos:</span>
              <strong class="text-lg font-bold">{{ formatCurrency(simResult.totalBruto) }}</strong>
            </div>

            <div class="p-3.5 rounded-xl border bg-rose-500/10 text-rose-900 dark:text-rose-300">
              <span class="text-[11px] font-semibold text-muted-foreground block">Descontos Legais (INSS/IRRF):</span>
              <strong class="text-lg font-bold">{{ formatCurrency(simResult.descontos?.inss + simResult.descontos?.irrf) }}</strong>
            </div>

            <div class="p-3.5 rounded-xl border bg-teal-600 text-white shadow-md">
              <span class="text-[11px] font-medium opacity-80 block">Valor Líquido Rescisório:</span>
              <strong class="text-lg font-black">{{ formatCurrency(simResult.totalLiquido) }}</strong>
            </div>
          </div>

          <!-- Tabela de Verbas -->
          <div class="rounded-xl border overflow-hidden">
            <table class="w-full text-left">
              <thead class="bg-muted text-muted-foreground text-[11px] uppercase">
                <tr>
                  <th class="p-3">Verba Rescisória</th>
                  <th class="p-3">Referência</th>
                  <th class="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr>
                  <td class="p-3 font-medium">Saldo de Salário</td>
                  <td class="p-3 text-muted-foreground">{{ simResult.proventos?.saldoSalario?.dias }} dias</td>
                  <td class="p-3 text-right font-bold text-foreground">{{ formatCurrency(simResult.proventos?.saldoSalario?.valor) }}</td>
                </tr>
                <tr>
                  <td class="p-3 font-medium">Aviso Prévio Indenizado</td>
                  <td class="p-3 text-muted-foreground">{{ simResult.proventos?.avisoPrevio?.dias }} dias</td>
                  <td class="p-3 text-right font-bold text-foreground">{{ formatCurrency(simResult.proventos?.avisoPrevio?.valor) }}</td>
                </tr>
                <tr>
                  <td class="p-3 font-medium">13º Salário Proporcional</td>
                  <td class="p-3 text-muted-foreground">{{ simResult.proventos?.decimoTerceiro?.meses }}/12 avos</td>
                  <td class="p-3 text-right font-bold text-foreground">{{ formatCurrency(simResult.proventos?.decimoTerceiro?.valor) }}</td>
                </tr>
                <tr>
                  <td class="p-3 font-medium">Férias Proporcionais</td>
                  <td class="p-3 text-muted-foreground">{{ simResult.proventos?.feriasProporcionais?.meses }}/12 avos</td>
                  <td class="p-3 text-right font-bold text-foreground">{{ formatCurrency(simResult.proventos?.feriasProporcionais?.valor) }}</td>
                </tr>
                <tr>
                  <td class="p-3 font-medium">Terço Constitucional de Férias (1/3)</td>
                  <td class="p-3 text-muted-foreground">Art. 7º, XVII da CF</td>
                  <td class="p-3 text-right font-bold text-foreground">{{ formatCurrency(simResult.proventos?.tercoConstitucional) }}</td>
                </tr>
                <tr class="bg-amber-500/5">
                  <td class="p-3 font-bold text-amber-900 dark:text-amber-200">Multa Rescisória do FGTS</td>
                  <td class="p-3 text-muted-foreground">{{ simResult.fgts?.multaPercentual }}% sobre saldo</td>
                  <td class="p-3 text-right font-bold text-amber-600">{{ formatCurrency(simResult.fgts?.multaValor) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. TAB: INICIAR NOVO DESLIGAMENTO -->
    <div v-if="activeTab === 'novo'" class="max-w-xl mx-auto p-6 rounded-2xl border bg-card space-y-4">
      <h3 class="text-base font-bold text-foreground flex items-center gap-2">
        <UserMinus :size="18" class="text-rose-500" />
        Registrar Novo Processo de Saída
      </h3>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold text-muted-foreground mb-1">Nome do Colaborador:</label>
          <input
            v-model="newEmpName"
            type="text"
            class="w-full px-3 py-2 rounded-xl border bg-background text-sm"
          />
        </div>

        <div>
          <label class="block font-semibold text-muted-foreground mb-1">Tipo de Rescisão:</label>
          <select v-model="newTipo" class="w-full px-3 py-2 rounded-xl border bg-background text-xs cursor-pointer">
            <option value="sem_justa_causa">Demissão sem justa causa</option>
            <option value="com_justa_causa">Demissão com justa causa</option>
            <option value="pedido_demissao">Pedido de demissão voluntária</option>
            <option value="acordo_mutuo">Acordo mútuo (CLT)</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Data da Comunicação (Aviso):</label>
            <input v-model="newAvisoDate" type="date" class="w-full px-3 py-2 rounded-xl border bg-background text-xs" />
          </div>
          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Último Dia Trabalhado:</label>
            <input v-model="newDesligDate" type="date" class="w-full px-3 py-2 rounded-xl border bg-background text-xs" />
          </div>
        </div>

        <div>
          <label class="block font-semibold text-muted-foreground mb-1">Justificativa / Motivo Formal:</label>
          <textarea
            v-model="newMotivo"
            rows="3"
            class="w-full px-3 py-2 rounded-xl border bg-background text-xs"
          ></textarea>
        </div>

        <button
          type="button"
          @click="createOffboarding"
          :disabled="isSubmitting"
          class="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw v-if="isSubmitting" :size="14" class="animate-spin" />
          Iniciar Trâmite de Offboarding & Checklists
        </button>
      </div>
    </div>

    <!-- Modal de Entrevista de Saída -->
    <div
      v-if="isDetailOpen && selectedOffboarding"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageSquare :size="16" class="text-teal-500" />
            Entrevista de Desligamento — {{ selectedOffboarding.employee_name }}
          </h3>
          <button
            type="button"
            @click="isDetailOpen = false"
            class="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Principal Motivo da Saída:</label>
            <select v-model="exitReason" class="w-full px-3 py-2 rounded-xl border bg-background text-xs">
              <option value="melhor_proposta">Melhor proposta salarial / Benefícios</option>
              <option value="mudanca_carreira">Mudança de carreira ou área</option>
              <option value="clima_organizacional">Desafios de clima ou liderança</option>
              <option value="motivos_pessoais">Motivos pessoais / Mudança geográfica</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Nota para a Empresa (1 a 10):</label>
            <input
              v-model="exitRating"
              type="number"
              min="1"
              max="10"
              class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-bold"
            />
          </div>

          <div>
            <label class="block font-semibold text-muted-foreground mb-1">Feedback Estruturado & Pontos de Melhoria:</label>
            <textarea
              v-model="exitFeedback"
              rows="3"
              class="w-full px-3 py-2 rounded-xl border bg-background text-xs"
            ></textarea>
          </div>

          <button
            type="button"
            @click="saveExitInterview(selectedOffboarding.id)"
            :disabled="isSavingInterview"
            class="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw v-if="isSavingInterview" :size="14" class="animate-spin" />
            Salvar Entrevista de Desligamento
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
