<script setup>
import { onMounted } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import { waktu } from '@/lib/format'

const TABS = [
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'diserahkan', label: 'Sudah diserahkan' },
  { value: '', label: 'Semua' },
]

const { items, meta, loading, filters, load, search } = useList('/reseps', { status: 'menunggu', q: '', tanggal: '' })

onMounted(() => load())
</script>

<template>
  <PageHeader title="Resep" subtitle="Resep elektronik dari dokter. Obat diserahkan setelah tagihan lunas." />

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="tabs">
        <button v-for="t in TABS" :key="t.value" :class="{ 'tab-active': filters.status === t.value }" class="tab" @click="filters.status = t.value; load()">{{ t.label }}</button>
      </div>
      <div class="flex gap-2">
        <input v-model="filters.tanggal" type="date" class="input w-auto py-1.5" @change="load()" />
        <input v-model="filters.q" type="search" class="input w-64 py-1.5" placeholder="No. resep / nama / No. RM" @input="search" />
      </div>
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr><th>No. Resep</th><th>Waktu</th><th>Pasien</th><th>Poli / Dokter</th><th>Item</th><th>Pembayaran</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="8" />
          <tr v-for="r in items" :key="r.id">
            <td class="tabular-nums text-xs font-semibold">{{ r.no_resep }}</td>
            <td class="whitespace-nowrap text-slate-600">{{ waktu(r.created_at) }}</td>
            <td>
              <p class="font-medium">{{ r.kunjungan.pasien.nama }}</p>
              <p class="text-xs text-slate-500">RM {{ r.kunjungan.pasien.no_rm }}</p>
            </td>
            <td>
              <p>{{ r.kunjungan.poli.nama }}</p>
              <p class="text-xs text-slate-500">{{ r.dokter?.name ?? '-' }}</p>
            </td>
            <td>{{ r.items_count }} obat</td>
            <td><StatusBadge :status="r.kunjungan.tagihan?.status ?? 'belum_bayar'" /></td>
            <td><StatusBadge :status="r.status" /></td>
            <td class="text-right">
              <RouterLink :to="`/farmasi/resep/${r.id}`" :class="r.status === 'menunggu' ? 'btn-primary' : 'btn-ghost'" class="btn btn-sm">
                {{ r.status === 'menunggu' ? 'Proses' : 'Lihat' }}
              </RouterLink>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="8" class="py-10 text-center text-slate-400">Tidak ada resep.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>
</template>
