<script setup lang="ts">
import { computed } from "vue"
import { MessagesSquare } from "lucide-vue-next"
import type { Channel } from "../data"
import { channelColors, channelLabels } from "../data"

const props = defineProps<{
  channel?: Channel
  size?: number
  showRing?: boolean
}>()

const icon = computed(() => MessagesSquare)
const color = computed(() => props.channel ? channelColors[props.channel] || "var(--color-primary)" : "var(--color-primary)")
const label = computed(() => props.channel ? channelLabels[props.channel] || "Chat Interno" : "Chat Interno")
const dimension = computed(() => props.size ?? 18)
</script>

<template>
  <span
    class="flex items-center justify-center rounded-full text-white shrink-0 shadow-xs"
    :class="showRing ? 'ring-2 ring-card' : ''"
    :style="{
      backgroundColor: color,
      width: dimension + 'px',
      height: dimension + 'px',
    }"
    :title="label"
    :aria-label="label"
  >
    <component :is="icon" :size="Math.round(dimension * 0.58)" :stroke-width="2.2" />
  </span>
</template>
