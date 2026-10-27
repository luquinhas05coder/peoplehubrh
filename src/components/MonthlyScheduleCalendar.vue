<script setup lang="ts">
import { ref, computed } from "vue"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  Coffee,
  Sun,
  Zap,
  FileText,
  Edit3,
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert,
  X,
  Save,
  UserCheck,
  CalendarDays,
} from "lucide-vue-next"
import type {
  EmployeeFolder,
  WeeklyScheduleItem,
  DayScheduleType,
  MonthlyCalendarDayOverride,
} from "../data"
import { workScheduleConfigs } from "../data"
import {
  userPermissions,
  currentUser,
  updateEmployeeMonthlyCalendarOverride,
  removeEmployeeMonthlyCalendarOverride,
} from "../store"

const props = defineProps<{
  folder: EmployeeFolder
}>()

const emit = defineEmits<{
  (e: "toast", msg: string): void
}>()

// Navegação de Mês / Ano (Inicia em Agosto/2026 para coincidir com a competência ativa)
const currentYear = ref(2026)
const currentMonth = ref(7) // 0-indexed: 7 = Agosto

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function goToCurrentMonth() {
  currentYear.value = 2026
  currentMonth.value = 7
}

// Escala base semanal do colaborador
const baseWeeklyPattern = computed<WeeklyScheduleItem[]>(() => {
  if (props.folder.customSchedulePattern && props.folder.customSchedulePattern.length > 0) {
    return props.folder.customSchedulePattern
  }
  const sKey = props.folder.workSchedule || "escala_5x2"
  return workScheduleConfigs[sKey]?.schedulePattern || workScheduleConfigs.escala_5x2.schedulePattern
})

// Mapeia dia da semana JS (0 = Dom, 1 = Seg, ..., 6 = Sáb) para a chave da escala base
function getBaseItemForWeekDay(dayIndex: number): WeeklyScheduleItem {
  // na grade base: 0: Seg, 1: Ter, 2: Qua, 3: Qui, 4: Sex, 5: Sáb, 6: Dom
  const mapIdx = dayIndex === 0 ? 6 : dayIndex - 1
  return baseWeeklyPattern.value[mapIdx] || {
    day: "Seg",
    fullName: "Segunda-feira",
    isWorkDay: true,
    hours: "08:00 - 17:00",
    shift: "8h trab.",
  }
}

export interface CalendarDayCell {
  date: string // "YYYY-MM-DD"
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  dayOfWeek: number // 0-6
  type: DayScheduleType
  isWorkDay: boolean
  label: string
  hoursText: string
  shiftText: string
  isOverride: boolean
  overrideData?: MonthlyCalendarDayOverride
  note?: string
}

// Dias do Mês Calculados
const calendarCells = computed<CalendarDayCell[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()

  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Domingo
  const prevMonthLastDay = new Date(year, month, 0).getDate()

  const cells: CalendarDayCell[] = []

  // Dias preenchidos do mês anterior
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dNum = prevMonthLastDay - i
    const m = month === 0 ? 12 : month
    const y = month === 0 ? year - 1 : year
    const dStr = `${y}-${String(m).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`
    const dow = new Date(y, m - 1, dNum).getDay()
    const baseItem = getBaseItemForWeekDay(dow)

    cells.push({
      date: dStr,
      dayNumber: dNum,
      isCurrentMonth: false,
      isToday: false,
      dayOfWeek: dow,
      type: baseItem.isWorkDay ? "trabalho" : "folga",
      isWorkDay: baseItem.isWorkDay,
      label: baseItem.isWorkDay ? "Trabalho" : "Folga",
      hoursText: baseItem.hours,
      shiftText: baseItem.shift,
      isOverride: false,
    })
  }

  // Dias do mês atual
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const dow = new Date(year, month, day).getDay()
    const isToday = year === 2026 && month === 7 && day === 20

    const override = props.folder.customMonthlyOverrides?.[dStr]
    if (override) {
      let typeLabel = "Trabalho"
      let shift = "Escala Especial"
      if (override.type === "folga") {
        typeLabel = "Folga (DSR)"
        shift = "Descanso regulamentar"
      } else if (override.type === "ferias") {
        typeLabel = "Férias"
        shift = "Fruição de Férias"
      } else if (override.type === "prestador_especial") {
        typeLabel = "Prestador de Serviços (PJ)"
        shift = override.serviceProviderDetails?.serviceOrder || "Demanda Especial"
      } else if (override.type === "licenca_atestado") {
        typeLabel = "Atestado Médico"
        shift = "Licença Médica Abonada"
      } else if (override.type === "compensacao") {
        typeLabel = "Compensação"
        shift = "Banco de Horas"
      }

      const hText = override.isWorkDay
        ? `${override.entryTime || "08:00"} - ${override.exitTime || "17:00"}`
        : typeLabel

      cells.push({
        date: dStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        dayOfWeek: dow,
        type: override.type,
        isWorkDay: override.isWorkDay,
        label: typeLabel,
        hoursText: hText,
        shiftText: override.note || shift,
        isOverride: true,
        overrideData: override,
        note: override.note,
      })
    } else {
      // Regra da escala base pré-definida
      const baseItem = getBaseItemForWeekDay(dow)
      // Se colaborador está em férias no status global e estivermos no mês de agosto
      const isGlobalFerias = props.folder.status === "ferias" && month === 7 && day <= 15
      const finalType: DayScheduleType = isGlobalFerias
        ? "ferias"
        : baseItem.isWorkDay
        ? "trabalho"
        : "folga"

      cells.push({
        date: dStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        dayOfWeek: dow,
        type: finalType,
        isWorkDay: isGlobalFerias ? false : baseItem.isWorkDay,
        label: isGlobalFerias ? "Férias" : baseItem.isWorkDay ? "Trabalho" : "Folga (DSR)",
        hoursText: isGlobalFerias ? "Em Fruição" : baseItem.hours,
        shiftText: isGlobalFerias ? "Férias regulamentares" : baseItem.shift,
        isOverride: false,
      })
    }
  }

  // Completar grid para múltiplo de 7 (dias do mês seguinte)
  const remaining = (7 - (cells.length % 7)) % 7
  for (let day = 1; day <= remaining; day++) {
    const nextMonthNum = month === 11 ? 1 : month + 2
    const nextYear = month === 11 ? year + 1 : year
    const dStr = `${nextYear}-${String(nextMonthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const dow = new Date(nextYear, nextMonthNum - 1, day).getDay()
    const baseItem = getBaseItemForWeekDay(dow)

    cells.push({
      date: dStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: false,
      dayOfWeek: dow,
      type: baseItem.isWorkDay ? "trabalho" : "folga",
      isWorkDay: baseItem.isWorkDay,
      label: baseItem.isWorkDay ? "Trabalho" : "Folga",
      hoursText: baseItem.hours,
      shiftText: baseItem.shift,
      isOverride: false,
    })
  }

  return cells
})

// Estatísticas dinâmicas do mês atual
const monthStats = computed(() => {
  const currentMonthDays = calendarCells.value.filter((c) => c.isCurrentMonth)
  const workDays = currentMonthDays.filter((c) => c.type === "trabalho").length
  const folgaDays = currentMonthDays.filter((c) => c.type === "folga").length
  const feriasDays = currentMonthDays.filter((c) => c.type === "ferias").length
  const prestadorDays = currentMonthDays.filter((c) => c.type === "prestador_especial").length
  const atestadoDays = currentMonthDays.filter((c) => c.type === "licenca_atestado").length
  const customCount = currentMonthDays.filter((c) => c.isOverride).length

  // Estimativa de horas
  const estimatedHours = workDays * 8 + prestadorDays * 8

  return {
    totalDays: currentMonthDays.length,
    workDays,
    folgaDays,
    feriasDays,
    prestadorDays,
    atestadoDays,
    customCount,
    estimatedHours,
  }
})

// Estado do Modal de Edição de Dia (Apenas para Analistas/Gestores)
const showEditModal = ref(false)
const selectedCell = ref<CalendarDayCell | null>(null)
const editType = ref<DayScheduleType>("trabalho")
const editEntryTime = ref("08:00")
const editExitTime = ref("17:48")
const editBreakDuration = ref("01:00")
const editNote = ref("")
const editServiceOrder = ref("")
const editContractorRole = ref(props.folder.role || "Prestador de Serviços")
const editLocation = ref(props.folder.location || "Remoto / Híbrido")
const isSavingOverride = ref(false)

function openDayEditor(cell: CalendarDayCell) {
  if (!cell.isCurrentMonth) return
  if (!userPermissions.value.canEditSchedule) {
    emit("toast", "Edição permitida a partir do perfil de Analista de RH/DP.")
    return
  }

  selectedCell.value = cell
  editType.value = cell.type
  editNote.value = cell.overrideData?.note || ""

  if (cell.overrideData) {
    editEntryTime.value = cell.overrideData.entryTime || "08:00"
    editExitTime.value = cell.overrideData.exitTime || "17:48"
    editBreakDuration.value = cell.overrideData.breakDuration || "01:00"
    editServiceOrder.value = cell.overrideData.serviceProviderDetails?.serviceOrder || ""
    editContractorRole.value = cell.overrideData.serviceProviderDetails?.contractorRole || props.folder.role
    editLocation.value = cell.overrideData.serviceProviderDetails?.location || props.folder.location
  } else {
    const baseItem = getBaseItemForWeekDay(cell.dayOfWeek)
    editEntryTime.value = baseItem.entryTime || "08:00"
    editExitTime.value = baseItem.exitTime || "17:48"
    editBreakDuration.value = baseItem.breakDuration || "01:00"
    editServiceOrder.value = `OS-${cell.date.replace(/-/g, "")}`
  }

  showEditModal.value = true
}

function applyTimePreset(entry: string, exit: string, breakDur: string) {
  editEntryTime.value = entry
  editExitTime.value = exit
  editBreakDuration.value = breakDur
}

async function handleSaveDayOverride() {
  if (!selectedCell.value) return
  isSavingOverride.value = true

  const isWork = editType.value === "trabalho" || editType.value === "prestador_especial"

  const override: MonthlyCalendarDayOverride = {
    date: selectedCell.value.date,
    type: editType.value,
    isWorkDay: isWork,
    entryTime: isWork ? editEntryTime.value : undefined,
    exitTime: isWork ? editExitTime.value : undefined,
    breakDuration: isWork ? editBreakDuration.value : undefined,
    note: editNote.value.trim() || undefined,
    updatedBy: currentUser.value?.name || "Analista de RH",
    updatedAt: new Date().toISOString(),
  }

  if (editType.value === "prestador_especial") {
    override.serviceProviderDetails = {
      contractorRole: editContractorRole.value,
      serviceOrder: editServiceOrder.value,
      location: editLocation.value,
    }
  }

  await updateEmployeeMonthlyCalendarOverride(props.folder.id, override)
  isSavingOverride.value = false
  showEditModal.value = false
  emit("toast", `Dia ${selectedCell.value.date.split("-").reverse().join("/")} atualizado com sucesso!`)
}

async function handleResetDayOverride() {
  if (!selectedCell.value) return
  isSavingOverride.value = true
  await removeEmployeeMonthlyCalendarOverride(props.folder.id, selectedCell.value.date)
  isSavingOverride.value = false
  showEditModal.value = false
  emit("toast", `Dia ${selectedCell.value.date.split("-").reverse().join("/")} restaurado para a escala pré-definida.`)
}

// Estilos de badge por tipo de dia
function getDayStyle(type: DayScheduleType) {
  switch (type) {
    case "trabalho":
      return {
        bg: "bg-emerald-50/70 dark:bg-emerald-950/20",
        border: "border-emerald-200/80 dark:border-emerald-800/40",
        badgeBg: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
        icon: Briefcase,
        iconColor: "text-emerald-600 dark:text-emerald-400",
      }
    case "folga":
      return {
        bg: "bg-slate-50/80 dark:bg-slate-900/30",
        border: "border-slate-200/80 dark:border-slate-800/40",
        badgeBg: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
        icon: Coffee,
        iconColor: "text-slate-500",
      }
    case "ferias":
      return {
        bg: "bg-amber-50/80 dark:bg-amber-950/25",
        border: "border-amber-300/80 dark:border-amber-700/50",
        badgeBg: "bg-amber-500/20 text-amber-900 dark:text-amber-200",
        icon: Sun,
        iconColor: "text-amber-600 dark:text-amber-400",
      }
    case "prestador_especial":
      return {
        bg: "bg-purple-50/80 dark:bg-purple-950/25",
        border: "border-purple-300/80 dark:border-purple-700/50",
        badgeBg: "bg-purple-500/20 text-purple-900 dark:text-purple-200",
        icon: Zap,
        iconColor: "text-purple-600 dark:text-purple-400",
      }
    case "licenca_atestado":
      return {
        bg: "bg-rose-50/80 dark:bg-rose-950/25",
        border: "border-rose-300/80 dark:border-rose-700/50",
        badgeBg: "bg-rose-500/20 text-rose-900 dark:text-rose-200",
        icon: FileText,
        iconColor: "text-rose-600 dark:text-rose-400",
      }
    case "compensacao":
      return {
        bg: "bg-cyan-50/80 dark:bg-cyan-950/25",
        border: "border-cyan-300/80 dark:border-cyan-700/50",
        badgeBg: "bg-cyan-500/20 text-cyan-900 dark:text-cyan-200",
        icon: Clock,
        iconColor: "text-cyan-600 dark:text-cyan-400",
      }
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Top Header do Calendário com Permissões & Seletor de Mês -->
    <div class="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="rounded-xl bg-teal-500/10 p-2 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
              <CalendarDays :size="22" />
            </div>
            <div>
              <h3 class="text-base font-bold text-foreground">
                Calendário Mensal do Colaborador & Escala Personalizada
              </h3>
              <p class="text-xs text-muted-foreground">
                Escala pré-definida: <strong>{{ workScheduleConfigs[folder.workSchedule || 'escala_5x2']?.label }}</strong> · Colaborador: <strong>{{ folder.name }}</strong> ({{ folder.role }})
              </p>
            </div>
          </div>
        </div>

        <!-- Banner de Perfil de Acesso & Permissão Granular -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Colaborador -->
          <span
            v-if="userPermissions.isColaborador"
            class="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <UserCheck :size="13" /> Visualização do Colaborador (Somente Leitura)
          </span>

          <!-- Técnico -->
          <span
            v-else-if="userPermissions.isTecnico && !userPermissions.canEditSchedule"
            class="inline-flex items-center gap-1.5 rounded-full border border-blue-300/60 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <ShieldAlert :size="13" /> Visualização Técnica (Edição restrita a Analista de RH/DP)
          </span>

          <!-- Analista / Gestor -->
          <span
            v-else-if="userPermissions.canEditSchedule"
            class="inline-flex items-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/15 px-3 py-1 text-xs font-bold text-teal-800 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-200"
          >
            <Sparkles :size="13" class="text-teal-600 dark:text-teal-400" /> Modo Analista — Edição Habilitada nos Dias
          </span>
        </div>
      </div>

      <!-- Barra de Controle do Mês & Ano -->
      <div class="flex flex-col gap-3 pt-2 border-t sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <button
            class="p-2 rounded-xl border hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            @click="prevMonth"
            title="Mês Anterior"
          >
            <ChevronLeft :size="18" />
          </button>

          <span class="text-base font-bold text-foreground min-w-[170px] text-center">
            {{ monthNames[currentMonth] }} de {{ currentYear }}
          </span>

          <button
            class="p-2 rounded-xl border hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            @click="nextMonth"
            title="Próximo Mês"
          >
            <ChevronRight :size="18" />
          </button>

          <button
            v-if="currentMonth !== 7 || currentYear !== 2026"
            class="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-muted/50 hover:bg-muted transition-colors text-teal-700 dark:text-teal-300 cursor-pointer ml-1"
            @click="goToCurrentMonth"
          >
            Ir para Agosto/2026
          </button>
        </div>

        <!-- Indicador de Customizações Ativas no Mês -->
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span v-if="monthStats.customCount > 0" class="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full">
            <Sparkles :size="12" /> {{ monthStats.customCount }} {{ monthStats.customCount === 1 ? 'dia customizado' : 'dias customizados' }}
          </span>
          <span v-else class="text-muted-foreground">
            Escala 100% alinhada à regra base
          </span>
        </div>
      </div>
    </div>

    <!-- Cards de Métricas e Contadores do Mês (KPIs) -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div class="rounded-2xl border bg-card p-3.5 shadow-sm text-center">
        <span class="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
          <Briefcase :size="12" class="text-emerald-600" /> Dias de Trabalho
        </span>
        <p class="text-xl font-bold text-foreground mt-1">{{ monthStats.workDays }}</p>
        <p class="text-[10px] text-muted-foreground">escalados no mês</p>
      </div>

      <div class="rounded-2xl border bg-card p-3.5 shadow-sm text-center">
        <span class="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
          <Coffee :size="12" class="text-slate-500" /> Folgas / DSR
        </span>
        <p class="text-xl font-bold text-foreground mt-1">{{ monthStats.folgaDays }}</p>
        <p class="text-[10px] text-muted-foreground">descansos previstos</p>
      </div>

      <div class="rounded-2xl border bg-card p-3.5 shadow-sm text-center">
        <span class="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
          <Sun :size="12" class="text-amber-600" /> Férias no Mês
        </span>
        <p class="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{{ monthStats.feriasDays }}</p>
        <p class="text-[10px] text-muted-foreground">{{ monthStats.feriasDays > 0 ? 'em fruição legal' : 'nenhum período' }}</p>
      </div>

      <div class="rounded-2xl border bg-card p-3.5 shadow-sm text-center">
        <span class="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
          <Zap :size="12" class="text-purple-600" /> Prestador / PJ
        </span>
        <p class="text-xl font-bold text-purple-700 dark:text-purple-300 mt-1">{{ monthStats.prestadorDays }}</p>
        <p class="text-[10px] text-muted-foreground">escalas especiais</p>
      </div>

      <div class="rounded-2xl border bg-card p-3.5 shadow-sm text-center">
        <span class="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
          <FileText :size="12" class="text-rose-600" /> Atestados / Licença
        </span>
        <p class="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{{ monthStats.atestadoDays }}</p>
        <p class="text-[10px] text-muted-foreground">afastamentos</p>
      </div>

      <div class="rounded-2xl border bg-card p-3.5 shadow-sm text-center bg-teal-500/5">
        <span class="text-[11px] font-medium text-teal-800 dark:text-teal-300 flex items-center justify-center gap-1">
          <Clock :size="12" class="text-teal-600" /> Carga Projetada
        </span>
        <p class="text-xl font-bold text-teal-900 dark:text-teal-200 mt-1">{{ monthStats.estimatedHours }}h</p>
        <p class="text-[10px] text-muted-foreground">horas estimadas</p>
      </div>
    </div>

    <!-- Legenda de Cores e Tipos de Escala -->
    <div class="rounded-2xl border bg-muted/40 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div class="flex flex-wrap items-center gap-3">
        <span class="font-bold text-muted-foreground uppercase text-[10px] tracking-wide">Legenda:</span>
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-emerald-500"></span>
          <span class="text-foreground">Trabalho Normal</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-slate-400"></span>
          <span class="text-foreground">Folga / DSR</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-amber-500"></span>
          <span class="text-foreground">Férias</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-purple-500"></span>
          <span class="text-foreground">Escala Especial (Prestador / PJ)</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-rose-500"></span>
          <span class="text-foreground">Atestado / Licença</span>
        </div>
      </div>

      <div v-if="userPermissions.canEditSchedule" class="text-[11px] text-teal-700 dark:text-teal-300 flex items-center gap-1">
        <Edit3 :size="12" /> Dica: Clique em qualquer dia para alterar folgas, férias ou horários.
      </div>
      <div v-else class="text-[11px] text-muted-foreground flex items-center gap-1">
        <Info :size="12" /> Calendário em modo consulta. Alterações são gerenciadas pelo Analista de RH/DP.
      </div>
    </div>

    <!-- Grid do Calendário Mensal (7 Colunas: Domingo a Sábado) -->
    <div class="overflow-x-auto scrollbar-thin">
      <div class="rounded-2xl border bg-card shadow-sm overflow-hidden min-w-[560px]">
      <!-- Cabeçalho dos Dias da Semana -->
      <div class="grid grid-cols-7 border-b bg-muted/60 text-center font-bold text-xs text-muted-foreground divide-x">
        <div v-for="d in weekDayHeaders" :key="d" class="py-2.5">
          {{ d }}
        </div>
      </div>

      <!-- Células dos Dias -->
      <div class="grid grid-cols-7 divide-x divide-y bg-background">
        <div
          v-for="cell in calendarCells"
          :key="cell.date"
          class="min-h-[105px] p-2 flex flex-col justify-between transition-all relative group"
          :class="[
            !cell.isCurrentMonth ? 'opacity-35 bg-muted/10' : getDayStyle(cell.type).bg,
            cell.isToday ? 'ring-2 ring-teal-500 ring-inset z-10' : '',
            userPermissions.canEditSchedule && cell.isCurrentMonth ? 'hover:shadow-md cursor-pointer hover:border-teal-400' : '',
          ]"
          @click="openDayEditor(cell)"
        >
          <!-- Topo do Dia: Número e Badges -->
          <div class="flex items-center justify-between">
            <span
              class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
              :class="cell.isToday ? 'bg-teal-600 text-white shadow-sm' : 'text-foreground'"
            >
              {{ cell.dayNumber }}
            </span>

            <div class="flex items-center gap-1">
              <!-- Indicador de Override Manual -->
              <span
                v-if="cell.isOverride"
                class="rounded-full bg-amber-500/20 p-1 text-amber-700 dark:text-amber-300"
                title="Personalizado pelo Analista"
              >
                <Sparkles :size="11" />
              </span>

              <!-- Badge de 'Hoje' -->
              <span v-if="cell.isToday" class="rounded bg-teal-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                Hoje
              </span>
            </div>
          </div>

          <!-- Centro do Dia: Tipo de Escala e Ícone -->
          <div class="my-1.5 space-y-1">
            <div class="flex items-center gap-1">
              <component
                :is="getDayStyle(cell.type).icon"
                :size="12"
                :class="getDayStyle(cell.type).iconColor"
                class="shrink-0"
              />
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-bold truncate max-w-full"
                :class="getDayStyle(cell.type).badgeBg"
              >
                {{ cell.label }}
              </span>
            </div>

            <!-- Horários ou Detalhe -->
            <p class="text-[11px] font-medium text-foreground truncate pl-4">
              {{ cell.hoursText }}
            </p>
          </div>

          <!-- Rodapé do Dia: Turno / Motivo ou Botão de Editar -->
          <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
            <span class="truncate max-w-[90px]" :title="cell.shiftText">
              {{ cell.shiftText }}
            </span>

            <span
              v-if="userPermissions.canEditSchedule && cell.isCurrentMonth"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-teal-700 font-bold flex items-center gap-0.5 text-[9px]"
            >
              <Edit3 :size="10" /> Editar
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Modal de Edição de Dia da Escala (Para o Analista) -->
    <div
      v-if="showEditModal && selectedCell"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 my-auto max-h-[90dvh] overflow-y-auto scrollbar-thin">
        <!-- Topo do Modal -->
        <div class="flex items-center justify-between border-b pb-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold text-foreground">
                Personalizar Escala do Dia
              </h3>
              <span class="rounded-full bg-teal-500/15 text-teal-800 dark:text-teal-300 text-[10px] font-bold px-2 py-0.5">
                Modo Analista
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              Data: <strong>{{ selectedCell.date.split("-").reverse().join("/") }}</strong> ({{ selectedCell.dayNumber }} de {{ monthNames[currentMonth] }} de {{ currentYear }})
            </p>
          </div>
          <button
            @click="showEditModal = false"
            class="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="handleSaveDayOverride" class="space-y-4">
          <!-- 1. Seleção do Tipo de Escala / Situação do Dia -->
          <div>
            <label class="block text-xs font-bold text-foreground mb-1.5">
              Situação do Dia no Calendário:
            </label>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                class="rounded-xl border p-2.5 text-left transition-all cursor-pointer text-xs flex flex-col gap-1"
                :class="editType === 'trabalho' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/30' : 'hover:bg-muted text-foreground'"
                @click="editType = 'trabalho'"
              >
                <div class="flex items-center gap-1.5">
                  <Briefcase :size="14" class="text-emerald-600" />
                  <span>Trabalho Normal</span>
                </div>
                <span class="text-[10px] text-muted-foreground">Jornada padrão de expediente</span>
              </button>

              <button
                type="button"
                class="rounded-xl border p-2.5 text-left transition-all cursor-pointer text-xs flex flex-col gap-1"
                :class="editType === 'folga' ? 'border-slate-500 bg-slate-500/15 text-slate-900 dark:text-slate-200 font-bold ring-2 ring-slate-500/30' : 'hover:bg-muted text-foreground'"
                @click="editType = 'folga'"
              >
                <div class="flex items-center gap-1.5">
                  <Coffee :size="14" class="text-slate-600" />
                  <span>Folga (DSR)</span>
                </div>
                <span class="text-[10px] text-muted-foreground">Descanso semanal remunerado</span>
              </button>

              <button
                type="button"
                class="rounded-xl border p-2.5 text-left transition-all cursor-pointer text-xs flex flex-col gap-1"
                :class="editType === 'ferias' ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold ring-2 ring-amber-500/30' : 'hover:bg-muted text-foreground'"
                @click="editType = 'ferias'"
              >
                <div class="flex items-center gap-1.5">
                  <Sun :size="14" class="text-amber-600" />
                  <span>Férias</span>
                </div>
                <span class="text-[10px] text-muted-foreground">Período de gozo legal</span>
              </button>

              <button
                type="button"
                class="rounded-xl border p-2.5 text-left transition-all cursor-pointer text-xs flex flex-col gap-1"
                :class="editType === 'prestador_especial' ? 'border-purple-500 bg-purple-500/15 text-purple-900 dark:text-purple-200 font-bold ring-2 ring-purple-500/30' : 'hover:bg-muted text-foreground'"
                @click="editType = 'prestador_especial'"
              >
                <div class="flex items-center gap-1.5">
                  <Zap :size="14" class="text-purple-600" />
                  <span>Prestador PJ</span>
                </div>
                <span class="text-[10px] text-muted-foreground">Demanda ou plantão especial</span>
              </button>

              <button
                type="button"
                class="rounded-xl border p-2.5 text-left transition-all cursor-pointer text-xs flex flex-col gap-1"
                :class="editType === 'licenca_atestado' ? 'border-rose-500 bg-rose-500/15 text-rose-900 dark:text-rose-200 font-bold ring-2 ring-rose-500/30' : 'hover:bg-muted text-foreground'"
                @click="editType = 'licenca_atestado'"
              >
                <div class="flex items-center gap-1.5">
                  <FileText :size="14" class="text-rose-600" />
                  <span>Atestado / Licença</span>
                </div>
                <span class="text-[10px] text-muted-foreground">Afastamento médico abonado</span>
              </button>

              <button
                type="button"
                class="rounded-xl border p-2.5 text-left transition-all cursor-pointer text-xs flex flex-col gap-1"
                :class="editType === 'compensacao' ? 'border-cyan-500 bg-cyan-500/15 text-cyan-900 dark:text-cyan-200 font-bold ring-2 ring-cyan-500/30' : 'hover:bg-muted text-foreground'"
                @click="editType = 'compensacao'"
              >
                <div class="flex items-center gap-1.5">
                  <Clock :size="14" class="text-cyan-600" />
                  <span>Compensação</span>
                </div>
                <span class="text-[10px] text-muted-foreground">Folga por banco de horas</span>
              </button>
            </div>
          </div>

          <!-- 2. Horários de Expediente (se for Trabalho ou Prestador Especial) -->
          <div v-if="editType === 'trabalho' || editType === 'prestador_especial'" class="rounded-xl border p-3.5 bg-muted/30 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-foreground">Horários do Expediente:</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="text-[10px] rounded px-2 py-0.5 border hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
                  @click="applyTimePreset('08:00', '17:00', '01:00')"
                >
                  8h às 17h
                </button>
                <button
                  type="button"
                  class="text-[10px] rounded px-2 py-0.5 border hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
                  @click="applyTimePreset('08:00', '17:48', '01:00')"
                >
                  8h às 17h48 (5x2)
                </button>
                <button
                  type="button"
                  class="text-[10px] rounded px-2 py-0.5 border hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
                  @click="applyTimePreset('07:00', '19:00', '01:00')"
                >
                  Plantão 12h
                </button>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2.5">
              <div>
                <label class="block text-[11px] text-muted-foreground mb-1">Entrada:</label>
                <input
                  v-model="editEntryTime"
                  type="time"
                  required
                  class="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label class="block text-[11px] text-muted-foreground mb-1">Saída:</label>
                <input
                  v-model="editExitTime"
                  type="time"
                  required
                  class="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label class="block text-[11px] text-muted-foreground mb-1">Intervalo (Int.):</label>
                <input
                  v-model="editBreakDuration"
                  type="time"
                  class="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          <!-- 3. Campos Específicos para Prestador de Serviços / PJ -->
          <div v-if="editType === 'prestador_especial'" class="rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20 p-3.5 space-y-2.5">
            <span class="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <Zap :size="13" class="text-purple-600" /> Parâmetros de Prestação de Serviços (PJ / Especial):
            </span>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] text-purple-800 dark:text-purple-300 mb-1">Ordem de Serviço / Projeto:</label>
                <input
                  v-model="editServiceOrder"
                  type="text"
                  placeholder="Ex: OS-2026-DESENV-01"
                  class="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label class="block text-[11px] text-purple-800 dark:text-purple-300 mb-1">Modalidade / Local:</label>
                <input
                  v-model="editLocation"
                  type="text"
                  placeholder="Ex: Remoto / Sede do Cliente"
                  class="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <!-- 4. Observação / Justificativa do Analista -->
          <div>
            <label class="block text-xs font-bold text-foreground mb-1">
              Observação / Justificativa do Analista:
            </label>
            <input
              v-model="editNote"
              type="text"
              placeholder="Ex: Acordo de troca de folga, férias homologadas ou escala especial acordada"
              class="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <!-- Botões de Ação do Modal -->
          <div class="flex items-center justify-between border-t pt-4">
            <button
              v-if="selectedCell.isOverride"
              type="button"
              class="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              @click="handleResetDayOverride"
            >
              <RotateCcw :size="13" /> Restaurar Padrão da Escala
            </button>
            <div v-else></div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-xl border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                @click="showEditModal = false"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSavingOverride"
                class="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-700 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save :size="14" /> Salvar Escala do Dia
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
