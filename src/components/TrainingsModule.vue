<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  GraduationCap,
  Award,
  ShieldAlert,
  Clock,
  CheckCircle2,
  BookOpen,
  Search
} from "lucide-vue-next"
import { showToast } from "../store"

interface TrainingItem {
  id: string
  title: string
  category: string
  nr_code?: string
  duration_hours: number
  validity_months?: number
  mandatory_for_roles?: string
  description: string
  status: string
}

interface MyTraining {
  id: string
  training_id: string
  status: string
  score?: number
  completion_date?: string
  expires_at?: string
  certificate_code?: string
  title: string
  category: string
  nr_code?: string
  duration_hours: number
}

const activeTab = ref<"catalogo" | "meus" | "conformidade">("catalogo")
const isLoading = ref(true)
const catalog = ref<TrainingItem[]>([])
const myTrainings = ref<MyTraining[]>([])
const complianceRate = ref(85)
const complianceSummary = ref<any>({})
const searchQuery = ref("")
const selectedCategory = ref("todos")

async function loadTrainings() {
  isLoading.value = true
  try {
    const [catRes, myRes, compRes] = await Promise.all([
      fetch("/api/trainings/catalog"),
      fetch("/api/trainings/my"),
      fetch("/api/trainings/compliance"),
    ])

    if (catRes.ok) {
      const data = await catRes.json()
      catalog.value = data.trainings || []
    }
    if (myRes.ok) {
      const data = await myRes.json()
      myTrainings.value = data.trainings || []
    }
    if (compRes.ok) {
      const data = await compRes.json()
      complianceRate.value = data.complianceRate || 85
      complianceSummary.value = data
    }
  } catch (err: any) {
    showToast(`Erro ao carregar treinamentos: ${err.message}`, "error")
  } finally {
    isLoading.value = false
  }
}

async function enrollInTraining(trainingId: string) {
  try {
    const res = await fetch("/api/trainings/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingId }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      showToast("Inscrição realizada com sucesso! Bom aprendizado.", "success")
      await loadTrainings()
      activeTab.value = "meus"
    } else {
      showToast(data.error || "Erro ao se inscrever.", "error")
    }
  } catch (err: any) {
    showToast(`Falha na inscrição: ${err.message}`, "error")
  }
}

async function completeTraining(myTrainingId: string) {
  try {
    const res = await fetch("/api/trainings/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeTrainingId: myTrainingId, score: 95 }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      showToast(`Parabéns! Certificado gerado: ${data.certificateCode}`, "success")
      await loadTrainings()
    } else {
      showToast(data.error || "Erro ao concluir treinamento.", "error")
    }
  } catch (err: any) {
    showToast(`Falha ao concluir: ${err.message}`, "error")
  }
}

const filteredCatalog = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const cat = selectedCategory.value

  return catalog.value.filter((item) => {
    const matchesCat = cat === "todos" || item.category === cat
    const matchesQ =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.nr_code && item.nr_code.toLowerCase().includes(q)) ||
      item.description.toLowerCase().includes(q)
    return matchesCat && matchesQ
  })
})

onMounted(() => {
  loadTrainings()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
      <div>
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <GraduationCap :size="24" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">Treinamentos, NRs & Certificações</h1>
            <p class="text-xs text-muted-foreground">
              Capacitações corporativas, normas do MTE e acompanhamento de conformidade
            </p>
          </div>
        </div>
      </div>

      <!-- Abas de Navegação -->
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border text-xs">
        <button
          type="button"
          @click="activeTab = 'catalogo'"
          :class="activeTab === 'catalogo' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <BookOpen :size="13" />
          Catálogo Geral
        </button>
        <button
          type="button"
          @click="activeTab = 'meus'"
          :class="activeTab === 'meus' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Award :size="13" />
          Meus Cursos ({{ myTrainings.length }})
        </button>
        <button
          type="button"
          @click="activeTab = 'conformidade'"
          :class="activeTab === 'conformidade' ? 'bg-background text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          class="px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          <ShieldAlert :size="13" />
          Matriz de Conformidade
        </button>
      </div>
    </div>

    <!-- Indicadores Rápidos -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div class="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
        <span class="text-muted-foreground font-medium flex items-center gap-1.5">
          <BookOpen :size="14" class="text-indigo-500" /> Cursos Disponíveis
        </span>
        <strong class="text-base text-foreground font-bold">{{ catalog.length }} capacitações</strong>
      </div>
      <div class="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
        <span class="text-muted-foreground font-medium flex items-center gap-1.5">
          <Award :size="14" class="text-amber-500" /> Certificados Emitidos
        </span>
        <strong class="text-base text-foreground font-bold">
          {{ myTrainings.filter((t) => t.status === 'concluido').length }} concluídos
        </strong>
      </div>
      <div class="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
        <span class="text-muted-foreground font-medium flex items-center gap-1.5">
          <ShieldAlert :size="14" class="text-teal-500" /> Índice de Conformidade NRs
        </span>
        <strong class="text-base text-teal-600 font-bold">{{ complianceRate }}% em dia</strong>
      </div>
    </div>

    <!-- 1. TAB: CATÁLOGO DE CURSOS -->
    <div v-if="activeTab === 'catalogo'" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="relative sm:col-span-2">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por curso, NR (ex: NR-06, NR-10) ou tema..."
            class="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            v-model="selectedCategory"
            class="w-full px-3 py-2 text-sm rounded-xl border bg-background cursor-pointer focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Todas as Categorias</option>
            <option value="normativa">Normas Regulamentadoras (NRs)</option>
            <option value="segurança">Segurança & Privacidade</option>
            <option value="técnico">Técnico & Operacional</option>
            <option value="liderança">Liderança & Gestão</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="item in filteredCatalog"
          :key="item.id"
          class="p-4 rounded-2xl border bg-card hover:border-indigo-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
        >
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                :class="item.nr_code ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'"
              >
                {{ item.nr_code || item.category }}
              </span>
              <span class="text-xs text-muted-foreground flex items-center gap-1">
                <Clock :size="12" /> {{ item.duration_hours }}h
              </span>
            </div>

            <h3 class="text-sm font-bold text-foreground mb-1">{{ item.title }}</h3>
            <p class="text-xs text-muted-foreground line-clamp-2">{{ item.description }}</p>

            <div v-if="item.validity_months" class="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldAlert :size="12" class="text-amber-500" />
              Validade do Certificado: <strong>{{ item.validity_months }} meses</strong>
            </div>
          </div>

          <div class="pt-2 border-t flex items-center justify-between">
            <span class="text-[11px] text-muted-foreground">Obrigatório p/ equipe</span>
            <button
              type="button"
              @click="enrollInTraining(item.id)"
              class="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-sm"
            >
              Inscrever-se
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. TAB: MEUS TREINAMENTOS -->
    <div v-if="activeTab === 'meus'" class="space-y-4">
      <div v-if="myTrainings.length === 0" class="text-center py-16 text-muted-foreground rounded-2xl border bg-card/40">
        <GraduationCap :size="36" class="mx-auto text-muted-foreground/60 mb-2" />
        <p class="text-sm font-semibold">Você ainda não está inscrito em nenhum treinamento.</p>
        <button
          type="button"
          @click="activeTab = 'catalogo'"
          class="mt-2 text-xs text-indigo-600 font-bold hover:underline"
        >
          Explorar catálogo de cursos
        </button>
      </div>

      <div v-else class="grid grid-cols-1 gap-3">
        <div
          v-for="my in myTrainings"
          :key="my.id"
          class="p-4 rounded-2xl border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm text-foreground">{{ my.title }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                :class="my.status === 'concluido' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'"
              >
                {{ my.status === 'concluido' ? 'Concluído' : 'Em Andamento' }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              Carga Horária: {{ my.duration_hours }}h · Categoria: {{ my.category }}
              <span v-if="my.completion_date"> · Concluído em: {{ my.completion_date }}</span>
            </p>
            <div v-if="my.certificate_code" class="text-xs text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1.5">
              <Award :size="14" /> Código de Autenticidade: <strong class="tracking-wider">{{ my.certificate_code }}</strong>
            </div>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-center">
            <button
              v-if="my.status !== 'concluido'"
              type="button"
              @click="completeTraining(my.id)"
              class="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <CheckCircle2 :size="13" />
              Finalizar & Emitir Certificado
            </button>
            <div v-else class="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 :size="16" />
              Aprovado (Nota {{ my.score || 95 }}%)
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. TAB: MATRIZ DE CONFORMIDADE -->
    <div v-if="activeTab === 'conformidade'" class="space-y-4">
      <div class="p-5 rounded-2xl border bg-card space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <div>
            <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldAlert :size="16" class="text-teal-500" />
              Status de Auditoria & Conformidade Regulatória (MTE)
            </h3>
            <p class="text-xs text-muted-foreground">
              Acompanhamento de normas regulamentadoras obrigatórias e renovações
            </p>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 font-bold">
            Taxa de Auditoria: {{ complianceRate }}%
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="p-3.5 rounded-xl border bg-background space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-foreground">NR-06 — Equipamentos de Proteção Individual</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                100% Conforme
              </span>
            </div>
            <p class="text-muted-foreground text-[11px]">
              Obrigatório para operadores de campo, logística e manutenção. Todos os certificados válidos.
            </p>
          </div>

          <div class="p-3.5 rounded-xl border bg-background space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-foreground">NR-10 — Segurança em Instalações Elétricas</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                85% Conforme (2 a vencer)
              </span>
            </div>
            <p class="text-muted-foreground text-[11px]">
              2 técnicos necessitam de reciclagem bienal nos próximos 45 dias.
            </p>
          </div>

          <div class="p-3.5 rounded-xl border bg-background space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-foreground">LGPD & Segurança da Informação</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                98% Conforme
              </span>
            </div>
            <p class="text-muted-foreground text-[11px]">
              Treinamento obrigatório para todas as novas contratações na etapa de onboarding.
            </p>
          </div>

          <div class="p-3.5 rounded-xl border bg-background space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-foreground">CIPA — Prevenção de Acidentes e Assédio</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                100% Conforme
              </span>
            </div>
            <p class="text-muted-foreground text-[11px]">
              Comissão interna formada e certificada em conformidade com a Lei 14.457/2022.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
