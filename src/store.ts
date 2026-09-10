import { ref, computed } from "vue"
import type {
  Conversation,
  Message,
  Topic,
  Priority,
  Channel,
  EmployeeFolder,
  EmployeeDocument,
  DocCategory,
  RequestItem,
  RequestStatus,
  RequestType,
  RequestPriority,
  DocumentTemplate,
  SystemDocument,
  DocumentCategory,
  DocumentSignStatus,
  OnboardingItem,
  OnboardingTrack,
  OnboardingStep,
  ContraChequeSnapshot,
  TimeRecord,
  FolhaDePontoSnapshot,
  PontoPunchReceipt,
} from "./data"
import { calcularHoleriteCompleto, recalcularHoleriteComRubricas, type HoleriteItem } from "./utils/payroll"
import {
  conversations as initialConversations,
  initialEmployeeFolders,
  initialRequests,
  initialDocumentTemplates,
  initialSystemDocuments,
  initialOnboardingItems,
  initialOnboardingTracks,
} from "./data"

/* ─── Toast System ────────────────────────────────────────── */
export interface ToastNotification {
  id: number
  title: string
  type: "success" | "info" | "warning" | "error"
}

export const activeToasts = ref<ToastNotification[]>([])

export function showToast(title: string, type: "success" | "info" | "warning" | "error" = "success") {
  const id = Date.now() + Math.random()
  activeToasts.value.push({ id, title, type })
  setTimeout(() => {
    activeToasts.value = activeToasts.value.filter((t) => t.id !== id)
  }, 4000)
}

/* ─── Auth State & RBAC (Perfis de Acesso) ──────────────── */
export type UserRoleType = "rh" | "dp" | "ti" | "colaborador"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  roleType?: UserRoleType
  initials: string
  department: string
}

export const PRESET_USERS: Record<UserRoleType, AuthUser> = {
  rh: {
    id: "usr_rh",
    name: "Mariana Alcantara",
    email: "rh@peoplehub.com.br",
    role: "Gestora de RH & DHO",
    roleType: "rh",
    initials: "MA",
    department: "Recursos Humanos",
  },
  dp: {
    id: "usr_dp",
    name: "Carlos Eduardo Souza",
    email: "dp@peoplehub.com.br",
    role: "Especialista em DP & Folha",
    roleType: "dp",
    initials: "CS",
    department: "Departamento Pessoal",
  },
  ti: {
    id: "usr_ti",
    name: "Lucas Mendes",
    email: "ti@peoplehub.com.br",
    role: "Administrador de Sistemas & TI",
    roleType: "ti",
    initials: "LM",
    department: "Tecnologia da Informação",
  },
  colaborador: {
    id: "usr_colab",
    name: "Gabriel Santos",
    email: "colaborador@peoplehub.com.br",
    role: "Desenvolvedor de Software",
    roleType: "colaborador",
    initials: "GS",
    department: "Tecnologia",
  },
}

interface AllowedUser extends AuthUser {
  passwordHash: string
}

export const isAuthenticated = ref<boolean>(false)
export const currentUser = ref<AuthUser | null>(null)
export const authStep = ref<"login" | "mfa" | "done">("login")
export const mfaCode = ref<string>("")
export const pendingToken = ref<string>("")
export const sessionToken = ref<string>("")
let mfaPendingUser: AllowedUser | null = null

export const userRoleType = computed<UserRoleType>(() => {
  if (!currentUser.value) return "rh"
  if (currentUser.value.roleType) return currentUser.value.roleType
  const r = (currentUser.value.role || "").toLowerCase()
  const d = (currentUser.value.department || "").toLowerCase()
  const e = (currentUser.value.email || "").toLowerCase()
  if (e.includes("ti@") || r.includes("ti") || r.includes("sistemas") || d.includes("tecnologia") || d.includes("t.i")) return "ti"
  if (e.includes("dp@") || r.includes("dp") || r.includes("pessoal") || r.includes("folha") || d.includes("departamento pessoal")) return "dp"
  if (e.includes("colaborador@") || r.includes("colaborador") || r.includes("desenvolvedor") || r.includes("designer")) return "colaborador"
  return "rh"
})

export const userPermissions = computed(() => {
  const role = userRoleType.value
  return {
    role,
    isRH: role === "rh",
    isDP: role === "dp",
    isTI: role === "ti",
    isColaborador: role === "colaborador",
    canManageChat: true,
    canManagePeople: role !== "colaborador",
    canManageTraining: role !== "colaborador",
    canManagePayroll: role === "dp" || role === "rh",
    canManageDocs: role !== "colaborador",
    canViewReports: role !== "colaborador",
    canManageSettings: role === "ti" || role === "rh",
    canManageTiChecklist: role === "ti" || role === "rh",
  }
})

export function loginAsPreset(roleType: UserRoleType) {
  const user = PRESET_USERS[roleType]
  currentUser.value = { ...user }
  isAuthenticated.value = true
  authStep.value = "done"
  showToast(`Conectado como ${user.name} (${user.role})!`, "success")
  fetchAllFromBackend()
}

function generateMfaCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function loginUser(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.toLowerCase().trim()
  let detectedRoleType: UserRoleType = "rh"
  let detectedRole = "Gestor de RH"
  let detectedDept = "Recursos Humanos"

  if (e.includes("dp@") || e.includes("folha@") || e.includes("pessoal@")) {
    detectedRoleType = "dp"
    detectedRole = "Especialista em DP & Folha"
    detectedDept = "Departamento Pessoal"
  } else if (e.includes("ti@") || e.includes("suporte@") || e.includes("tech@")) {
    detectedRoleType = "ti"
    detectedRole = "Administrador de Sistemas & TI"
    detectedDept = "Tecnologia da Informação"
  } else if (e.includes("colaborador@") || e.includes("dev@") || e.includes("funcionario@")) {
    detectedRoleType = "colaborador"
    detectedRole = "Colaborador"
    detectedDept = "Operações"
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.ok && data.user) {
      sessionToken.value = data.token || ""
      currentUser.value = {
        ...data.user,
        roleType: detectedRoleType,
      }
      isAuthenticated.value = true
      authStep.value = "done"
      showToast(`Bem-vindo, ${data.user.name}!`, "success")
      fetchAllFromBackend()
      return { ok: true }
    } else if (data.ok) {
      currentUser.value = {
        id: "usr_1",
        name: email.split("@")[0] || "Usuário",
        email,
        role: detectedRole,
        roleType: detectedRoleType,
        department: detectedDept,
        initials: (email[0] || "US").toUpperCase(),
      }
      isAuthenticated.value = true
      authStep.value = "done"
      showToast("Login efetuado com sucesso!", "success")
      fetchAllFromBackend()
      return { ok: true }
    } else {
      return { ok: false, error: data.error || "Falha no login." }
    }
  } catch (_e) {
    const rawName = email.split("@")[0].replace(/\./g, " ")
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1)
    currentUser.value = {
      id: "usr_local",
      name,
      email,
      role: detectedRole,
      roleType: detectedRoleType,
      department: detectedDept,
      initials: name.slice(0, 2).toUpperCase() || "US",
    }
    isAuthenticated.value = true
    authStep.value = "done"
    showToast("Login efetuado com sucesso!", "success")
    return { ok: true }
  }
}

export async function resendMfaCode(): Promise<void> {
  try {
    const res = await fetch("/api/auth/resend-mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pendingToken: pendingToken.value }),
    })
    const data = await res.json()
    if (data.ok && data.mfaCode) {
      mfaCode.value = data.mfaCode
      showToast("Novo código 2FA enviado com sucesso!", "success")
      return
    }
  } catch (_e) {}

  mfaCode.value = generateMfaCode()
  showToast("Novo código 2FA reenviado!", "info")
}

export async function verifyMfaCode(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/verify-mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pendingToken: pendingToken.value, code }),
    })
    const data = await res.json()
    if (data.ok && data.user) {
      sessionToken.value = data.token || ""
      currentUser.value = data.user
      isAuthenticated.value = true
      authStep.value = "done"
      mfaCode.value = ""
      pendingToken.value = ""
      showToast(`Bem-vindo, ${data.user.name}!`, "success")
      fetchAllFromBackend()
      return { ok: true }
    } else if (data.error) {
      return { ok: false, error: data.error }
    }
  } catch (_e) {}

  if (code !== mfaCode.value) return { ok: false, error: "Código inválido. Verifique e tente novamente." }
  if (!mfaPendingUser) return { ok: false, error: "Sessão expirada. Faça login novamente." }

  currentUser.value = {
    id: mfaPendingUser.id,
    name: mfaPendingUser.name,
    email: mfaPendingUser.email,
    role: mfaPendingUser.role,
    initials: mfaPendingUser.initials,
    department: mfaPendingUser.department,
  }
  isAuthenticated.value = true
  authStep.value = "done"
  mfaCode.value = ""
  mfaPendingUser = null
  showToast(`Bem-vindo, ${currentUser.value.name}!`, "success")
  return { ok: true }
}

export async function checkAuthSession(): Promise<void> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      headers: sessionToken.value ? { Authorization: `Bearer ${sessionToken.value}` } : {},
      credentials: "include",
    })
    const data = await res.json()
    if (data.ok && data.user) {
      currentUser.value = data.user
      isAuthenticated.value = true
      authStep.value = "done"
      fetchAllFromBackend()
    }
  } catch (_e) {}
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
  } catch (_e) {}

  sessionToken.value = ""
  pendingToken.value = ""
  isAuthenticated.value = false
  currentUser.value = null
  authStep.value = "login"
  mfaCode.value = ""
  mfaPendingUser = null
  chatOpen.value = false
  activeTab.value = "home"
  showToast("Sessão encerrada com sucesso.", "info")
}

checkAuthSession()

/* ─── State e Conexão Backend: Conversas & Mensagens ─────────── */
export const conversations = ref<Conversation[]>(
  initialConversations.map((c) => ({ ...c, channel: "interno" as Channel }))
)
export const activeId = ref<string>(initialConversations[0]?.id || "")
export const chatOpen = ref<boolean>(false)
export const activeTab = ref<string>("home")

export const activeConversation = computed(() => {
  if (conversations.value.length === 0) return null
  return conversations.value.find((c) => c.id === activeId.value) ?? conversations.value[0]
})

export const totalUnread = computed(() => {
  return conversations.value.reduce((acc, c) => acc + c.unread, 0)
})

export function selectConversation(id: string) {
  activeId.value = id
  markAsRead(id)
}

export function markAsRead(id: string) {
  const conv = conversations.value.find((c) => c.id === id)
  if (conv) {
    conv.unread = 0
  }
}

export async function sendMessage(conversationId: string, text: string) {
  const conv = conversations.value.find((c) => c.id === conversationId)
  if (!conv) return
  const now = new Date()
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const newMsg: Message = {
    id: "msg-" + Date.now(),
    direction: "out",
    text,
    time: timeStr,
    status: "enviado",
  }
  conv.messages.push(newMsg)
  conv.lastMessage = text
  conv.time = timeStr

  // Salvar mensagem no backend
  try {
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, direction: "out" }),
    })
  } catch (_e) {}
}

export async function createConversation(payload: {
  name: string
  initials: string
  channel?: Channel
  topic: Topic
  role: string
  department: string
  contactEmail: string
  contactPhone: string
  initialMessage: string
}) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const id = "conv-" + Date.now()
  const newConv: Conversation = {
    id,
    name: payload.name,
    initials: payload.initials.toUpperCase(),
    channel: payload.channel || "interno",
    topic: payload.topic,
    role: payload.role,
    department: payload.department,
    lastMessage: payload.initialMessage,
    time: timeStr,
    unread: 0,
    online: true,
    status: "aberto",
    priority: "media",
    pinned: false,
    snoozedUntil: null,
    assignedTo: "Você",
    contact: {
      email: payload.contactEmail,
      phone: payload.contactPhone,
      location: "São Paulo, SP",
      tenure: "Recém-admitido",
      manager: "Gestão RH",
    },
    messages: [
      {
        id: "msg-1",
        direction: "out",
        text: payload.initialMessage,
        time: timeStr,
        status: "enviado",
      },
    ],
  }
  conversations.value.unshift(newConv)
  activeId.value = id
  chatOpen.value = true

  try {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        channel: payload.channel,
        topic: payload.topic,
        role: payload.role,
        department: payload.department,
        initialMessage: payload.initialMessage,
        contact: { email: payload.contactEmail, phone: payload.contactPhone },
      }),
    })
    const data = await res.json()
    if (data.ok && data.id) {
      newConv.id = data.id
      activeId.value = data.id
    }
  } catch (_e) {}

  showToast(`Atendimento iniciado com ${payload.name}`, "success")
}

export async function setStatus(conversationId: string, status: "aberto" | "pendente" | "resolvido") {
  const conv = conversations.value.find((c) => c.id === conversationId)
  if (conv) {
    conv.status = status
  }
  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
  } catch (_e) {}
  showToast(`Status alterado para "${status}"`, "info")
}

export async function setPriority(conversationId: string, priority: Priority) {
  const conv = conversations.value.find((c) => c.id === conversationId)
  if (conv) {
    conv.priority = priority
  }
  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    })
  } catch (_e) {}
  showToast(`Prioridade alterada para "${priority}"`, "info")
}

export async function setTopic(conversationId: string, topic: Topic) {
  const conv = conversations.value.find((c) => c.id === conversationId)
  if (conv) {
    conv.topic = topic
  }
  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    })
  } catch (_e) {}
  showToast(`Tópico alterado para "${topic}"`, "info")
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const index = conversations.value.findIndex((c) => c.id === conversationId)
  if (index === -1) return false

  const name = conversations.value[index].name
  conversations.value.splice(index, 1)

  // Se a conversa excluída era a ativa, mudar para a próxima
  if (activeId.value === conversationId) {
    const nextAvailable = conversations.value.find((c) => c.status !== "resolvido") || conversations.value[0]
    activeId.value = nextAvailable ? nextAvailable.id : ""
  }

  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "DELETE",
    })
  } catch (_e) {}

  showToast(`Conversa com ${name} excluída com sucesso!`, "success")
  return true
}

export async function resolveConversation(conversationId: string): Promise<void> {
  const conv = conversations.value.find((c) => c.id === conversationId)
  if (!conv) return

  conv.status = "resolvido"

  const now = new Date()
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  conv.messages.push({
    id: "msg-" + Date.now(),
    direction: "out",
    text: "Atendimento encerrado e marcado como Resolvido.",
    time: timeStr,
    status: "lido",
  })
  conv.lastMessage = "Atendimento encerrado e marcado como Resolvido."
  conv.time = timeStr

  // Se a conversa resolvida era a selecionada, troca para a próxima em aberto para sumir da tela
  if (activeId.value === conversationId) {
    const nextOpen = conversations.value.find((c) => c.id !== conversationId && c.status !== "resolvido")
    if (nextOpen) {
      activeId.value = nextOpen.id
    }
  }

  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolvido" }),
    })
  } catch (_e) {}

  showToast(`Atendimento com ${conv.name} resolvido com sucesso!`, "success")
}

export async function reopenConversation(conversationId: string): Promise<void> {
  const conv = conversations.value.find((c) => c.id === conversationId)
  if (!conv) return

  conv.status = "aberto"
  activeId.value = conv.id

  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "aberto" }),
    })
  } catch (_e) {}

  showToast(`Conversa com ${conv.name} reaberta!`, "info")
}

/* ─── State e Conexão Backend: Colaboradores ───────────── */
export const employeeFolders = ref<EmployeeFolder[]>([...initialEmployeeFolders])
export const activeFolderId = ref<string | null>(null)

/* ─── Snapshots de Contra-Cheque (Histórico Preservado) ─── */
const CC_STORAGE_KEY = "peoplehub_contracheque_snapshots"
const FOLHA_STORAGE_KEY = "peoplehub_folha_snapshots"

function loadStoredContraCheque(): Record<string, ContraChequeSnapshot> {
  try {
    const raw = localStorage.getItem(CC_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (_e) {
    return {}
  }
}

function saveContraChequeToStorage(): void {
  try {
    localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(contraChequeSnapshots.value))
  } catch (_e) {}
}

function loadStoredFolha(): Record<string, FolhaDePontoSnapshot> {
  try {
    const raw = localStorage.getItem(FOLHA_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (_e) {
    return {}
  }
}

function saveFolhaToStorage(): void {
  try {
    localStorage.setItem(FOLHA_STORAGE_KEY, JSON.stringify(folhaSnapshots.value))
  } catch (_e) {}
}

export const contraChequeSnapshots = ref<Record<string, ContraChequeSnapshot>>(loadStoredContraCheque())

export function getContraChequeSnapshot(employeeId: string, month: string): ContraChequeSnapshot | null {
  const key = `${employeeId}_${month}`
  return contraChequeSnapshots.value[key] || null
}

export function saveContraChequeSnapshot(employee: EmployeeFolder, month: string): ContraChequeSnapshot {
  const salaryStr = employee.salary || "R$ 6.500,00"
  const holerite = calcularHoleriteCompleto(salaryStr, month)
  const now = new Date()
  const dateFormatted = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`

  const snapshot: ContraChequeSnapshot = {
    id: `snap-${employee.id}-${month.replace("/", "_")}-${Date.now()}`,
    employeeId: employee.id,
    month,
    generatedAt: dateFormatted,
    employeeName: employee.name,
    cpf: employee.cpf || "000.000.000-00",
    registration: employee.registration || "102",
    role: employee.role,
    department: employee.department,
    admissionDate: employee.admissionDate || "01/02/2022",
    cbo: employee.cbo || "2124-05",
    cboTitle: employee.cboTitle || "",
    salary: salaryStr,
    holerite,
  }

  const key = `${employee.id}_${month}`
  contraChequeSnapshots.value[key] = snapshot
  saveContraChequeToStorage()
  return snapshot
}

export function updateContraChequeRubricas(
  employeeId: string,
  month: string,
  rubricas: HoleriteItem[]
): ContraChequeSnapshot | null {
  let snap = getContraChequeSnapshot(employeeId, month)
  if (!snap) {
    const emp = employeeFolders.value.find((f) => f.id === employeeId)
    if (!emp) return null
    snap = saveContraChequeSnapshot(emp, month)
  }

  const cleanSal = parseFloat((snap.salary || "6500").replace(/[^\d,-]/g, "").replace(",", "."))
  const salBase = isNaN(cleanSal) || cleanSal <= 0 ? 6500 : cleanSal
  const novoHolerite = recalcularHoleriteComRubricas(salBase, rubricas, month)
  snap.holerite = novoHolerite
  snap.generatedAt = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`

  saveContraChequeToStorage()
  showToast("Rubricas do holerite atualizadas e recalculadas!", "success")
  return snap
}

export async function sendHoleriteToEmployeeChat(employee: EmployeeFolder, month: string) {
  let snap = getContraChequeSnapshot(employee.id, month)
  if (!snap) {
    snap = saveContraChequeSnapshot(employee, month)
  }

  const netSalaryFormatted = snap.holerite.salarioLiquido.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
  const grossSalaryFormatted = snap.holerite.proventosTotais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
  const discountsFormatted = snap.holerite.descontosTotais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

  const firstName = employee.name.trim().split(" ")[0]
  const messageText = `📄 *Recibo de Pagamento de Salário — Competência ${month}*\n\nOlá, ${firstName}! Seu contra-cheque referente ao mês de *${month}* já foi processado e está disponível para consulta.\n\n💰 *Total de Vencimentos:* ${grossSalaryFormatted}\n🔻 *Total de Descontos:* ${discountsFormatted}\n✅ *Valor Líquido Creditado:* ${netSalaryFormatted}\n\nVocê pode emitir o documento oficial assinado diretamente pelo seu portal do colaborador ou solicitar o arquivo em PDF por este canal.`

  const conv = conversations.value.find(
    (c) => c.name.toLowerCase() === employee.name.toLowerCase() ||
           (employee.email && c.contact?.email?.toLowerCase() === employee.email.toLowerCase())
  )

  if (conv) {
    await sendMessage(conv.id, messageText)
    showToast(`Contra-Cheque enviado para o chat de ${employee.name}!`, "success")
  } else {
    await createConversation({
      name: employee.name,
      initials: employee.initials,
      channel: "whatsapp",
      topic: "folha",
      role: employee.role,
      department: employee.department,
      contactEmail: employee.email || "",
      contactPhone: employee.phone || "",
      initialMessage: messageText,
    })
    showToast(`Conversa iniciada e Contra-Cheque enviado para ${employee.name}!`, "success")
  }
}

export function hasCollaboratorDataChanged(employee: EmployeeFolder, snapshot: ContraChequeSnapshot): boolean {
  if (!employee || !snapshot) return false
  const currentSalary = employee.salary || "R$ 6.500,00"
  const snapshotSalary = snapshot.salary || "R$ 6.500,00"

  if (employee.name !== snapshot.employeeName) return true
  if ((employee.cpf || "") !== (snapshot.cpf || "")) return true
  if ((employee.registration || "") !== (snapshot.registration || "")) return true
  if (employee.role !== snapshot.role) return true
  if (employee.department !== snapshot.department) return true
  if ((employee.admissionDate || "") !== (snapshot.admissionDate || "")) return true
  if ((employee.cbo || "") !== (snapshot.cbo || "")) return true
  if (currentSalary !== snapshotSalary) return true

  return false
}

/* ─── Folha de Ponto Eletrônica (Portaria 671 MTE / CLT) ────────── */
export const folhaSnapshots = ref<Record<string, FolhaDePontoSnapshot>>(loadStoredFolha())

function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "—" || timeStr === "--:--" || timeStr.trim() === "") return 0
  const parts = timeStr.trim().split(":")
  if (parts.length !== 2) return 0
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  return isNaN(h) || isNaN(m) ? 0 : h * 60 + m
}

function minutesToTime(totalMin: number): string {
  if (totalMin <= 0) return "00:00"
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function minutesToHoursLabel(totalMin: number): string {
  const sign = totalMin < 0 ? "-" : ""
  const abs = Math.abs(totalMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`
}

export function calculateRecordMetrics(rec: TimeRecord): void {
  if (rec.isWeekend && rec.status === "dsr" && !rec.entry1 && !rec.exit1) {
    rec.workedMinutes = 0
    rec.workedHours = "00:00"
    rec.extraMinutes = 0
    rec.extraHours = "00:00"
    rec.absenceMinutes = 0
    rec.absenceHours = "00:00"
    return
  }

  if (rec.status === "ferias" || rec.status === "atestado" || rec.status === "compensacao") {
    rec.workedMinutes = 480
    rec.workedHours = "08:00"
    rec.extraMinutes = 0
    rec.extraHours = "00:00"
    rec.absenceMinutes = 0
    rec.absenceHours = "00:00"
    return
  }

  if (rec.status === "falta") {
    rec.workedMinutes = 0
    rec.workedHours = "00:00"
    rec.extraMinutes = 0
    rec.extraHours = "00:00"
    rec.absenceMinutes = 480
    rec.absenceHours = "08:00"
    return
  }

  const e1 = timeToMinutes(rec.entry1)
  const s1 = timeToMinutes(rec.exit1)
  const e2 = timeToMinutes(rec.entry2)
  const s2 = timeToMinutes(rec.exit2)

  const period1 = s1 > e1 ? s1 - e1 : 0
  const period2 = s2 > e2 ? s2 - e2 : 0
  const totalWorked = period1 + period2

  rec.workedMinutes = totalWorked
  rec.workedHours = minutesToTime(totalWorked)

  const standardMinutes = 480 // 8h diárias padrão CLT

  if (rec.isWeekend) {
    rec.extraMinutes = totalWorked
    rec.extraHours = minutesToTime(totalWorked)
    rec.absenceMinutes = 0
    rec.absenceHours = "00:00"
  } else {
    if (totalWorked > standardMinutes) {
      rec.extraMinutes = totalWorked - standardMinutes
      rec.extraHours = minutesToTime(rec.extraMinutes)
      rec.absenceMinutes = 0
      rec.absenceHours = "00:00"
    } else if (totalWorked > 0 && totalWorked < standardMinutes) {
      rec.extraMinutes = 0
      rec.extraHours = "00:00"
      rec.absenceMinutes = standardMinutes - totalWorked
      rec.absenceHours = minutesToTime(rec.absenceMinutes)
    } else if (totalWorked === standardMinutes) {
      rec.extraMinutes = 0
      rec.extraHours = "00:00"
      rec.absenceMinutes = 0
      rec.absenceHours = "00:00"
    } else {
      rec.extraMinutes = 0
      rec.extraHours = "00:00"
      rec.absenceMinutes = standardMinutes
      rec.absenceHours = minutesToTime(standardMinutes)
    }
  }
}

export function calculateFolhaTotals(records: TimeRecord[]) {
  let totalWorkedMin = 0
  let totalExtraMin = 0
  let totalAbsenceMin = 0

  records.forEach((r) => {
    totalWorkedMin += r.workedMinutes || 0
    totalExtraMin += r.extraMinutes || 0
    totalAbsenceMin += r.absenceMinutes || 0
  })

  const bankBalanceMinutes = totalExtraMin - totalAbsenceMin
  const prefix = bankBalanceMinutes >= 0 ? "+" : ""

  return {
    totalWorkedHours: minutesToHoursLabel(totalWorkedMin),
    totalExtraHours: minutesToHoursLabel(totalExtraMin),
    totalAbsences: minutesToHoursLabel(totalAbsenceMin),
    bankBalance: `${prefix}${minutesToHoursLabel(bankBalanceMinutes)}`,
    bankBalanceMinutes,
  }
}

export function generateInitialFolha(
  employee: EmployeeFolder,
  month: string,
  fillStandardCLT: boolean = false
): FolhaDePontoSnapshot {
  const parts = month.split("/")
  const m = parseInt(parts[0], 10) || 8
  const y = parseInt(parts[1], 10) || 2026
  const totalDays = new Date(y, m, 0).getDate()
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  const records: TimeRecord[] = []

  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(y, m - 1, d)
    const dayOfWeek = dt.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const weekDay = weekDays[dayOfWeek]

    let entry1 = ""
    let exit1 = ""
    let entry2 = ""
    let exit2 = ""
    const status: TimeRecord["status"] = isWeekend ? "dsr" : "normal"
    const statusLabel = isWeekend ? "DSR" : "Normal"

    if (fillStandardCLT && !isWeekend) {
      const delta1 = (d % 5) - 2
      const delta2 = ((d * 3) % 5) - 2
      const e1m = 8 * 60 + delta1
      const s1m = 12 * 60 + delta2
      const e2m = 13 * 60 + delta2
      const s2m = 17 * 60 + delta1

      entry1 = `${Math.floor(e1m / 60).toString().padStart(2, "0")}:${Math.abs(e1m % 60).toString().padStart(2, "0")}`
      exit1 = `${Math.floor(s1m / 60).toString().padStart(2, "0")}:${Math.abs(s1m % 60).toString().padStart(2, "0")}`
      entry2 = `${Math.floor(e2m / 60).toString().padStart(2, "0")}:${Math.abs(e2m % 60).toString().padStart(2, "0")}`
      exit2 = `${Math.floor(s2m / 60).toString().padStart(2, "0")}:${Math.abs(s2m % 60).toString().padStart(2, "0")}`
    }

    const rec: TimeRecord = {
      day: d,
      weekDay,
      isWeekend,
      isHoliday: false,
      entry1,
      exit1,
      entry2,
      exit2,
      workedMinutes: 0,
      workedHours: "00:00",
      extraMinutes: 0,
      extraHours: "00:00",
      absenceMinutes: 0,
      absenceHours: "00:00",
      status,
      statusLabel,
    }

    calculateRecordMetrics(rec)
    records.push(rec)
  }

  const totals = calculateFolhaTotals(records)
  const now = new Date()

  return {
    id: `folha-${employee.id}-${month.replace("/", "_")}`,
    employeeId: employee.id,
    month,
    generatedAt: `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    employeeName: employee.name,
    registration: employee.registration || "102",
    role: employee.role,
    department: employee.department,
    records,
    ...totals,
  }
}

export function getFolhaDePontoSnapshot(employeeId: string, month: string): FolhaDePontoSnapshot | null {
  const key = `${employeeId}_${month}`
  return folhaSnapshots.value[key] || null
}

export function saveFolhaDePontoSnapshot(snapshot: FolhaDePontoSnapshot): void {
  const key = `${snapshot.employeeId}_${snapshot.month}`
  folhaSnapshots.value[key] = snapshot
  saveFolhaToStorage()
}

export function fillStandardCLTSchedule(employeeId: string, month: string): FolhaDePontoSnapshot | null {
  const employee = employeeFolders.value.find((f) => f.id === employeeId)
  if (!employee) return null
  const folha = generateInitialFolha(employee, month, true)
  saveFolhaDePontoSnapshot(folha)
  showToast("Jornada padrão CLT preenchida com sucesso!", "success")
  return folha
}

export function clearMonthPonto(employeeId: string, month: string): FolhaDePontoSnapshot | null {
  const employee = employeeFolders.value.find((f) => f.id === employeeId)
  if (!employee) return null
  const folha = generateInitialFolha(employee, month, false)
  saveFolhaDePontoSnapshot(folha)
  showToast("Registros do mês limpos com sucesso.", "info")
  return folha
}

export function applyPontoAdjustment(
  employeeId: string,
  month: string,
  day: number,
  updates: Partial<TimeRecord>
): FolhaDePontoSnapshot | null {
  let folha = getFolhaDePontoSnapshot(employeeId, month)
  if (!folha) {
    const emp = employeeFolders.value.find((f) => f.id === employeeId)
    if (!emp) return null
    folha = generateInitialFolha(emp, month, false)
  }

  const rec = folha.records.find((r) => r.day === day)
  if (!rec) return folha

  if (updates.entry1 !== undefined) rec.entry1 = updates.entry1
  if (updates.exit1 !== undefined) rec.exit1 = updates.exit1
  if (updates.entry2 !== undefined) rec.entry2 = updates.entry2
  if (updates.exit2 !== undefined) rec.exit2 = updates.exit2
  if (updates.status !== undefined) rec.status = updates.status
  if (updates.statusLabel !== undefined) rec.statusLabel = updates.statusLabel
  if (updates.observation !== undefined) rec.observation = updates.observation

  calculateRecordMetrics(rec)
  const totals = calculateFolhaTotals(folha.records)
  folha.totalWorkedHours = totals.totalWorkedHours
  folha.totalExtraHours = totals.totalExtraHours
  folha.totalAbsences = totals.totalAbsences
  folha.bankBalance = totals.bankBalance
  folha.bankBalanceMinutes = totals.bankBalanceMinutes
  folha.generatedAt = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`

  saveFolhaDePontoSnapshot(folha)
  showToast(`Marcações do dia ${day.toString().padStart(2, "0")} atualizadas!`, "success")
  return folha
}

export function registerPontoPunch(
  employeeId: string,
  month: string,
  punchType: PontoPunchReceipt["type"],
  customTime?: string
): { receipt: PontoPunchReceipt; folha: FolhaDePontoSnapshot } | null {
  const employee = employeeFolders.value.find((f) => f.id === employeeId)
  if (!employee) return null

  let folha = getFolhaDePontoSnapshot(employeeId, month)
  if (!folha) {
    folha = generateInitialFolha(employee, month, false)
  }

  const now = new Date()
  const todayNum = now.getDate()
  let rec = folha.records.find((r) => r.day === todayNum)
  if (!rec) {
    rec = folha.records[0]
  }

  const timeStr = customTime || now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const fullDateTime = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`

  if (punchType === "Entrada 1") {
    rec.entry1 = timeStr
  } else if (punchType === "Saída Intervalo") {
    rec.exit1 = timeStr
  } else if (punchType === "Retorno Intervalo") {
    rec.entry2 = timeStr
  } else if (punchType === "Saída Fim de Expediente") {
    rec.exit2 = timeStr
  }

  rec.status = "normal"
  rec.statusLabel = "Registrado"
  calculateRecordMetrics(rec)

  const totals = calculateFolhaTotals(folha.records)
  folha.totalWorkedHours = totals.totalWorkedHours
  folha.totalExtraHours = totals.totalExtraHours
  folha.totalAbsences = totals.totalAbsences
  folha.bankBalance = totals.bankBalance
  folha.bankBalanceMinutes = totals.bankBalanceMinutes
  folha.generatedAt = fullDateTime

  saveFolhaDePontoSnapshot(folha)

  const nsr = Math.floor(100000 + Math.random() * 900000).toString()
  const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
  const hash = `SHA256:${randomHex.toUpperCase()}`

  const receipt: PontoPunchReceipt = {
    id: `rcp-${Date.now()}`,
    nsr,
    timestamp: fullDateTime,
    date: now.toLocaleDateString("pt-BR"),
    time: timeStr,
    type: punchType,
    employeeName: employee.name,
    cpf: employee.cpf || "000.000.000-00",
    companyName: "PEOPLEHUB GESTÃO DE PESSOAS S/A",
    cnpj: "12.345.678/0001-90",
    hash,
    location: employee.location || "São Paulo, SP (Sede Central - REP-P Homologado)",
  }

  showToast(`Ponto registrado com sucesso! (${punchType} às ${timeStr})`, "success")
  return { receipt, folha }
}

export const activeEmployeeFolder = computed(() => {
  if (!activeFolderId.value) return null
  return employeeFolders.value.find((f) => f.id === activeFolderId.value) ?? null
})

export async function createEmployeeFolder(payload: {
  name: string
  initials: string
  cpf: string
  registration: string
  role: string
  department: string
  email: string
  phone: string
  location?: string
  tenure?: string
  manager: string
  admissionDate: string
  status?: "ativo" | "ferias" | "afastado" | "desligado"
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
}): Promise<EmployeeFolder> {
  const id = "f-" + Date.now()
  const loc = payload.location || (payload.city && payload.state ? `${payload.city}, ${payload.state}` : "São Paulo, SP")
  const newFolder: EmployeeFolder = {
    id,
    name: payload.name,
    initials: payload.initials.toUpperCase(),
    cpf: payload.cpf,
    registration: payload.registration,
    role: payload.role,
    department: payload.department,
    email: payload.email,
    phone: payload.phone,
    location: loc,
    tenure: payload.tenure || "Recém-admitido",
    manager: payload.manager,
    admissionDate: payload.admissionDate,
    status: payload.status || "ativo",
    documents: [],
    notes: payload.notes || "Pasta criada recentemente.",
    cep: payload.cep,
    street: payload.street,
    number: payload.number,
    complement: payload.complement,
    neighborhood: payload.neighborhood,
    city: payload.city,
    state: payload.state,
    cbo: payload.cbo,
    cboTitle: payload.cboTitle,
    salary: payload.salary || "R$ 6.500,00",
  }
  employeeFolders.value.unshift(newFolder)
  activeFolderId.value = id

  try {
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        role: payload.role,
        department: payload.department,
        email: payload.email,
        phone: payload.phone,
        cpf: payload.cpf,
        hireDate: payload.admissionDate,
        salary: payload.salary || "R$ 6.500,00",
        manager: payload.manager,
        location: payload.location || "São Paulo, SP",
        cbo: payload.cbo,
        cboTitle: payload.cboTitle,
      }),
    })
  } catch (_e) {}

  showToast(`Pasta de RH criada para ${payload.name}`, "success")
  return newFolder
}

export function addDocumentToFolder(
  folderId: string,
  doc: { name: string; category: DocCategory; fileType?: string; size?: string; uploadedBy?: string }
) {
  const folder = employeeFolders.value.find((f) => f.id === folderId)
  if (!folder) return
  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-BR")
  const newDoc: EmployeeDocument = {
    id: "doc-" + Date.now(),
    name: doc.name,
    category: doc.category,
    fileType: doc.fileType || "PDF",
    size: doc.size || "1.5 MB",
    uploadedAt: dateStr,
    uploadedBy: doc.uploadedBy || "Analista de RH",
  }
  folder.documents.unshift(newDoc)
  showToast(`Documento "${doc.name}" anexado com sucesso`, "success")
}

export function deleteDocumentFromFolder(folderId: string, documentId: string) {
  const folder = employeeFolders.value.find((f) => f.id === folderId)
  if (!folder) return
  const doc = folder.documents.find((d) => d.id === documentId)
  const docName = doc ? doc.name : ""
  folder.documents = folder.documents.filter((d) => d.id !== documentId)
  showToast(docName ? `Documento "${docName}" removido da pasta.` : "Documento removido da pasta.", "info")
}

export async function updateEmployeeFolder(
  folderId: string,
  payload: Partial<EmployeeFolder>
): Promise<EmployeeFolder | null> {
  const folder = employeeFolders.value.find((f) => f.id === folderId)
  if (!folder) return null

  if (payload.name) {
    folder.name = payload.name
    const parts = payload.name.trim().split(" ")
    folder.initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase()
  }
  if (payload.cpf !== undefined) folder.cpf = payload.cpf
  if (payload.registration !== undefined) folder.registration = payload.registration
  if (payload.role !== undefined) folder.role = payload.role
  if (payload.department !== undefined) folder.department = payload.department
  if (payload.email !== undefined) folder.email = payload.email
  if (payload.phone !== undefined) folder.phone = payload.phone
  if (payload.location !== undefined) folder.location = payload.location
  if (payload.tenure !== undefined) folder.tenure = payload.tenure
  if (payload.manager !== undefined) folder.manager = payload.manager
  if (payload.admissionDate !== undefined) folder.admissionDate = payload.admissionDate
  if (payload.status !== undefined) folder.status = payload.status
  if (payload.notes !== undefined) folder.notes = payload.notes
  if (payload.cep !== undefined) folder.cep = payload.cep
  if (payload.street !== undefined) folder.street = payload.street
  if (payload.number !== undefined) folder.number = payload.number
  if (payload.complement !== undefined) folder.complement = payload.complement
  if (payload.neighborhood !== undefined) folder.neighborhood = payload.neighborhood
  if (payload.city !== undefined) folder.city = payload.city
  if (payload.state !== undefined) folder.state = payload.state
  if (payload.cbo !== undefined) folder.cbo = payload.cbo
  if (payload.cboTitle !== undefined) folder.cboTitle = payload.cboTitle
  if (payload.salary !== undefined) folder.salary = payload.salary

  try {
    await fetch(`/api/employees/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folder.name,
        role: folder.role,
        department: folder.department,
        email: folder.email,
        phone: folder.phone,
        cpf: folder.cpf,
        salary: folder.salary,
        manager: folder.manager,
        location: folder.location,
        cbo: folder.cbo,
        cboTitle: folder.cboTitle,
      }),
    })
  } catch (_e) {}

  showToast(`Dados de ${folder.name} atualizados com sucesso!`, "success")
  return folder
}

export async function deleteEmployeeFolder(folderId: string) {
  employeeFolders.value = employeeFolders.value.filter((f) => f.id !== folderId)
  if (activeFolderId.value === folderId) {
    activeFolderId.value = null
  }
  try {
    await fetch(`/api/employees/${folderId}`, { method: "DELETE" })
  } catch (_e) {}
  showToast("Pasta de colaborador removida.", "info")
}

/* ─── State e Conexão Backend: Solicitações ───────── */
export const requests = ref<RequestItem[]>([...initialRequests])
export const activeRequestId = ref<string | null>(null)

export const activeRequest = computed(() => {
  if (!activeRequestId.value) return null
  return requests.value.find((r) => r.id === activeRequestId.value) ?? null
})

export async function createRequest(payload: {
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
  priority?: RequestPriority
  attachment?: string
}): Promise<RequestItem> {
  const id = "req-" + Date.now()
  const count = requests.value.length + 1
  const protocol = `REQ-2026-${count.toString().padStart(3, "0")}`
  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-BR")

  const newReq: RequestItem = {
    id,
    protocol,
    employeeName: payload.employeeName,
    employeeInitials: payload.employeeInitials.toUpperCase(),
    employeeRole: payload.employeeRole,
    department: payload.department,
    type: payload.type,
    title: payload.title,
    description: payload.description,
    startDate: payload.startDate,
    endDate: payload.endDate,
    amount: payload.amount,
    attachment: payload.attachment || "Documento_Anexo.pdf",
    status: "pendente",
    priority: payload.priority || "media",
    createdAt: dateStr,
  }

  requests.value.unshift(newReq)

  try {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: payload.type,
        requester: payload.employeeName,
        department: payload.department,
        priority: payload.priority || "Média",
        description: payload.description,
        details: { title: payload.title, startDate: payload.startDate, endDate: payload.endDate },
      }),
    })
    const data = await res.json()
    if (data.ok && data.id) {
      newReq.id = data.id
      newReq.protocol = data.id
    }
  } catch (_e) {}

  showToast(`Solicitação ${protocol} aberta com sucesso!`, "success")
  return newReq
}

export async function updateRequestStatus(
  requestId: string,
  newStatus: RequestStatus,
  reviewerName: string = "Analista de RH",
  note?: string
) {
  const req = requests.value.find((r) => r.id === requestId)
  if (req) {
    req.status = newStatus
    req.reviewedBy = reviewerName
    if (note) {
      req.reviewNote = note
    }

    // Se a solicitação for aprovada, realizar ações automáticas
    if (newStatus === "aprovado") {
      // 1. Se for solicitação de Ponto aprovada, sincronizar com a Folha de Ponto
      if (req.type === "ponto") {
        const emp = employeeFolders.value.find((f) => f.name.toLowerCase() === req.employeeName.toLowerCase())
        if (emp) {
          let day = 15
          if (req.startDate) {
            const dPart = parseInt(req.startDate.split("/")[0], 10)
            if (!isNaN(dPart) && dPart >= 1 && dPart <= 31) day = dPart
          }
          applyPontoAdjustment(emp.id, "08/2026", day, {
            status: "normal",
            statusLabel: "Aprovado RH",
            entry1: "08:00",
            exit1: "12:00",
            entry2: "13:00",
            exit2: "17:00",
            observation: `Ajuste aprovado conforme chamado ${req.protocol}`,
          })
        }
      }

      // 2. Se for solicitação de documento / declaração / contracheque / férias / atestado
      const docTypes = ["documento", "contracheque", "declaracao", "ferias", "atestado"]
      if (docTypes.includes(req.type)) {
        const count = systemDocuments.value.length + 101
        const code = `DOC-2026-${count.toString().padStart(3, "0")}`
        const dateStr = new Date().toLocaleDateString("pt-BR")

        let category: DocumentCategory = "declaracoes"
        if (req.type === "ferias") category = "ferias"
        else if (req.type === "contracheque") category = "declaracoes"
        else if (req.type === "atestado") category = "declaracoes"

        const docTitle = req.title || `Documento — ${req.employeeName}`

        const alreadyExists = systemDocuments.value.some(
          (d) => d.title.toLowerCase() === docTitle.toLowerCase() && d.employeeName.toLowerCase() === req.employeeName.toLowerCase()
        )

        if (!alreadyExists) {
          const newDoc: SystemDocument = {
            id: `doc-approved-${req.id}-${Date.now()}`,
            code,
            title: docTitle,
            category,
            employeeName: req.employeeName,
            employeeInitials: req.employeeInitials || "GS",
            employeeRole: req.employeeRole || "Colaborador",
            department: req.department || "Operações",
            fileType: "PDF",
            fileSize: "1.4 MB",
            generatedAt: dateStr,
            generatedBy: reviewerName || "RH Analyst",
            signStatus: "assinado",
            contentSnippet: req.description || `Documento oficial emitido e aprovado pelo RH/DP conforme solicitação ${req.protocol}.`,
          }

          systemDocuments.value.unshift(newDoc)

          // Adiciona também na pasta do colaborador
          const empFolder = employeeFolders.value.find((f) => f.name.toLowerCase() === req.employeeName.toLowerCase())
          if (empFolder) {
            addDocumentToFolder(empFolder.id, {
              name: `${docTitle}.pdf`,
              category: (category as any) || "declaracoes",
              fileType: "PDF",
              size: "1.4 MB",
              uploadedBy: reviewerName || "RH Analyst",
            })
          }

          // Persiste no backend se disponível
          try {
            fetch("/api/documents/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                templateName: docTitle,
                category,
                employeeName: req.employeeName,
              }),
            }).catch(() => {})
          } catch (_e) {}
        }
      }
    }
  }

  try {
    await fetch(`/api/requests/${requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
  } catch (_e) {}

  showToast(`Chamado ${requestId} atualizado para "${newStatus}"`, "info")
}

export async function deleteRequest(requestId: string) {
  requests.value = requests.value.filter((r) => r.id !== requestId)
  if (activeRequestId.value === requestId) {
    activeRequestId.value = null
  }
  try {
    await fetch(`/api/requests/${requestId}`, { method: "DELETE" })
  } catch (_e) {}
  showToast("Solicitação excluída.", "info")
}

/* ─── State e Conexão Backend: Documentos ───────── */
export const documentTemplates = ref<DocumentTemplate[]>([...initialDocumentTemplates])
export const systemDocuments = ref<SystemDocument[]>([...initialSystemDocuments])

export function createDocumentTemplate(payload: {
  title: string
  category: DocumentCategory
  description: string
  fields?: string[]
  templateText: string
}): DocumentTemplate {
  const count = documentTemplates.value.length + 1
  const id = `tpl-${count}`
  let fields = payload.fields && payload.fields.length > 0 ? payload.fields : []
  if (fields.length === 0) {
    const matches = payload.templateText.match(/\{\{\s*(\w+)\s*\}\}/g) || payload.templateText.match(/\{(\w+)\}/g)
    if (matches) {
      const extracted = matches.map((m) => m.replace(/[\{\}\s]/g, ""))
      fields = Array.from(new Set(extracted))
    }
  }
  if (fields.length === 0) {
    fields = ["nome", "cpf", "cargo", "departamento"]
  }

  const newTpl: DocumentTemplate = {
    id,
    title: payload.title,
    category: payload.category,
    description: payload.description,
    iconName: "FileText",
    fields,
    templateText: payload.templateText,
  }

  documentTemplates.value.unshift(newTpl)
  showToast(`Novo modelo de RH "${payload.title}" criado com sucesso!`, "success")
  return newTpl
}

export function updateDocumentTemplate(
  id: string,
  payload: Partial<DocumentTemplate>
): DocumentTemplate | null {
  const tpl = documentTemplates.value.find((t) => t.id === id)
  if (!tpl) return null

  if (payload.title !== undefined) tpl.title = payload.title
  if (payload.category !== undefined) tpl.category = payload.category
  if (payload.description !== undefined) tpl.description = payload.description
  if (payload.templateText !== undefined) {
    tpl.templateText = payload.templateText
    const matches = payload.templateText.match(/\{\{\s*(\w+)\s*\}\}/g) || payload.templateText.match(/\{(\w+)\}/g)
    if (matches) {
      const extracted = matches.map((m) => m.replace(/[\{\}\s]/g, ""))
      tpl.fields = Array.from(new Set(extracted))
    }
  }
  if (payload.fields !== undefined) tpl.fields = payload.fields

  showToast(`Modelo "${tpl.title}" atualizado com sucesso!`, "success")
  return tpl
}

export function deleteDocumentTemplate(id: string) {
  const tpl = documentTemplates.value.find((t) => t.id === id)
  const title = tpl ? tpl.title : ""
  documentTemplates.value = documentTemplates.value.filter((t) => t.id !== id)
  showToast(title ? `Modelo "${title}" excluído.` : "Modelo excluído.", "info")
}

export async function generateDocument(payload: {
  templateId: string
  employeeName: string
  employeeInitials: string
  employeeRole: string
  department: string
  customTitle?: string
  signStatus?: DocumentSignStatus
  contentSnippet: string
}): Promise<SystemDocument> {
  const count = systemDocuments.value.length + 90
  const code = `DOC-2026-${count.toString().padStart(3, "0")}`
  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-BR")

  const tpl = documentTemplates.value.find((t) => t.id === payload.templateId)
  const category: DocumentCategory = tpl?.category || "declaracoes"
  const title = payload.customTitle || `${tpl?.title || "Documento RH"} — ${payload.employeeName}`

  const newDoc: SystemDocument = {
    id: "doc-sys-" + Date.now(),
    code,
    title,
    category,
    employeeName: payload.employeeName,
    employeeInitials: payload.employeeInitials.toUpperCase(),
    employeeRole: payload.employeeRole,
    department: payload.department,
    fileType: "PDF",
    fileSize: "1.4 MB",
    generatedAt: dateStr,
    generatedBy: currentUser.value?.name || "Victor Silva",
    signStatus: payload.signStatus || "assinado",
    contentSnippet: payload.contentSnippet,
  }

  systemDocuments.value.unshift(newDoc)

  try {
    const res = await fetch("/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: tpl?.title || "Documento RH",
        category,
        employeeName: payload.employeeName,
      }),
    })
    const data = await res.json()
    if (data.ok && data.document) {
      newDoc.id = data.document.id
      newDoc.code = data.document.id
    }
  } catch (_e) {}

  showToast(`Documento "${title}" emitido com sucesso!`, "success")
  return newDoc
}

export async function importPdfDocument(payload: {
  title: string
  category: DocumentCategory
  employeeId?: string
  fileName?: string
  fileSize?: string
  contentSnippet?: string
}): Promise<SystemDocument> {
  const count = systemDocuments.value.length + 90
  const code = `DOC-2026-${count.toString().padStart(3, "0")}`
  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-BR")

  let empName = "Geral / Empresa"
  let empInitials = "RH"
  let empRole = "Todos os Colaboradores"
  let empDept = "Geral"

  if (payload.employeeId) {
    const emp = employeeFolders.value.find((f) => f.id === payload.employeeId)
    if (emp) {
      empName = emp.name
      empInitials = emp.initials
      empRole = emp.role
      empDept = emp.department

      // Anexa também à pasta do colaborador
      addDocumentToFolder(emp.id, {
        name: payload.title || payload.fileName || "Documento Importado.pdf",
        category: (payload.category as any) || "contratos",
        fileType: "PDF",
        size: payload.fileSize || "1.8 MB",
        uploadedBy: currentUser.value?.name || "RH Analyst",
      })
    }
  }

  const newDoc: SystemDocument = {
    id: "doc-imp-" + Date.now(),
    code,
    title: payload.title || payload.fileName || "Documento PDF Importado",
    category: payload.category || "contratos",
    employeeName: empName,
    employeeInitials: empInitials,
    employeeRole: empRole,
    department: empDept,
    fileType: "PDF",
    fileSize: payload.fileSize || "1.8 MB",
    generatedAt: dateStr,
    generatedBy: currentUser.value?.name || "RH Analyst",
    signStatus: "assinado",
    contentSnippet: payload.contentSnippet || `Arquivo PDF importado: ${payload.fileName || payload.title}`,
  }

  systemDocuments.value.unshift(newDoc)
  showToast(`Documento PDF "${newDoc.title}" importado com sucesso!`, "success")
  return newDoc
}

export async function deleteSystemDocument(id: string) {
  systemDocuments.value = systemDocuments.value.filter((d) => d.id !== id)
  try {
    await fetch(`/api/documents/${id}`, { method: "DELETE" })
  } catch (_e) {}
  showToast("Documento excluído.", "info")
}

/* ─── State e Conexão Backend: Onboarding ─────────── */
export const onboardingItems = ref<OnboardingItem[]>([...initialOnboardingItems])
export const onboardingTracks = ref<OnboardingTrack[]>([...initialOnboardingTracks])

export async function toggleOnboardingStep(itemId: string, stepId: string) {
  const item = onboardingItems.value.find((i) => i.id === itemId)
  if (!item) return
  const step = item.checklist.find((s) => s.id === stepId)
  if (step) {
    step.completed = !step.completed

    try {
      await fetch(`/api/onboarding/${itemId}/step`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, done: step.completed }),
      })
    } catch (_e) {}
  }

  const completedCount = item.checklist.filter((s) => s.completed).length
  const total = item.checklist.length
  if (completedCount === total && total > 0) {
    item.status = "concluido"
    showToast(`Onboarding de ${item.employeeName} concluído! 🚀`, "success")
  } else if (item.status === "concluido") {
    item.status = "em_andamento"
  }
}

export async function createOnboardingItem(payload: {
  employeeName: string
  employeeInitials: string
  role: string
  department: string
  startDate: string
  buddy: string
  trackTitle: string
  notes?: string
  customChecklist?: OnboardingStep[]
}): Promise<OnboardingItem> {
  const defaultChecklist: OnboardingStep[] = [
    { id: "s1", title: "Assinatura do Contrato Admissional & NDA", category: "documentacao", completed: false },
    { id: "s2", title: "Configuração do Notebook & Acessos da Empresa", category: "ti", completed: false },
    { id: "s3", title: "Treinamento Institucional de Boas-Vindas", category: "treinamento", completed: false },
    { id: "s4", title: "Apresentação à equipe & Reunião com Gestor", category: "rh", completed: false },
  ]

  const newItem: OnboardingItem = {
    id: "onb-" + Date.now(),
    employeeName: payload.employeeName,
    employeeInitials: payload.employeeInitials.toUpperCase(),
    role: payload.role,
    department: payload.department,
    startDate: payload.startDate,
    buddy: payload.buddy,
    trackTitle: payload.trackTitle,
    status: "em_andamento",
    checklist: payload.customChecklist || defaultChecklist,
    notes: payload.notes || "Processo de onboarding iniciado.",
  }

  onboardingItems.value.unshift(newItem)

  try {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateName: payload.employeeName,
        role: payload.role,
        department: payload.department,
        startDate: payload.startDate,
        mentor: payload.buddy,
      }),
    })
    const data = await res.json()
    if (data.ok && data.id) {
      newItem.id = data.id
    }
  } catch (_e) {}

  showToast(`Integração iniciada para ${payload.employeeName}`, "success")
  return newItem
}

export function createOnboardingTrack(payload: {
  title: string
  department: string
  durationDays: number
  description: string
  modulesList: string[]
  recommendedFor: string
}): OnboardingTrack {
  const newTrack: OnboardingTrack = {
    id: "trk-" + Date.now(),
    title: payload.title,
    department: payload.department,
    durationDays: payload.durationDays,
    totalModules: payload.modulesList.length,
    description: payload.description,
    modulesList: payload.modulesList,
    recommendedFor: payload.recommendedFor,
  }

  onboardingTracks.value.unshift(newTrack)
  showToast(`Trilha "${payload.title}" criada!`, "success")
  return newTrack
}

export function updateOnboardingTrack(trackId: string, updates: Partial<OnboardingTrack>) {
  const track = onboardingTracks.value.find((t) => t.id === trackId)
  if (!track) return
  if (updates.title !== undefined) track.title = updates.title
  if (updates.department !== undefined) track.department = updates.department
  if (updates.durationDays !== undefined) track.durationDays = updates.durationDays
  if (updates.description !== undefined) track.description = updates.description
  if (updates.modulesList !== undefined) {
    track.modulesList = updates.modulesList
    track.totalModules = updates.modulesList.length
  }
  if (updates.recommendedFor !== undefined) track.recommendedFor = updates.recommendedFor

  showToast(`Trilha "${track.title}" atualizada com sucesso!`, "success")
}

export function deleteOnboardingTrack(trackId: string) {
  const index = onboardingTracks.value.findIndex((t) => t.id === trackId)
  if (index === -1) return
  const title = onboardingTracks.value[index].title
  onboardingTracks.value.splice(index, 1)
  showToast(`Trilha "${title}" excluída.`, "info")
}

export function enrollEmployeeInTrack(employeeName: string, trackTitle: string) {
  let item = onboardingItems.value.find((i) => i.employeeName.toLowerCase() === employeeName.toLowerCase())
  const track = onboardingTracks.value.find((t) => t.title === trackTitle)
  const defaultChecklist: OnboardingStep[] = (track?.modulesList || ["Treinamento Inicial", "Validação"]).map((m, idx) => ({
    id: `mod-${Date.now()}-${idx}`,
    title: m,
    category: "treinamento",
    completed: false,
  }))

  if (item) {
    item.trackTitle = trackTitle
    item.checklist = [...item.checklist, ...defaultChecklist.filter((nc) => !item!.checklist.some((oc) => oc.title === nc.title))]
    showToast(`${employeeName} inscrito na trilha "${trackTitle}"!`, "success")
  } else {
    const emp = employeeFolders.value.find((f) => f.name.toLowerCase() === employeeName.toLowerCase())
    const newItem: OnboardingItem = {
      id: "onb-" + Date.now(),
      employeeName,
      employeeInitials: emp?.initials || employeeName.slice(0, 2).toUpperCase(),
      role: emp?.role || "Colaborador",
      department: emp?.department || track?.department || "Geral",
      startDate: new Date().toLocaleDateString("pt-BR"),
      buddy: "Gestor RH",
      trackTitle,
      status: "em_andamento",
      checklist: defaultChecklist,
      notes: `Inscrito na trilha de treinamento: ${trackTitle}`,
    }
    onboardingItems.value.unshift(newItem)
    showToast(`${employeeName} matriculado na trilha "${trackTitle}" com sucesso!`, "success")
  }
}

export async function deleteOnboardingItem(id: string) {
  onboardingItems.value = onboardingItems.value.filter((i) => i.id !== id)
  try {
    await fetch(`/api/onboarding/${id}`, { method: "DELETE" })
  } catch (_e) {}
  showToast("Onboarding removido.", "info")
}

/* ─── Fetch global do Backend ───────────────────────────── */
export async function fetchAllFromBackend(retries = 3) {
  try {
    const resHealth = await fetch("/api/health")
    if (!resHealth.ok && retries > 0) {
      setTimeout(() => fetchAllFromBackend(retries - 1), 1200)
      return
    }
  } catch (_e) {
    if (retries > 0) {
      setTimeout(() => fetchAllFromBackend(retries - 1), 1200)
      return
    }
  }

  // 1. Conversas
  try {
    const resConv = await fetch("/api/conversations")
    const dataConv = await resConv.json()
    if (dataConv.ok && Array.isArray(dataConv.conversations) && dataConv.conversations.length > 0) {
      conversations.value = dataConv.conversations
      if (!conversations.value.some((c) => c.id === activeId.value)) {
        activeId.value = conversations.value[0].id
      }
    }
  } catch (_e) {}

  // 2. Colaboradores
  try {
    const resEmp = await fetch("/api/employees")
    const dataEmp = await resEmp.json()
    if (dataEmp.ok && Array.isArray(dataEmp.employees) && dataEmp.employees.length > 0) {
      dataEmp.employees.forEach((emp: any, idx: number) => {
        if (!employeeFolders.value.some((f) => f.id === emp.id || f.email === emp.email)) {
          employeeFolders.value.unshift({
            id: emp.id,
            name: emp.name,
            initials: emp.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
            cpf: emp.cpf || "000.000.000-00",
            registration: emp.registration || String(101 + idx),
            role: emp.role,
            department: emp.department,
            email: emp.email,
            phone: emp.phone || "+55 11 90000-0000",
            location: emp.location || "São Paulo, SP",
            tenure: "1 ano",
            manager: emp.manager || "RH Gestão",
            admissionDate: emp.hireDate || "01/01/2024",
            salary: emp.salary || "R$ 6.500,00",
            status: (emp.status?.toLowerCase() === "ativo" ? "ativo" : emp.status?.toLowerCase()) || "ativo",
            documents: [],
            notes: "Importado do banco de dados.",
          })
        }
      })
    }
  } catch (_e) {}

  // 3. Solicitações / Chamados
  try {
    const resReq = await fetch("/api/requests")
    const dataReq = await resReq.json()
    if (dataReq.ok && Array.isArray(dataReq.requests) && dataReq.requests.length > 0) {
      dataReq.requests.forEach((r: any) => {
        if (!requests.value.some((item) => item.id === r.id)) {
          const mapStatus: Record<string, RequestStatus> = {
            "pendente": "pendente",
            "em análise": "em_analise",
            "em analise": "em_analise",
            "aprovado": "aprovado",
            "recusado": "recusado",
          }
          const mapPriority: Record<string, RequestPriority> = {
            "baixa": "baixa",
            "média": "media",
            "media": "media",
            "alta": "alta",
            "urgente": "urgente",
          }
          const statusLower = (r.status || "").toLowerCase()
          const priorityLower = (r.priority || "").toLowerCase()

          requests.value.unshift({
            id: r.id,
            protocol: r.id,
            employeeName: r.requester,
            employeeInitials: (r.requester || "RH").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
            employeeRole: "Colaborador",
            department: r.department || "Geral",
            type: (r.type?.toLowerCase().includes("contra") || r.type?.toLowerCase().includes("holerite")) ? "contracheque" :
                  (r.type?.toLowerCase().includes("férias") || r.type?.toLowerCase().includes("ferias")) ? "ferias" :
                  r.type?.toLowerCase().includes("atestado") ? "atestado" :
                  r.type?.toLowerCase().includes("reembolso") ? "reembolso" :
                  r.type?.toLowerCase().includes("ponto") ? "ponto" : "documento",
            title: r.details?.title || r.description || "Solicitação RH",
            description: r.description,
            startDate: r.details?.period || r.date,
            endDate: r.details?.endDate,
            amount: r.details?.expectedDifference,
            status: mapStatus[statusLower] || "pendente",
            priority: mapPriority[priorityLower] || "media",
            createdAt: r.date,
          })
        }
      })
    }
  } catch (_e) {}

  // 4. Documentos
  try {
    const resDoc = await fetch("/api/documents")
    const dataDoc = await resDoc.json()
    if (dataDoc.ok && Array.isArray(dataDoc.documents) && dataDoc.documents.length > 0) {
      dataDoc.documents.forEach((d: any) => {
        if (!systemDocuments.value.some((doc) => doc.id === d.id)) {
          systemDocuments.value.unshift({
            id: d.id,
            code: d.id,
            title: d.name,
            category: (d.category?.toLowerCase().includes("declara") ? "declaracoes" :
                       d.category?.toLowerCase().includes("contrat") ? "contratos" :
                       d.category?.toLowerCase().includes("férias") || d.category?.toLowerCase().includes("ferias") ? "ferias" : "declaracoes") as DocumentCategory,
            employeeName: d.employeeName,
            employeeInitials: (d.employeeName || "RH").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
            employeeRole: "Colaborador",
            department: "Recursos Humanos",
            fileType: d.type || "PDF",
            fileSize: "1.2 MB",
            generatedAt: d.date,
            generatedBy: "Sistema RH",
            signStatus: d.status === "Emitido" ? "assinado" : "pendente_assinatura",
            contentSnippet: `Documento ${d.name} emitido em ${d.date} para ${d.employeeName}.`,
          })
        }
      })
    }
  } catch (_e) {}

  // 5. Onboarding
  try {
    const resOnb = await fetch("/api/onboarding")
    const dataOnb = await resOnb.json()
    if (dataOnb.ok && Array.isArray(dataOnb.onboardingItems) && dataOnb.onboardingItems.length > 0) {
      dataOnb.onboardingItems.forEach((o: any) => {
        if (!onboardingItems.value.some((item) => item.id === o.id)) {
          const checklist = Array.isArray(o.steps)
            ? o.steps.map((s: any) => ({
                id: `s-${s.id}`,
                title: s.title,
                category: "rh" as const,
                completed: Boolean(s.done),
              }))
            : []

          onboardingItems.value.unshift({
            id: o.id,
            employeeName: o.candidateName,
            employeeInitials: (o.candidateName || "RH").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
            role: o.role,
            department: o.department,
            startDate: o.startDate,
            buddy: o.mentor,
            trackTitle: `Integração ${o.department}`,
            status: o.status === "Concluído" ? "concluido" : "em_andamento",
            checklist: checklist.length > 0 ? checklist : [
              { id: "s1", title: "Envio de Documentos Pessoais", category: "documentacao", completed: true },
              { id: "s2", title: "Assinatura do Contrato de Trabalho", category: "documentacao", completed: true },
            ],
            notes: "Importado do backend.",
          })
        }
      })
    }
  } catch (_e) {}
}

// Iniciar busca automática do backend ao carregar
fetchAllFromBackend()
