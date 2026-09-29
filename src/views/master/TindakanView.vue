<script setup>
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { rupiah } from '@/lib/format'

const columns = [
  { key: 'kode', label: 'Kode', class: 'tabular-nums text-xs' },
  { key: 'nama', label: 'Nama Tindakan' },
  { key: 'tarif', label: 'Tarif', format: rupiah, class: 'text-right tabular-nums' },
  { key: 'is_active', label: 'Status' },
]
const fields = [
  { key: 'kode', label: 'Kode', required: true, placeholder: 'TND-001' },
  { key: 'tarif', label: 'Tarif (Rp)', type: 'number', required: true },
  { key: 'nama', label: 'Nama tindakan', required: true, full: true },
  { key: 'is_active', label: 'Aktif', type: 'checkbox' },
]
</script>

<template>
  <MasterCrud title="Master Tindakan" subtitle="Daftar tindakan medis dan tarifnya" endpoint="/tindakans" item-label="tindakan" :columns="columns" :fields="fields" :defaults="{ tarif: 0 }">
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
