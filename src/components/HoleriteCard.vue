<script setup lang="ts">
import { ref, computed } from "vue"
import { Printer, Download, Calendar, Loader2, Send, Plus, Trash2, Sliders, X, Check } from "lucide-vue-next"
import jsPDF from "jspdf"
import type { EmployeeFolder } from "../data"
import type { HoleriteItem } from "../utils/payroll"
import {
  getContraChequeSnapshot,
  saveContraChequeSnapshot,
  updateContraChequeRubricas,
  sendHoleriteToEmployeeChat,
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

const monthsOptions = [
  "08/2026",
  "07/2026",
  "06/2026",
  "05/2026",
  "04/2026",
  "03/2026",
  "02/2026",
  "01/2026",
  "13º/2025",
  "12/2025",
]

const currentSnapshot = computed(() => {
  let snap = getContraChequeSnapshot(props.folder.id, selectedMonth.value)
  if (!snap) {
    snap = saveContraChequeSnapshot(props.folder, selectedMonth.value)
  }
  return snap
})

const holeriteData = computed(() => {
  return currentSnapshot.value.holerite
})

function formatNumberRaw(val: number): string {
  if (!val || val === 0) return ""
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

function saveRubricas() {
  updateContraChequeRubricas(props.folder.id, selectedMonth.value, rubricasList.value)
  isRubricasModalOpen.value = false
  emit("toast", "Rubricas e deduções fiscais recalculadas com sucesso!")
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
    const response = await fetch("/api/pdf/holerite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        <!-- Botão Lançar Eventos / Rubricas -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          @click="openRubricasModal"
          title="Adicionar ou editar adicionais, horas extras, benefícios e deduções"
        >
          <Sliders :size="13" />
          <span>Lançar Rubricas</span>
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

    <!-- Modal de Edição de Rubricas -->
    <div v-if="isRubricasModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
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
    <div
      id="holerite-document-pdf"
      class="bg-white text-black font-sans text-xs border border-black shadow-md mx-auto max-w-4xl print:shadow-none print:border-black"
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
</template>
