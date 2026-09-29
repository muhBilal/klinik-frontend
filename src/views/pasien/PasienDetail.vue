<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import PasienFormModal from '@/components/PasienFormModal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage } from '@/lib/api'
import { PENJAMIN, jenisKelamin, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const auth = useAuthStore()
const toast = useToastStore()
const pasien = ref(null)
const formOpen = ref(false)

async function load() {
  try {
    pasien.value = (await api.get(`/pasiens/${route.params.id}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

onMounted(load)
</script>

<template>
  <template v-if="pasien">
    <PageHeader :title="pasien.nama" :subtitle="`No. RM ${pasien.no_rm}`">
      <RouterLink to="/pasien" class="btn btn-secondary">Kembali</RouterLink>
      <button v-if="auth.hasRole('pendaftaran')" class="btn btn-secondary" @click="formOpen = true">Ubah Data</button>
      <RouterLink v-if="auth.hasRole('pendaftaran')" :to="{ path: '/pendaftaran', query: { pasien_id: pasien.id } }" class="btn btn-primary">Daftarkan Kunjungan</RouterLink>
    </PageHeader>

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Identitas Pasien</h2></div>
        <dl class="card-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt class="text-slate-500">NIK</dt><dd class="font-mono">{{ pasien.nik ?? '-' }}</dd>
          <dt class="text-slate-500">No. BPJS</dt><dd class="font-mono">{{ pasien.no_bpjs ?? '-' }}</dd>
          <dt class="text-slate-500">Jenis kelamin</dt><dd>{{ jenisKelamin(pasien.jenis_kelamin) }}</dd>
          <dt class="text-slate-500">TTL</dt><dd>{{ pasien.tempat_lahir ?? '-' }}, {{ tanggal(pasien.tanggal_lahir) }} ({{ pasien.umur }})</dd>
          <dt class="text-slate-500">Gol. darah</dt><dd>{{ pasien.golongan_darah ?? '-' }}</dd>
          <dt class="text-slate-500">No. HP</dt><dd>{{ pasien.no_hp ?? '-' }}</dd>
          <dt class="text-slate-500">Pekerjaan</dt><dd>{{ pasien.pekerjaan ?? '-' }}</dd>
          <dt class="text-slate-500">Alamat</dt><dd>{{ pasien.alamat ?? '-' }}</dd>
          <dt class="text-slate-500">Alergi</dt><dd :class="pasien.alergi ? 'font-medium text-rose-600' : ''">{{ pasien.alergi ?? 'Tidak ada' }}</dd>
        </dl>
      </div>

      <div class="card lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Riwayat Kunjungan</h2></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr><th>Tanggal</th><th>Poli / Dokter</th><th>Diagnosa</th><th>Penjamin</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="k in pasien.kunjungans" :key="k.id">
                <td class="whitespace-nowrap">{{ tanggal(k.tanggal) }}</td>
                <td>
                  <p>{{ k.poli?.nama }}</p>
                  <p class="text-xs text-slate-500">{{ k.dokter?.name ?? '-' }}</p>
                </td>
                <td class="text-xs">
                  <p v-for="d in k.pemeriksaan?.diagnosas ?? []" :key="d.id"><span class="font-mono font-semibold">{{ d.icd10.kode }}</span> {{ d.icd10.nama }}</p>
                  <span v-if="!k.pemeriksaan?.diagnosas?.length" class="text-slate-400">-</span>
                </td>
                <td>{{ PENJAMIN[k.penjamin] }}</td>
                <td><StatusBadge :status="k.status" /></td>
                <td class="text-right"><RouterLink :to="`/kunjungan/${k.id}`" class="btn btn-ghost btn-sm">Lihat</RouterLink></td>
              </tr>
              <tr v-if="!pasien.kunjungans.length">
                <td colspan="6" class="py-10 text-center text-slate-400">Belum ada riwayat kunjungan.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <PasienFormModal v-model="formOpen" :pasien="pasien" @saved="load" />
  </template>
</template>
