<script setup>
import { computed, onMounted, ref } from 'vue'
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api from '@/lib/api'
import { SPESIALISASI, rupiah } from '@/lib/format'

// Treatment untuk ditautkan sebagai jasa konsultasi (AD-01): tarif konsultasi ikut harga per cabang treatment ini.
const treatments = ref([])
onMounted(async () => {
  try {
    const { data } = await api.get('/tindakans', { params: { aktif: 1 } })
    treatments.value = (data.data ?? data).map((t) => ({ value: t.id, label: `${t.kode} · ${t.nama}` }))
  } catch {
    treatments.value = []
  }
})

const columns = [
  { key: 'kode', label: 'Kode', class: 'tabular-nums text-xs' },
  { key: 'nama', label: 'Nama Poli' },
  { key: 'spesialisasi', label: 'Spesialisasi', format: (v) => SPESIALISASI[v] ?? v },
  { key: 'tarif_konsultasi', label: 'Tarif Konsultasi', format: rupiah, class: 'text-right tabular-nums' },
  { key: 'dokters_count', label: 'Dokter', class: 'text-center' },
  { key: 'is_active', label: 'Status' },
]
const fields = computed(() => [
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
  {
    key: 'tindakan_konsultasi_id',
    label: 'Treatment konsultasi (opsional)',
    type: 'select',
    options: treatments.value,
    full: true,
    hint: 'Bila diisi, tarif konsultasi mengikuti harga treatment ini per cabang; tarif flat di atas menjadi cadangan.',
  },
  { key: 'is_active', label: 'Aktif (dapat dipilih saat pendaftaran)', type: 'checkbox' },
])
</script>

<template>
  <MasterCrud title="Master Poli" subtitle="Unit pelayanan dan tarif konsultasi" endpoint="/polis" item-label="poli" :columns="columns" :fields="fields" :searchable="false" :defaults="{ tarif_konsultasi: 0, spesialisasi: 'umum' }">
    <template #cell-tarif_konsultasi="{ row }">
      <span class="tabular-nums">{{ rupiah(row.tarif_konsultasi) }}</span>
      <span v-if="row.tindakan_konsultasi" class="block text-xs text-slate-500">via {{ row.tindakan_konsultasi.nama }} (per cabang)</span>
    </template>
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
