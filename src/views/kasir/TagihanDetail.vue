<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDetail } from '@/composables/useDetail'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { METODE_BAYAR, PENJAMIN, rupiah, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
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
const bayar = reactive({ metode_bayar: 'tunai', dibayar: '', diskon: 0 })
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
const kembalian = computed(() => Math.max(0, Number(bayar.dibayar || 0) - grandTotal.value))
const pecahan = computed(() => {
  const g = grandTotal.value
  return [...new Set([g, Math.ceil(g / 50000) * 50000, Math.ceil(g / 100000) * 100000, Math.ceil(g / 100000) * 100000 + 100000])].filter((v) => v > 0)
})

async function load() {
  const data = await fetchTagihan()
  if (data) bayar.metode_bayar = (data.kunjungan?.penjamin ?? 'umum') === 'umum' ? 'tunai' : 'penjamin'
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
      metode_bayar: bayar.metode_bayar,
      dibayar: bayar.metode_bayar === 'tunai' ? Number(bayar.dibayar || 0) : null,
      diskon: Number(bayar.diskon || 0),
    })
    // Respons sudah berbentuk sama dengan detail (struk) -> tidak perlu GET ulang
    tagihan.value = data
    const paket = data.paket_pasiens?.length ? ` Paket ${data.paket_pasiens.map((p) => p.no_paket).join(', ')} aktif.` : ''
    toast.success(`Pembayaran berhasil.${data.kembalian ? ` Kembalian ${rupiah(data.kembalian)}.` : ''}${paket}`)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    processing.value = false
  }
}

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
            <template v-if="lunas">
              <div class="flex justify-between"><dt class="text-slate-500">Dibayar ({{ METODE_BAYAR[tagihan.metode_bayar] ?? 'beberapa metode' }})</dt><dd class="tabular-nums">{{ rupiah(tagihan.dibayar) }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Kembalian</dt><dd class="tabular-nums">{{ rupiah(tagihan.kembalian) }}</dd></div>
            </template>
          </dl>
          <p v-for="p in tagihan.paket_pasiens ?? []" :key="p.id" class="mt-3 text-xs text-slate-600">
            Paket {{ p.no_paket }} · {{ p.nama }}:
            <template v-if="p.status === 'aktif'">aktif<template v-if="p.berlaku_sampai">, berlaku s.d. {{ tanggal(p.berlaku_sampai) }}</template></template>
            <template v-else-if="p.status === 'menunggu_bayar'">aktif setelah tagihan ini lunas</template>
            <template v-else>{{ p.status }}</template>
          </p>
          <p v-if="lunas" class="mt-6 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
            Lunas {{ waktu(tagihan.dibayar_at) }} · Kasir: {{ tagihan.kasir?.name }}<template v-if="klinik.info?.struk?.catatan_kaki"><br />{{ klinik.info.struk.catatan_kaki }}</template>
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
              <label class="label" for="metode-bayar">Metode bayar</label>
              <select id="metode-bayar" v-model="bayar.metode_bayar" class="input">
                <option v-for="(label, key) in METODE_BAYAR" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
            <div>
              <label class="label" for="diskon">Diskon (Rp)</label>
              <input id="diskon" v-model.number="bayar.diskon" type="number" min="0" :max="tagihan.total - tagihan.diskon_promo" class="input" :class="{ 'input-error': errors.diskon }" />
              <p v-if="errors.diskon" class="field-error">{{ errors.diskon }}</p>
            </div>
            <div class="rounded-3xl bg-brand-900 p-5 text-center text-white shadow-xl shadow-black/25 inset-shadow-dark">
              <p class="text-xs font-medium text-white/60">Yang harus dibayar</p>
              <p class="mt-1 text-3xl font-semibold tracking-tight">{{ rupiah(grandTotal) }}</p>
            </div>
            <template v-if="bayar.metode_bayar === 'tunai'">
              <div>
                <label class="label" for="dibayar">Uang diterima (Rp)</label>
                <input id="dibayar" v-model.number="bayar.dibayar" type="number" min="0" class="input text-lg" :class="{ 'input-error': errors.dibayar }" :required="grandTotal > 0" />
                <p v-if="errors.dibayar" class="field-error">{{ errors.dibayar }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <button v-for="p in pecahan" :key="p" type="button" class="btn btn-secondary btn-sm" @click="bayar.dibayar = p">{{ rupiah(p) }}</button>
                </div>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-slate-500">Kembalian</span>
                <span class="font-semibold tabular-nums">{{ rupiah(kembalian) }}</span>
              </div>
            </template>
            <button type="submit" class="btn btn-primary w-full py-2.5" :disabled="processing"><AppSpinner v-if="processing" />{{ processing ? 'Memproses...' : grandTotal === 0 ? 'Tandai lunas (Rp 0)' : 'Proses Pembayaran' }}</button>
          </form>
        </div>
        <div v-else class="card-body text-sm text-slate-600">
          Tagihan telah {{ lunas ? 'dibayar' : 'dibatalkan' }}.<template v-if="lunas && tagihan.kunjungan"> Arahkan pasien ke farmasi bila ada resep.</template>
        </div>
      </div>
    </div>
  </template>
  <PageLoading v-else :error="error" text="Memuat tagihan..." @retry="load" />
</template>
