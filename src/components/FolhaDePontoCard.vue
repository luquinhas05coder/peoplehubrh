<script setup lang="ts">
import { ref, computed } from "vue"
import {
  Printer,
  Download,
  Calendar,
  Loader2,
  Clock,
  PlusCircle,
  Sparkles,
  Fingerprint,
  FileCheck2,
  X,
  Check,
  RotateCcw,
} from "lucide-vue-next"
import jsPDF from "jspdf"
import type { EmployeeFolder, TimeRecord, PontoPunchReceipt } from "../data"
import {
  getFolhaDePontoSnapshot,
  saveFolhaDePontoSnapshot,
  generateInitialFolha,
  fillStandardCLTSchedule,
  clearMonthPonto,
  registerPontoPunch,
  applyPontoAdjustment,
  createRequest,
} from "../store"

const props = defineProps<{
  folder: EmployeeFolder
  initialMonth?: string
}>()

const emit = defineEmits<{
  (e: "toast", msg: string): void
  (e: "request-adjustment", dateStr: string): void
}>()

const selectedMonth = ref(props.initialMonth || "08/2026")
const isGeneratingPdf = ref(false)

const monthsOptions = [
  "08/2026",
  "07/2026",
  "06/2026",
  "05/2026",
  "04/2026",
  "03/2026",
  "02/2026",
  "01/2026",
  "12/2025",
]

// Folha de Ponto reativa persistente
const currentFolha = computed(() => {
  let snap = getFolhaDePontoSnapshot(props.folder.id, selectedMonth.value)
  if (!snap) {
    snap = generateInitialFolha(props.folder, selectedMonth.value, false)
    saveFolhaDePontoSnapshot(snap)
  }
  return snap
})

const timeRecords = computed(() => currentFolha.value.records)
const totalWorkedHours = computed(() => currentFolha.value.totalWorkedHours)
const totalExtraHours = computed(() => currentFolha.value.totalExtraHours)
const totalAbsences = computed(() => currentFolha.value.totalAbsences)
const bankBalance = computed(() => currentFolha.value.bankBalance)

// Preenchimento de Escala CLT Padrão (220h)
function handleFillCLT() {
  fillStandardCLTSchedule(props.folder.id, selectedMonth.value)
  emit("toast", `Escala padrão CLT (220h) preenchida para ${props.folder.name}!`)
}

// Resetar para Folha Zerada
function handleResetFolha() {
  clearMonthPonto(props.folder.id, selectedMonth.value)
  emit("toast", "Folha de ponto resetada para marcações zeradas.")
}

// Registro de Ponto em Tempo Real (Portaria 671 MTE)
const currentReceipt = ref<PontoPunchReceipt | null>(null)
const isReceiptModalOpen = ref(false)

function handlePunchNow() {
  const now = new Date()
  const todayNum = now.getDate()
  const rec = currentFolha.value.records.find((r) => r.day === todayNum) || currentFolha.value.records[0]

  let punchType: PontoPunchReceipt["type"] = "Entrada 1"
  if (!rec.entry1 || rec.entry1 === "—") {
    punchType = "Entrada 1"
  } else if (!rec.exit1 || rec.exit1 === "—") {
    punchType = "Saída Intervalo"
  } else if (!rec.entry2 || rec.entry2 === "—") {
    punchType = "Retorno Intervalo"
  } else {
    punchType = "Saída Fim de Expediente"
  }

  const res = registerPontoPunch(props.folder.id, selectedMonth.value, punchType)
  if (res && res.receipt) {
    currentReceipt.value = res.receipt
    isReceiptModalOpen.value = true
    emit("toast", `Ponto batido às ${res.receipt.time} — NSR #${res.receipt.nsr}`)
  }
}

// Modal de Ajuste de Ponto por Dia
const isAdjustModalOpen = ref(false)
const editingDay = ref<TimeRecord | null>(null)
const editEntry1 = ref("")
const editExit1 = ref("")
const editEntry2 = ref("")
const editExit2 = ref("")
const editStatus = ref<TimeRecord["status"]>("normal")
const editObs = ref("")

function getStatusLabel(s: TimeRecord["status"]): string {
  switch (s) {
    case "normal":
      return "Normal"
    case "dsr":
      return "DSR / Descanso"
    case "atestado":
      return "Atestado Médico"
    case "ferias":
      return "Férias"
    case "feriado":
      return "Feriado Nacional"
    case "ajuste_pendente":
      return "Ajuste Pendente"
    default:
      return "Sem Registro"
  }
}

function openAdjustModal(rec: TimeRecord) {
  editingDay.value = rec
  editEntry1.value = rec.entry1 === "—" ? "" : rec.entry1
  editExit1.value = rec.exit1 === "—" ? "" : rec.exit1
  editEntry2.value = rec.entry2 === "—" ? "" : rec.entry2
  editExit2.value = rec.exit2 === "—" ? "" : rec.exit2
  editStatus.value = rec.status
  editObs.value = rec.observation || ""
  isAdjustModalOpen.value = true
}

async function saveAdjust() {
  if (!editingDay.value) return
  const day = editingDay.value.day
  applyPontoAdjustment(props.folder.id, selectedMonth.value, day, {
    entry1: editEntry1.value.trim() || "—",
    exit1: editExit1.value.trim() || "—",
    entry2: editEntry2.value.trim() || "—",
    exit2: editExit2.value.trim() || "—",
    status: editStatus.value,
    statusLabel: getStatusLabel(editStatus.value),
    observation: editObs.value,
  })

  // Se houver justificativa, cria chamado de auditoria
  if (editObs.value.trim()) {
    const dayStr = `${day.toString().padStart(2, "0")}/${selectedMonth.value}`
    await createRequest({
      employeeName: props.folder.name,
      employeeInitials: props.folder.initials,
      employeeRole: props.folder.role,
      department: props.folder.department,
      type: "ponto",
      title: `Ajuste de Ponto Dia ${dayStr} — ${props.folder.name}`,
      description: `Marcações ajustadas: [${editEntry1.value || "—"} - ${editExit1.value || "—"}] e [${editEntry2.value || "—"} - ${editExit2.value || "—"}]. Motivo: ${editObs.value}`,
      startDate: dayStr,
      priority: "baixa",
    })
  }

  isAdjustModalOpen.value = false
  emit("toast", `Marcações do dia ${day} atualizadas com sucesso!`)
}

async function handleDownloadPdf() {
  isGeneratingPdf.value = true
  emit("toast", "Iniciando download do Espelho de Ponto em .PDF...")

  const cleanName = props.folder.name.replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const cleanMonth = selectedMonth.value.replace("/", "_")
  const fileName = `Folha_de_Ponto_${cleanName}_${cleanMonth}.pdf`

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(14)
    pdf.text("PEOPLEHUB RH S/A", 14, 15)
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.text("CNPJ: 12.345.678/0001-90 — Av. Paulista, 1000, São Paulo/SP", 14, 20)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    pdf.text(`ESPELHO DE PONTO ELETRÔNICO — ${selectedMonth.value}`, 115, 15)

    // Quadrado de dados do colaborador
    pdf.setDrawColor(0, 0, 0)
    pdf.rect(14, 24, 182, 17)

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Colaborador: ${props.folder.name}`, 17, 29)
    pdf.text(`Matrícula: ${props.folder.registration || "102"}`, 120, 29)
    pdf.text(`Cargo: ${props.folder.role}`, 17, 34)
    pdf.text(`Departamento: ${props.folder.department}`, 120, 34)
    pdf.text(`Admissão: ${props.folder.admissionDate || "01/02/2022"}`, 17, 39)
    pdf.text(`CBO: ${props.folder.cbo || "2124-05"}`, 120, 39)

    // Tabela de marcações
    let y = 47
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text("Dia", 16, y)
    pdf.text("Entrada 1", 35, y)
    pdf.text("Saída 1", 58, y)
    pdf.text("Entrada 2", 82, y)
    pdf.text("Saída 2", 105, y)
    pdf.text("Trabalhado", 130, y)
    pdf.text("H. Extra", 155, y)
    pdf.text("Situação", 175, y)

    pdf.line(14, y + 2, 196, y + 2)
    y += 6

    pdf.setFont("helvetica", "normal")
    timeRecords.value.slice(0, 31).forEach((rec: TimeRecord) => {
      if (y > 270) {
        pdf.addPage()
        y = 15
      }
      const dayStr = `${rec.day.toString().padStart(2, "0")} (${rec.weekDay})`
      pdf.text(dayStr, 16, y)
      pdf.text(rec.entry1, 35, y)
      pdf.text(rec.exit1, 58, y)
      pdf.text(rec.entry2, 82, y)
      pdf.text(rec.exit2, 105, y)
      pdf.text(rec.workedHours, 130, y)
      pdf.text(rec.extraHours, 155, y)
      pdf.text(rec.statusLabel.slice(0, 14), 175, y)
      y += 5.5
    })

    // Totais e Assinaturas
    y += 3
    pdf.line(14, y, 196, y)
    y += 6
    pdf.setFont("helvetica", "bold")
    pdf.text(
      `Totais — Horas Trabalhadas: ${totalWorkedHours.value} | Horas Extras: ${totalExtraHours.value} | Faltas/Atrasos: ${totalAbsences.value} | Banco: ${bankBalance.value}`,
      14,
      y
    )

    y += 18
    pdf.line(20, y, 90, y)
    pdf.line(110, y, 180, y)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text("Assinatura do Funcionário", 35, y + 4)
    pdf.text("Gestor de RH / Empresa", 130, y + 4)

    pdf.save(fileName)
    emit("toast", `Download do PDF concluído: ${fileName}`)
  } catch (err) {
    console.error("Erro ao gerar PDF da Folha de Ponto:", err)
    emit("toast", "Falha ao gerar PDF da Folha de Ponto.")
  } finally {
    isGeneratingPdf.value = false
  }
}

function handlePrint() {
  window.print()
  emit("toast", "Imprimindo Espelho de Ponto...")
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar de Controles da Folha de Ponto -->
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm print:hidden">
      <div class="flex flex-wrap items-center gap-2">
        <Clock :size="16" class="text-teal-600" />
        <span class="text-xs font-bold text-foreground">Folha de Ponto Eletrônica (CLT)</span>
        <span class="text-xs text-muted-foreground">· Competência:</span>
        <div class="flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-xs font-semibold">
          <Calendar :size="13" class="text-slate-600" />
          <select v-model="selectedMonth" class="bg-transparent font-bold text-foreground outline-none cursor-pointer">
            <option v-for="m in monthsOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Bater Ponto Agora -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          @click="handlePunchNow"
          title="Registrar marcação instantânea com emissão de comprovante digital e NSR (Portaria 671 MTE)"
        >
          <Fingerprint :size="14" />
          <span>Bater Ponto Agora</span>
        </button>

        <!-- Preencher Escala CLT 220h -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          @click="handleFillCLT"
          title="Preencher automaticamente todos os dias úteis com a jornada padrão (08:00 às 17:00)"
        >
          <Sparkles :size="13" />
          <span>Preencher Escala 220h</span>
        </button>

        <!-- Resetar Folha -->
        <button
          type="button"
          class="flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
          @click="handleResetFolha"
          title="Zerar todas as marcações do mês"
        >
          <RotateCcw :size="12" />
        </button>

        <!-- Baixar Espelho PDF -->
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

        <!-- Imprimir -->
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

    <!-- CARDS DE MÉTRICAS DE PONTO -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
      <div class="rounded-xl border bg-card p-3 shadow-sm">
        <span class="block text-[11px] font-semibold text-muted-foreground">Horas Trabalhadas</span>
        <span class="text-base font-bold text-foreground font-mono mt-0.5 block">{{ totalWorkedHours }}</span>
      </div>
      <div class="rounded-xl border bg-card p-3 shadow-sm">
        <span class="block text-[11px] font-semibold text-muted-foreground">Horas Extras 50%</span>
        <span class="text-base font-bold text-emerald-600 font-mono mt-0.5 block">{{ totalExtraHours }}</span>
      </div>
      <div class="rounded-xl border bg-card p-3 shadow-sm">
        <span class="block text-[11px] font-semibold text-muted-foreground">Faltas / Atrasos</span>
        <span class="text-base font-bold text-slate-700 font-mono mt-0.5 block">{{ totalAbsences }}</span>
      </div>
      <div class="rounded-xl border bg-card p-3 shadow-sm">
        <span class="block text-[11px] font-semibold text-muted-foreground">Saldo Banco de Horas</span>
        <span
          class="text-base font-bold font-mono mt-0.5 block"
          :class="bankBalance.startsWith('+') ? 'text-emerald-600' : 'text-slate-800'"
        >
          {{ bankBalance }}
        </span>
      </div>
    </div>

    <!-- DOCUMENTO DA FOLHA DE PONTO (MODELO IMPRESSO/CLT) -->
    <div
      id="folha-ponto-document-pdf"
      class="bg-white text-black font-sans text-xs border border-black shadow-md mx-auto max-w-4xl p-5 print:shadow-none print:border-black print:p-2"
    >
      <!-- HEADER DO ESPELHO -->
      <div class="border-b border-black pb-3 mb-3 flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 class="font-bold text-base text-black uppercase">PEOPLEHUB RH S/A</h2>
          <p class="text-[11px] text-slate-700">CNPJ: 12.345.678/0001-90 — Av. Paulista, 1000, São Paulo/SP</p>
          <p class="text-[11px] font-semibold text-black mt-1">
            FOLHA DE PONTO ELETRÔNICA — PORTARIA 671 MTE / CLT
          </p>
        </div>
        <div class="text-right">
          <span class="inline-block bg-black text-white px-2 py-0.5 font-bold text-xs rounded-sm">
            Competência: {{ selectedMonth }}
          </span>
          <p class="text-[10px] text-slate-600 mt-1">Carga Horária: 220h Mensais (08:00 às 17:00)</p>
        </div>
      </div>

      <!-- DADOS DO COLABORADOR -->
      <div class="grid grid-cols-12 border border-black text-[11px] mb-4 bg-slate-50">
        <div class="col-span-4 p-1.5 border-r border-black">
          <span class="block text-[10px] text-slate-600">Funcionário</span>
          <span class="font-bold text-black">{{ folder.name }}</span>
        </div>
        <div class="col-span-2 p-1.5 border-r border-black">
          <span class="block text-[10px] text-slate-600">Matrícula</span>
          <span class="font-mono font-bold text-black">{{ folder.registration || '102' }}</span>
        </div>
        <div class="col-span-3 p-1.5 border-r border-black">
          <span class="block text-[10px] text-slate-600">Cargo</span>
          <span class="font-medium text-black">{{ folder.role }}</span>
        </div>
        <div class="col-span-3 p-1.5">
          <span class="block text-[10px] text-slate-600">Departamento</span>
          <span class="font-medium text-black">{{ folder.department }}</span>
        </div>
      </div>

      <!-- TABELA DE MARCAÇÕES DIÁRIAS -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse border border-black">
          <thead>
            <tr class="bg-slate-200 text-black border-b border-black text-[11px] font-bold text-center">
              <th class="py-1 px-1.5 border-r border-black w-14">Dia</th>
              <th class="py-1 px-1.5 border-r border-black w-16">Entrada 1</th>
              <th class="py-1 px-1.5 border-r border-black w-16">Saída 1</th>
              <th class="py-1 px-1.5 border-r border-black w-16">Entrada 2</th>
              <th class="py-1 px-1.5 border-r border-black w-16">Saída 2</th>
              <th class="py-1 px-1.5 border-r border-black w-20">Trabalhado</th>
              <th class="py-1 px-1.5 border-r border-black w-16">H. Extra</th>
              <th class="py-1 px-2 border-r border-black text-left">Ocorrência / Situação</th>
              <th class="py-1 px-1.5 print:hidden w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rec in timeRecords"
              :key="rec.day"
              class="border-b border-slate-300 text-[11px] text-center"
              :class="{
                'bg-slate-100 font-semibold text-slate-600': rec.isWeekend,
                'bg-amber-50 text-amber-900': rec.status === 'ajuste_pendente',
                'bg-emerald-50 text-emerald-900 font-medium': rec.extraHours !== '00:00' && rec.extraHours !== '00h 00m'
              }"
            >
              <td class="py-1 px-1 border-r border-black font-mono">
                {{ rec.day.toString().padStart(2, '0') }} ({{ rec.weekDay }})
              </td>
              <td class="py-1 px-1 border-r border-black font-mono">{{ rec.entry1 }}</td>
              <td class="py-1 px-1 border-r border-black font-mono">{{ rec.exit1 }}</td>
              <td class="py-1 px-1 border-r border-black font-mono">{{ rec.entry2 }}</td>
              <td class="py-1 px-1 border-r border-black font-mono">{{ rec.exit2 }}</td>
              <td class="py-1 px-1 border-r border-black font-mono font-bold">{{ rec.workedHours }}</td>
              <td class="py-1 px-1 border-r border-black font-mono text-emerald-700 font-bold">{{ rec.extraHours }}</td>
              <td class="py-1 px-2 border-r border-black text-left">
                <span
                  class="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold"
                  :class="{
                    'bg-slate-200 text-slate-700': rec.isWeekend,
                    'bg-sky-100 text-sky-800': rec.status === 'normal' && rec.workedHours !== '00:00',
                    'bg-slate-100 text-slate-500': rec.status === 'normal' && rec.workedHours === '00:00',
                    'bg-amber-200 text-amber-900': rec.status === 'ajuste_pendente',
                    'bg-rose-100 text-rose-800': rec.status === 'atestado',
                    'bg-purple-100 text-purple-800': rec.isHoliday
                  }"
                >
                  {{ rec.statusLabel }}
                </span>
                <span v-if="rec.observation" class="ml-1 text-[9px] text-muted-foreground italic">
                  ({{ rec.observation }})
                </span>
              </td>
              <td class="py-1 px-1 print:hidden text-center">
                <button
                  type="button"
                  class="text-[10px] text-teal-700 font-bold hover:underline flex items-center justify-center gap-0.5 mx-auto cursor-pointer"
                  @click="openAdjustModal(rec)"
                >
                  <PlusCircle :size="11" /> Editar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ASSINATURAS CLT NO RODAPÉ DO IMPRESSO -->
      <div class="mt-8 pt-4 border-t border-black grid grid-cols-2 gap-8 text-center text-[10px]">
        <div>
          <div class="border-b border-black mb-1 w-3/4 mx-auto"></div>
          <p class="font-bold text-black">{{ folder.name }}</p>
          <p class="text-slate-600">Assinatura do Funcionário</p>
        </div>
        <div>
          <div class="border-b border-black mb-1 w-3/4 mx-auto"></div>
          <p class="font-bold text-black">PEOPLEHUB RH S/A</p>
          <p class="text-slate-600">Assinatura do Gestor / Empresa</p>
        </div>
      </div>
    </div>

    <!-- MODAL DE COMPROVANTE DIGITAL DE REGISTRO DE PONTO (PORTARIA 671 MTE) -->
    <div
      v-if="isReceiptModalOpen && currentReceipt"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white text-slate-900 p-6 shadow-2xl space-y-4 border">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2 text-teal-700">
            <FileCheck2 :size="22" />
            <h3 class="text-base font-bold">Comprovante de Ponto Digital</h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-700 cursor-pointer"
            @click="isReceiptModalOpen = false"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Ticket Estilo REP Portaria 671 -->
        <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-[11px] space-y-2">
          <div class="text-center border-b border-dashed border-slate-300 pb-2">
            <p class="font-bold text-xs uppercase">{{ currentReceipt.companyName }}</p>
            <p class="text-[10px] text-slate-600">CNPJ: {{ currentReceipt.cnpj }}</p>
            <p class="text-[10px] text-slate-600">Av. Paulista, 1000 — São Paulo/SP</p>
          </div>

          <div class="space-y-1 py-1">
            <p><span class="text-slate-500">Colaborador:</span> <strong>{{ currentReceipt.employeeName }}</strong></p>
            <p><span class="text-slate-500">CPF:</span> {{ currentReceipt.cpf }}</p>
            <p><span class="text-slate-500">Data/Hora:</span> <strong class="text-teal-700">{{ currentReceipt.timestamp }}</strong></p>
            <p><span class="text-slate-500">NSR:</span> <strong class="text-slate-900">#{{ currentReceipt.nsr }}</strong></p>
            <p><span class="text-slate-500">Tipo:</span> {{ currentReceipt.type }}</p>
            <p><span class="text-slate-500">Localização:</span> {{ currentReceipt.location }}</p>
          </div>

          <div class="border-t border-dashed border-slate-300 pt-2 break-all text-[9px] text-slate-500">
            <span class="block font-bold text-[9px] text-slate-700">Hash SHA-256 (Assinatura Digital):</span>
            {{ currentReceipt.hash }}
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            class="flex-1 py-2 px-4 rounded-lg border text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            @click="isReceiptModalOpen = false"
          >
            Fechar
          </button>
          <button
            type="button"
            class="flex-1 py-2 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow cursor-pointer flex items-center justify-center gap-1.5"
            @click="handlePrint"
          >
            <Printer :size="14" />
            Imprimir Recibo
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL DE EDIÇÃO / AJUSTE DE PONTO -->
    <div
      v-if="isAdjustModalOpen && editingDay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white text-slate-900 p-6 shadow-2xl space-y-4 border">
        <div class="flex items-center justify-between border-b pb-3">
          <div>
            <h3 class="text-base font-bold">
              Ajuste de Marcação — Dia {{ editingDay.day }} ({{ editingDay.weekDay }})
            </h3>
            <p class="text-xs text-slate-500">Competência {{ selectedMonth }} · {{ folder.name }}</p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-700 cursor-pointer"
            @click="isAdjustModalOpen = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <!-- Entrada 1 e Saída 1 -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Entrada 1</label>
              <input
                v-model="editEntry1"
                type="text"
                placeholder="08:00"
                class="w-full rounded-lg border border-slate-300 p-2 font-mono text-center text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Saída 1 (Almoço)</label>
              <input
                v-model="editExit1"
                type="text"
                placeholder="12:00"
                class="w-full rounded-lg border border-slate-300 p-2 font-mono text-center text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <!-- Entrada 2 e Saída 2 -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Entrada 2 (Retorno)</label>
              <input
                v-model="editEntry2"
                type="text"
                placeholder="13:00"
                class="w-full rounded-lg border border-slate-300 p-2 font-mono text-center text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Saída 2 (Fim Jornada)</label>
              <input
                v-model="editExit2"
                type="text"
                placeholder="17:00"
                class="w-full rounded-lg border border-slate-300 p-2 font-mono text-center text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <!-- Situação / Status -->
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Situação / Ocorrência</label>
            <select
              v-model="editStatus"
              class="w-full rounded-lg border border-slate-300 p-2 text-xs bg-white focus:border-teal-500 focus:outline-none"
            >
              <option value="normal">Normal (Trabalho)</option>
              <option value="dsr">DSR / Folga / Descanso Semanal</option>
              <option value="atestado">Atestado Médico (Abonado)</option>
              <option value="ferias">Férias Regulamentares</option>
              <option value="feriado">Feriado Municipal/Nacional</option>
              <option value="ajuste_pendente">Ajuste Pendente de Aprovação</option>
            </select>
          </div>

          <!-- Justificativa -->
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Justificativa / Observação</label>
            <textarea
              v-model="editObs"
              rows="2"
              placeholder="Ex: Ajuste por esquecimento de batida de retorno de intervalo autorizado pelo gestor."
              class="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-teal-500 focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            @click="isAdjustModalOpen = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow cursor-pointer"
            @click="saveAdjust"
          >
            <Check :size="14" />
            Salvar Ajuste
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
