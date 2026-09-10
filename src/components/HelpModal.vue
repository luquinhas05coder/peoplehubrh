<script setup lang="ts">
import { ref, computed } from "vue"
import {
  X,
  LifeBuoy,
  HelpCircle,
  ChevronDown,
  MessagesSquare,
  FileText,
  GraduationCap,
  Clock,
  Search,
  CheckCircle2,
  Send,
} from "lucide-vue-next"
import { showToast } from "../store"

const emit = defineEmits<{
  (e: "close"): void
}>()

const openFaq = ref<number | null>(0)
const searchQuery = ref("")
const selectedCategory = ref<string>("todas")

function toggleFaq(index: number) {
  openFaq.value = openFaq.value === index ? null : index
}

const categories = [
  { id: "todas", label: "Todas as Dúvidas" },
  { id: "chat", label: "Chat Interno" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "treinamentos", label: "Trilhas & Capacitação" },
  { id: "documentos", label: "Documentos & Ponto" },
]

const faqs = [
  {
    category: "chat",
    question: "Como funciona o Chat Interno de RH?",
    answer:
      "O Chat Interno é uma central confidencial e direta entre o RH e os colaboradores da empresa. Ele opera 100% no servidor interno local sem depender de redes sociais externas. Permite envio de mensagens, anexos e notas internas que apenas a equipe de gestão visualiza.",
  },
  {
    category: "chat",
    question: "Como resolver um chamado para ele sumir da lista ou reabri-lo depois?",
    answer:
      "Ao concluir o atendimento de um colaborador, clique no botão 'Resolver' no cabeçalho do chat ou no card da conversa. A conversa será finalizada e sumirá imediatamente da aba 'Em Aberto', mantendo sua lista limpa. Você pode consultá-la ou reabri-la a qualquer momento na aba 'Resolvidas'.",
  },
  {
    category: "chat",
    question: "Como excluir uma conversa permanentemente?",
    answer:
      "Para excluir uma conversa em definitivo, passe o mouse sobre o card na lista ou abra o chat e clique no ícone da lixeira. Uma janela de confirmação de segurança será exibida para evitar exclusões acidentais.",
  },
  {
    category: "treinamentos",
    question: "Como matricular um colaborador em uma Trilha de Treinamento?",
    answer:
      "No menu lateral, acesse o módulo 'Onboarding' e clique na aba 'Trilhas de Treinamento'. No card da trilha desejada, clique em 'Matricular' e escolha o colaborador cadastrado na empresa. O sistema vinculará o plano de aprendizado e exibirá o progresso.",
  },
  {
    category: "treinamentos",
    question: "Como emitir o Certificado Oficial de Conclusão de Treinamento?",
    answer:
      "No card de cada trilha ou no modal de edição, clique no botão 'Certificado'. O sistema gera instantaneamente um documento executivo em PDF com borda corporativa, código hash de validação e assinaturas da Diretoria de RH.",
  },
  {
    category: "colaboradores",
    question: "Como criar a pasta funcional e prontuário de um novo colaborador?",
    answer:
      "No módulo 'Colaboradores', clique no botão '+ Nova Pasta'. Preencha os dados do colaborador (nome, matrícula, cargo, departamento, CPF e data de admissão). A pasta digital permitirá gerenciar histórico, holerites e emitir documentos oficiais.",
  },
  {
    category: "documentos",
    question: "Como emitir declarações e documentos oficiais de RH?",
    answer:
      "Acesse o módulo 'Documentos', selecione o modelo desejado (Declaração de Vínculo Empregatício, Termo de Confidencialidade/NDA, Acordo de Teletrabalho ou Aviso Prévio) e clique em 'Gerar Documento'. O sistema preenche com os dados da empresa para download ou impressão imediata.",
  },
  {
    category: "documentos",
    question: "Como funciona o espelho de folha de ponto e controle de horas?",
    answer:
      "No módulo 'Folha de Ponto', selecione o colaborador para visualizar o histórico diário de batidas (entrada, almoço e saída), saldo do banco de horas e horas extras. Você pode exportar o espelho de ponto assinado em formato PDF.",
  },
]

const filteredFaqs = computed(() => {
  return faqs.filter((faq) => {
    const matchesCategory =
      selectedCategory.value === "todas" || faq.category === selectedCategory.value
    const q = searchQuery.value.toLowerCase().trim()
    const matchesQuery =
      !q ||
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q)
    return matchesCategory && matchesQuery
  })
})

const supportMessage = ref("")
const sendingSupport = ref(false)

function sendSupportTicket() {
  if (!supportMessage.value.trim()) {
    showToast("Por favor, descreva sua dúvida antes de enviar.")
    return
  }
  sendingSupport.value = true
  setTimeout(() => {
    sendingSupport.value = false
    supportMessage.value = ""
    showToast("Solicitação de suporte registrada com sucesso! A equipe de TI/RH retornará em breve.", "success")
  }, 600)
}
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="relative flex h-[88vh] max-h-[740px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl border border-border">
      
      <!-- Cabeçalho -->
      <header class="flex items-center justify-between border-b px-6 py-4" style="background-color: var(--color-primary)">
        <div class="flex items-center gap-3 text-primary-foreground">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
            <LifeBuoy :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-bold">Central de Ajuda & Guia do Usuário</h2>
            <p class="text-xs text-primary-foreground/75">Base de conhecimento, tutoriais de uso e suporte do PeopleHub RH</p>
          </div>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground cursor-pointer"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Conteúdo da Ajuda -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        
        <!-- Bloco de atalhos rápidos dos módulos -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl border bg-muted/20 p-3.5 space-y-1.5 text-center hover:border-primary/50 transition-all shadow-2xs">
            <div class="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <MessagesSquare :size="18" />
            </div>
            <h3 class="text-xs font-bold text-foreground">Chat Interno</h3>
            <p class="text-[10px] text-muted-foreground leading-tight">Comunicação direta, rápida e confidencial</p>
          </div>

          <div class="rounded-xl border bg-muted/20 p-3.5 space-y-1.5 text-center hover:border-primary/50 transition-all shadow-2xs">
            <div class="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <GraduationCap :size="18" />
            </div>
            <h3 class="text-xs font-bold text-foreground">Trilhas & Cursos</h3>
            <p class="text-[10px] text-muted-foreground leading-tight">Capacitação com certificados em PDF</p>
          </div>

          <div class="rounded-xl border bg-muted/20 p-3.5 space-y-1.5 text-center hover:border-primary/50 transition-all shadow-2xs">
            <div class="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FileText :size="18" />
            </div>
            <h3 class="text-xs font-bold text-foreground">Documentos</h3>
            <p class="text-[10px] text-muted-foreground leading-tight">Declarações e termos oficiais de RH</p>
          </div>

          <div class="rounded-xl border bg-muted/20 p-3.5 space-y-1.5 text-center hover:border-primary/50 transition-all shadow-2xs">
            <div class="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Clock :size="18" />
            </div>
            <h3 class="text-xs font-bold text-foreground">Folha de Ponto</h3>
            <p class="text-[10px] text-muted-foreground leading-tight">Batidas diárias e espelho mensal</p>
          </div>
        </div>

        <!-- Barra de Busca de Dúvidas -->
        <div class="space-y-3">
          <div class="relative">
            <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Digite sua dúvida ou palavra-chave (ex: resolver conversa, certificado, documentos)..."
              class="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-xs outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>

          <!-- Filtros de Categoria -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="shrink-0 rounded-lg px-3 py-1 text-xs font-semibold border transition-all cursor-pointer"
              :class="selectedCategory === cat.id ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted border'"
              @click="selectedCategory = cat.id"
            >
              {{ cat.label }}
            </button>
          </div>
        </div>

        <!-- FAQ Interativo -->
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b pb-2">
            <h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <HelpCircle :size="16" class="text-primary" /> Perguntas Frequentes ({{ filteredFaqs.length }})
            </h3>
            <span class="text-[11px] text-muted-foreground">Clique para expandir a resposta</span>
          </div>

          <div v-if="!filteredFaqs.length" class="text-center py-8 rounded-xl border bg-muted/10">
            <HelpCircle :size="28" class="mx-auto text-muted-foreground/40 mb-2" />
            <p class="text-xs font-bold text-foreground">Nenhuma dúvida correspondente</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">Tente utilizar outras palavras-chave ou envie sua mensagem abaixo.</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(faq, idx) in filteredFaqs"
              :key="idx"
              class="rounded-xl border bg-card overflow-hidden transition-all shadow-2xs"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between p-3.5 text-left font-semibold text-xs text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                @click="toggleFaq(idx)"
              >
                <span>{{ faq.question }}</span>
                <ChevronDown
                  :size="16"
                  class="text-muted-foreground transition-transform shrink-0 ml-2"
                  :class="openFaq === idx ? 'rotate-180 text-primary' : ''"
                />
              </button>
              <div v-if="openFaq === idx" class="border-t bg-muted/15 p-3.5 text-xs leading-relaxed text-muted-foreground">
                {{ faq.answer }}
              </div>
            </div>
          </div>
        </div>

        <!-- Formulário de Suporte Rápido -->
        <div class="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div class="flex items-center gap-2 text-foreground">
            <LifeBuoy :size="18" class="text-primary" />
            <div>
              <h4 class="font-bold text-xs">Precisa de apoio adicional da equipe de RH / TI?</h4>
              <p class="text-[11px] text-muted-foreground">Envie sua dúvida ou solicitação técnica diretamente por aqui</p>
            </div>
          </div>

          <div class="flex gap-2">
            <input
              v-model="supportMessage"
              type="text"
              placeholder="Descreva brevemente o problema ou solicitação..."
              class="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary"
              @keydown.enter.prevent="sendSupportTicket"
            />
            <button
              type="button"
              :disabled="sendingSupport"
              class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-all hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
              style="background-color: var(--color-primary)"
              @click="sendSupportTicket"
            >
              <Send :size="13" /> {{ sendingSupport ? 'Enviando...' : 'Enviar Dúvida' }}
            </button>
          </div>
        </div>

      </div>

      <!-- Rodapé -->
      <footer class="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
        <span class="text-[11px] text-muted-foreground flex items-center gap-1">
          <CheckCircle2 :size="13" class="text-emerald-500" /> PeopleHub RH v2.5 · Plataforma Corporativa
        </span>
        <button
          type="button"
          class="rounded-xl border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
          @click="emit('close')"
        >
          Fechar
        </button>
      </footer>

    </div>
  </div>
</template>
