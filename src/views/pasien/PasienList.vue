<script setup>
import { onMounted, ref } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import PasienFormModal from '@/components/PasienFormModal.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import { useQueryAction } from '@/composables/useQueryAction'
import { GOLONGAN_DARAH, jenisKelamin, toOptions } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { items, meta, loading, filters, load, search, isFiltered, reset } = useList('/pasiens', { q: '', jenis_kelamin: '', golongan_darah: '', bpjs: '' })

const OPSI = {
  jk: toOptions({ L: 'Laki-laki', P: 'Perempuan' }),
  goldar: GOLONGAN_DARAH.map((g) => ({ value: g, label: `Gol. darah ${g}` })),
  bpjs: toOptions({ ya: 'Punya BPJS', tidak: 'Tanpa BPJS' }),
}

const formOpen = ref(false)
const editing = ref(null)

function tambah() {
  editing.value = null
  formOpen.value = true
}

function ubah(pasien) {
  editing.value = pasien
  formOpen.value = true
}

// Ubah: perbarui baris di tempat. Pasien baru: muat halaman pertama (urut terbaru).
function onSaved(data) {
  if (editing.value) Object.assign(editing.value, data)
  else load(1)
}

// Aksi "Pasien baru" dari pencarian global (?baru=1)
useQueryAction('baru', () => auth.hasRole('pendaftaran') && tambah())

onMounted(() => load())
</script>

<template>
  <PageHeader title="Data Pasien" subtitle="Master data pasien dan nomor rekam medis">
    <button v-if="auth.hasRole('pendaftaran')" class="btn btn-primary" @click="tambah">+ Pasien Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="filter-bar">
        <input v-model="filters.q" type="search" class="input w-72 max-w-full py-1.5" placeholder="Cari nama, No. RM, NIK, No. BPJS..." @input="search" />
        <FilterSelect v-model="filters.jenis_kelamin" placeholder="Semua jenis kelamin" :options="OPSI.jk" @change="load()" />
        <FilterSelect v-model="filters.golongan_darah" placeholder="Semua gol. darah" :options="OPSI.goldar" @change="load()" />
        <FilterSelect v-model="filters.bpjs" placeholder="BPJS & non-BPJS" :options="OPSI.bpjs" @change="load()" />
        <button v-if="isFiltered" class="btn btn-ghost btn-sm" @click="reset()">Reset filter</button>
      </div>
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr>
            <th>No. RM</th>
            <th>Nama</th>
            <th>JK / Umur</th>
            <th>Tgl Lahir</th>
            <th>NIK</th>
            <th>No. HP</th>
            <th class="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="7" />
          <tr v-for="p in items" :key="p.id">
            <td class="tabular-nums text-xs font-semibold text-brand-700">{{ p.no_rm }}</td>
            <td>
              <RouterLink :to="`/pasien/${p.id}`" class="font-medium hover:text-brand-700 hover:underline">{{ p.nama }}</RouterLink>
              <p v-if="p.alergi" class="text-xs text-rose-600">Alergi: {{ p.alergi }}</p>
            </td>
            <td class="whitespace-nowrap">{{ jenisKelamin(p.jenis_kelamin) }} · {{ p.umur }}</td>
            <td class="whitespace-nowrap">{{ p.tanggal_lahir }}</td>
            <td class="tabular-nums text-xs">{{ p.nik ?? '-' }}</td>
            <td>{{ p.no_hp ?? '-' }}</td>
            <td class="text-right whitespace-nowrap">
              <RouterLink v-if="auth.hasRole('pendaftaran')" :to="{ path: '/pendaftaran', query: { pasien_id: p.id } }" class="btn btn-primary btn-sm">Daftarkan</RouterLink>
              <button v-if="auth.hasRole('pendaftaran')" class="btn btn-ghost btn-sm" @click="ubah(p)">Ubah</button>
              <RouterLink :to="`/pasien/${p.id}`" class="btn btn-ghost btn-sm">Detail</RouterLink>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" class="py-10 text-center text-slate-400">{{ isFiltered ? 'Tidak ada pasien yang cocok dengan filter.' : 'Belum ada data pasien.' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <PasienFormModal v-model="formOpen" :pasien="editing" @saved="onSaved" />
</template>
