<script setup>
/**
 * Slip komisi satu petugas untuk satu periode (PRD KM-03). Dipakai rekap (manajer) & "Komisi Saya" (petugas); dicetak lewat
 * `printElement('#slip-komisi')`. Tanda "DRAF" bila periode belum disetujui.
 */
import { computed } from 'vue'
import { PERAN_KOMISI, rupiah, tanggal, waktu } from '@/lib/format'
import { useKlinikStore } from '@/stores/klinik'

const props = defineProps({
  periode: { type: Object, required: true },
  petugas: { type: Object, required: true },
  barises: { type: Array, default: () => [] },
})
const klinik = useKlinikStore()

const total = computed(() => props.barises.reduce((s, b) => s + b.komisi, 0))
const perPeran = computed(() => {
  const peta = new Map()
  for (const b of props.barises) peta.set(b.peran, (peta.get(b.peran) ?? 0) + b.komisi)
  return [...peta]
})
const teksNilai = (b) => (b.jenis === 'persen' ? `${Number(b.nilai).toLocaleString('id-ID')}%` : b.jenis === 'nominal' ? rupiah(b.nilai) : '')
</script>

<template>
  <article id="slip-komisi" class="space-y-4 text-sm text-slate-800">
    <header class="flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
      <div>
        <p class="text-base font-bold">{{ klinik.nama }}<template v-if="periode.cabang"> · {{ periode.cabang.nama }}</template></p>
        <p class="text-xs text-slate-500">Slip Komisi & Jasa Medis</p>
      </div>
      <div class="text-right text-xs text-slate-500">
        <p class="font-semibold text-slate-700">{{ periode.nama }}</p>
        <p>{{ tanggal(periode.mulai) }} – {{ tanggal(periode.selesai) }}</p>
        <p v-if="periode.status !== 'disetujui'" class="font-bold text-rose-600">DRAF — belum disetujui</p>
      </div>
    </header>
    <p><b>{{ petugas.name }}</b></p>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr class="border-b border-slate-400 text-left"><th class="py-1">Tanggal</th><th>Uraian</th><th>Peran</th><th class="text-right">Dasar</th><th class="text-right">Nilai</th><th class="text-right">Komisi</th></tr>
        </thead>
        <tbody>
          <tr v-for="b in barises" :key="b.id" class="border-b border-slate-200 align-top">
            <td class="py-1 whitespace-nowrap">{{ tanggal(b.tanggal) }}</td>
            <td>{{ b.deskripsi }}</td>
            <td class="whitespace-nowrap">{{ PERAN_KOMISI[b.peran] ?? b.peran }}</td>
            <td class="text-right tabular-nums">{{ b.dasar ? rupiah(b.dasar) : '' }}</td>
            <td class="text-right tabular-nums">{{ teksNilai(b) }}</td>
            <td class="text-right tabular-nums" :class="{ 'text-rose-600': b.komisi < 0 }">{{ rupiah(b.komisi) }}</td>
          </tr>
          <tr v-if="!barises.length"><td colspan="6" class="py-3 text-center text-slate-400">Tidak ada komisi pada periode ini.</td></tr>
        </tbody>
        <tfoot>
          <tr v-for="[peran, n] in perPeran" :key="peran" class="text-slate-500">
            <td colspan="5" class="pt-1 text-right">{{ PERAN_KOMISI[peran] ?? peran }}</td><td class="pt-1 text-right tabular-nums">{{ rupiah(n) }}</td>
          </tr>
          <tr class="border-t border-slate-400 text-sm font-semibold"><td colspan="5" class="py-1 text-right">Total</td><td class="text-right tabular-nums">{{ rupiah(total) }}</td></tr>
        </tfoot>
      </table>
    </div>
    <p class="text-[11px] text-slate-500">
      Dasar perhitungan: {{ periode.dasar === 'bruto' ? 'harga sebelum diskon' : 'harga setelah diskon & promo' }}; sesi paket dihitung dari nilai per sesi.
      <template v-if="periode.disetujui_at"> Disetujui {{ waktu(periode.disetujui_at) }} oleh {{ periode.penyetuju?.name ?? '-' }}.</template>
    </p>
    <div class="grid grid-cols-2 gap-10 pt-6 text-center text-xs">
      <div><p class="h-14">Diterima oleh</p><p class="border-t border-slate-400 pt-1">{{ petugas.name }}</p></div>
      <div><p class="h-14">Disetujui oleh</p><p class="border-t border-slate-400 pt-1">{{ periode.penyetuju?.name ?? '' }}</p></div>
    </div>
  </article>
</template>
