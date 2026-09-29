<script setup>
import { progress } from '@/lib/progress'
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 print:hidden" aria-hidden="true">
    <div
      class="h-full bg-brand-500 shadow-[0_0_6px] shadow-brand-400 transition-[width,opacity] duration-200 ease-out"
      :style="{ width: `${progress.width}%`, opacity: progress.visible ? 1 : 0 }"
    />
  </div>
</template>
