<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDetail } from '@/composables/useDetail'
import api, { errorMessage } from '@/lib/api'
import { angka, jenisKelamin, jumlahResepItem, labelResepItem, rupiah, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const klinik = useKlinikStore()
const toast = useToastStore()
const { data: resep, error, load } = useDetail(() => `/reseps/${route.params.id}`)
const processing = ref(false)

const lunas = computed(() => resep.value?.kunjungan.tagihan?.status === 'lunas')
/** Racikan (FR-01): stok yang dicek = komponen × banyaknya racikan. */
const kurang = (i) => (i.racikan ? i.komponens.some((k) => k.jumlah * i.jumlah > k.obat.stok) : i.jumlah > i.obat.stok)
const stokKurang = computed(() => resep.value?.items.some(kurang))
const total = computed(() => resep.value?.items.reduce((s, i) => s + i.harga * i.jumlah, 0) ?? 0)

async function serahkan() {
  if (!confirm('Serahkan obat ke pasien? Stok akan dikurangi.')) return
  processing.value = true
  try {
    // Respons sudah berbentuk sama dengan detail -> tidak perlu GET ulang
    resep.value = (await api.post(`/reseps/${route.params.id}/serahkan`)).data
    toast.success('Obat telah diserahkan dan stok diperbarui.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    processing.value = false
  }
}

onMounted(load)
</script>

<template>
  <template v-if="resep">
    <PageHeader :title="`Resep ${resep.no_resep}`" :subtitle="`${resep.kunjungan.poli.nama} · ${waktu(resep.created_at)}`">
      <RouterLink to="/farmasi/resep" class="btn btn-secondary">Kembali</RouterLink>
      <button class="btn btn-secondary" @click="printElement('#etiket', `Etiket ${resep.no_resep}`)">Cetak etiket</button>
      <button v-if="resep.status === 'menunggu'" class="btn btn-primary" :disabled="!lunas || stokKurang || processing" @click="serahkan">
        <AppSpinner v-if="processing" />{{ processing ? 'Memproses...' : 'Serahkan obat' }}
      </button>
    </PageHeader>

    <div v-if="resep.status === 'menunggu' && !lunas" class="alert alert-warning mb-5">
      Tagihan pasien belum lunas. Arahkan pasien ke kasir sebelum obat diserahkan.
    </div>
    <div v-if="resep.status === 'menunggu' && stokKurang" class="alert alert-danger mb-5">
      Ada obat dengan stok tidak mencukupi. Lakukan penerimaan stok terlebih dahulu.
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="card self-start">
        <div class="card-header"><h2 class="card-title">Pasien</h2><StatusBadge :status="resep.status" /></div>
        <dl class="card-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-slate-500">Nama</dt><dd class="font-medium">{{ resep.kunjungan.pasien.nama }}</dd>
          <dt class="text-slate-500">No. RM</dt><dd class="tabular-nums">{{ resep.kunjungan.pasien.no_rm }}</dd>
          <dt class="text-slate-500">JK / Umur</dt><dd>{{ jenisKelamin(resep.kunjungan.pasien.jenis_kelamin) }} · {{ resep.kunjungan.pasien.umur }}</dd>
          <dt class="text-slate-500">Alergi</dt><dd :class="resep.kunjungan.pasien.alergi ? 'font-medium text-rose-600' : ''">{{ resep.kunjungan.pasien.alergi ?? 'Tidak ada' }}</dd>
          <dt class="text-slate-500">Dokter</dt><dd>{{ resep.dokter?.name ?? '-' }}</dd>
          <dt class="text-slate-500">Tagihan</dt><dd><StatusBadge :status="resep.kunjungan.tagihan?.status ?? 'belum_bayar'" /></dd>
          <template v-if="resep.status === 'diserahkan'">
            <dt class="text-slate-500">Diserahkan</dt><dd>{{ waktu(resep.diserahkan_at) }}<br /><span class="text-xs text-slate-500">oleh {{ resep.apoteker?.name }}</span></dd>
          </template>
        </dl>
      </div>

      <div class="card lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Daftar Obat</h2></div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Obat</th><th class="text-right">Jumlah</th><th>Aturan pakai</th><th class="text-right">Stok</th><th class="text-right">Subtotal</th></tr></thead>
            <tbody>
              <tr v-for="i in resep.items" :key="i.id">
                <td>
                  <p :class="{ 'font-medium': i.racikan }">{{ labelResepItem(i) }}</p>
                  <ul v-if="i.racikan" class="mt-1 space-y-0.5 text-xs text-slate-600">
                    <li v-for="k in i.komponens" :key="k.id" :class="{ 'font-semibold text-rose-600': k.jumlah * i.jumlah > k.obat.stok && resep.status === 'menunggu' }">
                      {{ k.obat.nama }} {{ angka(k.jumlah) }} {{ k.obat.satuan }} × {{ i.jumlah }} = {{ angka(k.jumlah * i.jumlah) }} {{ k.obat.satuan }}
                      <span class="text-slate-400">(stok {{ angka(k.obat.stok) }})</span>
                    </li>
                    <li v-if="i.biaya_racik" class="text-slate-400">Biaya racik {{ rupiah(i.biaya_racik) }} / racikan</li>
                  </ul>
                </td>
                <td class="text-right tabular-nums">{{ jumlahResepItem(i) }}</td>
                <td class="italic">{{ i.aturan_pakai }}</td>
                <td :class="kurang(i) && resep.status === 'menunggu' ? 'font-semibold text-rose-600' : 'text-slate-500'" class="text-right tabular-nums">{{ i.racikan ? (kurang(i) ? 'kurang' : 'cukup') : i.obat.stok }}</td>
                <td class="text-right tabular-nums">{{ rupiah(i.harga * i.jumlah) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr><td colspan="4" class="text-right font-medium">Total</td><td class="text-right font-semibold tabular-nums">{{ rupiah(total) }}</td></tr>
            </tfoot>
          </table>
        </div>
        <p v-if="resep.catatan" class="border-t border-line px-5 py-3 text-sm"><span class="text-slate-500">Catatan dokter:</span> {{ resep.catatan }}</p>
      </div>
    </div>

    <!-- Etiket untuk dicetak -->
    <div class="hidden">
      <div id="etiket" class="grid grid-cols-2 gap-3">
        <div v-for="i in resep.items" :key="i.id" class="rounded border border-slate-400 p-3 text-sm">
          <p class="text-center text-xs font-semibold uppercase">{{ klinik.nama }} · Instalasi Farmasi</p>
          <p v-if="resep.cabang" class="text-center text-[11px] text-slate-500">{{ resep.cabang.nama }}</p>
          <p class="mt-1 text-center text-[11px] text-slate-500">{{ resep.no_resep }} · {{ tanggal(resep.created_at) }}</p>
          <hr class="my-2" />
          <p class="font-semibold">{{ resep.kunjungan.pasien.nama }} ({{ resep.kunjungan.pasien.no_rm }})</p>
          <p>{{ labelResepItem(i) }} — {{ jumlahResepItem(i) }}</p>
          <p class="mt-2 text-center text-base font-bold">{{ i.aturan_pakai }}</p>
        </div>
      </div>
    </div>
  </template>
  <PageLoading v-else :error="error" text="Memuat resep..." @retry="load" />
</template>
