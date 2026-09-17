<script setup lang="ts">
import { ref, reactive } from "vue"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Users,
  BarChart3,
  MessagesSquare,
  Folder,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Send,
  CheckCircle2,
} from "lucide-vue-next"
import { loginUser, loginAsPreset } from "../store"

const form = reactive({ email: "", password: "" })
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

// Estado para "Esqueci a minha senha"
const isForgotPasswordOpen = ref(false)
const forgotEmail = ref("")
const forgotLoading = ref(false)
const forgotSuccess = ref<string | null>(null)
const forgotError = ref<string | null>(null)

function openForgotPassword() {
  forgotEmail.value = form.email || ""
  forgotError.value = null
  forgotSuccess.value = null
  isForgotPasswordOpen.value = true
}

function closeForgotPassword() {
  isForgotPasswordOpen.value = false
  if (forgotSuccess.value && forgotEmail.value) {
    form.email = forgotEmail.value
  }
  forgotError.value = null
  forgotSuccess.value = null
}

async function handleForgotPasswordSubmit() {
  forgotError.value = null
  forgotSuccess.value = null

  if (!forgotEmail.value || !forgotEmail.value.trim()) {
    forgotError.value = "Por favor, digite seu e-mail corporativo cadastrado."
    return
  }

  forgotLoading.value = true
  try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail.value.trim() }),
    })
    const data = await res.json()
    forgotLoading.value = false

    if (data.ok) {
      forgotSuccess.value = data.message || "E-mail de recuperação enviado com sucesso!"
    } else {
      forgotError.value = data.error || "Não foi possível enviar o e-mail de recuperação."
    }
  } catch (err: any) {
    forgotLoading.value = false
    forgotError.value = err?.message || "Erro de conexão ao solicitar recuperação."
  }
}

function fillAdminCredentials() {
  form.email = "admin@empresa.com"
  form.password = "admin123"
  error.value = null
}

async function handleSubmit() {
  error.value = null
  if (!form.email || !form.password) {
    error.value = "Preencha e-mail e senha para continuar."
    return
  }
  loading.value = true
  const result = await loginUser(form.email, form.password)
  loading.value = false
  if (!result.ok) {
    error.value = result.error ?? "Falha no login."
    return
  }
}

const features = [
  { icon: MessagesSquare, label: "Chat Interno Corporativo" },
  { icon: Users, label: "Gestão de Colaboradores" },
  { icon: Folder, label: "Pastas Digitais de Documentos" },
  { icon: BarChart3, label: "Relatórios & Indicadores" },
]
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background font-sans">

    <!-- PAINEL ESQUERDO — Branding -->
    <aside class="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col relative overflow-hidden"
      style="background: linear-gradient(135deg, #0a4d47 0%, #0f766e 45%, #134e4a 100%)">

      <!-- Noise / Grain overlay -->
      <div class="absolute inset-0 opacity-[0.03]"
        style="background-image: url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E')"></div>

      <!-- Decorative circles -->
      <div class="absolute -top-24 -left-24 h-80 w-80 rounded-full opacity-20"
        style="background: radial-gradient(circle, #5eead4 0%, transparent 70%)"></div>
      <div class="absolute bottom-0 right-0 h-96 w-96 rounded-full opacity-10 translate-x-1/3 translate-y-1/3"
        style="background: radial-gradient(circle, #2dd4bf 0%, transparent 70%)"></div>

      <div class="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <!-- Logo -->
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 font-black text-white text-sm tracking-tight shadow-lg backdrop-blur-sm border border-white/10">
            PH
          </span>
          <div>
            <p class="font-bold text-white text-base leading-tight tracking-tight">PeopleHub</p>
            <p class="text-white/50 text-xs">Plataforma de Gestão de RH</p>
          </div>
        </div>

        <!-- Hero content -->
        <div class="space-y-6">
          <div class="space-y-3">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
              ✦ Omnichannel · Multi-Empresa · 2FA Seguro
            </span>
            <h1 class="text-4xl font-black leading-tight tracking-tight text-white xl:text-5xl">
              Gestão de Pessoas<br />
              <span style="background: linear-gradient(90deg, #5eead4, #a7f3d0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                sem fronteiras.
              </span>
            </h1>
            <p class="max-w-sm text-sm leading-relaxed text-white/60">
              Centralize atendimento omnichannel, colaboradores, documentos e segurança corporativa em uma única plataforma isolada por tenant.
            </p>
          </div>

          <!-- Feature chips -->
          <div class="grid grid-cols-2 gap-2.5">
            <div
              v-for="f in features"
              :key="f.label"
              class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur-sm transition-all hover:bg-white/12"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-400/20 text-teal-300">
                <component :is="f.icon" :size="16" />
              </span>
              <span class="text-xs font-medium text-white/80">{{ f.label }}</span>
            </div>
          </div>
        </div>

        <!-- Footer cite -->
        <div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-400/30 font-bold text-white text-sm">
            VS
          </div>
          <div>
            <p class="text-xs font-semibold text-white">"A plataforma que transformou nossa gestão de RH."</p>
            <p class="text-[11px] text-white/50 mt-0.5">Victor Silva — Analista de RH, PeopleHub</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- PAINEL DIREITO — Formulário de Login / Cadastro -->
    <main class="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">
      <div class="w-full max-w-sm space-y-6 py-6">
        <!-- Mobile logo -->
        <div class="flex items-center gap-2.5 lg:hidden">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl font-black text-sm text-primary-foreground" style="background: var(--color-primary)">PH</span>
          <span class="font-bold text-foreground">PeopleHub</span>
        </div>

        <!-- VISÃO DE ESQUECI A SENHA -->
        <div v-if="isForgotPasswordOpen" class="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div class="space-y-1">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer mb-2"
              @click="closeForgotPassword"
            >
              <ArrowLeft :size="14" /> Voltar ao Login
            </button>
            <h2 class="text-2xl font-black tracking-tight text-foreground">
              Recuperar Senha 🔑
            </h2>
            <p class="text-sm text-muted-foreground">
              Informe seu e-mail para receber uma nova senha de acesso via nosso servidor de e-mail corporativo.
            </p>
          </div>

          <!-- Mensagem de Sucesso -->
          <div
            v-if="forgotSuccess"
            class="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <div class="flex items-start gap-2.5">
              <CheckCircle2 :size="18" class="text-emerald-600 mt-0.5 shrink-0" />
              <div class="space-y-1 text-xs">
                <p class="font-bold text-sm">Instruções enviadas com sucesso!</p>
                <p class="leading-relaxed">{{ forgotSuccess }}</p>
                <p class="pt-1 text-emerald-700 dark:text-emerald-300">
                  Faça login com a senha recebida e defina sua nova senha definitiva no primeiro acesso.
                </p>
              </div>
            </div>
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold text-white shadow-sm transition-all hover:opacity-95 cursor-pointer"
              style="background: linear-gradient(135deg, #0f766e, #0d9488)"
              @click="closeForgotPassword"
            >
              <LogIn :size="15" /> Ir para a Tela de Login
            </button>
          </div>

          <!-- Formulário de Envio -->
          <form v-else class="space-y-4" @submit.prevent="handleForgotPasswordSubmit">
            <!-- Erro -->
            <div v-if="forgotError" class="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle :size="16" class="shrink-0 text-red-500" />
              {{ forgotError }}
            </div>

            <div class="space-y-1.5">
              <label for="forgot-email" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Seu E-mail Institucional
              </label>
              <div class="relative">
                <Mail :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="forgot-email"
                  v-model="forgotEmail"
                  type="email"
                  required
                  placeholder="seu.email@empresa.com"
                  class="w-full rounded-xl border bg-card py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 hover:border-teal-400/50"
                  style="--tw-ring-color: var(--color-ring)"
                />
              </div>
            </div>

            <button
              type="submit"
              :disabled="forgotLoading"
              class="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              style="background: linear-gradient(135deg, #0f766e, #0d9488)"
            >
              <span v-if="!forgotLoading" class="flex items-center gap-2">
                <Send :size="16" /> Enviar Nova Senha por E-mail
              </span>
              <span v-else class="flex items-center gap-2">
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Disparando e-mail via SMTP...
              </span>
            </button>
          </form>
        </div>

        <!-- VISÃO DE LOGIN PADRÃO -->
        <template v-else>
          <!-- Header -->
          <div class="space-y-1">
            <h2 class="text-2xl font-black tracking-tight text-foreground">
              Bem-vindo de volta 👋
            </h2>
            <p class="text-sm text-muted-foreground">
              Acesse sua conta para continuar no PeopleHub
            </p>
          </div>

          <!-- Error banner -->
          <transition
            enter-active-class="transition-all duration-200"
            leave-active-class="transition-all duration-200"
            enter-from-class="opacity-0 -translate-y-1"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="error" class="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle :size="18" class="shrink-0 text-red-500" />
              {{ error }}
            </div>
          </transition>

          <!-- Botão de Preenchimento Rápido (Admin) -->
          <div>
            <button
              type="button"
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/60 dark:bg-teal-950/20 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100/60 transition-all cursor-pointer shadow-2xs group"
              @click="fillAdminCredentials"
            >
              <span class="flex items-center gap-2">
                <Sparkles :size="14" class="text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
                <span>Login Rápido com <strong>Admin</strong></span>
              </span>
              <span class="text-[10px] font-mono opacity-80 group-hover:translate-x-0.5 transition-transform">admin123 ➔</span>
            </button>
          </div>

          <!-- FORMULÁRIO DE LOGIN -->
          <form class="space-y-4" @submit.prevent="handleSubmit">
            <!-- Email -->
            <div class="space-y-1.5">
              <label for="login-email" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                E-mail Institucional
              </label>
              <div class="relative">
                <Mail :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-email"
                  v-model="form.email"
                  type="email"
                  autocomplete="email"
                  placeholder="admin@empresa.com"
                  required
                  class="w-full rounded-xl border bg-card py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 hover:border-teal-400/50"
                  style="--tw-ring-color: var(--color-ring)"
                  :class="error ? 'border-red-300 bg-red-50/30' : ''"
                />
              </div>
            </div>

            <!-- Password -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label for="login-password" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Senha
                </label>
                <button
                  type="button"
                  class="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  @click="openForgotPassword"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div class="relative">
                <Lock :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  required
                  class="w-full rounded-xl border bg-card py-3 pl-10 pr-12 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 hover:border-teal-400/50"
                  style="--tw-ring-color: var(--color-ring)"
                  :class="error ? 'border-red-300 bg-red-50/30' : ''"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                  :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="17" />
                  <Eye v-else :size="17" />
                </button>
              </div>
            </div>

            <!-- Submit button -->
            <button
              type="submit"
              :disabled="loading"
              class="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
              style="background: linear-gradient(135deg, #0f766e, #0d9488)"
            >
              <span v-if="!loading" class="flex items-center gap-2">
                <LogIn :size="18" /> Entrar na Plataforma
              </span>
              <span v-else class="flex items-center gap-2">
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Verificando credenciais...
              </span>
            </button>
          </form>
        </template>

        <!-- Aviso corporativo: Acesso gerenciado pelo RH -->
        <div class="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 text-xs text-teal-800 dark:text-teal-300 flex items-start gap-2.5">
          <ShieldCheck :size="16" class="shrink-0 text-teal-600 mt-0.5" />
          <p class="leading-relaxed">
            <strong>Novo colaborador?</strong> O seu acesso à plataforma e credenciais iniciais são gerados pelo <strong>RH</strong> no momento da criação da sua pasta funcional.
          </p>
        </div>

        <!-- Acesso Rápido por Perfil (RH, DP, T.I. e Colaborador) -->
        <div class="space-y-3 pt-2">
          <div class="relative flex items-center justify-center">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-border"></div></div>
            <span class="relative bg-background px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Acesso Rápido por Perfil
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <!-- RH -->
            <button
              type="button"
              class="flex flex-col items-start p-2.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-teal-500 transition-all text-left cursor-pointer group shadow-2xs"
              @click="loginAsPreset('rh')"
            >
              <div class="flex items-center gap-1.5 font-bold text-foreground">
                <span class="h-2 w-2 rounded-full bg-teal-500"></span>
                <span>Recursos Humanos</span>
              </div>
              <span class="text-[10px] text-muted-foreground mt-0.5">Mariana · DHO & Gestão</span>
            </button>

            <!-- DP -->
            <button
              type="button"
              class="flex flex-col items-start p-2.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-blue-500 transition-all text-left cursor-pointer group shadow-2xs"
              @click="loginAsPreset('dp')"
            >
              <div class="flex items-center gap-1.5 font-bold text-foreground">
                <span class="h-2 w-2 rounded-full bg-blue-500"></span>
                <span>Depto. Pessoal</span>
              </div>
              <span class="text-[10px] text-muted-foreground mt-0.5">Carlos · Folha & Ponto</span>
            </button>

            <!-- TI -->
            <button
              type="button"
              class="flex flex-col items-start p-2.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-purple-500 transition-all text-left cursor-pointer group shadow-2xs"
              @click="loginAsPreset('ti')"
            >
              <div class="flex items-center gap-1.5 font-bold text-foreground">
                <span class="h-2 w-2 rounded-full bg-purple-500"></span>
                <span>T.I. & Segurança</span>
              </div>
              <span class="text-[10px] text-muted-foreground mt-0.5">Lucas · Infra & Backups</span>
            </button>

            <!-- Colaborador -->
            <button
              type="button"
              class="flex flex-col items-start p-2.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-emerald-500 transition-all text-left cursor-pointer group shadow-2xs"
              @click="loginAsPreset('colaborador')"
            >
              <div class="flex items-center gap-1.5 font-bold text-foreground">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>Colaborador</span>
              </div>
              <span class="text-[10px] text-muted-foreground mt-0.5">Gabriel · Autoatendimento</span>
            </button>
          </div>
        </div>

        <!-- Security badge -->
        <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd" />
          </svg>
          Conexão protegida · Criptografia de ponta a ponta
        </div>
      </div>
    </main>
  </div>
</template>
