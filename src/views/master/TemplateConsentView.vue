<script setup>
/** Naskah informed consent (PRD RM-03). Placeholder diisi otomatis saat pasien menandatangani. */
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const PLACEHOLDER = '{nama_pasien} {no_rm} {tanggal_lahir} {tindakan} {dokter} {tanggal} {klinik} {cabang}'

const columns = [
  { key: 'nama', label: 'Nama naskah' },
  { key: 'tindakans_count', label: 'Dipakai treatment', format: (v) => (v ? `${v} treatment` : '-'), class: 'w-40' },
  { key: 'is_active', label: 'Status', class: 'w-28' },
]
const fields = [
  { key: 'nama', label: 'Nama / judul naskah', required: true, full: true, placeholder: 'Persetujuan Tindakan Injeksi Estetika' },
  {
    key: 'isi',
    label: 'Isi naskah',
    type: 'textarea',
    rows: 16,
    required: true,
    full: true,
    hint: `Placeholder: ${PLACEHOLDER}. Naskah yang sudah ditandatangani pasien tidak ikut berubah bila template diedit.`,
  },
  { key: 'is_active', label: 'Aktif (dapat dipilih saat mengambil consent)', type: 'checkbox' },
]
</script>

<template>
  <MasterCrud
    title="Template Informed Consent"
    subtitle="Naskah persetujuan tindakan. Pasang ke treatment di Katalog Treatment agar consent wajib sebelum pemeriksaan ditutup. Tinjau naskah bersama penanggung jawab medis/legal."
    endpoint="/template-consents"
    item-label="template consent"
    modal-size="max-w-3xl"
    :columns="columns"
    :fields="fields"
  >
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
