<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
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
  AlertCircle,
  X,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Check,
  Save,
  Eye,
  Lock,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-vue-next"
import { apiFetch, showToast, currentUser } from "../store"

interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  rawRole?: string
  department: string
  initials: string
  status: "active" | "inactive" | string
  created_at: string
  last_login?: string
  hasValidRole?: boolean
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

interface ModuleAction {
  actionKey: "view" | "create" | "edit" | "delete" | "approve" | "export" | "admin"
  actionLabel: string
  permission: string
}

interface ModuleGroup {
  moduleKey: string
  moduleTitle: string
  actions: ModuleAction[]
}

const activeTab = ref<"users" | "matrix" | "audit">("users")
const users = ref<ManagedUser[]>([])
const auditLogs = ref<AuditLog[]>([])
const loading = ref(false)
const searchQuery = ref("")
const roleFilter = ref<string>("ALL")
const statusFilter = ref<string>("ALL")

// Estado da Matriz de Permissões
const matrixRoles = ref<string[]>(["ADMIN", "RH", "DP", "GESTOR", "RECRUTADOR", "AUDITOR", "COLABORADOR"])
const selectedMatrixRole = ref<string>("RH")
const matrixGroups = ref<ModuleGroup[]>([])
const rolePermissionsMap = ref<Record<string, string[]>>({})
const matrixSaving = ref(false)
const showConfirmMatrixModal = ref(false)

// Estado da Inspeção de Permissões Efetivas
const selectedUserForInspection = ref<string>("")
const inspectedUserData = ref<any>(null)
const inspectingLoading = ref(false)
const overridePermissionInput = ref("")
const overrideGrantedInput = ref(true)

// Modais de Usuário
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
      showToast("Acesso negado: você não possui permissão para visualizar a lista de usuários.", "error")
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

// Carregar Matriz de Permissões
async function loadMatrix() {
  try {
    const res = await apiFetch("/api/users/roles/matrix")
    const data = await res.json()
    if (data.ok) {
      matrixGroups.value = data.groups || []
      rolePermissionsMap.value = data.matrix || {}
    }
  } catch (_e) {
    console.error("Falha ao carregar matriz de permissões")
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
  loadMatrix()
  loadAuditLogs()
})

// Filtragem de Usuários
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

// Paginação de Usuários
const currentPage = ref(1)
const itemsPerPage = ref(10)

const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / itemsPerPage.value)))
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredUsers.value.slice(start, start + itemsPerPage.value)
})

watch([searchQuery, roleFilter, statusFilter], () => {
  currentPage.value = 1
})

function clearUserFilters() {
  searchQuery.value = ""
  roleFilter.value = "ALL"
  statusFilter.value = "ALL"
  currentPage.value = 1
}

// Paginação de Auditoria
const auditCurrentPage = ref(1)
const auditItemsPerPage = ref(15)
const auditTotalPages = computed(() => Math.max(1, Math.ceil(auditLogs.value.length / auditItemsPerPage.value)))
const paginatedAuditLogs = computed(() => {
  const start = (auditCurrentPage.value - 1) * auditItemsPerPage.value
  return auditLogs.value.slice(start, start + auditItemsPerPage.value)
})

function getRoleBadge(role: string) {
  const upper = (role || "").toUpperCase()
  if (upper === "ADMIN") {
    return { label: "ADMIN", bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" }
  }
  if (upper === "RH") {
    return { label: "RH", bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" }
  }
  if (upper === "DP") {
    return { label: "DP", bg: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800" }
  }
  if (upper === "GESTOR") {
    return { label: "GESTOR", bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" }
  }
  if (upper === "RECRUTADOR") {
    return { label: "RECRUTADOR", bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" }
  }
  if (upper === "AUDITOR") {
    return { label: "AUDITOR", bg: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" }
  }
  return { label: "COLABORADOR", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" }
}

const roleDescriptions: Record<string, string> = {
  ADMIN: "Administrador da Plataforma: Gestão de usuários, concessão de permissões, logs e configurações sistêmicas.",
  RH: "Recursos Humanos: Gestão cadastral de colaboradores, folha, documentos, workflows, férias e admissões.",
  DP: "Departamento Pessoal: Rotinas burocráticas e legais, admissão, rescisão, cálculo de folha, ponto, férias, benefícios e SST.",
  GESTOR: "Gestor de Equipe: Acompanhamento e aprovações de solicitações, metas e avaliações dos subordinados diretos.",
  RECRUTADOR: "Recrutamento & Seleção (ATS): Publicação de vagas, gestão do pipeline de candidatos, entrevistas e scorecards.",
  AUDITOR: "Auditoria & Compliance: Visualização estrita de dados em todos os módulos, relatórios e trilha de auditoria (apenas leitura).",
  COLABORADOR: "Colaborador: Autoatendimento pessoal (próprios dados, solicitações, holerites, férias e calendário).",
}

// Permissões do perfil atualmente selecionado na matriz
const currentRolePermissions = computed({
  get: () => rolePermissionsMap.value[selectedMatrixRole.value] || [],
  set: (val: string[]) => {
    rolePermissionsMap.value[selectedMatrixRole.value] = val
  },
})

function hasMatrixPermission(perm: string): boolean {
  return currentRolePermissions.value.includes(perm)
}

function toggleMatrixPermission(perm: string) {
  // Salvaguarda visual para AUDITOR: não permitir mutações
  if (selectedMatrixRole.value === "AUDITOR") {
    const isMutation = perm.endsWith(".create") || perm.endsWith(".update") || perm.endsWith(".delete") || perm.endsWith(".manage") || perm.endsWith(".approve") || perm.endsWith(".reject")
    if (isMutation) {
      showToast("O perfil AUDITOR possui apenas permissões de leitura. Ações de modificação são bloqueadas.", "warning")
      return
    }
  }

  // Salvaguarda visual para ADMIN: permissões vitais
  if (selectedMatrixRole.value === "ADMIN") {
    const requiredAdminPerms = ["users.view", "users.manage_roles", "dashboard.view", "settings.update"]
    if (requiredAdminPerms.includes(perm) && hasMatrixPermission(perm)) {
      showToast(`A permissão '${perm}' é obrigatória para o perfil ADMIN e não pode ser desmarcada.`, "warning")
      return
    }
  }

  const perms = [...currentRolePermissions.value]
  const idx = perms.indexOf(perm)
  if (idx >= 0) {
    perms.splice(idx, 1)
  } else {
    perms.push(perm)
  }
  currentRolePermissions.value = perms
}

async function saveRolePermissions() {
  matrixSaving.value = true
  try {
    const res = await apiFetch(`/api/users/roles/${selectedMatrixRole.value}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions: currentRolePermissions.value }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`Matriz de permissões do perfil ${selectedMatrixRole.value} atualizada com sucesso!`, "success")
      showConfirmMatrixModal.value = false
      loadAuditLogs()
      if (selectedUserForInspection.value) {
        inspectUserPermissions(selectedUserForInspection.value)
      }
    } else {
      showToast(data.error || "Erro ao atualizar permissões do perfil.", "error")
    }
  } catch (_e) {
    showToast("Falha na comunicação com o servidor ao salvar matriz.", "error")
  } finally {
    matrixSaving.value = false
  }
}

// Inspecionar Permissões Efetivas de Usuário
async function inspectUserPermissions(userId: string) {
  if (!userId) {
    inspectedUserData.value = null
    return
  }
  inspectingLoading.value = true
  try {
    const res = await apiFetch(`/api/users/${userId}/effective-permissions`)
    const data = await res.json()
    if (data.ok) {
      inspectedUserData.value = data
    } else {
      showToast(data.error || "Erro ao consultar permissões do usuário.", "error")
    }
  } catch (_e) {
    showToast("Falha ao consultar permissões efetivas.", "error")
  } finally {
    inspectingLoading.value = false
  }
}

async function applyUserOverride(customUserId?: string, customPermission?: string, customGranted?: boolean) {
  const targetUserId = customUserId || selectedUserForInspection.value
  const targetPermission = customPermission || overridePermissionInput.value
  const targetGranted = customGranted !== undefined ? customGranted : overrideGrantedInput.value

  if (!targetUserId || !targetPermission) {
    showToast("Selecione um usuário e informe a permissão para override.", "warning")
    return
  }
  try {
    const res = await apiFetch(`/api/users/${targetUserId}/permissions`, {
      method: "POST",
      body: JSON.stringify({
        permission: targetPermission,
        granted: targetGranted,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(data.message || "Override aplicado com sucesso!", "success")
      if (!customPermission) {
        overridePermissionInput.value = ""
      }
      inspectUserPermissions(targetUserId)
      loadAuditLogs()
    } else {
      showToast(data.error || "Erro ao aplicar override.", "error")
    }
  } catch (_e) {
    showToast("Falha na comunicação com o servidor.", "error")
  }
}

// Validações e Estado de Submissão
const isSubmittingUser = ref(false)
const isSubmittingEdit = ref(false)
const isSubmittingRole = ref(false)
const createUserErrors = ref<Record<string, string>>({})
const editUserErrors = ref<Record<string, string>>({})

function validateCreateUser(): boolean {
  const errs: Record<string, string> = {}
  if (!createForm.value.name.trim()) {
    errs.name = "Nome completo é obrigatório."
  } else if (createForm.value.name.trim().length < 3) {
    errs.name = "O nome deve conter pelo menos 3 caracteres."
  }
  if (!createForm.value.email.trim()) {
    errs.email = "E-mail corporativo é obrigatório."
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.value.email.trim())) {
    errs.email = "Informe um endereço de e-mail válido (ex: usuario@empresa.com)."
  }
  if (!createForm.value.department.trim()) {
    errs.department = "Departamento é obrigatório."
  }
  createUserErrors.value = errs
  return Object.keys(errs).length === 0
}

function validateEditUser(): boolean {
  const errs: Record<string, string> = {}
  if (!editForm.value.name.trim()) {
    errs.name = "Nome completo é obrigatório."
  } else if (editForm.value.name.trim().length < 3) {
    errs.name = "O nome deve conter pelo menos 3 caracteres."
  }
  if (!editForm.value.department.trim()) {
    errs.department = "Departamento é obrigatório."
  }
  editUserErrors.value = errs
  return Object.keys(errs).length === 0
}

// Criar Usuário
async function handleCreateUser() {
  if (isSubmittingUser.value) return
  if (!validateCreateUser()) return
  isSubmittingUser.value = true
  try {
    const res = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(createForm.value),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      showToast(data.error || "Erro ao cadastrar usuário.", "error")
      return
    }
    showToast("Usuário cadastrado com sucesso!", "success")
    showCreateModal.value = false
    createForm.value = {
      name: "",
      email: "",
      role: "COLABORADOR",
      department: "Tecnologia",
      password: "",
    }
    createUserErrors.value = {}
    loadUsers()
    loadAuditLogs()
  } catch (err: any) {
    showToast("Falha na comunicação com o servidor: " + err.message, "error")
  } finally {
    isSubmittingUser.value = false
  }
}

// Abrir Edição
function openEditModal(u: ManagedUser) {
  editingUser.value = u
  editForm.value = {
    name: u.name,
    department: u.department,
  }
  editUserErrors.value = {}
  showEditModal.value = true
}

async function handleSaveEdit() {
  if (isSubmittingEdit.value || !editingUser.value) return
  if (!validateEditUser()) return
  isSubmittingEdit.value = true
  try {
    const res = await apiFetch(`/api/users/${editingUser.value.id}`, {
      method: "PUT",
      body: JSON.stringify(editForm.value),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      showToast(data.error || "Erro ao salvar alterações.", "error")
      return
    }
    showToast("Dados do usuário atualizados com sucesso!", "success")
    showEditModal.value = false
    editUserErrors.value = {}
    loadUsers()
    loadAuditLogs()
  } catch (err: any) {
    showToast("Erro na requisição ao atualizar usuário: " + err.message, "error")
  } finally {
    isSubmittingEdit.value = false
  }
}

// Abrir Modal de Alteração de Role
function openRoleModal(u: ManagedUser) {
  roleTargetUser.value = u
  targetNewRole.value = u.role.toUpperCase()
  showRoleModal.value = true
}

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
  if (isSubmittingRole.value || !roleTargetUser.value) return
  isSubmittingRole.value = true
  try {
    const res = await apiFetch(`/api/users/${roleTargetUser.value.id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: targetNewRole.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      showToast(data.error || "Erro ao alterar função.", "error")
      return
    }
    showToast(`Função de ${roleTargetUser.value.name} alterada para ${data.role}!`, "success")
    showConfirmRoleModal.value = false
    roleTargetUser.value = null
    loadUsers()
    loadAuditLogs()
  } catch (err: any) {
    showToast("Falha ao comunicar com o servidor: " + err.message, "error")
  } finally {
    isSubmittingRole.value = false
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
  <div class="h-full flex flex-col bg-background text-foreground overflow-hidden">
    <!-- Header Principal -->
    <header class="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 border-b border-border bg-card shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Shield class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex flex-wrap items-center gap-2">
              Gestão de Acessos & Governança RBAC
              <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                Apenas ADMIN
              </span>
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5">Controle de perfis, matriz granular de permissões por módulo e trilha de auditoria</p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <!-- Seletor de Abas -->
        <div class="flex p-1 bg-muted border border-border rounded-xl overflow-x-auto scrollbar-thin max-w-full">
          <button
            @click="activeTab = 'users'"
            :class="[
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
              activeTab === 'users' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Users class="w-3.5 h-3.5" />
            Usuários ({{ users.length }})
          </button>
          <button
            @click="activeTab = 'matrix'"
            :class="[
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
              activeTab === 'matrix' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Sliders class="w-3.5 h-3.5" />
            Matriz de Permissões
          </button>
          <button
            @click="activeTab = 'audit'"
            :class="[
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
              activeTab === 'audit' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <History class="w-3.5 h-3.5" />
            Auditoria ({{ auditLogs.length }})
          </button>
        </div>

        <button
          v-if="activeTab === 'users'"
          @click="showCreateModal = true"
          class="ph-btn-primary"
        >
          <UserPlus class="w-4 h-4" />
          Novo Usuário
        </button>

        <button
          @click="loadUsers(); loadMatrix(); loadAuditLogs()"
          class="ph-btn-secondary p-2"
          title="Recarregar dados"
        >
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
        </button>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- ABA 1: Usuários Cadastrados                                 -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'users'" class="flex-1 flex flex-col p-3.5 sm:p-6 lg:p-8 overflow-hidden space-y-4">
      <!-- Search & Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[240px]">
          <Search class="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nome, e-mail ou departamento..."
            class="ph-input w-full pl-10 pr-4 py-2 text-xs"
          />
        </div>

        <div class="flex items-center gap-2">
          <Filter class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <select
            v-model="roleFilter"
            class="ph-select px-3 py-2 text-xs"
          >
            <option value="ALL">Todas as Funções</option>
            <option value="ADMIN">ADMIN</option>
            <option value="RH">RH</option>
            <option value="DP">DP</option>
            <option value="GESTOR">GESTOR</option>
            <option value="RECRUTADOR">RECRUTADOR</option>
            <option value="AUDITOR">AUDITOR</option>
            <option value="COLABORADOR">COLABORADOR</option>
          </select>

          <select
            v-model="statusFilter"
            class="ph-select px-3 py-2 text-xs"
          >
            <option value="ALL">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      <!-- Tabela de Usuários -->
      <div class="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-2xs">
        <div class="overflow-x-auto flex-1 scrollbar-thin">
          <table class="w-full text-left text-xs border-collapse min-w-[700px]" aria-label="Tabela de usuários cadastrados e controle de acesso">
            <thead>
              <tr class="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider">
                <th scope="col" class="py-3 px-4">Usuário</th>
                <th scope="col" class="py-3 px-4">Função / Perfil RBAC</th>
                <th scope="col" class="py-3 px-4">Departamento</th>
                <th scope="col" class="py-3 px-4">Status</th>
                <th scope="col" class="py-3 px-4">Criado em</th>
                <th scope="col" class="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-foreground">
              <tr
                v-for="u in paginatedUsers"
                :key="u.id"
                class="hover:bg-muted/40 transition-colors group"
              >
                <!-- User Info -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                      {{ u.initials || u.name.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-semibold text-foreground flex items-center gap-1.5">
                        {{ u.name }}
                        <span v-if="u.id === currentUser?.id" class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Você</span>
                        <span v-if="u.hasValidRole === false" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-medium" title="Perfil legado ou não mapeado">Perfil Inválido</span>
                      </div>
                      <div class="text-[11px] text-muted-foreground">{{ u.email }}</div>
                    </div>
                  </div>
                </td>

                <!-- Role Badge -->
                <td class="py-3.5 px-4">
                  <span :class="['px-2.5 py-1 rounded-md text-[11px] font-bold border inline-flex items-center gap-1', getRoleBadge(u.role).bg]">
                    <ShieldCheck class="w-3 h-3" aria-hidden="true" />
                    {{ getRoleBadge(u.role).label }}
                  </span>
                </td>

                <!-- Department -->
                <td class="py-3.5 px-4 text-foreground">
                  {{ u.department || 'Geral' }}
                </td>

                <!-- Status -->
                <td class="py-3.5 px-4">
                  <span
                    v-if="(u.status || 'active').toLowerCase() === 'active'"
                    class="ph-badge-success"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
                    Ativo
                  </span>
                  <span
                    v-else
                    class="ph-badge-danger"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true"></span>
                    Inativo
                  </span>
                </td>

                <!-- Created -->
                <td class="py-3.5 px-4 text-muted-foreground text-[11px]">
                  {{ u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-' }}
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      @click="openEditModal(u)"
                      class="ph-btn-secondary p-1.5"
                      title="Editar Dados Básicos"
                      :aria-label="'Editar dados básicos de ' + u.name"
                    >
                      <Edit2 class="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      @click="openRoleModal(u)"
                      class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-1"
                      title="Alterar Função / Role"
                      :aria-label="'Alterar função de ' + u.name"
                    >
                      <Shield class="w-3.5 h-3.5" aria-hidden="true" />
                      Função
                    </button>

                    <button
                      type="button"
                      @click="toggleUserStatus(u)"
                      :disabled="u.id === currentUser?.id"
                      :class="[
                        'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer',
                        (u.status || 'active').toLowerCase() === 'active'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 disabled:opacity-40'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                      ]"
                      :title="(u.status || 'active').toLowerCase() === 'active' ? 'Desativar Usuário' : 'Ativar Usuário'"
                      :aria-label="((u.status || 'active').toLowerCase() === 'active' ? 'Desativar usuário ' : 'Reativar usuário ') + u.name"
                    >
                      {{ (u.status || 'active').toLowerCase() === 'active' ? 'Desativar' : 'Reativar' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredUsers.length === 0">
                <td colspan="6" class="py-12 text-center text-muted-foreground space-y-2">
                  <p>Nenhum usuário encontrado com os filtros selecionados.</p>
                  <button
                    v-if="searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'"
                    @click="clearUserFilters"
                    class="text-primary hover:underline text-xs cursor-pointer inline-flex items-center gap-1"
                  >
                    <RefreshCw class="w-3 h-3" />
                    Limpar filtros
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Barra de Paginação de Usuários -->
        <div v-if="filteredUsers.length > 0" class="px-4 py-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Mostrando <span class="font-semibold text-foreground">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> a
            <span class="font-semibold text-foreground">{{ Math.min(currentPage * itemsPerPage, filteredUsers.length) }}</span> de
            <span class="font-semibold text-foreground">{{ filteredUsers.length }}</span> usuários
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="currentPage--"
              :disabled="currentPage <= 1"
              class="ph-btn-secondary px-2.5 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
              Anterior
            </button>
            <span class="font-medium text-foreground px-2">
              Página {{ currentPage }} de {{ totalPages }}
            </span>
            <button
              @click="currentPage++"
              :disabled="currentPage >= totalPages"
              class="ph-btn-secondary px-2.5 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Próxima
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- ABA 2: Matriz de Acessos & Permissões RBAC                  -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'matrix'" class="flex-1 flex flex-col p-3.5 sm:p-6 lg:p-8 overflow-y-auto scrollbar-thin space-y-6">
      <!-- Seletor de Perfil na Matriz -->
      <div class="bg-card border border-border rounded-xl p-5 shadow-2xs space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-base font-bold text-foreground flex items-center gap-2">
              <Sliders class="w-4 h-4 text-primary" />
              Configuração da Matriz de Permissões por Função
            </h2>
            <p class="text-xs text-muted-foreground">Selecione o perfil que deseja configurar e marque as permissões concedidas por módulo e ação.</p>
          </div>

          <button
            @click="showConfirmMatrixModal = true"
            :disabled="matrixSaving"
            class="ph-btn-primary"
          >
            <Save class="w-4 h-4" />
            Salvar Permissões de {{ selectedMatrixRole }}
          </button>
        </div>

        <!-- Pills dos Perfis -->
        <div class="flex flex-wrap gap-2 pt-2 border-t border-border">
          <button
            v-for="role in matrixRoles"
            :key="role"
            @click="selectedMatrixRole = role"
            :class="[
              'px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-2',
              selectedMatrixRole === role
                ? 'bg-primary/10 border-primary text-primary shadow-2xs ring-1 ring-primary/30'
                : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border'
            ]"
          >
            <span :class="['w-2 h-2 rounded-full', selectedMatrixRole === role ? 'bg-primary' : 'bg-muted-foreground/50']"></span>
            {{ role }}
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {{ (rolePermissionsMap[role] || []).length }} perms
            </span>
          </button>
        </div>

        <!-- Descrição e Alertas do Perfil -->
        <div class="p-3.5 rounded-xl bg-muted/40 border border-border text-xs">
          <div class="text-foreground font-medium leading-relaxed">
            <span class="text-primary font-bold">Escopo do Perfil:</span>
            {{ roleDescriptions[selectedMatrixRole] }}
          </div>

          <!-- Banner para Auditor -->
          <div v-if="selectedMatrixRole === 'AUDITOR'" class="mt-2.5 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-[11px] flex items-center gap-2">
            <ShieldCheck class="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <span>Perfil Estritamente de Leitura: Usuários com papel de Auditor possuem somente permissões de visualização e exportação. Modificações são bloqueadas pelo servidor.</span>
          </div>

          <!-- Banner para Admin -->
          <div v-if="selectedMatrixRole === 'ADMIN'" class="mt-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-2">
            <Lock class="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>Permissões Críticas Protegidas: Permissões de gestão de usuários e acesso à administração não podem ser removidas do perfil ADMIN.</span>
          </div>
        </div>
      </div>

      <!-- Grid de Módulos da Matriz -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="group in matrixGroups"
          :key="group.moduleKey"
          class="bg-card border border-border rounded-xl p-4 shadow-2xs flex flex-col justify-between space-y-3"
        >
          <div>
            <div class="flex items-center justify-between border-b border-border pb-2.5">
              <h3 class="font-bold text-xs text-foreground tracking-wide flex items-center gap-1.5">
                {{ group.moduleTitle }}
              </h3>
              <span class="text-[10px] text-muted-foreground font-mono">
                {{ group.actions.filter(a => hasMatrixPermission(a.permission)).length }}/{{ group.actions.length }}
              </span>
            </div>

            <!-- Lista de Ações do Módulo -->
            <div class="mt-3 space-y-2">
              <div
                v-for="action in group.actions"
                :key="action.permission"
                @click="toggleMatrixPermission(action.permission)"
                :class="[
                  'p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2',
                  hasMatrixPermission(action.permission)
                    ? 'bg-primary/5 border-primary/30 text-foreground'
                    : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/40'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'text-[9px] uppercase font-bold px-1.5 py-0.5 rounded',
                      action.actionKey === 'view' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400' :
                      action.actionKey === 'create' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                      action.actionKey === 'edit' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                      action.actionKey === 'delete' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' :
                      action.actionKey === 'approve' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400' :
                      action.actionKey === 'export' ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' : 'bg-muted text-muted-foreground'
                    ]"
                  >
                    {{ action.actionKey }}
                  </span>
                  <span class="text-[11px] font-medium">{{ action.actionLabel }}</span>
                </div>

                <div
                  :class="[
                    'w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0',
                    hasMatrixPermission(action.permission)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-input text-transparent'
                  ]"
                >
                  <Check class="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Seção de Inspeção de Permissões Efetivas de Usuário -->
      <div class="bg-card border border-border rounded-xl p-5 shadow-2xs space-y-4 mt-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
              <Eye class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Inspecionar Permissões Efetivas por Usuário
            </h3>
            <p class="text-xs text-muted-foreground">Consulte exatamente quais permissões um colaborador possui ativas (herança do perfil + overrides manuais).</p>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto">
            <select
              v-model="selectedUserForInspection"
              @change="inspectUserPermissions(selectedUserForInspection)"
              class="ph-select px-3.5 py-2 text-xs w-full md:w-auto md:min-w-[260px]"
            >
              <option value="">Selecione um usuário para inspecionar...</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.name }} ({{ u.role }} - {{ u.email }})
              </option>
            </select>
          </div>
        </div>

        <!-- Detalhes do Usuário Inspecionado -->
        <div v-if="inspectedUserData" class="space-y-4 pt-3 border-t border-border">
          <div class="flex flex-wrap items-center justify-between p-3 rounded-xl bg-muted/30 border border-border gap-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center justify-center font-bold text-xs">
                {{ inspectedUserData.user.name.substring(0, 2).toUpperCase() }}
              </div>
              <div>
                <div class="font-bold text-xs text-foreground">{{ inspectedUserData.user.name }} ({{ inspectedUserData.user.email }})</div>
                <div class="text-[11px] text-muted-foreground">Perfil Base: <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ inspectedUserData.user.role }}</span> | Permissões Efetivas Ativas: <span class="font-bold text-primary">{{ inspectedUserData.effectivePermissions.length }}</span></div>
              </div>
            </div>

            <!-- Adicionar Override Individual -->
            <div class="flex items-center gap-2">
              <input
                v-model="overridePermissionInput"
                type="text"
                placeholder="Ex: recruitment.manage"
                class="ph-input px-3 py-1.5 text-xs"
              />
              <select
                v-model="overrideGrantedInput"
                class="ph-select px-2.5 py-1.5 text-xs"
              >
                <option :value="true">Conceder (+)</option>
                <option :value="false">Revogar (-)</option>
              </select>
              <button
                @click="applyUserOverride()"
                class="ph-btn-primary text-xs"
              >
                Salvar Override
              </button>
            </div>
          </div>

          <!-- Permissões Efetivas Tags -->
          <div>
            <div class="text-xs font-semibold text-muted-foreground mb-2">Permissões Efetivas Habilitadas:</div>
            <div class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-muted/30 rounded-xl border border-border">
              <span
                v-for="perm in inspectedUserData.effectivePermissions"
                :key="perm"
                class="px-2.5 py-1 rounded-md text-[10px] font-mono font-medium bg-card text-foreground border border-border flex items-center gap-1.5"
              >
                <CheckCircle2 class="w-3 h-3 text-primary" />
                {{ perm }}
              </span>
            </div>
          </div>

          <!-- Overrides Individuais Ativos -->
          <div v-if="inspectedUserData.overrides && inspectedUserData.overrides.length > 0">
            <div class="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">Overrides Individuais Configurados para este Usuário:</div>
            <div class="space-y-1">
              <div
                v-for="ov in inspectedUserData.overrides"
                :key="ov.permission"
                class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-card border border-border text-xs"
              >
                <div class="font-mono text-[11px] text-foreground">
                  {{ ov.permission }}
                  <span :class="['ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold', ov.granted ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400']">
                    {{ ov.granted ? 'CONCEDIDO MANUALMENTE' : 'REVOGADO MANUALMENTE' }}
                  </span>
                </div>
                <button
                  @click="applyUserOverride(inspectedUserData.user.id, ov.permission, !ov.granted)"
                  class="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Inverter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- ABA 3: Trilha de Auditoria & Segurança                      -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'audit'" class="flex-1 flex flex-col p-3.5 sm:p-6 lg:p-8 overflow-hidden space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-foreground flex items-center gap-2">
          <History class="w-4 h-4 text-primary" />
          Registros Recentes de Auditoria de Acessos & Permissões
        </h2>
        <span class="text-xs text-muted-foreground">Persistência imutável de eventos críticos</span>
      </div>

      <div class="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-2xs">
        <div class="overflow-x-auto flex-1 scrollbar-thin">
          <table class="w-full text-left text-xs border-collapse min-w-[650px]" aria-label="Registros recentes de auditoria de acessos e permissões">
            <thead>
              <tr class="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider">
                <th scope="col" class="py-3 px-4">Data / Hora</th>
                <th scope="col" class="py-3 px-4">Usuário</th>
                <th scope="col" class="py-3 px-4">Ação</th>
                <th scope="col" class="py-3 px-4">Entidade</th>
                <th scope="col" class="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-foreground">
              <tr v-for="log in paginatedAuditLogs" :key="log.id" class="hover:bg-muted/40 transition-colors">
                <td class="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                  {{ new Date(log.created_at).toLocaleString('pt-BR') }}
                </td>
                <td class="py-3 px-4">
                  <div class="font-medium text-foreground">{{ log.user_name }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ log.user_role }}</div>
                </td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    {{ log.action }}
                  </span>
                </td>
                <td class="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                  {{ log.entity }} {{ log.entity_id ? `(${log.entity_id})` : '' }}
                </td>
                <td class="py-3 px-4 text-muted-foreground text-[11px]">
                  <span v-if="log.details" class="font-mono text-muted-foreground break-all">
                    {{ typeof log.details === 'object' ? JSON.stringify(log.details) : log.details }}
                  </span>
                  <span v-else class="text-muted-foreground/60">-</span>
                </td>
              </tr>

              <tr v-if="auditLogs.length === 0">
                <td colspan="5" class="py-12 text-center text-muted-foreground">
                  Nenhum log de auditoria registrado até o momento.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Barra de Paginação de Auditoria -->
        <div v-if="auditLogs.length > 0" class="px-4 py-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Mostrando <span class="font-semibold text-foreground">{{ (auditCurrentPage - 1) * auditItemsPerPage + 1 }}</span> a
            <span class="font-semibold text-foreground">{{ Math.min(auditCurrentPage * auditItemsPerPage, auditLogs.length) }}</span> de
            <span class="font-semibold text-foreground">{{ auditLogs.length }}</span> registros
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="auditCurrentPage--"
              :disabled="auditCurrentPage <= 1"
              class="ph-btn-secondary px-2.5 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
              Anterior
            </button>
            <span class="font-medium text-foreground px-2">
              Página {{ auditCurrentPage }} de {{ auditTotalPages }}
            </span>
            <button
              @click="auditCurrentPage++"
              :disabled="auditCurrentPage >= auditTotalPages"
              class="ph-btn-secondary px-2.5 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Próxima
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAIS DO SISTEMA DE GESTÃO DE ACESSOS                      -->
    <!-- ═══════════════════════════════════════════════════════════ -->

    <!-- MODAL 1: Novo Usuário -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div class="bg-card border border-border rounded-2xl w-full max-w-lg p-4 sm:p-6 shadow-xl space-y-5 text-foreground max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <UserPlus class="w-5 h-5 text-primary" />
            <h2 class="text-lg font-bold text-foreground">Cadastrar Novo Usuário</h2>
          </div>
          <button @click="showCreateModal = false" class="text-muted-foreground hover:text-foreground cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreateUser" class="space-y-4 text-xs">
          <div>
            <label class="block text-muted-foreground mb-1 font-medium">Nome Completo *</label>
            <input
              id="user-create-name"
              v-model="createForm.name"
              type="text"
              placeholder="Ex: Beatriz Lima"
              :class="['ph-input w-full px-3.5 py-2.5 text-xs', createUserErrors.name ? 'border-rose-500 focus:ring-rose-500' : '']"
            />
            <p v-if="createUserErrors.name" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
              <AlertCircle :size="12" /> {{ createUserErrors.name }}
            </p>
          </div>

          <div>
            <label class="block text-muted-foreground mb-1 font-medium">E-mail Corporativo *</label>
            <input
              id="user-create-email"
              v-model="createForm.email"
              type="email"
              placeholder="beatriz.lima@peoplehub.com.br"
              :class="['ph-input w-full px-3.5 py-2.5 text-xs', createUserErrors.email ? 'border-rose-500 focus:ring-rose-500' : '']"
            />
            <p v-if="createUserErrors.email" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
              <AlertCircle :size="12" /> {{ createUserErrors.email }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-muted-foreground mb-1 font-medium">Função / Perfil RBAC *</label>
              <select
                v-model="createForm.role"
                class="ph-select w-full px-3 py-2.5 text-xs font-semibold"
              >
                <option value="ADMIN">ADMIN (Acesso Total)</option>
                <option value="RH">RH (Gestão Geral & Estratégica)</option>
                <option value="DP">DP (Departamento Pessoal, Folha & SST)</option>
                <option value="GESTOR">GESTOR (Gestão de Equipe)</option>
                <option value="RECRUTADOR">RECRUTADOR (Atração & Seleção ATS)</option>
                <option value="AUDITOR">AUDITOR (Leitura & Compliance)</option>
                <option value="COLABORADOR">COLABORADOR (Autoatendimento)</option>
              </select>
            </div>

            <div>
              <label class="block text-muted-foreground mb-1 font-medium">Departamento *</label>
              <input
                id="user-create-dept"
                v-model="createForm.department"
                type="text"
                placeholder="Ex: Tecnologia"
                :class="['ph-input w-full px-3.5 py-2.5 text-xs', createUserErrors.department ? 'border-rose-500 focus:ring-rose-500' : '']"
              />
              <p v-if="createUserErrors.department" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
                <AlertCircle :size="12" /> {{ createUserErrors.department }}
              </p>
            </div>
          </div>

          <div>
            <label class="block text-muted-foreground mb-1 font-medium">Senha Inicial (opcional)</label>
            <input
              v-model="createForm.password"
              type="password"
              placeholder="Deixe em branco para gerar senha temporária segura"
              class="ph-input w-full px-3.5 py-2.5 text-xs"
            />
            <p class="text-[10px] text-muted-foreground mt-1">Se não preenchida, o sistema gera uma senha aleatória segura.</p>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-border">
            <button
              type="button"
              @click="showCreateModal = false"
              class="ph-btn-secondary px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="ph-btn-primary px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              :disabled="isSubmittingUser"
            >
              <Loader2 v-if="isSubmittingUser" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isSubmittingUser ? 'Cadastrando...' : 'Cadastrar Usuário' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: Editar Usuário -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div class="bg-card border border-border rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-xl space-y-5 text-foreground max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h2 class="text-base font-bold text-foreground flex items-center gap-2">
            <Edit2 class="w-4 h-4 text-primary" />
            Editar Usuário: {{ editingUser?.name }}
          </h2>
          <button @click="showEditModal = false" class="text-muted-foreground hover:text-foreground cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleSaveEdit" class="space-y-4 text-xs">
          <div>
            <label class="block text-muted-foreground mb-1 font-medium">Nome Completo</label>
            <input
              v-model="editForm.name"
              type="text"
              :class="['ph-input w-full px-3.5 py-2.5 text-xs', editUserErrors.name ? 'border-rose-500 focus:ring-rose-500' : '']"
            />
            <p v-if="editUserErrors.name" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
              <AlertCircle :size="12" /> {{ editUserErrors.name }}
            </p>
          </div>

          <div>
            <label class="block text-muted-foreground mb-1 font-medium">Departamento</label>
            <input
              v-model="editForm.department"
              type="text"
              :class="['ph-input w-full px-3.5 py-2.5 text-xs', editUserErrors.department ? 'border-rose-500 focus:ring-rose-500' : '']"
            />
            <p v-if="editUserErrors.department" class="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
              <AlertCircle :size="12" /> {{ editUserErrors.department }}
            </p>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-border">
            <button
              type="button"
              @click="showEditModal = false"
              class="ph-btn-secondary px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="ph-btn-primary px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              :disabled="isSubmittingEdit"
            >
              <Loader2 v-if="isSubmittingEdit" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 3: Selecionar Nova Função / Role -->
    <div v-if="showRoleModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div class="bg-card border border-border rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-xl space-y-5 text-foreground max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h2 class="text-base font-bold text-foreground flex items-center gap-2">
            <Shield class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Alterar Função de {{ roleTargetUser?.name }}
          </h2>
          <button @click="showRoleModal = false" class="text-muted-foreground hover:text-foreground cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <p class="text-muted-foreground leading-relaxed">
            Selecione o novo nível de acesso RBAC a ser concedido ao usuário. A alteração terá efeito imediato em todas as rotas e permissões da plataforma.
          </p>

          <div class="space-y-2">
            <label
              v-for="roleOption in matrixRoles"
              :key="roleOption"
              :class="[
                'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                targetNewRole === roleOption ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 text-foreground font-semibold' : 'bg-card border-border text-foreground hover:border-primary/40'
              ]"
            >
              <div class="flex items-center gap-3">
                <input type="radio" v-model="targetNewRole" :value="roleOption" class="accent-indigo-600" />
                <div>
                  <div class="font-bold text-foreground">{{ roleOption }}</div>
                  <div class="text-[11px] text-muted-foreground">{{ roleDescriptions[roleOption] }}</div>
                </div>
              </div>
            </label>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-border">
            <button
              @click="showRoleModal = false"
              class="ph-btn-secondary px-4 py-2"
            >
              Cancelar
            </button>
            <button
              @click="prepareRoleConfirmation"
              class="ph-btn-primary px-5 py-2"
            >
              Prosseguir
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 4: Confirmação Explícita de Segurança (Role Change) -->
    <div v-if="showConfirmRoleModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div class="bg-card border border-amber-500/30 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-xl space-y-5 text-center text-foreground max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <AlertTriangle class="w-7 h-7" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-bold text-foreground">Confirmação de Segurança RBAC</h3>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Atenção: alterar a função deste usuário modificará imediatamente todas as permissões dele de
            <span class="font-bold text-foreground">"{{ roleTargetUser?.role }}"</span> para
            <span class="font-bold text-amber-600 dark:text-amber-400">"{{ targetNewRole }}"</span>.
          </p>
          <p class="text-[11px] text-muted-foreground">
            Esta ação é sensível e será gravada de forma permanente no registro de auditoria do sistema.
          </p>
        </div>

        <div class="pt-2 flex gap-3">
          <button
            @click="showConfirmRoleModal = false"
            class="flex-1 ph-btn-secondary py-2.5 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            @click="executeRoleChange"
            :disabled="isSubmittingRole"
            class="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Loader2 v-if="isSubmittingRole" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isSubmittingRole ? 'Alterando...' : 'Sim, Alterar Função' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 5: Confirmação de Alteração da Matriz de Permissões -->
    <div v-if="showConfirmMatrixModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div class="bg-card border border-primary/30 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-xl space-y-5 text-center text-foreground max-h-[90dvh] overflow-y-auto scrollbar-thin my-auto">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
          <Sliders class="w-7 h-7" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-bold text-foreground">Atualizar Matriz de Permissões</h3>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Você está prestes a atualizar as permissões do perfil
            <span class="font-bold text-primary">"{{ selectedMatrixRole }}"</span>. Todos os usuários associados a este cargo receberão este novo conjunto de permissões imediatamente.
          </p>
          <p class="text-[11px] text-muted-foreground">Total de permissões selecionadas: <span class="font-bold text-foreground">{{ currentRolePermissions.length }}</span></p>
        </div>

        <div class="pt-2 flex gap-3">
          <button
            @click="showConfirmMatrixModal = false"
            class="flex-1 ph-btn-secondary py-2.5 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            @click="saveRolePermissions"
            :disabled="matrixSaving"
            class="flex-1 ph-btn-primary py-2.5 text-xs font-bold disabled:opacity-50"
          >
            Confirmar e Salvar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
