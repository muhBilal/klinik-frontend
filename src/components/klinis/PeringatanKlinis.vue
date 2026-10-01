<script setup>
/**
 * Peringatan klinis pasien (PRD PS-03): alergi, hamil/menyusui, tipe kulit Fitzpatrick, riwayat obat & penyakit.
 * `klinis` & `alergis` dari detail kunjungan (`pasien.klinis`, `pasien.alergis`) atau GET /pasiens/{id}/klinis. Slot = tombol aksi.
 */
import { computed } from 'vue'
import { FITZPATRICK, KEPARAHAN_ALERGI, STATUS_KEHAMILAN, tanggal } from '@/lib/format'

const props = defineProps({
  klinis: { type: Object, default: null },
  alergis: { type: Array, default: () => [] },
  jenisKelamin: { type: String, default: null },
  tanggalLahir: { type: String, default: null },
})

// Pengingat "belum ditanyakan" hanya untuk usia subur (12–55 th); status yang sudah tercatat selalu tampil.
const usiaSubur = computed(() => {
  if (!props.tanggalLahir) return true
  const usia = (Date.now() - new Date(props.tanggalLahir).getTime()) / (365.25 * 864e5)
  return usia >= 12 && usia <= 55
})

const keteranganAlergi = (a) => [a.keparahan && KEPARAHAN_ALERGI[a.keparahan], a.reaksi].filter(Boolean).join(' — ')
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs" data-peringatan-klinis>
    <span
      v-for="a in alergis"
      :key="a.id ?? a.zat"
      class="rounded-full bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-700 ring-1 ring-rose-400/30"
      :title="keteranganAlergi(a)"
    >
      ⚠ Alergi {{ a.zat }}<template v-if="keteranganAlergi(a)"> · {{ keteranganAlergi(a) }}</template>
    </span>
    <span v-if="!alergis.length" class="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-500">Alergi: belum ada catatan</span>

    <template v-if="jenisKelamin === 'P'">
      <span
        v-if="['hamil', 'menyusui'].includes(klinis?.status_kehamilan)"
        class="rounded-full px-2.5 py-1 font-semibold ring-1"
        :class="klinis.status_kehamilan === 'hamil' ? 'bg-rose-500/10 text-rose-700 ring-rose-400/30' : 'bg-amber-500/15 text-amber-800 ring-amber-400/30'"
      >
        ⚠ {{ STATUS_KEHAMILAN[klinis.status_kehamilan] }} · dicatat {{ tanggal(klinis.status_kehamilan_at) }}
      </span>
      <span v-else-if="klinis?.status_kehamilan === 'tidak'" class="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-600">
        Tidak hamil/menyusui · {{ tanggal(klinis.status_kehamilan_at) }}
      </span>
      <span v-else-if="usiaSubur" class="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800">Hamil/menyusui: belum ditanyakan</span>
    </template>

    <span v-if="klinis?.fitzpatrick" class="rounded-full bg-brand-500/10 px-2.5 py-1 font-medium text-brand-800" :title="FITZPATRICK[klinis.fitzpatrick]">
      Fitzpatrick {{ klinis.fitzpatrick }}
    </span>
    <span v-if="klinis?.riwayat_obat" class="max-w-xs truncate rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800" :title="klinis.riwayat_obat">
      Obat: {{ klinis.riwayat_obat }}
    </span>
    <span v-if="klinis?.riwayat_penyakit" class="max-w-xs truncate rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800" :title="klinis.riwayat_penyakit">
      Riwayat: {{ klinis.riwayat_penyakit }}
    </span>
    <slot />
  </div>
</template>
