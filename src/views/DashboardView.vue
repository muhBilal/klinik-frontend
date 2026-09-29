<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import api, { errorMessage } from '@/lib/api'
import { angka, rupiah, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const data = ref(null)

const salam = computed(() => {
  const h = new Date().getHours()
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'
})

const statusCards = computed(() => {
  const s = data.value?.kunjungan.per_status ?? {}
  return [
    { label: 'Menunggu', value: s.menunggu, color: 'text-amber-600' },
    { label: 'Sedang diperiksa', value: s.diperiksa, color: 'text-sky-600' },
    { label: 'Menunggu bayar', value: s.menunggu_pembayaran, color: 'text-violet-600' },
    { label: 'Selesai', value: s.selesai, color: 'text-emerald-600' },
  ]
})

const maxPoli = computed(() => Math.max(1, ...(data.value?.kunjungan.per_poli ?? []).map((p) => p.kunjungans_count)))

const shortcuts = computed(() =>
  [
    { to: '/pendaftaran', label: 'Daftarkan pasien', roles: ['pendaftaran'] },
    { to: '/antrian', label: 'Buka antrian poli', roles: ['dokter', 'perawat'] },
    { to: '/farmasi/resep', label: 'Proses resep', roles: ['apoteker'] },
    { to: '/kasir', label: 'Buka kasir', roles: ['kasir'] },
  ].filter((s) => auth.hasRole(...s.roles)),
)

onMounted(async () => {
  try {
    data.value = (await api.get('/dashboard')).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
})
</script>

<template>
  <PageHeader :title="`${salam}, ${auth.user?.name}`" :subtitle="data ? `Ringkasan aktivitas klinik ${tanggal(data.tanggal)}` : 'Memuat ringkasan...'">
    <RouterLink v-for="s in shortcuts" :key="s.to" :to="s.to" class="btn btn-primary">{{ s.label }}</RouterLink>
  </PageHeader>

  <div v-if="data" class="space-y-5">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card card-body">
        <p class="text-sm text-slate-500">Kunjungan hari ini</p>
        <p class="mt-1 text-3xl font-semibold">{{ angka(data.kunjungan.total) }}</p>
        <p class="mt-1 text-xs text-slate-400">{{ data.kunjungan.per_status.batal }} dibatalkan</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-slate-500">Total pasien terdaftar</p>
        <p class="mt-1 text-3xl font-semibold">{{ angka(data.pasien_total) }}</p>
        <p class="mt-1 text-xs text-slate-400">+{{ data.pasien_baru_hari_ini }} pasien baru hari ini</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-slate-500">Resep menunggu</p>
        <p class="mt-1 text-3xl font-semibold">{{ angka(data.resep_menunggu) }}</p>
        <p class="mt-1 text-xs text-slate-400">{{ data.tagihan_belum_bayar }} tagihan belum dibayar</p>
      </div>
      <div v-if="auth.hasRole('kasir')" class="card card-body">
        <p class="text-sm text-slate-500">Pendapatan hari ini</p>
        <p class="mt-1 text-3xl font-semibold">{{ rupiah(data.pendapatan_hari_ini) }}</p>
        <p class="mt-1 text-xs text-slate-400">Dari tagihan berstatus lunas</p>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Status pelayanan hari ini</h2></div>
        <div class="card-body">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div v-for="c in statusCards" :key="c.label" class="rounded-lg bg-slate-50 p-4">
              <p :class="c.color" class="text-2xl font-semibold">{{ c.value ?? 0 }}</p>
              <p class="mt-0.5 text-xs text-slate-500">{{ c.label }}</p>
            </div>
          </div>

          <h3 class="mt-6 mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Kunjungan per poli</h3>
          <div class="space-y-3">
            <div v-for="p in data.kunjungan.per_poli" :key="p.id" class="flex items-center gap-3 text-sm">
              <span class="w-28 shrink-0 truncate text-slate-600">{{ p.nama }}</span>
              <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-brand-500" :style="{ width: `${(p.kunjungans_count / maxPoli) * 100}%` }" />
              </div>
              <span class="w-8 text-right font-medium tabular-nums">{{ p.kunjungans_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Stok obat menipis</h2>
          <RouterLink v-if="auth.hasRole('apoteker')" to="/farmasi/obat" class="text-xs font-medium text-brand-700 hover:underline">Kelola stok</RouterLink>
        </div>
        <ul v-if="data.obat_stok_menipis.length" class="divide-y divide-slate-100">
          <li v-for="o in data.obat_stok_menipis" :key="o.id" class="flex items-center justify-between px-5 py-2.5 text-sm">
            <span class="truncate">{{ o.nama }}</span>
            <span class="ml-3 shrink-0 font-medium text-rose-600 tabular-nums">{{ o.stok }} {{ o.satuan }}</span>
          </li>
        </ul>
        <p v-else class="card-body text-sm text-slate-400">Semua stok obat aman.</p>
      </div>
    </div>
  </div>
</template>
