<script setup>
/** Placeholder halaman detail: spinner saat memuat, pesan + tombol coba lagi bila gagal. */
import AppSpinner from '@/components/AppSpinner.vue'

defineProps({
  error: { type: String, default: '' },
  text: { type: String, default: 'Memuat data...' },
})
const emit = defineEmits(['retry'])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 text-center text-sm">
    <template v-if="error">
      <p class="max-w-md text-rose-600">{{ error }}</p>
      <button class="btn btn-secondary mt-4" @click="emit('retry')">Coba lagi</button>
    </template>
    <template v-else>
      <AppSpinner size="size-8" class="text-brand-600" />
      <p class="mt-3 text-slate-500">{{ text }}</p>
    </template>
  </div>
</template>
