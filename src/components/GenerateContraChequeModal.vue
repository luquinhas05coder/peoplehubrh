<script setup lang="ts">
import { ref, computed } from "vue"
import { X, Sparkles, User, Calendar, CheckCircle2 } from "lucide-vue-next"
import { employeeFolders, createRequest, saveContraChequeSnapshot } from "../store"
import type { EmployeeFolder } from "../data"
import HoleriteCard from "./HoleriteCard.vue"

const emit = defineEmits<{
  (e: "close"): void
  (e: "created", msg: string): void
  (e: "toast", msg: string): void
}>()

const selectedEmployeeId = ref<string>(employeeFolders.value[0]?.id || "")
const selectedMonth = ref("08/2026")
const isGenerated = ref(false)

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

const selectedEmployee = computed<EmployeeFolder | undefined>(() => {
  return employeeFolders.value.find((e) => e.id === selectedEmployeeId.value) || employeeFolders.value[0]
})

async function handleGenerateWithAI() {
  if (!selectedEmployee.value) return

  isGenerated.value = true
  saveContraChequeSnapshot(selectedEmployee.value, selectedMonth.value)

  // Registra a solicitação no backend / store para esse colaborador real
  await createRequest({
    employeeName: selectedEmployee.value.name,
    employeeInitials: selectedEmployee.value.initials,
    employeeRole: selectedEmployee.value.role,
    department: selectedEmployee.value.department,
    type: "contracheque",
    title: `Gerado por IA: Contra-Cheque ${selectedMonth.value} — ${selectedEmployee.value.name}`,
    description: `Holerite e recibo de pagamento oficial processados via IA PeopleHub para a competência ${selectedMonth.value}.`,
    amount: (selectedEmployee.value as any).salary || "R$ 6.500,00",
    priority: "media",
    attachment: `Contra_Cheque_${selectedEmployee.value.name.replace(/\s+/g, "_")}_${selectedMonth.value.replace("/", "_")}.pdf`,
  })

  emit("toast", `IA gerou o Contra-Cheque de ${selectedEmployee.value.name} (${selectedMonth.value})!`)
}

function handleToast(msg: string) {
  emit("toast", msg)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="emit('close')" />

    <!-- Modal Container -->
    <div class="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border shadow-2xl z-10 p-6 sm:p-8 text-foreground flex flex-col">
      <!-- Header do Modal -->
      <div class="flex items-center justify-between border-b pb-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 font-bold">
            <Sparkles :size="24" />
          </div>
          <div>
            <h2 class="text-xl font-bold">Gerador de Contra-Cheque por Inteligência Artificial</h2>
            <p class="text-xs text-muted-foreground">Selecione um colaborador do backend para calcular impostos CLT e baixar o holerite em PDF.</p>
          </div>
        </div>
        <button class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <!-- Controles de Seleção de Colaborador do Backend -->
      <div class="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-2xl border">
        <!-- Colaborador -->
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <User :size="14" class="text-teal-600" /> Colaborador (Banco de Dados do Backend)
          </label>
          <select
            v-model="selectedEmployeeId"
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option v-for="e in employeeFolders" :key="e.id" :value="e.id">
              {{ e.name }} — {{ e.role }} ({{ e.department }})
            </option>
          </select>
        </div>

        <!-- Mês/Ano -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <Calendar :size="14" class="text-teal-600" /> Competência (Mês/Ano)
          </label>
          <select
            v-model="selectedMonth"
            class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option v-for="m in monthsOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <!-- Botão Ação de Gerar -->
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-transform active:scale-95 cursor-pointer"
          style="background-color: var(--color-primary)"
          @click="handleGenerateWithAI"
        >
          <Sparkles :size="18" /> Processar & Gerar Contra-Cheque com IA
        </button>
      </div>

      <!-- Área de Exibição do Holerite (HoleriteCard) -->
      <div v-if="selectedEmployee" class="mt-6 border-t pt-6">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
            <CheckCircle2 :size="15" /> Holerite Processado para {{ selectedEmployee.name }}
          </span>
          <span class="text-xs text-muted-foreground">Clique no botão "Baixar em .PDF" abaixo para salvar o arquivo</span>
        </div>

        <HoleriteCard :folder="selectedEmployee" :initial-month="selectedMonth" @toast="handleToast" />
      </div>

      <!-- Footer Actions -->
      <div class="mt-6 flex items-center justify-end border-t pt-4">
        <button type="button" class="rounded-xl border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted" @click="emit('close')">
          Concluir / Fechar
        </button>
      </div>
    </div>
  </div>
</template>
