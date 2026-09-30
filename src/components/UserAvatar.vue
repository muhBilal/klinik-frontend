<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: String, default: 'size-10' },
  text: { type: String, default: 'text-xs' },
})

/** Inisial nama sebagai cadangan bila belum ada foto (gelar dokter/perawat dilewati). */
const initials = computed(() =>
  (props.user?.name ?? '')
    .replace(/^(dr|drg|ns)\.?\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase(),
)
</script>

<template>
  <img
    v-if="user?.avatar"
    :src="user.avatar"
    :alt="`Foto ${user.name}`"
    :class="[size]"
    class="shrink-0 rounded-full object-cover ring-2 ring-white"
  />
  <span
    v-else
    :class="[size, text]"
    class="grid shrink-0 place-items-center rounded-full bg-brand-900 font-bold text-white ring-2 shadow-lg shadow-brand-900/30 ring-white"
    aria-hidden="true"
  >{{ initials }}</span>
</template>
