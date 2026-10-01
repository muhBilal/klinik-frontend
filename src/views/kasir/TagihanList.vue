<script setup>
import { onMounted, ref } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import PageHeader from '@/components/PageHeader.vue'
import JualPaketModal from '@/components/paket/JualPaketModal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import { METODE_BAYAR, PENJAMIN, rupiah, waktu } from '@/lib/format'

const TABS = [
  { value: 'belum_bayar', label: 'Belum dibayar' },
  { value: 'lunas', label: 'Lunas' },
  { value: '', label: 'Semua' },
]

const { items, meta, loading, filters, load, search } = useList('/tagihans', { status: 'belum_bayar', q: '', tanggal: '' })

const jualOpen = ref(false)

onMounted(() => load())
</script>

<template>
  <PageHeader title="Kasir" subtitle="Tagihan pemeriksaan, penjualan paket & produk">
    <!-- Penjualan paket multi-sesi (TR-02): tagihan mandiri, paket aktif setelah lunas -->
    <button class="btn btn-secondary" @click="jualOpen = true">+ Jual paket</button>
  </PageHeader>
  <JualPaketModal v-model="jualOpen" />

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="tabs">
        <button v-for="t in TABS" :key="t.value" :class="{ 'tab-active': filters.status === t.value }" class="tab" @click="filters.status = t.value; load()">{{ t.label }}</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <input v-model="filters.tanggal" type="date" class="input w-auto py-1.5" @change="load()" />
        <input v-model="filters.q" type="search" class="input w-full py-1.5 sm:w-64" placeholder="No. tagihan / nama / No. RM" @input="search" />
      </div>
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr><th>No. Tagihan</th><th>Waktu</th><th>Pasien</th><th>Poli</th><th>Penjamin</th><th class="text-right">Total</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="8" />
          <tr v-for="t in items" :key="t.id">
            <td class="tabular-nums text-xs font-semibold">{{ t.no_tagihan }}</td>
            <td class="whitespace-nowrap text-slate-600">{{ waktu(t.created_at) }}</td>
            <!-- Tagihan mandiri (paket/produk) tidak punya kunjungan: pasien langsung, keterangan di kolom poli -->
            <td>
              <p class="font-medium">{{ (t.kunjungan?.pasien ?? t.pasien)?.nama ?? '-' }}</p>
              <p v-if="t.kunjungan?.pasien ?? t.pasien" class="text-xs text-slate-500">RM {{ (t.kunjungan?.pasien ?? t.pasien).no_rm }}</p>
            </td>
            <td>{{ t.kunjungan?.poli?.nama ?? t.keterangan ?? '-' }}</td>
            <td>{{ t.kunjungan ? PENJAMIN[t.kunjungan.penjamin] : '-' }}</td>
            <td class="text-right font-medium tabular-nums">{{ rupiah(t.grand_total) }}</td>
            <td>
              <StatusBadge :status="t.status" />
              <p v-if="t.metode_bayar" class="mt-0.5 text-[11px] text-slate-500">{{ METODE_BAYAR[t.metode_bayar] }}</p>
            </td>
            <td class="text-right">
              <RouterLink :to="`/kasir/${t.id}`" :class="t.status === 'belum_bayar' ? 'btn-primary' : 'btn-ghost'" class="btn btn-sm">
                {{ t.status === 'belum_bayar' ? 'Bayar' : 'Lihat' }}
              </RouterLink>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="8" class="py-10 text-center text-slate-400">Tidak ada tagihan.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>
</template>
