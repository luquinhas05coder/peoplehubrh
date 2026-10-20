<script setup lang="ts">
import { ref, computed } from "vue"
import { X, Sparkles } from "lucide-vue-next"
import type { DocumentSignStatus } from "../data"
import { documentTemplates, employeeFolders, generateDocument } from "../store"


const props = defineProps<{
  initialTemplateId?: string | null
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "generated", msg: string): void
}>()

const selectedTemplateId = ref<string>(props.initialTemplateId || documentTemplates.value[0]?.id || "")
const selectedEmployeeId = ref<string>(employeeFolders.value[0]?.id || "")

// Form Dynamic Inputs
const inputCpf = ref("123.456.789-00")
const inputDataAdmissao = ref("01/02/2022")
const inputPeriodoAquisitivo = ref("2024/2025")
const inputInicioFerias = ref("01/09/2026")
const inputFimFerias = ref("15/09/2026")
const inputModeloTrabalho = ref("Híbrido (3 dias presenciais / 2 dias remotos)")
const inputEquipamentos = ref("Notebook Dell i7, Monitor 27\" e Headset USB")
const inputAnoCalendario = ref("2025")
const inputRendimentosTributaveis = ref("R$ 84.500,00")

const signOption = ref<DocumentSignStatus>("assinado")
const error = ref<string | null>(null)

const selectedTemplate = computed(() => {
  return documentTemplates.value.find((t) => t.id === selectedTemplateId.value) || documentTemplates.value[0]
})

const selectedEmployee = computed(() => {
  return employeeFolders.value.find((f) => f.id === selectedEmployeeId.value) || employeeFolders.value[0]
})

const formattedTextPreview = computed(() => {
  if (!selectedTemplate.value) return ""
  let text = selectedTemplate.value.templateText
  const emp = selectedEmployee.value

  const replacements: Record<string, string> = {
    nome: emp?.name || "Victor Silva",
    cpf: emp?.cpf || inputCpf.value,
    cargo: emp?.role || "Analista de RH",
    department: emp?.department || "Recursos Humanos",
    dataAdmissao: emp?.admissionDate || inputDataAdmissao.value,
    periodoAquisitivo: inputPeriodoAquisitivo.value,
    inicioFerias: inputInicioFerias.value,
    fimFerias: inputFimFerias.value,
    modeloTrabalho: inputModeloTrabalho.value,
    equipamentos: inputEquipamentos.value,
    anoCalendario: inputAnoCalendario.value,
    rendimentosTributaveis: inputRendimentosTributaveis.value,
  }

  for (const [key, val] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, "g"), val)
  }

  return text
})

async function handleGenerate() {
  error.value = null
  if (!selectedTemplate.value || !selectedEmployee.value) {
    error.value = "Selecione o modelo e o colaborador."
    return
  }

  const doc = await generateDocument({
    templateId: selectedTemplate.value.id,
    employeeName: selectedEmployee.value.name,
    employeeInitials: selectedEmployee.value.initials,
    employeeRole: selectedEmployee.value.role,
    department: selectedEmployee.value.department,
    signStatus: signOption.value,
    contentSnippet: formattedTextPreview.value.slice(0, 140) + "...",
  })

  emit("generated", `Documento "${doc.code}" gerado com sucesso!`)
  emit("close")
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="emit('close')" />

    <!-- Modal Container -->
    <div class="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border shadow-2xl z-10 p-6 sm:p-8 text-foreground flex flex-col">
      <div class="flex items-center justify-between border-b pb-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles :size="24" />
          </div>
          <div>
            <h2 class="text-xl font-bold">Gerador de Documentos Oficiais</h2>
            <p class="text-xs text-muted-foreground">Preencha as variáveis e gere o documento em papel timbrado com carimbo do RH.</p>
          </div>
        </div>
        <button class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <!-- Main Layout: Form (Esquerda) vs Preview (Direita) -->
      <div class="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        <!-- Formulário de Seleção e Parâmetros -->
        <div class="lg:col-span-5 space-y-4">
          <!-- Selecionar Modelo -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Modelo do Documento</label>
            <select
              v-model="selectedTemplateId"
              class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option v-for="t in documentTemplates" :key="t.id" :value="t.id">
                {{ t.title }}
              </option>
            </select>
          </div>

          <!-- Selecionar Colaborador -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Colaborador Destinatário</label>
            <select
              v-model="selectedEmployeeId"
              class="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option v-for="e in employeeFolders" :key="e.id" :value="e.id">
                {{ e.name }} — {{ e.role }} ({{ e.department }})
              </option>
            </select>
          </div>

          <!-- Variáveis Dinâmicas do Modelo (apenas quando o modelo tiver parâmetros específicos) -->
          <div v-if="['tpl-2', 'tpl-3', 'tpl-5'].includes(selectedTemplate?.id || '')" class="rounded-xl border bg-muted/30 p-4 space-y-3">
            <p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parâmetros Adicionais</p>

            <div v-if="selectedTemplate?.id === 'tpl-2'" class="space-y-2">
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground">Período Aquisitivo</label>
                <input v-model="inputPeriodoAquisitivo" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground">Início Férias</label>
                  <input v-model="inputInicioFerias" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground">Fim Férias</label>
                  <input v-model="inputFimFerias" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
                </div>
              </div>
            </div>

            <div v-if="selectedTemplate?.id === 'tpl-3'" class="space-y-2">
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground">Modelo de Trabalho</label>
                <input v-model="inputModeloTrabalho" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground">Equipamentos Cedidos</label>
                <input v-model="inputEquipamentos" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
              </div>
            </div>

            <div v-if="selectedTemplate?.id === 'tpl-5'" class="space-y-2">
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground">Ano Calendário</label>
                <input v-model="inputAnoCalendario" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground">Rendimentos Tributáveis</label>
                <input v-model="inputRendimentosTributaveis" type="text" class="w-full rounded-lg border bg-background px-3 py-1.5 text-xs" />
              </div>
            </div>
          </div>
        </div>

        <!-- Minuta em Papel Timbrado (Preview) -->
        <div class="lg:col-span-7 flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização (Papel Timbrado)</span>
            <span class="text-[11px] font-mono text-muted-foreground">PeopleHub Internal Doc System</span>
          </div>

          <div class="flex-1 rounded-2xl border bg-white text-slate-900 p-6 sm:p-8 shadow-inner font-serif text-sm leading-relaxed flex flex-col justify-between min-h-[380px]">
            <div>
              <!-- Cabeçalho Papel Timbrado -->
              <div class="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                <div class="flex items-center gap-2">
                  <div class="h-8 w-8 rounded-lg bg-teal-800 text-white flex items-center justify-center font-sans font-bold text-xs">
                    PH
                  </div>
                  <div>
                    <p class="font-sans font-bold text-xs text-slate-900 leading-none">PEOPLEHUB RH S/A</p>
                    <p class="font-sans text-[10px] text-slate-500">CNPJ: 12.345.678/0001-90 — São Paulo/SP</p>
                  </div>
                </div>
                <span class="font-sans text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">MINUTA OFICIAL</span>
              </div>

              <!-- Título -->
              <h3 class="font-sans font-bold text-base text-center uppercase tracking-wide text-slate-800 mb-6">
                {{ selectedTemplate?.title }}
              </h3>

              <!-- Conteúdo Substituído -->
              <p class="text-justify text-slate-800 leading-relaxed font-normal">
                {{ formattedTextPreview }}
              </p>
            </div>

            <!-- Rodapé do Documento -->
            <div class="mt-8 pt-4 border-t border-slate-200 flex items-end justify-between font-sans text-xs">
              <div>
                <p class="text-[10px] text-slate-500">São Paulo, {{ new Date().toLocaleDateString('pt-BR') }}</p>
                <p class="font-bold text-slate-800 mt-1">Recursos Humanos — PeopleHub</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="mt-6 flex items-center justify-end gap-3 border-t pt-4">
        <button type="button" class="rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted" @click="emit('close')">
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-xl py-2.5 px-6 text-sm font-semibold text-primary-foreground shadow transition-transform hover:-translate-y-0.5 flex items-center gap-2"
          style="background-color: var(--color-primary)"
          @click="handleGenerate"
        >
          <Sparkles :size="18" /> Gerar e Salvar Documento
        </button>
      </div>
    </div>
  </div>
</template>
