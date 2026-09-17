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

/* ─── Tipos e Modelos de Contratos de Trabalho (Legislação Brasileira) ─── */
export type ContractType =
  | "prazo_indeterminado"
  | "prazo_determinado"
  | "experiencia"
  | "trabalho_intermitente"
  | "pj"

export interface ContractTypeMeta {
  id: ContractType
  label: string
  short: string
  description: string
  legalBasis: string
  tagColor: string
  tagBg: string
  badgeColor: string
  badgeBg: string
  borderStyle: string
  features: string[]
}

export const contractTypeConfigs: Record<ContractType, ContractTypeMeta> = {
  prazo_indeterminado: {
    id: "prazo_indeterminado",
    label: "Prazo Indeterminado",
    short: "CLT Indeterminado",
    description: "Modelo tradicional de contratação CLT, com vínculo contínuo sem data final prefixada.",
    legalBasis: "Art. 442 e 452 da CLT",
    tagColor: "text-emerald-700",
    tagBg: "bg-emerald-50",
    badgeColor: "text-emerald-800",
    badgeBg: "bg-emerald-500/15",
    borderStyle: "border-emerald-500/30",
    features: [
      "Aviso prévio proporcional (Lei 12.506/11)",
      "Multa rescisória de 40% do FGTS",
      "Garantias e estabilidades convencionais",
      "Férias anuais e 13º salário integral",
    ],
  },
  prazo_determinado: {
    id: "prazo_determinado",
    label: "Prazo Determinado",
    short: "CLT Determinado",
    description: "Contrato com termo prefixado ou condicionado a serviço específico (máximo de 2 anos).",
    legalBasis: "Art. 443 da CLT",
    tagColor: "text-amber-700",
    tagBg: "bg-amber-50",
    badgeColor: "text-amber-800",
    badgeBg: "bg-amber-500/15",
    borderStyle: "border-amber-500/30",
    features: [
      "Duração máxima legal de até 2 anos",
      "Permite até 1 prorrogação no período",
      "Sem aviso prévio no término regular",
      "Indenização do art. 479 em rescisão antecipada",
    ],
  },
  experiencia: {
    id: "experiencia",
    label: "Experiência",
    short: "Contrato de Experiência",
    description: "Espécie de prazo determinado para avaliação probatória mútua, limitado a até 90 dias.",
    legalBasis: "Art. 445 e 451 da CLT",
    tagColor: "text-purple-700",
    tagBg: "bg-purple-50",
    badgeColor: "text-purple-800",
    badgeBg: "bg-purple-500/15",
    borderStyle: "border-purple-500/30",
    features: [
      "Prazo máximo estrito de até 90 dias",
      "Geralmente fracionado (45+45 ou 30+60 dias)",
      "Converte-se em prazo indeterminado se ultrapassar",
      "Sem multa de 40% no encerramento natural",
    ],
  },
  trabalho_intermitente: {
    id: "trabalho_intermitente",
    label: "Trabalho Intermitente",
    short: "Intermitente CLT",
    description: "Prestação não contínua com subordinação, alternando períodos de trabalho e inatividade.",
    legalBasis: "Art. 452-A da CLT (Lei 13.467/17)",
    tagColor: "text-cyan-700",
    tagBg: "bg-cyan-50",
    badgeColor: "text-cyan-800",
    badgeBg: "bg-cyan-500/15",
    borderStyle: "border-cyan-500/30",
    features: [
      "Convocação prévia com mín. 3 dias de antecedência",
      "Aceite ou recusa em até 1 dia útil",
      "Pagamento imediato ao fim de cada prestação",
      "DSR, férias e 13º proporcionais pagos no período",
    ],
  },
  pj: {
    id: "pj",
    label: "Prestação de Serviços (PJ)",
    short: "Prestação de Serviços (PJ)",
    description: "Contratação empresarial B2B via Pessoa Jurídica, com emissão de nota fiscal e sem subordinação.",
    legalBasis: "Código Civil & Lei 13.467/17",
    tagColor: "text-indigo-700",
    tagBg: "bg-indigo-50",
    badgeColor: "text-indigo-800",
    badgeBg: "bg-indigo-500/15",
    borderStyle: "border-indigo-500/30",
    features: [
      "Relação estritamente civil/comercial (B2B)",
      "Emissão obrigatória de Nota Fiscal de Serviços",
      "Sem subordinação hierárquica ou controle de jornada rígido",
      "Pagamento mediante fatura ou medição de entregáveis",
    ],
  },
}

/* ─── Tipos e Modelos de Escalas de Trabalho (Sistemas no Brasil) ─── */
export type WorkSchedule =
  | "escala_5x2"
  | "escala_6x1"
  | "escala_12x36"
  | "escala_4x3"

export interface WeeklyScheduleItem {
  day: "Seg" | "Ter" | "Qua" | "Qui" | "Sex" | "Sáb" | "Dom"
  fullName: string
  isWorkDay: boolean
  hours: string
  shift: string
  entryTime?: string
  exitTime?: string
  breakDuration?: string
}

export interface WorkScheduleMeta {
  id: WorkSchedule
  label: string
  short: string
  description: string
  legalBasis: string
  weeklyHours: string
  dailyWorkload: string
  dsrRule: string
  badgeColor: string
  badgeBg: string
  borderStyle: string
  schedulePattern: WeeklyScheduleItem[]
  highlights: string[]
}

export const workScheduleConfigs: Record<WorkSchedule, WorkScheduleMeta> = {
  escala_5x2: {
    id: "escala_5x2",
    label: "Escala 5x2",
    short: "5x2 (Seg-Sex)",
    description: "5 dias trabalhados com 2 dias de folga semanal consecutiva (sábado e domingo).",
    legalBasis: "Art. 58 e 59 da CLT",
    weeklyHours: "44h semanais (ou 40h)",
    dailyWorkload: "8h48/dia (ou 8h/dia)",
    dsrRule: "2 dias de descanso (Sábado e Domingo)",
    badgeColor: "text-teal-800",
    badgeBg: "bg-teal-500/15",
    borderStyle: "border-teal-500/30",
    schedulePattern: [
      { day: "Seg", fullName: "Segunda-feira", isWorkDay: true, hours: "08:00 - 17:48", shift: "8h48 trab. (1h int.)" },
      { day: "Ter", fullName: "Terça-feira", isWorkDay: true, hours: "08:00 - 17:48", shift: "8h48 trab. (1h int.)" },
      { day: "Qua", fullName: "Quarta-feira", isWorkDay: true, hours: "08:00 - 17:48", shift: "8h48 trab. (1h int.)" },
      { day: "Qui", fullName: "Quinta-feira", isWorkDay: true, hours: "08:00 - 17:48", shift: "8h48 trab. (1h int.)" },
      { day: "Sex", fullName: "Sexta-feira", isWorkDay: true, hours: "08:00 - 17:48", shift: "8h48 trab. (1h int.)" },
      { day: "Sáb", fullName: "Sábado", isWorkDay: false, hours: "Folga", shift: "Descanso compensatório" },
      { day: "Dom", fullName: "Domingo", isWorkDay: false, hours: "Folga (DSR)", shift: "Descanso Semanal Remunerado" },
    ],
    highlights: [
      "Jornada mais adotada em escritórios, tecnologia e serviços administrativos",
      "Compensação das 4h de sábado durante a semana (48min diários adicionais)",
      "Descanso continuado de 48 horas aos fins de semana",
    ],
  },
  escala_6x1: {
    id: "escala_6x1",
    label: "Escala 6x1",
    short: "6x1 (Comércio / Varejo)",
    description: "6 dias trabalhados com 1 dia de folga na semana, comum em comércio, hotelaria e serviços.",
    legalBasis: "Art. 67 da CLT e Lei 605/49",
    weeklyHours: "44h semanais",
    dailyWorkload: "7h20/dia (ou 8h Seg-Sex + 4h Sáb)",
    dsrRule: "1 dia de descanso semanal (DSR preferencialmente ao domingo)",
    badgeColor: "text-blue-800",
    badgeBg: "bg-blue-500/15",
    borderStyle: "border-blue-500/30",
    schedulePattern: [
      { day: "Seg", fullName: "Segunda-feira", isWorkDay: true, hours: "08:00 - 16:20", shift: "7h20 trab. (1h int.)" },
      { day: "Ter", fullName: "Terça-feira", isWorkDay: true, hours: "08:00 - 16:20", shift: "7h20 trab. (1h int.)" },
      { day: "Qua", fullName: "Quarta-feira", isWorkDay: true, hours: "08:00 - 16:20", shift: "7h20 trab. (1h int.)" },
      { day: "Qui", fullName: "Quinta-feira", isWorkDay: true, hours: "08:00 - 16:20", shift: "7h20 trab. (1h int.)" },
      { day: "Sex", fullName: "Sexta-feira", isWorkDay: true, hours: "08:00 - 16:20", shift: "7h20 trab. (1h int.)" },
      { day: "Sáb", fullName: "Sábado", isWorkDay: true, hours: "08:00 - 16:20", shift: "7h20 trab. (1h int.)" },
      { day: "Dom", fullName: "Domingo", isWorkDay: false, hours: "Folga (DSR)", shift: "Descanso Semanal Remunerado" },
    ],
    highlights: [
      "Ampla utilização em comércio, varejo, restaurantes e hospitais",
      "Exigência de pelo menos 1 domingo de folga a cada 3 a 7 semanas (CLT / Lei do Comércio)",
      "Intervalo mínimo interjornada de 11h consecutivas entre cada expediente",
    ],
  },
  escala_12x36: {
    id: "escala_12x36",
    label: "Escala 12x36",
    short: "12x36 (Plantão)",
    description: "12 horas ininterruptas de trabalho seguidas de 36 horas ininterruptas de folga/descanso.",
    legalBasis: "Art. 59-A da CLT (Reforma Trabalhista)",
    weeklyHours: "36h a 42h (média variável)",
    dailyWorkload: "12h por turno de plantão",
    dsrRule: "36 horas de descanso ininterrupto entre plantões",
    badgeColor: "text-amber-800",
    badgeBg: "bg-amber-500/15",
    borderStyle: "border-amber-500/30",
    schedulePattern: [
      { day: "Seg", fullName: "Segunda-feira", isWorkDay: true, hours: "07:00 - 19:00", shift: "Plantão 12h (1h int.)" },
      { day: "Ter", fullName: "Terça-feira", isWorkDay: false, hours: "Descanso 36h", shift: "Folga ininterrupta" },
      { day: "Qua", fullName: "Quarta-feira", isWorkDay: true, hours: "07:00 - 19:00", shift: "Plantão 12h (1h int.)" },
      { day: "Qui", fullName: "Quinta-feira", isWorkDay: false, hours: "Descanso 36h", shift: "Folga ininterrupta" },
      { day: "Sex", fullName: "Sexta-feira", isWorkDay: true, hours: "07:00 - 19:00", shift: "Plantão 12h (1h int.)" },
      { day: "Sáb", fullName: "Sábado", isWorkDay: false, hours: "Descanso 36h", shift: "Folga ininterrupta" },
      { day: "Dom", fullName: "Domingo", isWorkDay: true, hours: "07:00 - 19:00", shift: "Plantão 12h (1h int.)" },
    ],
    highlights: [
      "Autorizado por acordo individual escrito, convenção ou acordo coletivo",
      "DSR e feriados trabalhados já são compensados pelas 36h de folga (Súmula 444 TST / Art. 59-A)",
      "Intervalo intrajornada obrigatório de 1h (pode ser indenizado se houver previsão em acordo)",
    ],
  },
  escala_4x3: {
    id: "escala_4x3",
    label: "Escala 4x3",
    short: "4x3 (Semana de 4 dias)",
    description: "4 dias de trabalho por 3 dias de descanso consecutivo (semana de 4 dias / modelo flexível).",
    legalBasis: "Acordo Coletivo / Convenção Coletiva (Art. 59 da CLT)",
    weeklyHours: "32h a 36h semanais (ou 40h com 10h/dia)",
    dailyWorkload: "8h a 9h/dia",
    dsrRule: "3 dias de folga na semana (Sexta, Sábado e Domingo)",
    badgeColor: "text-emerald-800",
    badgeBg: "bg-emerald-500/15",
    borderStyle: "border-emerald-500/30",
    schedulePattern: [
      { day: "Seg", fullName: "Segunda-feira", isWorkDay: true, hours: "08:00 - 17:00", shift: "8h trab. (1h int.)" },
      { day: "Ter", fullName: "Terça-feira", isWorkDay: true, hours: "08:00 - 17:00", shift: "8h trab. (1h int.)" },
      { day: "Qua", fullName: "Quarta-feira", isWorkDay: true, hours: "08:00 - 17:00", shift: "8h trab. (1h int.)" },
      { day: "Qui", fullName: "Quinta-feira", isWorkDay: true, hours: "08:00 - 17:00", shift: "8h trab. (1h int.)" },
      { day: "Sex", fullName: "Sexta-feira", isWorkDay: false, hours: "Folga Flex", shift: "Descanso corporativo (4-Day Week)" },
      { day: "Sáb", fullName: "Sábado", isWorkDay: false, hours: "Folga", shift: "Descanso de fim de semana" },
      { day: "Dom", fullName: "Domingo", isWorkDay: false, hours: "Folga (DSR)", shift: "Descanso Semanal Remunerado" },
    ],
    highlights: [
      "Modelo global de alta produtividade e retenção de talentos (4 Day Week Global)",
      "Proporciona 3 dias de descanso consecutivo para recarga física e mental",
      "Formalizado via acordo de compensação de horas ou política corporativa de redução de jornada sem redução salarial",
    ],
  },
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
  contractType?: ContractType
  workSchedule?: WorkSchedule
  customSchedulePattern?: WeeklyScheduleItem[]
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

export const initialRequests: RequestItem[] = []

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

export const initialSystemDocuments: SystemDocument[] = []

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



