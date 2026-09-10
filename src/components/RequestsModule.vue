<script setup lang="ts">
import { ref, computed } from "vue"
import {
  CalendarCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  FileCheck,
  DollarSign,
  Briefcase,
  LayoutGrid,
  List,
  Eye,
  Download,
  X,
  Trash2,
  Receipt,
} from "lucide-vue-next"
import type { RequestType, RequestStatus, RequestPriority, RequestItem } from "../data"
import { requestTypeLabels, requestStatusLabels } from "../data"
import { requests, updateRequestStatus, deleteRequest, employeeFolders, userRoleType, userPermissions } from "../store"

import UserAvatar from "./UserAvatar.vue"
import NewRequestModal from "./NewRequestModal.vue"
import HoleriteCard from "./HoleriteCard.vue"

const search = ref("")
const selectedType = ref<string>("todos")
const selectedStatus = ref<string>("todos")
const viewMode = ref<"grid" | "table">("grid")

const showNewModal = ref(false)
const selectedDetailRequest = ref<RequestItem | null>(null)
const reviewNoteInput = ref("")

const toastText = ref<string | null>(null)

function showToast(msg: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = null
  }, 2500)
}

/* Títulos e Contexto Adaptados ao Cargo */
const pageTitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Minhas Solicitações e Atendimento"
  if (userRoleType.value === "dp") return "Central de Solicitações de DP & Folha"
  if (userRoleType.value === "ti") return "Central de Solicitações de TI & Infra"
  return "Central de Solicitações do RH"
})

const pageSubtitle = computed(() => {
  if (userRoleType.value === "colaborador") return "Acompanhe o andamento dos seus pedidos de declarações, férias, contra-cheques e suporte."
  if (userRoleType.value === "dp") return "Gerencie e aprove emissões de contra-cheques, espelho de ponto, atestados e reembolsos salariais."
  if (userRoleType.value === "ti") return "Gerencie e aprove acessos a sistemas, liberação de VPN, equipamentos e suporte técnico."
  return "Acompanhe, analise e aprove solicitações de férias, atestados, declarações e desempenho."
})

/* Indicadores */
const totalCount = computed(() => requests.value.length)
const pendingCount = computed(() => requests.value.filter((r) => r.status === "pendente" || r.status === "em_analise").length)
const approvedCount = computed(() => requests.value.filter((r) => r.status === "aprovado").length)
const rejectedCount = computed(() => requests.value.filter((r) => r.status === "recusado").length)

/* Filtros */
const filteredRequests = computed(() => {
  return requests.value.filter((r) => {
    const matchesType = selectedType.value === "todos" || r.type === selectedType.value
    const matchesStatus = selectedStatus.value === "todos" || r.status === selectedStatus.value
    const q = search.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      r.protocol.toLowerCase().includes(q) ||
      r.employeeName.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    return matchesType && matchesStatus && matchesSearch
  })
})

function getTypeIcon(type: RequestType) {
  switch (type) {
    case "ferias":
      return CalendarCheck
    case "atestado":
      return FileText
    case "reembolso":
      return DollarSign
    case "ponto":
      return Clock
    case "documento":
      return FileCheck
    case "contracheque":
      return Receipt
    default:
      return Briefcase
  }
}

function getTypeColor(type: RequestType) {
  switch (type) {
    case "ferias":
      return "var(--color-primary)"
    case "atestado":
      return "var(--color-danger)"
    case "reembolso":
      return "var(--color-success)"
    case "ponto":
      return "var(--color-accent)"
    case "documento":
      return "var(--color-telegram)"
    case "contracheque":
      return "var(--color-primary)"
    default:
      return "var(--color-primary)"
  }
}

function getFolderForRequest(req: RequestItem) {
  const found = employeeFolders.value.find((f) => f.name.toLowerCase() === req.employeeName.toLowerCase())
  if (found) return found
  return {
    id: "req-emp",
    name: req.employeeName,
    initials: req.employeeInitials,
    cpf: "123.456.789-00",
    registration: "MAT-2026-102",
    role: req.employeeRole,
    department: req.department,
    email: `${req.employeeName.toLowerCase().replace(/\s+/g, ".")}@empresa.com`,
    phone: "(11) 98888-0000",
    location: "São Paulo, SP",
    tenure: "1 ano",
    manager: "Gestão RH",
    admissionDate: "01/02/2022",
    status: "ativo" as const,
    documents: [],
    cbo: "2124-05",
    cboTitle: "Analista de TI / RH",
    salary: req.amount || "R$ 6.500,00",
  }
}

function getStatusBadgeClass(status: RequestStatus) {
  switch (status) {
    case "pendente":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    case "em_analise":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
    case "aprovado":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    case "recusado":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getPriorityBadgeClass(priority: RequestPriority) {
  switch (priority) {
    case "urgente":
      return "bg-red-500/10 text-red-600 font-bold border-red-500/30 animate-pulse"
    case "alta":
      return "bg-orange-500/10 text-orange-600 font-semibold border-orange-500/30"
    case "media":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30"
    case "baixa":
      return "bg-gray-500/10 text-gray-600 border-gray-500/30"
  }
}

function handleApprove(req: RequestItem) {
  updateRequestStatus(req.id, "aprovado", "Victor Silva", "Solicitação aprovada pelo RH.")
  showToast(`Solicitação "${req.protocol}" aprovada!`)
  if (selectedDetailRequest.value?.id === req.id) {
    selectedDetailRequest.value.status = "aprovado"
  }
}

function handleReject(req: RequestItem) {
  const note = reviewNoteInput.value.trim() || "Solicitação não atende aos requisitos ou faltam comprovantes."
  updateRequestStatus(req.id, "recusado", "Victor Silva", note)
  showToast(`Solicitação "${req.protocol}" recusada.`)
  if (selectedDetailRequest.value?.id === req.id) {
    selectedDetailRequest.value.status = "recusado"
    selectedDetailRequest.value.reviewNote = note
  }
  reviewNoteInput.value = ""
}

function openDetail(req: RequestItem) {
  selectedDetailRequest.value = { ...req }
}

function closeDetail() {
  selectedDetailRequest.value = null
  reviewNoteInput.value = ""
}

function handleDelete(req: RequestItem) {
  if (confirm(`Deseja remover a solicitação ${req.protocol}?`)) {
    deleteRequest(req.id)
    showToast(`Solicitação ${req.protocol} excluída.`)
    if (selectedDetailRequest.value?.id === req.id) {
      closeDetail()
    }
  }
}

function handleCreated(msg: string) {
  showToast(msg)
}
</script>

<template>
  <main class="flex h-full flex-col overflow-y-auto scrollbar-thin bg-background relative text-foreground">
    <!-- Toast local -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="toastText"
        class="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-2xl"
      >
        {{ toastText }}
      </div>
    </transition>

    <!-- Modal Nova Solicitação -->
    <NewRequestModal
      v-if="showNewModal"
      @close="showNewModal = false"
      @created="handleCreated"
    />

    <!-- Header Principal -->
    <header class="border-b bg-card px-5 py-5 sm:px-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarCheck :size="16" class="text-primary" />
            <span>Módulo de Gestão de Solicitações • {{ userRoleType.toUpperCase() }}</span>
          </div>
          <h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {{ pageTitle }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ pageSubtitle }}
          </p>
        </div>

        <button
          class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 active:scale-95 shrink-0 cursor-pointer"
          style="background-color: var(--color-primary)"
          @click="showNewModal = true"
        >
          <Plus :size="18" />
          <span>{{ userPermissions.isColaborador ? 'Solicitar Documento / Serviço' : 'Nova Solicitação' }}</span>
        </button>
      </div>
    </header>

    <div class="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 space-y-6">
      <!-- Indicadores Rápidos -->
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none">{{ totalCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Total de Solicitações</p>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 relative">
            <Clock :size="22" />
            <span v-if="pendingCount" class="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-amber-500 animate-ping" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none text-amber-600 dark:text-amber-400">{{ pendingCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Pendentes / Análise</p>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-400">{{ approvedCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Aprovadas</p>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <XCircle :size="22" />
          </div>
          <div>
            <p class="text-2xl font-bold leading-none text-rose-600 dark:text-rose-400">{{ rejectedCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Recusadas</p>
          </div>
        </div>
      </section>

      <!-- Barra de Filtros e Controles -->
      <section class="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <!-- Linha Superior: Busca e Modos de Exibição -->
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <!-- Campo de Busca -->
          <div class="relative flex-1">
            <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="search"
              type="text"
              placeholder="Buscar por colaborador, protocolo, título ou departamento..."
              class="w-full rounded-xl border bg-background pl-10 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <!-- Filtro de Status + Modo Grid/Tabela -->
          <div class="flex items-center gap-3">
            <select
              v-model="selectedStatus"
              class="rounded-xl border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendentes</option>
              <option value="em_analise">Em Análise</option>
              <option value="aprovado">Aprovadas</option>
              <option value="recusado">Recusadas</option>
            </select>

            <div class="flex items-center rounded-xl border bg-background p-1">
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                :class="viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
                aria-label="Modo Grid"
                @click="viewMode = 'grid'"
              >
                <LayoutGrid :size="16" />
              </button>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                :class="viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
                aria-label="Modo Tabela"
                @click="viewMode = 'table'"
              >
                <List :size="16" />
              </button>
            </div>
          </div>
        </div>

        <!-- Abas por Tipo de Solicitação -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-t pt-3">
          <button
            class="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
            :class="selectedType === 'todos' ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'"
            @click="selectedType = 'todos'"
          >
            Todas Categorias
          </button>
          <button
            v-for="(label, typeKey) in requestTypeLabels"
            :key="typeKey"
            class="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
            :class="selectedType === typeKey ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'"
            @click="selectedType = typeKey"
          >
            {{ label }}
          </button>
        </div>
      </section>

      <!-- Lista de Solicitações (Modo Grid) -->
      <section v-if="viewMode === 'grid'">
        <div v-if="filteredRequests.length === 0" class="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <CalendarCheck :size="48" class="text-muted-foreground/40 mb-3" />
          <h3 class="text-lg font-bold">Nenhuma solicitação no momento</h3>
          <p class="text-sm text-muted-foreground mt-1 max-w-md">As solicitações enviadas pelos colaboradores ou abertas no sistema aparecerão aqui.</p>
          <button
            class="mt-4 rounded-xl py-2 px-5 text-xs font-semibold text-primary-foreground shadow"
            style="background-color: var(--color-primary)"
            @click="showNewModal = true"
          >
            + Criar Nova Solicitação
          </button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="req in filteredRequests"
            :key="req.id"
            class="group flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div>
              <!-- Cabeçalho do Card (Status & Protocolo) -->
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="text-[11px] font-mono font-bold tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {{ req.protocol }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider" :class="getStatusBadgeClass(req.status)">
                    {{ requestStatusLabels[req.status] }}
                  </span>
                  <span class="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase" :class="getPriorityBadgeClass(req.priority)">
                    {{ req.priority }}
                  </span>
                </div>
              </div>

              <!-- Tipo & Título -->
              <div class="flex items-start gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  :style="{ backgroundColor: getTypeColor(req.type) + '1a', color: getTypeColor(req.type) }"
                >
                  <component :is="getTypeIcon(req.type)" :size="20" />
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="font-semibold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                    {{ req.title }}
                  </h3>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    {{ requestTypeLabels[req.type] }}
                  </p>
                </div>
              </div>

              <!-- Descrição -->
              <p class="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {{ req.description }}
              </p>

              <!-- Período ou Valor -->
              <div v-if="req.startDate || req.amount" class="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                <span v-if="req.startDate" class="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-muted-foreground">
                  <Clock :size="12" /> {{ req.startDate }} {{ req.endDate ? `até ${req.endDate}` : '' }}
                </span>
                <span v-if="req.amount" class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-bold text-emerald-600 dark:text-emerald-400">
                  {{ req.amount }}
                </span>
              </div>
            </div>

            <!-- Footer do Card (Solicitante & Ações) -->
            <div class="mt-5 border-t pt-4">
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2 min-w-0">
                  <UserAvatar :initials="req.employeeInitials" :size="30" />
                  <div class="min-w-0">
                    <p class="text-xs font-semibold truncate">{{ req.employeeName }}</p>
                    <p class="text-[11px] text-muted-foreground truncate">{{ req.department }}</p>
                  </div>
                </div>
                <span class="text-[11px] text-muted-foreground shrink-0">{{ req.createdAt }}</span>
              </div>

              <!-- Mensagem de Espera / Acompanhamento para o Colaborador -->
              <div v-if="userPermissions.isColaborador" class="mt-2 space-y-2">
                <div
                  v-if="req.status === 'pendente' || req.status === 'em_analise'"
                  class="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-300 font-semibold"
                >
                  <Clock :size="16" class="animate-spin shrink-0" />
                  <span>Aguardando análise da equipe. Aguarde a resposta!</span>
                </div>

                <div
                  v-else-if="req.status === 'aprovado'"
                  class="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold"
                >
                  <CheckCircle2 :size="16" class="shrink-0" />
                  <span>Solicitação concluída/atendida com sucesso!</span>
                </div>

                <div
                  v-else-if="req.status === 'recusado'"
                  class="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-700 dark:text-rose-300 font-semibold"
                >
                  <XCircle :size="16" class="shrink-0" />
                  <span>Solicitação analisada (Ver detalhes da resposta)</span>
                </div>

                <button
                  class="w-full rounded-xl border bg-background py-2 px-3 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  @click="openDetail(req)"
                >
                  <Eye :size="15" /> Ver Detalhes e Status
                </button>
              </div>

              <!-- Ações Rápidas de Gestão (Exclusivas para RH, DP e TI) -->
              <div v-else class="flex items-center gap-2">
                <button
                  class="flex-1 rounded-xl border bg-background py-1.5 px-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  @click="openDetail(req)"
                >
                  <Eye :size="14" /> Detalhes
                </button>
                <button
                  v-if="req.status === 'pendente' || req.status === 'em_analise'"
                  class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-xs font-bold shadow transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Aprovar Solicitação"
                  @click="handleApprove(req)"
                >
                  <CheckCircle2 :size="14" /> Aprovar
                </button>
                <button
                  v-if="req.status === 'pendente' || req.status === 'em_analise'"
                  class="rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-1.5 px-2 text-xs font-bold shadow transition-colors flex items-center justify-center cursor-pointer"
                  title="Recusar Solicitação"
                  @click="handleReject(req)"
                >
                  <XCircle :size="14" />
                </button>
                <button
                  class="rounded-xl border border-red-200 bg-background hover:bg-red-50 text-red-600 py-1.5 px-2.5 text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer"
                  title="Apagar Solicitação"
                  @click="handleDelete(req)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Modo Tabela -->
      <section v-else class="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-muted/50 border-b font-semibold uppercase text-muted-foreground">
              <tr>
                <th class="px-4 py-3">Protocolo</th>
                <th class="px-4 py-3">Solicitante</th>
                <th class="px-4 py-3">Tipo / Título</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Prioridade</th>
                <th class="px-4 py-3">Data</th>
                <th class="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="req in filteredRequests" :key="req.id" class="hover:bg-muted/30 transition-colors">
                <td class="px-4 py-3 font-mono font-bold">{{ req.protocol }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <UserAvatar :initials="req.employeeInitials" :size="28" />
                    <div>
                      <p class="font-semibold text-foreground">{{ req.employeeName }}</p>
                      <p class="text-[10px] text-muted-foreground">{{ req.department }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p class="font-medium text-foreground text-xs">{{ req.title }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ requestTypeLabels[req.type] }}</p>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase" :class="getStatusBadgeClass(req.status)">
                    {{ requestStatusLabels[req.status] }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase" :class="getPriorityBadgeClass(req.priority)">
                    {{ req.priority }}
                  </span>
                </td>
                <td class="px-4 py-3 text-muted-foreground">{{ req.createdAt }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Ver Detalhes" @click="openDetail(req)">
                      <Eye :size="16" />
                    </button>
                    <template v-if="!userPermissions.isColaborador">
                      <button v-if="req.status !== 'aprovado'" class="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-600" title="Aprovar" @click="handleApprove(req)">
                        <CheckCircle2 :size="16" />
                      </button>
                      <button class="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="Excluir" @click="handleDelete(req)">
                        <Trash2 :size="16" />
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Drawer / Modal de Detalhes da Solicitação -->
    <div v-if="selectedDetailRequest" class="fixed inset-0 z-50 flex items-center justify-end p-4 sm:p-6">
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="closeDetail" />

      <div
        class="relative w-full h-full max-h-[92vh] overflow-y-auto rounded-2xl bg-card border shadow-2xl z-10 p-6 flex flex-col justify-between"
        :class="selectedDetailRequest.type === 'contracheque' ? 'max-w-4xl' : 'max-w-lg'"
      >
        <div>
          <!-- Top Header -->
          <div class="flex items-center justify-between border-b pb-4">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-md">{{ selectedDetailRequest.protocol }}</span>
              <span class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase" :class="getStatusBadgeClass(selectedDetailRequest.status)">
                {{ requestStatusLabels[selectedDetailRequest.status] }}
              </span>
            </div>
            <button class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" @click="closeDetail">
              <X :size="20" />
            </button>
          </div>

          <!-- Body Info -->
          <div class="mt-5 space-y-4">
            <div>
              <h2 class="text-xl font-bold">{{ selectedDetailRequest.title }}</h2>
              <p class="text-xs text-muted-foreground mt-0.5">Tipo: {{ requestTypeLabels[selectedDetailRequest.type] }}</p>
            </div>

            <!-- Solicitante -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
              <UserAvatar :initials="selectedDetailRequest.employeeInitials" :size="40" />
              <div>
                <p class="text-sm font-bold">{{ selectedDetailRequest.employeeName }}</p>
                <p class="text-xs text-muted-foreground">{{ selectedDetailRequest.employeeRole }} — {{ selectedDetailRequest.department }}</p>
              </div>
            </div>

            <!-- SE FOR CONTRA-CHEQUE: VISUALIZADOR DE HOLERITE COMPLETO -->
            <div v-if="selectedDetailRequest.type === 'contracheque'" class="mt-4">
              <HoleriteCard :folder="getFolderForRequest(selectedDetailRequest)" @toast="showToast" />
            </div>

            <!-- Descrição detalhada -->
            <div class="rounded-xl border p-4 bg-background">
              <p class="text-xs font-semibold uppercase text-muted-foreground mb-1">Descrição / Justificativa</p>
              <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ selectedDetailRequest.description }}</p>
            </div>

            <!-- Período / Valor -->
            <div v-if="selectedDetailRequest.startDate || selectedDetailRequest.amount" class="grid grid-cols-2 gap-3 text-xs">
              <div v-if="selectedDetailRequest.startDate" class="p-3 rounded-xl border bg-background">
                <p class="font-semibold text-muted-foreground">Período Solicitado</p>
                <p class="font-bold mt-1 text-sm">{{ selectedDetailRequest.startDate }} {{ selectedDetailRequest.endDate ? `até ${selectedDetailRequest.endDate}` : '' }}</p>
              </div>
              <div v-if="selectedDetailRequest.amount" class="p-3 rounded-xl border bg-background">
                <p class="font-semibold text-muted-foreground">Valor Solicitado</p>
                <p class="font-bold text-emerald-600 dark:text-emerald-400 mt-1 text-sm">{{ selectedDetailRequest.amount }}</p>
              </div>
            </div>

            <!-- Anexo -->
            <div v-if="selectedDetailRequest.attachment" class="p-3 rounded-xl border bg-background flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileText :size="20" class="text-primary" />
                <span class="text-xs font-medium truncate">{{ selectedDetailRequest.attachment }}</span>
              </div>
              <button class="flex items-center gap-1 text-xs font-bold text-primary hover:underline" @click="showToast('Download do anexo simulado com sucesso.')">
                <Download :size="14" /> Baixar
              </button>
            </div>

            <!-- Histórico de Revisão -->
            <div v-if="selectedDetailRequest.reviewedBy" class="p-3 rounded-xl border bg-muted/30 text-xs space-y-1">
              <p class="font-bold text-muted-foreground">Analisado por: <span class="text-foreground">{{ selectedDetailRequest.reviewedBy }}</span></p>
              <p v-if="selectedDetailRequest.reviewNote" class="italic text-muted-foreground">"{{ selectedDetailRequest.reviewNote }}"</p>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="mt-6 border-t pt-4 space-y-3">
          <!-- Visão do Colaborador (Somente leitura e acompanhamento) -->
          <div v-if="userPermissions.isColaborador" class="space-y-3">
            <div class="rounded-xl bg-muted/40 border p-3 text-xs text-muted-foreground">
              <p class="font-semibold text-foreground flex items-center gap-1.5">
                <Clock :size="14" class="text-primary" /> Status do Atendimento
              </p>
              <p class="mt-1">
                Sua solicitação foi registrada no sistema. A equipe responsável analisará seu pedido e você receberá a resposta por aqui ou no Chat Interno.
              </p>
            </div>
            <button
              class="w-full rounded-xl border py-2.5 text-xs font-bold text-foreground hover:bg-muted cursor-pointer transition-colors"
              @click="closeDetail"
            >
              Fechar Detalhes
            </button>
          </div>

          <!-- Visão Gestor (RH / DP / TI) com ações de Aprovação e Exclusão -->
          <div v-else class="space-y-3">
            <div v-if="selectedDetailRequest.status === 'pendente' || selectedDetailRequest.status === 'em_analise'">
              <input
                v-model="reviewNoteInput"
                type="text"
                placeholder="Observação da decisão do RH (opcional)..."
                class="w-full rounded-xl border bg-background px-3 py-2 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div class="flex gap-2">
                <button
                  class="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-bold shadow flex items-center justify-center gap-1 cursor-pointer"
                  @click="handleApprove(selectedDetailRequest)"
                >
                  <CheckCircle2 :size="16" /> Aprovar Solicitação
                </button>
                <button
                  class="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-2.5 text-xs font-bold shadow flex items-center justify-center gap-1 cursor-pointer"
                  @click="handleReject(selectedDetailRequest)"
                >
                  <XCircle :size="16" /> Recusar Solicitação
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                class="flex-1 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                @click="handleDelete(selectedDetailRequest)"
              >
                <Trash2 :size="15" /> Excluir Solicitação
              </button>
              <button class="flex-1 rounded-xl border py-2 text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer" @click="closeDetail">
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
