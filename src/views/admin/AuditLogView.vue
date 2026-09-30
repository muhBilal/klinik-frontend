<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage } from '@/lib/api'
import { toOptions, waktu } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const toast = useToastStore()

const AKSI = {
  buat: 'Buat',
  ubah: 'Ubah',
  hapus: 'Hapus',
  pulihkan: 'Pulihkan',
  lihat: 'Lihat rekam medis',
  akses_berkas: 'Buka berkas',
  unduh_berkas: 'Unduh berkas',
  login: 'Login',
  login_gagal: 'Login gagal',
  logout: 'Logout',
  ubah_izin: 'Ubah izin peran',
  ubah_password: 'Ganti password',
  '2fa_aktif': '2FA diaktifkan',
  '2fa_nonaktif': '2FA dinonaktifkan',
  '2fa_kode_baru': 'Kode pemulihan baru',
  '2fa_kode_pemulihan': 'Pakai kode pemulihan',
}
const TIPE = {
  pasien: 'Pasien',
  kunjungan: 'Kunjungan',
  pemeriksaan: 'Pemeriksaan',
  pemeriksaan_diagnosa: 'Diagnosa',
  kunjungan_tindakan: 'Tindakan kunjungan',
  resep: 'Resep',
  resep_item: 'Item resep',
  tagihan: 'Tagihan',
  tagihan_item: 'Item tagihan',
  berkas: 'Berkas',
  user: 'Pengguna',
  peran: 'Peran',
  cabang: 'Cabang',
  pengaturan: 'Pengaturan',
  obat: 'Obat',
  tindakan: 'Master tindakan',
  poli: 'Poli',
  icd10: 'ICD-10',
}
// Warna badge per kelompok aksi (merah = kegagalan / penghapusan, biru = akses data pasien)
const warna = (aksi) =>
  ['hapus', 'login_gagal', '2fa_nonaktif'].includes(aksi)
    ? 'bg-red-500'
    : ['lihat', 'akses_berkas', 'unduh_berkas'].includes(aksi)
      ? 'bg-indigo-500'
      : ['buat', 'pulihkan'].includes(aksi)
        ? 'bg-emerald-600'
        : 'bg-slate-500'

// ?pasien_id= dari halaman lain (mis. jejak akses satu pasien)
const { items, meta, loading, filters, load, search, isFiltered, reset } = useList('/audit-logs', {
  q: '', aksi: '', tipe: '', dari: '', sampai: '', pasien_id: route.query.pasien_id ?? '',
})

const detail = ref(null)
const memuatDetail = ref(null)

async function buka(row) {
  memuatDetail.value = row.id
  try {
    detail.value = (await api.get(`/audit-logs/${row.id}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memuatDetail.value = null
  }
}

const tampil = (nilai) => (nilai === null || nilai === undefined || nilai === '' ? '—' : typeof nilai === 'object' ? JSON.stringify(nilai) : String(nilai))

onMounted(() => load())
</script>

<template>
  <PageHeader title="Audit Log" subtitle="Jejak perubahan data, akses rekam medis & berkas, serta aktivitas login. Catatan tidak dapat diubah atau dihapus." />

  <div class="card">
    <div class="card-header flex-wrap">
      <input v-model="filters.q" type="search" class="input max-w-xs" placeholder="Cari label (No. RM, email, nomor dokumen)..." @input="search" />
      <div class="filter-bar">
        <FilterSelect v-model="filters.aksi" :options="toOptions(AKSI)" placeholder="Semua aksi" @change="load()" />
        <FilterSelect v-model="filters.tipe" :options="toOptions(TIPE)" placeholder="Semua data" @change="load()" />
        <input v-model="filters.dari" type="date" class="input w-auto py-1.5" aria-label="Dari tanggal" @change="load()" />
        <input v-model="filters.sampai" type="date" class="input w-auto py-1.5" aria-label="Sampai tanggal" @change="load()" />
        <button v-if="isFiltered" class="btn btn-ghost btn-sm" @click="reset">Reset</button>
        <AppSpinner v-if="loading" class="text-slate-400" />
      </div>
    </div>
    <p v-if="filters.pasien_id" class="px-5 pb-2 text-xs text-slate-500">Menampilkan jejak untuk satu pasien (id {{ filters.pasien_id }}).</p>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Cabang</th><th>IP</th><th /></tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="7" />
          <tr v-for="row in items" :key="row.id">
            <td class="whitespace-nowrap tabular-nums">{{ waktu(row.created_at) }}</td>
            <td>
              <p>{{ row.user?.name ?? 'Sistem' }}</p>
              <p v-if="row.user" class="text-xs text-slate-500">{{ row.user.email }}</p>
            </td>
            <td><span :class="warna(row.aksi)" class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white">{{ AKSI[row.aksi] ?? row.aksi }}</span></td>
            <td>
              <p class="text-xs text-slate-500">{{ TIPE[row.tipe] ?? row.tipe ?? '-' }}<template v-if="row.subjek_id"> #{{ row.subjek_id }}</template></p>
              <p class="max-w-72 truncate" :title="row.label">{{ row.label ?? '-' }}</p>
            </td>
            <td class="text-slate-600">{{ row.cabang?.nama ?? '-' }}</td>
            <td class="text-xs text-slate-500 tabular-nums">{{ row.ip_address ?? '-' }}</td>
            <td class="text-right">
              <button class="btn btn-ghost btn-sm" :disabled="memuatDetail === row.id" @click="buka(row)">
                <AppSpinner v-if="memuatDetail === row.id" size="size-3" />Detail
              </button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" class="py-10 text-center text-slate-400">Tidak ada catatan audit.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <AppModal :model-value="!!detail" :title="detail ? `${AKSI[detail.aksi] ?? detail.aksi} · ${TIPE[detail.tipe] ?? detail.tipe ?? ''}` : ''" size="max-w-3xl" @update:model-value="detail = null">
    <template v-if="detail">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt class="text-slate-500">Waktu</dt><dd>{{ waktu(detail.created_at) }}</dd>
        <dt class="text-slate-500">Pengguna</dt><dd>{{ detail.user ? `${detail.user.name} (${detail.user.email})` : 'Sistem' }}</dd>
        <dt class="text-slate-500">Data</dt><dd>{{ detail.label ?? '-' }}<template v-if="detail.subjek_id"> · #{{ detail.subjek_id }}</template></dd>
        <template v-if="detail.pasien_id"><dt class="text-slate-500">Pasien</dt><dd><RouterLink :to="`/pasien/${detail.pasien_id}`" class="font-medium hover:underline">Lihat pasien #{{ detail.pasien_id }}</RouterLink></dd></template>
        <dt class="text-slate-500">Perangkat</dt><dd class="text-xs break-all text-slate-600">{{ detail.ip_address ?? '-' }} · {{ detail.user_agent ?? '-' }}</dd>
      </dl>
      <div v-if="detail.perubahan" class="mt-4 overflow-x-auto">
        <table class="table">
          <thead><tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th></tr></thead>
          <tbody>
            <tr v-for="(nilai, kolom) in detail.perubahan" :key="kolom">
              <td class="font-mono text-xs">{{ kolom }}</td>
              <td class="max-w-72 text-xs break-words whitespace-pre-wrap text-slate-500">{{ tampil(nilai.lama) }}</td>
              <td class="max-w-72 text-xs break-words whitespace-pre-wrap">{{ tampil(nilai.baru) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="mt-4 text-sm text-slate-400">Tidak ada rincian perubahan kolom.</p>
    </template>
  </AppModal>
</template>
