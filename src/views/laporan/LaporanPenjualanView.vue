<script setup>
/**
 * Laporan penjualan (PRD LP-02): ringkasan periode, tren harian, per treatment, dokter, cabang, metode bayar & kategori.
 * Penjualan = tagihan yang dibayar dalam periode; refund mengurangi di periode refund-nya. Neto per treatment memakai alokasi
 * proporsional diskon & promo tagihan. Cakupan = cabang aktif (atau semua cabang untuk user lintas cabang).
 */
import { computed, onMounted, reactive, ref } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PeriodeFilter from '@/components/laporan/PeriodeFilter.vue'
import api, { errorMessage } from '@/lib/api'
import { KATEGORI_TAGIHAN, METODE_BAYAR, angka, hariIni, isoTanggal, rupiah, tanggal } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const klinik = useKlinikStore()
const toast = useToastStore()

const sekarang = new Date()
const periode = reactive({ mulai: isoTanggal(new Date(sekarang.getFullYear(), sekarang.getMonth(), 1)), selesai: hariIni() })
const data = ref(null)
const loading = ref(false)
// Hanya respons permintaan terakhir yang dipakai (ganti periode cepat tidak menampilkan data periode lama)
let urutan = 0

async function muat() {
  if (!periode.mulai || !periode.selesai) return
  const ini = ++urutan
  loading.value = true
  try {
    const hasil = (await api.get('/laporan/penjualan', { params: { ...periode } })).data
    if (ini === urutan) data.value = hasil
  } catch (e) {
    if (ini === urutan) toast.error(errorMessage(e))
  } finally {
    if (ini === urutan) loading.value = false
  }
}

const cakupan = computed(() => data.value?.cabang?.nama ?? (auth.lintasCabang ? 'Semua cabang' : klinik.nama))
const r = computed(() => data.value?.ringkasan)
const maxHari = computed(() => Math.max(1, ...(data.value?.per_hari ?? []).map((h) => h.penjualan_bersih)))
const totalDokter = computed(() => (data.value?.per_dokter ?? []).reduce((s, d) => s + d.penjualan_bersih, 0) || 1)
const persen = (n, total) => `${Math.round((n / total) * 100)}%`

onMounted(muat)
</script>

<template>
  <PageHeader title="Laporan Penjualan" :subtitle="`Penjualan per treatment, dokter, cabang & metode bayar · ${cakupan}`">
    <button class="btn btn-secondary" :disabled="!data" @click="printElement('#laporan-penjualan', 'Laporan penjualan')">Cetak</button>
  </PageHeader>

  <div class="card mb-5">
    <div class="card-body flex flex-wrap items-end justify-between gap-3">
      <PeriodeFilter v-model:mulai="periode.mulai" v-model:selesai="periode.selesai" @change="muat" />
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
  </div>

  <div v-if="data" id="laporan-penjualan" class="space-y-5 transition-opacity" :class="{ 'opacity-60': loading }">
    <p class="text-sm text-slate-500">
      <b class="text-slate-800">{{ klinik.nama }}</b> · {{ cakupan }} · {{ tanggal(data.periode.mulai) }} – {{ tanggal(data.periode.selesai) }}
    </p>

    <!-- Ringkasan -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card card-body border-brand-900 bg-brand-900 text-white inset-shadow-dark">
        <p class="text-sm font-medium text-white/60">Penjualan bersih</p>
        <p class="mt-2 truncate text-3xl font-semibold tracking-tight">{{ rupiah(r.penjualan_bersih) }}</p>
        <p class="mt-1 text-xs text-white/50">Setelah diskon & promo, sebelum pajak</p>
      </div>
      <div class="card card-body">
        <p class="text-sm font-medium text-slate-500">Transaksi</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{{ angka(r.transaksi) }}</p>
        <p class="mt-1 text-xs text-slate-500">Rata-rata {{ rupiah(r.transaksi ? Math.round(r.penjualan_bersih / r.transaksi) : 0) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm font-medium text-slate-500">Diskon & promo</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{{ rupiah(r.diskon + r.promo) }}</p>
        <p class="mt-1 text-xs text-slate-500">Bruto {{ rupiah(r.bruto) }} · promo {{ rupiah(r.promo) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm font-medium text-slate-500">Refund</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight" :class="r.refund.total + r.refund.paket_sisa ? 'text-rose-600' : 'text-slate-900'">
          {{ rupiah(r.refund.total + r.refund.paket_sisa) }}
        </p>
        <p class="mt-1 text-xs text-slate-500">{{ r.refund.transaksi }} tagihan<template v-if="r.refund.paket_sisa"> + sisa paket {{ rupiah(r.refund.paket_sisa) }}</template></p>
      </div>
    </div>
    <div class="card card-body grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div><p class="text-xs text-slate-500">Pajak</p><p class="font-semibold tabular-nums">{{ rupiah(r.pajak) }}</p></div>
      <div><p class="text-xs text-slate-500">Total diterima (incl. pajak)</p><p class="font-semibold tabular-nums">{{ rupiah(r.total) }}</p></div>
      <div><p class="text-xs text-slate-500">Dikurangi refund</p><p class="font-semibold tabular-nums">− {{ rupiah(r.refund.total + r.refund.paket_sisa) }}</p></div>
      <div><p class="text-xs text-slate-500">Total setelah refund</p><p class="font-semibold tabular-nums text-brand-800">{{ rupiah(r.total_setelah_refund) }}</p></div>
    </div>

    <!-- Tren harian -->
    <div class="card">
      <div class="card-header"><h2 class="card-title">Penjualan bersih per hari</h2></div>
      <div class="card-body space-y-2">
        <div v-for="h in data.per_hari" :key="h.tanggal" class="flex items-center gap-3 text-sm">
          <span class="w-24 shrink-0 text-slate-600">{{ tanggal(h.tanggal) }}</span>
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06]">
            <div class="h-full rounded-full bg-brand-900" :style="{ width: `${(h.penjualan_bersih / maxHari) * 100}%` }" />
          </div>
          <span class="w-32 shrink-0 text-right tabular-nums">{{ rupiah(h.penjualan_bersih) }}</span>
          <span class="hidden w-16 shrink-0 text-right text-xs text-slate-500 sm:block">{{ h.transaksi }} trx</span>
        </div>
        <p v-if="!data.per_hari.length" class="text-sm text-slate-400">Belum ada penjualan pada periode ini.</p>
      </div>
    </div>

    <!-- Per treatment -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Per treatment & jasa konsultasi</h2>
        <span class="text-xs text-slate-500">Neto = setelah alokasi diskon & promo · sesi paket ditagih Rp 0, bernilai per sesi</span>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr><th>Treatment</th><th class="text-right">Jumlah</th><th class="text-right">Bruto</th><th class="text-right">Neto</th><th class="text-right">Sesi paket</th><th class="text-right">Nilai sesi paket</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in data.per_treatment" :key="t.tindakan_id">
              <td>
                <p class="font-medium">{{ t.nama }}</p>
                <p class="text-xs text-slate-500">{{ t.kode }}<template v-if="t.kategori"> · {{ t.kategori }}</template></p>
              </td>
              <td class="text-right tabular-nums">{{ angka(t.jumlah) }}</td>
              <td class="text-right tabular-nums">{{ rupiah(t.bruto) }}</td>
              <td class="text-right font-medium tabular-nums">{{ rupiah(t.neto) }}</td>
              <td class="text-right tabular-nums">{{ t.sesi_paket ? angka(t.sesi_paket) : '-' }}</td>
              <td class="text-right tabular-nums">{{ t.nilai_sesi_paket ? rupiah(t.nilai_sesi_paket) : '-' }}</td>
            </tr>
            <tr v-if="!data.per_treatment.length"><td colspan="6" class="py-6 text-center text-slate-400">Belum ada treatment terjual.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <!-- Per dokter -->
      <div class="card">
        <div class="card-header"><h2 class="card-title">Per dokter</h2></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Dokter</th><th class="text-right">Transaksi</th><th class="text-right">Penjualan bersih</th><th class="text-right">Porsi</th></tr></thead>
            <tbody>
              <tr v-for="d in data.per_dokter" :key="d.nama">
                <td :class="{ 'text-slate-500': !d.dokter_id }">{{ d.nama }}</td>
                <td class="text-right tabular-nums">{{ angka(d.transaksi) }}</td>
                <td class="text-right font-medium tabular-nums">{{ rupiah(d.penjualan_bersih) }}</td>
                <td class="text-right tabular-nums text-slate-500">{{ persen(d.penjualan_bersih, totalDokter) }}</td>
              </tr>
              <tr v-if="!data.per_dokter.length"><td colspan="4" class="py-6 text-center text-slate-400">-</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per metode bayar -->
      <div class="card">
        <div class="card-header"><h2 class="card-title">Per metode bayar</h2><span class="text-xs text-slate-500">Tunai tanpa kembalian</span></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Metode</th><th class="text-right">Diterima</th><th class="text-right">Dikembalikan</th><th class="text-right">Bersih</th></tr></thead>
            <tbody>
              <tr v-for="m in data.per_metode" :key="m.metode">
                <td>{{ METODE_BAYAR[m.metode] ?? m.metode }}</td>
                <td class="text-right tabular-nums">{{ rupiah(m.diterima) }}</td>
                <td class="text-right tabular-nums" :class="{ 'text-rose-600': m.dikembalikan }">{{ m.dikembalikan ? `− ${rupiah(m.dikembalikan)}` : '-' }}</td>
                <td class="text-right font-medium tabular-nums">{{ rupiah(m.bersih) }}</td>
              </tr>
              <tr v-if="!data.per_metode.length"><td colspan="4" class="py-6 text-center text-slate-400">-</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per cabang -->
      <div class="card">
        <div class="card-header"><h2 class="card-title">Per cabang</h2></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Cabang</th><th class="text-right">Transaksi</th><th class="text-right">Penjualan bersih</th><th class="text-right">Total (incl. pajak)</th></tr></thead>
            <tbody>
              <tr v-for="c in data.per_cabang" :key="c.cabang_id">
                <td>{{ c.nama }}</td>
                <td class="text-right tabular-nums">{{ angka(c.transaksi) }}</td>
                <td class="text-right font-medium tabular-nums">{{ rupiah(c.penjualan_bersih) }}</td>
                <td class="text-right tabular-nums">{{ rupiah(c.total) }}</td>
              </tr>
              <tr v-if="!data.per_cabang.length"><td colspan="4" class="py-6 text-center text-slate-400">-</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per kategori -->
      <div class="card">
        <div class="card-header"><h2 class="card-title">Per kategori</h2></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Kategori</th><th class="text-right">Jumlah</th><th class="text-right">Bruto</th><th class="text-right">Neto</th></tr></thead>
            <tbody>
              <tr v-for="k in data.per_kategori" :key="k.kategori">
                <td>{{ KATEGORI_TAGIHAN[k.kategori] ?? k.kategori }}</td>
                <td class="text-right tabular-nums">{{ angka(k.jumlah) }}</td>
                <td class="text-right tabular-nums">{{ rupiah(k.bruto) }}</td>
                <td class="text-right font-medium tabular-nums">{{ rupiah(k.neto) }}</td>
              </tr>
              <tr v-if="!data.per_kategori.length"><td colspan="4" class="py-6 text-center text-slate-400">-</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="loading" class="flex items-center gap-2 text-slate-500"><AppSpinner />Memuat laporan...</div>
</template>
