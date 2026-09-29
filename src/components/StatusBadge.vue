<script setup>
import { computed } from 'vue'

const props = defineProps({ status: { type: String, default: '' } })

const MAP = {
  menunggu: ['Menunggu', 'bg-amber-50 text-amber-700 ring-amber-200'],
  diperiksa: ['Diperiksa', 'bg-sky-50 text-sky-700 ring-sky-200'],
  menunggu_pembayaran: ['Menunggu Bayar', 'bg-violet-50 text-violet-700 ring-violet-200'],
  selesai: ['Selesai', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  batal: ['Batal', 'bg-slate-100 text-slate-500 ring-slate-200'],
  diserahkan: ['Diserahkan', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  belum_bayar: ['Belum Bayar', 'bg-rose-50 text-rose-700 ring-rose-200'],
  lunas: ['Lunas', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  aktif: ['Aktif', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  nonaktif: ['Nonaktif', 'bg-slate-100 text-slate-500 ring-slate-200'],
}

const badge = computed(() => MAP[props.status] ?? [props.status, 'bg-slate-100 text-slate-600 ring-slate-200'])
</script>

<template>
  <span :class="badge[1]" class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset">
    {{ badge[0] }}
  </span>
</template>
