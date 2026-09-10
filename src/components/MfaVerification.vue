<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue"
import { ShieldCheck, RefreshCw, ArrowLeft, CheckCircle2, AlertCircle, Lock } from "lucide-vue-next"
import { mfaCode, authStep, verifyMfaCode, resendMfaCode } from "../store"

const RESEND_SECONDS = 30

const digits = ref<string[]>(Array(6).fill(""))
const inputRefs = ref<(HTMLInputElement | null)[]>(Array(6).fill(null))
const error = ref<string | null>(null)
const loading = ref(false)
const success = ref(false)
const countdown = ref(RESEND_SECONDS)
const canResend = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const codeDisplay = computed(() =>
  mfaCode.value ? mfaCode.value.replace(/(\d{3})(\d{3})/, "$1 $2") : "------",
)

function startTimer() {
  countdown.value = RESEND_SECONDS
  canResend.value = false
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer!)
      canResend.value = true
    }
  }, 1000)
}

onMounted(() => {
  startTimer()
  setTimeout(() => inputRefs.value[0]?.focus(), 100)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function onDigitInput(index: number, e: Event) {
  const input = e.target as HTMLInputElement
  const val = input.value.replace(/\D/g, "")
  if (!val) return

  // Handle paste of full code
  if (val.length === 6) {
    digits.value = val.split("")
    verify()
    return
  }

  digits.value[index] = val[val.length - 1]
  if (index < 5) {
    setTimeout(() => inputRefs.value[index + 1]?.focus(), 0)
  }
  if (digits.value.every((d) => d !== "")) {
    verify()
  }
}

function onKeydown(index: number, e: KeyboardEvent) {
  if (e.key === "Backspace") {
    if (digits.value[index]) {
      digits.value[index] = ""
    } else if (index > 0) {
      digits.value[index - 1] = ""
      inputRefs.value[index - 1]?.focus()
    }
  }
  if (e.key === "ArrowLeft" && index > 0) inputRefs.value[index - 1]?.focus()
  if (e.key === "ArrowRight" && index < 5) inputRefs.value[index + 1]?.focus()
}

async function verify() {
  const code = digits.value.join("")
  if (code.length < 6) return
  error.value = null
  loading.value = true

  await new Promise((r) => setTimeout(r, 700))
  const result = await verifyMfaCode(code)
  loading.value = false

  if (!result.ok) {
    error.value = result.error ?? "Código inválido."
    digits.value = Array(6).fill("")
    setTimeout(() => inputRefs.value[0]?.focus(), 0)
    return
  }

  success.value = true
}

async function handleResend() {
  if (!canResend.value) return
  await resendMfaCode()
  digits.value = Array(6).fill("")
  error.value = null
  startTimer()
  setTimeout(() => inputRefs.value[0]?.focus(), 100)
}

function goBack() {
  authStep.value = "login"
  digits.value = Array(6).fill("")
  error.value = null
}
</script>

<template>
  <div class="flex h-screen w-full items-center justify-center bg-background p-4 font-sans overflow-y-auto">

    <!-- Success overlay -->
    <transition
      enter-active-class="transition-all duration-500"
      enter-from-class="opacity-0 scale-95"
    >
      <div v-if="success" class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4" style="background: linear-gradient(135deg, #0a4d47, #0f766e)">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <CheckCircle2 :size="40" class="text-white" />
        </div>
        <h2 class="text-2xl font-black text-white">Acesso Autorizado!</h2>
        <p class="text-sm text-white/70">Redirecionando para o PeopleHub...</p>
      </div>
    </transition>

    <div class="w-full max-w-md space-y-7">
      <!-- Header -->
      <div class="text-center space-y-2">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto shadow-lg"
          style="background: linear-gradient(135deg, #0f766e, #0d9488)">
          <ShieldCheck :size="30" class="text-white" />
        </div>
        <h1 class="text-2xl font-black tracking-tight text-foreground">Verificação de Identidade</h1>
        <p class="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          Insira o código de 6 dígitos do seu aplicativo autenticador para confirmar sua identidade
        </p>
      </div>

      <!-- Demo code hint -->
      <div class="rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 flex items-start gap-3">
        <Lock :size="18" class="shrink-0 mt-0.5 text-teal-600" />
        <div>
          <p class="text-xs font-bold text-teal-800">Código de Verificação (Demo)</p>
          <p class="text-xs text-teal-700 mt-0.5">Seu código de acesso desta sessão é:</p>
          <p class="mt-1.5 font-mono text-2xl font-black tracking-[0.25em] text-teal-800 select-all">
            {{ codeDisplay }}
          </p>
          <p class="text-[10px] text-teal-500 mt-1">Em produção, este código chegaria via app autenticador ou SMS.</p>
        </div>
      </div>

      <!-- Error -->
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

      <!-- 6-digit inputs -->
      <div class="space-y-3">
        <div class="flex items-center justify-center gap-2 sm:gap-3">
          <template v-for="(_, i) in 6" :key="i">
            <input
              :ref="(el) => { inputRefs[i] = el as HTMLInputElement | null }"
              v-model="digits[i]"
              type="text"
              inputmode="numeric"
              maxlength="2"
              autocomplete="one-time-code"
              :disabled="loading || success"
              class="h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border-2 bg-card text-center text-xl font-black tracking-widest outline-none transition-all disabled:opacity-50"
              :class="[
                error ? 'border-red-300 bg-red-50/40 text-red-700' : '',
                digits[i] && !error ? 'border-teal-500 bg-teal-50/30 text-teal-800' : '',
                !digits[i] && !error ? 'border-border hover:border-teal-300 text-foreground' : '',
                'focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
              ]"
              style="--tw-ring-color: var(--color-ring)"
              @input="onDigitInput(i, $event)"
              @keydown="onKeydown(i, $event)"
              @paste.prevent="(e) => {
                const t = e.clipboardData?.getData('text').replace(/\D/g,'') ?? ''
                if (t.length >= 6) {
                  digits = t.slice(0,6).split('');
                  verify();
                }
              }"
            />
            <!-- Separator between digit 3 and 4 -->
            <span v-if="i === 2" class="text-xl font-light text-muted-foreground select-none">·</span>
          </template>
        </div>

        <!-- Loading bar -->
        <div v-if="loading" class="mx-auto h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full animate-pulse" style="width: 100%; background: var(--color-primary)"></div>
        </div>
      </div>

      <!-- Verify button -->
      <button
        type="button"
        :disabled="digits.join('').length < 6 || loading || success"
        class="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        style="background: linear-gradient(135deg, #0f766e, #0d9488)"
        @click="verify"
      >
        <ShieldCheck :size="18" />
        {{ loading ? "Verificando..." : "Confirmar Identidade" }}
      </button>

      <!-- Resend + Back -->
      <div class="flex items-center justify-between text-xs font-medium">
        <button
          type="button"
          class="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          @click="goBack"
        >
          <ArrowLeft :size="15" /> Voltar ao login
        </button>

        <button
          type="button"
          :disabled="!canResend"
          class="flex items-center gap-1.5 transition-colors disabled:pointer-events-none"
          :class="canResend ? 'text-teal-700 hover:underline' : 'text-muted-foreground/60'"
          @click="handleResend"
        >
          <RefreshCw :size="14" :class="canResend ? '' : 'opacity-50'" />
          <span v-if="canResend">Reenviar código</span>
          <span v-else>Reenviar em {{ countdown }}s</span>
        </button>
      </div>
    </div>
  </div>
</template>
