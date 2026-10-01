<script setup>
/**
 * Slip komisi satu petugas satu periode (PRD KM-03). `data` = respons `GET /komisi/rincian`.
 * Dicetak lewat printElement('#slip-komisi').
 */
import { computed } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { rupiah, tanggal, waktu } from '@/lib/format'
import { useKlinikStore } from '@/stores/klinik'

const props = defineProps({ data: { type: Object, required: true } })
const klinik = useKlinikStore()

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const labelPeriode = computed(() => {
  const [y, m] = props.data.periode.split('-')
  return `${BULAN[Number(m) - 1]} ${y}`
})
const nama = computed(() => props.data.petugas?.[0]?.nama ?? '-')
const PERAN = { dokter: 'Dokter', terapis: 'Terapis', asisten: 'Asisten' }
const aturan = (r) => (r.jenis === 'persen' ? `${r.nilai_aturan}% × ${rupiah(r.dasar)}` : `${rupiah(r.nilai_aturan)} / tindakan`) + (r.dibagi > 1 ? ` ÷ ${r.dibagi}` : '')
</script>

<template>
  <div id="slip-komisi" class="space-y-3 text-sm">
    <div class="flex items-start justify-between gap-3 border-b border-dashed border-slate-300 pb-3">
      <div>
        <p class="font-semibold">{{ klinik.nama }}</p>
        <p class="text-xs text-slate-500">Slip komisi & jasa medis · {{ labelPeriode }}</p>
        <p class="mt-1 font-medium">{{ nama }}</p>
      </div>
      <div class="text-right">
        <StatusBadge :status="data.status === 'disetujui' ? 'disetujui' : 'draf'" />
        <p v-if="data.disetujui_oleh" class="mt-1 text-xs text-slate-500">oleh {{ data.disetujui_oleh }}, {{ waktu(data.disetujui_at) }}</p>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="table">
        <thead><tr><th>Tanggal</th><th>Pasien / tagihan</th><th>Treatment</th><th>Peran</th><th>Perhitungan</th><th class="text-right">Komisi</th></tr></thead>
        <tbody>
          <tr v-for="r in data.rincian" :key="r.id" :class="{ 'text-rose-600': r.jumlah < 0 }">
            <td class="whitespace-nowrap text-xs">{{ tanggal(r.created_at) }}</td>
            <td class="text-xs">
              {{ r.tagihan?.pasien?.nama ?? '-' }}
              <span class="block text-slate-400">{{ r.tagihan?.no_tagihan }}<template v-if="r.sumber === 'refund'"> · refund</template></span>
            </td>
            <td>{{ r.tindakan?.nama ?? '-' }}</td>
            <td class="text-xs">{{ PERAN[r.peran] ?? r.peran }}</td>
            <td class="text-xs tabular-nums text-slate-600">{{ aturan(r) }}</td>
            <td class="text-right tabular-nums">{{ rupiah(r.jumlah) }}</td>
          </tr>
          <tr v-if="!data.rincian?.length"><td colspan="6" class="py-6 text-center text-slate-400">Belum ada komisi di periode ini.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="flex justify-between border-t border-line pt-2 text-base font-semibold">
      <span>Total komisi</span><span class="tabular-nums">{{ rupiah(data.total) }}</span>
    </div>
    <p v-if="data.status !== 'disetujui'" class="text-xs text-slate-500">Draf — angka bisa berubah sampai periode disetujui.</p>
  </div>
</template>
