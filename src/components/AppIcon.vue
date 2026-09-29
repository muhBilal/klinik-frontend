<script setup>
defineProps({
  path: { type: String, required: true },
  size: { type: String, default: 'size-5' },
})
</script>

<template>
  <svg :class="size" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" :d="path" />
  </svg>
</template>
