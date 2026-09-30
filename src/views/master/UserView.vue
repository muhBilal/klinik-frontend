<script setup>
import { computed, onMounted, ref } from 'vue'
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { cachedGet } from '@/lib/cache'

const polis = ref([])
const perans = ref([])
const cabangs = ref([])

/** Peran yang memegang izin pemeriksaan.dokter tercatat sebagai dokter: wajib poli, punya No. SIP. */
const peranDokter = computed(() => new Set(perans.value.filter((p) => !p.akses_penuh && p.izin.includes('pemeriksaan.dokter')).map((p) => p.kode)))

const columns = [
  { key: 'name', label: 'Nama' },
  { key: 'email', label: 'Email' },
  { key: 'peran', label: 'Peran', format: (v, row) => v?.nama ?? row.role },
  { key: 'cabang', label: 'Cabang', format: (v) => v?.nama ?? 'Semua cabang' },
  { key: 'poli', label: 'Poli', format: (v) => v?.nama ?? '-' },
  { key: 'two_factor_confirmed_at', label: '2FA', format: (v) => (v ? 'Aktif' : '-') },
  { key: 'is_active', label: 'Status' },
]

const fields = computed(() => [
  { key: 'name', label: 'Nama lengkap', required: true, full: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'password', label: 'Password', type: 'password', required: true },
  { key: 'role', label: 'Peran', type: 'select', required: true, options: perans.value.map((p) => ({ value: p.kode, label: p.nama })) },
  {
    key: 'cabang_id',
    label: 'Cabang (kosong = semua cabang)',
    type: 'select',
    options: cabangs.value.map((c) => ({ value: c.id, label: `${c.nama}${c.is_active === false ? ' (nonaktif)' : ''}` })),
  },
  { key: 'poli_id', label: 'Poli', type: 'select', required: true, options: polis.value.map((p) => ({ value: p.id, label: p.nama })), show: (f) => peranDokter.value.has(f.role) },
  { key: 'sip', label: 'No. SIP', show: (f) => peranDokter.value.has(f.role) },
  { key: 'is_active', label: 'Akun aktif', type: 'checkbox' },
])

onMounted(async () => {
  ;[polis.value, perans.value, cabangs.value] = await Promise.all([cachedGet('/polis'), cachedGet('/perans'), cachedGet('/cabangs')])
})
</script>

<template>
  <MasterCrud
    title="Pengguna"
    subtitle="Akun petugas klinik, peran, dan cabang tempat bertugas"
    endpoint="/users"
    item-label="pengguna"
    :columns="columns"
    :fields="fields"
    :defaults="{ role: 'pendaftaran' }"
    :invalidates="['/dokters']"
  >
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
