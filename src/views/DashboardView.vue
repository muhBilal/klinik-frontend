<script setup>
import { computed, onMounted } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import { useDetail } from '@/composables/useDetail'
import { angka, rupiah, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { data, error, load } = useDetail('/dashboard')

const salam = computed(() => {
  const h = new Date().getHours()
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'
})

// Kartu ringkasan: ikon dalam lingkaran putih; pendapatan jadi kartu aksen hitam (dark)
const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    {
      label: 'Kunjungan hari ini',
      value: angka(d.kunjungan.total),
      note: `${d.kunjungan.per_status.batal} dibatalkan`,
      icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
    },
    {
      label: 'Total pasien terdaftar',
      value: angka(d.pasien_total),
      note: `+${d.pasien_baru_hari_ini} pasien baru hari ini`,
      icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    },
    {
      label: 'Resep menunggu',
      value: angka(d.resep_menunggu),
      note: `${d.tagihan_belum_bayar} tagihan belum dibayar`,
      icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
    },
    auth.can('laporan.keuangan') && {
      label: 'Pendapatan hari ini',
      value: rupiah(d.pendapatan_hari_ini),
      note: 'Dari tagihan berstatus lunas',
      dark: true,
      icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    },
  ].filter(Boolean)
})

const statusCards = computed(() => {
  const s = data.value?.kunjungan.per_status ?? {}
  return [
    { label: 'Menunggu', value: s.menunggu, dot: 'bg-orange-600' },
    { label: 'Sedang diperiksa', value: s.diperiksa, dot: 'bg-indigo-500' },
    { label: 'Menunggu bayar', value: s.menunggu_pembayaran, dot: 'bg-violet-500' },
    { label: 'Selesai', value: s.selesai, dot: 'bg-emerald-600' },
  ]
})

const maxPoli = computed(() => Math.max(1, ...(data.value?.kunjungan.per_poli ?? []).map((p) => p.kunjungans_count)))

const shortcuts = computed(() =>
  [
    { to: '/pendaftaran', label: 'Daftarkan pasien', izin: ['kunjungan.daftar'] },
    { to: '/antrian', label: 'Buka antrian poli', izin: ['pemeriksaan.panggil'] },
    { to: '/farmasi/resep', label: 'Proses resep', izin: ['farmasi.resep'] },
    { to: '/kasir', label: 'Buka kasir', izin: ['kasir.tagihan'] },
  ].filter((s) => auth.can(...s.izin)),
)

onMounted(load)
</script>

<template>
  <PageHeader :title="`${salam}, ${auth.user?.name}`" :subtitle="data ? `Ringkasan aktivitas ${auth.cabang?.nama ?? (auth.lintasCabang ? 'semua cabang' : 'klinik')} · ${tanggal(data.tanggal)}` : 'Memuat ringkasan...'">
    <RouterLink v-for="s in shortcuts" :key="s.to" :to="s.to" :class="shortcuts.length === 1 ? 'btn-primary' : 'btn-secondary'" class="btn">{{ s.label }}</RouterLink>
  </PageHeader>

  <div v-if="data" class="space-y-5">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="s in stats"
        :key="s.label"
        :class="s.dark ? 'border-brand-900 bg-brand-900 text-white inset-shadow-dark' : ''"
        class="card card-body"
      >
        <div class="flex items-start justify-between gap-3">
          <p :class="s.dark ? 'text-white/60' : 'text-slate-500'" class="text-sm font-medium">{{ s.label }}</p>
          <span :class="s.dark ? 'border-white/15 bg-white/10 text-white' : ''" class="icon-circle">
            <AppIcon :path="s.icon" size="size-4.5" />
          </span>
        </div>
        <p :class="s.dark ? 'text-white' : 'text-slate-900'" class="mt-3 truncate text-4xl font-semibold tracking-tight">{{ s.value }}</p>
        <p :class="s.dark ? 'text-white/50' : 'text-slate-500'" class="mt-1 text-xs">{{ s.note }}</p>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Status pelayanan hari ini</h2></div>
        <div class="card-body">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div v-for="c in statusCards" :key="c.label" class="tile">
              <p class="text-3xl font-semibold tracking-tight text-slate-900">{{ c.value ?? 0 }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><span :class="c.dot" class="size-2 rounded-full" />{{ c.label }}</p>
            </div>
          </div>

          <h3 class="mt-7 mb-3 text-sm font-semibold text-slate-900">Kunjungan per poli</h3>
          <div class="space-y-3">
            <div v-for="p in data.kunjungan.per_poli" :key="p.id" class="flex items-center gap-3 text-sm">
              <span class="w-28 shrink-0 truncate text-slate-600">{{ p.nama }}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06]">
                <div class="h-full rounded-full bg-brand-900 transition-[width] duration-500" :style="{ width: `${(p.kunjungans_count / maxPoli) * 100}%` }" />
              </div>
              <span class="w-8 text-right font-medium tabular-nums">{{ p.kunjungans_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Stok obat menipis</h2>
          <RouterLink v-if="auth.can('farmasi.obat')" to="/farmasi/obat" class="text-xs font-medium text-brand-700 hover:underline">Kelola stok</RouterLink>
        </div>
        <ul v-if="data.obat_stok_menipis.length" class="divide-y divide-line">
          <li v-for="o in data.obat_stok_menipis" :key="o.id" class="flex items-center justify-between px-6 py-3 text-sm">
            <span class="truncate">{{ o.nama }}</span>
            <span class="ml-3 shrink-0 rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-semibold text-white tabular-nums shadow-sm">{{ o.stok }} {{ o.satuan }}</span>
          </li>
        </ul>
        <p v-else class="card-body text-sm text-slate-400">Semua stok obat aman.</p>
      </div>
    </div>
  </div>

  <PageLoading v-else-if="error" :error="error" @retry="load" />

  <!-- Skeleton selama ringkasan dimuat -->
  <div v-else class="space-y-5" aria-busy="true">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="card card-body space-y-3">
        <div class="h-3.5 w-1/2 animate-pulse rounded bg-slate-200/70" />
        <div class="h-8 w-1/3 animate-pulse rounded bg-slate-200/70" />
        <div class="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
    <div class="grid gap-5 lg:grid-cols-3">
      <div class="card card-body h-72 animate-pulse bg-white/30 lg:col-span-2" />
      <div class="card card-body h-72 animate-pulse bg-white/30" />
    </div>
  </div>
</template>
