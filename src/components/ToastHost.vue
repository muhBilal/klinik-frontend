<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}
</script>

<template>
  <div class="pointer-events-none fixed top-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 print:hidden">
    <TransitionGroup
      enter-from-class="translate-x-4 opacity-0"
      enter-active-class="transition duration-200"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150"
    >
      <div
        v-for="t in toast.items"
        :key="t.id"
        :class="styles[t.type]"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-md"
        role="status"
      >
        <span class="flex-1">{{ t.message }}</span>
        <button class="text-current/60 hover:text-current" aria-label="Tutup" @click="toast.dismiss(t.id)">&times;</button>
      </div>
    </TransitionGroup>
  </div>
</template>
