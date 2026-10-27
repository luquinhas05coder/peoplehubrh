<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Sparkles,
  Play,
  Save,
  Download,
  Filter,
  Layers,
  BarChart3,
  PieChart,
  Trash2,
  Plus,
  Table as TableIcon,
  FileSpreadsheet,
  FileText,
} from "lucide-vue-next"
import { apiFetch, showToast } from "../store"
import { Bar, Doughnut } from "vue-chartjs"

export interface SavedReportItem {
  id: string
  title: string
  description?: string
  entity_type: string
  filters: any[]
  columns: string[]
  group_by?: string
  chart_type?: string
  created_at: string
}

const ENTITY_CONFIG: Record<
  string,
  { label: string; columns: { key: string; label: string; type: "string" | "number" | "date" }[] }
> = {
  employees: {
    label: "Colaboradores (Quadro de Pessoal)",
    columns: [
      { key: "name", label: "Nome Completo", type: "string" },
      { key: "role", label: "Cargo / Função", type: "string" },
      { key: "department", label: "Departamento", type: "string" },
      { key: "status", label: "Status (Ativo/Inativo)", type: "string" },
      { key: "hireDate", label: "Data de Admissão", type: "date" },
      { key: "salary", label: "Salário Base", type: "string" },
      { key: "manager", label: "Gestor Imediato", type: "string" },
      { key: "location", label: "Unidade / Local", type: "string" },
      { key: "contractType", label: "Tipo de Contrato (CLT/PJ)", type: "string" },
      { key: "workSchedule", label: "Regime de Escala", type: "string" },
    ],
  },
  requests: {
    label: "Solicitações & Chamados de RH",
    columns: [
      { key: "requester", label: "Solicitante", type: "string" },
      { key: "type", label: "Tipo de Solicitação", type: "string" },
      { key: "status", label: "Status do Chamado", type: "string" },
      { key: "priority", label: "Prioridade", type: "string" },
      { key: "department", label: "Departamento", type: "string" },
      { key: "date", label: "Data do Pedido", type: "date" },
    ],
  },
  workflows: {
    label: "Workflows & Processos de RH",
    columns: [
      { key: "title", label: "Título do Workflow", type: "string" },
      { key: "category", label: "Categoria", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "employee_name", label: "Colaborador Associado", type: "string" },
      { key: "due_date", label: "Prazo de Conclusão", type: "date" },
      { key: "created_at", label: "Data de Início", type: "date" },
    ],
  },
  evaluations: {
    label: "Avaliações de Desempenho",
    columns: [
      { key: "employee_name", label: "Colaborador Avaliado", type: "string" },
      { key: "evaluator_name", label: "Avaliador", type: "string" },
      { key: "type", label: "Tipo (Auto / Liderança)", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "final_score", label: "Nota Final Ponderada", type: "number" },
      { key: "submitted_at", label: "Data de Envio", type: "date" },
    ],
  },
  adverse_events: {
    label: "Eventos Adversos & Ouvidoria",
    columns: [
      { key: "title", label: "Título da Ocorrência", type: "string" },
      { key: "severity", label: "Gravidade", type: "string" },
      { key: "category", label: "Categoria do Incidente", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "department", label: "Departamento", type: "string" },
      { key: "reported_by", label: "Relatado Por", type: "string" },
    ],
  },
}

const selectedEntity = ref<string>("employees")
const selectedColumns = ref<string[]>([])
const filters = ref<{ column: string; operator: string; value: string }[]>([])
const selectedGroupBy = ref<string>("")
const aggregateFunction = ref<string>("COUNT")
const chartType = ref<"bar" | "doughnut">("bar")
const reportTitle = ref<string>("")

const executingQuery = ref(false)
const queryResults = ref<any[]>([])
const resultColumns = ref<string[]>([])
const savedReports = ref<SavedReportItem[]>([])
const selectedSavedReportId = ref<string>("")

const currentEntityConfig = computed(() => ENTITY_CONFIG[selectedEntity.value] || ENTITY_CONFIG.employees)

function onEntityChange() {
  selectedColumns.value = currentEntityConfig.value.columns.map((c) => c.key)
  filters.value = []
  selectedGroupBy.value = ""
  queryResults.value = []
}

function addFilter() {
  const defaultCol = currentEntityConfig.value.columns[0]?.key || ""
  filters.value.push({ column: defaultCol, operator: "=", value: "" })
}

function removeFilter(index: number) {
  filters.value.splice(index, 1)
}

function toggleColumn(key: string) {
  const idx = selectedColumns.value.indexOf(key)
  if (idx >= 0) {
    if (selectedColumns.value.length > 1) {
      selectedColumns.value.splice(idx, 1)
    }
  } else {
    selectedColumns.value.push(key)
  }
}

async function runQuery() {
  executingQuery.value = true
  try {
    const payload: any = {
      entity: selectedEntity.value,
      columns: selectedColumns.value,
      filters: filters.value.filter((f) => f.value.trim() !== ""),
      limit: 200,
    }

    if (selectedGroupBy.value) {
      payload.groupBy = selectedGroupBy.value
      payload.aggregateFn = aggregateFunction.value
    }

    const res = await apiFetch("/api/reports/custom/query", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.ok) {
      queryResults.value = data.rows || []
      resultColumns.value = data.columns || []
      showToast(`${data.total || 0} registros encontrados.`, "info")
    } else {
      showToast(data.error || "Falha ao executar consulta.", "error")
    }
  } catch (err: any) {
    showToast("Erro de rede: " + err.message, "error")
  } finally {
    executingQuery.value = false
  }
}

// Gráfico Dinâmico baseado nos dados agrupados ou por departamento/status
const dynamicChartData = computed(() => {
  if (!queryResults.value.length) return null

  // Caso 1: Consulta agrupada (group_by)
  if (selectedGroupBy.value) {
    const labels = queryResults.value.map((r) => String(r.agrupamento || "N/A"))
    const data = queryResults.value.map((r) => Number(r.total_metrica || r.qtd || 0))
    return {
      labels,
      datasets: [
        {
          label: `Total (${aggregateFunction.value})`,
          backgroundColor: ["#0d9488", "#0284c7", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#64748b"],
          data,
        },
      ],
    }
  }

  // Caso 2: Agrupamento automático por departamento ou status se a coluna existir
  const keyToGroup = resultColumns.value.includes("department")
    ? "department"
    : resultColumns.value.includes("status")
    ? "status"
    : resultColumns.value.includes("category")
    ? "category"
    : null

  if (keyToGroup) {
    const counts: Record<string, number> = {}
    queryResults.value.forEach((r) => {
      const val = String(r[keyToGroup] || "Outros")
      counts[val] = (counts[val] || 0) + 1
    })

    return {
      labels: Object.keys(counts),
      datasets: [
        {
          label: `Quantidade por ${keyToGroup}`,
          backgroundColor: ["#0d9488", "#0284c7", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#64748b"],
          data: Object.values(counts),
        },
      ],
    }
  }

  return null
})

async function fetchSavedReports() {
  try {
    const res = await apiFetch("/api/reports/custom/saved")
    const data = await res.json()
    if (data.ok && Array.isArray(data.reports)) {
      savedReports.value = data.reports
    }
  } catch (_e) {}
}

async function handleSaveReport() {
  const title = reportTitle.value.trim() || `Relatório de ${currentEntityConfig.value.label}`
  try {
    const res = await apiFetch("/api/reports/custom/saved", {
      method: "POST",
      body: JSON.stringify({
        title,
        entityType: selectedEntity.value,
        columns: selectedColumns.value,
        filters: filters.value,
        groupBy: selectedGroupBy.value || null,
        chartType: chartType.value,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast("Modelo de relatório salvo com sucesso!", "success")
      await fetchSavedReports()
    } else {
      showToast(data.error || "Erro ao salvar modelo.", "error")
    }
  } catch (err: any) {
    showToast("Falha de rede: " + err.message, "error")
  }
}

function loadSavedReport(item: SavedReportItem) {
  selectedEntity.value = item.entity_type
  selectedColumns.value = item.columns || []
  filters.value = item.filters || []
  selectedGroupBy.value = item.group_by || ""
  chartType.value = (item.chart_type as any) || "bar"
  reportTitle.value = item.title
  runQuery()
}

async function handleDeleteSavedReport(id: string) {
  try {
    const res = await apiFetch(`/api/reports/custom/saved/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (data.ok) {
      showToast("Modelo excluído.", "success")
      await fetchSavedReports()
    }
  } catch (_e) {}
}

async function exportCSV() {
  if (!queryResults.value.length) {
    showToast("Execute a consulta antes de exportar.", "warning")
    return
  }

  try {
    const res = await apiFetch("/api/reports/custom/export/csv", {
      method: "POST",
      body: JSON.stringify({
        title: reportTitle.value || selectedEntity.value,
        columns: resultColumns.value,
        rows: queryResults.value,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      showToast(err.error || "Erro na exportação.", "error")
      return
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio_${selectedEntity.value}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    showToast("Arquivo CSV baixado com sucesso!", "success")
  } catch (err: any) {
    showToast("Erro ao exportar CSV: " + err.message, "error")
  }
}

function printReport() {
  window.print()
}

onMounted(() => {
  onEntityChange()
  fetchSavedReports()
  runQuery()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header e Controles Rápidos -->
    <div class="p-3.5 sm:p-5 rounded-2xl border bg-card text-card-foreground shadow-2xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 class="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles :size="20" class="text-teal-500" />
            Construtor Dinâmico de Relatórios de RH
          </h2>
          <p class="text-xs text-muted-foreground mt-0.5">
            Crie consultas personalizadas combinando dados, filtros avançados, agregações e exportação em CSV com sanitização.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Seletor de Modelos Salvos -->
          <select
            v-if="savedReports.length"
            v-model="selectedSavedReportId"
            @change="() => {
              const r = savedReports.find(s => s.id === selectedSavedReportId)
              if (r) loadSavedReport(r)
            }"
            class="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border cursor-pointer max-w-[200px] truncate"
          >
            <option value="">📂 Carregar Modelo Salvo...</option>
            <option v-for="s in savedReports" :key="s.id" :value="s.id">
              {{ s.title }}
            </option>
          </select>

          <button
            v-if="selectedSavedReportId"
            @click="() => {
              handleDeleteSavedReport(selectedSavedReportId)
              selectedSavedReportId = ''
            }"
            class="p-1.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg border border-rose-500/30 transition-colors"
            title="Excluir modelo salvo"
          >
            <Trash2 :size="14" />
          </button>

          <button
            @click="handleSaveReport"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-muted transition-colors cursor-pointer"
            title="Salvar modelo atual"
          >
            <Save :size="14" />
            <span class="hidden sm:inline">Salvar Modelo</span>
          </button>
        </div>
      </div>

      <!-- Configuração da Consulta: Entidade, Colunas e Agrupamento -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- 1. Fonte de Dados -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Layers :size="14" class="text-teal-500" /> Fonte de Dados (Tabela):
          </label>
          <select
            v-model="selectedEntity"
            @change="onEntityChange"
            class="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-background border border-border cursor-pointer"
          >
            <option v-for="(cfg, key) in ENTITY_CONFIG" :key="key" :value="key">
              {{ cfg.label }}
            </option>
          </select>
        </div>

        <!-- 2. Agrupamento (Group By) -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-foreground flex items-center gap-1.5">
            <PieChart :size="14" class="text-indigo-500" /> Agrupar Por (Opcional):
          </label>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedGroupBy"
              class="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border cursor-pointer"
            >
              <option value="">Nenhum (Visualização Detalhada)</option>
              <option v-for="c in currentEntityConfig.columns" :key="c.key" :value="c.key">
                {{ c.label }}
              </option>
            </select>

            <select
              v-if="selectedGroupBy"
              v-model="aggregateFunction"
              class="w-24 px-2 py-2 text-xs font-bold rounded-lg bg-background border"
            >
              <option value="COUNT">COUNT</option>
              <option value="AVG">AVG</option>
              <option value="SUM">SUM</option>
              <option value="MAX">MAX</option>
              <option value="MIN">MIN</option>
            </select>
          </div>
        </div>

        <!-- 3. Título do Relatório -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-foreground flex items-center gap-1.5">
            <FileText :size="14" class="text-amber-500" /> Nome do Relatório:
          </label>
          <input
            v-model="reportTitle"
            type="text"
            :placeholder="`Relatório de ${currentEntityConfig.label}`"
            class="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border"
          />
        </div>
      </div>

      <!-- Seleção de Colunas Dinâmicas -->
      <div v-if="!selectedGroupBy" class="space-y-2 border-t pt-3">
        <span class="text-xs font-bold text-foreground">Colunas Exibidas no Resultado:</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="col in currentEntityConfig.columns"
            :key="col.key"
            type="button"
            @click="toggleColumn(col.key)"
            class="px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer"
            :class="selectedColumns.includes(col.key)
              ? 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30 font-bold'
              : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'"
          >
            {{ col.label }}
          </button>
        </div>
      </div>

      <!-- Construtor de Filtros -->
      <div class="space-y-2.5 border-t pt-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Filter :size="14" class="text-teal-500" /> Filtros Dinâmicos (Condições):
          </span>
          <button
            type="button"
            @click="addFilter"
            class="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            <Plus :size="14" /> Adicionar Condição
          </button>
        </div>

        <div v-if="filters.length" class="space-y-2">
          <div
            v-for="(f, idx) in filters"
            :key="idx"
            class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted/30 p-2.5 sm:p-2 rounded-lg border text-xs"
          >
            <div class="flex items-center gap-2 flex-1">
              <select v-model="f.column" class="flex-1 sm:flex-none px-2 py-1.5 rounded border bg-background text-xs font-medium">
                <option v-for="c in currentEntityConfig.columns" :key="c.key" :value="c.key">
                  {{ c.label }}
                </option>
              </select>

              <select v-model="f.operator" class="px-2 py-1.5 rounded border bg-background text-xs font-bold w-24 sm:w-28">
                <option value="=">Igual (=)</option>
                <option value="!=">Diferente (!=)</option>
                <option value="LIKE">Contém (LIKE)</option>
                <option value=">">Maior que (&gt;)</option>
                <option value="<">Menor que (&lt;)</option>
              </select>
            </div>

            <div class="flex items-center gap-2 flex-1">
              <input
                v-model="f.value"
                type="text"
                placeholder="Valor do filtro..."
                class="flex-1 px-2.5 py-1.5 rounded border bg-background text-xs"
              />

              <button
                type="button"
                @click="removeFilter(idx)"
                class="p-1.5 text-muted-foreground hover:text-rose-500 cursor-pointer shrink-0"
                title="Remover filtro"
              >
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-[11px] text-muted-foreground italic">
          Nenhum filtro ativo. Todos os registros do tenant atual serão considerados.
        </div>
      </div>

      <!-- Barra de Ações: Executar e Exportar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t pt-4">
        <div class="text-xs text-muted-foreground font-medium">
          Registros retornados: <strong class="text-foreground">{{ queryResults.length }}</strong>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="exportCSV"
            :disabled="!queryResults.length"
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet :size="14" class="text-emerald-500" />
            Exportar CSV
          </button>

          <button
            @click="printReport"
            :disabled="!queryResults.length"
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download :size="14" class="text-indigo-500" />
            Imprimir / PDF
          </button>

          <button
            @click="runQuery"
            :disabled="executingQuery"
            class="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play :size="14" :class="{ 'animate-spin': executingQuery }" />
            <span>Executar Consulta</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Visualização Gráfica Dinâmica (quando houver agrupamento ou distribuição) -->
    <div v-if="dynamicChartData" class="p-5 rounded-2xl border bg-card shadow-2xs space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
          <BarChart3 :size="16" class="text-teal-500" />
          Distribuição Gráfica dos Resultados
        </h3>

        <div class="flex items-center gap-1 bg-muted p-1 rounded-md text-xs">
          <button
            @click="chartType = 'bar'"
            class="px-2 py-0.5 rounded font-semibold"
            :class="chartType === 'bar' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'"
          >
            Barras
          </button>
          <button
            @click="chartType = 'doughnut'"
            class="px-2 py-0.5 rounded font-semibold"
            :class="chartType === 'doughnut' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'"
          >
            Rosca
          </button>
        </div>
      </div>

      <div class="h-64 flex items-center justify-center">
        <Bar
          v-if="chartType === 'bar'"
          :data="dynamicChartData"
          :options="{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }"
        />
        <Doughnut
          v-else
          :data="dynamicChartData"
          :options="{ responsive: true, maintainAspectRatio: false }"
        />
      </div>
    </div>

    <!-- Tabela de Resultados Dinâmica -->
    <div class="rounded-2xl border bg-card shadow-2xs overflow-hidden">
      <div class="p-4 border-b bg-muted/20 flex items-center justify-between">
        <h3 class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <TableIcon :size="16" class="text-teal-500" />
          Resultado da Consulta Personalizada ({{ queryResults.length }} linhas)
        </h3>
      </div>

      <div class="overflow-x-auto scrollbar-thin">
        <table v-if="queryResults.length" class="w-full text-left text-xs divide-y min-w-[550px]">
          <thead class="bg-muted/40 font-bold text-muted-foreground uppercase text-[11px]">
            <tr>
              <th v-for="c in resultColumns" :key="c" class="px-4 py-3 whitespace-nowrap">
                {{ c.replace('_', ' ') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            <tr
              v-for="(row, rIdx) in queryResults"
              :key="rIdx"
              class="hover:bg-muted/30 transition-colors"
            >
              <td v-for="c in resultColumns" :key="c" class="px-4 py-2.5 whitespace-nowrap font-medium text-foreground">
                {{ row[c] !== null && row[c] !== undefined ? row[c] : '—' }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="p-12 text-center text-muted-foreground text-xs space-y-2">
          <TableIcon :size="28" class="mx-auto text-muted-foreground/40" />
          <p>Nenhum registro encontrado para os critérios selecionados.</p>
        </div>
      </div>
    </div>
  </div>
</template>
