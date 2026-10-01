<script setup>
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { SPESIALISASI, rupiah } from '@/lib/format'

const columns = [
  { key: 'kode', label: 'Kode', class: 'tabular-nums text-xs' },
  { key: 'nama', label: 'Nama Poli' },
  { key: 'spesialisasi', label: 'Spesialisasi', format: (v) => SPESIALISASI[v] ?? v },
  { key: 'tarif_konsultasi', label: 'Tarif Konsultasi', format: rupiah, class: 'text-right tabular-nums' },
  { key: 'dokters_count', label: 'Dokter', class: 'text-center' },
  { key: 'is_active', label: 'Status' },
]
const fields = [
  { key: 'kode', label: 'Kode', required: true, placeholder: 'UMUM' },
  { key: 'tarif_konsultasi', label: 'Tarif konsultasi (Rp)', type: 'number', required: true },
  { key: 'nama', label: 'Nama poli', required: true, full: true },
  {
    key: 'spesialisasi',
    label: 'Spesialisasi',
    type: 'select',
    options: Object.entries(SPESIALISASI).map(([value, label]) => ({ value, label })),
    full: true,
    hint: 'Menentukan modul spesialisasi di pemeriksaan: Kedokteran gigi → odontogram & rencana perawatan gigi.',
  },
  { key: 'is_active', label: 'Aktif (dapat dipilih saat pendaftaran)', type: 'checkbox' },
]
</script>

<template>
  <MasterCrud title="Master Poli" subtitle="Unit pelayanan dan tarif konsultasi" endpoint="/polis" item-label="poli" :columns="columns" :fields="fields" :searchable="false" :defaults="{ tarif_konsultasi: 0, spesialisasi: 'umum' }">
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
