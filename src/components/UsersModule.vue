<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Search,
  Filter,
  Edit2,
  History,
  AlertTriangle,
  X,
  RefreshCw,
} from "lucide-vue-next"
import { apiFetch, showToast, currentUser } from "../store"

interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  department: string
  initials: string
  status: "active" | "inactive" | string
  created_at: string
  last_login?: string
}

interface AuditLog {
  id: string
  user_name: string
  user_role: string
  action: string
  entity: string
  entity_id?: string
  details?: any
  created_at: string
  ip_address?: string
}

const activeTab = ref<"users" | "audit">("users")
const users = ref<ManagedUser[]>([])
const auditLogs = ref<AuditLog[]>([])
const loading = ref(false)
const searchQuery = ref("")
const roleFilter = ref<string>("ALL")
const statusFilter = ref<string>("ALL")

// Modals
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showRoleModal = ref(false)
const showConfirmRoleModal = ref(false)

// Form states
const createForm = ref({
  name: "",
  email: "",
  role: "COLABORADOR",
  department: "Tecnologia",
  password: "",
})

const editingUser = ref<ManagedUser | null>(null)
const editForm = ref({
  name: "",
  department: "",
})

const roleTargetUser = ref<ManagedUser | null>(null)
const targetNewRole = ref<string>("COLABORADOR")

// Carregar Usuários
async function loadUsers() {
  loading.value = true
  try {
    const res = await apiFetch("/api/users")
    if (res.status === 403) {
      showToast("Acesso negado: apenas administradores podem visualizar esta lista.", "error")
      return
    }
    const data = await res.json()
    if (data.ok) {
      users.value = data.users || []
    } else {
      showToast(data.error || "Erro ao carregar usuários.", "error")
    }
  } catch (_e) {
    showToast("Falha de conexão com o servidor ao carregar usuários.", "error")
  } finally {
    loading.value = false
  }
}

// Carregar Auditoria
async function loadAuditLogs() {
  try {
    const res = await apiFetch("/api/users/audit")
    const data = await res.json()
    if (data.ok) {
      auditLogs.value = data.logs || []
    }
  } catch (_e) {
    console.error("Falha ao carregar logs de auditoria")
  }
}

onMounted(() => {
  loadUsers()
  loadAuditLogs()
})

// Filtragem
const filteredUsers = computed(() => {
  return users.value.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesRole =
      roleFilter.value === "ALL" ||
      u.role.toUpperCase() === roleFilter.value.toUpperCase()

    const matchesStatus =
      statusFilter.value === "ALL" ||
      (u.status || "active").toLowerCase() === statusFilter.value.toLowerCase()

    return matchesSearch && matchesRole && matchesStatus
  })
})

function getRoleBadge(role: string) {
  const upper = (role || "").toUpperCase()
  if (upper === "ADMIN") {
    return { label: "ADMIN", bg: "bg-rose-500/15 text-rose-300 border-rose-500/30" }
  }
  if (upper === "RH") {
    return { label: "RH", bg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" }
  }
  if (upper === "GESTOR") {
    return { label: "GESTOR", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
  }
  return { label: "COLABORADOR", bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
}

// Criar Usuário
async function handleCreateUser() {
  if (!createForm.value.name || !createForm.value.email) {
    showToast("Nome e e-mail são obrigatórios.", "warning")
    return
  }
  try {
    const res = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(createForm.value),
    })
    const data = await res.json()
    if (data.ok) {
      showToast("Usuário cadastrado com sucesso!", "success")
      showCreateModal.value = false
      createForm.value = {
        name: "",
        email: "",
        role: "COLABORADOR",
        department: "Tecnologia",
        password: "",
      }
      loadUsers()
      loadAuditLogs()
    } else {
      showToast(data.error || "Erro ao cadastrar usuário.", "error")
    }
  } catch (_e) {
    showToast("Falha na comunicação com o servidor.", "error")
  }
}

// Abrir Edição
function openEditModal(u: ManagedUser) {
  editingUser.value = u
  editForm.value = {
    name: u.name,
    department: u.department,
  }
  showEditModal.value = true
}

// Salvar Edição
async function handleSaveEdit() {
  if (!editingUser.value) return
  try {
    const res = await apiFetch(`/api/users/${editingUser.value.id}`, {
      method: "PUT",
      body: JSON.stringify(editForm.value),
    })
    const data = await res.json()
    if (data.ok) {
      showToast("Dados do usuário atualizados com sucesso!", "success")
      showEditModal.value = false
      loadUsers()
      loadAuditLogs()
    } else {
      showToast(data.error || "Erro ao salvar alterações.", "error")
    }
  } catch (_e) {
    showToast("Erro na requisição ao atualizar usuário.", "error")
  }
}

// Abrir Modal de Alteração de Role
function openRoleModal(u: ManagedUser) {
  roleTargetUser.value = u
  targetNewRole.value = u.role.toUpperCase()
  showRoleModal.value = true
}

// Confirmar Alteração de Role
function prepareRoleConfirmation() {
  if (!roleTargetUser.value) return
  if (roleTargetUser.value.role.toUpperCase() === targetNewRole.value.toUpperCase()) {
    showToast("A função selecionada é igual à atual.", "info")
    return
  }
  showRoleModal.value = false
  showConfirmRoleModal.value = true
}

async function executeRoleChange() {
  if (!roleTargetUser.value) return
  try {
    const res = await apiFetch(`/api/users/${roleTargetUser.value.id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: targetNewRole.value }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`Função de ${roleTargetUser.value.name} alterada para ${data.role}!`, "success")
      showConfirmRoleModal.value = false
      roleTargetUser.value = null
      loadUsers()
      loadAuditLogs()
    } else {
      showToast(data.error || "Erro ao alterar função.", "error")
    }
  } catch (_e) {
    showToast("Falha ao comunicar com o servidor.", "error")
  }
}

// Ativar / Desativar Usuário
async function toggleUserStatus(u: ManagedUser) {
  const currentStatus = (u.status || "active").toLowerCase()
  const newStatus = currentStatus === "active" ? "inactive" : "active"
  const actionText = newStatus === "active" ? "reativar" : "desativar"

  if (u.id === currentUser.value?.id && newStatus === "inactive") {
    showToast("Ação bloqueada: você não pode desativar seu próprio usuário.", "warning")
    return
  }

  if (!confirm(`Deseja realmente ${actionText} o acesso do usuário ${u.name}?`)) {
    return
  }

  try {
    const res = await apiFetch(`/api/users/${u.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`Usuário ${u.name} foi ${newStatus === "active" ? "reativado" : "desativado"}.`, "success")
      loadUsers()
      loadAuditLogs()
    } else {
      showToast(data.error || "Erro ao atualizar status.", "error")
    }
  } catch (_e) {
    showToast("Falha de rede ao alterar status do usuário.", "error")
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
    <!-- Header -->
    <header class="p-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
            <Shield class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Gestão de Usuários & Acessos (RBAC)
              <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                Apenas ADMIN
              </span>
            </h1>
            <p class="text-xs text-slate-400">Controle de permissões baseado em funções, status cadastral e trilha de auditoria</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Tab Selector -->
        <div class="flex p-1 bg-slate-800/70 border border-slate-700/60 rounded-xl">
          <button
            @click="activeTab = 'users'"
            :class="[
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'users' ? 'bg-teal-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            ]"
          >
            <Users class="w-3.5 h-3.5" />
            Usuários ({{ users.length }})
          </button>
          <button
            @click="activeTab = 'audit'"
            :class="[
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'audit' ? 'bg-teal-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            ]"
          >
            <History class="w-3.5 h-3.5" />
            Auditoria ({{ auditLogs.length }})
          </button>
        </div>

        <button
          v-if="activeTab === 'users'"
          @click="showCreateModal = true"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-teal-500/20 cursor-pointer"
        >
          <UserPlus class="w-4 h-4" />
          Novo Usuário
        </button>

        <button
          @click="loadUsers(); loadAuditLogs()"
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60 cursor-pointer"
          title="Recarregar"
        >
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
        </button>
      </div>
    </header>

    <!-- TAB 1: Usuários -->
    <div v-if="activeTab === 'users'" class="flex-1 flex flex-col p-6 overflow-hidden space-y-4">
      <!-- Search & Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[240px]">
          <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nome, e-mail ou departamento..."
            class="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div class="flex items-center gap-2">
          <Filter class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            v-model="roleFilter"
            class="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">Todas as Funções</option>
            <option value="ADMIN">ADMIN</option>
            <option value="RH">RH</option>
            <option value="GESTOR">GESTOR</option>
            <option value="COLABORADOR">COLABORADOR</option>
          </select>

          <select
            v-model="statusFilter"
            class="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      <!-- Users Table Card -->
      <div class="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-xl">
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider">
                <th class="py-3 px-4">Usuário</th>
                <th class="py-3 px-4">Função / Role</th>
                <th class="py-3 px-4">Departamento</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Criado em</th>
                <th class="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-300">
              <tr
                v-for="u in filteredUsers"
                :key="u.id"
                class="hover:bg-slate-800/40 transition-colors group"
              >
                <!-- User Info -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-teal-400">
                      {{ u.initials || u.name.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-semibold text-white flex items-center gap-1.5">
                        {{ u.name }}
                        <span v-if="u.id === currentUser?.id" class="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-400 font-medium">Você</span>
                      </div>
                      <div class="text-[11px] text-slate-400">{{ u.email }}</div>
                    </div>
                  </div>
                </td>

                <!-- Role Badge -->
                <td class="py-3.5 px-4">
                  <span :class="['px-2.5 py-1 rounded-md text-[11px] font-bold border inline-flex items-center gap-1', getRoleBadge(u.role).bg]">
                    <ShieldCheck class="w-3 h-3" />
                    {{ getRoleBadge(u.role).label }}
                  </span>
                </td>

                <!-- Department -->
                <td class="py-3.5 px-4 text-slate-300">
                  {{ u.department || 'Geral' }}
                </td>

                <!-- Status -->
                <td class="py-3.5 px-4">
                  <span
                    v-if="(u.status || 'active').toLowerCase() === 'active'"
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Ativo
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Inativo
                  </span>
                </td>

                <!-- Created / Login -->
                <td class="py-3.5 px-4 text-slate-400 text-[11px]">
                  {{ u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-' }}
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      @click="openEditModal(u)"
                      class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700/60 cursor-pointer"
                      title="Editar Dados Básicos"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>

                    <button
                      @click="openRoleModal(u)"
                      class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-medium transition-colors border border-indigo-500/30 cursor-pointer flex items-center gap-1"
                      title="Alterar Função / Role"
                    >
                      <Shield class="w-3.5 h-3.5" />
                      Função
                    </button>

                    <button
                      @click="toggleUserStatus(u)"
                      :disabled="u.id === currentUser?.id"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer',
                        (u.status || 'active').toLowerCase() === 'active'
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 disabled:opacity-40'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      ]"
                      :title="(u.status || 'active').toLowerCase() === 'active' ? 'Desativar Usuário' : 'Ativar Usuário'"
                    >
                      {{ (u.status || 'active').toLowerCase() === 'active' ? 'Desativar' : 'Reativar' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredUsers.length === 0">
                <td colspan="6" class="py-12 text-center text-slate-500">
                  Nenhum usuário encontrado com os filtros selecionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: Trilha de Auditoria -->
    <div v-else class="flex-1 flex flex-col p-6 overflow-hidden space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <History class="w-4 h-4 text-teal-400" />
          Registros Recentes de Auditoria de Acessos & Permissões
        </h2>
        <span class="text-xs text-slate-500">Persistência imutável de eventos críticos</span>
      </div>

      <div class="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-xl">
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider">
                <th class="py-3 px-4">Data / Hora</th>
                <th class="py-3 px-4">Usuário</th>
                <th class="py-3 px-4">Ação</th>
                <th class="py-3 px-4">Entidade</th>
                <th class="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-300">
              <tr v-for="log in auditLogs" :key="log.id" class="hover:bg-slate-800/30">
                <td class="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                  {{ new Date(log.created_at).toLocaleString('pt-BR') }}
                </td>
                <td class="py-3 px-4">
                  <div class="font-medium text-white">{{ log.user_name }}</div>
                  <div class="text-[10px] text-slate-500">{{ log.user_role }}</div>
                </td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-teal-300 border border-teal-500/20">
                    {{ log.action }}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">
                  {{ log.entity }} {{ log.entity_id ? `(${log.entity_id})` : '' }}
                </td>
                <td class="py-3 px-4 text-slate-400 text-[11px]">
                  <span v-if="log.details" class="font-mono text-slate-400">
                    {{ typeof log.details === 'object' ? JSON.stringify(log.details) : log.details }}
                  </span>
                  <span v-else class="text-slate-600">-</span>
                </td>
              </tr>

              <tr v-if="auditLogs.length === 0">
                <td colspan="5" class="py-12 text-center text-slate-500">
                  Nenhum log de auditoria registrado até o momento.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL 1: Novo Usuário -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <UserPlus class="w-5 h-5 text-teal-400" />
            <h2 class="text-lg font-bold text-white">Cadastrar Novo Usuário</h2>
          </div>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreateUser" class="space-y-4 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Nome Completo *</label>
            <input
              v-model="createForm.name"
              type="text"
              required
              placeholder="Ex: Beatriz Lima"
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">E-mail Corporativo *</label>
            <input
              v-model="createForm.email"
              type="email"
              required
              placeholder="beatriz.lima@peoplehub.com.br"
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">Função / Perfil RBAC *</label>
              <select
                v-model="createForm.role"
                class="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
              >
                <option value="ADMIN">ADMIN (Acesso Total)</option>
                <option value="RH">RH (Gestão Funcional & Folha)</option>
                <option value="GESTOR">GESTOR (Gestão de Equipe)</option>
                <option value="COLABORADOR">COLABORADOR (Autoatendimento)</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-400 mb-1 font-medium">Departamento *</label>
              <input
                v-model="createForm.department"
                type="text"
                required
                placeholder="Ex: Tecnologia"
                class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">Senha Inicial (opcional)</label>
            <input
              v-model="createForm.password"
              type="password"
              placeholder="Deixe em branco para gerar senha temporária segura"
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
            />
            <p class="text-[10px] text-slate-500 mt-1">Se não preenchida, o sistema gera uma senha aleatória segura.</p>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              @click="showCreateModal = false"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              Cadastrar Usuário
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: Editar Usuário -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <Edit2 class="w-4 h-4 text-teal-400" />
            Editar Usuário: {{ editingUser?.name }}
          </h2>
          <button @click="showEditModal = false" class="text-slate-400 hover:text-white cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleSaveEdit" class="space-y-4 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Nome Completo</label>
            <input
              v-model="editForm.name"
              type="text"
              required
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">Departamento</label>
            <input
              v-model="editForm.department"
              type="text"
              required
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              @click="showEditModal = false"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 3: Selecionar Nova Função / Role -->
    <div v-if="showRoleModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <Shield class="w-5 h-5 text-indigo-400" />
            Alterar Função de {{ roleTargetUser?.name }}
          </h2>
          <button @click="showRoleModal = false" class="text-slate-400 hover:text-white cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <p class="text-slate-400 leading-relaxed">
            Selecione o novo nível de acesso RBAC a ser concedido ao usuário. A alteração terá efeito imediato em todas as rotas da plataforma.
          </p>

          <div class="space-y-2">
            <label
              :class="[
                'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                targetNewRole === 'ADMIN' ? 'bg-rose-500/10 border-rose-500/40 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              ]"
            >
              <div class="flex items-center gap-3">
                <input type="radio" v-model="targetNewRole" value="ADMIN" class="accent-rose-500" />
                <div>
                  <div class="font-bold text-rose-400">ADMIN</div>
                  <div class="text-[11px] text-slate-400">Acesso irrestrito a configurações, auditoria e usuários.</div>
                </div>
              </div>
            </label>

            <label
              :class="[
                'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                targetNewRole === 'RH' ? 'bg-indigo-500/10 border-indigo-500/40 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              ]"
            >
              <div class="flex items-center gap-3">
                <input type="radio" v-model="targetNewRole" value="RH" class="accent-indigo-500" />
                <div>
                  <div class="font-bold text-indigo-400">RH</div>
                  <div class="text-[11px] text-slate-400">Gestão completa de colaboradores, férias, documentos e folha.</div>
                </div>
              </div>
            </label>

            <label
              :class="[
                'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                targetNewRole === 'GESTOR' ? 'bg-amber-500/10 border-amber-500/40 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              ]"
            >
              <div class="flex items-center gap-3">
                <input type="radio" v-model="targetNewRole" value="GESTOR" class="accent-amber-500" />
                <div>
                  <div class="font-bold text-amber-400">GESTOR</div>
                  <div class="text-[11px] text-slate-400">Visualização da equipe, escalas de trabalho e aprovação de chamados.</div>
                </div>
              </div>
            </label>

            <label
              :class="[
                'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                targetNewRole === 'COLABORADOR' ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              ]"
            >
              <div class="flex items-center gap-3">
                <input type="radio" v-model="targetNewRole" value="COLABORADOR" class="accent-emerald-500" />
                <div>
                  <div class="font-bold text-emerald-400">COLABORADOR</div>
                  <div class="text-[11px] text-slate-400">Autoatendimento, consulta de ponto, contracheques e solicitações.</div>
                </div>
              </div>
            </label>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-800">
            <button
              @click="showRoleModal = false"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              @click="prepareRoleConfirmation"
              class="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              Prosseguir
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 4: Confirmação Explícita de Segurança (Role Change) -->
    <div v-if="showConfirmRoleModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div class="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-center">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle class="w-7 h-7" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-bold text-white">Confirmação de Segurança</h3>
          <p class="text-xs text-slate-300 leading-relaxed">
            Atenção: alterar a função deste usuário modificará imediatamente todas as permissões dele de
            <span class="font-bold text-white">"{{ roleTargetUser?.role }}"</span> para
            <span class="font-bold text-amber-400">"{{ targetNewRole }}"</span>.
          </p>
          <p class="text-[11px] text-slate-400">
            Esta ação é sensível e será gravada de forma permanente no registro de auditoria do sistema.
          </p>
        </div>

        <div class="pt-2 flex gap-3">
          <button
            @click="showConfirmRoleModal = false"
            class="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            @click="executeRoleChange"
            class="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            Sim, Alterar Função
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
