<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Users,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
  Mail,
  RefreshCw,
  Layers
} from "lucide-vue-next"
import { showToast } from "../store"

interface OrgNode {
  id: string
  name: string
  role: string
  department: string
  email: string
  avatar?: string
  status: string
  manager?: string
  subordinates: OrgNode[]
  totalSubordinates?: number
}

const isLoading = ref(true)
const orgTree = ref<OrgNode[]>([])
const departments = ref<string[]>([])
const totalEmployees = ref(0)
const searchQuery = ref("")
const selectedDept = ref("todos")
const expandedNodes = ref<Record<string, boolean>>({})

async function loadOrgChart() {
  isLoading.value = true
  try {
    const res = await fetch("/api/org-chart")
    if (res.ok) {
      const data = await res.json()
      orgTree.value = data.tree || []
      departments.value = data.departments || []
      totalEmployees.value = data.totalEmployees || 0

      // Auto-expandir os 2 primeiros níveis
      const exp: Record<string, boolean> = {}
      function markExpanded(nodes: OrgNode[], depth = 0) {
        if (depth > 1) return
        for (const n of nodes) {
          exp[n.id] = true
          if (n.subordinates?.length) {
            markExpanded(n.subordinates, depth + 1)
          }
        }
      }
      markExpanded(orgTree.value)
      expandedNodes.value = exp
    } else {
      showToast("Não foi possível carregar o organograma.", "error")
    }
  } catch (err: any) {
    showToast(`Erro de conexão com organograma: ${err.message}`, "error")
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadOrgChart()
})

function toggleNode(nodeId: string) {
  expandedNodes.value[nodeId] = !expandedNodes.value[nodeId]
}

function expandAll() {
  const exp: Record<string, boolean> = {}
  function recurse(nodes: OrgNode[]) {
    for (const n of nodes) {
      exp[n.id] = true
      if (n.subordinates?.length) recurse(n.subordinates)
    }
  }
  recurse(orgTree.value)
  expandedNodes.value = exp
}

function collapseAll() {
  expandedNodes.value = {}
}

// Filtro recursivo para busca
function filterNode(node: OrgNode, q: string, dept: string): OrgNode | null {
  const matchesDept = dept === "todos" || node.department === dept
  const matchesQuery =
    !q ||
    node.name.toLowerCase().includes(q) ||
    node.role.toLowerCase().includes(q) ||
    node.email.toLowerCase().includes(q)

  const filteredSubs: OrgNode[] = []
  if (node.subordinates?.length) {
    for (const sub of node.subordinates) {
      const matchSub = filterNode(sub, q, dept)
      if (matchSub) filteredSubs.push(matchSub)
    }
  }

  if ((matchesDept && matchesQuery) || filteredSubs.length > 0) {
    return {
      ...node,
      subordinates: filteredSubs,
    }
  }

  return null
}

const filteredTree = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const dept = selectedDept.value

  if (!q && dept === "todos") {
    return orgTree.value
  }

  const result: OrgNode[] = []
  for (const root of orgTree.value) {
    const matched = filterNode(root, q, dept)
    if (matched) result.push(matched)
  }
  return result
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header com estatísticas e ações -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
      <div>
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Users :size="24" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">Organograma Interativo</h1>
            <p class="text-xs text-muted-foreground">
              Estrutura hierárquica corporativa, lideranças e equipes do PeopleHub
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="loadOrgChart"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-muted transition-colors cursor-pointer"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': isLoading }" />
          Atualizar
        </button>
        <button
          type="button"
          @click="expandAll"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-muted transition-colors cursor-pointer"
        >
          Expandir Todos
        </button>
        <button
          type="button"
          @click="collapseAll"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-muted transition-colors cursor-pointer"
        >
          Recolher
        </button>
      </div>
    </div>

    <!-- Barra de Filtros e Busca -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="relative sm:col-span-2">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por colaborador, cargo ou e-mail..."
          class="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div>
        <select
          v-model="selectedDept"
          class="w-full px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
        >
          <option value="todos">Todos os Departamentos</option>
          <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
    </div>

    <!-- Resumo de Indicadores -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div class="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
        <span class="text-muted-foreground flex items-center gap-1.5 font-medium">
          <Users :size="14" class="text-teal-500" /> Total no Organograma
        </span>
        <strong class="text-base text-foreground font-bold">{{ totalEmployees }} colaboradores</strong>
      </div>
      <div class="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
        <span class="text-muted-foreground flex items-center gap-1.5 font-medium">
          <Building2 :size="14" class="text-blue-500" /> Departamentos Ativos
        </span>
        <strong class="text-base text-foreground font-bold">{{ departments.length }} áreas</strong>
      </div>
      <div class="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
        <span class="text-muted-foreground flex items-center gap-1.5 font-medium">
          <Layers :size="14" class="text-purple-500" /> Linhas de Liderança
        </span>
        <strong class="text-base text-foreground font-bold">{{ orgTree.length }} líderes executivos</strong>
      </div>
    </div>

    <!-- Árvore do Organograma -->
    <div class="rounded-2xl border bg-card/30 p-4 sm:p-6 min-h-[400px]">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <RefreshCw :size="28" class="animate-spin text-teal-500" />
        <span class="text-sm">Construindo hierarquia corporativa...</span>
      </div>

      <div v-else-if="filteredTree.length === 0" class="text-center py-16 text-muted-foreground space-y-2">
        <Users :size="36" class="mx-auto text-muted-foreground/50" />
        <p class="text-sm font-semibold">Nenhum colaborador encontrado com os filtros selecionados.</p>
        <button
          type="button"
          @click="searchQuery = ''; selectedDept = 'todos'"
          class="text-xs text-teal-600 hover:underline"
        >
          Limpar filtros de busca
        </button>
      </div>

      <div v-else class="space-y-4">
        <!-- Recursão de nós -->
        <div v-for="node in filteredTree" :key="node.id" class="org-tree-root">
          <div class="flex items-start gap-3">
            <!-- Botão de expansão se tiver subordinados -->
            <button
              v-if="node.subordinates?.length"
              type="button"
              @click="toggleNode(node.id)"
              class="mt-3 p-1 rounded-lg border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shrink-0"
              :aria-label="expandedNodes[node.id] ? 'Recolher liderados' : 'Expandir liderados'"
            >
              <ChevronDown v-if="expandedNodes[node.id]" :size="14" />
              <ChevronRight v-else :size="14" />
            </button>
            <div v-else class="w-6 shrink-0"></div>

            <!-- Card do Colaborador -->
            <div
              class="flex-1 p-3.5 rounded-xl border bg-card hover:border-teal-500/50 hover:shadow-md transition-all group"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm"
                  >
                    {{ node.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') }}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="text-sm font-bold text-foreground group-hover:text-teal-600 transition-colors">
                        {{ node.name }}
                      </h4>
                      <span
                        v-if="node.subordinates?.length"
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                      >
                        {{ node.subordinates.length }} liderado{{ node.subordinates.length > 1 ? 's' : '' }}
                      </span>
                    </div>
                    <p class="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{{ node.role }}</span>
                      <span>·</span>
                      <span class="font-medium text-foreground/80">{{ node.department }}</span>
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-3 text-xs text-muted-foreground self-start sm:self-center">
                  <a
                    :href="'mailto:' + node.email"
                    class="flex items-center gap-1 hover:text-teal-600 transition-colors"
                    :title="node.email"
                  >
                    <Mail :size="13" />
                    <span class="hidden md:inline">{{ node.email }}</span>
                  </a>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    :class="node.status === 'ativo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
                  >
                    {{ node.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Filhos / Subordinados diretos -->
          <div
            v-if="node.subordinates?.length && expandedNodes[node.id]"
            class="pl-6 sm:pl-10 mt-3 border-l-2 border-teal-500/20 ml-3 space-y-3"
          >
            <div v-for="sub in node.subordinates" :key="sub.id">
              <div class="flex items-start gap-3">
                <button
                  v-if="sub.subordinates?.length"
                  type="button"
                  @click="toggleNode(sub.id)"
                  class="mt-2.5 p-1 rounded-lg border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shrink-0"
                >
                  <ChevronDown v-if="expandedNodes[sub.id]" :size="14" />
                  <ChevronRight v-else :size="14" />
                </button>
                <div v-else class="w-6 shrink-0"></div>

                <div class="flex-1 p-3 rounded-xl border bg-background hover:border-teal-500/40 transition-all">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                      <div
                        class="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0"
                      >
                        {{ sub.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') }}
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-bold text-foreground">{{ sub.name }}</span>
                          <span
                            v-if="sub.subordinates?.length"
                            class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-muted text-muted-foreground"
                          >
                            {{ sub.subordinates.length }} sub
                          </span>
                        </div>
                        <p class="text-[11px] text-muted-foreground">
                          {{ sub.role }} · <strong class="font-medium">{{ sub.department }}</strong>
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span class="text-xs">{{ sub.email }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Nível 3 se houver -->
              <div
                v-if="sub.subordinates?.length && expandedNodes[sub.id]"
                class="pl-6 sm:pl-10 mt-2 border-l-2 border-teal-500/20 ml-3 space-y-2"
              >
                <div
                  v-for="sub3 in sub.subordinates"
                  :key="sub3.id"
                  class="p-2.5 rounded-lg border bg-muted/30 flex items-center justify-between text-xs"
                >
                  <div>
                    <strong class="text-foreground">{{ sub3.name }}</strong>
                    <span class="text-muted-foreground ml-2">({{ sub3.role }})</span>
                  </div>
                  <span class="text-[10px] text-muted-foreground">{{ sub3.department }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
