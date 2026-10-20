<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Users,
  Briefcase,
  X,
  RefreshCw,
} from "lucide-vue-next"
import { apiFetch, showToast, hasPermission } from "../store"

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  category: "ferias" | "workflow_deadline" | "treinamento" | "feriado" | "reuniao" | "geral"
  start_date: string
  end_date: string
  department?: string
  employee_name?: string
  is_all_day?: boolean
  location?: string
  source?: string
}

const loading = ref(false)
const events = ref<CalendarEvent[]>([])
const currentDate = ref(new Date())
const selectedDate = ref<Date>(new Date())
const selectedCategory = ref("todos")
const selectedDepartment = ref("todos")

const showNewModal = ref(false)
const newEvent = ref({
  title: "",
  category: "treinamento",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  department: "Geral",
  location: "Auditório Principal / Google Meet",
  description: "",
  isAllDay: true,
})

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const currentMonthLabel = computed(() => `${MONTH_NAMES[currentMonth.value]} de ${currentYear.value}`)

async function fetchEvents() {
  loading.value = true
  try {
    const res = await apiFetch("/api/calendar/events")
    const data = await res.json()
    if (data.ok && Array.isArray(data.events)) {
      events.value = data.events
    }
  } catch (err: any) {
    showToast("Falha ao carregar eventos do calendário: " + err.message, "error")
  } finally {
    loading.value = false
  }
}

function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

function goToToday() {
  currentDate.value = new Date()
  selectedDate.value = new Date()
}

// Geração dos dias do mês com preenchimento de semanas
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = []

  // Dias do mês anterior
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i)
    days.push({
      date: d,
      isCurrentMonth: false,
      dateStr: d.toISOString().slice(0, 10),
    })
  }

  // Dias do mês atual
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    days.push({
      date: d,
      isCurrentMonth: true,
      dateStr: d.toISOString().slice(0, 10),
    })
  }

  // Dias do próximo mês para fechar a grade (múltiplo de 7)
  const remaining = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    days.push({
      date: d,
      isCurrentMonth: false,
      dateStr: d.toISOString().slice(0, 10),
    })
  }

  return days
})

const filteredEvents = computed(() => {
  return events.value.filter((ev) => {
    const matchCat = selectedCategory.value === "todos" || ev.category === selectedCategory.value
    const matchDept = selectedDepartment.value === "todos" || ev.department === selectedDepartment.value || ev.department === "Geral"
    return matchCat && matchDept
  })
})

function getEventsForDay(dateStr: string): CalendarEvent[] {
  return filteredEvents.value.filter((ev) => {
    // Normalizar datas para formato AAAA-MM-DD
    const start = ev.start_date.slice(0, 10)
    const end = (ev.end_date || ev.start_date).slice(0, 10)
    return dateStr >= start && dateStr <= end
  })
}

const selectedDayEvents = computed(() => {
  const targetStr = selectedDate.value.toISOString().slice(0, 10)
  return getEventsForDay(targetStr)
})

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function isSelected(date: Date): boolean {
  return (
    date.getDate() === selectedDate.value.getDate() &&
    date.getMonth() === selectedDate.value.getMonth() &&
    date.getFullYear() === selectedDate.value.getFullYear()
  )
}

function getEventBadgeStyle(category: string): string {
  switch (category) {
    case "ferias":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    case "workflow_deadline":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    case "treinamento":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
    case "feriado":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
    case "reuniao":
      return "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
    default:
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30"
  }
}

async function handleCreateEvent() {
  if (!newEvent.value.title.trim()) {
    showToast("Informe o título do evento.", "warning")
    return
  }

  try {
    const res = await apiFetch("/api/calendar/events", {
      method: "POST",
      body: JSON.stringify(newEvent.value),
    })
    const data = await res.json()
    if (data.ok) {
      showToast("Evento adicionado ao calendário!", "success")
      showNewModal.value = false
      await fetchEvents()
    } else {
      showToast(data.error || "Erro ao registrar evento.", "error")
    }
  } catch (err: any) {
    showToast("Falha de rede: " + err.message, "error")
  }
}

onMounted(() => {
  fetchEvents()
})
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-background space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
          <CalendarIcon :size="26" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Calendário Corporativo Integrado
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
              Prazos & Férias em Tempo Real
            </span>
          </h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            Visão consolidada de férias de colaboradores, vencimentos de workflows, treinamentos e feriados.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="fetchEvents"
          :disabled="loading"
          class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">Atualizar</span>
        </button>

        <button
          v-if="hasPermission('calendar.manage')"
          @click="showNewModal = true"
          class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all"
        >
          <Plus :size="18" />
          <span>Agendar Evento</span>
        </button>
      </div>
    </div>

    <!-- Navegação do Mês e Filtros -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
      <div class="flex items-center gap-2">
        <button
          @click="prevMonth"
          class="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft :size="18" />
        </button>
        <div class="font-bold text-sm sm:text-base text-foreground min-w-[170px] text-center">
          {{ currentMonthLabel }}
        </div>
        <button
          @click="nextMonth"
          class="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight :size="18" />
        </button>
        <button
          @click="goToToday"
          class="ml-2 px-2.5 py-1 text-xs font-semibold rounded-md border hover:bg-muted text-foreground transition-colors cursor-pointer"
        >
          Hoje
        </button>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        <select
          v-model="selectedCategory"
          class="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
        >
          <option value="todos">Todas Categorias</option>
          <option value="ferias">Férias Aprovadas</option>
          <option value="workflow_deadline">Prazos de Workflow</option>
          <option value="treinamento">Treinamentos</option>
          <option value="feriado">Feriados Corporativos</option>
          <option value="reuniao">Reuniões de Gestão</option>
        </select>

        <select
          v-model="selectedDepartment"
          class="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
        >
          <option value="todos">Todos Departamentos</option>
          <option value="Geral">Geral</option>
          <option value="TI">TI</option>
          <option value="RH">RH</option>
          <option value="Operações">Operações</option>
          <option value="Comercial">Comercial</option>
        </select>
      </div>
    </div>

    <!-- Layout Principal: Grade do Mês + Painel Lateral do Dia -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Grade Mensal -->
      <div class="lg:col-span-3 bg-card rounded-2xl border p-4 shadow-2xs overflow-hidden">
        <!-- Dias da Semana -->
        <div class="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-foreground uppercase py-2 border-b">
          <span>Dom</span>
          <span>Seg</span>
          <span>Ter</span>
          <span>Qua</span>
          <span>Qui</span>
          <span>Sex</span>
          <span>Sáb</span>
        </div>

        <!-- Células dos Dias -->
        <div class="grid grid-cols-7 gap-1.5 mt-2">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            @click="selectedDate = day.date"
            class="min-h-[90px] sm:min-h-[105px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between"
            :class="{
              'bg-muted/15 text-muted-foreground border-transparent': !day.isCurrentMonth,
              'bg-card hover:border-teal-500/50': day.isCurrentMonth,
              'ring-2 ring-teal-500/60 border-teal-500 bg-teal-500/5': isSelected(day.date),
            }"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full transition-colors"
                :class="{
                  'bg-teal-600 text-white shadow-2xs': isToday(day.date),
                  'text-foreground': !isToday(day.date) && day.isCurrentMonth,
                  'text-muted-foreground': !day.isCurrentMonth,
                }"
              >
                {{ day.date.getDate() }}
              </span>

              <span
                v-if="getEventsForDay(day.dateStr).length > 2"
                class="text-[9px] font-bold text-muted-foreground"
              >
                +{{ getEventsForDay(day.dateStr).length - 2 }}
              </span>
            </div>

            <!-- Chips de Eventos do Dia -->
            <div class="space-y-1 mt-1 overflow-hidden">
              <div
                v-for="ev in getEventsForDay(day.dateStr).slice(0, 2)"
                :key="ev.id"
                class="text-[10px] font-medium px-1.5 py-0.5 rounded truncate border leading-tight"
                :class="getEventBadgeStyle(ev.category)"
                :title="`${ev.title} (${ev.category})`"
              >
                {{ ev.title }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Painel Lateral: Detalhes do Dia Selecionado -->
      <div class="bg-card rounded-2xl border p-4 shadow-2xs flex flex-col space-y-4">
        <div class="border-b pb-3">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Eventos do Dia</span>
          <h2 class="text-lg font-bold text-foreground capitalize mt-0.5">
            {{ selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
          </h2>
        </div>

        <div class="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
          <div
            v-for="ev in selectedDayEvents"
            :key="ev.id"
            class="p-3 rounded-xl border space-y-2 transition-all hover:shadow-xs"
            :class="getEventBadgeStyle(ev.category)"
          >
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-xs font-bold text-foreground">{{ ev.title }}</h3>
              <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border bg-background/60">
                {{ ev.category }}
              </span>
            </div>

            <p v-if="ev.description" class="text-xs text-muted-foreground leading-relaxed">
              {{ ev.description }}
            </p>

            <div class="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
              <div v-if="ev.employee_name" class="flex items-center gap-1.5">
                <Users :size="12" class="text-teal-500" />
                <span class="font-medium text-foreground">{{ ev.employee_name }}</span>
              </div>
              <div v-if="ev.location" class="flex items-center gap-1.5">
                <MapPin :size="12" class="text-teal-500" />
                <span>{{ ev.location }}</span>
              </div>
              <div v-if="ev.department" class="flex items-center gap-1.5">
                <Briefcase :size="12" class="text-teal-500" />
                <span>Setor: {{ ev.department }}</span>
              </div>
            </div>
          </div>

          <div v-if="!selectedDayEvents.length" class="text-center py-12 text-muted-foreground space-y-2">
            <CalendarIcon :size="28" class="mx-auto text-muted-foreground/40" />
            <p class="text-xs font-medium">Nenhum evento agendado para esta data.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Agendamento de Evento Corporativo -->
    <div
      v-if="showNewModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-card w-full max-w-lg rounded-2xl border shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="p-5 border-b flex items-center justify-between bg-muted/20">
          <div>
            <h2 class="text-base font-bold text-foreground flex items-center gap-2">
              <CalendarIcon :size="18" class="text-teal-500" />
              Agendar Evento Corporativo
            </h2>
            <p class="text-xs text-muted-foreground">Registre treinamentos, reuniões de gestão e comunicados no calendário.</p>
          </div>
          <button @click="showNewModal = false" class="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X :size="18" />
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground">Título do Evento *</label>
            <input
              v-model="newEvent.title"
              type="text"
              placeholder="Ex.: Treinamento de Segurança & LGPD"
              class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-2 focus:ring-teal-500/30"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Categoria</label>
              <select
                v-model="newEvent.category"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
              >
                <option value="treinamento">Treinamento</option>
                <option value="reuniao">Reunião de Gestão</option>
                <option value="feriado">Feriado / Ponte</option>
                <option value="geral">Geral / Institucional</option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Departamento</label>
              <select
                v-model="newEvent.department"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
              >
                <option value="Geral">Geral (Toda a Empresa)</option>
                <option value="TI">TI</option>
                <option value="RH">RH</option>
                <option value="Operações">Operações</option>
                <option value="Comercial">Comercial</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Data de Início</label>
              <input
                v-model="newEvent.startDate"
                type="date"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground">Data de Término</label>
              <input
                v-model="newEvent.endDate"
                type="date"
                class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground">Local / Link da Chamada</label>
            <input
              v-model="newEvent.location"
              type="text"
              placeholder="Ex.: Google Meet / Auditório B"
              class="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground">Descrição / Pauta</label>
            <textarea
              v-model="newEvent.description"
              rows="2"
              placeholder="Breve resumo do evento ou instruções para os participantes..."
              class="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border"
            ></textarea>
          </div>
        </div>

        <div class="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <button @click="showNewModal = false" class="px-4 py-2 text-sm font-semibold rounded-lg border hover:bg-muted">
            Cancelar
          </button>
          <button @click="handleCreateEvent" class="px-5 py-2 text-sm font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
            Salvar no Calendário
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
