<script setup>
/**
 * Kartu data klinis pasien di detail pasien (PRD PS-03). Hanya dirender untuk pemegang rme.lihat; pembacaan tercatat audit.
 * Ubah oleh tenaga yang melakukan anamnesis (pemeriksaan.vital / pemeriksaan.dokter / rme.tindakan).
 */
import { ref, watch } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import DataKlinisModal from '@/components/klinis/DataKlinisModal.vue'
import PeringatanKlinis from '@/components/klinis/PeringatanKlinis.vue'
import api, { errorMessage } from '@/lib/api'
import { FITZPATRICK, KATEGORI_ALERGI, KEPARAHAN_ALERGI, STATUS_KEHAMILAN, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({ pasien: { type: Object, required: true } })
const auth = useAuthStore()
const toast = useToastStore()

const data = ref(null)
const formOpen = ref(false)
const bolehUbah = auth.can('pemeriksaan.vital', 'pemeriksaan.dokter', 'rme.tindakan')

async function muat() {
  try {
    data.value = (await api.get(`/pasiens/${props.pasien.id}/klinis`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
}
watch(() => props.pasien.id, muat, { immediate: true })
</script>

<template>
  <div class="card h-full">
    <div class="card-header">
      <h2 class="card-title">Data Klinis</h2>
      <button v-if="bolehUbah && data" class="btn btn-ghost btn-sm" @click="formOpen = true">Ubah</button>
    </div>
    <div v-if="!data" class="card-body flex items-center gap-2 text-sm text-slate-500"><AppSpinner />Memuat...</div>
    <div v-else class="card-body space-y-4 text-sm">
      <PeringatanKlinis :klinis="data.klinis" :alergis="data.alergis" :jenis-kelamin="pasien.jenis_kelamin" :tanggal-lahir="pasien.tanggal_lahir" />
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
        <dt class="text-slate-500">Fitzpatrick</dt>
        <dd>{{ data.klinis?.fitzpatrick ? `Tipe ${data.klinis.fitzpatrick} — ${FITZPATRICK[data.klinis.fitzpatrick]}` : '-' }}</dd>
        <template v-if="pasien.jenis_kelamin === 'P'">
          <dt class="text-slate-500">Hamil/menyusui</dt>
          <dd>
            {{ data.klinis?.status_kehamilan ? STATUS_KEHAMILAN[data.klinis.status_kehamilan] : 'Belum ditanyakan' }}
            <span v-if="data.klinis?.status_kehamilan_at" class="text-xs text-slate-500">· dicatat {{ tanggal(data.klinis.status_kehamilan_at) }}</span>
          </dd>
        </template>
        <dt class="text-slate-500">Riwayat obat</dt><dd class="whitespace-pre-line">{{ data.klinis?.riwayat_obat || '-' }}</dd>
        <dt class="text-slate-500">Riwayat penyakit</dt><dd class="whitespace-pre-line">{{ data.klinis?.riwayat_penyakit || '-' }}</dd>
        <dt class="text-slate-500">Alergi</dt>
        <dd>
          <ul v-if="data.alergis.length" class="space-y-1">
            <li v-for="a in data.alergis" :key="a.id">
              <b class="text-rose-700">{{ a.zat }}</b>
              <span class="text-xs text-slate-500">
                · {{ KATEGORI_ALERGI[a.kategori] }}<template v-if="a.keparahan"> · {{ KEPARAHAN_ALERGI[a.keparahan] }}</template>
                <template v-if="a.reaksi"> · {{ a.reaksi }}</template><template v-if="a.obat"> · obat {{ a.obat.nama }}</template>
              </span>
            </li>
          </ul>
          <span v-else class="text-slate-400">Belum ada catatan</span>
        </dd>
      </dl>
      <p v-if="data.klinis?.updated_at" class="text-xs text-slate-400">Diperbarui {{ waktu(data.klinis.updated_at) }}<template v-if="data.klinis.pembaru"> oleh {{ data.klinis.pembaru.name }}</template></p>
    </div>
    <DataKlinisModal v-if="data" v-model="formOpen" :pasien="pasien" :klinis="data.klinis" :alergis="data.alergis" @saved="(d) => (data = d)" />
  </div>
</template>
