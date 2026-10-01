<script setup>
/**
 * Kop dokumen cetak (PRD AD-04): nama klinik, cabang (alamat & telepon), baris tambahan (mis. nomor izin klinik) dan penanggung jawab
 * dari Pengaturan → Dokumen. Slot default = isi kop tambahan khusus dokumen.
 */
import { useKlinikStore } from '@/stores/klinik'

defineProps({ cabang: { type: Object, default: null } })
const klinik = useKlinikStore()
</script>

<template>
  <header class="border-b border-slate-300 pb-2 text-center">
    <p class="text-base font-bold">{{ klinik.nama }}</p>
    <p class="text-xs text-slate-600">
      {{ cabang?.nama }}<template v-if="cabang?.alamat"> · {{ cabang.alamat }}</template><template v-if="cabang?.telepon"> · {{ cabang.telepon }}</template>
    </p>
    <p v-if="klinik.info?.dokumen?.kop_tambahan" class="text-[11px] text-slate-500">{{ klinik.info.dokumen.kop_tambahan }}</p>
    <p v-if="klinik.info?.dokumen?.penanggung_jawab" class="text-[11px] text-slate-500">Penanggung jawab: {{ klinik.info.dokumen.penanggung_jawab }}</p>
    <slot />
  </header>
</template>
