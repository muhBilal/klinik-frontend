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

const KATEGORI = { konsultasi: 'Konsultasi', tindakan: 'Tindakan', obat: 'Obat' }

const grandTotal = computed(() => Math.max(0, (tagihan.value?.total ?? 0) - Number(bayar.diskon || 0)))
const kembalian = computed(() => Math.max(0, Number(bayar.dibayar || 0) - grandTotal.value))
const pecahan = computed(() => {
  const g = grandTotal.value
  return [...new Set([g, Math.ceil(g / 50000) * 50000, Math.ceil(g / 100000) * 100000, Math.ceil(g / 100000) * 100000 + 100000])].filter((v) => v > 0)
})

async function load() {
  const data = await fetchTagihan()
  if (data) bayar.metode_bayar = data.kunjungan.penjamin === 'umum' ? 'tunai' : 'penjamin'
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
    toast.success(`Pembayaran berhasil.${data.kembalian ? ` Kembalian ${rupiah(data.kembalian)}.` : ''}`)
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
    <PageHeader :title="`Tagihan ${tagihan.no_tagihan}`" :subtitle="`${tagihan.kunjungan.pasien.nama} · ${tagihan.kunjungan.poli.nama}`">
      <RouterLink to="/kasir" class="btn btn-secondary">Kembali</RouterLink>
      <button v-if="tagihan.status === 'lunas'" class="btn btn-primary" @click="printElement('#struk', `Struk ${tagihan.no_tagihan}`, { lebar: klinik.info?.cetak?.lebar_struk })">Cetak struk</button>
    </PageHeader>

    <div class="grid gap-5 lg:grid-cols-5">
      <!-- Rincian / struk -->
      <div class="card lg:col-span-3">
        <div id="struk" class="card-body">
          <div class="mb-4 flex items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-4">
            <div>
              <p class="font-semibold">{{ klinik.nama }}<template v-if="tagihan.cabang"> · {{ tagihan.cabang.nama }}</template></p>
              <p v-if="kontak" class="text-xs text-slate-500">{{ kontak }}</p>
              <p class="text-xs text-slate-500">Bukti Pembayaran Pelayanan</p>
            </div>
            <div class="text-right text-xs text-slate-500">
              <p class="tabular-nums font-semibold text-slate-700">{{ tagihan.no_tagihan }}</p>
              <p>{{ tanggal(tagihan.kunjungan.tanggal) }}</p>
            </div>
          </div>
          <dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-500">Pasien</dt><dd>{{ tagihan.kunjungan.pasien.nama }} ({{ tagihan.kunjungan.pasien.no_rm }})</dd>
            <dt class="text-slate-500">Poli</dt><dd>{{ tagihan.kunjungan.poli.nama }} · {{ tagihan.kunjungan.dokter?.name ?? '-' }}</dd>
            <dt class="text-slate-500">Penjamin</dt><dd>{{ PENJAMIN[tagihan.kunjungan.penjamin] }}</dd>
          </dl>
          <table class="table">
            <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Harga</th><th class="text-right">Subtotal</th></tr></thead>
            <tbody>
              <tr v-for="i in tagihan.items" :key="i.id">
                <td><span class="mr-1.5 text-[11px] text-slate-400 uppercase">{{ KATEGORI[i.kategori] }}</span>{{ i.deskripsi }}</td>
                <td class="text-right tabular-nums">{{ i.jumlah }}</td>
                <td class="text-right tabular-nums">{{ rupiah(i.harga) }}</td>
                <td class="text-right tabular-nums">{{ rupiah(i.subtotal) }}</td>
              </tr>
            </tbody>
          </table>
          <dl class="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
            <div class="flex justify-between"><dt class="text-slate-500">Total</dt><dd class="tabular-nums">{{ rupiah(tagihan.total) }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Diskon</dt><dd class="tabular-nums">-{{ rupiah(tagihan.status === 'lunas' ? tagihan.diskon : bayar.diskon) }}</dd></div>
            <div class="flex justify-between border-t border-line pt-1 text-base font-semibold">
              <dt>Grand total</dt><dd class="tabular-nums">{{ rupiah(tagihan.status === 'lunas' ? tagihan.grand_total : grandTotal) }}</dd>
            </div>
            <template v-if="tagihan.status === 'lunas'">
              <div class="flex justify-between"><dt class="text-slate-500">Dibayar ({{ METODE_BAYAR[tagihan.metode_bayar] }})</dt><dd class="tabular-nums">{{ rupiah(tagihan.dibayar) }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Kembalian</dt><dd class="tabular-nums">{{ rupiah(tagihan.kembalian) }}</dd></div>
            </template>
          </dl>
          <p v-if="tagihan.status === 'lunas'" class="mt-6 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
            Lunas {{ waktu(tagihan.dibayar_at) }} · Kasir: {{ tagihan.kasir?.name }}<template v-if="klinik.info?.struk?.catatan_kaki"><br />{{ klinik.info.struk.catatan_kaki }}</template>
          </p>
        </div>
      </div>

      <!-- Form pembayaran -->
      <div class="card self-start lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Pembayaran</h2><StatusBadge :status="tagihan.status" /></div>
        <form v-if="tagihan.status === 'belum_bayar'" class="card-body space-y-4" @submit.prevent="prosesBayar">
          <div>
            <label class="label">Metode bayar</label>
            <select v-model="bayar.metode_bayar" class="input">
              <option v-for="(label, key) in METODE_BAYAR" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Diskon (Rp)</label>
            <input v-model.number="bayar.diskon" type="number" min="0" :max="tagihan.total" class="input" :class="{ 'input-error': errors.diskon }" />
            <p v-if="errors.diskon" class="field-error">{{ errors.diskon }}</p>
          </div>
          <div class="rounded-3xl bg-brand-900 p-5 text-center text-white shadow-xl shadow-black/25 inset-shadow-dark">
            <p class="text-xs font-medium text-white/60">Yang harus dibayar</p>
            <p class="mt-1 text-3xl font-semibold tracking-tight">{{ rupiah(grandTotal) }}</p>
          </div>
          <template v-if="bayar.metode_bayar === 'tunai'">
            <div>
              <label class="label">Uang diterima (Rp)</label>
              <input v-model.number="bayar.dibayar" type="number" min="0" class="input text-lg" :class="{ 'input-error': errors.dibayar }" required />
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
          <button type="submit" class="btn btn-primary w-full py-2.5" :disabled="processing"><AppSpinner v-if="processing" />{{ processing ? 'Memproses...' : 'Proses Pembayaran' }}</button>
        </form>
        <div v-else class="card-body text-sm text-slate-600">
          Tagihan telah {{ tagihan.status === 'lunas' ? 'dibayar' : 'dibatalkan' }}. Arahkan pasien ke farmasi bila ada resep.
        </div>
      </div>
    </div>
  </template>
  <PageLoading v-else :error="error" text="Memuat tagihan..." @retry="load" />
</template>
