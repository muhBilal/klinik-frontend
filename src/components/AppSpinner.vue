<script setup>
defineProps({
  size: { type: String, default: 'size-4' },
})
</script>

<template>
  <span :class="size" class="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" role="status" aria-label="Memuat" />
</template>
