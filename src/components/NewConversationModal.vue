<script setup lang="ts">
import { ref, watch } from "vue"
import { X, Send, User, Mail, Phone, Briefcase, Building, MessagesSquare, Users } from "lucide-vue-next"
import type { Topic } from "../data"
import { topicLabels } from "../data"
import { createConversation, employeeFolders } from "../store"

const emit = defineEmits<{
  (e: "close"): void
}>()

const selectedEmployeeId = ref("")
const name = ref("")
const email = ref("")
const phone = ref("")
const role = ref("Analista")
const department = ref("Recursos Humanos")
const topic = ref<Topic>("geral")
const initialMessage = ref("")

watch(selectedEmployeeId, (id) => {
  if (!id) return
  const emp = employeeFolders.value.find((f) => f.id === id)
  if (emp) {
    name.value = emp.name
    email.value = emp.email || `${emp.name.toLowerCase().replace(/\s+/g, ".")}@empresa.com`
    phone.value = emp.phone || "+55 11 99999-0000"
    role.value = emp.role
    department.value = emp.department
  }
})

function getInitials(str: string) {
  const parts = str.trim().split(" ")
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return str.slice(0, 2).toUpperCase() || "RH"
}

function submit() {
  if (!name.value.trim() || !initialMessage.value.trim()) return
  createConversation({
    name: name.value.trim(),
    initials: getInitials(name.value),
    channel: "interno",
    topic: topic.value,
    role: role.value.trim() || "Colaborador",
    department: department.value.trim() || "Geral",
    contactEmail: email.value.trim() || `${name.value.toLowerCase().replace(/\s+/g, ".")}@empresa.com`,
    contactPhone: phone.value.trim() || "+55 11 99999-0000",
    initialMessage: initialMessage.value.trim(),
  })
  emit("close")
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl transition-all">
      <div class="flex items-center justify-between border-b pb-4">
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessagesSquare :size="20" />
          </div>
          <div>
            <h2 class="text-lg font-bold">Novo Chat Interno</h2>
            <p class="text-xs text-muted-foreground">Inicie uma conversa interna direta com um colaborador</p>
          </div>
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <form @submit.prevent="submit" class="mt-4 space-y-4">
        <!-- Selecionar Colaborador da Empresa (Autopreenchimento) -->
        <div v-if="employeeFolders.length">
          <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Selecionar da Equipe (Opcional)
          </label>
          <div class="relative">
            <Users :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              v-model="selectedEmployeeId"
              class="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 cursor-pointer font-medium"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option value="">-- Selecionar colaborador cadastrado --</option>
              <option v-for="emp in employeeFolders" :key="emp.id" :value="emp.id">
                {{ emp.name }} · {{ emp.role }} ({{ emp.department }})
              </option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Nome do Colaborador *</label>
          <div class="relative">
            <User :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="name"
              type="text"
              required
              placeholder="ex: Amanda Rocha"
              class="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
              style="--tw-ring-color: var(--color-ring)"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">E-mail Corporativo</label>
            <div class="relative">
              <Mail :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="email"
                type="email"
                placeholder="amanda@empresa.com"
                class="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ramal / Telefone</label>
            <div class="relative">
              <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="phone"
                type="text"
                placeholder="Ramal 204 ou +55 11 9..."
                class="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Cargo</label>
            <div class="relative">
              <Briefcase :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="role"
                type="text"
                placeholder="Analista de RH"
                class="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Departamento</label>
            <div class="relative">
              <Building :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="department"
                type="text"
                placeholder="Recursos Humanos"
                class="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
                style="--tw-ring-color: var(--color-ring)"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Canal de Comunicação</label>
            <div class="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs font-bold text-foreground">
              <MessagesSquare :size="15" class="text-primary shrink-0" />
              <span>Chat Interno Corporativo</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Assunto / Tópico</label>
            <select
              v-model="topic"
              class="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-2 cursor-pointer"
              style="--tw-ring-color: var(--color-ring)"
            >
              <option v-for="(lbl, key) in topicLabels" :key="key" :value="key">{{ lbl }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Primeira Mensagem *</label>
          <textarea
            v-model="initialMessage"
            required
            rows="3"
            placeholder="Olá! Como podemos ajudar você hoje na equipe de RH?"
            class="w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 resize-none"
            style="--tw-ring-color: var(--color-ring)"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            class="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted cursor-pointer"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
            style="background-color: var(--color-primary)"
            :disabled="!name.trim() || !initialMessage.trim()"
          >
            <Send :size="16" /> Iniciar Chat Interno
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
