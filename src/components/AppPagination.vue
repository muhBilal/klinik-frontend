<script setup>
defineProps({
  meta: { type: Object, default: null },
})
const emit = defineEmits(['change'])
</script>

<template>
  <div v-if="meta && meta.total > 0" class="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
    <span>Menampilkan {{ meta.from }}–{{ meta.to }} dari {{ meta.total }} data</span>
    <div v-if="meta.last_page > 1" class="flex items-center gap-1">
      <button class="btn btn-secondary btn-sm" :disabled="meta.current_page <= 1" @click="emit('change', meta.current_page - 1)">Sebelumnya</button>
      <span class="px-2">{{ meta.current_page }} / {{ meta.last_page }}</span>
      <button class="btn btn-secondary btn-sm" :disabled="meta.current_page >= meta.last_page" @click="emit('change', meta.current_page + 1)">Berikutnya</button>
    </div>
  </div>
</template>
