<script setup lang="ts">
import { ref, computed, watch } from "vue"
import {
  CalendarClock,
  Briefcase,
  Clock,
  FileCheck2,
  AlertCircle,
  Save,
  ShieldAlert,
  Info,
  Building,
  Sparkles,
  Check,
  RotateCcw,
  Zap,
  Edit3,
  Copy,
  CheckCircle2,
  X,
  CalendarDays,
} from "lucide-vue-next"
import type { EmployeeFolder, ContractType, WorkSchedule, WeeklyScheduleItem } from "../data"
import { contractTypeConfigs, workScheduleConfigs } from "../data"
import { updateEmployeeContractAndSchedule } from "../store"

const props = defineProps<{
  folder: EmployeeFolder
}>()

const emit = defineEmits<{
  (e: "toast", msg: string): void
}>()

// Função auxiliar para inicializar os dias com horários extraídos caso faltem
function extractTimesFromItem(item: WeeklyScheduleItem): WeeklyScheduleItem {
  let entry = item.entryTime || ""
  let exit = item.exitTime || ""
  let breakDur = item.breakDuration || "01:00"

  if (item.isWorkDay && (!entry || !exit)) {
    const match = item.hours.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/)
    if (match) {
      entry = match[1]
      exit = match[2]
    } else {
      entry = "08:00"
      exit = "17:00"
    }
  }

  return {
    ...item,
    entryTime: entry,
    exitTime: exit,
    breakDuration: breakDur,
  }
}

function cloneSchedulePattern(scheduleKey: WorkSchedule): WeeklyScheduleItem[] {
  const pattern = workScheduleConfigs[scheduleKey]?.schedulePattern || workScheduleConfigs.escala_5x2.schedulePattern
  return JSON.parse(JSON.stringify(pattern)).map(extractTimesFromItem)
}

// Estado local de seleção para edição / rotulagem
const selectedContractType = ref<ContractType>(props.folder.contractType || "prazo_indeterminado")
const selectedWorkSchedule = ref<WorkSchedule>(props.folder.workSchedule || "escala_5x2")
const currentSchedule = ref<WeeklyScheduleItem[]>(
  props.folder.customSchedulePattern && props.folder.customSchedulePattern.length > 0
    ? JSON.parse(JSON.stringify(props.folder.customSchedulePattern)).map(extractTimesFromItem)
    : cloneSchedulePattern(props.folder.workSchedule || "escala_5x2")
)

const isSaving = ref(false)

// Estado do Modal de Edição de Horário do Dia
const editingDayIndex = ref<number | null>(null)
const editForm = ref({
  day: "",
  fullName: "",
  isWorkDay: true,
  entryTime: "08:00",
  exitTime: "17:48",
  breakDuration: "01:00",
  folgaReason: "Folga (DSR)",
  replicateToWeekdays: false,
})

// Sincroniza se a prop mudar (ex: ao trocar de colaborador)
watch(
  () => props.folder,
  (newVal) => {
    selectedContractType.value = newVal.contractType || "prazo_indeterminado"
    selectedWorkSchedule.value = newVal.workSchedule || "escala_5x2"
    if (newVal.customSchedulePattern && newVal.customSchedulePattern.length > 0) {
      currentSchedule.value = JSON.parse(JSON.stringify(newVal.customSchedulePattern)).map(extractTimesFromItem)
    } else {
      currentSchedule.value = cloneSchedulePattern(newVal.workSchedule || "escala_5x2")
    }
  },
  { deep: true }
)

// Ao alternar a escala, se não houver customização manual ativa salva no colaborador, atualiza os horários da grade
function handleSelectWorkSchedule(sType: WorkSchedule) {
  selectedWorkSchedule.value = sType
  currentSchedule.value = cloneSchedulePattern(sType)
}

const activeContractMeta = computed(() => {
  return contractTypeConfigs[selectedContractType.value] || contractTypeConfigs.prazo_indeterminado
})

const activeScheduleMeta = computed(() => {
  return workScheduleConfigs[selectedWorkSchedule.value] || workScheduleConfigs.escala_5x2
})

// Verifica se os horários foram customizados em relação ao padrão de fábrica da escala selecionada
const isScheduleCustomized = computed(() => {
  const defaultPattern = cloneSchedulePattern(selectedWorkSchedule.value)
  return JSON.stringify(currentSchedule.value) !== JSON.stringify(defaultPattern)
})

// Detecta alterações não salvas (seja no contrato, escala ou horários)
const hasUnsavedChanges = computed(() => {
  const contractChanged = selectedContractType.value !== (props.folder.contractType || "prazo_indeterminado")
  const scheduleChanged = selectedWorkSchedule.value !== (props.folder.workSchedule || "escala_5x2")
  const originalPattern = props.folder.customSchedulePattern && props.folder.customSchedulePattern.length > 0
    ? JSON.stringify(props.folder.customSchedulePattern)
    : JSON.stringify(cloneSchedulePattern(props.folder.workSchedule || "escala_5x2"))
  const patternChanged = JSON.stringify(currentSchedule.value) !== originalPattern

  return contractChanged || scheduleChanged || patternChanged
})

/* ─── Cálculos de Jornada e Horas da Grade Semanal ─── */
function parseTimeMinutes(timeStr?: string): number {
  if (!timeStr) return 0
  const parts = timeStr.split(":")
  if (parts.length < 2) return 0
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  return h * 60 + m
}

function calculateDayWorkedMinutes(item: WeeklyScheduleItem): number {
  if (!item.isWorkDay) return 0
  const entry = item.entryTime || "08:00"
  let exit = item.exitTime || "17:00"
  const breakDur = item.breakDuration || "01:00"

  const e = parseTimeMinutes(entry)
  let s = parseTimeMinutes(exit)
  if (s <= e) s += 24 * 60 // Turno noturno que cruza meia-noite

  const b = parseTimeMinutes(breakDur)
  return Math.max(0, s - e - b)
}

function computeShiftDescription(entry: string, exit: string, breakDur: string): string {
  const e = parseTimeMinutes(entry)
  let s = parseTimeMinutes(exit)
  if (s <= e) s += 24 * 60
  const b = parseTimeMinutes(breakDur)
  const netMin = Math.max(0, s - e - b)
  const netH = Math.floor(netMin / 60)
  const netM = netMin % 60
  const timeText = netM > 0 ? `${netH}h${netM.toString().padStart(2, "0")}` : `${netH}h`
  const breakText = b > 0 ? `${Math.floor(b / 60)}h${b % 60 ? b % 60 + "m" : ""} int.` : "sem int."
  return `${timeText} trab. (${breakText})`
}

const totalWeeklyMinutes = computed(() => {
  return currentSchedule.value.reduce((acc, item) => acc + calculateDayWorkedMinutes(item), 0)
})

const totalWeeklyHoursFormatted = computed(() => {
  const h = Math.floor(totalWeeklyMinutes.value / 60)
  const m = totalWeeklyMinutes.value % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h00`
})

const workedDaysCount = computed(() => {
  return currentSchedule.value.filter((d) => d.isWorkDay).length
})

const folgaDaysCount = computed(() => {
  return currentSchedule.value.filter((d) => !d.isWorkDay).length
})

/* ─── Ações de Edição de Horário ─── */
function openDayEditor(index: number) {
  editingDayIndex.value = index
  const dayItem = currentSchedule.value[index]
  editForm.value = {
    day: dayItem.day,
    fullName: dayItem.fullName,
    isWorkDay: dayItem.isWorkDay,
    entryTime: dayItem.entryTime || "08:00",
    exitTime: dayItem.exitTime || "17:48",
    breakDuration: dayItem.breakDuration || "01:00",
    folgaReason: dayItem.hours.includes("Folga") ? dayItem.hours : "Folga (DSR)",
    replicateToWeekdays: false,
  }
}

function closeDayEditor() {
  editingDayIndex.value = null
}

function applyPreset(entry: string, exit: string, breakDur: string) {
  editForm.value.isWorkDay = true
  editForm.value.entryTime = entry
  editForm.value.exitTime = exit
  editForm.value.breakDuration = breakDur
}

function saveDayEdit() {
  if (editingDayIndex.value === null) return
  const idx = editingDayIndex.value
  const targetDay = currentSchedule.value[idx]

  if (editForm.value.isWorkDay) {
    const hoursStr = `${editForm.value.entryTime} - ${editForm.value.exitTime}`
    const shiftStr = computeShiftDescription(
      editForm.value.entryTime,
      editForm.value.exitTime,
      editForm.value.breakDuration
    )

    targetDay.isWorkDay = true
    targetDay.entryTime = editForm.value.entryTime
    targetDay.exitTime = editForm.value.exitTime
    targetDay.breakDuration = editForm.value.breakDuration
    targetDay.hours = hoursStr
    targetDay.shift = shiftStr

    // Se o usuário marcou para replicar para todos os dias úteis (Seg-Sex)
    if (editForm.value.replicateToWeekdays) {
      currentSchedule.value.forEach((d) => {
        if (["Seg", "Ter", "Qua", "Qui", "Sex"].includes(d.day)) {
          d.isWorkDay = true
          d.entryTime = editForm.value.entryTime
          d.exitTime = editForm.value.exitTime
          d.breakDuration = editForm.value.breakDuration
          d.hours = hoursStr
          d.shift = shiftStr
        }
      })
      emit("toast", `Horário ${hoursStr} replicado para toda a semana (Seg-Sex)!`)
    } else {
      emit("toast", `Horário de ${targetDay.fullName} atualizado para ${hoursStr}!`)
    }
  } else {
    targetDay.isWorkDay = false
    targetDay.hours = editForm.value.folgaReason || "Folga"
    targetDay.shift = "Descanso regulamentar"
    emit("toast", `${targetDay.fullName} definido como ${targetDay.hours}!`)
  }

  closeDayEditor()
}

// Alternar rapidamente entre trabalho e folga com 1 clique no card
function toggleDayStatus(index: number) {
  const day = currentSchedule.value[index]
  if (day.isWorkDay) {
    day.isWorkDay = false
    day.hours = day.day === "Dom" ? "Folga (DSR)" : "Folga"
    day.shift = "Descanso regulamentar"
    emit("toast", `${day.fullName} alterado para Folga!`)
  } else {
    day.isWorkDay = true
    day.entryTime = day.entryTime || "08:00"
    day.exitTime = day.exitTime || "17:48"
    day.breakDuration = day.breakDuration || "01:00"
    day.hours = `${day.entryTime} - ${day.exitTime}`
    day.shift = computeShiftDescription(day.entryTime, day.exitTime, day.breakDuration)
    emit("toast", `${day.fullName} ativado com expediente ${day.hours}!`)
  }
}

// Replicar o horário da segunda-feira para terça a sexta
function replicateMondayToWeekdays() {
  const monday = currentSchedule.value.find((d) => d.day === "Seg")
  if (!monday) return

  currentSchedule.value.forEach((d) => {
    if (["Ter", "Qua", "Qui", "Sex"].includes(d.day)) {
      d.isWorkDay = monday.isWorkDay
      d.entryTime = monday.entryTime
      d.exitTime = monday.exitTime
      d.breakDuration = monday.breakDuration
      d.hours = monday.hours
      d.shift = monday.shift
    }
  })
  emit("toast", "Horário de Segunda-feira copiado para Ter, Qua, Qui e Sex!")
}

// Restaurar horários de fábrica da escala
function resetScheduleToDefault() {
  currentSchedule.value = cloneSchedulePattern(selectedWorkSchedule.value)
  emit("toast", `Grade restaurada para o padrão oficial da ${activeScheduleMeta.value.label}.`)
}

async function handleApplyLabels() {
  isSaving.value = true
  try {
    await updateEmployeeContractAndSchedule(
      props.folder.id,
      selectedContractType.value,
      selectedWorkSchedule.value,
      currentSchedule.value
    )
    emit(
      "toast",
      `Colaborador ${props.folder.name} atualizado: ${activeContractMeta.value.label} · ${activeScheduleMeta.value.label} (${totalWeeklyHoursFormatted.value}/sem)!`
    )
  } catch (_e) {
    emit("toast", "Erro ao salvar rótulos e grade do colaborador.")
  } finally {
    isSaving.value = false
  }
}

function resetSelection() {
  selectedContractType.value = props.folder.contractType || "prazo_indeterminado"
  selectedWorkSchedule.value = props.folder.workSchedule || "escala_5x2"
  if (props.folder.customSchedulePattern && props.folder.customSchedulePattern.length > 0) {
    currentSchedule.value = JSON.parse(JSON.stringify(props.folder.customSchedulePattern)).map(extractTimesFromItem)
  } else {
    currentSchedule.value = cloneSchedulePattern(props.folder.workSchedule || "escala_5x2")
  }
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-200">
    <!-- BANNER DE DESTAQUE DO VÍNCULO & ESCALA ATUAL -->
    <div class="rounded-2xl border bg-card p-6 shadow-sm relative overflow-hidden">
      <div class="absolute -right-8 -bottom-8 w-40 h-40 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
              <CalendarClock :size="20" />
            </span>
            <div>
              <h2 class="text-base font-bold text-foreground flex items-center gap-2">
                Gestão de Escala de Trabalho & Tipo de Contrato
              </h2>
              <p class="text-xs text-muted-foreground">
                Configuração cadastral, rotulagem trabalhista e edição personalizada dos horários de trabalho
              </p>
            </div>
          </div>
        </div>

        <!-- Badges Atuais Salvos no Colaborador -->
        <div class="flex flex-wrap items-center gap-2.5 bg-muted/40 p-2.5 rounded-xl border border-muted-foreground/15">
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-semibold text-muted-foreground">Regime:</span>
            <span
              class="rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1"
              :class="[contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].badgeBg, contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].badgeColor]"
            >
              <FileCheck2 :size="13" />
              {{ contractTypeConfigs[folder.contractType || 'prazo_indeterminado'].label }}
            </span>
          </div>

          <div class="h-4 w-px bg-border hidden sm:block"></div>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-semibold text-muted-foreground">Escala:</span>
            <span
              class="rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1"
              :class="[workScheduleConfigs[folder.workSchedule || 'escala_5x2'].badgeBg, workScheduleConfigs[folder.workSchedule || 'escala_5x2'].badgeColor]"
            >
              <Clock :size="13" />
              {{ workScheduleConfigs[folder.workSchedule || 'escala_5x2'].label }}
            </span>
          </div>

          <div class="h-4 w-px bg-border hidden sm:block"></div>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-semibold text-muted-foreground">Carga Semanal:</span>
            <span class="rounded-lg px-2 py-0.5 text-xs font-bold font-mono bg-teal-500/10 text-teal-800">
              {{ totalWeeklyHoursFormatted }}
            </span>
          </div>
        </div>
      </div>

      <!-- Barra de Alerta de Alterações Pendentes -->
      <transition
        enter-active-class="transition-all duration-200"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0 -translate-y-2"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="hasUnsavedChanges"
          class="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div class="flex items-center gap-2 text-amber-900">
            <AlertCircle :size="16" class="text-amber-600 shrink-0" />
            <span>
              Alterações pendentes de salvar:
              <strong>{{ activeContractMeta.label }}</strong> · <strong>{{ activeScheduleMeta.label }}</strong>
              (Grade com <strong>{{ totalWeeklyHoursFormatted }}</strong>).
            </span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="px-3 py-1.5 rounded-lg border bg-card text-muted-foreground hover:bg-muted font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              @click="resetSelection"
            >
              <RotateCcw :size="13" /> Desfazer
            </button>
            <button
              class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              :disabled="isSaving"
              @click="handleApplyLabels"
            >
              <Save :size="14" />
              <span>{{ isSaving ? 'Salvando...' : 'Aplicar e Salvar Rótulos & Grade' }}</span>
            </button>
          </div>
        </div>
      </transition>
    </div>

    <!-- PAINEL 1: ROTULAGEM DE TIPO DE CONTRATO (5 OPÇÕES) -->
    <div class="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
      <div class="flex items-center justify-between border-b pb-3">
        <div class="flex items-center gap-2">
          <Briefcase :size="18" class="text-teal-600" />
          <h3 class="font-bold text-sm text-foreground">
            1. Tipo de Contrato de Trabalho (Selecione para Rotular)
          </h3>
        </div>
        <span class="text-[11px] font-semibold text-muted-foreground">
          {{ Object.keys(contractTypeConfigs).length }} Modalidades Previstas em Lei
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div
          v-for="(meta, cType) in contractTypeConfigs"
          :key="cType"
          class="rounded-xl border p-4 text-left transition-all cursor-pointer relative flex flex-col justify-between"
          :class="[
            selectedContractType === cType
              ? 'ring-2 ring-teal-600 border-teal-500 bg-teal-500/5 shadow-sm'
              : 'hover:border-muted-foreground/30 hover:bg-muted/30 bg-background/50',
          ]"
          @click="selectedContractType = cType as ContractType"
        >
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                :class="[meta.badgeBg, meta.badgeColor]"
              >
                {{ meta.label }}
              </span>

              <div
                class="h-5 w-5 rounded-full flex items-center justify-center transition-colors"
                :class="selectedContractType === cType ? 'bg-teal-600 text-white' : 'border text-transparent'"
              >
                <Check :size="12" stroke-width="3" />
              </div>
            </div>

            <p class="text-xs text-muted-foreground leading-relaxed">
              {{ meta.description }}
            </p>
          </div>

          <div class="mt-3 pt-2.5 border-t space-y-1.5 text-[11px]">
            <div class="flex items-center justify-between text-muted-foreground">
              <span class="font-semibold">Fundamento Legal:</span>
              <span class="font-mono text-foreground font-medium text-[10px]">{{ meta.legalBasis }}</span>
            </div>

            <ul class="space-y-1 text-muted-foreground pt-1">
              <li
                v-for="(feat, fIdx) in meta.features.slice(0, 2)"
                :key="fIdx"
                class="flex items-center gap-1.5 text-[10px]"
              >
                <span class="h-1 w-1 rounded-full bg-teal-600 shrink-0"></span>
                <span class="truncate">{{ feat }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- PAINEL 2: ROTULAGEM DE SISTEMA DE ESCALAS (4 OPÇÕES NO BRASIL) -->
    <div class="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
      <div class="flex items-center justify-between border-b pb-3">
        <div class="flex items-center gap-2">
          <Clock :size="18" class="text-teal-600" />
          <h3 class="font-bold text-sm text-foreground">
            2. Sistema de Escalas de Trabalho no Brasil (Selecione para Rotular)
          </h3>
        </div>
        <span class="text-[11px] font-semibold text-muted-foreground">
          4 Escalas Regulamentadas no Brasil
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          v-for="(sMeta, sType) in workScheduleConfigs"
          :key="sType"
          class="rounded-xl border p-4 text-left transition-all cursor-pointer relative flex flex-col justify-between"
          :class="[
            selectedWorkSchedule === sType
              ? 'ring-2 ring-teal-600 border-teal-500 bg-teal-500/5 shadow-sm'
              : 'hover:border-muted-foreground/30 hover:bg-muted/30 bg-background/50',
          ]"
          @click="handleSelectWorkSchedule(sType as WorkSchedule)"
        >
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                :class="[sMeta.badgeBg, sMeta.badgeColor]"
              >
                {{ sMeta.label }}
              </span>

              <div
                class="h-5 w-5 rounded-full flex items-center justify-center transition-colors"
                :class="selectedWorkSchedule === sType ? 'bg-teal-600 text-white' : 'border text-transparent'"
              >
                <Check :size="12" stroke-width="3" />
              </div>
            </div>

            <p class="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {{ sMeta.description }}
            </p>
          </div>

          <div class="mt-3 pt-2.5 border-t space-y-1.5 text-[11px]">
            <div class="flex items-center justify-between text-muted-foreground">
              <span class="font-semibold">Carga Horária:</span>
              <span class="font-medium text-foreground text-[10px]">{{ sMeta.weeklyHours }}</span>
            </div>
            <div class="flex items-center justify-between text-muted-foreground">
              <span class="font-semibold">Jornada Diária:</span>
              <span class="font-medium text-foreground text-[10px]">{{ sMeta.dailyWorkload }}</span>
            </div>
            <div class="flex items-center justify-between text-muted-foreground">
              <span class="font-semibold">Regra de DSR:</span>
              <span class="text-teal-700 font-medium text-[10px] truncate max-w-[120px]" :title="sMeta.dsrRule">{{ sMeta.dsrRule }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PAINEL 3: SIMULADOR & EDITOR VISUAL DA GRADE SEMANAL (SEGUNDA A DOMINGO) -->
    <div class="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-3">
        <div class="flex items-center gap-2">
          <CalendarDays :size="20" class="text-teal-600" />
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-sm text-foreground">
                Grade Semanal & Horários de Trabalho: {{ activeScheduleMeta.label }}
              </h3>
              <span
                v-if="isScheduleCustomized"
                class="rounded-full bg-amber-500/15 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-500/30"
              >
                Horários Customizados
              </span>
              <span
                v-else
                class="rounded-full bg-teal-500/10 text-teal-800 text-[10px] font-bold px-2 py-0.5"
              >
                Padrão Oficial da Escala
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              Clique em qualquer dia ou no botão de editar para ajustar os horários de entrada, saída, intervalo ou alternar folgas
            </p>
          </div>
        </div>

        <!-- Ações Rápidas da Grade (Produtividade do RH) -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Copia os horários de Segunda-feira para Terça, Quarta, Quinta e Sexta"
            @click="replicateMondayToWeekdays"
          >
            <Copy :size="13" class="text-teal-600" />
            <span>Replicar Seg ➔ Sex</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted font-medium text-muted-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Restaura os horários para a definição padrão da escala"
            @click="resetScheduleToDefault"
          >
            <RotateCcw :size="13" />
            <span>Restaurar Padrão</span>
          </button>
        </div>
      </div>

      <!-- Resumo de Jornada Semanal Líquida -->
      <div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-xs">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1.5 text-foreground font-semibold">
            <Clock :size="14" class="text-teal-600" />
            Carga Semanal Programada: <strong class="text-teal-700 font-mono text-sm ml-1">{{ totalWeeklyHoursFormatted }}</strong>
          </span>
          <span class="text-muted-foreground font-medium">·</span>
          <span class="text-muted-foreground">
            {{ workedDaysCount }} dias de trabalho · {{ folgaDaysCount }} folgas
          </span>
        </div>

        <div>
          <span
            v-if="totalWeeklyMinutes > 44 * 60"
            class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/30"
          >
            <AlertCircle :size="12" /> Excede limite constitucional (44h CLT)
          </span>
          <span
            v-else-if="totalWeeklyMinutes === 44 * 60"
            class="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-500/10 px-2.5 py-0.5 rounded-md"
          >
            <CheckCircle2 :size="12" /> Carga padrão máxima (44h CLT)
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-500/10 px-2.5 py-0.5 rounded-md"
          >
            <CheckCircle2 :size="12" /> Jornada regular (≤ 44h)
          </span>
        </div>
      </div>

      <!-- 7 Cards representando os dias da semana (Com edição direta e botão de editar) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div
          v-for="(dayItem, dIdx) in currentSchedule"
          :key="dayItem.day"
          class="rounded-xl border p-3.5 flex flex-col justify-between transition-all group relative hover:shadow-md"
          :class="
            dayItem.isWorkDay
              ? 'bg-teal-500/5 border-teal-500/30 hover:border-teal-500'
              : 'bg-muted/30 border-dashed border-muted-foreground/30 opacity-80 hover:opacity-100 hover:border-muted-foreground/50'
          "
        >
          <!-- Topo do Card: Dia da semana e Badge de Expediente/Folga (Alternável) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold font-mono text-foreground">{{ dayItem.day }}</span>
              <button
                type="button"
                class="text-[10px] font-bold rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                :class="dayItem.isWorkDay ? 'bg-teal-500/20 text-teal-800 hover:bg-teal-500/30' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'"
                :title="dayItem.isWorkDay ? 'Clique para alternar para Folga' : 'Clique para alternar para Expediente'"
                @click="toggleDayStatus(dIdx)"
              >
                {{ dayItem.isWorkDay ? 'Expediente' : 'Folga' }}
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground truncate" :title="dayItem.fullName">{{ dayItem.fullName }}</p>
          </div>

          <!-- Meio do Card: Horário Exibido e Detalhes -->
          <div class="mt-3 pt-2 border-t text-[11px] space-y-1">
            <div class="flex items-center justify-between">
              <p class="font-bold" :class="dayItem.isWorkDay ? 'text-teal-800 font-mono text-xs' : 'text-muted-foreground'">
                {{ dayItem.hours }}
              </p>
            </div>
            <p class="text-[10px] text-muted-foreground leading-tight truncate" :title="dayItem.shift">
              {{ dayItem.shift }}
            </p>
          </div>

          <!-- Rodapé do Card: Botão de Edição de Horário -->
          <div class="mt-2.5 pt-2 border-t flex items-center justify-between gap-1">
            <button
              type="button"
              class="w-full py-1 px-2 rounded-lg bg-background hover:bg-teal-600 hover:text-white text-muted-foreground border text-[10px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
              @click="openDayEditor(dIdx)"
            >
              <Edit3 :size="11" />
              <span>Editar Horário</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Destaques Operacionais da Escala -->
      <div class="rounded-xl bg-muted/40 p-4 border text-xs space-y-2">
        <h4 class="font-bold text-foreground flex items-center gap-1.5">
          <Info :size="14" class="text-teal-600" />
          Diretrizes Operacionais para {{ activeScheduleMeta.label }}:
        </h4>
        <ul class="grid grid-cols-1 md:grid-cols-3 gap-2 text-muted-foreground">
          <li v-for="(highlight, hIdx) in activeScheduleMeta.highlights" :key="hIdx" class="flex items-start gap-1.5">
            <span class="text-teal-600 font-bold">✓</span>
            <span>{{ highlight }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- MODAL DE EDIÇÃO DO HORÁRIO DO DIA -->
    <div
      v-if="editingDayIndex !== null"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      @click.self="closeDayEditor"
    >
      <div class="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
        <!-- Header do Modal -->
        <div class="flex items-center justify-between border-b pb-3.5">
          <div class="flex items-center gap-2">
            <span class="h-8 w-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Clock :size="18" />
            </span>
            <div>
              <h3 class="font-bold text-base text-foreground">
                Configurar Horário: {{ editForm.fullName }} ({{ editForm.day }})
              </h3>
              <p class="text-xs text-muted-foreground">
                Defina o expediente ou descanso deste dia para o colaborador {{ folder.name }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            @click="closeDayEditor"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Tipo de Dia: Expediente ou Folga -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">Situação do Dia:</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="editForm.isWorkDay ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-background text-muted-foreground hover:bg-muted'"
              @click="editForm.isWorkDay = true"
            >
              <Check :size="14" v-if="editForm.isWorkDay" />
              <span>Dia de Expediente</span>
            </button>
            <button
              type="button"
              class="py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="!editForm.isWorkDay ? 'bg-teal-700 text-white border-teal-700 shadow-sm' : 'bg-background text-muted-foreground hover:bg-muted'"
              @click="editForm.isWorkDay = false"
            >
              <Check :size="14" v-if="!editForm.isWorkDay" />
              <span>Dia de Folga / DSR</span>
            </button>
          </div>
        </div>

        <!-- Campos se for Dia de Expediente -->
        <div v-if="editForm.isWorkDay" class="space-y-4">
          <!-- Presets Rápidos de Horário -->
          <div class="space-y-1.5">
            <span class="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Zap :size="12" class="text-amber-500" /> Presets Rápidos de Jornada:
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                class="px-2 py-1 rounded-md border bg-muted/30 hover:bg-teal-500/15 hover:border-teal-500 hover:text-teal-800 text-[11px] font-mono transition-all cursor-pointer"
                @click="applyPreset('08:00', '17:00', '01:00')"
              >
                08:00 - 17:00 (8h)
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded-md border bg-muted/30 hover:bg-teal-500/15 hover:border-teal-500 hover:text-teal-800 text-[11px] font-mono transition-all cursor-pointer"
                @click="applyPreset('08:00', '17:48', '01:00')"
              >
                08:00 - 17:48 (8h48 - 5x2)
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded-md border bg-muted/30 hover:bg-teal-500/15 hover:border-teal-500 hover:text-teal-800 text-[11px] font-mono transition-all cursor-pointer"
                @click="applyPreset('09:00', '18:00', '01:00')"
              >
                09:00 - 18:00 (8h)
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded-md border bg-muted/30 hover:bg-teal-500/15 hover:border-teal-500 hover:text-teal-800 text-[11px] font-mono transition-all cursor-pointer"
                @click="applyPreset('08:00', '16:20', '01:00')"
              >
                08:00 - 16:20 (7h20 - 6x1)
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded-md border bg-muted/30 hover:bg-teal-500/15 hover:border-teal-500 hover:text-teal-800 text-[11px] font-mono transition-all cursor-pointer"
                @click="applyPreset('07:00', '19:00', '01:00')"
              >
                07:00 - 19:00 (12h)
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded-md border bg-muted/30 hover:bg-teal-500/15 hover:border-teal-500 hover:text-teal-800 text-[11px] font-mono transition-all cursor-pointer"
                @click="applyPreset('19:00', '07:00', '01:00')"
              >
                19:00 - 07:00 (Noturno)
              </button>
            </div>
          </div>

          <!-- Horários de Entrada e Saída -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-foreground">Horário de Entrada:</label>
              <input
                v-model="editForm.entryTime"
                type="time"
                class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-foreground">Horário de Saída:</label>
              <input
                v-model="editForm.exitTime"
                type="time"
                class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          <!-- Duração do Intervalo de Almoço / Repouso -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Intervalo Intrajornada (Almoço / Repouso):</label>
            <select
              v-model="editForm.breakDuration"
              class="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="01:00">1 hora (Padrão compulsório Art. 71 CLT para > 6h)</option>
              <option value="01:12">1h12 (Compensatório semanal)</option>
              <option value="01:30">1 hora e 30 minutos</option>
              <option value="02:00">2 horas (Limite máximo padrão CLT)</option>
              <option value="00:30">30 minutos (Com previsão em Acordo / CCT)</option>
              <option value="00:00">Sem intervalo (Jornadas de até 4h a 6h)</option>
            </select>
          </div>

          <!-- Prévia da Carga Líquida Calculada -->
          <div class="p-3 rounded-xl bg-muted/40 border text-xs flex items-center justify-between">
            <span class="text-muted-foreground">Carga horária diária líquida calculada:</span>
            <span class="font-mono font-bold text-teal-700 text-sm">
              {{ computeShiftDescription(editForm.entryTime, editForm.exitTime, editForm.breakDuration) }}
            </span>
          </div>

          <!-- Checkbox para Replicar para Dias Úteis -->
          <div class="pt-1">
            <label class="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="editForm.replicateToWeekdays"
                class="rounded border-muted-foreground/30 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <span>Aplicar este mesmo horário para todos os dias úteis (Segunda a Sexta)</span>
            </label>
          </div>
        </div>

        <!-- Campos se for Dia de Folga -->
        <div v-else class="space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-foreground">Motivo / Tipo de Folga:</label>
            <select
              v-model="editForm.folgaReason"
              class="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="Folga (DSR)">Descanso Semanal Remunerado (DSR - Art. 67 CLT)</option>
              <option value="Folga Compensatória">Folga Compensatória (Acordo de Compensação)</option>
              <option value="Folga Flex">Folga Flex / 4-Day Work Week</option>
              <option value="Folga Escalar">Folga Escalar / Plantão Intercalado</option>
            </select>
          </div>

          <div class="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground leading-relaxed">
            Este dia será contabilizado como descanso no espelho de ponto e na escala semanal do colaborador, sem débito no banco de horas.
          </div>
        </div>

        <!-- Rodapé do Modal -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border bg-card text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            @click="closeDayEditor"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow cursor-pointer active:scale-95 flex items-center gap-1.5"
            @click="saveDayEdit"
          >
            <Check :size="14" />
            <span>Salvar Horário</span>
          </button>
        </div>
      </div>
    </div>

    <!-- BOTÃO FIXO/EM DESTAQUE PARA SALVAR RÓTULOS E GRADE -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border bg-muted/20">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles :size="16" class="text-teal-600 shrink-0" />
        <span>
          Ao confirmar, o colaborador <strong>{{ folder.name }}</strong> será salvo com o regime
          <strong class="text-foreground">{{ activeContractMeta.label }}</strong>, escala
          <strong class="text-foreground">{{ activeScheduleMeta.label }}</strong> e grade de
          <strong class="text-teal-700 font-mono">{{ totalWeeklyHoursFormatted }}/sem</strong>.
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <button
          v-if="hasUnsavedChanges"
          class="flex-1 sm:flex-initial rounded-xl border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          @click="resetSelection"
        >
          Desfazer
        </button>
        <button
          class="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl px-6 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          :class="hasUnsavedChanges ? 'bg-teal-600 hover:bg-teal-700' : 'bg-teal-700'"
          :disabled="isSaving"
          @click="handleApplyLabels"
        >
          <Save :size="15" />
          <span>{{ isSaving ? 'Salvando...' : hasUnsavedChanges ? 'Salvar Rótulos & Grade' : 'Rótulos & Grade Atualizados ✓' }}</span>
        </button>
      </div>
    </div>

    <!-- PAINEL 4: QUADRO DE CONFORMIDADE LEGAL TRABALHISTA (CLT / REFORMA TRABALHISTA) -->
    <div class="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
      <div class="flex items-center gap-2 border-b pb-3">
        <ShieldAlert :size="18" class="text-teal-600" />
        <div>
          <h3 class="font-bold text-sm text-foreground">
            Quadro de Conformidade Trabalhista & Direitos Aplicáveis
          </h3>
          <p class="text-xs text-muted-foreground">
            Critérios compulsórios previstos na Consolidação das Leis do Trabalho (CLT) para este colaborador
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <!-- Card 1: Intervalo Intrajornada -->
        <div class="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
          <span class="font-bold text-foreground flex items-center gap-1">
            <Clock :size="13" class="text-teal-600" /> Intervalo Intrajornada
          </span>
          <p class="text-muted-foreground leading-relaxed text-[11px]">
            Para jornadas superiores a 6 horas diárias, é obrigatório intervalo para repouso e alimentação de no mínimo <strong>1 hora</strong> (art. 71 CLT), reduzível a 30min por acordo coletivo.
          </p>
        </div>

        <!-- Card 2: Intervalo Interjornada -->
        <div class="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
          <span class="font-bold text-foreground flex items-center gap-1">
            <CalendarClock :size="13" class="text-teal-600" /> Descanso Interjornada
          </span>
          <p class="text-muted-foreground leading-relaxed text-[11px]">
            Entre 2 jornadas diárias de trabalho haverá um período mínimo de <strong>11 horas consecutivas</strong> para descanso do trabalhador (art. 66 da CLT).
          </p>
        </div>

        <!-- Card 3: Horas Extras & Adicionais -->
        <div class="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
          <span class="font-bold text-foreground flex items-center gap-1">
            <Zap :size="13" class="text-amber-600" /> Horas Extras & Noturno
          </span>
          <p class="text-muted-foreground leading-relaxed text-[11px]">
            Horas excedentes remuneradas com adicional mínimo de <strong>50%</strong> (dias úteis) e <strong>100%</strong> (domingos/feriados). Horário noturno (22h às 05h) acrescido de 20% com hora ficta de 52m30s.
          </p>
        </div>

        <!-- Card 4: Particularidades do Contrato Selecionado -->
        <div class="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
          <span class="font-bold text-foreground flex items-center gap-1">
            <Building :size="13" class="text-indigo-600" /> Regime {{ activeContractMeta.short }}
          </span>
          <p class="text-muted-foreground leading-relaxed text-[11px]">
            Enquadramento: <strong>{{ activeContractMeta.legalBasis }}</strong>.
            <span v-if="selectedContractType === 'pj'">Sem subordinação ou controle de ponto rígido; remuneração via NF.</span>
            <span v-else-if="selectedContractType === 'experiencia'">Duração probatória com teto legal inegociável de 90 dias.</span>
            <span v-else-if="selectedContractType === 'trabalho_intermitente'">Convocação prévia com 72h e quitação das verbas rescisórias fracionadas.</span>
            <span v-else-if="selectedContractType === 'prazo_determinado'">Vínculo condicionado a projeto ou evento, até 2 anos de duração.</span>
            <span v-else>Garantias completas da CLT, FGTS 8% mensal e estabilidades convencionais.</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
