<script setup lang="ts">
import { ref, computed } from "vue"
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, LogOut } from "lucide-vue-next"
import { currentUser, changeFirstLoginPassword, logoutUser } from "../store"

const newPassword = ref("")
const confirmPassword = ref("")
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

const isLengthValid = computed(() => newPassword.value.length >= 6)
const isMatchValid = computed(() => Boolean(confirmPassword.value) && newPassword.value === confirmPassword.value)
const canSubmit = computed(() => isLengthValid.value && isMatchValid.value && !loading.value)

// Indicador visual simples de força da senha
const passwordStrength = computed(() => {
  const p = newPassword.value
  if (!p) return 0
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p)) score++
  return score // 0 a 4
})

const strengthLabel = computed(() => {
  switch (passwordStrength.value) {
    case 1:
      return { text: "Fraca", color: "text-amber-500", bar: "w-1/4 bg-amber-500" }
    case 2:
      return { text: "Razoável", color: "text-yellow-500", bar: "w-2/4 bg-yellow-500" }
    case 3:
      return { text: "Boa", color: "text-emerald-500", bar: "w-3/4 bg-emerald-500" }
    case 4:
      return { text: "Forte", color: "text-teal-600", bar: "w-full bg-teal-600" }
    default:
      return { text: "Mínimo 6 caracteres", color: "text-muted-foreground", bar: "w-0 bg-transparent" }
  }
})

async function handleSubmit() {
  errorMessage.value = null

  if (!isLengthValid.value) {
    errorMessage.value = "A senha deve ter pelo menos 6 caracteres."
    return
  }

  if (!isMatchValid.value) {
    errorMessage.value = "As senhas digitadas não coincidem."
    return
  }

  loading.value = true
  const res = await changeFirstLoginPassword(newPassword.value)
  loading.value = false

  if (!res.ok) {
    errorMessage.value = res.error || "Não foi possível alterar sua senha. Tente novamente."
  }
}
</script>

<template>
  <!-- Backdrop Blur escuro bloqueando interação de fundo -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md transition-all">
    <div
      class="w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-teal-950/20 transition-all animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Header com gradiente sutil -->
      <div class="relative bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 px-6 py-6 text-white text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm border border-white/25">
          <ShieldCheck :size="26" class="text-white" />
        </div>
        <span class="inline-block rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-xs border border-white/20 mb-1.5">
          ✦ Primeiro Acesso Obrigatório
        </span>
        <h2 class="text-xl font-bold tracking-tight text-white">
          Defina sua Nova Senha Pessoal
        </h2>
        <p class="mt-1 text-xs text-white/80 max-w-xs mx-auto">
          Olá, <strong>{{ currentUser?.name || 'Colaborador' }}</strong>! Por diretriz de privacidade e segurança, sua senha inicial deve ser alterada antes de continuar.
        </p>
      </div>

      <!-- Formulário -->
      <div class="p-6 space-y-5">
        <!-- Banner de erro -->
        <transition
          enter-active-class="transition-all duration-200"
          leave-active-class="transition-all duration-200"
          enter-from-class="opacity-0 -translate-y-1"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="errorMessage" class="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle :size="16" class="shrink-0 text-red-500" />
            <span>{{ errorMessage }}</span>
          </div>
        </transition>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <!-- Campo: Nova Senha -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nova Senha
            </label>
            <div class="relative">
              <Lock :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                required
                placeholder="Defina sua nova senha"
                class="w-full rounded-xl border bg-background py-2.5 pl-10 pr-11 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                @click="showNewPassword = !showNewPassword"
              >
                <EyeOff v-if="showNewPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>

            <!-- Barra de Força da Senha -->
            <div v-if="newPassword" class="space-y-1 pt-1">
              <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div class="h-full transition-all duration-300 rounded-full" :class="strengthLabel.bar"></div>
              </div>
              <div class="flex justify-between items-center text-[11px]">
                <span class="text-muted-foreground">Força da senha:</span>
                <span :class="strengthLabel.color" class="font-semibold">{{ strengthLabel.text }}</span>
              </div>
            </div>
          </div>

          <!-- Campo: Confirmar Nova Senha -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Confirmar Nova Senha
            </label>
            <div class="relative">
              <Lock :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                placeholder="Digite a nova senha novamente"
                class="w-full rounded-xl border bg-background py-2.5 pl-10 pr-11 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <EyeOff v-if="showConfirmPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
            <!-- Validação visual se coincidem -->
            <p v-if="confirmPassword && isMatchValid" class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 :size="13" /> As senhas coincidem perfeitamente.
            </p>
            <p v-else-if="confirmPassword && !isMatchValid" class="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
              <AlertCircle :size="13" /> As senhas ainda não coincidem.
            </p>
          </div>

          <!-- Botão Salvar -->
          <button
            type="submit"
            :disabled="!canSubmit"
            class="w-full mt-4 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            style="background: linear-gradient(135deg, #0f766e, #0d9488)"
          >
            <span v-if="!loading" class="flex items-center gap-2">
              <span>Salvar Senha & Acessar Sistema</span>
              <ArrowRight :size="16" />
            </span>
            <span v-else class="flex items-center gap-2">
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
              <span>Salvando nova senha...</span>
            </span>
          </button>
        </form>

        <!-- Informações de Segurança -->
        <div class="rounded-xl border border-teal-100 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/20 p-3 text-[11px] leading-relaxed text-teal-800 dark:text-teal-300">
          <strong>Aviso de Segurança:</strong> Após salvar sua nova senha pessoal, este modal nunca mais aparecerá e seus próximos logins exigirão exclusivamente a nova senha definida por você.
        </div>

        <!-- Botão de Sair / Cancelar -->
        <div class="pt-1 text-center">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
            @click="logoutUser"
          >
            <LogOut :size="13" /> Sair da conta e voltar ao login
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
