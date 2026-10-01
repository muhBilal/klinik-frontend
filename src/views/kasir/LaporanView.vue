<script setup>
/**
 * Laporan keuangan (PRD LP-02 penjualan, LP-03 paket, AD-01 konsolidasi, LP-06 ekspor CSV sebagian) untuk cabang aktif,
 * atau semua cabang bagi pengguna lintas cabang tanpa pilihan cabang.
 * Penjualan dihitung pada tanggal bayar; refund mengurangi tanggal refund. Nilai per treatment/kategori = sebelum pajak, setelah diskon & promo.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import api, { errorMessage } from '@/lib/api'
import { METODE_BAYAR, angka, hariIni, isoTanggal, rupiah, tambahHari, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()

const tab = ref('penjualan')
const KELOMPOK = [
  { value: 'treatment', label: 'Per treatment' },
  { value: 'kategori', label: 'Per kategori' },
  { value: 'dokter', label: 'Per dokter' },
  { value: 'metode', label: 'Per metode bayar' },
  { value: 'cabang', label: 'Per cabang' },
]

const awalBulan = () => {
  const d = new Date()
  return isoTanggal(new Date(d.getFullYear(), d.getMonth(), 1))
}
const rentang = reactive({ dari: awalBulan(), sampai: hariIni() })
const kelompok = ref('treatment')

const PRESET = [
  { label: 'Hari ini', fn: () => [hariIni(), hariIni()] },
  { label: '7 hari', fn: () => [tambahHari(hariIni(), -6), hariIni()] },
  { label: 'Bulan ini', fn: () => [awalBulan(), hariIni()] },
  {
    label: 'Bulan lalu',
    fn: () => {
      const d = new Date()
      return [isoTanggal(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoTanggal(new Date(d.getFullYear(), d.getMonth(), 0))]
    },
  },
]
function pakaiPreset(p) {
  ;[rentang.dari, rentang.sampai] = p.fn()
}

const data = ref(null)
const loading = ref(false)
let urut = 0

async function muat() {
  const u = ++urut
  loading.value = true
  try {
    const url = tab.value === 'penjualan' ? '/laporan/penjualan' : '/laporan/paket'
    const params = { ...rentang, ...(tab.value === 'penjualan' ? { kelompok: kelompok.value } : {}) }
    const res = (await api.get(url, { params })).data
    if (u === urut) data.value = res
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    if (u === urut) loading.value = false
  }
}
watch([() => rentang.dari, () => rentang.sampai, kelompok], muat)
watch(tab, () => {
  data.value = null
  muat()
})

const unduh = ref(false)
async function csv() {
  unduh.value = true
  try {
    const url = tab.value === 'penjualan' ? '/laporan/penjualan' : '/laporan/paket'
    const res = await api.get(url, { params: { ...rentang, kelompok: kelompok.value, format: 'csv' }, responseType: 'blob' })
    const nama = res.headers['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1] ?? 'laporan.csv'
    const href = URL.createObjectURL(res.data)
    const a = Object.assign(document.createElement('a'), { href, download: nama })
    a.click()
    URL.revokeObjectURL(href)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    unduh.value = false
  }
}

const r = computed(() => data.value?.ringkasan)
const labelBaris = (b) => (kelompok.value === 'metode' ? METODE_BAYAR[b.kunci] ?? b.kunci : b.label)
const lingkup = computed(() => auth.cabang?.nama ?? (auth.lintasCabang ? 'semua cabang' : 'klinik'))

onMounted(muat)
</script>

<template>
  <PageHeader title="Laporan" :subtitle="`Penjualan & paket · ${lingkup}`">
    <button class="btn btn-secondary" :disabled="unduh || !data" @click="csv"><AppSpinner v-if="unduh" />Unduh CSV</button>
  </PageHeader>

  <div class="card mb-5">
    <div class="card-body flex flex-wrap items-end gap-3">
      <div class="tabs">
        <button class="tab" :class="{ 'tab-active': tab === 'penjualan' }" @click="tab = 'penjualan'">Penjualan</button>
        <button class="tab" :class="{ 'tab-active': tab === 'paket' }" @click="tab = 'paket'">Paket & kewajiban</button>
      </div>
      <div>
        <label class="label" for="lap-dari">Dari</label>
        <input id="lap-dari" v-model="rentang.dari" type="date" class="input w-auto py-1.5" :max="rentang.sampai" />
      </div>
      <div>
        <label class="label" for="lap-sampai">Sampai</label>
        <input id="lap-sampai" v-model="rentang.sampai" type="date" class="input w-auto py-1.5" :min="rentang.dari" />
      </div>
      <div class="flex flex-wrap gap-1">
        <button v-for="p in PRESET" :key="p.label" class="btn btn-ghost btn-sm" @click="pakaiPreset(p)">{{ p.label }}</button>
      </div>
      <div v-if="tab === 'penjualan'" class="ml-auto">
        <label class="label" for="lap-kelompok">Kelompokkan</label>
        <select id="lap-kelompok" v-model="kelompok" class="input w-auto py-1.5">
          <option v-for="k in KELOMPOK" :key="k.value" :value="k.value">{{ k.label }}</option>
        </select>
      </div>
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
  </div>

  <!-- Penjualan -->
  <template v-if="tab === 'penjualan'">
    <div v-if="r" class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card card-body">
        <p class="text-sm text-slate-500">Transaksi lunas</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ angka(r.transaksi) }}</p>
        <p class="mt-1 text-xs text-slate-500">Bruto {{ rupiah(r.bruto) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-slate-500">Diskon & promo</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ rupiah(r.diskon + r.promo) }}</p>
        <p class="mt-1 text-xs text-slate-500">Diskon {{ rupiah(r.diskon) }} · promo {{ rupiah(r.promo) }} · pajak {{ rupiah(r.pajak) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-slate-500">Refund</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums" :class="{ 'text-rose-600': r.refund }">{{ rupiah(r.refund) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ r.refund_transaksi }} transaksi</p>
      </div>
      <div class="card card-body border-brand-900 bg-brand-900 text-white inset-shadow-dark">
        <p class="text-sm text-white/60">Pendapatan bersih</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ rupiah(r.bersih) }}</p>
        <p class="mt-1 text-xs text-white/50">Neto {{ rupiah(r.neto) }} − refund</p>
      </div>
    </div>

    <div class="card">
      <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && data }">
        <table class="table">
          <thead>
            <tr v-if="kelompok === 'metode'">
              <th>Metode</th><th class="text-right">Transaksi</th><th class="text-right">Masuk</th><th class="text-right">Refund</th><th class="text-right">Bersih</th>
            </tr>
            <tr v-else-if="['treatment', 'kategori'].includes(kelompok)">
              <th>{{ kelompok === 'treatment' ? 'Treatment' : 'Kategori' }}</th><th class="text-right">Jumlah</th><th class="text-right">Sesi paket</th>
              <th class="text-right">Bruto</th><th class="text-right">Neto*</th><th class="text-right">Refund</th><th class="text-right">Bersih</th>
            </tr>
            <tr v-else>
              <th>{{ kelompok === 'dokter' ? 'Dokter' : 'Cabang' }}</th><th class="text-right">Transaksi</th><th class="text-right">Bruto</th>
              <th class="text-right">Diskon + promo</th><th class="text-right">Neto</th><th class="text-right">Refund</th><th class="text-right">Bersih</th>
            </tr>
          </thead>
          <tbody>
            <TableSkeleton v-if="loading && !data" :cols="7" />
            <tr v-for="b in data?.baris ?? []" :key="b.kunci">
              <td>
                <p class="font-medium">{{ labelBaris(b) }}</p>
                <p v-if="b.grup || b.kode" class="text-xs text-slate-500">{{ [b.kode, b.grup].filter(Boolean).join(' · ') }}</p>
              </td>
              <template v-if="kelompok === 'metode'">
                <td class="text-right tabular-nums">{{ b.transaksi }}</td>
                <td class="text-right tabular-nums">{{ rupiah(b.masuk) }}</td>
                <td class="text-right tabular-nums" :class="{ 'text-rose-600': b.refund }">{{ rupiah(b.refund) }}</td>
              </template>
              <template v-else-if="['treatment', 'kategori'].includes(kelompok)">
                <td class="text-right tabular-nums">{{ angka(b.jumlah) }}</td>
                <td class="text-right tabular-nums text-slate-500">{{ b.sesi_paket ? angka(b.sesi_paket) : '-' }}</td>
                <td class="text-right tabular-nums">{{ rupiah(b.bruto) }}</td>
                <td class="text-right tabular-nums">{{ rupiah(b.neto) }}</td>
                <td class="text-right tabular-nums" :class="{ 'text-rose-600': b.refund }">{{ rupiah(b.refund) }}</td>
              </template>
              <template v-else>
                <td class="text-right tabular-nums">{{ b.transaksi }}</td>
                <td class="text-right tabular-nums">{{ rupiah(b.bruto) }}</td>
                <td class="text-right tabular-nums">{{ rupiah(b.potongan) }}</td>
                <td class="text-right tabular-nums">{{ rupiah(b.neto) }}</td>
                <td class="text-right tabular-nums" :class="{ 'text-rose-600': b.refund }">{{ rupiah(b.refund) }}</td>
              </template>
              <td class="text-right font-semibold tabular-nums">{{ rupiah(b.bersih) }}</td>
            </tr>
            <tr v-if="data && !data.baris.length"><td colspan="7" class="py-10 text-center text-slate-400">Tidak ada penjualan di rentang ini.</td></tr>
          </tbody>
        </table>
      </div>
      <p v-if="['treatment', 'kategori'].includes(kelompok)" class="px-5 py-3 text-xs text-slate-500">
        * Neto = nilai sebelum pajak setelah porsi diskon & promo tagihan. Sesi paket (Rp 0 di tagihan) dihitung saat paket terjual & di laporan paket.
      </p>
    </div>
  </template>

  <!-- Paket (LP-03) -->
  <template v-else>
    <div v-if="r" class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card card-body">
        <p class="text-sm text-slate-500">Paket terjual</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ rupiah(r.terjual.nilai) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ r.terjual.paket }} paket · refund {{ rupiah(r.direfund.nilai) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-slate-500">Sesi terpakai (diakui)</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ rupiah(r.terpakai.nilai) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ angka(r.terpakai.sesi) }} sesi</p>
      </div>
      <div class="card card-body border-brand-900 bg-brand-900 text-white inset-shadow-dark">
        <p class="text-sm text-white/60">Kewajiban sisa sesi</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ rupiah(r.kewajiban.nilai) }}</p>
        <p class="mt-1 text-xs text-white/50">{{ r.kewajiban.paket }} paket · {{ angka(r.kewajiban.sesi) }} sesi · per {{ tanggal(data.per_tanggal) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-slate-500">Kedaluwarsa bersisa</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums" :class="{ 'text-amber-700': r.kedaluwarsa_bersisa.nilai }">{{ rupiah(r.kedaluwarsa_bersisa.nilai) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ r.kedaluwarsa_bersisa.paket }} paket · {{ angka(r.kedaluwarsa_bersisa.sesi) }} sesi tidak terpakai</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Per paket</h2></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Paket</th><th class="text-right">Terjual</th><th class="text-right">Terpakai</th><th class="text-right">Sisa sesi</th><th class="text-right">Kewajiban</th></tr></thead>
            <tbody>
              <tr v-for="p in data?.per_paket ?? []" :key="p.kunci">
                <td class="font-medium">{{ p.label }}</td>
                <td class="text-right tabular-nums">{{ p.terjual }} · {{ rupiah(p.nilai_terjual) }}</td>
                <td class="text-right tabular-nums">{{ p.sesi_terpakai }} · {{ rupiah(p.nilai_terpakai) }}</td>
                <td class="text-right tabular-nums">{{ p.sesi_sisa }}</td>
                <td class="text-right font-semibold tabular-nums">{{ rupiah(p.kewajiban) }}</td>
              </tr>
              <tr v-if="data && !data.per_paket?.length"><td colspan="5" class="py-8 text-center text-slate-400">Belum ada paket.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h2 class="card-title">Paket pasien dengan sisa sesi</h2><span class="text-xs text-slate-500">CSV memuat seluruh daftar</span></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Pasien</th><th>Paket</th><th>Berlaku s.d.</th><th class="text-right">Sisa</th></tr></thead>
            <tbody>
              <tr v-for="k in (data?.kewajiban ?? []).slice(0, 50)" :key="k.no_paket">
                <td>{{ k.pasien }} <span class="text-xs text-slate-500">· {{ k.no_rm }}</span></td>
                <td class="text-xs">{{ k.nama }}<span class="block text-slate-400">{{ k.no_paket }}</span></td>
                <td class="whitespace-nowrap text-xs">{{ k.berlaku_sampai ? tanggal(k.berlaku_sampai) : 'tanpa batas' }}</td>
                <td class="text-right tabular-nums">{{ k.sesi_sisa }} sesi<span class="block text-xs text-slate-500">{{ rupiah(k.nilai_sisa) }}</span></td>
              </tr>
              <tr v-if="data && !data.kewajiban?.length"><td colspan="4" class="py-8 text-center text-slate-400">Tidak ada sisa kewajiban.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </template>
</template>
