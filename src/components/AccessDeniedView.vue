<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"
import { ShieldAlert, ArrowLeft, LogOut, Lock, User, Briefcase, Building } from "lucide-vue-next"
import { currentUser, activeUserRole, logoutUser } from "../store"

const router = useRouter()

const roleBadgeClass = computed(() => {
  switch (activeUserRole.value) {
    case "ADMIN":
      return "bg-rose-500/10 text-rose-400 border-rose-500/30"
    case "RH":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
    case "GESTOR":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30"
    case "COLABORADOR":
    default:
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
  }
})

function goHome() {
  router.push("/")
}

async function handleLogout() {
  await logoutUser()
  router.push("/login")
}
</script>

<template>
  <div class="min-h-full flex items-center justify-center p-6 bg-slate-950 text-slate-100">
    <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
      <!-- Icon Glow -->
      <div class="mx-auto w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
        <ShieldAlert class="w-10 h-10 animate-pulse" />
      </div>

      <!-- Title & Message -->
      <div class="space-y-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Lock class="w-3.5 h-3.5" /> Erro 403 • Não Autorizado
        </span>
        <h1 class="text-2xl font-bold text-white tracking-tight">Acesso Restrito</h1>
        <p class="text-sm text-slate-400 leading-relaxed">
          Você não possui permissão suficiente para acessar este recurso ou página da plataforma.
        </p>
      </div>

      <!-- User Context Card -->
      <div v-if="currentUser" class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-left space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Perfil Atual Conectado</span>
          <span :class="['px-2 py-0.5 rounded-md text-xs font-semibold border', roleBadgeClass]">
            {{ activeUserRole }}
          </span>
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-sm text-slate-200 font-medium">
            <User class="w-4 h-4 text-slate-400 shrink-0" />
            <span class="truncate">{{ currentUser.name }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <Briefcase class="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span class="truncate">{{ currentUser.role || 'Sem cargo definido' }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <Building class="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span class="truncate">{{ currentUser.department || 'Geral' }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="pt-2 flex flex-col sm:flex-row gap-3">
        <button
          @click="goHome"
          class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
        >
          <ArrowLeft class="w-4 h-4" />
          Voltar ao Início
        </button>
        <button
          @click="handleLogout"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all border border-slate-700/60 cursor-pointer"
        >
          <LogOut class="w-4 h-4" />
          Trocar Conta
        </button>
      </div>
    </div>
  </div>
</template>
