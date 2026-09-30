<script setup>
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const columns = [
  { key: 'nama', label: 'Kategori' },
  { key: 'deskripsi', label: 'Keterangan', class: 'text-slate-600' },
  { key: 'tindakans_count', label: 'Treatment', class: 'text-right tabular-nums' },
  { key: 'is_active', label: 'Status' },
]
const fields = [
  { key: 'nama', label: 'Nama kategori', required: true, full: true, placeholder: 'Injeksi Estetika' },
  { key: 'deskripsi', label: 'Keterangan', full: true, placeholder: 'Botulinum toxin, filler, skin booster' },
  { key: 'is_active', label: 'Aktif', type: 'checkbox' },
]
</script>

<template>
  <MasterCrud
    title="Kategori Treatment"
    subtitle="Pengelompokan katalog treatment (injeksi, laser, facial, perawatan gigi, ...)"
    endpoint="/kategori-tindakans"
    item-label="kategori"
    :columns="columns"
    :fields="fields"
  >
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
