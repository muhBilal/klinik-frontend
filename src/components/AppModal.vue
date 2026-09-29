<script setup>
import { onBeforeUnmount, watch } from 'vue'

const open = defineModel({ type: Boolean, default: false })

defineProps({
  title: { type: String, default: '' },
  size: { type: String, default: 'max-w-lg' },
})

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

watch(open, (value) => {
  if (value) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" enter-active-class="transition duration-150" leave-to-class="opacity-0" leave-active-class="transition duration-100">
      <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:pt-16" @mousedown.self="open = false">
        <div :class="size" class="w-full rounded-xl bg-white shadow-xl" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 class="font-semibold text-slate-800">{{ title }}</h2>
            <button class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup" @click="open = false">
              <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="p-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
