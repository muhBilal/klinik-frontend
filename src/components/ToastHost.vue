<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const styles = {
  success: { badge: 'bg-brand-900 shadow-black/30', icon: 'M4.5 12.75l6 6 9-13.5' },
  error: { badge: 'bg-red-500 shadow-red-500/40', icon: 'M6 18L18 6M6 6l12 12' },
  info: { badge: 'bg-indigo-500 shadow-indigo-500/40', icon: 'M12 9v4.5m0 3h.008' },
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
        class="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-slate-700"
        role="status"
      >
        <span :class="styles[t.type].badge" class="mt-px grid size-5 shrink-0 place-items-center rounded-full text-white shadow-md">
          <svg class="size-3" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" :d="styles[t.type].icon" />
          </svg>
        </span>
        <span class="flex-1 leading-snug">{{ t.message }}</span>
        <button class="-mt-0.5 text-lg leading-none text-slate-400 hover:text-slate-600" aria-label="Tutup" @click="toast.dismiss(t.id)">&times;</button>
      </div>
    </TransitionGroup>
  </div>
</template>
