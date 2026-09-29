<script setup>
import { onMounted, ref } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import PageHeader from '@/components/PageHeader.vue'
import PasienFormModal from '@/components/PasienFormModal.vue'
import { useList } from '@/composables/useList'
import { jenisKelamin } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { items, meta, loading, filters, load, reload, search } = useList('/pasiens', { q: '' })

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

onMounted(() => load())
</script>

<template>
  <PageHeader title="Data Pasien" subtitle="Master data pasien dan nomor rekam medis">
    <button v-if="auth.hasRole('pendaftaran')" class="btn btn-primary" @click="tambah">+ Pasien Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header">
      <input v-model="filters.q" type="search" class="input max-w-sm" placeholder="Cari nama, No. RM, NIK, atau No. BPJS..." @input="search" />
      <span v-if="loading" class="text-xs text-slate-400">Memuat...</span>
    </div>
    <div class="overflow-x-auto">
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
          <tr v-for="p in items" :key="p.id">
            <td class="font-mono text-xs font-semibold text-brand-700">{{ p.no_rm }}</td>
            <td>
              <RouterLink :to="`/pasien/${p.id}`" class="font-medium hover:text-brand-700 hover:underline">{{ p.nama }}</RouterLink>
              <p v-if="p.alergi" class="text-xs text-rose-600">Alergi: {{ p.alergi }}</p>
            </td>
            <td class="whitespace-nowrap">{{ jenisKelamin(p.jenis_kelamin) }} · {{ p.umur }}</td>
            <td class="whitespace-nowrap">{{ p.tanggal_lahir }}</td>
            <td class="font-mono text-xs">{{ p.nik ?? '-' }}</td>
            <td>{{ p.no_hp ?? '-' }}</td>
            <td class="text-right whitespace-nowrap">
              <RouterLink v-if="auth.hasRole('pendaftaran')" :to="{ path: '/pendaftaran', query: { pasien_id: p.id } }" class="btn btn-primary btn-sm">Daftarkan</RouterLink>
              <button v-if="auth.hasRole('pendaftaran')" class="btn btn-ghost btn-sm" @click="ubah(p)">Ubah</button>
              <RouterLink :to="`/pasien/${p.id}`" class="btn btn-ghost btn-sm">Detail</RouterLink>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" class="py-10 text-center text-slate-400">Belum ada data pasien.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <PasienFormModal v-model="formOpen" :pasien="editing" @saved="reload" />
</template>
