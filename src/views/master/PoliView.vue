<script setup>
/**
 * Master poli. Jasa konsultasi dokter = treatment di Katalog Treatment (harga per cabang & komisi dokter diatur di sana) yang
 * ditagihkan otomatis tiap kunjungan poli ini. Pilihan: treatment aktif di kategori "…konsultasi…" atau bernama "…konsultasi…".
 */
import { computed, onMounted, ref } from 'vue'
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage } from '@/lib/api'
import { SPESIALISASI, rupiah } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const tindakanKonsultasi = ref([])

onMounted(async () => {
  try {
    const kategori = (await api.get('/kategori-tindakans')).data.filter((k) => /konsultasi/i.test(k.nama))
    const daftar = await Promise.all([
      api.get('/tindakans', { params: { q: 'konsultasi', status: 'aktif', per_page: 100 } }),
      ...kategori.map((k) => api.get('/tindakans', { params: { kategori_id: k.id, status: 'aktif', per_page: 100 } })),
    ])
    const unik = new Map(daftar.flatMap((r) => r.data.data).map((t) => [t.id, t]))
    tindakanKonsultasi.value = [...unik.values()].sort((a, b) => a.nama.localeCompare(b.nama))
  } catch (e) {
    toast.error(errorMessage(e))
  }
})

const columns = [
  { key: 'kode', label: 'Kode', class: 'tabular-nums text-xs' },
  { key: 'nama', label: 'Nama Poli' },
  { key: 'spesialisasi', label: 'Spesialisasi', format: (v) => SPESIALISASI[v] ?? v },
  { key: 'tindakan_konsultasi', label: 'Jasa Konsultasi', format: (v) => (v ? `${v.nama} · ${rupiah(v.tarif)}` : 'Tanpa jasa konsultasi') },
  { key: 'dokters_count', label: 'Dokter', class: 'text-center' },
  { key: 'is_active', label: 'Status' },
]
const fields = computed(() => [
  { key: 'kode', label: 'Kode', required: true, placeholder: 'UMUM' },
  { key: 'nama', label: 'Nama poli', required: true },
  {
    key: 'tindakan_konsultasi_id',
    label: 'Jasa konsultasi dokter',
    type: 'select',
    options: tindakanKonsultasi.value.map((t) => ({ value: t.id, label: `${t.nama} · ${rupiah(t.tarif)}` })),
    full: true,
    hint: 'Treatment dari Katalog Treatment (kategori Konsultasi) yang ditagihkan otomatis tiap kunjungan; harga per cabang & komisi dokter diatur di katalog. Kosong = tanpa jasa konsultasi.',
  },
  {
    key: 'spesialisasi',
    label: 'Spesialisasi',
    type: 'select',
    options: Object.entries(SPESIALISASI).map(([value, label]) => ({ value, label })),
    full: true,
    hint: 'Menentukan modul spesialisasi di pemeriksaan: Kedokteran gigi → odontogram & rencana perawatan gigi.',
  },
  { key: 'is_active', label: 'Aktif (dapat dipilih saat pendaftaran)', type: 'checkbox' },
])
</script>

<template>
  <MasterCrud title="Master Poli" subtitle="Unit pelayanan dan jasa konsultasi dokter" endpoint="/polis" item-label="poli" :columns="columns" :fields="fields" :searchable="false" :defaults="{ spesialisasi: 'umum' }">
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
