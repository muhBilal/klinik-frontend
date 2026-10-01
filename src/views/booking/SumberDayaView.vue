<script setup>
/**
 * Ruang & alat per cabang yang bisa dibooking (PRD BK-01, BK-08). Kebutuhan ruang/alat per treatment diatur di Katalog Treatment.
 */
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const TIPE = { ruang: 'Ruang', alat: 'Alat' }

const columns = [
  { key: 'kode', label: 'Kode' },
  { key: 'nama', label: 'Nama' },
  { key: 'tipe', label: 'Tipe', format: (v) => TIPE[v] ?? v },
  { key: 'cabang', label: 'Cabang', format: (v) => v?.nama ?? '-' },
  { key: 'is_active', label: 'Status' },
]

const fields = [
  { key: 'kode', label: 'Kode', required: true, placeholder: 'mis. R-LASER1' },
  { key: 'nama', label: 'Nama', required: true, placeholder: 'mis. Ruang Laser 1 / Mesin Nd:YAG' },
  { key: 'tipe', label: 'Tipe', type: 'select', required: true, options: Object.entries(TIPE).map(([value, label]) => ({ value, label })) },
  { key: 'is_active', label: 'Aktif (bisa dibooking)', type: 'checkbox' },
]
</script>

<template>
  <MasterCrud
    title="Ruang & Alat"
    subtitle="Ruang tindakan dan alat (laser, dental chair) di cabang aktif. Booking menolak ruang/alat yang sudah terpakai di jam yang sama."
    endpoint="/sumber-dayas"
    item-label="ruang/alat"
    :columns="columns"
    :fields="fields"
    :defaults="{ tipe: 'ruang' }"
  >
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
