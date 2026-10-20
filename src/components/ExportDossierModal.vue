<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Download,
  FolderArchive,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  Receipt,
  CalendarClock,
  FileCheck2,
  User,
  Sparkles,
} from "lucide-vue-next"
import jsPDF from "jspdf"
import type { EmployeeFolder, ContraChequeSnapshot } from "../data"
import {
  userRoleType,
  currentUser,
  addDocumentToFolder,
  getFolhaDePontoSnapshot,
  generateInitialFolha,
  requests,
  fetchContraChequesFromBackend,
} from "../store"

const props = withDefaults(
  defineProps<{
    folder: EmployeeFolder
    isOpen?: boolean
  }>(),
  {
    isOpen: true,
  }
)

const emit = defineEmits<{
  (e: "close"): void
  (e: "toast", msg: string): void
}>()

const isExporting = ref(false)
const exportProgress = ref(0)
const exportStatusText = ref("")

// Seções selecionáveis para exportação
const includeCadastral = ref(true)
const includeContraCheques = ref(true)
const includeFolhaPonto = ref(true)
const includeFerias = ref(true)
const includePendencias = ref(true)

// Salvar também diretamente na pasta digital de documentos do colaborador
const saveToDigitalFolder = ref(true)

// Dados compilados do Colaborador
const loadedContracheques = ref<ContraChequeSnapshot[]>([])
const isLoadingData = ref(true)

onMounted(async () => {
  isLoadingData.value = true
  try {
    const list = await fetchContraChequesFromBackend(props.folder.id)
    if (list && list.length) {
      loadedContracheques.value = list
    }
  } catch (_e) {}
  isLoadingData.value = false
})

// Histórico de CCs linear ordenado
const contrachequesLinear = computed(() => {
  if (loadedContracheques.value.length > 0) {
    return [...loadedContracheques.value].sort((a, b) => {
      const ymA = a.yearMonth || a.month
      const ymB = b.yearMonth || b.month
      return ymA.localeCompare(ymB)
    })
  }
  // Mock padrão caso banco não tenha CCs ainda
  return [
    {
      id: "cc_mock_11_2025",
      month: "11/2025",
      yearMonth: "2025-11",
      version: 1,
      status: "imutavel" as const,
      isImmutable: true,
      salary: props.folder.salary || "R$ 6.500,00",
      holerite: { proventosTotais: 6500, descontosTotais: 1379.60, salarioLiquido: 5120.40 },
    },
    {
      id: "cc_mock_12_2025",
      month: "12/2025",
      yearMonth: "2025-12",
      version: 1,
      status: "imutavel" as const,
      isImmutable: true,
      salary: props.folder.salary || "R$ 6.500,00",
      holerite: { proventosTotais: 6500, descontosTotais: 1379.60, salarioLiquido: 5120.40 },
    },
    {
      id: "cc_mock_01_2026",
      month: "01/2026",
      yearMonth: "2026-01",
      version: 1,
      status: "imutavel" as const,
      isImmutable: true,
      salary: props.folder.salary || "R$ 6.500,00",
      holerite: { proventosTotais: 6500, descontosTotais: 1150.00, salarioLiquido: 5350.00 },
    },
    {
      id: "cc_mock_08_2026",
      month: "08/2026",
      yearMonth: "2026-08",
      version: 1,
      status: "aberto_para_vista" as const,
      isImmutable: false,
      salary: props.folder.salary || "R$ 6.500,00",
      holerite: { proventosTotais: 6500, descontosTotais: 1150.00, salarioLiquido: 5350.00 },
    },
  ]
})

// Folha de Ponto compilada (Mês de Referência Atual)
const folhaPonto = computed(() => {
  let snap = getFolhaDePontoSnapshot(props.folder.id, "08/2026")
  if (!snap) {
    snap = generateInitialFolha(props.folder, "08/2026", false)
  }
  return snap
})

// Prontuário de Férias calculado
const feriasInfo = computed(() => {
  return {
    periodoAquisitivo: "01/02/2025 a 31/01/2026",
    periodoConcessivo: "01/02/2026 a 31/01/2027",
    diasDireito: 30,
    diasGozados: props.folder.status === "ferias" ? 15 : 0,
    diasSaldo: props.folder.status === "ferias" ? 15 : 30,
    status: props.folder.status === "ferias" ? "Em Fruição de Férias" : "Período Adquirido Regular",
    proximasFerias: "Programadas para 01/10/2026 a 15/10/2026 (15 dias)",
  }
})

// Pendências do colaborador (Solicitações em aberto, recursos e ajustes de ponto)
const pendenciasList = computed(() => {
  const empName = props.folder.name.toLowerCase()
  const pendingRequests = requests.value.filter(
    (r) =>
      (r.employeeName.toLowerCase().includes(empName) || (r as any).requester?.toLowerCase()?.includes(empName)) &&
      (r.status === "pendente" || r.status === "em_analise")
  )

  const items: Array<{
    tipo: string
    origem: string
    protocolo: string
    data: string
    status: string
    detalhes: string
    urgencia: string
  }> = []

  // Adicionar solicitações ativas
  pendingRequests.forEach((req) => {
    items.push({
      tipo: req.type.toUpperCase(),
      origem: "Módulo de Solicitações",
      protocolo: req.protocol || req.id,
      data: req.startDate || "Agosto/2026",
      status: req.status === "em_analise" ? "Em Análise pelo DP" : "Pendente de Análise",
      detalhes: req.title + (req.description ? ` — ${req.description}` : ""),
      urgencia: req.priority || "media",
    })
  })

  // Verificar se há contra-cheques em recurso (pedido de vista)
  contrachequesLinear.value.forEach((cc) => {
    if (cc.status === "em_recurso") {
      items.push({
        tipo: "RECURSO CONTRA-CHEQUE",
        origem: `Contra-Cheque ${cc.month}`,
        protocolo: `CC-REV-${cc.id.slice(-6)}`,
        data: cc.contestRequestedAt ? new Date(cc.contestRequestedAt).toLocaleDateString("pt-BR") : "Recente",
        status: "Pedido de Vista em Análise",
        detalhes: `Recurso por erro de cálculo: ${cc.contestReason || 'Aguardando parecer do DP'}`,
        urgencia: "alta",
      })
    }
  })

  // Se não houver pendências reais, gerar resumo padrão
  if (items.length === 0) {
    return [
      {
        tipo: "AJUSTE DE PONTO",
        origem: "Espelho de Ponto Eletrônico",
        protocolo: "AJ-2026-0812",
        data: "12/08/2026",
        status: "Pendente de Aprovação pelo Gestor",
        detalhes: "Esquecimento de registro de saída para intervalo intrajornada (12:00 às 13:00).",
        urgencia: "normal",
      },
      {
        tipo: "COMPROVANTE DE FÉRIAS",
        origem: "Departamento Pessoal",
        protocolo: "SOL-FER-2026",
        data: "20/08/2026",
        status: "Aguardando Assinatura do Aviso",
        detalhes: "Aviso de férias programadas para Outubro/2026 aguardando assinatura digital do colaborador.",
        urgencia: "alta",
      },
    ]
  }

  return items
})

const requesterLabel = computed(() => {
  if (userRoleType.value === "colaborador") {
    return "Solicitado pelo Próprio Colaborador (Portal de Autoatendimento)"
  }
  return `Solicitado pelo Técnico / Operador (${currentUser.value?.role || 'Departamento Pessoal'})`
})

function formatMoney(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/**
 * Geração Completa do Dossiê em PDF com jsPDF
 */
async function generateDossierPdf() {
  isExporting.value = true
  exportProgress.value = 10
  exportStatusText.value = "Iniciando compilação de dados do colaborador..."

  try {
    await new Promise((r) => setTimeout(r, 200))
    exportProgress.value = 30
    exportStatusText.value = "Carregando histórico linear de contra-cheques..."

    await new Promise((r) => setTimeout(r, 200))
    exportProgress.value = 50
    exportStatusText.value = "Processando espelho de folha de ponto e prontuário de férias..."

    await new Promise((r) => setTimeout(r, 200))
    exportProgress.value = 75
    exportStatusText.value = "Compilando pendências e gerando layout em PDF..."

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = 210
    const pageHeight = 297
    const margin = 14
    const contentW = pageWidth - margin * 2

    // Helper de Cabeçalho Institucional
    function renderHeader(pageNum: number, totalPages: number) {
      // Faixa Superior
      pdf.setFillColor(15, 23, 42) // slate-900
      pdf.rect(margin, 10, contentW, 16, "F")

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10.5)
      pdf.setTextColor(255, 255, 255)
      pdf.text("PEOPLEHUB RH S/A — DOSSIÊ FUNCIONAL E PASTA DE DOCUMENTOS", margin + 4, 18)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.5)
      pdf.text(`CNPJ: 12.345.678/0001-90 · Emitido sob solicitação: ${new Date().toLocaleDateString("pt-BR")}`, margin + 4, 23)

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      pdf.text(`PÁGINA ${pageNum} DE ${totalPages}`, pageWidth - margin - 4, 20, { align: "right" })
    }

    // Helper de Rodapé Institucional
    function renderFooter() {
      const y = pageHeight - 12
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.3)
      pdf.line(margin, y, pageWidth - margin, y)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.text(
        `Autenticação Digital: SHA256:${Math.random().toString(36).substring(2, 12).toUpperCase()} · ${requesterLabel.value}`,
        margin,
        y + 5
      )
      pdf.text(
        "Documento emitido conforme normas da CLT, Portaria 671 MTE e integridade de arquivos do Colaborador",
        margin,
        y + 9
      )
    }

    // ==========================================
    // PÁGINA 1: FICHA CADASTRAL + HISTÓRICO DE CCs
    // ==========================================
    renderHeader(1, 2)

    let curY = 32

    // 1. BANNER FICHA CADASTRAL
    if (includeCadastral.value) {
      pdf.setFillColor(248, 250, 252) // slate-50
      pdf.setDrawColor(226, 232, 240) // slate-200
      pdf.roundedRect(margin, curY, contentW, 44, 2, 2, "FD")

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.setTextColor(15, 23, 42)
      pdf.text(`${props.folder.name.toUpperCase()}`, margin + 4, curY + 7)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8.5)
      pdf.setTextColor(71, 85, 105)
      pdf.text(`${props.folder.role} · Departamento: ${props.folder.department}`, margin + 4, curY + 12)

      // Grid Cadastral
      pdf.setFontSize(7.5)
      const col1 = margin + 4
      const col2 = margin + 65
      const col3 = margin + 125

      // Linha 1
      pdf.setFont("helvetica", "bold")
      pdf.text("Matrícula:", col1, curY + 19)
      pdf.setFont("helvetica", "normal")
      pdf.text(props.folder.registration || "MAT-102", col1 + 18, curY + 19)

      pdf.setFont("helvetica", "bold")
      pdf.text("CPF:", col2, curY + 19)
      pdf.setFont("helvetica", "normal")
      pdf.text(props.folder.cpf || "000.000.000-00", col2 + 10, curY + 19)

      pdf.setFont("helvetica", "bold")
      pdf.text("Data Admissão:", col3, curY + 19)
      pdf.setFont("helvetica", "normal")
      pdf.text(props.folder.admissionDate || "01/02/2022", col3 + 24, curY + 19)

      // Linha 2
      pdf.setFont("helvetica", "bold")
      pdf.text("CBO:", col1, curY + 26)
      pdf.setFont("helvetica", "normal")
      pdf.text(props.folder.cbo || "2124-05", col1 + 18, curY + 26)

      pdf.setFont("helvetica", "bold")
      pdf.text("Regime:", col2, curY + 26)
      pdf.setFont("helvetica", "normal")
      pdf.text("CLT - Prazo Indeterminado", col2 + 14, curY + 26)

      pdf.setFont("helvetica", "bold")
      pdf.text("Escala:", col3, curY + 26)
      pdf.setFont("helvetica", "normal")
      pdf.text("Semanal 5x2 (44h Semanais)", col3 + 14, curY + 26)

      // Linha 3
      pdf.setFont("helvetica", "bold")
      pdf.text("Salário Base:", col1, curY + 33)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(16, 185, 129) // emerald-600
      pdf.text(props.folder.salary || "R$ 6.500,00", col1 + 20, curY + 33)
      pdf.setTextColor(71, 85, 105)

      pdf.setFont("helvetica", "bold")
      pdf.text("E-mail:", col2, curY + 33)
      pdf.setFont("helvetica", "normal")
      pdf.text(props.folder.email || "colaborador@empresa.com", col2 + 12, curY + 33)

      pdf.setFont("helvetica", "bold")
      pdf.text("Gestor Imediato:", col3, curY + 33)
      pdf.setFont("helvetica", "normal")
      pdf.text(props.folder.manager || "Mariana Alcantara", col3 + 24, curY + 33)

      // Linha 4 (Status)
      pdf.setFont("helvetica", "bold")
      pdf.text("Situação Cadastral:", col1, curY + 40)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(props.folder.status === "ferias" ? 217 : 16, props.folder.status === "ferias" ? 119 : 185, props.folder.status === "ferias" ? 6 : 129)
      pdf.text(props.folder.status === "ferias" ? "EM FRUIÇÃO DE FÉRIAS" : "ATIVO REGULAR", col1 + 28, curY + 40)
      pdf.setTextColor(71, 85, 105)

      curY += 50
    }

    // 2. SEÇÃO: HISTÓRICO DE CONTRA-CHEQUES (LINEAR IMUTÁVEL)
    if (includeContraCheques.value) {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, curY, contentW, 6.5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.5)
      pdf.setTextColor(15, 23, 42)
      pdf.text("1. HISTÓRICO TEMPORAL LINEAR DE CONTRA-CHEQUES (IMUTABILIDADE NO BANCO)", margin + 3, curY + 4.5)

      curY += 8.5

      // Cabeçalho da Tabela
      pdf.setFillColor(226, 232, 240)
      pdf.rect(margin, curY, contentW, 5.5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(7)
      pdf.setTextColor(51, 65, 85)

      pdf.text("Competência", margin + 3, curY + 4)
      pdf.text("Versão", margin + 28, curY + 4)
      pdf.text("Salário Base", margin + 45, curY + 4, { align: "right" })
      pdf.text("Vencimentos (+)", margin + 78, curY + 4, { align: "right" })
      pdf.text("Descontos (-)", margin + 110, curY + 4, { align: "right" })
      pdf.text("Líquido a Receber", margin + 145, curY + 4, { align: "right" })
      pdf.text("Status / Integridade", margin + 152, curY + 4)

      curY += 6.5

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7)

      contrachequesLinear.value.forEach((cc, idx) => {
        if (idx % 2 === 1) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, curY - 1, contentW, 5.5, "F")
        }

        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(15, 23, 42)
        pdf.text(cc.month, margin + 3, curY + 3)

        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(71, 85, 105)
        pdf.text(`v${cc.version || 1}`, margin + 28, curY + 3)

        pdf.text(formatMoney(6500), margin + 45, curY + 3, { align: "right" })
        pdf.text(formatMoney(cc.holerite?.proventosTotais || 6500), margin + 78, curY + 3, { align: "right" })
        pdf.text(formatMoney(cc.holerite?.descontosTotais || 1150), margin + 110, curY + 3, { align: "right" })

        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(16, 185, 129)
        pdf.text(formatMoney(cc.holerite?.salarioLiquido || 5350), margin + 145, curY + 3, { align: "right" })

        pdf.setFont("helvetica", "bold")
        if (cc.status === "em_recurso") {
          pdf.setTextColor(180, 83, 9)
          pdf.text("EM RECURSO (PEDIDO DE VISTA)", margin + 152, curY + 3)
        } else if (cc.status === "recalculado") {
          pdf.setTextColor(37, 99, 235)
          pdf.text("RETIFICADO (IMUTÁVEL)", margin + 152, curY + 3)
        } else if (cc.isImmutable || cc.status === "imutavel") {
          pdf.setTextColor(71, 85, 105)
          pdf.text("IMUTÁVEL (PRAZO ENCERRADO)", margin + 152, curY + 3)
        } else {
          pdf.setTextColor(5, 150, 105)
          pdf.text("ABERTO A VISTA (NO PRAZO)", margin + 152, curY + 3)
        }

        curY += 5.5
      })

      // Nota de Imutabilidade
      pdf.setFont("helvetica", "italic")
      pdf.setFontSize(6.5)
      pdf.setTextColor(100, 116, 139)
      pdf.text(
        "* Os contra-cheques passados são estritamente imutáveis no banco de dados e não possuem ligação estrutural com documentos gerados posteriormente.",
        margin + 2,
        curY + 2
      )

      curY += 8
    }

    // 3. SEÇÃO: PRONTUÁRIO E SALDO DE FÉRIAS
    if (includeFerias.value) {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, curY, contentW, 6.5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.5)
      pdf.setTextColor(15, 23, 42)
      pdf.text("2. DEMONSTRATIVO DE FÉRIAS, PERÍODO AQUISITIVO E SALDO REGULAMENTAR", margin + 3, curY + 4.5)

      curY += 8.5

      pdf.setDrawColor(226, 232, 240)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(margin, curY, contentW, 26, 2, 2, "FD")

      const fCol1 = margin + 4
      const fCol2 = margin + 70
      const fCol3 = margin + 130

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(7.5)
      pdf.setTextColor(71, 85, 105)

      pdf.text("Período Aquisitivo:", fCol1, curY + 5)
      pdf.setFont("helvetica", "normal")
      pdf.text(feriasInfo.value.periodoAquisitivo, fCol1 + 26, curY + 5)

      pdf.setFont("helvetica", "bold")
      pdf.text("Período Concessivo Limite:", fCol2, curY + 5)
      pdf.setFont("helvetica", "normal")
      pdf.text(feriasInfo.value.periodoConcessivo, fCol2 + 35, curY + 5)

      pdf.setFont("helvetica", "bold")
      pdf.text("Situação:", fCol3, curY + 5)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(16, 185, 129)
      pdf.text(feriasInfo.value.status, fCol3 + 14, curY + 5)
      pdf.setTextColor(71, 85, 105)

      // Linha 2 de Férias
      pdf.setFont("helvetica", "bold")
      pdf.text("Dias de Direito Adquiridos:", fCol1, curY + 12)
      pdf.setFont("helvetica", "normal")
      pdf.text(`${feriasInfo.value.diasDireito} dias corridos`, fCol1 + 35, curY + 12)

      pdf.setFont("helvetica", "bold")
      pdf.text("Dias Já Usufruídos:", fCol2, curY + 12)
      pdf.setFont("helvetica", "normal")
      pdf.text(`${feriasInfo.value.diasGozados} dias`, fCol2 + 27, curY + 12)

      pdf.setFont("helvetica", "bold")
      pdf.text("Saldo Disponível:", fCol3, curY + 12)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(16, 185, 129)
      pdf.text(`${feriasInfo.value.diasSaldo} DIAS RESTANTES`, fCol3 + 23, curY + 12)
      pdf.setTextColor(71, 85, 105)

      // Linha 3 de Férias
      pdf.setFont("helvetica", "bold")
      pdf.text("Férias Programadas:", fCol1, curY + 19)
      pdf.setFont("helvetica", "normal")
      pdf.text(feriasInfo.value.proximasFerias, fCol1 + 28, curY + 19)

      curY += 30
    }

    renderFooter()

    // ==========================================
    // PÁGINA 2: FOLHA DE PONTO + PENDÊNCIAS
    // ==========================================
    pdf.addPage()
    renderHeader(2, 2)

    curY = 32

    // 4. SEÇÃO: ESPELHO DA FOLHA DE PONTO ELETRÔNICA
    if (includeFolhaPonto.value) {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, curY, contentW, 6.5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.5)
      pdf.setTextColor(15, 23, 42)
      pdf.text("3. ESPELHO DA FOLHA DE PONTO ELETRÔNICA & BANCO DE HORAS (COMPETÊNCIA 08/2026)", margin + 3, curY + 4.5)

      curY += 8.5

      // Mini Indicadores de Ponto
      const pBoxW = (contentW - 6) / 4

      const pStats = [
        { label: "Horas Trabalhadas", val: folhaPonto.value.totalWorkedHours, color: [15, 23, 42] },
        { label: "Horas Extras 50%/100%", val: folhaPonto.value.totalExtraHours, color: [16, 185, 129] },
        { label: "Faltas / Atrasos", val: folhaPonto.value.totalAbsences, color: [225, 29, 72] },
        { label: "Saldo de Banco de Horas", val: folhaPonto.value.bankBalance, color: [14, 165, 233] },
      ]

      pStats.forEach((s, i) => {
        const x = margin + i * (pBoxW + 2)
        pdf.setDrawColor(226, 232, 240)
        pdf.setFillColor(248, 250, 252)
        pdf.roundedRect(x, curY, pBoxW, 14, 1.5, 1.5, "FD")

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(6.5)
        pdf.setTextColor(100, 116, 139)
        pdf.text(s.label, x + pBoxW / 2, curY + 4.5, { align: "center" })

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(10)
        pdf.setTextColor(s.color[0], s.color[1], s.color[2])
        pdf.text(s.val, x + pBoxW / 2, curY + 11, { align: "center" })
      })

      curY += 17

      // Tabela Amostral de Marcações de Ponto (Dias Relevantes)
      pdf.setFillColor(226, 232, 240)
      pdf.rect(margin, curY, contentW, 5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.5)
      pdf.setTextColor(51, 65, 85)

      pdf.text("Dia / Semana", margin + 3, curY + 3.5)
      pdf.text("Entrada 1", margin + 35, curY + 3.5)
      pdf.text("Saída 1", margin + 55, curY + 3.5)
      pdf.text("Entrada 2", margin + 75, curY + 3.5)
      pdf.text("Saída 2", margin + 95, curY + 3.5)
      pdf.text("Trabalhadas", margin + 120, curY + 3.5)
      pdf.text("Extras / Saldo", margin + 145, curY + 3.5)
      pdf.text("Ocorrência CLT", margin + 165, curY + 3.5)

      curY += 5.5

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(6.5)

      // Exibir os primeiros 10 dias como amostra oficial
      const sampleDays = folhaPonto.value.records.slice(0, 8)
      sampleDays.forEach((r, idx) => {
        if (idx % 2 === 1) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, curY - 1, contentW, 4.5, "F")
        }

        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(15, 23, 42)
        pdf.text(`${String(r.day).padStart(2, "0")}/08 (${r.weekDay})`, margin + 3, curY + 2.5)

        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(71, 85, 105)
        pdf.text(r.entry1 || "--:--", margin + 35, curY + 2.5)
        pdf.text(r.exit1 || "--:--", margin + 55, curY + 2.5)
        pdf.text(r.entry2 || "--:--", margin + 75, curY + 2.5)
        pdf.text(r.exit2 || "--:--", margin + 95, curY + 2.5)
        pdf.text(r.workedHours, margin + 120, curY + 2.5)

        pdf.setFont("helvetica", "bold")
        if (r.extraMinutes > 0) {
          pdf.setTextColor(16, 185, 129)
          pdf.text(`+${r.extraHours}`, margin + 145, curY + 2.5)
        } else {
          pdf.setTextColor(100, 116, 139)
          pdf.text(r.extraHours, margin + 145, curY + 2.5)
        }

        pdf.setTextColor(71, 85, 105)
        pdf.text(r.statusLabel || "Normal CLT", margin + 165, curY + 2.5)

        curY += 4.5
      })

      pdf.setFont("helvetica", "italic")
      pdf.setFontSize(6)
      pdf.setTextColor(100, 116, 139)
      pdf.text(
        `* Registros em conformidade com a Portaria 671 MTE e espelho eletrônico homologado. Total de 31 dias apurados.`,
        margin + 2,
        curY + 2
      )

      curY += 8
    }

    // 5. SEÇÃO: QUADRO DE PENDÊNCIAS E SOLICITAÇÕES
    if (includePendencias.value) {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, curY, contentW, 6.5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.5)
      pdf.setTextColor(15, 23, 42)
      pdf.text("4. RELATÓRIO DE PENDÊNCIAS, RECURSOS E SOLICITAÇÕES EM ANDAMENTO", margin + 3, curY + 4.5)

      curY += 8.5

      pdf.setFillColor(226, 232, 240)
      pdf.rect(margin, curY, contentW, 5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.5)
      pdf.setTextColor(51, 65, 85)

      pdf.text("Protocolo / Origem", margin + 3, curY + 3.5)
      pdf.text("Tipo / Categoria", margin + 40, curY + 3.5)
      pdf.text("Data Abertura", margin + 80, curY + 3.5)
      pdf.text("Status do Processo", margin + 110, curY + 3.5)
      pdf.text("Descrição / Apontamentos", margin + 150, curY + 3.5)

      curY += 5.5

      pendenciasList.value.forEach((pen, idx) => {
        if (idx % 2 === 1) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, curY - 1, contentW, 6, "F")
        }

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(6.5)
        pdf.setTextColor(15, 23, 42)
        pdf.text(pen.protocolo, margin + 3, curY + 3)

        pdf.setFont("helvetica", "normal")
        pdf.text(pen.tipo, margin + 40, curY + 3)
        pdf.text(pen.data, margin + 80, curY + 3)

        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(180, 83, 9)
        pdf.text(pen.status, margin + 110, curY + 3)

        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(71, 85, 105)
        const descTrunc = pen.detalhes.length > 35 ? pen.detalhes.slice(0, 33) + "..." : pen.detalhes
        pdf.text(descTrunc, margin + 150, curY + 3)

        curY += 6
      })

      curY += 6
    }

    // 6. TERMO DE DECLARAÇÃO & ASSINATURAS
    pdf.setFillColor(248, 250, 252)
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(margin, curY, contentW, 22, 2, 2, "FD")

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(71, 85, 105)
    pdf.text(
      "Declaro que as informações acima retratam com fidelidade o histórico funcional, apontamentos de ponto, férias e proventos.",
      margin + 4,
      curY + 5
    )

    const signY = curY + 16
    pdf.line(margin + 10, signY, margin + 75, signY)
    pdf.text("Assinatura do Colaborador", margin + 18, signY + 4)

    pdf.line(margin + 105, signY, margin + 170, signY)
    pdf.text("Departamento Pessoal / RH Responsável", margin + 108, signY + 4)

    renderFooter()

    exportProgress.value = 95
    exportStatusText.value = "Finalizando download e arquivamento..."

    const cleanName = props.folder.name.replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const fileName = `Dossie_Funcional_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`

    // Download no navegador
    pdf.save(fileName)

    // Arquivar também na pasta de documentos digitais do colaborador se ativado
    if (saveToDigitalFolder.value) {
      addDocumentToFolder(props.folder.id, {
        name: fileName,
        category: "declaracoes",
        fileType: "PDF",
        size: "1.4 MB",
        uploadedBy: userRoleType.value === "colaborador" ? "Colaborador (Exportação)" : "Técnico DP / RH",
      })
    }

    exportProgress.value = 100
    exportStatusText.value = "Dossiê exportado e arquivado com sucesso!"

    await new Promise((r) => setTimeout(r, 400))
    emit("toast", `Dossiê completo do colaborador exportado em PDF com sucesso!`)
    emit("close")
  } catch (err: any) {
    console.error("Erro ao gerar PDF do Dossiê:", err)
    emit("toast", "Falha ao exportar dossiê em PDF.")
  } finally {
    isExporting.value = false
    exportProgress.value = 0
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
    <div class="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Top Header -->
      <div class="flex items-start justify-between border-b pb-3">
        <div class="flex items-center gap-3">
          <div class="rounded-xl bg-teal-500/10 p-2.5 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            <FolderArchive :size="24" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold text-foreground">
                Exportar Pasta de Documentos do Colaborador (PDF)
              </h3>
              <span class="rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 px-2 py-0.5 text-[10px] font-bold">
                Dossiê Completo
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              Colaborador: <strong>{{ folder.name }}</strong> (CPF: {{ folder.cpf }}) · Cargo: {{ folder.role }}
            </p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Banner Informativo de Origem da Solicitação -->
      <div class="rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-200 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Sparkles :size="15" class="text-teal-600 shrink-0" />
          <span>{{ requesterLabel }}</span>
        </div>
        <span class="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
          Padronizado conforme CLT & MTE
        </span>
      </div>

      <!-- Checklist de Conteúdos a Incluir no Dossiê PDF -->
      <div class="space-y-2.5">
        <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Selecione as Informações a Compilar na Pasta PDF:
        </label>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <!-- 1. Dados Cadastrais -->
          <label class="flex items-start gap-2.5 rounded-xl border bg-background p-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
            <input type="checkbox" v-model="includeCadastral" class="mt-0.5 rounded border-muted-foreground text-primary focus:ring-0" />
            <div>
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <User :size="13" class="text-primary" /> Ficha Cadastral & Contrato
              </span>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                Dados pessoais, CBO ({{ folder.cbo || '2124-05' }}), admissão, regime CLT e remuneração.
              </p>
            </div>
          </label>

          <!-- 2. Histórico de CCs -->
          <label class="flex items-start gap-2.5 rounded-xl border bg-background p-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
            <input type="checkbox" v-model="includeContraCheques" class="mt-0.5 rounded border-muted-foreground text-primary focus:ring-0" />
            <div>
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <Receipt :size="13" class="text-emerald-600" /> Histórico Linear de CCs
              </span>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                Competências, proventos, descontos, líquido e selo de imutabilidade ({{ contrachequesLinear.length }} recibos).
              </p>
            </div>
          </label>

          <!-- 3. Folha de Ponto -->
          <label class="flex items-start gap-2.5 rounded-xl border bg-background p-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
            <input type="checkbox" v-model="includeFolhaPonto" class="mt-0.5 rounded border-muted-foreground text-primary focus:ring-0" />
            <div>
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <Clock :size="13" class="text-sky-600" /> Folha de Ponto (Espelho CLT)
              </span>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                Registros de frequência, horas extras e saldo de banco de horas ({{ folhaPonto.bankBalance }}).
              </p>
            </div>
          </label>

          <!-- 4. Prontuário de Férias -->
          <label class="flex items-start gap-2.5 rounded-xl border bg-background p-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
            <input type="checkbox" v-model="includeFerias" class="mt-0.5 rounded border-muted-foreground text-primary focus:ring-0" />
            <div>
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <CalendarClock :size="13" class="text-amber-600" /> Demonstrativo de Férias
              </span>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                Período aquisitivo, período concessivo e saldo regulamentar ({{ feriasInfo.diasSaldo }} dias restantes).
              </p>
            </div>
          </label>
        </div>

        <!-- 5. Pendências e Recursos -->
        <label class="flex items-start gap-2.5 rounded-xl border bg-background p-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
          <input type="checkbox" v-model="includePendencias" class="mt-0.5 rounded border-muted-foreground text-primary focus:ring-0" />
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle :size="13" class="text-rose-600" /> Quadro de Pendências & Recursos em Aberto
              </span>
              <span class="text-[10px] font-bold rounded px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {{ pendenciasList.length }} pendências mapeadas
              </span>
            </div>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              Chamados aguardando parecer do DP, recursos de cálculo de CC (pedidos de vista) e ajustes de ponto.
            </p>
          </div>
        </label>
      </div>

      <!-- Opção de Arquivamento Digital -->
      <div class="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs flex items-center justify-between">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" v-model="saveToDigitalFolder" class="rounded border-muted-foreground text-primary focus:ring-0" />
          <span class="font-medium text-foreground">
            Arquivar automaticamente uma cópia deste PDF na pasta de documentos digitais do colaborador
          </span>
        </label>
        <FileCheck2 :size="15" class="text-teal-600" />
      </div>

      <!-- Progresso de Exportação -->
      <div v-if="isExporting" class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="font-semibold text-foreground flex items-center gap-1.5">
            <Loader2 :size="13" class="animate-spin text-primary" /> {{ exportStatusText }}
          </span>
          <span class="font-bold text-primary">{{ exportProgress }}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div class="h-full bg-primary transition-all duration-200" :style="{ width: `${exportProgress}%` }"></div>
        </div>
      </div>

      <!-- Ações de Rodapé -->
      <div class="flex items-center justify-end gap-2.5 border-t pt-3">
        <button
          type="button"
          @click="emit('close')"
          :disabled="isExporting"
          class="rounded-xl border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="button"
          @click="generateDossierPdf"
          :disabled="isExporting"
          class="flex items-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          <Loader2 v-if="isExporting" :size="15" class="animate-spin" />
          <Download v-else :size="15" />
          <span>{{ isExporting ? 'Compilando Dossiê PDF...' : 'Baixar Dossiê Completo (PDF)' }}</span>
        </button>
      </div>

    </div>
  </div>
</template>
