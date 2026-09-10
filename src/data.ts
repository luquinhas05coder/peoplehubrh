export type Channel = "interno" | "whatsapp" | "email" | "instagram" | "telegram"

export type Topic =
  | "ferias"
  | "folha"
  | "beneficios"
  | "recrutamento"
  | "desligamento"
  | "geral"

export type MessageDirection = "in" | "out"

export type Priority = "baixa" | "media" | "alta"

export interface MessageRef {
  id: string
  text: string
  author: string
}

export interface Message {
  id: string
  direction: MessageDirection
  text: string
  time: string
  status?: "enviado" | "entregue" | "lido"
  replyTo?: MessageRef
  forwarded?: boolean
}

export interface Conversation {
  id: string
  name: string
  initials: string
  channel: Channel
  topic: Topic
  role: string
  department: string
  lastMessage: string
  time: string
  unread: number
  online: boolean
  status: "aberto" | "pendente" | "resolvido"
  priority: Priority
  pinned: boolean
  snoozedUntil: string | null
  assignedTo: string
  contact: {
    email: string
    phone: string
    location: string
    tenure: string
    manager: string
  }
  messages: Message[]
}

export const channelLabels: Record<Channel, string> = {
  interno: "Chat Interno",
  whatsapp: "Chat Interno",
  email: "Chat Interno",
  instagram: "Chat Interno",
  telegram: "Chat Interno",
}

export const channelColors: Record<Channel, string> = {
  interno: "var(--color-primary)",
  whatsapp: "var(--color-primary)",
  email: "var(--color-primary)",
  instagram: "var(--color-primary)",
  telegram: "var(--color-primary)",
}

export const topicLabels: Record<Topic, string> = {
  ferias: "Férias",
  folha: "Folha de Pagamento",
  beneficios: "Benefícios",
  recrutamento: "Recrutamento",
  desligamento: "Desligamento",
  geral: "Geral",
}

/* Hierarquia de prioridades — 3 níveis de urgência crescentes */
export interface PriorityMeta {
  label: string
  short: string
  level: 1 | 2 | 3
  color: string
  soft: string
}

export const priorityConfig: Record<Priority, PriorityMeta> = {
  baixa: { label: "Baixa urgência", short: "Baixa", level: 1, color: "var(--color-success)", soft: "var(--color-success-soft)" },
  media: { label: "Média urgência", short: "Média", level: 2, color: "var(--color-accent)", soft: "var(--color-accent-soft)" },
  alta: { label: "Alta urgência", short: "Alta", level: 3, color: "var(--color-danger)", soft: "var(--color-danger-soft)" },
}

export const priorityOrder: Priority[] = ["baixa", "media", "alta"]

/* Opções de adiamento */
export interface SnoozeOption {
  id: string
  label: string
  minutes: number | null
}

export const snoozeOptions: SnoozeOption[] = [
  { id: "30m", label: "30 minutos", minutes: 30 },
  { id: "1h", label: "1 hora", minutes: 60 },
  { id: "3h", label: "3 horas", minutes: 180 },
  { id: "1d", label: "1 dia", minutes: 1440 },
  { id: "inf", label: "Indeterminado", minutes: null },
]

export const conversations: Conversation[] = []

/* --- Pastas de Colaboradores (Módulo de Colaboradores) --- */
export type DocCategory =
  | "pessoais"
  | "contratos"
  | "exames"
  | "holerites"
  | "certificados"

export const docCategoryLabels: Record<DocCategory, string> = {
  pessoais: "Documentos Pessoais",
  contratos: "Contratos & Aditivos",
  exames: "Exames Médicos (ASO)",
  holerites: "Holerites & Folha",
  certificados: "Certificados & Cursos",
}

export interface EmployeeDocument {
  id: string
  name: string
  category: DocCategory
  fileType: string
  size: string
  uploadedAt: string
  uploadedBy: string
}

export interface EmployeeFolder {
  id: string
  name: string
  initials: string
  cpf: string
  registration: string // Matrícula
  role: string
  department: string
  email: string
  phone: string
  location: string
  tenure: string
  manager: string
  admissionDate: string
  status: "ativo" | "ferias" | "afastado" | "desligado"
  documents: EmployeeDocument[]
  notes?: string
  cep?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  cbo?: string
  cboTitle?: string
  salary?: string
}

import type { HoleriteCalculado } from "./utils/payroll"

export interface ContraChequeSnapshot {
  id: string
  employeeId: string
  month: string
  generatedAt: string
  employeeName: string
  cpf: string
  registration: string
  role: string
  department: string
  admissionDate: string
  cbo: string
  cboTitle?: string
  salary: string
  holerite: HoleriteCalculado
}

/* ─── Tipos e Modelos da Folha de Ponto Eletrônica (CLT / Portaria 671 MTE) ─── */
export interface TimeRecord {
  day: number
  weekDay: string
  isWeekend: boolean
  isHoliday: boolean
  entry1: string
  exit1: string
  entry2: string
  exit2: string
  workedMinutes: number
  workedHours: string
  extraMinutes: number
  extraHours: string
  absenceMinutes: number
  absenceHours: string
  status: "normal" | "dsr" | "ferias" | "atestado" | "ajuste_pendente" | "falta" | "compensacao" | "feriado"
  statusLabel: string
  observation?: string
}

export interface FolhaDePontoSnapshot {
  id: string
  employeeId: string
  month: string
  generatedAt: string
  employeeName: string
  registration: string
  role: string
  department: string
  records: TimeRecord[]
  totalWorkedHours: string
  totalExtraHours: string
  totalAbsences: string
  bankBalance: string
  bankBalanceMinutes: number
}

export interface PontoPunchReceipt {
  id: string
  nsr: string
  timestamp: string
  date: string
  time: string
  type: "Entrada 1" | "Saída Intervalo" | "Retorno Intervalo" | "Saída Fim de Expediente"
  employeeName: string
  cpf: string
  companyName: string
  cnpj: string
  hash: string
  location: string
}

export const initialEmployeeFolders: EmployeeFolder[] = []

/* ─── Tipos e Dados do Módulo de Solicitações de RH ───────── */

export type RequestType = "ferias" | "atestado" | "reembolso" | "ponto" | "documento" | "contracheque"
export type RequestStatus = "pendente" | "em_analise" | "aprovado" | "recusado"
export type RequestPriority = "baixa" | "media" | "alta" | "urgente"

export interface RequestItem {
  id: string
  protocol: string
  employeeName: string
  employeeInitials: string
  employeeRole: string
  department: string
  type: RequestType
  title: string
  description: string
  startDate?: string
  endDate?: string
  amount?: string
  attachment?: string
  status: RequestStatus
  priority: RequestPriority
  createdAt: string
  reviewedBy?: string
  reviewNote?: string
}

export const requestTypeLabels: Record<RequestType, string> = {
  ferias: "Férias & Licenças",
  atestado: "Atestado Médico",
  reembolso: "Reembolso de Despesas",
  ponto: "Ajuste de Ponto",
  documento: "Declarações & Documentos",
  contracheque: "Contra-Cheque / Holerite",
}

export const requestStatusLabels: Record<RequestStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em Análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
}

export const initialRequests: RequestItem[] = [
  {
    id: "REQ-2026-001",
    protocol: "REQ-2026-001",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor de Software",
    department: "Tecnologia",
    type: "documento",
    title: "Declaração de Vínculo Empregatício",
    description: "Solicito declaração de vínculo empregatício atualizada para comprovação de renda em instituição financeira.",
    status: "aprovado",
    priority: "media",
    createdAt: "10/08/2026",
    reviewedBy: "Mariana Alcantara",
    reviewNote: "Solicitação aprovada e declaração emitida com sucesso no acervo de documentos.",
  },
  {
    id: "REQ-2026-002",
    protocol: "REQ-2026-002",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor de Software",
    department: "Tecnologia",
    type: "contracheque",
    title: "Emissão de Contra-Cheque 08/2026",
    description: "Solicito a emissão do meu demonstrativo de pagamento referente à competência de Agosto de 2026.",
    status: "aprovado",
    priority: "media",
    createdAt: "01/09/2026",
    reviewedBy: "Carlos Eduardo Souza",
    reviewNote: "Holerite processado e disponibilizado para consulta.",
  },
  {
    id: "REQ-2026-003",
    protocol: "REQ-2026-003",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor de Software",
    department: "Tecnologia",
    type: "ferias",
    title: "Solicitação de Programação de Férias",
    description: "Gostaria de solicitar o agendamento de 15 dias de férias para o período de 15/10/2026 a 30/10/2026.",
    startDate: "15/10/2026",
    endDate: "30/10/2026",
    status: "pendente",
    priority: "media",
    createdAt: "05/09/2026",
  },
]

/* ─── Tipos e Dados do Módulo de Documentos ──────────────── */

export type DocumentCategory = "contratos" | "declaracoes" | "ferias" | "rescisao" | "politicas"
export type DocumentSignStatus = "assinado" | "pendente_assinatura" | "rascunho"

export interface DocumentTemplate {
  id: string
  title: string
  category: DocumentCategory
  description: string
  iconName: string
  fields: string[]
  templateText: string
}

export interface SystemDocument {
  id: string
  code: string
  title: string
  category: DocumentCategory
  employeeName: string
  employeeInitials: string
  employeeRole: string
  department: string
  fileType: string
  fileSize: string
  generatedAt: string
  generatedBy: string
  signStatus: DocumentSignStatus
  contentSnippet: string
}

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  contratos: "Contratos & Aditivos",
  declaracoes: "Declarações Oficiais",
  ferias: "Férias & Licenças",
  rescisao: "Rescisão & Desligamento",
  politicas: "Políticas & Regulamentos",
}

export const initialDocumentTemplates: DocumentTemplate[] = [
  {
    id: "tpl-1",
    title: "Declaração de Vínculo Empregatício",
    category: "declaracoes",
    description: "Modelo oficial para comprovação de emprego, cargo e jornada de trabalho para fins bancários ou acadêmicos.",
    iconName: "FileCheck",
    fields: ["nome", "cpf", "cargo", "departamento", "dataAdmissao"],
    templateText: "Declaramos para os devidos fins que o(a) Sr(a). {nome}, inscrito(a) no CPF sob o nº {cpf}, é nosso(a) colaborador(a) contratado(a) sob o regime CLT, exercendo a função de {cargo} no departamento de {department}, admitido(a) em {dataAdmissao}, com vínculo empregatício ativo e em pleno cumprimento de suas obrigações contratuais.",
  },
  {
    id: "tpl-2",
    title: "Aviso Prévio de Concessão de Férias",
    category: "ferias",
    description: "Notificação compulsória de concessão de férias com 30 dias de antecedência conforme a CLT.",
    iconName: "CalendarCheck",
    fields: ["nome", "cpf", "cargo", "periodoAquisitivo", "inicioFerias", "fimFerias"],
    templateText: "Vimos por meio deste notificar o(a) colaborador(a) {nome}, ocupante do cargo de {cargo}, que as suas férias relativas ao período aquisitivo {periodoAquisitivo} serão concedidas no período de {inicioFerias} a {fimFerias}, devendo retornar às suas atividades normais no primeiro dia útil subsequente.",
  },
  {
    id: "tpl-3",
    title: "Aditivo de Contrato — Regime Teletrabalho (Home Office)",
    category: "contratos",
    description: "Termo aditivo ao contrato de trabalho formalizando a alteração de trabalho presencial para modelo híbrido ou remoto.",
    iconName: "FileText",
    fields: ["nome", "cpf", "cargo", "modeloTrabalho", "equipamentos"],
    templateText: "Termo Aditivo ao Contrato de Trabalho. Fica pactuado entre as partes a alteração da modalidade de prestação de serviços do(a) colaborador(a) {nome} para o regime de {modeloTrabalho}, mediante a cessão dos equipamentos de trabalho {equipamentos} e observância da política de segurança da informação da empresa.",
  },
  {
    id: "tpl-4",
    title: "Termo de Confidencialidade e Não Divulgação (NDA)",
    category: "contratos",
    description: "Acordo de confidencialidade protegendo dados estratégicos, segredos industriais e dados pessoais (LGPD).",
    iconName: "Shield",
    fields: ["nome", "cpf", "cargo", "departamento"],
    templateText: "Pelo presente instrumento, o(a) colaborador(a) {nome}, no exercício do cargo de {cargo}, compromete-se a manter sob sigilo absoluto todas as informações confidenciais, dados de clientes, projetos e segredos de negócio da empresa a que tiver acesso durante e após a vigência do vínculo profissional.",
  },
  {
    id: "tpl-5",
    title: "Informe de Rendimentos e Retenção de Imposto",
    category: "declaracoes",
    description: "Comprovante anual de rendimentos pagos e retenção de imposto de renda na fonte para a declaração do IRPF.",
    iconName: "DollarSign",
    fields: ["nome", "cpf", "anoCalendario", "rendimentosTributaveis"],
    templateText: "Comprovante de Rendimentos Pagos e de Retenção de Imposto de Renda na Fonte referente ao ano-calendário {anoCalendario} emitido em nome de {nome}, CPF {cpf}, atestando o valor total tributável acumulado no período de {rendimentosTributaveis}.",
  },
]

export const initialSystemDocuments: SystemDocument[] = [
  {
    id: "doc-sys-101",
    code: "DOC-2026-001",
    title: "Declaração de Vínculo Empregatício",
    category: "declaracoes",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor de Software",
    department: "Tecnologia",
    fileType: "PDF",
    fileSize: "1.4 MB",
    generatedAt: "10/08/2026",
    generatedBy: "Mariana Alcantara",
    signStatus: "assinado",
    contentSnippet: "Declaramos para os devidos fins que o(a) colaborador(a) Gabriel Santos exerce o cargo de Desenvolvedor de Software com vínculo empregatício CLT ativo.",
  },
  {
    id: "doc-sys-102",
    code: "DOC-2026-002",
    title: "Comprovante de Rendimentos & IRPF 2026",
    category: "declaracoes",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor de Software",
    department: "Tecnologia",
    fileType: "PDF",
    fileSize: "1.1 MB",
    generatedAt: "15/02/2026",
    generatedBy: "Carlos Eduardo Souza",
    signStatus: "assinado",
    contentSnippet: "Informe de rendimentos brutos, tributáveis e de retenção de imposto de renda retido na fonte referente ao exercício anual.",
  },
  {
    id: "doc-sys-103",
    code: "DOC-2026-003",
    title: "Termo de Confidencialidade e Uso de Equipamentos (LGPD)",
    category: "politicas",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor de Software",
    department: "Tecnologia",
    fileType: "PDF",
    fileSize: "2.1 MB",
    generatedAt: "01/02/2025",
    generatedBy: "Lucas Mendes",
    signStatus: "assinado",
    contentSnippet: "Termo de responsabilidade e segurança da informação referente ao uso de equipamentos corporativos e proteção de dados.",
  },
]

/* ─── Tipos e Dados do Módulo de Onboarding ──────────────── */

export type OnboardingStatus = "em_andamento" | "concluido" | "atrasado" | "aguardando_ti"

export interface OnboardingStep {
  id: string
  title: string
  category: "documentacao" | "ti" | "treinamento" | "rh"
  completed: boolean
  dueDate?: string
}

export interface OnboardingItem {
  id: string
  employeeName: string
  employeeInitials: string
  role: string
  department: string
  startDate: string
  buddy: string
  trackTitle: string
  status: OnboardingStatus
  checklist: OnboardingStep[]
  notes?: string
}

export interface OnboardingTrack {
  id: string
  title: string
  department: string
  durationDays: number
  totalModules: number
  description: string
  modulesList: string[]
  recommendedFor: string
}

export const onboardingStatusLabels: Record<OnboardingStatus, string> = {
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  atrasado: "Com Atraso",
  aguardando_ti: "Aguardando TI",
}

export const initialOnboardingItems: OnboardingItem[] = []

export const initialOnboardingTracks: OnboardingTrack[] = [
  {
    id: "trk-1",
    title: "Trilha de Engenharia & Tech Stack",
    department: "Tecnologia",
    durationDays: 14,
    totalModules: 5,
    description: "Imersão na arquitetura de software, padrões de código, pipeline de CI/CD e boas práticas da equipe de TI.",
    modulesList: ["Cultura Dev & Padrões", "Setup do Ambiente Local", "Segurança de Dados (LGPD)", "Arquitetura da Aplicação", "Primeiro Deploy Acompanhado"],
    recommendedFor: "Desenvolvedores, DevOps, QA e Arquitetos",
  },
  {
    id: "trk-2",
    title: "Trilha de Marketing & Growth",
    department: "Marketing",
    durationDays: 10,
    totalModules: 4,
    description: "Posicionamento de marca, guia de estilo de design, funil de aquisição B2B e ferramentas de mensuração de métricas.",
    modulesList: ["Branding & Tom de Voz", "Ferramentas & Analytics", "Estratégia de Conteúdo B2B", "Fluxo de Aprovação de Campanhas"],
    recommendedFor: "Analistas de Marketing, Designers e Copywriters",
  },
  {
    id: "trk-3",
    title: "Trilha Comercial & Vendas B2B",
    department: "Vendas",
    durationDays: 10,
    totalModules: 4,
    description: "Metodologia de vendas consultivas, matriz de objeções, demonstração do produto PeopleHub e alinhamento de metas.",
    modulesList: ["Apresentação das Soluções PeopleHub", "Gatilhos de Vendas & Objeções", "Utilização do CRM", "Simulação de Reunião com Cliente"],
    recommendedFor: "SDRs, Executivos de Vendas e Account Executives",
  },
  {
    id: "trk-4",
    title: "Trilha Institucional de Cultura & RH",
    department: "Geral / Todos",
    durationDays: 5,
    totalModules: 3,
    description: "Visão geral da empresa, código de conduta, benefícios, estrutura organizacional e canais de atendimento.",
    modulesList: ["Boas-Vindas da Diretoria", "Benefícios & Folha de Pagamento", "Código de Ética & Conduta"],
    recommendedFor: "Todos os novos colaboradores",
  },
]



