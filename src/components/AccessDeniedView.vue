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
  <div class="min-h-full flex items-center justify-center p-4 sm:p-6 bg-background text-foreground">
    <div class="max-w-md w-full bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-xl text-center space-y-6">
      <!-- Icon Glow -->
      <div class="mx-auto w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner">
        <ShieldAlert class="w-10 h-10 animate-pulse" />
      </div>

      <!-- Title & Message -->
      <div class="space-y-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          <Lock class="w-3.5 h-3.5" /> Erro 403 • Não Autorizado
        </span>
        <h1 class="text-2xl font-bold text-foreground tracking-tight">Acesso Restrito</h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          Você não possui permissão suficiente para acessar este recurso ou página da plataforma.
        </p>
      </div>

      <!-- User Context Card -->
      <div v-if="currentUser" class="bg-muted/30 border border-border rounded-xl p-4 text-left space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfil Atual Conectado</span>
          <span :class="['px-2.5 py-0.5 rounded-full text-xs font-semibold border', roleBadgeClass]">
            {{ activeUserRole }}
          </span>
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-sm text-foreground font-semibold">
            <User class="w-4 h-4 text-muted-foreground shrink-0" />
            <span class="truncate">{{ currentUser.name }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Briefcase class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span class="truncate">{{ currentUser.role || 'Sem cargo definido' }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Building class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span class="truncate">{{ currentUser.department || 'Geral' }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="pt-2 flex flex-col sm:flex-row gap-3">
        <button
          @click="goHome"
          class="ph-btn-primary flex-1 justify-center py-2.5"
        >
          <ArrowLeft class="w-4 h-4" />
          Voltar ao Início
        </button>
        <button
          @click="handleLogout"
          class="ph-btn-secondary justify-center py-2.5"
        >
          <LogOut class="w-4 h-4" />
          Trocar Conta
        </button>
      </div>
    </div>
  </div>
</template>
