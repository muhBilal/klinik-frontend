<script setup>
import MasterCrud from '@/components/MasterCrud.vue'

const columns = [
  { key: 'kode', label: 'Kode', class: 'tabular-nums font-semibold w-28' },
  { key: 'nama', label: 'Nama Tindakan / Prosedur' },
]
const fields = [
  { key: 'kode', label: 'Kode ICD-9-CM', required: true, placeholder: '86.3', hint: 'Dua digit, opsional titik dan 1–2 digit.' },
  { key: 'nama', label: 'Nama tindakan', required: true, full: true },
]
</script>

<template>
  <MasterCrud
    title="Master ICD-9-CM"
    subtitle="Kode tindakan/prosedur. Dipakai sebagai kode default treatment dan dicatat per tindakan kunjungan."
    endpoint="/icd9cms"
    item-label="kode ICD-9-CM"
    :columns="columns"
    :fields="fields"
  />
</template>
