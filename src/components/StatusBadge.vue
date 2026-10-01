<script setup>
import { computed } from 'vue'

const props = defineProps({ status: { type: String, default: '' } })

// Pil solid bertulisan putih (gaya "Executed" / "Scheduled" pada referensi desain)
const ORANGE = 'bg-orange-600'
const INDIGO = 'bg-indigo-500'
const VIOLET = 'bg-violet-500'
const GREEN = 'bg-emerald-600'
const RED = 'bg-red-500'
const GRAY = 'bg-slate-500'

const MAP = {
  menunggu: ['Menunggu', ORANGE],
  diperiksa: ['Diperiksa', INDIGO],
  menunggu_pembayaran: ['Menunggu Bayar', VIOLET],
  selesai: ['Selesai', GREEN],
  batal: ['Batal', GRAY],
  diserahkan: ['Diserahkan', GREEN],
  belum_bayar: ['Belum Bayar', RED],
  lunas: ['Lunas', GREEN],
  aktif: ['Aktif', GREEN],
  // Informed consent
  disetujui: ['Disetujui', GREEN],
  ditolak: ['Ditolak', RED],
  dicabut: ['Dicabut', GRAY],
  // Persetujuan foto
  berlaku: ['Berlaku', GREEN],
  diganti: ['Diganti', GRAY],
  // Paket multi-sesi (status_efektif)
  menunggu_bayar: ['Menunggu Bayar', VIOLET],
  habis: ['Habis', GRAY],
  kedaluwarsa: ['Kedaluwarsa', RED],
  direfund: ['Direfund', GRAY],
  dialihkan: ['Dialihkan', GRAY],
  // Voucher & promo
  belum_mulai: ['Belum Mulai', INDIGO],
  berakhir: ['Berakhir', GRAY],
  kuota_habis: ['Kuota Habis', ORANGE],
  // Rencana perawatan gigi
  draf: ['Draf', ORANGE],
  dibatalkan: ['Dibatalkan', GRAY],
  rencana: ['Rencana', INDIGO],
  nonaktif: ['Nonaktif', GRAY],
  // Booking (F1-02)
  dijadwalkan: ['Dijadwalkan', INDIGO],
  dikonfirmasi: ['Dikonfirmasi', VIOLET],
  hadir: ['Hadir', GREEN],
  tidak_hadir: ['Tidak Hadir', RED],
  // Integrasi SATUSEHAT
  terkirim: ['Terkirim', GREEN],
  gagal: ['Gagal', RED],
  // WhatsApp
  wa_antre: ['Antre', ORANGE],
  wa_terkirim: ['Terkirim', INDIGO],
  wa_diterima: ['Diterima', VIOLET],
  wa_dibaca: ['Dibaca', GREEN],
  wa_gagal: ['Gagal', RED],
}

const badge = computed(() => MAP[props.status] ?? [props.status, GRAY])
</script>

<template>
  <span :class="badge[1]" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-sm">
    {{ badge[0] }}
  </span>
</template>
