<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  initials: string
  size?: number
  online?: boolean
}>()

const dimension = computed(() => props.size ?? 44)

// Cor de fundo determinística a partir das iniciais (tons neutros/teal)
const palette = ["#0f766e", "#1e6091", "#7c5b3f", "#4b5563", "#8a4b6d", "#2c6e49"]
const bg = computed(() => {
  const sum = props.initials.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return palette[sum % palette.length]
})
</script>

<template>
  <div class="relative shrink-0" :style="{ width: dimension + 'px', height: dimension + 'px' }">
    <div
      class="flex h-full w-full items-center justify-center rounded-full font-semibold text-white select-none"
      :style="{ backgroundColor: bg, fontSize: dimension * 0.36 + 'px' }"
    >
      {{ initials }}
    </div>
    <span
      v-if="online"
      class="absolute bottom-0 right-0 block rounded-full ring-2 ring-card"
      :style="{
        backgroundColor: 'var(--color-success)',
        width: dimension * 0.28 + 'px',
        height: dimension * 0.28 + 'px',
      }"
      aria-label="Online"
    />
  </div>
</template>
