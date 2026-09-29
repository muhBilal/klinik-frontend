<script setup>
import { computed, onMounted, ref } from 'vue'
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { cachedGet } from '@/lib/cache'
import { ROLES } from '@/lib/format'

const polis = ref([])

const columns = [
  { key: 'name', label: 'Nama' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role', format: (v) => ROLES[v] ?? v },
  { key: 'poli', label: 'Poli', format: (v) => v?.nama ?? '-' },
  { key: 'is_active', label: 'Status' },
]

const fields = computed(() => [
  { key: 'name', label: 'Nama lengkap', required: true, full: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'password', label: 'Password', type: 'password', required: true },
  { key: 'role', label: 'Role', type: 'select', required: true, options: Object.entries(ROLES).map(([value, label]) => ({ value, label })) },
  { key: 'poli_id', label: 'Poli (khusus dokter)', type: 'select', options: polis.value.map((p) => ({ value: p.id, label: p.nama })), show: (f) => f.role === 'dokter' },
  { key: 'sip', label: 'No. SIP', show: (f) => f.role === 'dokter' },
  { key: 'is_active', label: 'Akun aktif', type: 'checkbox' },
])

onMounted(async () => {
  polis.value = await cachedGet('/polis')
})
</script>

<template>
  <MasterCrud title="Pengguna" subtitle="Akun petugas klinik dan hak aksesnya" endpoint="/users" item-label="pengguna" :columns="columns" :fields="fields" :defaults="{ role: 'pendaftaran' }" :invalidates="['/dokters']">
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
