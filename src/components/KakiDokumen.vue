<script setup>
/** Kaki dokumen cetak (PRD AD-04) dari Pengaturan → Dokumen; tidak tampil bila kosong. */
import { useKlinikStore } from '@/stores/klinik'

const klinik = useKlinikStore()
</script>

<template>
  <p v-if="klinik.info?.dokumen?.kaki" class="border-t border-dashed border-slate-300 pt-2 text-center text-[11px] text-slate-500">{{ klinik.info.dokumen.kaki }}</p>
</template>
