<script setup>
/**
 * Input nomor gigi FDI + permukaan (M/O/D/B/L) untuk tindakan per gigi & item rencana perawatan (PRD DG-02, DG-07).
 * `v-model:gigi` (angka | null), `v-model:permukaan` ('MO' | '' ); permukaan disembunyikan bila `tanpaPermukaan`.
 */
import { computed } from 'vue'
import { BARIS_GIGI, PERMUKAAN, labelPermukaan, normalPermukaan } from '@/lib/gigi'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  tanpaPermukaan: { type: Boolean, default: false },
  idInput: { type: String, default: undefined },
})
const gigi = defineModel('gigi', { default: null })
const permukaan = defineModel('permukaan', { default: '' })

const KELOMPOK = [
  ['Tetap · kanan atas', BARIS_GIGI[0].kiri], ['Tetap · kiri atas', BARIS_GIGI[0].kanan],
  ['Tetap · kiri bawah', BARIS_GIGI[3].kanan], ['Tetap · kanan bawah', BARIS_GIGI[3].kiri],
  ['Sulung · kanan atas', BARIS_GIGI[1].kiri], ['Sulung · kiri atas', BARIS_GIGI[1].kanan],
  ['Sulung · kiri bawah', BARIS_GIGI[2].kanan], ['Sulung · kanan bawah', BARIS_GIGI[2].kiri],
]

const nilaiGigi = computed({
  get: () => (gigi.value ? String(gigi.value) : ''),
  set: (v) => {
    gigi.value = v ? Number(v) : null
    if (!v) permukaan.value = ''
  },
})

function toggle(p) {
  const ada = (permukaan.value ?? '').includes(p)
  permukaan.value = normalPermukaan(ada ? permukaan.value.replace(p, '') : `${permukaan.value ?? ''}${p}`)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <select :id="idInput" v-model="nilaiGigi" class="input w-24 py-1 text-sm tabular-nums" :class="{ 'input-error': invalid }" :disabled="disabled" aria-label="Nomor gigi (FDI)">
      <option value="">Gigi</option>
      <optgroup v-for="[label, daftar] in KELOMPOK" :key="label" :label="label">
        <option v-for="g in [...daftar].sort((a, b) => a - b)" :key="g" :value="String(g)">{{ g }}</option>
      </optgroup>
    </select>
    <div v-if="!props.tanpaPermukaan && gigi" class="flex gap-0.5" role="group" aria-label="Permukaan gigi">
      <button
        v-for="p in PERMUKAAN"
        :key="p"
        type="button"
        :disabled="disabled"
        :class="(permukaan ?? '').includes(p) ? 'bg-brand-900 text-white' : 'bg-white/70 text-slate-500 hover:bg-white'"
        class="size-7 rounded-full text-[11px] font-semibold ring-1 ring-line"
        :aria-pressed="(permukaan ?? '').includes(p)"
        :title="labelPermukaan(Number(gigi), p)"
        @click="toggle(p)"
      >
        {{ p }}
      </button>
    </div>
  </div>
</template>
