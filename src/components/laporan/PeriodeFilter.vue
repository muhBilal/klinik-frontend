<script setup>
/**
 * Filter periode laporan: tanggal mulai & selesai + pintasan (hari ini, 7 hari, bulan ini, bulan lalu). Emit `change` setelah berubah.
 */
import { isoTanggal } from '@/lib/format'

const mulai = defineModel('mulai', { type: String, required: true })
const selesai = defineModel('selesai', { type: String, required: true })
const emit = defineEmits(['change'])

const hari = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return isoTanggal(d)
}
const PINTASAN = [
  ['Hari ini', () => [hari(), hari()]],
  ['7 hari', () => [hari(-6), hari()]],
  ['Bulan ini', () => {
    const d = new Date()
    return [isoTanggal(new Date(d.getFullYear(), d.getMonth(), 1)), hari()]
  }],
  ['Bulan lalu', () => {
    const d = new Date()
    return [isoTanggal(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoTanggal(new Date(d.getFullYear(), d.getMonth(), 0))]
  }],
]

function pilih(fn) {
  ;[mulai.value, selesai.value] = fn()
  emit('change')
}
const aktif = (fn) => fn().join() === `${mulai.value},${selesai.value}`
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <div>
      <label class="label" for="lp-mulai">Dari</label>
      <input id="lp-mulai" v-model="mulai" type="date" class="input py-1.5" :max="selesai" @change="emit('change')" />
    </div>
    <div>
      <label class="label" for="lp-selesai">Sampai</label>
      <input id="lp-selesai" v-model="selesai" type="date" class="input py-1.5" :min="mulai" @change="emit('change')" />
    </div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="[label, fn] in PINTASAN"
        :key="label"
        type="button"
        class="btn btn-sm"
        :class="aktif(fn) ? 'btn-primary' : 'btn-secondary'"
        @click="pilih(fn)"
      >
        {{ label }}
      </button>
    </div>
  </div>
</template>
