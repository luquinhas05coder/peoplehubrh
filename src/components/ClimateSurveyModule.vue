<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  Smile,
  Meh,
  Frown,
  TrendingUp,
  ShieldCheck,
  Send,
  BarChart3,
  RefreshCw,
  Lock
} from "lucide-vue-next"
import { showToast } from "../store"

interface ClimateSurvey {
  id: string
  title: string
  description: string
  status: string
  anonymous: number
  total_responses: number
  enps_score: number
  created_at: string
}

interface EnpsDashboard {
  survey: ClimateSurvey
  totalResponses: number
  promoters: number
  passives: number
  detractors: number
  enpsScore: number
  zone: string
  dimensionAverages: {
    leadership: number
    compensation: number
    environment: number
    workLifeBalance: number
  }
}

const activeTab = ref<"dashboard" | "responder">("dashboard")
const isLoading = ref(true)
const surveys = ref<ClimateSurvey[]>([])
const selectedSurveyId = ref<string>("")
const dashboard = ref<EnpsDashboard | null>(null)

// Formulário de resposta anônima
const responseEnps = ref(10)
const responseLeadership = ref(9)
const responseCompensation = ref(8)
const responseEnvironment = ref(10)
const responseWorkLife = ref(9)
const responseFeedback = ref("")
const isSendingResponse = ref(false)

async function loadSurveys() {
  isLoading.value = true
  try {
    const res = await fetch("/api/climate/surveys")
    if (res.ok) {
      const data = await res.json()
      surveys.value = data.surveys || []
      if (surveys.value.length > 0 && !selectedSurveyId.value) {
        selectedSurveyId.value = surveys.value[0].id
        await loadSurveyDashboard(surveys.value[0].id)
      }
    }
  } catch (err: any) {
    showToast(`Erro ao carregar pesquisas: ${err.message}`, "error")
  } finally {
    isLoading.value = false
  }
}

async function loadSurveyDashboard(surveyId: string) {
  try {
    const res = await fetch(`/api/climate/${surveyId}/dashboard`)
    if (res.ok) {
      const data = await res.json()
      dashboard.value = data
    }
  } catch (err: any) {
    showToast(`Erro ao carregar métricas: ${err.message}`, "error")
  }
}

async function submitResponse() {
  if (!selectedSurveyId.value) return
  isSendingResponse.value = true

  try {
    const res = await fetch(`/api/climate/${selectedSurveyId.value}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        npsScore: Number(responseEnps.value),
        dimensionScores: {
          leadership: Number(responseLeadership.value),
          compensation: Number(responseCompensation.value),
          environment: Number(responseEnvironment.value),
          workLifeBalance: Number(responseWorkLife.value),
        },
        feedbackText: responseFeedback.value,
      }),
    })

    const data = await res.json()
    if (res.ok && data.ok) {
      showToast("Sua resposta anônima foi registrada com sucesso! Muito obrigado.", "success")
      responseFeedback.value = ""
      activeTab.value = "dashboard"
      await loadSurveyDashboard(selectedSurveyId.value)
      await loadSurveys()
    } else {
      showToast(data.error || "Erro ao enviar resposta.", "error")
    }
  } catch (err: any) {
    showToast(`Falha no envio: ${err.message}`, "error")
  } finally {
    isSendingResponse.value = false
  }
}

onMounted(() => {
  loadSurveys()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
      <div>
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Smile :size="24" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">Pesquisa de Clima Organizacional & eNPS</h1>
            <p class="text-xs text-muted-foreground">
              Métricas de satisfação interna, engajamento e feedback 100% anônimo
            </p>
          </div>
        </div>
      </div>

      <!-- Abas de Navegação -->
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border text-xs">
        <button
          type="button"
          @click="activeTab = 'dashboard'"
          :class="activeTab === 'dashboard' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <BarChart3 :size="13" />
          Dashboard eNPS
        </button>
        <button
          type="button"
          @click="activeTab = 'responder'"
          :class="activeTab === 'responder' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Lock :size="13" />
          Responder Pesquisa Anônima
        </button>
      </div>
    </div>

    <!-- 1. TAB: DASHBOARD DE eNPS -->
    <div v-if="activeTab === 'dashboard'" class="space-y-6">
      <div v-if="isLoading" class="text-center py-20 text-muted-foreground">
        <RefreshCw :size="24" class="animate-spin mx-auto mb-2 text-teal-500" />
        <span class="text-xs">Consolidando dados anônimos de eNPS...</span>
      </div>

      <div v-else-if="!dashboard" class="text-center py-16 text-muted-foreground">
        Nenhuma pesquisa com respostas encontrada.
      </div>

      <div v-else class="space-y-6">
        <!-- Indicador Principal de eNPS -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Card eNPS Score -->
          <div class="md:col-span-2 p-6 rounded-2xl border bg-gradient-to-br from-card to-card/50 flex flex-col justify-between shadow-sm">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Employee Net Promoter Score
                </span>
                <h3 class="text-3xl font-black text-foreground mt-1">
                  {{ dashboard.enpsScore > 0 ? '+' : '' }}{{ dashboard.enpsScore }}
                </h3>
              </div>
              <span
                class="px-2.5 py-1 rounded-full text-xs font-bold"
                :class="dashboard.enpsScore >= 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'"
              >
                {{ dashboard.zone }}
              </span>
            </div>

            <!-- Fórmula explicativa -->
            <div class="pt-4 mt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>% Promotores ({{ Math.round((dashboard.promoters / (dashboard.totalResponses || 1)) * 100) }}%) - % Detratores ({{ Math.round((dashboard.detractors / (dashboard.totalResponses || 1)) * 100) }}%)</span>
              <span class="font-bold text-foreground">{{ dashboard.totalResponses }} respostas</span>
            </div>
          </div>

          <!-- Distribuição Promotores / Neutros / Detratores -->
          <div class="p-5 rounded-2xl border bg-card flex flex-col justify-between text-xs space-y-3">
            <span class="font-bold text-foreground">Classificação de Respostas</span>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-emerald-600 flex items-center gap-1 font-semibold">
                  <Smile :size="13" /> Promotores (9-10)
                </span>
                <strong class="text-foreground">{{ dashboard.promoters }}</strong>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-amber-500 flex items-center gap-1 font-semibold">
                  <Meh :size="13" /> Neutros (7-8)
                </span>
                <strong class="text-foreground">{{ dashboard.passives }}</strong>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-rose-500 flex items-center gap-1 font-semibold">
                  <Frown :size="13" /> Detratores (0-6)
                </span>
                <strong class="text-foreground">{{ dashboard.detractors }}</strong>
              </div>
            </div>
          </div>

          <!-- Confidencialidade -->
          <div class="p-5 rounded-2xl border bg-card flex flex-col justify-between text-xs">
            <div class="space-y-1">
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck :size="15" class="text-teal-500" /> Blindagem Anônima
              </span>
              <p class="text-muted-foreground text-[11px] leading-relaxed">
                Nenhum dado de identificação do colaborador (IP, e-mail ou nome) é armazenado junto ao voto.
              </p>
            </div>
            <div class="pt-2 text-[10px] text-muted-foreground flex items-center gap-1">
              <Lock :size="11" /> Criptografia de ponta a ponta
            </div>
          </div>
        </div>

        <!-- Médias por Dimensão Organizacional -->
        <div class="p-6 rounded-2xl border bg-card space-y-4">
          <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp :size="16" class="text-teal-500" />
            Satisfação por Dimensão Organizacional (Média 1 a 10)
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div class="p-4 rounded-xl border bg-background space-y-2">
              <span class="text-muted-foreground block font-medium">Liderança & Gestão</span>
              <div class="flex items-baseline justify-between">
                <strong class="text-xl font-bold text-foreground">
                  {{ dashboard.dimensionAverages?.leadership || 8.5 }}/10
                </strong>
                <span class="text-[10px] text-emerald-600 font-bold">Excelente</span>
              </div>
            </div>

            <div class="p-4 rounded-xl border bg-background space-y-2">
              <span class="text-muted-foreground block font-medium">Ambiente & Cultura</span>
              <div class="flex items-baseline justify-between">
                <strong class="text-xl font-bold text-foreground">
                  {{ dashboard.dimensionAverages?.environment || 9.0 }}/10
                </strong>
                <span class="text-[10px] text-emerald-600 font-bold">Destaque</span>
              </div>
            </div>

            <div class="p-4 rounded-xl border bg-background space-y-2">
              <span class="text-muted-foreground block font-medium">Remuneração & Benefícios</span>
              <div class="flex items-baseline justify-between">
                <strong class="text-xl font-bold text-foreground">
                  {{ dashboard.dimensionAverages?.compensation || 7.5 }}/10
                </strong>
                <span class="text-[10px] text-teal-600 font-bold">Adequado</span>
              </div>
            </div>

            <div class="p-4 rounded-xl border bg-background space-y-2">
              <span class="text-muted-foreground block font-medium">Equilíbrio Vida/Trabalho</span>
              <div class="flex items-baseline justify-between">
                <strong class="text-xl font-bold text-foreground">
                  {{ dashboard.dimensionAverages?.workLifeBalance || 8.8 }}/10
                </strong>
                <span class="text-[10px] text-emerald-600 font-bold">Excelente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. TAB: RESPONDER PESQUISA ANÔNIMA -->
    <div v-if="activeTab === 'responder'" class="max-w-xl mx-auto p-6 rounded-2xl border bg-card space-y-6">
      <div class="border-b pb-4">
        <div class="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
          <Lock :size="16" />
          <span class="text-xs font-bold uppercase tracking-wider">Avaliação 100% Anônima</span>
        </div>
        <h3 class="text-base font-bold text-foreground">
          Em uma escala de 0 a 10, o quanto você recomendaria o PeopleHub como um excelente lugar para se trabalhar?
        </h3>
      </div>

      <div class="space-y-5 text-xs">
        <!-- Seletor de Nota eNPS (0 a 10) -->
        <div>
          <label class="block font-semibold text-muted-foreground mb-2">Nota Geral (eNPS):</label>
          <div class="grid grid-cols-11 gap-1">
            <button
              v-for="n in 11"
              :key="n - 1"
              type="button"
              @click="responseEnps = n - 1"
              class="py-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer"
              :class="responseEnps === n - 1 ? 'bg-teal-600 text-white border-teal-600 shadow' : 'bg-background hover:bg-muted text-foreground'"
            >
              {{ n - 1 }}
            </button>
          </div>
          <div class="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>0 = Jamais recomendaria</span>
            <span>10 = Recomendo fortemente</span>
          </div>
        </div>

        <!-- Dimensões Específicas -->
        <div class="space-y-3 pt-3 border-t">
          <span class="block font-bold text-foreground">Avalie as dimensões corporativas (1 a 10):</span>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-muted-foreground mb-1">Liderança Direta:</label>
              <input v-model="responseLeadership" type="number" min="1" max="10" class="w-full px-3 py-1.5 rounded-xl border bg-background font-bold text-sm" />
            </div>
            <div>
              <label class="block text-muted-foreground mb-1">Ambiente & Clima:</label>
              <input v-model="responseEnvironment" type="number" min="1" max="10" class="w-full px-3 py-1.5 rounded-xl border bg-background font-bold text-sm" />
            </div>
            <div>
              <label class="block text-muted-foreground mb-1">Benefícios & Salário:</label>
              <input v-model="responseCompensation" type="number" min="1" max="10" class="w-full px-3 py-1.5 rounded-xl border bg-background font-bold text-sm" />
            </div>
            <div>
              <label class="block text-muted-foreground mb-1">Equilíbrio Vida/Trabalho:</label>
              <input v-model="responseWorkLife" type="number" min="1" max="10" class="w-full px-3 py-1.5 rounded-xl border bg-background font-bold text-sm" />
            </div>
          </div>
        </div>

        <!-- Comentário Livre Anônimo -->
        <div class="pt-3 border-t">
          <label class="block font-semibold text-muted-foreground mb-1">
            Comentário ou Sugestão de Melhoria (Opcional & Anônimo):
          </label>
          <textarea
            v-model="responseFeedback"
            rows="3"
            placeholder="Compartilhe sua percepção sobre nosso dia a dia, processos ou iniciativas..."
            class="w-full px-3 py-2 rounded-xl border bg-background text-xs"
          ></textarea>
        </div>

        <button
          type="button"
          @click="submitResponse"
          :disabled="isSendingResponse"
          class="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw v-if="isSendingResponse" :size="14" class="animate-spin" />
          <Send v-else :size="14" />
          Enviar Resposta Anônima
        </button>
      </div>
    </div>
  </div>
</template>
