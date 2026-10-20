<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  Sparkles,
  ShieldCheck,
  Calendar,
  Megaphone,
  Heart,
  Pin,
  Search,
  Plus,
  Send,
  Trash2,
  MapPin,
  Clock,
  X,
} from "lucide-vue-next"
import {
  feedPosts,
  feedCounts,
  fetchFeedPosts,
  createFeedPost,
  toggleFeedPostLike,
  deleteFeedPost,
  userPermissions,
  currentUser,
  type FeedPost,
} from "../store"

const selectedCategory = ref<string>("todos")
const searchQuery = ref("")
const showNewPostModal = ref(false)
const isSubmitting = ref(false)

const newPost = ref<{
  title: string
  content: string
  category: FeedPost["category"]
  priority: FeedPost["priority"]
  is_pinned: boolean
  event_date: string
  event_location: string
  tags: string
}>({
  title: "",
  content: "",
  category: "novidade",
  priority: "normal",
  is_pinned: false,
  event_date: "",
  event_location: "",
  tags: "",
})

onMounted(() => {
  fetchFeedPosts()
})

const categories = [
  { key: "todos", label: "Todos os Posts", icon: Sparkles },
  { key: "medida", label: "Medidas Corporativas", icon: ShieldCheck, badge: "🛡️" },
  { key: "novidade", label: "Novidades", icon: Sparkles, badge: "🎉" },
  { key: "evento", label: "Eventos Gerais", icon: Calendar, badge: "📅" },
  { key: "comunicado", label: "Comunicados", icon: Megaphone, badge: "📢" },
]

function setCategory(catKey: string) {
  selectedCategory.value = catKey
  fetchFeedPosts(catKey, searchQuery.value)
}

function handleSearch() {
  fetchFeedPosts(selectedCategory.value, searchQuery.value)
}

const filteredPosts = computed(() => {
  return feedPosts.value
})

function getCategoryConfig(category: string) {
  switch (category) {
    case "medida":
      return {
        label: "Medida Corporativa",
        class: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
        icon: ShieldCheck,
      }
    case "evento":
      return {
        label: "Evento Geral",
        class: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
        icon: Calendar,
      }
    case "comunicado":
      return {
        label: "Comunicado Oficial",
        class: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        icon: Megaphone,
      }
    case "novidade":
    default:
      return {
        label: "Novidade",
        class: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        icon: Sparkles,
      }
  }
}

async function handleCreatePost() {
  if (!newPost.value.title.trim() || !newPost.value.content.trim()) return
  isSubmitting.value = true
  const res = await createFeedPost(newPost.value)
  isSubmitting.value = false
  if (res.ok) {
    showNewPostModal.value = false
    newPost.value = {
      title: "",
      content: "",
      category: "novidade",
      priority: "normal",
      is_pinned: false,
      event_date: "",
      event_location: "",
      tags: "",
    }
  }
}

async function handleLike(post: FeedPost) {
  await toggleFeedPostLike(post.id)
}

async function handleDelete(postId: string) {
  if (confirm("Tem certeza que deseja remover esta publicação do Feed?")) {
    await deleteFeedPost(postId)
  }
}
</script>

<template>
  <div class="space-y-6">

    <!-- CABEÇALHO DO FEED -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border bg-card p-6 shadow-sm">
      <div class="space-y-1.5">
        <div class="flex items-center gap-2.5">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-xs">
            <Sparkles :size="22" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Feed Corporativo & Mural de Eventos
              </h2>
              <span class="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                Atualizado em Tempo Real
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              Acompanhe anúncios oficiais, novidades da empresa, medidas de melhoria adotadas pelo RH e a agenda de eventos gerais.
            </p>
          </div>
        </div>
      </div>

      <button
        v-if="userPermissions.isRH || userPermissions.isAdmin || userPermissions.isGestor"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-700 transition-all active:scale-95 cursor-pointer shrink-0"
        @click="showNewPostModal = true"
      >
        <Plus :size="16" />
        <span>Novo Comunicado / Evento</span>
      </button>
    </div>

    <!-- ABAS DE CATEGORIAS E BUSCA -->
    <div class="flex flex-col md:flex-row gap-3 items-center justify-between border-b pb-4">
      <!-- Pills de Filtro -->
      <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-thin w-full md:w-auto">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
          :class="selectedCategory === cat.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-card border text-muted-foreground hover:bg-muted'"
          @click="setCategory(cat.key)"
        >
          <component :is="cat.icon" :size="14" />
          <span>{{ cat.label }}</span>
          <span
            v-if="cat.key !== 'todos'"
            class="text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1"
            :class="selectedCategory === cat.key ? 'bg-white/20 text-white' : 'bg-muted text-foreground'"
          >
            {{ feedCounts[cat.key as keyof typeof feedCounts] || 0 }}
          </span>
        </button>
      </div>

      <!-- Campo de Pesquisa -->
      <div class="relative w-full md:w-72">
        <Search :size="15" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar no feed por palavra ou tag..."
          class="w-full rounded-xl border bg-card py-2 pl-9 pr-4 text-xs outline-none focus:ring-2 focus:ring-teal-500/40"
          @keyup.enter="handleSearch"
        />
      </div>
    </div>

    <!-- FEED TIMELINE -->
    <div v-if="filteredPosts.length === 0" class="rounded-3xl border bg-card p-12 text-center space-y-3">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Megaphone :size="28" />
      </div>
      <h3 class="font-bold text-foreground">Nenhuma publicação encontrada</h3>
      <p class="text-xs text-muted-foreground max-w-md mx-auto">
        Não há postagens na categoria selecionada no momento. Fique atento às próximas novidades do RH!
      </p>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="post in filteredPosts"
        :key="post.id"
        class="rounded-3xl border bg-card p-6 shadow-sm hover:border-teal-500/30 transition-all space-y-4 relative group"
        :class="{ 'border-teal-500/40 bg-teal-500/[0.02] ring-1 ring-teal-500/20': post.is_pinned }"
      >
        <!-- Topo do Card: Autor e Badges -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-white font-black text-xs shadow-xs">
              {{ (post.author_name || "RH").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-foreground">{{ post.author_name }}</span>
                <span class="text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded border">
                  {{ post.author_role }}
                </span>
              </div>
              <span class="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock :size="12" /> Publicado em {{ post.created_at.substring(0, 16) }}
              </span>
            </div>
          </div>

          <!-- Badges de Categoria e Pin -->
          <div class="flex items-center gap-2">
            <span
              v-if="post.is_pinned"
              class="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            >
              <Pin :size="11" /> Fixado
            </span>

            <span
              class="inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-bold"
              :class="getCategoryConfig(post.category).class"
            >
              <component :is="getCategoryConfig(post.category).icon" :size="12" />
              {{ getCategoryConfig(post.category).label }}
            </span>

            <button
              v-if="userPermissions.isAdmin || (userPermissions.isRH && post.author_id === currentUser?.id)"
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-red-500 cursor-pointer rounded"
              title="Excluir publicação"
              @click="handleDelete(post.id)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <!-- Conteúdo Principal -->
        <div class="space-y-2 text-xs">
          <h3 class="text-base font-black text-foreground tracking-tight leading-snug">
            {{ post.title }}
          </h3>
          <p class="text-foreground leading-relaxed whitespace-pre-wrap text-justify sm:text-left">
            {{ post.content }}
          </p>
        </div>

        <!-- Destaque para Eventos com Data & Local -->
        <div
          v-if="post.category === 'evento' && (post.event_date || post.event_location)"
          class="flex flex-wrap items-center gap-4 p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200"
        >
          <span v-if="post.event_date" class="flex items-center gap-1.5 font-bold">
            <Calendar :size="14" class="text-indigo-600" />
            Data do Evento: {{ post.event_date }}
          </span>
          <span v-if="post.event_location" class="flex items-center gap-1.5 font-semibold">
            <MapPin :size="14" class="text-indigo-600" />
            Local / Link: {{ post.event_location }}
          </span>
        </div>

        <!-- Tags e Interações -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs">
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="tag in (post.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)"
              :key="tag"
              class="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border"
            >
              #{{ tag }}
            </span>
          </div>

          <!-- Botão Curtir com feedback visual -->
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all cursor-pointer shadow-2xs"
              :class="post.liked_by_me ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30' : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="handleLike(post)"
            >
              <Heart :size="14" :class="{ 'fill-rose-500 text-rose-500': post.liked_by_me }" />
              <span>{{ post.likes_count }}</span>
              <span class="text-[11px] hidden sm:inline">{{ post.liked_by_me ? 'Curtido' : 'Curtir' }}</span>
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- MODAL DE NOVO COMUNICADO / EVENTO -->
    <div
      v-if="showNewPostModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-xl rounded-3xl border bg-card p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div class="flex items-center justify-between border-b pb-4">
          <div class="flex items-center gap-2.5">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
              <Megaphone :size="20" />
            </div>
            <div>
              <h3 class="text-base font-bold text-foreground">Publicar no Feed Corporativo</h3>
              <p class="text-xs text-muted-foreground">Compartilhe comunicados, novidades, medidas do RH ou eventos com toda a equipe.</p>
            </div>
          </div>
          <button @click="showNewPostModal = false" class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="handleCreatePost" class="space-y-4 text-xs">
          <div>
            <label class="font-bold text-foreground">Título do Anúncio *</label>
            <input
              v-model="newPost.title"
              type="text"
              required
              placeholder="Ex: 🎉 Lançamento do Programa de Apoio Emocional"
              class="w-full mt-1 rounded-xl border bg-card p-3 text-xs outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-foreground">Categoria *</label>
              <select
                v-model="newPost.category"
                class="w-full mt-1 rounded-xl border bg-card p-2.5 text-xs outline-none cursor-pointer focus:ring-2 focus:ring-teal-500/40"
              >
                <option value="novidade">🎉 Novidade</option>
                <option value="medida">🛡️ Medida Corporativa</option>
                <option value="evento">📅 Evento Geral</option>
                <option value="comunicado">📢 Comunicado Oficial</option>
              </select>
            </div>

            <div>
              <label class="font-bold text-foreground">Prioridade / Destaque</label>
              <select
                v-model="newPost.priority"
                class="w-full mt-1 rounded-xl border bg-card p-2.5 text-xs outline-none cursor-pointer focus:ring-2 focus:ring-teal-500/40"
              >
                <option value="normal">Normal</option>
                <option value="destaque">Destaque</option>
                <option value="urgente">Urgente / Importante</option>
              </select>
            </div>
          </div>

          <!-- Campos especiais para Eventos -->
          <div v-if="newPost.category === 'evento'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
            <div>
              <label class="font-bold text-indigo-950 dark:text-indigo-200">Data & Hora do Evento</label>
              <input
                v-model="newPost.event_date"
                type="text"
                placeholder="Ex: 05/10/2026 às 15:00"
                class="w-full mt-1 rounded-xl border bg-card p-2 text-xs outline-none"
              />
            </div>
            <div>
              <label class="font-bold text-indigo-950 dark:text-indigo-200">Local / Link do Evento</label>
              <input
                v-model="newPost.event_location"
                type="text"
                placeholder="Ex: Auditório ou Google Meet"
                class="w-full mt-1 rounded-xl border bg-card p-2 text-xs outline-none"
              />
            </div>
          </div>

          <div>
            <label class="font-bold text-foreground">Conteúdo da Publicação *</label>
            <textarea
              v-model="newPost.content"
              required
              rows="4"
              placeholder="Escreva a mensagem completa, detalhes da novidade, medida tomada ou instruções do evento..."
              class="w-full mt-1 rounded-xl border bg-card p-3 text-xs outline-none focus:ring-2 focus:ring-teal-500/40"
            ></textarea>
          </div>

          <div>
            <label class="font-bold text-foreground">Tags (separadas por vírgula)</label>
            <input
              v-model="newPost.tags"
              type="text"
              placeholder="Ex: DHO, Bem-Estar, Saúde, Benefícios"
              class="w-full mt-1 rounded-xl border bg-card p-2.5 text-xs outline-none"
            />
          </div>

          <!-- Fixar no topo -->
          <div class="flex items-center gap-2 pt-1">
            <input
              id="pin-post"
              v-model="newPost.is_pinned"
              type="checkbox"
              class="h-4 w-4 rounded text-teal-600 cursor-pointer"
            />
            <label for="pin-post" class="font-semibold text-foreground cursor-pointer">
              Fixar esta publicação no topo do Feed
            </label>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 font-bold hover:bg-muted cursor-pointer"
              @click="showNewPostModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-700 transition-all cursor-pointer shadow-md disabled:opacity-60"
            >
              <Send :size="14" />
              <span>{{ isSubmitting ? 'Publicando...' : 'Publicar no Feed' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>
