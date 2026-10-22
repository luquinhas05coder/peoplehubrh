<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import {
  Radio,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Key,
  FileSpreadsheet,
  Download,
  Upload,
  Copy,
  Check,
  Lock,
  Server,
  Clock,
  Activity,
  Plus,
  Trash2,
  Filter,
} from "lucide-vue-next"
import { apiFetch, showToast, currentUser } from "../store"

type SubTab = "webhooks" | "deliveries" | "csv" | "adapters"
const activeSubTab = ref<SubTab>("webhooks")

const isAdmin = computed(() => currentUser.value?.role === "ADMIN")

// ─── Webhooks Subscriptions State ───
const subscriptions = ref<any[]>([])
const loadingSubs = ref(false)
const showNewSubModal = ref(false)
const subForm = ref({
  name: "",
  url: "",
  events: ["employee.created", "request.approved"],
  is_active: true,
})
const creatingSub = ref(false)
const testingSubId = ref<string | null>(null)
const rotatingSubId = ref<string | null>(null)
const copiedSecretId = ref<string | null>(null)

// ─── Deliveries State ───
const deliveries = ref<any[]>([])
const loadingDeliveries = ref(false)
const deliveryFilterStatus = ref<string>("todos")
const redeliveringId = ref<string | null>(null)

// ─── CSV State ───
const exportingCsv = ref(false)
const importingCsv = ref(false)
const csvFile = ref<File | null>(null)
const csvImportResult = ref<any>(null)

// ─── Adapters State ───
const adapters = ref<any[]>([])
const loadingAdapters = ref(false)

const availableEvents = [
  { id: "employee.created", label: "Colaborador Cadastrado", desc: "Disparado na admissão ou cadastro de colaborador" },
  { id: "request.approved", label: "Solicitação Aprovada", desc: "Disparado quando RH aprova férias ou atualização cadastral" },
  { id: "job.published", label: "Vaga Publicada", desc: "Disparado quando uma vaga ATS é aberta e publicada" },
  { id: "candidate.stage_changed", label: "Candidato Avançou de Etapa", desc: "Disparado na movimentação do funil seletivo" },
  { id: "ping.test", label: "Eventos de Teste (Ping)", desc: "Validação sintética de integridade HMAC e SSRF" },
]

async function loadSubscriptions() {
  if (!isAdmin.value) return
  loadingSubs.value = true
  try {
    const res = await apiFetch("/api/webhooks/subscriptions")
    if (res.ok) {
      const data = await res.json()
      subscriptions.value = data.subscriptions || []
    }
  } catch (err: any) {
    showToast(`Erro ao carregar webhooks: ${err.message}`, "error")
  } finally {
    loadingSubs.value = false
  }
}

async function loadDeliveries() {
  if (!isAdmin.value) return
  loadingDeliveries.value = true
  try {
    let url = "/api/webhooks/deliveries?limit=50"
    if (deliveryFilterStatus.value !== "todos") {
      url += `&status=${deliveryFilterStatus.value}`
    }
    const res = await apiFetch(url)
    if (res.ok) {
      const data = await res.json()
      deliveries.value = data.deliveries || []
    }
  } catch (err: any) {
    showToast(`Erro ao carregar histórico: ${err.message}`, "error")
  } finally {
    loadingDeliveries.value = false
  }
}

async function loadAdapters() {
  if (!isAdmin.value) return
  loadingAdapters.value = true
  try {
    const res = await apiFetch("/api/integrations/adapters")
    if (res.ok) {
      const data = await res.json()
      adapters.value = data.adapters || []
    }
  } catch (err: any) {
    showToast(`Erro ao carregar adaptadores: ${err.message}`, "error")
  } finally {
    loadingAdapters.value = false
  }
}

async function createSubscription() {
  if (!subForm.value.name.trim() || !subForm.value.url.trim()) {
    showToast("Nome descritivo e URL do webhook são obrigatórios.", "warning")
    return
  }

  creatingSub.value = true
  try {
    const res = await apiFetch("/api/webhooks/subscriptions", {
      method: "POST",
      body: JSON.stringify(subForm.value),
    })

    const data = await res.json()
    if (!res.ok) {
      showToast(data.error || "Falha ao criar webhook.", "error")
      return
    }

    showToast("Endpoint de webhook cadastrado com sucesso!", "success")
    showNewSubModal.value = false
    subForm.value = {
      name: "",
      url: "",
      events: ["employee.created", "request.approved"],
      is_active: true,
    }
    await loadSubscriptions()
  } catch (err: any) {
    showToast(`Erro de conexão: ${err.message}`, "error")
  } finally {
    creatingSub.value = false
  }
}

async function deleteSubscription(id: string) {
  if (!confirm("Tem certeza que deseja excluir esta inscrição de webhook?")) return
  try {
    const res = await apiFetch(`/api/webhooks/subscriptions/${id}`, { method: "DELETE" })
    if (res.ok) {
      showToast("Inscrição de webhook removida com sucesso.", "success")
      await loadSubscriptions()
    } else {
      showToast("Não foi possível excluir o webhook.", "error")
    }
  } catch (err: any) {
    showToast(err.message, "error")
  }
}

async function testSubscription(id: string) {
  testingSubId.value = id
  try {
    const res = await apiFetch(`/api/webhooks/subscriptions/${id}/test`, { method: "POST" })
    const data = await res.json()
    if (data.ok) {
      showToast("Disparo de teste realizado e recebido com sucesso (HTTP 2xx)!", "success")
    } else {
      showToast(`Falha no teste: ${data.message || data.error}`, "warning")
    }
    await loadDeliveries()
  } catch (err: any) {
    showToast(`Erro no teste de webhook: ${err.message}`, "error")
  } finally {
    testingSubId.value = null
  }
}

async function rotateSecret(id: string) {
  if (!confirm("Atenção: Rotacionar a chave HMAC exigirá atualizar a validação no sistema receptor. Deseja continuar?")) return
  rotatingSubId.value = id
  try {
    const res = await apiFetch(`/api/webhooks/subscriptions/${id}/rotate-secret`, { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      showToast("Novo segredo HMAC gerado com sucesso!", "success")
      await loadSubscriptions()
    } else {
      showToast(data.error || "Falha ao rotacionar chave.", "error")
    }
  } catch (err: any) {
    showToast(err.message, "error")
  } finally {
    rotatingSubId.value = null
  }
}

async function redeliver(id: string) {
  redeliveringId.value = id
  try {
    const res = await apiFetch(`/api/webhooks/deliveries/${id}/redeliver`, { method: "POST" })
    const data = await res.json()
    if (data.ok) {
      showToast("Reenvio manual concluído com sucesso!", "success")
    } else {
      showToast(`Reenvio falhou: ${data.message}`, "warning")
    }
    await loadDeliveries()
  } catch (err: any) {
    showToast(`Erro ao reenviar: ${err.message}`, "error")
  } finally {
    redeliveringId.value = null
  }
}

async function exportEmployeesCsv() {
  exportingCsv.value = true
  try {
    const res = await apiFetch("/api/integrations/csv/employees/export")
    if (!res.ok) throw new Error("Erro ao exportar base CSV")

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `colaboradores_peoplehub_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    showToast("Arquivo CSV exportado com sucesso!", "success")
  } catch (err: any) {
    showToast(`Erro na exportação: ${err.message}`, "error")
  } finally {
    exportingCsv.value = false
  }
}

function handleCsvFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    csvFile.value = target.files[0]
  }
}

async function submitCsvImport() {
  if (!csvFile.value) {
    showToast("Selecione um arquivo CSV para importar.", "warning")
    return
  }

  importingCsv.value = true
  csvImportResult.value = null

  try {
    const text = await csvFile.value.text()
    const res = await apiFetch("/api/integrations/csv/employees/import", {
      method: "POST",
      body: JSON.stringify({ csvContent: text }),
    })

    const data = await res.json()
    csvImportResult.value = data.result || null

    if (data.ok) {
      showToast(data.message || "Carga de colaboradores importada!", "success")
    } else {
      showToast(data.error || "Falha na importação do arquivo CSV.", "error")
    }
  } catch (err: any) {
    showToast(`Erro no processamento CSV: ${err.message}`, "error")
  } finally {
    importingCsv.value = false
  }
}

function copyToClipboard(text: string, id: string) {
  navigator.clipboard.writeText(text)
  copiedSecretId.value = id
  setTimeout(() => (copiedSecretId.value = null), 2000)
  showToast("Copiado para a área de transferência!", "info")
}

onMounted(() => {
  if (isAdmin.value) {
    loadSubscriptions()
    loadDeliveries()
    loadAdapters()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Aviso de Permissão caso não seja ADMIN -->
    <div v-if="!isAdmin" class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-700 dark:text-amber-300 flex items-start gap-3">
      <Lock class="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <h4 class="font-bold text-sm">Acesso Restrito a Administradores</h4>
        <p class="text-xs mt-1 text-muted-foreground">
          A camada de integrações externas, configuração de webhooks de saída e exportações/importações de folha de pagamento exige o perfil <strong>ADMIN</strong> por diretrizes de governança e proteção de dados (LGPD).
        </p>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Header do Módulo de Integrações -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-foreground">Camada Modular de Integrações & Webhooks</h3>
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck class="w-3.5 h-3.5" /> HMAC SHA-256 + SSRF Shield
            </span>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Conecte o PeopleHub RH a sistemas externos com fila assíncrona, tolerância a falhas e isolamento de redes internas.
          </p>
        </div>

        <!-- Botões de Ação Rápida -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            @click="activeSubTab === 'webhooks' ? loadSubscriptions() : activeSubTab === 'deliveries' ? loadDeliveries() : loadAdapters()"
          >
            <RefreshCw class="w-3.5 h-3.5" /> Atualizar
          </button>
          <button
            v-if="activeSubTab === 'webhooks'"
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
            @click="showNewSubModal = true"
          >
            <Plus class="w-3.5 h-3.5" /> Novo Webhook
          </button>
        </div>
      </div>

      <!-- Sub-navegação interna -->
      <div class="flex border-b border-border gap-2 text-xs font-semibold">
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-3.5 py-2.5 transition-all cursor-pointer"
          :class="activeSubTab === 'webhooks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeSubTab = 'webhooks'"
        >
          <Radio class="w-3.5 h-3.5" /> Endpoints de Webhooks ({{ subscriptions.length }})
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-3.5 py-2.5 transition-all cursor-pointer"
          :class="activeSubTab === 'deliveries' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeSubTab = 'deliveries'"
        >
          <Activity class="w-3.5 h-3.5" /> Histórico de Entregas & Logs
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-3.5 py-2.5 transition-all cursor-pointer"
          :class="activeSubTab === 'csv' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeSubTab = 'csv'"
        >
          <FileSpreadsheet class="w-3.5 h-3.5" /> Carga & Exportação CSV (DP)
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-3.5 py-2.5 transition-all cursor-pointer"
          :class="activeSubTab === 'adapters' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeSubTab = 'adapters'"
        >
          <Server class="w-3.5 h-3.5" /> Adaptadores Ativos
        </button>
      </div>

      <!-- ─── SUB-ABA 1: WEBHOOKS ─── -->
      <div v-if="activeSubTab === 'webhooks'" class="space-y-4">
        <div v-if="loadingSubs" class="p-8 text-center text-xs text-muted-foreground">
          <RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2 text-primary" /> Carregando inscrições de webhooks...
        </div>

        <div v-else-if="subscriptions.length === 0" class="rounded-xl border border-dashed p-8 text-center bg-muted/20 space-y-3">
          <Radio class="w-8 h-8 mx-auto text-muted-foreground" />
          <h4 class="font-bold text-sm text-foreground">Nenhum endpoint de webhook cadastrado</h4>
          <p class="text-xs text-muted-foreground max-w-md mx-auto">
            Cadastre endpoints para receber notificações em tempo real de admissões de colaboradores, aprovações de solicitações e vagas de recrutamento.
          </p>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            @click="showNewSubModal = true"
          >
            <Plus class="w-3.5 h-3.5" /> Cadastrar Primeiro Endpoint
          </button>
        </div>

        <div v-else class="grid grid-cols-1 gap-4">
          <div
            v-for="sub in subscriptions"
            :key="sub.id"
            class="rounded-xl border bg-card p-4 shadow-xs space-y-3 transition-all hover:border-primary/40"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-sm text-foreground">{{ sub.name }}</h4>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="sub.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
                  >
                    {{ sub.is_active ? 'Ativo' : 'Pausado' }}
                  </span>
                </div>
                <p class="text-xs font-mono text-muted-foreground truncate max-w-xl">{{ sub.url }}</p>
              </div>

              <!-- Ações do Webhook -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  :disabled="testingSubId === sub.id"
                  @click="testSubscription(sub.id)"
                >
                  <Send class="w-3 h-3" :class="testingSubId === sub.id ? 'animate-pulse text-primary' : ''" />
                  {{ testingSubId === sub.id ? 'Testando...' : 'Testar Conexão' }}
                </button>
                <button
                  type="button"
                  class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  :disabled="rotatingSubId === sub.id"
                  @click="rotateSecret(sub.id)"
                >
                  <Key class="w-3 h-3" /> Rotacionar Chave
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center rounded-lg border border-red-500/20 text-red-600 hover:bg-red-500/10 p-1 transition-colors cursor-pointer"
                  title="Excluir Webhook"
                  @click="deleteSubscription(sub.id)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Eventos Inscritos e Segredo -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-muted-foreground font-medium text-[11px]">Eventos inscritos:</span>
                <span
                  v-for="evt in sub.events"
                  :key="evt"
                  class="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-foreground font-semibold"
                >
                  {{ evt }}
                </span>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-muted-foreground text-[11px]">Assinatura:</span>
                <code class="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-foreground">
                  {{ sub.masked_secret }}
                </code>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                  title="Copiar assinatura"
                  @click="copyToClipboard(sub.masked_secret, sub.id)"
                >
                  <Check v-if="copiedSecretId === sub.id" class="w-3.5 h-3.5 text-emerald-500" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── SUB-ABA 2: HISTÓRICO DE ENTREGAS & LOGS ─── -->
      <div v-if="activeSubTab === 'deliveries'" class="space-y-4">
        <!-- Filtro por Status -->
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <Filter class="w-3.5 h-3.5 text-muted-foreground" />
            <span class="text-muted-foreground">Filtrar por status:</span>
            <select
              v-model="deliveryFilterStatus"
              class="rounded-lg border bg-background px-2.5 py-1 text-xs text-foreground cursor-pointer"
              @change="loadDeliveries"
            >
              <option value="todos">Todos os registros</option>
              <option value="delivered">Sucesso (Entregue)</option>
              <option value="pending">Pendente / Em reenvio</option>
              <option value="failed">Falha esgotada</option>
            </select>
          </div>

          <span class="text-muted-foreground text-[11px]">{{ deliveries.length }} entregas registradas</span>
        </div>

        <div v-if="loadingDeliveries" class="p-8 text-center text-xs text-muted-foreground">
          <RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2 text-primary" /> Carregando logs de entrega...
        </div>

        <div v-else-if="deliveries.length === 0" class="rounded-xl border border-dashed p-8 text-center bg-muted/20">
          <Activity class="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h4 class="font-bold text-sm text-foreground">Nenhum evento registrado no período</h4>
          <p class="text-xs text-muted-foreground mt-1">Os disparos de webhooks realizados pelo sistema aparecerão detalhados aqui.</p>
        </div>

        <div v-else class="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table class="w-full text-left text-xs">
            <thead class="border-b bg-muted/50 text-[11px] text-muted-foreground uppercase">
              <tr>
                <th class="p-3">Status</th>
                <th class="p-3">Evento</th>
                <th class="p-3">Destino</th>
                <th class="p-3">Tentativas</th>
                <th class="p-3">HTTP</th>
                <th class="p-3">Latência</th>
                <th class="p-3">Data / Hora</th>
                <th class="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="d in deliveries" :key="d.id" class="hover:bg-muted/20 transition-colors">
                <td class="p-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="{
                      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300': d.status === 'delivered',
                      'bg-amber-500/15 text-amber-700 dark:text-amber-300': d.status === 'pending',
                      'bg-red-500/15 text-red-700 dark:text-red-300': d.status === 'failed',
                    }"
                  >
                    <CheckCircle2 v-if="d.status === 'delivered'" class="w-3 h-3" />
                    <Clock v-else-if="d.status === 'pending'" class="w-3 h-3" />
                    <XCircle v-else class="w-3 h-3" />
                    {{ d.status === 'delivered' ? 'Entregue' : d.status === 'pending' ? 'Pendente' : 'Falhou' }}
                  </span>
                </td>
                <td class="p-3 font-mono font-semibold text-foreground whitespace-nowrap">
                  {{ d.event_type }}
                </td>
                <td class="p-3 truncate max-w-[200px] text-muted-foreground" :title="d.url">
                  {{ d.subscription_name || d.url }}
                </td>
                <td class="p-3 text-center text-muted-foreground whitespace-nowrap">
                  {{ d.attempt_count }} / {{ d.max_attempts }}
                </td>
                <td class="p-3 font-mono">
                  <span :class="d.response_code >= 200 && d.response_code < 300 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'">
                    {{ d.response_code || '-' }}
                  </span>
                </td>
                <td class="p-3 font-mono text-muted-foreground whitespace-nowrap">
                  {{ d.execution_time_ms ? `${d.execution_time_ms} ms` : '-' }}
                </td>
                <td class="p-3 text-muted-foreground whitespace-nowrap">
                  {{ new Date(d.created_at).toLocaleString('pt-BR') }}
                </td>
                <td class="p-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                    :disabled="redeliveringId === d.id"
                    @click="redeliver(d.id)"
                  >
                    <RefreshCw class="w-3 h-3" :class="redeliveringId === d.id ? 'animate-spin text-primary' : ''" />
                    Reenviar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─── SUB-ABA 3: CARGA & EXPORTAÇÃO CSV ─── -->
      <div v-if="activeSubTab === 'csv'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Card 1: Exportação de Colaboradores -->
        <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <div class="flex items-center gap-3 border-b pb-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Download class="w-5 h-5" />
            </div>
            <div>
              <h4 class="font-bold text-sm text-foreground">Exportação Completa de Colaboradores</h4>
              <p class="text-xs text-muted-foreground">Download no formato padrão de Departamento Pessoal (CSV / Excel)</p>
            </div>
          </div>

          <p class="text-xs text-muted-foreground leading-relaxed">
            Gera um arquivo compatível com Excel e ERPs de folha de pagamento contendo matrícula, dados funcionais, regime de contratação (CLT/PJ), escalas de trabalho e situação cadastral com codificação UTF-8 com BOM.
          </p>

          <button
            type="button"
            class="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
            :disabled="exportingCsv"
            @click="exportEmployeesCsv"
          >
            <Download class="w-4 h-4" />
            {{ exportingCsv ? 'Gerando arquivo CSV...' : 'Exportar Base Completa em CSV' }}
          </button>
        </div>

        <!-- Card 2: Importação em Lote -->
        <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <div class="flex items-center gap-3 border-b pb-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Upload class="w-5 h-5" />
            </div>
            <div>
              <h4 class="font-bold text-sm text-foreground">Carga em Lote de Colaboradores</h4>
              <p class="text-xs text-muted-foreground">Importação estruturada via planilha CSV</p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-semibold text-foreground">Selecione o arquivo CSV (.csv):</label>
            <input
              type="file"
              accept=".csv"
              class="w-full text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              @change="handleCsvFileSelect"
            />
          </div>

          <button
            type="button"
            class="flex items-center justify-center gap-2 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-xs font-semibold hover:bg-emerald-500/20 transition-colors cursor-pointer"
            :disabled="!csvFile || importingCsv"
            @click="submitCsvImport"
          >
            <Upload class="w-4 h-4" />
            {{ importingCsv ? 'Processando e validando linhas...' : 'Iniciar Importação CSV' }}
          </button>

          <!-- Relatório de Importação -->
          <div v-if="csvImportResult" class="rounded-lg border p-3 bg-muted/30 space-y-2 text-xs">
            <div class="flex items-center justify-between font-bold">
              <span>Resultado da Carga:</span>
              <span class="text-emerald-600">{{ csvImportResult.successCount }} importados</span>
            </div>

            <div v-if="csvImportResult.errors && csvImportResult.errors.length > 0" class="space-y-1">
              <span class="text-[11px] font-semibold text-red-500">Falhas detectadas ({{ csvImportResult.errors.length }}):</span>
              <div class="max-h-28 overflow-y-auto space-y-1 pr-1">
                <p
                  v-for="(err, idx) in csvImportResult.errors"
                  :key="idx"
                  class="text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 p-1.5 rounded"
                >
                  Linha {{ err.line }}: {{ err.error }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── SUB-ABA 4: ADAPTADORES ATIVOS ─── -->
      <div v-if="activeSubTab === 'adapters'" class="space-y-4">
        <div v-if="loadingAdapters" class="p-8 text-center text-xs text-muted-foreground">
          <RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2 text-primary" /> Verificando adaptadores ativos...
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="adapter in adapters"
            :key="adapter.id"
            class="rounded-xl border bg-card p-5 space-y-3 shadow-xs"
          >
            <div class="flex items-center justify-between">
              <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                {{ adapter.category }}
              </span>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="adapter.health?.ok ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/15 text-red-700'"
              >
                <CheckCircle2 v-if="adapter.health?.ok" class="w-3 h-3" />
                <AlertTriangle v-else class="w-3 h-3" />
                {{ adapter.health?.ok ? 'Operacional' : 'Degradado' }}
              </span>
            </div>

            <div>
              <h4 class="font-bold text-sm text-foreground">{{ adapter.name }}</h4>
              <p class="text-xs text-muted-foreground mt-1">{{ adapter.description }}</p>
            </div>

            <div class="border-t pt-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Versão: v{{ adapter.version }}</span>
              <span>Latência: {{ adapter.health?.latency_ms || 1 }} ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── MODAL DE CADASTRO DE NOVO WEBHOOK ─── -->
    <div
      v-if="showNewSubModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
        <div class="flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-2">
            <Radio class="w-5 h-5 text-primary" />
            <h3 class="font-bold text-base text-foreground">Novo Endpoint de Webhook</h3>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            @click="showNewSubModal = false"
          >
            ✕
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <div class="space-y-1">
            <label class="font-semibold text-foreground">Nome Identificador:</label>
            <input
              v-model="subForm.name"
              type="text"
              placeholder="ex: Integração ERP Folha / Zapier"
              class="w-full rounded-lg border bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="font-semibold text-foreground">URL de Destino (Endpoint HTTPS):</label>
              <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">SSRF Shield Ativo</span>
            </div>
            <input
              v-model="subForm.url"
              type="url"
              placeholder="https://seu-servidor.com/webhook/peoplehub"
              class="w-full rounded-lg border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/40"
            />
            <p class="text-[10px] text-muted-foreground">
              Endereços em localhost, 127.0.0.1, redes privadas (10.x, 192.168.x) e metadados de nuvem são estritamente bloqueados.
            </p>
          </div>

          <div class="space-y-2">
            <label class="font-semibold text-foreground">Eventos a Notificar:</label>
            <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              <label
                v-for="evt in availableEvents"
                :key="evt.id"
                class="flex items-start gap-2.5 rounded-lg border p-2 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <input
                  v-model="subForm.events"
                  type="checkbox"
                  :value="evt.id"
                  class="rounded mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <div class="font-semibold text-foreground">{{ evt.label }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ evt.desc }}</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t pt-4">
          <button
            type="button"
            class="rounded-lg border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            @click="showNewSubModal = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
            :disabled="creatingSub"
            @click="createSubscription"
          >
            {{ creatingSub ? 'Validando SSRF...' : 'Salvar e Gerar Segredo HMAC' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
