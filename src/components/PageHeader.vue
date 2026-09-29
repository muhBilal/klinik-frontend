<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
    <div class="min-w-0">
      <h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
