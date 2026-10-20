<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  X,
  Settings,
  MessagesSquare,
  Building2,
  Bell,
  Save,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Database,
  Download,
  CheckCircle2,
  Smartphone,
  QrCode,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-vue-next"
import {
  showToast,
  conversations,
  employeeFolders,
  onboardingItems,
  onboardingTracks,
  get2faStatus,
  setup2fa,
  enable2fa,
  disable2fa,
} from "../store"

const emit = defineEmits<{
  (e: "close"): void
}>()

type SettingsTab = "chat" | "company" | "sla" | "security"
const activeTab = ref<SettingsTab>("chat")
const saving = ref(false)

/* ─── Configurações do Chat Interno ─── */
const chatSettings = ref({
  operatingHoursStart: "08:00",
  operatingHoursEnd: "18:00",
  operatingDays: "Segunda a Sexta",
  awayMessageEnabled: true,
  awayMessage:
    "Olá! Nosso horário de atendimento no Chat Interno de RH é de segunda a sexta, das 08h às 18h. Sua solicitação foi registrada no sistema interno e retornaremos assim que o expediente for iniciado.",
  welcomeMessageEnabled: true,
  welcomeMessage:
    "Olá! Você está no canal direto e confidencial do RH. Como podemos apoiar suas dúvidas ou solicitações hoje?",
  autoResolveInactive: true,
  autoResolveDays: 3,
  allowReopen: true,
  defaultAssignment: "round-robin",
})

/* ─── Dados da Empresa ─── */
const company = ref({
  name: "PeopleHub Gestão de Pessoas S/A",
  cnpj: "12.345.678/0001-90",
  contactEmail: "rh@peoplehub.com.br",
  extension: "Ramal 4001",
  timezone: "America/Sao_Paulo",
  language: "pt-BR",
  address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
})

/* ─── Notificações & SLA ─── */
const notifications = ref({
  soundNewMessage: true,
  soundUrgent: true,
  browserPush: true,
  firstResponseSlaMinutes: 15,
  vacationSlaHours: 24,
  generalSlaHours: 4,
})

/* ─── Segurança & LGPD ─── */
const security = ref({
  retentionDays: 365,
  lgpdAnonymization: true,
  auditLogsEnabled: true,
  sessionTimeoutMinutes: 60,
})

function loadSettings() {
  try {
    const saved = localStorage.getItem("peoplehub_platform_settings")
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.chatSettings) chatSettings.value = { ...chatSettings.value, ...parsed.chatSettings }
      if (parsed.company) company.value = { ...company.value, ...parsed.company }
      if (parsed.notifications) notifications.value = { ...notifications.value, ...parsed.notifications }
      if (parsed.security) security.value = { ...security.value, ...parsed.security }
    }
  } catch (_e) {}
}

function handleSave() {
  saving.value = true
  try {
    const dataToSave = {
      chatSettings: chatSettings.value,
      company: company.value,
      notifications: notifications.value,
      security: security.value,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem("peoplehub_platform_settings", JSON.stringify(dataToSave))
    showToast("Configurações atualizadas com sucesso!", "success")
    setTimeout(() => {
      emit("close")
    }, 400)
  } catch (_err) {
    showToast("Erro ao persistir configurações.")
  } finally {
    saving.value = false
  }
}

/* Exportação de Backup Completo */
function exportBackupJson() {
  try {
    const backup = {
      exportDate: new Date().toISOString(),
      system: "PeopleHub RH Corporativo",
      company: company.value,
      chatSettings: chatSettings.value,
      notifications: notifications.value,
      security: security.value,
      conversationsCount: conversations.value.length,
      conversations: conversations.value,
      employeesCount: employeeFolders.value.length,
      employees: employeeFolders.value,
      onboardingCount: onboardingItems.value.length,
      onboardingItems: onboardingItems.value,
      trainingTracksCount: onboardingTracks.value.length,
      onboardingTracks: onboardingTracks.value,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `PeopleHub_Backup_Corporativo_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast("Backup completo exportado com sucesso!", "success")
  } catch (_err) {
    showToast("Erro ao exportar backup.")
  }
}

/* ─── 2FA TOTP (Google Authenticator) ─── */
const twoFactorActive = ref(false)
const twoFactorLoading = ref(false)
const showSetupModal = ref(false)
const qrCodeData = ref("")
const secretKey = ref("")
const verificationCode = ref("")
const verifying2fa = ref(false)
const copiedSecret = ref(false)
const setupError = ref<string | null>(null)

async function load2faStatus() {
  twoFactorLoading.value = true
  const res = await get2faStatus()
  twoFactorActive.value = res.enabled
  twoFactorLoading.value = false
}

async function start2faSetup() {
  setupError.value = null
  verificationCode.value = ""
  twoFactorLoading.value = true
  const res = await setup2fa()
  twoFactorLoading.value = false
  if (res.ok && res.secret && res.qrCode) {
    secretKey.value = res.secret
    qrCodeData.value = res.qrCode
    showSetupModal.value = true
  } else {
    showToast(res.error || "Não foi possível iniciar a configuração de 2FA", "error")
  }
}

function copySecret() {
  if (!secretKey.value) return
  navigator.clipboard.writeText(secretKey.value)
  copiedSecret.value = true
  setTimeout(() => {
    copiedSecret.value = false
  }, 2000)
}

async function confirm2fa() {
  const clean = verificationCode.value.trim().replace(/\D/g, "")
  if (clean.length !== 6) {
    setupError.value = "Digite o código completo de 6 dígitos gerado pelo aplicativo."
    return
  }
  setupError.value = null
  verifying2fa.value = true
  const res = await enable2fa(clean)
  verifying2fa.value = false
  if (res.ok) {
    twoFactorActive.value = true
    showSetupModal.value = false
    verificationCode.value = ""
  } else {
    setupError.value = res.error || "Código incorreto. Verifique no app autenticador e tente novamente."
  }
}

async function handleDisable2fa() {
  if (!confirm("Tem certeza que deseja desativar a autenticação em duas etapas para sua conta?")) {
    return
  }
  twoFactorLoading.value = true
  const res = await disable2fa()
  twoFactorLoading.value = false
  if (res.ok) {
    twoFactorActive.value = false
    showSetupModal.value = false
  }
}

onMounted(() => {
  loadSettings()
  load2faStatus()
})
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="relative flex h-[90vh] max-h-[750px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl border border-border">
      
      <!-- Cabeçalho -->
      <header class="flex items-center justify-between border-b px-6 py-4" style="background-color: var(--color-primary)">
        <div class="flex items-center gap-3 text-primary-foreground">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Settings :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-bold">Configurações do Sistema PeopleHub RH</h2>
            <p class="text-xs text-primary-foreground/75">Parâmetros do chat corporativo, regras de atendimento, SLAs e dados da organização</p>
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

      <!-- Navegação de Abas -->
      <div class="flex border-b bg-muted/40 px-6 gap-2 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0"
          :class="activeTab === 'chat' ? 'border-primary text-primary bg-background' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'chat'"
        >
          <MessagesSquare :size="16" /> Chat Interno & Atendimento
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0"
          :class="activeTab === 'company' ? 'border-primary text-primary bg-background' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'company'"
        >
          <Building2 :size="16" /> Empresa & Organização
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0"
          :class="activeTab === 'sla' ? 'border-primary text-primary bg-background' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'sla'"
        >
          <Bell :size="16" /> SLA & Notificações
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0"
          :class="activeTab === 'security' ? 'border-primary text-primary bg-background' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'security'"
        >
          <ShieldCheck :size="16" /> Segurança & Backup
        </button>
      </div>

      <!-- Conteúdo das Abas -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        
        <!-- ─── TAB 1: CHAT INTERNO & POLÍTICAS ─── -->
        <div v-if="activeTab === 'chat'" class="space-y-5">
          <!-- Status do Chat -->
          <div class="flex items-center justify-between rounded-xl border bg-emerald-500/5 p-4 border-emerald-500/20">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                <MessagesSquare :size="20" />
              </div>
              <div>
                <h4 class="font-bold text-sm text-foreground">Chat Interno Corporativo</h4>
                <p class="text-xs text-muted-foreground">Comunicação 100% restrita a colaboradores e equipes internas da empresa</p>
              </div>
            </div>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ativo & Operacional
            </span>
          </div>

          <!-- Horário de Atendimento -->
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div class="flex items-center gap-2 border-b pb-2">
              <Clock :size="16" class="text-primary" />
              <h3 class="font-bold text-sm text-foreground">Horário do Expediente de RH</h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Início do Atendimento</label>
                <input
                  v-model="chatSettings.operatingHoursStart"
                  type="time"
                  class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Fim do Atendimento</label>
                <input
                  v-model="chatSettings.operatingHoursEnd"
                  type="time"
                  class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Dias de Funcionamento</label>
                <select
                  v-model="chatSettings.operatingDays"
                  class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Segunda a Sexta">Segunda a Sexta-feira</option>
                  <option value="Segunda a Sábado">Segunda a Sábado</option>
                  <option value="Todos os Dias">Todos os Dias (24/7)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Mensagens Automáticas -->
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <h3 class="font-bold text-sm text-foreground border-b pb-2">Mensagens Automáticas do Sistema</h3>

            <!-- Mensagem de Ausência -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  <input v-model="chatSettings.awayMessageEnabled" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                  <span>Mensagem Automática Fora do Expediente</span>
                </label>
                <span class="text-[11px] text-muted-foreground">Enviada se o colaborador abrir chamado após as 18h</span>
              </div>
              <textarea
                v-model="chatSettings.awayMessage"
                :disabled="!chatSettings.awayMessageEnabled"
                rows="2"
                class="w-full rounded-xl border bg-background p-3 text-xs outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <!-- Mensagem de Boas-Vindas -->
            <div class="space-y-2 pt-2 border-t">
              <div class="flex items-center justify-between">
                <label class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  <input v-model="chatSettings.welcomeMessageEnabled" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                  <span>Saudação de Boas-Vindas Institucional</span>
                </label>
                <span class="text-[11px] text-muted-foreground">Exibida no início de cada novo chat interno</span>
              </div>
              <textarea
                v-model="chatSettings.welcomeMessage"
                :disabled="!chatSettings.welcomeMessageEnabled"
                rows="2"
                class="w-full rounded-xl border bg-background p-3 text-xs outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

          <!-- Políticas de Resolução -->
          <div class="rounded-xl border bg-card p-5 space-y-3 shadow-xs">
            <h3 class="font-bold text-sm text-foreground border-b pb-2">Regras de Resolução & Arquivamento</h3>
            
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="chatSettings.autoResolveInactive" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
              <div class="text-xs">
                <span class="font-semibold text-foreground">Ocultar conversas resolvidas da caixa principal</span>
                <p class="text-muted-foreground">Mantém o painel de atendimento focado exclusivamente nos chamados em aberto</p>
              </div>
            </label>

            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="chatSettings.allowReopen" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
              <div class="text-xs">
                <span class="font-semibold text-foreground">Permitir reabertura de conversas resolvidas</span>
                <p class="text-muted-foreground">O analista ou colaborador pode reativar o chamado com 1 clique se a dúvida persistir</p>
              </div>
            </label>
          </div>
        </div>

        <!-- ─── TAB 2: DADOS DA EMPRESA ─── -->
        <div v-else-if="activeTab === 'company'" class="space-y-4">
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <h3 class="font-bold text-foreground border-b pb-2 text-sm">Informações da Organização</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Razão Social / Nome Fantasia</label>
                <input v-model="company.name" type="text" class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">CNPJ</label>
                <input v-model="company.cnpj" type="text" class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">E-mail Institucional de RH</label>
                <input v-model="company.contactEmail" type="email" class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Ramal Interno / Suporte</label>
                <input v-model="company.extension" type="text" class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Fuso Horário Padrão</label>
                <select v-model="company.timezone" class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="America/Sao_Paulo">América / São Paulo (UTC-3 - Brasília)</option>
                  <option value="America/Manaus">América / Manaus (UTC-4)</option>
                  <option value="America/Noronha">América / Fernando de Noronha (UTC-2)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Endereço da Sede Corporativa</label>
                <input v-model="company.address" type="text" class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          </div>
        </div>

        <!-- ─── TAB 3: SLA & NOTIFICAÇÕES ─── -->
        <div v-else-if="activeTab === 'sla'" class="space-y-4">
          <!-- Alertas Sonoros e Push -->
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <h3 class="font-bold text-foreground border-b pb-2 text-sm">Alertas e Notificações</h3>
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input v-model="notifications.soundNewMessage" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                <div class="text-xs">
                  <span class="font-semibold text-foreground">Emitir aviso sonoro para novas mensagens recebidas</span>
                  <p class="text-muted-foreground">Toca um bipe discreto quando um colaborador envia mensagem no chat interno</p>
                </div>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input v-model="notifications.soundUrgent" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                <div class="text-xs">
                  <span class="font-semibold text-foreground">Alerta sonoro diferenciado para chamados de alta prioridade</span>
                  <p class="text-muted-foreground">Sinaliza chamados críticos de desligamento, folha urgente ou acidentes</p>
                </div>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input v-model="notifications.browserPush" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                <div class="text-xs">
                  <span class="font-semibold text-foreground">Ativar notificações nativas do navegador (Push)</span>
                  <p class="text-muted-foreground">Exibe notificações de desktop mesmo quando a aba estiver em segundo plano</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Metas de SLA de Atendimento -->
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <h3 class="font-bold text-foreground border-b pb-2 text-sm">Metas de Tempo de Atendimento (SLA)</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Primeira Resposta no Chat</label>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="notifications.firstResponseSlaMinutes"
                    type="number"
                    min="1"
                    class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span class="text-xs text-muted-foreground font-semibold">minutos</span>
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Chamados de Férias & Folha</label>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="notifications.vacationSlaHours"
                    type="number"
                    min="1"
                    class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span class="text-xs text-muted-foreground font-semibold">horas</span>
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Dúvidas Gerais e Benefícios</label>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="notifications.generalSlaHours"
                    type="number"
                    min="1"
                    class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span class="text-xs text-muted-foreground font-semibold">horas</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── TAB 4: SEGURANÇA & DADOS ─── -->
        <div v-else-if="activeTab === 'security'" class="space-y-4">
          <!-- Card de Autenticação em Duas Etapas (2FA - TOTP) -->
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div class="flex items-center gap-2.5">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Smartphone :size="20" />
                </div>
                <div>
                  <h3 class="font-bold text-foreground text-sm flex items-center gap-2">
                    Autenticação em Duas Etapas (2FA)
                    <span
                      v-if="twoFactorActive"
                      class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                    >
                      <CheckCircle2 :size="12" /> Ativo
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    >
                      Desativado
                    </span>
                  </h3>
                  <p class="text-xs text-muted-foreground">Google Authenticator, Authy ou Microsoft Authenticator (TOTP)</p>
                </div>
              </div>

              <div>
                <button
                  v-if="twoFactorActive"
                  type="button"
                  :disabled="twoFactorLoading"
                  class="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100/50 cursor-pointer transition-all disabled:opacity-50"
                  @click="handleDisable2fa"
                >
                  <ShieldAlert :size="14" /> Desativar 2FA
                </button>
                <button
                  v-else
                  type="button"
                  :disabled="twoFactorLoading"
                  class="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50"
                  style="background: linear-gradient(135deg, #0f766e, #0d9488)"
                  @click="start2faSetup"
                >
                  <QrCode :size="15" /> {{ twoFactorLoading ? 'Carregando...' : 'Configurar Google Authenticator' }}
                </button>
              </div>
            </div>

            <!-- Descrição e status -->
            <div class="text-xs text-muted-foreground leading-relaxed">
              <p v-if="twoFactorActive">
                Sua conta corporativa está protegida com dupla verificação. A cada novo login será exigido um código gerado dinamicamente no seu aplicativo autenticador.
              </p>
              <p v-else>
                Adicione uma camada robusta de proteção contra vazamentos de senha vinculando o Google Authenticator ou outro aplicativo compatível com o padrão TOTP.
              </p>
            </div>

            <!-- Painel inline de Configuração do 2FA -->
            <div
              v-if="showSetupModal"
              class="rounded-2xl border-2 border-teal-500/30 bg-teal-50/40 dark:bg-teal-950/20 p-5 space-y-5 animate-in fade-in zoom-in-95 duration-200"
            >
              <div class="flex items-center justify-between border-b border-teal-200 dark:border-teal-800/40 pb-3">
                <div class="flex items-center gap-2">
                  <QrCode :size="18" class="text-teal-600 dark:text-teal-400" />
                  <h4 class="font-bold text-sm text-foreground">Configurar Aplicativo Autenticador</h4>
                </div>
                <button
                  type="button"
                  class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  @click="showSetupModal = false"
                >
                  Fechar
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <!-- Passo 1: QR Code -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <span class="text-xs font-bold text-foreground">1. Escaneie este QR Code no aplicativo:</span>
                  <div class="rounded-xl border bg-white p-2.5 shadow-md">
                    <img :src="qrCodeData" alt="QR Code 2FA TOTP" class="h-44 w-44 object-contain" />
                  </div>
                  <div class="space-y-1">
                    <p class="text-[11px] text-muted-foreground">Ou insira a chave manualmente:</p>
                    <div class="flex items-center gap-1.5 justify-center">
                      <code class="rounded-lg bg-background border px-2 py-1 font-mono text-xs font-bold tracking-wider text-teal-700 dark:text-teal-300 select-all">
                        {{ secretKey }}
                      </code>
                      <button
                        type="button"
                        class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Copiar chave"
                        @click="copySecret"
                      >
                        <Check v-if="copiedSecret" :size="14" class="text-emerald-500" />
                        <Copy v-else :size="14" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Passo 2: Código de 6 dígitos -->
                <div class="space-y-4">
                  <div class="space-y-1.5">
                    <span class="text-xs font-bold text-foreground">2. Digite o código de 6 dígitos gerado:</span>
                    <p class="text-[11px] text-muted-foreground leading-relaxed">
                      Após escanear, o Google Authenticator exibirá um código temporário de 6 dígitos referente ao <strong>PeopleHub RH</strong>.
                    </p>
                  </div>

                  <div>
                    <input
                      v-model="verificationCode"
                      type="text"
                      inputmode="numeric"
                      maxlength="6"
                      placeholder="000 000"
                      class="h-12 w-full rounded-xl border-2 bg-background text-center font-mono text-xl font-black tracking-widest outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      @keydown.enter="confirm2fa"
                    />
                  </div>

                  <div v-if="setupError" class="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-2.5 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle :size="15" class="shrink-0" />
                    <span>{{ setupError }}</span>
                  </div>

                  <div class="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      class="rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      @click="showSetupModal = false"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      :disabled="verificationCode.trim().length !== 6 || verifying2fa"
                      class="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50"
                      style="background: linear-gradient(135deg, #0f766e, #0d9488)"
                      @click="confirm2fa"
                    >
                      <ShieldCheck :size="15" />
                      {{ verifying2fa ? 'Validando...' : 'Ativar Proteção 2FA' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Banco de Dados e Privacidade -->
          <div class="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div class="flex items-center justify-between border-b pb-3">
              <div class="flex items-center gap-2.5">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database :size="20" />
                </div>
                <div>
                  <h3 class="font-bold text-foreground text-sm">Banco de Dados Local & Sessão</h3>
                  <p class="text-xs text-muted-foreground">Armazenamento seguro em SQLite local com criptografia de mensagens</p>
                </div>
              </div>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 :size="14" /> Sincronizado
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label class="block font-bold uppercase tracking-wider text-muted-foreground mb-1">Retenção de Mensagens (Dias)</label>
                <input
                  v-model.number="security.retentionDays"
                  type="number"
                  class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block font-bold uppercase tracking-wider text-muted-foreground mb-1">Expiração de Sessão por Inatividade</label>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="security.sessionTimeoutMinutes"
                    type="number"
                    class="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span class="text-xs text-muted-foreground font-semibold">min</span>
                </div>
              </div>
            </div>

            <div class="space-y-2 border-t pt-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input v-model="security.lgpdAnonymization" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                <div class="text-xs">
                  <span class="font-semibold text-foreground">Conformidade com LGPD (Lei Geral de Proteção de Dados)</span>
                  <p class="text-muted-foreground">Anonimiza automaticamente dados sensíveis de colaboradores desligados</p>
                </div>
              </label>

              <label class="flex items-center gap-3 cursor-pointer">
                <input v-model="security.auditLogsEnabled" type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" />
                <div class="text-xs">
                  <span class="font-semibold text-foreground">Logs de Auditoria de Acesso</span>
                  <p class="text-muted-foreground">Registra horários e autores de alterações de prontuários e holerites</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Bloco de Backup dos Dados -->
          <div class="rounded-xl border bg-card p-5 space-y-3 shadow-xs">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-sm text-foreground">Backup Completo do Sistema</h4>
                <p class="text-xs text-muted-foreground">Exporta todas as conversas, colaboradores, prontuários e trilhas em arquivo JSON seguro</p>
              </div>
              <button
                type="button"
                class="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold text-primary hover:bg-muted cursor-pointer transition-all shadow-2xs"
                @click="exportBackupJson"
              >
                <Download :size="15" /> Exportar Backup (JSON)
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- Rodapé com Ações -->
      <footer class="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
        <button
          type="button"
          class="rounded-xl border bg-card px-4 py-2 text-xs sm:text-sm font-semibold text-foreground hover:bg-muted cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="button"
          :disabled="saving"
          class="flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95 cursor-pointer"
          style="background-color: var(--color-primary)"
          @click="handleSave"
        >
          <Save :size="16" /> {{ saving ? 'Salvando...' : 'Salvar Configurações' }}
        </button>
      </footer>

    </div>
  </div>
</template>
