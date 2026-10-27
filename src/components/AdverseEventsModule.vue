<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Send,
  Calendar,
  MapPin,
  Megaphone,
  X,
  Lock,
  ChevronRight,
} from "lucide-vue-next"
import {
  adverseEvents,
  adverseEventsStats,
  fetchAdverseEvents,
  createAdverseEvent,
  updateAdverseEventTratativa,
  announceAdverseEventToFeed,
  userPermissions,
  type AdverseEvent,
} from "../store"

const searchQuery = ref("")
const selectedStatus = ref<string>("todos")
const selectedCategory = ref<string>("todos")
const showNewModal = ref(false)
const showDetailModal = ref(false)
const selectedEvent = ref<AdverseEvent | null>(null)
const isSubmitting = ref(false)
const isUpdatingTratativa = ref(false)
const isAnnouncingFeed = ref(false)

// Form de novo relato
const newEvent = ref<{
  title: string
  category: string
  severity: "baixa" | "media" | "alta" | "critica"
  incident_date: string
  incident_location: string
  involved_parties: string
  description: string
  is_anonymous: boolean
  evidence_url: string
}>({
  title: "",
  category: "Segurança do Trabalho",
  severity: "media",
  incident_date: new Date().toISOString().split("T")[0],
  incident_location: "",
  involved_parties: "",
  description: "",
  is_anonymous: false,
  evidence_url: "",
})

// Form de tratativa (RH / Gestão)
const tratativaForm = ref<{
  status: AdverseEvent["status"]
  tratativa_notes: string
  measures_taken: string
  public_announcement: string
}>({
  status: "em_investigacao",
  tratativa_notes: "",
  measures_taken: "",
  public_announcement: "",
})

onMounted(() => {
  fetchAdverseEvents()
})

const categoriesList = [
  "Segurança do Trabalho",
  "Assédio Moral / Sexual",
  "Infraestrutura & Riscos",
  "Conduta & Ética",
  "Discriminação & Diversidade",
  "Ambiente de Trabalho",
  "Ergonomia & Saúde",
  "Outros",
]

const filteredEvents = computed(() => {
  return adverseEvents.value.filter((ev) => {
    const matchStatus =
      selectedStatus.value === "todos" || ev.status === selectedStatus.value
    const matchCategory =
      selectedCategory.value === "todos" || ev.category === selectedCategory.value
    const matchSearch =
      !searchQuery.value.trim() ||
      ev.protocol.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ev.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (ev.incident_location || "").toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchStatus && matchCategory && matchSearch
  })
})

function getSeverityBadge(sev: string) {
  switch (sev) {
    case "critica":
      return { label: "Crítica", class: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" }
    case "alta":
      return { label: "Alta", class: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" }
    case "media":
      return { label: "Média", class: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" }
    case "baixa":
    default:
      return { label: "Baixa", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" }
  }
}

function getStatusBadge(st: string) {
  switch (st) {
    case "registrado":
      return { label: "Novo / Registrado", class: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" }
    case "em_analise":
    case "em_investigacao":
      return { label: "Em Tratativa / Investigação", class: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" }
    case "medidas_adotadas":
      return { label: "Medidas Adotadas", class: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" }
    case "concluido":
      return { label: "Concluído", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" }
    case "arquivado":
    default:
      return { label: "Arquivado", class: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" }
  }
}

function openDetail(ev: AdverseEvent) {
  selectedEvent.value = ev
  tratativaForm.value = {
    status: ev.status,
    tratativa_notes: ev.tratativa_notes || "",
    measures_taken: ev.measures_taken || "",
    public_announcement: ev.public_announcement || "",
  }
  showDetailModal.value = true
}

async function handleCreateSubmit() {
  if (!newEvent.value.title.trim() || !newEvent.value.description.trim()) return
  isSubmitting.value = true
  const res = await createAdverseEvent(newEvent.value)
  isSubmitting.value = false
  if (res.ok) {
    showNewModal.value = false
    newEvent.value = {
      title: "",
      category: "Segurança do Trabalho",
      severity: "media",
      incident_date: new Date().toISOString().split("T")[0],
      incident_location: "",
      involved_parties: "",
      description: "",
      is_anonymous: false,
      evidence_url: "",
    }
  }
}

async function handleSaveTratativa() {
  if (!selectedEvent.value) return
  isUpdatingTratativa.value = true
  const res = await updateAdverseEventTratativa(selectedEvent.value.id, tratativaForm.value)
  isUpdatingTratativa.value = false
  if (res.ok) {
    if (selectedEvent.value) {
      selectedEvent.value.status = tratativaForm.value.status
      selectedEvent.value.tratativa_notes = tratativaForm.value.tratativa_notes
      selectedEvent.value.measures_taken = tratativaForm.value.measures_taken
      selectedEvent.value.public_announcement = tratativaForm.value.public_announcement
    }
  }
}

async function handleAnnounceFeed() {
  if (!selectedEvent.value) return
  isAnnouncingFeed.value = true
  const res = await announceAdverseEventToFeed(selectedEvent.value.id)
  isAnnouncingFeed.value = false
  if (res.ok) {
    selectedEvent.value.announced_to_feed = 1
  }
}
</script>

<template>
  <main class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative p-3.5 sm:p-6 lg:p-8">
    <div class="mx-auto w-full max-w-6xl space-y-6">

      <!-- CABEÇALHO DO CANAL DE EVENTOS ADVERSOS -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2.5">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs shrink-0">
              <ShieldAlert :size="22" />
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  Canal de Eventos Adversos & Ouvidoria
                </h1>
                <span class="ph-badge-info text-[10px]">
                  Canal Seguro & Sigiloso
                </span>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                Espaço para notificar ocorrências, riscos e incidentes de trabalho, acompanhar tratativas internas e conferir medidas adotadas.
              </p>
            </div>
          </div>
        </div>

        <button
          class="ph-btn-primary shrink-0"
          @click="showNewModal = true"
        >
          <Plus :size="16" />
          <span>Informar Evento Adverso</span>
        </button>
      </div>

      <!-- CARDS DE MÉTRICAS OPERACIONAIS -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div class="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span class="text-xs font-semibold text-muted-foreground">Total Relatado</span>
          <p class="mt-1 text-2xl font-black text-foreground">{{ adverseEventsStats.total }}</p>
        </div>
        <div class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-2xs">
          <span class="text-xs font-semibold text-blue-700 dark:text-blue-300">Novos Registros</span>
          <p class="mt-1 text-2xl font-black text-blue-700 dark:text-blue-300">{{ adverseEventsStats.novos }}</p>
        </div>
        <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-2xs">
          <span class="text-xs font-semibold text-amber-700 dark:text-amber-300">Em Tratativa / CIPA</span>
          <p class="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">{{ adverseEventsStats.em_tratativa }}</p>
        </div>
        <div class="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 shadow-2xs">
          <span class="text-xs font-semibold text-teal-700 dark:text-teal-300">Medidas Adotadas</span>
          <p class="mt-1 text-2xl font-black text-teal-700 dark:text-teal-300">{{ adverseEventsStats.com_medidas }}</p>
        </div>
        <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-2xs">
          <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Concluídos</span>
          <p class="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{{ adverseEventsStats.concluidos }}</p>
        </div>
      </div>

      <!-- BARRA DE PESQUISA E FILTROS -->
      <div class="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="relative w-full sm:w-80">
          <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por protocolo, título ou local..."
            class="ph-input w-full py-2.5 pl-10 pr-4 text-xs"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <!-- Filtro por Status -->
          <select
            v-model="selectedStatus"
            class="ph-select px-3 py-2 text-xs font-medium"
          >
            <option value="todos">Todos os Status</option>
            <option value="registrado">Novos / Registrados</option>
            <option value="em_investigacao">Em Tratativa / Investigação</option>
            <option value="medidas_adotadas">Medidas Adotadas</option>
            <option value="concluido">Concluídos</option>
          </select>

          <!-- Filtro por Categoria -->
          <select
            v-model="selectedCategory"
            class="ph-select px-3 py-2 text-xs font-medium"
          >
            <option value="todos">Todas as Categorias</option>
            <option v-for="cat in categoriesList" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
      </div>

      <!-- LISTA DE EVENTOS ADVERSOS -->
      <div v-if="filteredEvents.length === 0" class="rounded-3xl border bg-card p-12 text-center space-y-3">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShieldAlert :size="28" />
        </div>
        <h3 class="font-bold text-foreground">Nenhum evento adverso encontrado</h3>
        <p class="text-xs text-muted-foreground max-w-md mx-auto">
          Nenhum registro corresponde aos critérios selecionados ou nenhum evento foi reportado até o momento.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 gap-3.5">
        <div
          v-for="ev in filteredEvents"
          :key="ev.id"
          class="rounded-2xl border bg-card p-5 hover:border-teal-500/40 transition-all shadow-2xs group flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
          @click="openDetail(ev)"
        >
          <div class="space-y-2 flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs font-black text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                {{ ev.protocol }}
              </span>
              <span
                class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shadow-2xs"
                :class="getSeverityBadge(ev.severity).class"
              >
                Severidade {{ getSeverityBadge(ev.severity).label }}
              </span>
              <span class="text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border">
                {{ ev.category }}
              </span>
              <span
                v-if="ev.announced_to_feed"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                title="Medidas divulgadas publicamente no feed corporativo"
              >
                <Megaphone :size="11" /> No Feed da Empresa
              </span>
            </div>

            <h3 class="text-sm font-bold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
              {{ ev.title }}
            </h3>
            <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {{ ev.description }}
            </p>

            <div class="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground pt-1">
              <span class="flex items-center gap-1">
                <Calendar :size="13" /> Ocorrido em: <strong>{{ ev.incident_date }}</strong>
              </span>
              <span v-if="ev.incident_location" class="flex items-center gap-1">
                <MapPin :size="13" /> Local: <strong>{{ ev.incident_location }}</strong>
              </span>
              <span class="flex items-center gap-1">
                <Lock v-if="ev.is_anonymous" :size="13" class="text-amber-500" />
                Relator: <strong>{{ ev.reporter_name || (ev.is_anonymous ? 'Sigiloso / Anônimo' : 'Colaborador') }}</strong>
              </span>
            </div>
          </div>

          <!-- Status & Ação -->
          <div class="flex items-center sm:flex-col sm:items-end justify-between gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 shrink-0">
            <span
              class="text-xs font-bold px-3 py-1 rounded-full border shadow-2xs"
              :class="getStatusBadge(ev.status).class"
            >
              {{ getStatusBadge(ev.status).label }}
            </span>

            <span class="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
              Ver Tratativa <ChevronRight :size="15" />
            </span>
          </div>
        </div>
      </div>

    </div>

    <!-- MODAL 1: REGISTRAR NOVO EVENTO ADVERSO -->
    <div
      v-if="showNewModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 sm:p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-2xl rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xl space-y-5 max-h-[90dvh] overflow-y-auto scrollbar-thin text-foreground">
        <div class="flex items-center justify-between border-b border-border pb-4">
          <div class="flex items-center gap-2.5">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <ShieldAlert :size="20" />
            </div>
            <div>
              <h2 class="text-base font-bold text-foreground">Relatar Evento Adverso / Incidente</h2>
              <p class="text-xs text-muted-foreground">Inicie uma tratativa oficial com total sigilo e acolhimento do RH.</p>
            </div>
          </div>
          <button @click="showNewModal = false" class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="handleCreateSubmit" class="space-y-4 text-xs">
          <!-- Toggle Anônimo -->
          <div class="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/40">
            <div class="flex items-center gap-2.5">
              <Lock :size="17" class="text-amber-500" />
              <div>
                <span class="font-bold text-foreground">Relato Totalmente Anônimo</span>
                <p class="text-[11px] text-muted-foreground">Sua identidade e e-mail não serão associados ao protocolo.</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="newEvent.is_anonymous" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div>
            <label class="font-bold text-foreground">Título Resumido da Ocorrência *</label>
            <input
              v-model="newEvent.title"
              type="text"
              required
              placeholder="Ex: Falha no isolamento térmico da sala 2 ou risco elétrico"
              class="ph-input w-full mt-1 p-3 text-xs"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-foreground">Categoria do Ocorrido *</label>
              <select
                v-model="newEvent.category"
                class="ph-select w-full mt-1 p-3 text-xs"
              >
                <option v-for="cat in categoriesList" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>

            <div>
              <label class="font-bold text-foreground">Nível de Severidade Estimado</label>
              <select
                v-model="newEvent.severity"
                class="ph-select w-full mt-1 p-3 text-xs"
              >
                <option value="baixa">Baixa (Incômodo sem risco físico iminente)</option>
                <option value="media">Média (Impacto operacional moderado)</option>
                <option value="alta">Alta (Risco à segurança ou bem-estar)</option>
                <option value="critica">Crítica (Risco grave e urgente)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-foreground">Data do Ocorrido *</label>
              <input
                v-model="newEvent.incident_date"
                type="date"
                required
                class="ph-input w-full mt-1 p-3 text-xs"
              />
            </div>

            <div>
              <label class="font-bold text-foreground">Local Específico (Prédio, Andar, Sala)</label>
              <input
                v-model="newEvent.incident_location"
                type="text"
                placeholder="Ex: Almoxarifado Central, Bloco B"
                class="ph-input w-full mt-1 p-3 text-xs"
              />
            </div>
          </div>

          <div>
            <label class="font-bold text-foreground">Descrição Detalhada do Evento *</label>
            <textarea
              v-model="newEvent.description"
              required
              rows="4"
              placeholder="Descreva com detalhes o que aconteceu, horários, possíveis causas ou riscos observados..."
              class="ph-input w-full mt-1 p-3 text-xs"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              class="ph-btn-secondary px-4 py-2.5"
              @click="showNewModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="ph-btn-primary px-5 py-2.5 disabled:opacity-60"
            >
              <Send :size="14" />
              <span>{{ isSubmitting ? 'Registrando...' : 'Registrar Notificação' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: DETALHES DO EVENTO, TRATATIVA E ANÚNCIO DE MEDIDAS -->
    <div
      v-if="showDetailModal && selectedEvent"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 sm:p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-3xl rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xl space-y-6 max-h-[90dvh] overflow-y-auto scrollbar-thin text-foreground">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border pb-4">
          <div class="flex items-center gap-3">
            <span class="font-mono text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-xl border border-primary/20">
              {{ selectedEvent.protocol }}
            </span>
            <div>
              <h2 class="text-base font-bold text-foreground">{{ selectedEvent.title }}</h2>
              <span class="text-xs text-muted-foreground">Ocorrência em {{ selectedEvent.incident_date }} · {{ selectedEvent.category }}</span>
            </div>
          </div>
          <button @click="showDetailModal = false" class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <!-- Descrição e Metadados do Relato -->
        <div class="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-xs">
          <div class="flex flex-wrap items-center gap-4 text-muted-foreground border-b border-border pb-2.5">
            <span>Local: <strong class="text-foreground">{{ selectedEvent.incident_location || 'Não informado' }}</strong></span>
            <span>Severidade: <strong class="text-foreground capitalize">{{ selectedEvent.severity }}</strong></span>
            <span>Relator: <strong class="text-foreground">{{ selectedEvent.reporter_name || (selectedEvent.is_anonymous ? 'Sigiloso / Anônimo' : 'Colaborador') }}</strong></span>
          </div>

          <div>
            <span class="font-bold text-foreground">Descrição do Ocorrido:</span>
            <p class="mt-1 text-foreground leading-relaxed whitespace-pre-wrap">{{ selectedEvent.description }}</p>
          </div>
        </div>

        <!-- SEÇÃO DE TRATATIVA (DISPONÍVEL AO RH / GESTÃO / ADMIN) -->
        <div class="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-primary/20 pb-3">
            <div class="flex items-center gap-2">
              <Clock :size="16" class="text-primary" />
              <h3 class="text-xs font-bold uppercase tracking-wider text-foreground">
                Tratativa do Incidente & Ações do RH
              </h3>
            </div>
            <span class="text-[11px] font-semibold text-muted-foreground">
              Responsável: {{ selectedEvent.tratativa_by || 'Em definição' }}
            </span>
          </div>

          <div v-if="userPermissions.isRH || userPermissions.isAdmin || userPermissions.isGestor" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-foreground">Status Atual da Ocorrência</label>
                <select
                  v-model="tratativaForm.status"
                  class="ph-select w-full mt-1 p-2.5 text-xs font-medium"
                >
                  <option value="registrado">Registrado / Triagem Inicial</option>
                  <option value="em_investigacao">Em Investigação / Análise Técnica</option>
                  <option value="medidas_adotadas">Medidas Adotadas / Em Implantação</option>
                  <option value="concluido">Concluído & Finalizado</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>

              <div>
                <label class="font-bold text-foreground">Última Atualização Registrada</label>
                <input
                  type="text"
                  disabled
                  :value="selectedEvent.tratativa_updated_at || 'Ainda sem atualizações'"
                  class="ph-input w-full mt-1 p-2.5 text-xs text-muted-foreground opacity-75"
                />
              </div>
            </div>

            <div>
              <label class="font-bold text-foreground">Notas Internas da Investigação (CIPA / RH / Infraestrutura)</label>
              <textarea
                v-model="tratativaForm.tratativa_notes"
                rows="3"
                placeholder="Ex: Realizada vistoria no local com eletricista no dia 15/09. Foi aprovado o orçamento de manutenção predial..."
                class="ph-input w-full mt-1 p-3 text-xs"
              ></textarea>
            </div>

            <div>
              <label class="font-bold text-foreground">Medidas e Soluções Adotadas (Resolução Oficial)</label>
              <textarea
                v-model="tratativaForm.measures_taken"
                rows="3"
                placeholder="Descreva as melhorias, equipamentos substituídos, advertências, treinamentos ou políticas implantadas..."
                class="ph-input w-full mt-1 p-3 text-xs"
              ></textarea>
            </div>

            <div>
              <label class="font-bold text-foreground">Texto do Anúncio Público (Para transparência corporativa)</label>
              <input
                v-model="tratativaForm.public_announcement"
                type="text"
                placeholder="Ex: Medida Concluída: Finalizada a modernização elétrica e iluminação do Almoxarifado Central."
                class="ph-input w-full mt-1 p-2.5 text-xs"
              />
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                :disabled="isUpdatingTratativa"
                class="ph-btn-secondary"
                @click="handleSaveTratativa"
              >
                <CheckCircle2 :size="15" class="text-primary" />
                <span>{{ isUpdatingTratativa ? 'Salvando...' : 'Salvar Andamento da Tratativa' }}</span>
              </button>

              <!-- Botão Anunciar Medidas no Feed Corporativo -->
              <button
                type="button"
                :disabled="isAnnouncingFeed || !tratativaForm.measures_taken.trim()"
                class="ph-btn-primary"
                @click="handleAnnounceFeed"
              >
                <Megaphone :size="15" />
                <span>{{ isAnnouncingFeed ? 'Publicando...' : selectedEvent.announced_to_feed ? 'Atualizar Medida no Feed' : '📢 Anunciar Medidas no Feed' }}</span>
              </button>
            </div>
          </div>

          <!-- Visualização para Colaborador (apenas leitura das medidas adotadas) -->
          <div v-else class="space-y-3 text-xs">
            <div v-if="selectedEvent.measures_taken">
              <span class="font-bold text-foreground">Medidas Tomadas pela Empresa:</span>
              <p class="mt-1 text-muted-foreground whitespace-pre-wrap leading-relaxed">{{ selectedEvent.measures_taken }}</p>
            </div>
            <div v-else class="text-muted-foreground italic">
              Este evento está sob análise ativa e investigação pela equipe de Recursos Humanos e Segurança do Trabalho. Assim que as medidas forem implementadas, elas serão exibidas aqui e no Feed de Comunicados.
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-2 border-t border-border">
          <button
            class="ph-btn-secondary"
            @click="showDetailModal = false"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>

  </main>
</template>
