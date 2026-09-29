<script setup>
/** Baris placeholder di dalam <tbody> saat data tabel pertama kali dimuat. */
defineProps({
  cols: { type: Number, required: true },
  rows: { type: Number, default: 5 },
})

// Lebar bervariasi tapi deterministik agar tidak terlihat seperti kotak seragam
const width = (r, c) => `${45 + ((r * 7 + c * 13) % 50)}%`
</script>

<template>
  <tr v-for="r in rows" :key="r" aria-hidden="true">
    <td v-for="c in cols" :key="c">
      <div class="h-4 animate-pulse rounded bg-slate-200/70" :style="{ width: width(r, c) }" />
    </td>
  </tr>
</template>
