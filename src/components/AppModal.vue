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
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/20 p-4 backdrop-blur-sm sm:pt-16"
        @mousedown.self="open = false"
      >
        <div :class="size" class="glass-strong w-full motion-safe:animate-pop rounded-[1.75rem]" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 class="text-lg font-semibold tracking-tight text-slate-900">{{ title }}</h2>
            <button class="btn-icon size-9" aria-label="Tutup" @click="open = false">
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="p-6">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 rounded-b-[1.75rem] border-t border-line bg-white/50 px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
