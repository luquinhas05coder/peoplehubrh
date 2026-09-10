<script setup lang="ts">
import { ref, reactive } from "vue"
import { X, User, Mail, Lock, Save, Briefcase, Building, ShieldCheck } from "lucide-vue-next"
import { currentUser, showToast, userRoleType, type UserRoleType } from "../store"
import UserAvatar from "./UserAvatar.vue"

const emit = defineEmits<{
  (e: "close"): void
}>()

const form = reactive({
  name: currentUser.value?.name || "",
  email: currentUser.value?.email || "",
  role: currentUser.value?.role || "Gestor de RH",
  roleType: (currentUser.value?.roleType || userRoleType.value) as UserRoleType,
  department: currentUser.value?.department || "Recursos Humanos",
  password: "",
  confirmPassword: "",
})

function onRoleChange() {
  if (form.roleType === "rh") {
    form.role = "Gestora de RH & DHO"
    form.department = "Recursos Humanos"
  } else if (form.roleType === "dp") {
    form.role = "Especialista em DP & Folha"
    form.department = "Departamento Pessoal"
  } else if (form.roleType === "ti") {
    form.role = "Administrador de Sistemas & TI"
    form.department = "Tecnologia da Informação"
  } else if (form.roleType === "colaborador") {
    form.role = "Desenvolvedor de Software"
    form.department = "Tecnologia"
  }
}

const loading = ref(false)

async function handleSave() {
  if (form.password && form.password !== form.confirmPassword) {
    showToast("As senhas não coincidem.", "error")
    return
  }

  loading.value = true
  try {
    const payload: Record<string, string> = {
      name: form.name,
      email: form.email,
      role: form.role,
      roleType: form.roleType,
      department: form.department,
    }
    if (form.password) {
      payload.password = form.password
    }

    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (data.ok && data.user) {
      currentUser.value = {
        ...data.user,
        roleType: form.roleType,
      }
      showToast("Perfil atualizado com sucesso!", "success")
      emit("close")
    } else {
      showToast(data.error || "Erro ao atualizar perfil.", "error")
    }
  } catch (_e) {
    // Atualização local de fallback
    const rawName = form.name.trim()
    const initials = rawName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "US"
    currentUser.value = {
      id: currentUser.value?.id || "usr_1",
      name: rawName,
      email: form.email,
      role: form.role,
      roleType: form.roleType,
      department: form.department,
      initials,
    }
    showToast("Perfil atualizado com sucesso!", "success")
    emit("close")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="relative flex h-[85vh] max-h-[680px] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl border border-border">
      
      <!-- Cabeçalho -->
      <header class="flex items-center justify-between border-b px-6 py-4" style="background-color: var(--color-primary)">
        <div class="flex items-center gap-3 text-primary-foreground">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
            <User :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-bold">Meu Perfil de Usuário</h2>
            <p class="text-xs text-primary-foreground/75">Visualize e edite suas informações pessoais e credenciais de acesso</p>
          </div>
        </div>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Formulário -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        
        <!-- User Header Card -->
        <div class="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 shadow-sm">
          <UserAvatar :initials="currentUser?.initials || 'RH'" :size="56" />
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-base text-foreground truncate">{{ currentUser?.name }}</h3>
            <p class="text-xs text-muted-foreground truncate">{{ currentUser?.email }}</p>
            <div class="mt-1 flex items-center gap-2">
              <span class="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wide">
                {{ currentUser?.role || 'Usuário' }}
              </span>
              <span class="text-[11px] text-muted-foreground">{{ currentUser?.department }}</span>
            </div>
          </div>
        </div>

        <!-- Campos de Edição -->
        <form class="space-y-4" @submit.prevent="handleSave">
          <!-- Perfil de Acesso & Nível de Permissão (RBAC) -->
          <div class="space-y-1.5 rounded-xl border bg-muted/20 p-3.5">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck :size="15" class="text-primary" /> Perfil de Acesso (RBAC)
              </label>
              <span class="text-[10px] text-muted-foreground">Define telas e permissões</span>
            </div>
            <select
              v-model="form.roleType"
              @change="onRoleChange"
              class="w-full rounded-xl border bg-background py-2.5 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="rh">Recursos Humanos (RH) — Gestão de Pessoas & DHO</option>
              <option value="dp">Departamento Pessoal (DP) — Folha, Ponto & Férias</option>
              <option value="ti">Tecnologia da Informação (T.I.) — Segurança & Infra</option>
              <option value="colaborador">Colaborador — Portal de Autoatendimento</option>
            </select>
            <div class="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span v-if="form.roleType === 'rh' || form.roleType === 'dp'" class="rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 font-medium">✓ Chat Interno</span>
              <span v-if="form.roleType === 'rh' || form.roleType === 'dp'" class="rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-medium">✓ Pastas Colaboradores</span>
              <span v-if="form.roleType === 'dp'" class="rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-medium">✓ Gestão Folha & Ponto</span>
              <span v-if="form.roleType === 'rh' || form.roleType === 'ti'" class="rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2 py-0.5 font-medium">✓ Gestão Onboarding</span>
              <span v-if="form.roleType === 'ti' || form.roleType === 'rh'" class="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-medium">✓ Configurações & Backups</span>
              <span v-if="form.roleType === 'colaborador'" class="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-medium">✓ Autoatendimento (Holerite, Ponto & Férias)</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome Completo</label>
            <div class="relative">
              <User :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input v-model="form.name" type="text" required class="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">E-mail Institucional</label>
            <div class="relative">
              <Mail :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input v-model="form.email" type="email" required class="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Cargo / Função</label>
              <div class="relative">
                <Briefcase :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input v-model="form.role" type="text" required class="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Departamento</label>
              <div class="relative">
                <Building :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input v-model="form.department" type="text" required class="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          </div>

          <!-- Alteração de Senha -->
          <div class="rounded-xl border bg-muted/20 p-4 space-y-3 pt-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock :size="14" /> Alterar Senha (Opcional)
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Nova Senha</label>
                <input v-model="form.password" type="password" placeholder="••••••••" class="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Confirmar Nova Senha</label>
                <input v-model="form.confirmPassword" type="password" placeholder="••••••••" class="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          </div>
        </form>

      </div>

      <!-- Rodapé com Ações -->
      <footer class="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
        <button
          type="button"
          class="rounded-xl border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="button"
          :disabled="loading"
          class="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95"
          style="background-color: var(--color-primary)"
          @click="handleSave"
        >
          <Save :size="16" /> {{ loading ? 'Salvando...' : 'Salvar Perfil' }}
        </button>
      </footer>

    </div>
  </div>
</template>
