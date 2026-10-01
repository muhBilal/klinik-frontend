<script setup>
import ImporMasterButton from '@/components/ImporMasterButton.vue'
import MasterCrud from '@/components/MasterCrud.vue'

const columns = [
  { key: 'kode', label: 'Kode', class: 'tabular-nums font-semibold w-28' },
  { key: 'nama', label: 'Nama Diagnosa' },
  { key: 'sensitif', label: 'Akses', format: (v) => (v ? 'Sensitif' : '-'), class: 'w-32' },
]
const fields = [
  { key: 'kode', label: 'Kode ICD-10', required: true, placeholder: 'J06.9' },
  { key: 'nama', label: 'Nama diagnosa', required: true, full: true },
  {
    key: 'sensitif',
    label: 'Diagnosa sensitif (IMS / HIV)',
    type: 'checkbox',
    hint: 'Kunjungan dengan diagnosa ini otomatis berakses terbatas: rekam medisnya hanya dibuka tim yang menangani.',
  },
]
</script>

<template>
  <MasterCrud
    title="Master ICD-10"
    subtitle="Kode diagnosa penyakit (WHO ICD-10)"
    endpoint="/icd10s"
    item-label="kode ICD-10"
    :columns="columns"
    :fields="fields"
    :defaults="{ sensitif: false }"
  >
    <template #aksi="{ reload }"><ImporMasterButton jenis="icd10" @selesai="reload" /></template>
  </MasterCrud>
</template>
