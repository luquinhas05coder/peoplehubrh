<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Printer,
  Download,
  Calendar,
  Loader2,
  Send,
  Plus,
  Trash2,
  Sliders,
  X,
  Check,
  Lock,
  Scale,
  Clock,
  AlertTriangle,
  History,
  Info,
} from "lucide-vue-next"
import jsPDF from "jspdf"
import type { EmployeeFolder } from "../data"
import type { HoleriteItem } from "../utils/payroll"
import {
  getContraChequeSnapshot,
  saveContraChequeSnapshot,
  updateContraChequeRubricas,
  sendHoleriteToEmployeeChat,
  pedirVistaContraCheque,
  fetchContraChequesFromBackend,
  tenantContestDeadlineDays,
  apiFetch,
} from "../store"

const props = defineProps<{
  folder: EmployeeFolder
  initialMonth?: string
}>()

const emit = defineEmits<{
  (e: "toast", msg: string): void
}>()

const selectedMonth = ref(props.initialMonth || "08/2026")
const isGeneratingPdf = ref(false)
const isSendingChat = ref(false)
const isRubricasModalOpen = ref(false)

// Pedido de Vista / Recurso
const isContestModalOpen = ref(false)
const contestReasonType = ref("Horas extras ou adicionais incorretos")
const contestDetails = ref("")
const isSubmittingContest = ref(false)

onMounted(async () => {
  await fetchContraChequesFromBackend(props.folder.id)
})

// Linha do tempo linear temporal (da competência mais antiga para a mais recente)
const monthsLinearOrder = [
  "11/2025",
  "12/2025",
  "13º/2025",
  "01/2026",
  "02/2026",
  "03/2026",
  "04/2026",
  "05/2026",
  "06/2026",
  "07/2026",
  "08/2026",
]

const monthsOptions = computed(() => {
  return [...monthsLinearOrder].reverse()
})

const currentSnapshot = computed(() => {
  let snap = getContraChequeSnapshot(props.folder.id, selectedMonth.value)
  if (!snap) {
    snap = saveContraChequeSnapshot(props.folder, selectedMonth.value)
  }
  // Se for competência passada (anterior a 08/2026), marcar imutável
  if (selectedMonth.value !== "08/2026") {
    snap.isImmutable = true
    if (snap.status !== "em_recurso") {
      snap.status = "imutavel"
    }
  }
  return snap
})

const isCurrentImmutable = computed(() => {
  return Boolean(currentSnapshot.value.isImmutable || currentSnapshot.value.status === "imutavel")
})

const holeriteData = computed(() => {
  return currentSnapshot.value.holerite
})

const linearMonths = computed(() => {
  return monthsLinearOrder.map((m) => {
    const s = getContraChequeSnapshot(props.folder.id, m)
    const isPast = m !== "08/2026"
    return {
      month: m,
      status: s?.status || (isPast ? "imutavel" : "aberto_para_vista"),
      isImmutable: isPast || s?.isImmutable || s?.status === "imutavel",
      version: s?.version || 1,
    }
  })
})

function formatNumberRaw(val: number): string {
  if (!val || val === 0) return ""
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateDisplay(dStr?: string): string {
  if (!dStr) return ""
  try {
    const d = new Date(dStr)
    return d.toLocaleDateString("pt-BR")
  } catch {
    return dStr
  }
}

// Gestão de Rubricas (Lançamentos manuais/automáticos)
const rubricasList = ref<HoleriteItem[]>([])
const newRubricaCode = ref("")
const newRubricaDesc = ref("")
const newRubricaRef = ref("")
const newRubricaType = ref<"provento" | "desconto">("provento")
const newRubricaValue = ref<number | null>(null)

const rubricaPresets = [
  { code: "150", desc: "HORAS EXTRAS 50%", type: "provento" as const, ref: "12:00" },
  { code: "160", desc: "HORAS EXTRAS 100%", type: "provento" as const, ref: "08:00" },
  { code: "201", desc: "ADICIONAL NOTURNO 20%", type: "provento" as const, ref: "20%" },
  { code: "250", desc: "INSALUBRIDADE 20%", type: "provento" as const, ref: "20%" },
  { code: "301", desc: "PREMIAÇÃO POR META", type: "provento" as const, ref: "1.00" },
  { code: "405", desc: "VALE REFEIÇÃO / BENEFÍCIO", type: "desconto" as const, ref: "22D" },
  { code: "410", desc: "VALE TRANSPORTE (6%)", type: "desconto" as const, ref: "6.00" },
  { code: "450", desc: "ADIANTAMENTO SALARIAL", type: "desconto" as const, ref: "40%" },
  { code: "490", desc: "FALTAS / ATRASOS", type: "desconto" as const, ref: "01D" },
]

function openRubricasModal() {
  if (isCurrentImmutable.value && currentSnapshot.value.status !== "em_recurso") {
    emit("toast", "Este contra-cheque é imutável. O prazo de vista regulamentar expirou.")
    return
  }
  rubricasList.value = JSON.parse(JSON.stringify(holeriteData.value.items))
  isRubricasModalOpen.value = true
}

function applyPreset(p: typeof rubricaPresets[0]) {
  newRubricaCode.value = p.code
  newRubricaDesc.value = p.desc
  newRubricaType.value = p.type
  newRubricaRef.value = p.ref
}

function addRubrica() {
  if (!newRubricaDesc.value || !newRubricaValue.value || newRubricaValue.value <= 0) {
    emit("toast", "Informe a descrição e um valor positivo.")
    return
  }
  const code = newRubricaCode.value.trim() || String(Math.floor(200 + Math.random() * 700))
  rubricasList.value.push({
    code,
    description: newRubricaDesc.value.toUpperCase(),
    reference: newRubricaRef.value || "1.00",
    type: newRubricaType.value,
    proventos: newRubricaType.value === "provento" ? Number(newRubricaValue.value) : 0,
    descontos: newRubricaType.value === "desconto" ? Number(newRubricaValue.value) : 0,
  })
  newRubricaCode.value = ""
  newRubricaDesc.value = ""
  newRubricaRef.value = ""
  newRubricaValue.value = null
}

function removeRubrica(index: number) {
  rubricasList.value.splice(index, 1)
}

async function saveRubricas() {
  await updateContraChequeRubricas(props.folder.id, selectedMonth.value, rubricasList.value)
  isRubricasModalOpen.value = false
  emit("toast", "Contra-cheque recalculado e nova versão imutável salva no histórico!")
}

function openContestModal() {
  isContestModalOpen.value = true
}

async function submitContest() {
  if (!contestReasonType.value) {
    emit("toast", "Selecione o motivo do recurso.")
    return
  }
  isSubmittingContest.value = true
  try {
    const res = await pedirVistaContraCheque(
      currentSnapshot.value.id,
      contestReasonType.value,
      contestDetails.value
    )
    if (res.ok) {
      isContestModalOpen.value = false
      contestDetails.value = ""
      emit("toast", "Pedido de vista registrado com sucesso! O DP analisará seu recurso.")
    } else {
      emit("toast", res.message || "Não foi possível registrar o recurso.")
    }
  } finally {
    isSubmittingContest.value = false
  }
}

async function handleSendChat() {
  isSendingChat.value = true
  try {
    await sendHoleriteToEmployeeChat(props.folder, selectedMonth.value)
    emit("toast", `Contra-cheque enviado para o chat de ${props.folder.name}!`)
  } catch (_e) {
    emit("toast", "Erro ao enviar contra-cheque via chat.")
  } finally {
    isSendingChat.value = false
  }
}

async function handleDownloadPdf() {
  isGeneratingPdf.value = true
  emit("toast", "Iniciando download do arquivo Contra-Cheque em .PDF...")

  const snap = currentSnapshot.value
  const cleanName = snap.employeeName.replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const cleanMonth = selectedMonth.value.replace("/", "_")
  const fileName = `Contra_Cheque_${cleanName}_${cleanMonth}.pdf`

  try {
    const response = await apiFetch("/api/pdf/holerite", {
      method: "POST",
      body: JSON.stringify({
        employeeName: snap.employeeName,
        cpf: snap.cpf,
        role: snap.role,
        department: snap.department,
        registration: snap.registration,
        admissionDate: snap.admissionDate,
        cbo: snap.cbo,
        salary: snap.salary,
        month: selectedMonth.value,
      }),
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      emit("toast", `Contra-Cheque baixado com sucesso: ${fileName}`)
      return
    }
  } catch (e) {
    console.warn("API offline, usando gerador nativo jsPDF...", e)
  }

  // Fallback jsPDF Nativo
  try {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a5",
    })

    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.3)

    // Outer Frame
    pdf.rect(10, 10, 190, 128)

    // Header Lines
    pdf.line(10, 26, 170, 26)
    pdf.line(10, 42, 170, 42)
    pdf.line(10, 50, 170, 50)
    pdf.line(170, 10, 170, 138) 

    // Header Text
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text("PEOPLEHUB RH S/A", 13, 15)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text("Av. Paulista, 1000 — Jardim Paulista", 13, 19)
    pdf.text("São Paulo - SP — CNPJ: 12.345.678/0001-90", 13, 23)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text("Recibo de Pagamento de Salário", 100, 16)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text(`Mês Referência: ${selectedMonth.value}`, 100, 21)

    // Employee Meta Grid
    pdf.setFontSize(7)
    pdf.text("Código", 13, 30)
    pdf.text("Nome do Funcionário", 35, 30)
    pdf.text("Admissão", 95, 30)
    pdf.text("CBO", 120, 30)
    pdf.text("Função", 140, 30)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.text(snap.registration || "102", 13, 36)
    pdf.text(snap.employeeName, 35, 36)
    pdf.text(snap.admissionDate || "01/02/2022", 95, 36)
    pdf.text(snap.cbo || "2124-05", 120, 36)
    pdf.text(snap.role, 140, 36)

    // Table Header
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text("Código", 13, 46)
    pdf.text("Descrição", 28, 46)
    pdf.text("Referência", 100, 46)
    pdf.text("Vencimentos", 125, 46)
    pdf.text("Descontos", 152, 46)

    // Table Rows
    let y = 56
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)

    holeriteData.value.items.forEach((item) => {
      pdf.text(item.code, 18, y, { align: "center" })
      pdf.text(item.description, 28, y)
      pdf.text(item.reference, 108, y, { align: "center" })
      if (item.proventos > 0) pdf.text(formatNumberRaw(item.proventos), 138, y, { align: "right" })
      if (item.descontos > 0) pdf.text(formatNumberRaw(item.descontos), 168, y, { align: "right" })
      y += 5.0
    })

    // Totals Box Lines
    pdf.line(10, 114, 170, 114)
    pdf.line(90, 114, 90, 124)
    pdf.line(130, 114, 130, 124)
    pdf.line(10, 124, 170, 124)

    pdf.setFontSize(7)
    pdf.text("Total de Vencimentos", 95, 118)
    pdf.text("Total de Descontos", 135, 118)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.text(formatNumberRaw(holeriteData.value.proventosTotais), 125, 122, { align: "right" })
    pdf.text(formatNumberRaw(holeriteData.value.descontosTotais), 165, 122, { align: "right" })

    // Net Value Line
    pdf.setFontSize(8)
    pdf.text("Valor Líquido R$  →", 95, 127)
    pdf.setFontSize(9)
    pdf.text(formatNumberRaw(holeriteData.value.salarioLiquido), 165, 127, { align: "right" })

    // Base info bottom lines
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.5)
    pdf.text("Salário Base", 13, 130)
    pdf.text("Salário Contr. INSS", 42, 130)
    pdf.text("Base FGTS", 77, 130)
    pdf.text("FGTS do Mês", 107, 130)
    pdf.text("Base Calc. IRPF", 142, 130)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.text(formatNumberRaw(holeriteData.value.salarioBase), 38, 135, { align: "right" })
    pdf.text(formatNumberRaw(holeriteData.value.baseINSS), 73, 135, { align: "right" })
    pdf.text(formatNumberRaw(holeriteData.value.baseFGTS), 103, 135, { align: "right" })
    pdf.text(formatNumberRaw(holeriteData.value.valorFGTS), 138, 135, { align: "right" })
    pdf.text(formatNumberRaw(holeriteData.value.baseIRPF), 168, 135, { align: "right" })

    // Right Vertical Bar Text
    pdf.setFontSize(6.5)
    pdf.setFont("helvetica", "normal")
    pdf.text("Declaro ter recebido a importância líquida discriminada neste recibo", 175, 125, { angle: 90 })
    pdf.text("Data: ____ / ____ / ________", 182, 125, { angle: 90 })
    pdf.text("Assinatura do Funcionário: ___________________________________", 187, 125, { angle: 90 })

    pdf.save(fileName)
    emit("toast", `Download do PDF concluído: ${fileName}`)
  } catch (err) {
    console.error("Erro ao gerar PDF:", err)
    emit("toast", "Falha ao gerar o PDF.")
  } finally {
    isGeneratingPdf.value = false
  }
}

function handlePrint() {
  window.print()
  emit("toast", "Imprimindo Contra-Cheque...")
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar de Controles -->
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm print:hidden">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-foreground">Recibo de Pagamento de Salário</span>
        <span class="text-xs text-muted-foreground">· Competência:</span>
        <div class="flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-xs font-semibold">
          <Calendar :size="13" class="text-slate-600" />
          <select v-model="selectedMonth" class="bg-transparent font-bold text-foreground outline-none cursor-pointer">
            <option v-for="m in monthsOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Botão Pedir Vista (Recorrer por Erro de Cálculo) -->
        <button
          v-if="!isCurrentImmutable && currentSnapshot.status !== 'em_recurso'"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          @click="openContestModal"
          title="Colaborador tem o direito de recorrer por erro de cálculo dentro do prazo regulamentar"
        >
          <Scale :size="13" />
          <span>Pedir Vista (Recorrer)</span>
        </button>

        <!-- Botão Lançar Eventos / Rubricas (DP / RH) -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          @click="openRubricasModal"
          :title="isCurrentImmutable && currentSnapshot.status !== 'em_recurso' ? 'Documento imutável (prazo encerrado)' : 'Adicionar ou editar adicionais, horas extras, benefícios e deduções'"
        >
          <Sliders :size="13" />
          <span>{{ currentSnapshot.status === 'em_recurso' ? 'Recalcular Rubricas (Recurso)' : 'Lançar Rubricas' }}</span>
        </button>

        <!-- Botão Enviar no Chat -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          :disabled="isSendingChat"
          @click="handleSendChat"
          title="Notificar e enviar comprovante detalhado diretamente no canal de atendimento do colaborador"
        >
          <Loader2 v-if="isSendingChat" :size="13" class="animate-spin" />
          <Send v-else :size="13" />
          <span>{{ isSendingChat ? 'Enviando...' : 'Enviar via Chat' }}</span>
        </button>

        <!-- Botão Baixar PDF -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow transition-all cursor-pointer disabled:opacity-50"
          style="background-color: var(--color-primary)"
          :disabled="isGeneratingPdf"
          @click="handleDownloadPdf"
        >
          <Loader2 v-if="isGeneratingPdf" :size="14" class="animate-spin" />
          <Download v-else :size="14" />
          <span>{{ isGeneratingPdf ? 'Baixando...' : 'Baixar PDF' }}</span>
        </button>

        <!-- Botão Imprimir -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
          @click="handlePrint"
        >
          <Printer :size="13" />
          <span>Imprimir</span>
        </button>
      </div>
    </div>

    <!-- Linha do Tempo Temporal Linear (Histórico Imutável sem ligação com documentos posteriores) -->
    <div class="rounded-xl border bg-card/60 p-3 shadow-sm print:hidden space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <History :size="14" class="text-primary" />
          <span>Linha do Tempo Temporal Linear de Contra-Cheques</span>
        </div>
        <span class="text-[11px] text-muted-foreground">
          Prazo de vista do cliente (Tenant): <strong>{{ tenantContestDeadlineDays }} dias</strong>
        </span>
      </div>

      <!-- Barra de Rolagem Horizontal Cronológica -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 text-xs no-scrollbar">
        <button
          v-for="item in linearMonths"
          :key="item.month"
          @click="selectedMonth = item.month"
          :class="[
            'flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-all min-w-[125px] cursor-pointer',
            selectedMonth === item.month
              ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
              : 'border-border bg-background hover:bg-muted/60'
          ]"
        >
          <div class="flex items-center justify-between w-full">
            <span class="font-bold text-xs">{{ item.month }}</span>
            <span class="text-[10px] text-muted-foreground">v{{ item.version }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span
              v-if="item.status === 'em_recurso'"
              class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              <AlertTriangle :size="9" /> Em Recurso
            </span>
            <span
              v-else-if="item.status === 'recalculado'"
              class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            >
              <History :size="9" /> Retificado
            </span>
            <span
              v-else-if="item.isImmutable"
              class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Lock :size="9" /> Imutável
            </span>
            <span
              v-else
              class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <Clock :size="9" /> Aberto a Vista
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Banner Informativo de Status & Pedido de Vista -->
    <div class="print:hidden">
      <!-- 1. Aberto para Vista dentro do prazo -->
      <div
        v-if="!isCurrentImmutable && currentSnapshot.status !== 'em_recurso'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20"
      >
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mt-0.5">
            <Clock :size="16" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-amber-900 dark:text-amber-200">
                Prazo para Pedido de Vista Ativo
              </h4>
              <span class="rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                {{ currentSnapshot.daysRemaining ?? tenantContestDeadlineDays }} dias restantes
              </span>
            </div>
            <p class="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
              Colaborador que discordar dos valores por <strong>erro de cálculo</strong> tem o direito de pedir vista dentro do prazo estimado pelo cliente (vencimento em {{ formatDateDisplay(currentSnapshot.contestDeadlineAt) }}). 
              <strong>Após o prazo, este documento se tornará estritamente imutável.</strong>
            </p>
          </div>
        </div>
        <button
          @click="openContestModal"
          class="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-700 cursor-pointer"
        >
          <Scale :size="13" />
          <span>Pedir Vista (Recorrer)</span>
        </button>
      </div>

      <!-- 2. Sob Recurso / Em Análise -->
      <div
        v-else-if="currentSnapshot.status === 'em_recurso'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-3.5 dark:border-purple-900/50 dark:bg-purple-950/20"
      >
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-purple-100 p-2 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 mt-0.5">
            <AlertTriangle :size="16" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-purple-900 dark:text-purple-200">
              Pedido de Vista Registrado — Em Recurso por Erro de Cálculo
            </h4>
            <p class="text-[11px] text-purple-800 dark:text-purple-300/90 mt-0.5">
              Motivo do recurso: <strong>{{ currentSnapshot.contestReason || 'Erro nas rubricas de horas extras ou descontos' }}</strong>.
              O Departamento Pessoal pode homologar o recálculo gerando uma nova versão linear.
            </p>
          </div>
        </div>
        <button
          @click="openRubricasModal"
          class="flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-purple-800 cursor-pointer"
        >
          <Sliders :size="13" />
          <span>Recalcular Rubricas (DP)</span>
        </button>
      </div>

      <!-- 3. Histórico Retificado (Imutável) -->
      <div
        v-else-if="currentSnapshot.status === 'recalculado'"
        class="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20"
      >
        <div class="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          <History :size="16" />
        </div>
        <div class="text-xs">
          <h4 class="font-bold text-blue-900 dark:text-blue-200">
            Histórico Retificado (Imutável)
          </h4>
          <p class="text-[11px] text-blue-800 dark:text-blue-300/90">
            Este contra-cheque foi arquivado de forma imutável após recálculo deferido. Não possui ligação com os documentos gerados posteriormente.
          </p>
        </div>
      </div>

      <!-- 4. Imutável (Prazo Encerrado) -->
      <div
        v-else
        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div class="rounded-lg bg-slate-200 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Lock :size="16" />
        </div>
        <div class="text-xs">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-slate-800 dark:text-slate-200">
              Contra-Cheque Imutável — Prazo de Vista Encerrado
            </h4>
            <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              🔒 Protegido contra alterações
            </span>
          </div>
          <p class="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            Os contra-cheques passados armazenados no banco são estritamente imutáveis e organizados de forma temporal linear, sem ligação com documentos posteriores.
          </p>
        </div>
      </div>
    </div>

    <!-- Modal de Pedido de Vista (Recurso por Erro de Cálculo) -->
    <div v-if="isContestModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
      <div class="w-full max-w-lg rounded-2xl bg-card p-4 sm:p-6 shadow-2xl space-y-4 border my-auto max-h-[90dvh] overflow-y-auto scrollbar-thin">
        <div class="flex items-start justify-between border-b pb-3">
          <div>
            <h3 class="text-base font-bold text-foreground flex items-center gap-2">
              <Scale :size="18" class="text-amber-600" />
              <span>Pedido de Vista de Contra-Cheque</span>
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Competência: <strong>{{ selectedMonth }}</strong> · Colaborador: <strong>{{ currentSnapshot.employeeName }}</strong>
            </p>
          </div>
          <button @click="isContestModalOpen = false" class="text-muted-foreground hover:text-foreground">
            <X :size="20" />
          </button>
        </div>

        <div class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 space-y-1">
          <p class="font-bold flex items-center gap-1.5">
            <Info :size="13" /> Prazo Regulamentar do Cliente (Tenant): {{ tenantContestDeadlineDays }} dias
          </p>
          <p class="text-[11px]">
            O colaborador tem o direito legal de pedir vista e recorrer caso identifique erro de cálculo nas rubricas ou no valor líquido. 
            Após o término do prazo estipulado, o documento se tornará estritamente imutável.
          </p>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-foreground mb-1">Motivo do Erro de Cálculo:</label>
            <select
              v-model="contestReasonType"
              class="w-full rounded-lg border bg-background p-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Horas extras ou adicionais incorretos">Horas extras ou adicionais incorretos</option>
              <option value="Divergência no salário base registrado">Divergência no salário base registrado</option>
              <option value="Desconto indevido de benefícios (VR/VT/Plano)">Desconto indevido de benefícios (VR/VT/Plano)</option>
              <option value="Falta ou atraso lançado incorretamente">Falta ou atraso lançado incorretamente</option>
              <option value="Cálculo divergente de INSS ou IRPF">Cálculo divergente de INSS ou IRPF</option>
              <option value="Outro erro de cálculo nas rubricas">Outro erro de cálculo nas rubricas</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-foreground mb-1">Detalhes e Apontamentos do Recurso:</label>
            <textarea
              v-model="contestDetails"
              rows="4"
              placeholder="Descreva detalhadamente o erro de cálculo (ex: realizei 15h extras a 50% em 12/08 que não foram apuradas na folha)..."
              class="w-full rounded-lg border bg-background p-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-amber-500"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t pt-3">
          <button
            type="button"
            @click="isContestModalOpen = false"
            class="rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="submitContest"
            :disabled="isSubmittingContest"
            class="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-700 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isSubmittingContest" :size="14" class="animate-spin" />
            <Check v-else :size="14" />
            <span>{{ isSubmittingContest ? 'Enviando...' : 'Confirmar Pedido de Vista' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Edição de Rubricas -->
    <div v-if="isRubricasModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
      <div class="w-full max-w-lg rounded-2xl bg-card p-4 sm:p-6 shadow-xl space-y-4 my-auto max-h-[90dvh] overflow-y-auto scrollbar-thin">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold">Lançamentos: {{ selectedMonth }}</h3>
          <button @click="isRubricasModalOpen = false"><X :size="20" /></button>
        </div>
        
        <div class="flex flex-wrap gap-2 py-2 border-b">
           <button v-for="p in rubricaPresets" :key="p.code" @click="applyPreset(p)" class="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
             {{ p.desc }}
           </button>
        </div>

        <div class="grid grid-cols-6 gap-2">
           <input v-model="newRubricaCode" placeholder="Cód" class="col-span-1 p-2 border rounded text-xs" />
           <input v-model="newRubricaDesc" placeholder="Descrição" class="col-span-3 p-2 border rounded text-xs" />
           <input type="number" v-model="newRubricaValue" placeholder="Valor" class="col-span-2 p-2 border rounded text-xs" />
        </div>

        <div class="flex justify-end gap-2">
           <select v-model="newRubricaType" class="text-xs p-2 border rounded">
             <option value="provento">Provento (+)</option>
             <option value="desconto">Desconto (-)</option>
           </select>
           <button @click="addRubrica" class="flex items-center gap-1 bg-black text-white px-3 py-2 rounded text-xs font-bold">
             <Plus :size="14" /> Adicionar
           </button>
        </div>

        <div class="max-h-60 overflow-y-auto space-y-2 border-t pt-4">
           <div v-for="(item, idx) in rubricasList" :key="idx" class="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
             <span>{{ item.description }}</span>
             <span class="font-mono font-bold">{{ formatNumberRaw(item.proventos || item.descontos) }}</span>
             <button @click="removeRubrica(idx)" class="text-red-500"><Trash2 :size="14" /></button>
           </div>
        </div>

        <button @click="saveRubricas" class="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg font-bold">
           <Check :size="16" /> Salvar Alterações
        </button>
      </div>
    </div>

    <!-- MODELO TRADICIONAL CLÁSSICO DE CONTRA-CHEQUE -->
    <div class="overflow-x-auto rounded-xl border border-black/10 scrollbar-thin print:overflow-visible print:border-none">
      <div
        id="holerite-document-pdf"
        class="bg-white text-black font-sans text-xs border border-black shadow-md mx-auto min-w-[680px] max-w-4xl print:min-w-0 print:shadow-none print:border-black"
      >
      <div class="flex">
        <!-- ÁREA PRINCIPAL DO RECIBO (85% LARGURA) -->
        <div class="flex-1 border-r border-black flex flex-col justify-between">
          
          <!-- TOP HEADER: EMPRESA E TÍTULO -->
          <div class="grid grid-cols-12 border-b border-black">
            <div class="col-span-7 p-2.5 border-r border-black leading-snug">
              <p class="font-bold text-sm text-black">PEOPLEHUB RH S/A</p>
              <p class="text-[11px] text-slate-700">Av. Paulista, 1000 — Jardim Paulista</p>
              <p class="text-[11px] text-slate-700">São Paulo - SP</p>
              <p class="text-[11px] text-slate-800 font-medium">CNPJ: 12.345.678/0001-90</p>
            </div>
            <div class="col-span-5 p-2.5 leading-snug">
              <p class="font-bold text-sm text-black">Recibo de Pagamento de Salário</p>
              <p class="text-xs text-slate-800 mt-1">
                Mês Referência: <span class="font-bold">{{ selectedMonth }}</span>
              </p>
            </div>
          </div>

          <!-- GRID DO FUNCIONÁRIO -->
          <div class="grid grid-cols-12 border-b border-black text-center text-[11px]">
            <div class="col-span-2 border-r border-black p-1">
              <span class="block text-[10px] text-slate-600">Código</span>
              <span class="font-bold text-black">{{ currentSnapshot.registration || '102' }}</span>
            </div>
            <div class="col-span-4 border-r border-black p-1 text-left px-2">
              <span class="block text-[10px] text-slate-600">Nome do Funcionário</span>
              <span class="font-bold text-black truncate block">{{ currentSnapshot.employeeName }}</span>
            </div>
            <div class="col-span-2 border-r border-black p-1">
              <span class="block text-[10px] text-slate-600">Admissão</span>
              <span class="font-medium text-black">{{ currentSnapshot.admissionDate || '01/02/2022' }}</span>
            </div>
            <div class="col-span-1 border-r border-black p-1">
              <span class="block text-[10px] text-slate-600">CBO</span>
              <span class="font-medium text-black">{{ currentSnapshot.cbo || '2124-05' }}</span>
            </div>
            <div class="col-span-3 p-1 text-left px-2">
              <span class="block text-[10px] text-slate-600">Função</span>
              <span class="font-medium text-black truncate block">{{ currentSnapshot.role }}</span>
            </div>
          </div>

          <!-- TABELA PRINCIPAL DE RUBRICAS -->
          <div class="flex-1 border-b border-black flex flex-col justify-between min-h-[220px]">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-black text-[11px]">
                  <th class="py-1 px-2 border-r border-black w-14 text-center font-normal">Código</th>
                  <th class="py-1 px-2 border-r border-black font-normal">Descrição</th>
                  <th class="py-1 px-2 border-r border-black w-20 text-center font-normal">Referência</th>
                  <th class="py-1 px-2 border-r border-black w-28 text-right font-normal">Vencimentos</th>
                  <th class="py-1 px-2 w-28 text-right font-normal">Descontos</th>
                </tr>
              </thead>
              <tbody class="divide-y-0">
                <tr v-for="item in holeriteData.items" :key="item.code" class="text-[11px] leading-tight">
                  <td class="py-1 px-2 border-r border-black text-center font-mono">{{ item.code }}</td>
                  <td class="py-1 px-2 border-r border-black font-medium">{{ item.description }}</td>
                  <td class="py-1 px-2 border-r border-black text-center font-mono">{{ item.reference }}</td>
                  <td class="py-1 px-2 border-r border-black text-right font-mono">
                    {{ item.proventos > 0 ? formatNumberRaw(item.proventos) : '' }}
                  </td>
                  <td class="py-1 px-2 text-right font-mono">
                    {{ item.descontos > 0 ? formatNumberRaw(item.descontos) : '' }}
                  </td>
                </tr>

                <!-- Linhas vazias mantendo altura idêntica à foto -->
                <tr v-for="i in Math.max(0, 6 - holeriteData.items.length)" :key="'emp-'+i" class="h-6">
                  <td class="border-r border-black"></td>
                  <td class="border-r border-black"></td>
                  <td class="border-r border-black"></td>
                  <td class="border-r border-black"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SEÇÃO DE TOTAIS E VALOR LÍQUIDO -->
          <div class="border-b border-black grid grid-cols-12 text-[11px]">
            <div class="col-span-5 border-r border-black p-2 flex flex-col justify-end">
              <!-- Espaço livre conforme modelo -->
            </div>
            <div class="col-span-7 flex flex-col">
              <div class="grid grid-cols-2 border-b border-black text-center">
                <div class="border-r border-black p-1">
                  <span class="block text-[10px] text-slate-600">Total de Vencimentos</span>
                  <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.proventosTotais) }}</span>
                </div>
                <div class="p-1">
                  <span class="block text-[10px] text-slate-600">Total de Descontos</span>
                  <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.descontosTotais) }}</span>
                </div>
              </div>

              <div class="flex items-center justify-between p-1.5 px-3 bg-slate-50 font-bold">
                <span class="text-xs">Valor Líquido R$ →</span>
                <span class="font-mono text-sm text-black">{{ formatNumberRaw(holeriteData.salarioLiquido) }}</span>
              </div>
            </div>
          </div>

          <!-- RODAPÉ DE BASES DE CÁLCULO -->
          <div class="grid grid-cols-5 text-center text-[10px] py-1">
            <div class="border-r border-black px-1">
              <span class="block text-[9px] text-slate-600">Salário Base</span>
              <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.salarioBase) }}</span>
            </div>
            <div class="border-r border-black px-1">
              <span class="block text-[9px] text-slate-600">Salário Contr. INSS</span>
              <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.baseINSS) }}</span>
            </div>
            <div class="border-r border-black px-1">
              <span class="block text-[9px] text-slate-600">Base FGTS</span>
              <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.baseFGTS) }}</span>
            </div>
            <div class="border-r border-black px-1">
              <span class="block text-[9px] text-slate-600">FGTS do Mês</span>
              <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.valorFGTS) }}</span>
            </div>
            <div class="px-1">
              <span class="block text-[9px] text-slate-600">Base Calc. IRPF</span>
              <span class="font-mono font-bold text-black">{{ formatNumberRaw(holeriteData.baseIRPF) }}</span>
            </div>
          </div>

        </div>

        <!-- FAIXA VERTICAL DIREITA DE RECIBO E ASSINATURA -->
        <div class="w-16 p-2 flex flex-col justify-between items-center text-[10px] text-slate-700 select-none">
          <div class="[writing-mode:vertical-rl] rotate-180 text-center space-y-4 py-4 leading-tight tracking-tight">
            <span>Declaro ter recebido a importância líquida discriminada neste recibo</span>
            <span>_____ / _____ / ________ Data</span>
            <span>___________________________________ Assinatura do Funcionário</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>
