<script setup>
import MasterCrud from '@/components/MasterCrud.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const columns = [
  { key: 'kode', label: 'Kode' },
  { key: 'nama', label: 'Nama' },
  { key: 'alamat', label: 'Alamat', format: (v, row) => [v, row.telepon].filter(Boolean).join(' · ') || '-' },
  { key: 'jam_buka', label: 'Jam operasional', format: (v, row) => (v ? `${v}–${row.jam_tutup ?? '?'}` : '-') },
  { key: 'users_count', label: 'Pengguna', class: 'text-right tabular-nums' },
  { key: 'is_active', label: 'Status' },
]

const fields = [
  { key: 'kode', label: 'Kode', required: true, placeholder: 'mis. JKT-01' },
  { key: 'nama', label: 'Nama cabang', required: true },
  { key: 'alamat', label: 'Alamat', full: true },
  { key: 'telepon', label: 'Telepon' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'jam_buka', label: 'Jam buka', type: 'time' },
  { key: 'jam_tutup', label: 'Jam tutup', type: 'time' },
  { key: 'satusehat_location_id', label: 'Location ID SATUSEHAT', full: true, placeholder: 'mis. b017aa54-f1df-4ec2-9d84-8823815d7228', hint: 'Dari portal SATUSEHAT; wajib agar kunjungan cabang ini terkirim.' },
  { key: 'is_active', label: 'Cabang aktif', type: 'checkbox' },
]

// Daftar cabang di pemilih cabang (header) berasal dari /me; muat ulang setelah cabang berubah.
function segarkanPemilih() {
  auth.fetchMe().catch(() => {})
}
</script>

<template>
  <MasterCrud
    title="Cabang"
    subtitle="Cabang klinik. Transaksi (kunjungan, resep, tagihan) terpisah per cabang; data pasien berlaku di semua cabang."
    endpoint="/cabangs"
    item-label="cabang"
    :columns="columns"
    :fields="fields"
    :invalidates="['/dokters']"
    @changed="segarkanPemilih"
  >
    <template #cell-is_active="{ row }"><StatusBadge :status="row.is_active ? 'aktif' : 'nonaktif'" /></template>
  </MasterCrud>
</template>
