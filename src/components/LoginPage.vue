<script setup lang="ts">
import { ref, reactive } from "vue"
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Users, BarChart3, MessagesSquare, Folder } from "lucide-vue-next"
import { loginUser, loginAsPreset } from "../store"

const form = reactive({ email: "", password: "" })
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

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
              ✦ Omnichannel · Documentos · Relatórios
            </span>
            <h1 class="text-4xl font-black leading-tight tracking-tight text-white xl:text-5xl">
              Gestão de Pessoas<br />
              <span style="background: linear-gradient(90deg, #5eead4, #a7f3d0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                sem fronteiras.
              </span>
            </h1>
            <p class="max-w-sm text-sm leading-relaxed text-white/60">
              Centralize atendimento omnichannel, documentos e dados dos seus colaboradores em uma única plataforma segura.
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

    <!-- PAINEL DIREITO — Formulário -->
    <main class="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">
      <div class="w-full max-w-sm space-y-7">
        <!-- Mobile logo -->
        <div class="flex items-center gap-2.5 lg:hidden">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl font-black text-sm text-primary-foreground" style="background: var(--color-primary)">PH</span>
          <span class="font-bold text-foreground">PeopleHub</span>
        </div>

        <!-- Header -->
        <div class="space-y-1">
          <h2 class="text-2xl font-black tracking-tight text-foreground">Bem-vindo de volta 👋</h2>
          <p class="text-sm text-muted-foreground">Acesse sua conta para continuar no PeopleHub</p>
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

        <!-- Form -->
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
                placeholder="seu@empresa.com"
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
              <button type="button" class="text-xs font-medium text-teal-700 hover:underline">
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
                class="w-full rounded-xl border bg-card py-3 pl-10 pr-12 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 hover:border-teal-400/50"
                style="--tw-ring-color: var(--color-ring)"
                :class="error ? 'border-red-300 bg-red-50/30' : ''"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
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
            class="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
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
