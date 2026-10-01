<script setup>
/**
 * Detail tagihan & pembayaran kasir (PRD BL-01..03, BL-06, TR-06).
 * Split payment: beberapa baris metode; hanya tunai yang boleh berlebih (kembalian). Diskon di atas batas peran → form persetujuan
 * atasan di tempat (email + password, izin `kasir.diskon`). Void (belum bayar) & refund (lunas) untuk pemegang `kasir.void`.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDetail } from '@/composables/useDetail'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { METODE_BAYAR, PENJAMIN, rupiah, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const auth = useAuthStore()
const klinik = useKlinikStore()
const toast = useToastStore()
const { data: tagihan, error, load: fetchTagihan } = useDetail(() => `/tagihans/${route.params.id}`)
// Kop struk: alamat & telepon cabang, bila kosong memakai identitas klinik di Pengaturan
const kontak = computed(() => {
  const c = tagihan.value?.cabang
  const k = klinik.info?.klinik
  return [c?.alamat ?? k?.alamat, c?.telepon ?? k?.telepon].filter(Boolean).join(' · ')
})
const errors = ref({})
const processing = ref(false)
const bayar = reactive({ diskon: 0, baris: [{ metode: 'tunai', jumlah: '', referensi: '' }] })
const persetujuan = reactive({ perlu: false, email: '', password: '' })
const kodePromo = ref('')
const memasangPromo = ref(false)

const KATEGORI = { konsultasi: 'Konsultasi', tindakan: 'Tindakan', obat: 'Obat', produk: 'Produk', paket: 'Paket', deposit: 'Deposit', lainnya: 'Lainnya' }

// Tagihan mandiri (penjualan paket/produk) tidak punya kunjungan: pasien langsung dari tagihan.
const pasien = computed(() => tagihan.value?.kunjungan?.pasien ?? tagihan.value?.pasien)
const subjudul = computed(() => [pasien.value?.nama, tagihan.value?.kunjungan?.poli?.nama ?? tagihan.value?.keterangan].filter(Boolean).join(' · '))
const lunas = computed(() => tagihan.value?.status === 'lunas')

/** Sama dengan KasirService::hitungGrandTotal: pajak dari nilai setelah diskon manual + potongan promo. */
const grandTotal = computed(() => {
  const t = tagihan.value
  if (!t) return 0
  const setelahDiskon = Math.max(0, t.total - Number(bayar.diskon || 0) - t.diskon_promo)
  return setelahDiskon + Math.round((setelahDiskon * (t.pajak_persen ?? 0)) / 100)
})
const pajak = computed(() => (lunas.value ? tagihan.value.pajak : grandTotal.value - Math.max(0, tagihan.value.total - Number(bayar.diskon || 0) - tagihan.value.diskon_promo)))
const totalDibayar = computed(() => bayar.baris.reduce((n, b) => n + Number(b.jumlah || 0), 0))
const totalNonTunai = computed(() => bayar.baris.filter((b) => b.metode !== 'tunai').reduce((n, b) => n + Number(b.jumlah || 0), 0))
const sisa = computed(() => Math.max(0, grandTotal.value - totalDibayar.value))
const kembalian = computed(() => Math.max(0, totalDibayar.value - grandTotal.value))
const nonTunaiLebih = computed(() => totalNonTunai.value > grandTotal.value)
/** Nominal cepat untuk baris tunai: sisa yang belum tertutup baris lain, lalu pembulatan ke atas. */
function pecahan(b) {
  const lain = totalDibayar.value - Number(b.jumlah || 0)
  const g = Math.max(0, grandTotal.value - lain)
  return [...new Set([g, Math.ceil(g / 50000) * 50000, Math.ceil(g / 100000) * 100000, Math.ceil(g / 100000) * 100000 + 100000])].filter((v) => v > 0)
}
/** "Ditanggung penjamin" hanya untuk kunjungan BPJS/asuransi. */
const METODE_SPLIT = computed(() => {
  const penjamin = tagihan.value?.kunjungan?.penjamin
  return Object.entries(METODE_BAYAR).filter(([k]) => k !== 'penjamin' || (penjamin && penjamin !== 'umum'))
})

function tambahBaris() {
  const dipakai = bayar.baris.map((b) => b.metode)
  const metode = ['qris', 'debit', 'transfer', 'tunai'].find((m) => !dipakai.includes(m)) ?? 'qris'
  bayar.baris.push({ metode, jumlah: sisa.value || '', referensi: '' })
}

function isiPas(b) {
  b.jumlah = Math.max(0, grandTotal.value - (totalDibayar.value - Number(b.jumlah || 0)))
}

async function load() {
  const data = await fetchTagihan()
  if (data) bayar.baris = [{ metode: (data.kunjungan?.penjamin ?? 'umum') === 'umum' ? 'tunai' : 'penjamin', jumlah: '', referensi: '' }]
}

async function pasangPromo() {
  if (!kodePromo.value.trim()) return
  memasangPromo.value = true
  errors.value = {}
  try {
    tagihan.value = (await api.post(`/tagihans/${route.params.id}/promo`, { kode: kodePromo.value })).data
    toast.success(`Kode ${tagihan.value.promo.kode} dipasang: potongan ${rupiah(tagihan.value.diskon_promo)}.`)
    kodePromo.value = ''
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    memasangPromo.value = false
  }
}

async function lepasPromo() {
  memasangPromo.value = true
  try {
    tagihan.value = (await api.delete(`/tagihans/${route.params.id}/promo`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memasangPromo.value = false
  }
}

async function prosesBayar() {
  processing.value = true
  errors.value = {}
  try {
    const { data } = await api.post(`/tagihans/${route.params.id}/bayar`, {
      // Baris non-tunai tanpa nominal dianggap pas sisa tagihan
      pembayarans: bayar.baris
        .map((b) => ({ metode: b.metode, jumlah: Number(b.jumlah || 0), referensi: b.referensi || null }))
        .filter((b) => b.jumlah > 0),
      diskon: Number(bayar.diskon || 0),
      persetujuan: persetujuan.perlu && persetujuan.email ? { email: persetujuan.email, password: persetujuan.password } : undefined,
    })
    // Respons sudah berbentuk sama dengan detail (struk) -> tidak perlu GET ulang
    tagihan.value = data
    Object.assign(persetujuan, { perlu: false, email: '', password: '' })
    const paket = data.paket_pasiens?.length ? ` Paket ${data.paket_pasiens.map((p) => p.no_paket).join(', ')} aktif.` : ''
    toast.success(`Pembayaran berhasil.${data.kembalian ? ` Kembalian ${rupiah(data.kembalian)}.` : ''}${paket}`)
  } catch (e) {
    errors.value = validationErrors(e)
    if (errors.value.perlu_persetujuan) persetujuan.perlu = true
    persetujuan.password = ''
    toast.error(errorMessage(e))
  } finally {
    processing.value = false
  }
}

// Void (belum bayar) & refund (lunas) — BL-06
const voidOpen = ref(false)
const alasan = ref('')
const voiding = ref(false)
const jenisVoid = computed(() => (lunas.value ? 'refund' : 'batal'))

function bukaVoid() {
  alasan.value = ''
  errors.value = {}
  voidOpen.value = true
}

async function prosesVoid() {
  voiding.value = true
  errors.value = {}
  try {
    const kunci = lunas.value ? 'alasan_refund' : 'alasan_batal'
    tagihan.value = (await api.post(`/tagihans/${route.params.id}/${jenisVoid.value}`, { [kunci]: alasan.value })).data
    toast.success(jenisVoid.value === 'refund' ? 'Pembayaran direfund. Kunjungan kembali menunggu pembayaran.' : 'Tagihan dibatalkan.')
    voidOpen.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    voiding.value = false
  }
}

const dikembalikan = computed(() => (tagihan.value?.pembayarans ?? []).some((p) => p.dikembalikan_at))

onMounted(load)
</script>

<template>
  <template v-if="tagihan">
    <PageHeader :title="`Tagihan ${tagihan.no_tagihan}`" :subtitle="subjudul">
      <RouterLink to="/kasir" class="btn btn-secondary">Kembali</RouterLink>
      <button v-if="lunas" class="btn btn-primary" @click="printElement('#struk', `Struk ${tagihan.no_tagihan}`, { lebar: klinik.info?.cetak?.lebar_struk })">Cetak struk</button>
    </PageHeader>

    <!-- grid-cols-1: kolom mobile minmax(0,1fr) agar tabel struk tidak melebarkan halaman -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <!-- Rincian / struk -->
      <div class="card lg:col-span-3">
        <div id="struk" class="card-body">
          <div class="mb-4 flex items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-4">
            <div>
              <p class="font-semibold">{{ klinik.nama }}<template v-if="tagihan.cabang"> · {{ tagihan.cabang.nama }}</template></p>
              <p v-if="kontak" class="text-xs text-slate-500">{{ kontak }}</p>
              <p class="text-xs text-slate-500">Bukti Pembayaran{{ tagihan.kunjungan ? ' Pelayanan' : '' }}</p>
            </div>
            <div class="text-right text-xs text-slate-500">
              <p class="tabular-nums font-semibold text-slate-700">{{ tagihan.no_tagihan }}</p>
              <p>{{ tanggal(tagihan.kunjungan?.tanggal ?? tagihan.created_at) }}</p>
            </div>
          </div>
          <dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <template v-if="pasien"><dt class="text-slate-500">Pasien</dt><dd>{{ pasien.nama }} ({{ pasien.no_rm }})</dd></template>
            <template v-if="tagihan.kunjungan">
              <dt class="text-slate-500">Poli</dt><dd>{{ tagihan.kunjungan.poli.nama }} · {{ tagihan.kunjungan.dokter?.name ?? '-' }}</dd>
              <dt class="text-slate-500">Penjamin</dt><dd>{{ PENJAMIN[tagihan.kunjungan.penjamin] }}</dd>
            </template>
            <template v-else-if="tagihan.keterangan"><dt class="text-slate-500">Keterangan</dt><dd>{{ tagihan.keterangan }}</dd></template>
          </dl>
          <div class="overflow-x-auto">
            <table class="table">
              <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Harga</th><th class="text-right">Subtotal</th></tr></thead>
              <tbody>
                <tr v-for="i in tagihan.items" :key="i.id">
                  <td><span class="mr-1.5 text-[11px] text-slate-400 uppercase">{{ KATEGORI[i.kategori] ?? i.kategori }}</span>{{ i.deskripsi }}</td>
                  <td class="text-right tabular-nums">{{ i.jumlah }}</td>
                  <td class="text-right tabular-nums">{{ rupiah(i.harga) }}</td>
                  <td class="text-right tabular-nums">{{ rupiah(i.subtotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl class="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
            <div class="flex justify-between"><dt class="text-slate-500">Total</dt><dd class="tabular-nums">{{ rupiah(tagihan.total) }}</dd></div>
            <div v-if="tagihan.diskon_promo" class="flex justify-between">
              <dt class="text-slate-500">Promo {{ tagihan.promo?.kode }}</dt><dd class="tabular-nums">-{{ rupiah(tagihan.diskon_promo) }}</dd>
            </div>
            <div class="flex justify-between"><dt class="text-slate-500">Diskon</dt><dd class="tabular-nums">-{{ rupiah(lunas ? tagihan.diskon : bayar.diskon) }}</dd></div>
            <div v-if="tagihan.pajak_persen" class="flex justify-between">
              <dt class="text-slate-500">Pajak {{ tagihan.pajak_persen }}%</dt><dd class="tabular-nums">{{ rupiah(pajak) }}</dd>
            </div>
            <div class="flex justify-between border-t border-line pt-1 text-base font-semibold">
              <dt>Grand total</dt><dd class="tabular-nums">{{ rupiah(lunas ? tagihan.grand_total : grandTotal) }}</dd>
            </div>
            <template v-if="lunas || dikembalikan">
              <div v-for="p in tagihan.pembayarans" :key="p.id" class="flex justify-between" :class="{ 'text-slate-400 line-through': p.dikembalikan_at }">
                <dt class="text-slate-500">{{ METODE_BAYAR[p.metode] ?? p.metode }}<template v-if="p.referensi"> · {{ p.referensi }}</template></dt>
                <dd class="tabular-nums">{{ rupiah(p.diterima ?? p.jumlah) }}</dd>
              </div>
              <div v-if="lunas" class="flex justify-between"><dt class="text-slate-500">Kembalian</dt><dd class="tabular-nums">{{ rupiah(tagihan.kembalian) }}</dd></div>
            </template>
          </dl>
          <p v-for="p in tagihan.paket_pasiens ?? []" :key="p.id" class="mt-3 text-xs text-slate-600">
            Paket {{ p.no_paket }} · {{ p.nama }}:
            <template v-if="p.status === 'aktif'">aktif<template v-if="p.berlaku_sampai">, berlaku s.d. {{ tanggal(p.berlaku_sampai) }}</template></template>
            <template v-else-if="p.status === 'menunggu_bayar'">aktif setelah tagihan ini lunas</template>
            <template v-else>{{ p.status }}</template>
          </p>
          <p v-if="lunas" class="mt-6 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
            Lunas {{ waktu(tagihan.dibayar_at) }} · Kasir: {{ tagihan.kasir?.name }}<template v-if="tagihan.penyetuju_diskon"> · Diskon disetujui {{ tagihan.penyetuju_diskon.name }}</template><template v-if="klinik.info?.struk?.catatan_kaki"><br />{{ klinik.info.struk.catatan_kaki }}</template>
          </p>
        </div>
      </div>

      <!-- Form pembayaran -->
      <div class="card self-start lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Pembayaran</h2><StatusBadge :status="tagihan.status" /></div>
        <div v-if="tagihan.status === 'belum_bayar'" class="card-body space-y-4">
          <!-- Voucher & kode promo (TR-06) -->
          <div>
            <label class="label" for="kode-promo">Kode voucher / promo</label>
            <div v-if="tagihan.promo" class="flex items-center justify-between gap-2 rounded-2xl bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800">
              <span><b class="font-mono">{{ tagihan.promo.kode }}</b> · {{ tagihan.promo.nama }} · -{{ rupiah(tagihan.diskon_promo) }}</span>
              <button type="button" class="text-xs hover:underline" :disabled="memasangPromo" @click="lepasPromo">Lepas</button>
            </div>
            <form v-else class="flex gap-2" @submit.prevent="pasangPromo">
              <input id="kode-promo" v-model="kodePromo" class="input font-mono uppercase" :class="{ 'input-error': errors.kode }" maxlength="30" placeholder="Mis. WELCOME10" />
              <button class="btn btn-secondary" :disabled="memasangPromo || !kodePromo.trim()"><AppSpinner v-if="memasangPromo" />Pakai</button>
            </form>
            <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
          </div>

          <form class="space-y-4" @submit.prevent="prosesBayar">
            <div>
              <label class="label" for="diskon">Diskon (Rp)</label>
              <input id="diskon" v-model.number="bayar.diskon" type="number" min="0" :max="tagihan.total - tagihan.diskon_promo" class="input" :class="{ 'input-error': errors.diskon }" @input="persetujuan.perlu = false" />
              <p v-if="errors.diskon" class="field-error">{{ errors.diskon }}</p>
            </div>

            <!-- Persetujuan atasan untuk diskon di atas batas peran (BL-02) -->
            <div v-if="persetujuan.perlu" class="space-y-2 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3">
              <p class="text-sm font-medium text-amber-900">Persetujuan atasan</p>
              <p class="text-xs text-amber-800">Atasan (mis. manajer) memasukkan email & password-nya di perangkat ini. Persetujuan tercatat di audit log.</p>
              <input v-model="persetujuan.email" type="email" class="input" placeholder="Email atasan" autocomplete="off" aria-label="Email atasan" required />
              <input v-model="persetujuan.password" type="password" class="input" placeholder="Password atasan" autocomplete="new-password" aria-label="Password atasan" required />
              <p v-if="errors.persetujuan" class="field-error">{{ errors.persetujuan }}</p>
            </div>

            <div class="rounded-3xl bg-brand-900 p-5 text-center text-white shadow-xl shadow-black/25 inset-shadow-dark">
              <p class="text-xs font-medium text-white/60">Yang harus dibayar</p>
              <p class="mt-1 text-3xl font-semibold tracking-tight">{{ rupiah(grandTotal) }}</p>
            </div>

            <!-- Split payment (BL-03) -->
            <div class="space-y-3">
              <div v-for="(b, i) in bayar.baris" :key="i" class="space-y-2 rounded-2xl border border-line bg-white/40 p-3">
                <div class="flex gap-2">
                  <select v-model="b.metode" class="input" :aria-label="`Metode bayar ${i + 1}`">
                    <option v-for="[key, label] in METODE_SPLIT" :key="key" :value="key">{{ label }}</option>
                  </select>
                  <button v-if="bayar.baris.length > 1" type="button" class="btn btn-ghost btn-icon" :aria-label="`Hapus metode ${i + 1}`" @click="bayar.baris.splice(i, 1)">&times;</button>
                </div>
                <div class="flex gap-2">
                  <input v-model.number="b.jumlah" type="number" min="0" class="input text-lg" :class="{ 'input-error': errors[`pembayarans.${i}.jumlah`] }" :placeholder="b.metode === 'tunai' ? 'Uang diterima' : 'Nominal'" :aria-label="`Nominal ${i + 1}`" />
                  <button type="button" class="btn btn-secondary btn-sm shrink-0" @click="isiPas(b)">Pas</button>
                </div>
                <div v-if="b.metode === 'tunai'" class="flex flex-wrap gap-1.5">
                  <button v-for="p in pecahan(b)" :key="p" type="button" class="btn btn-secondary btn-sm" @click="b.jumlah = p">{{ rupiah(p) }}</button>
                </div>
                <input v-else-if="b.metode !== 'penjamin'" v-model="b.referensi" class="input" maxlength="100" :placeholder="b.metode === 'qris' ? 'No. referensi QRIS' : b.metode === 'debit' ? 'No. approval EDC / 4 digit kartu' : 'No. referensi transfer'" :aria-label="`Referensi ${i + 1}`" />
              </div>
              <button v-if="bayar.baris.length < 5" type="button" class="btn btn-ghost btn-sm" @click="tambahBaris">+ Tambah metode bayar</button>
              <p v-if="errors.pembayarans" class="field-error">{{ errors.pembayarans }}</p>
            </div>

            <dl class="space-y-1 text-sm">
              <div class="flex justify-between"><dt class="text-slate-500">Diterima</dt><dd class="tabular-nums">{{ rupiah(totalDibayar) }}</dd></div>
              <div v-if="sisa" class="flex justify-between text-rose-600"><dt>Kurang</dt><dd class="font-semibold tabular-nums">{{ rupiah(sisa) }}</dd></div>
              <div v-else class="flex justify-between"><dt class="text-slate-500">Kembalian</dt><dd class="font-semibold tabular-nums">{{ rupiah(kembalian) }}</dd></div>
              <p v-if="nonTunaiLebih" class="text-xs text-rose-600">Pembayaran non-tunai tidak boleh melebihi tagihan.</p>
            </dl>
            <p v-if="errors.shift" class="alert alert-warning">{{ errors.shift }} <RouterLink to="/shift-kas" class="underline">Buka shift</RouterLink></p>
            <button type="submit" class="btn btn-primary w-full py-2.5" :disabled="processing || sisa > 0 || nonTunaiLebih"><AppSpinner v-if="processing" />{{ processing ? 'Memproses...' : persetujuan.perlu ? 'Setujui & Proses Pembayaran' : 'Proses Pembayaran' }}</button>
          </form>
          <button v-if="auth.can('kasir.void')" type="button" class="btn btn-ghost btn-sm w-full text-rose-600" @click="bukaVoid">Batalkan tagihan</button>
        </div>
        <div v-else class="card-body space-y-3 text-sm text-slate-600">
          <p>Tagihan telah {{ lunas ? 'dibayar' : 'dibatalkan' }}.<template v-if="lunas && tagihan.kunjungan"> Arahkan pasien ke farmasi bila ada resep.</template></p>
          <p v-if="tagihan.alasan_batal" class="text-xs">Alasan: {{ tagihan.alasan_batal }}</p>
          <p v-if="dikembalikan" class="text-xs">Pembayaran sudah direfund: {{ tagihan.pembayarans.find((p) => p.dikembalikan_at)?.alasan_refund }}</p>
          <button v-if="lunas && auth.can('kasir.void')" type="button" class="btn btn-secondary btn-sm text-rose-600" @click="bukaVoid">Refund pembayaran</button>
        </div>
      </div>
    </div>
  </template>
  <PageLoading v-else :error="error" text="Memuat tagihan..." @retry="load" />

  <AppModal v-model="voidOpen" :title="jenisVoid === 'refund' ? 'Refund Pembayaran' : 'Batalkan Tagihan'">
    <form id="form-void" class="space-y-3" @submit.prevent="prosesVoid">
      <p class="text-sm text-slate-600">
        <template v-if="jenisVoid === 'refund'">Semua pembayaran tagihan {{ tagihan?.no_tagihan }} ditandai dikembalikan dan tidak dihitung di rekap shift. Kunjungan kembali menunggu pembayaran; paket yang belum dipakai ikut direfund.</template>
        <template v-else>Tagihan {{ tagihan?.no_tagihan }} dibatalkan dan tidak bisa dibayar lagi.</template>
      </p>
      <div>
        <label class="label" for="alasan-void">Alasan *</label>
        <textarea id="alasan-void" v-model="alasan" rows="2" class="input" :class="{ 'input-error': errors.alasan_batal || errors.alasan_refund }" maxlength="255" required />
        <p v-if="errors.alasan_batal || errors.alasan_refund || errors.status" class="field-error">{{ errors.alasan_batal || errors.alasan_refund || errors.status }}</p>
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="voidOpen = false">Kembali</button>
      <button type="submit" form="form-void" class="btn btn-danger" :disabled="voiding"><AppSpinner v-if="voiding" />{{ jenisVoid === 'refund' ? 'Refund' : 'Batalkan tagihan' }}</button>
    </template>
  </AppModal>
</template>
