<script setup>
/**
 * Laporan paket (PRD LP-03): terjual, pendapatan diakui dari sesi yang dikerjakan, refund, sisa hangus (kedaluwarsa), dan sisa
 * kewajiban (deferred revenue) per hari ini; rincian per paket & daftar paket bersisa yang segera kedaluwarsa (tindak lanjut CS).
 */
import { computed, onMounted, reactive, ref } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PeriodeFilter from '@/components/laporan/PeriodeFilter.vue'
import api, { errorMessage } from '@/lib/api'
import { angka, hariIni, isoTanggal, rupiah, tanggal } from '@/lib/format'
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
    const hasil = (await api.get('/laporan/paket', { params: { ...periode } })).data
    if (ini === urutan) data.value = hasil
  } catch (e) {
    if (ini === urutan) toast.error(errorMessage(e))
  } finally {
    if (ini === urutan) loading.value = false
  }
}

const cakupan = computed(() => data.value?.cabang?.nama ?? (auth.lintasCabang ? 'Semua cabang' : klinik.nama))
const r = computed(() => data.value?.ringkasan)
const sisaHari = (t) => Math.round((new Date(t) - new Date(hariIni())) / 864e5)

onMounted(muat)
</script>

<template>
  <PageHeader title="Laporan Paket" :subtitle="`Paket terjual, sesi terpakai & sisa kewajiban (pendapatan diterima di muka) · ${cakupan}`">
    <button class="btn btn-secondary" :disabled="!data" @click="printElement('#laporan-paket', 'Laporan paket')">Cetak</button>
  </PageHeader>

  <div class="card mb-5">
    <div class="card-body flex flex-wrap items-end justify-between gap-3">
      <PeriodeFilter v-model:mulai="periode.mulai" v-model:selesai="periode.selesai" @change="muat" />
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
  </div>

  <div v-if="data" id="laporan-paket" class="space-y-5 transition-opacity" :class="{ 'opacity-60': loading }">
    <p class="text-sm text-slate-500">
      <b class="text-slate-800">{{ klinik.nama }}</b> · {{ cakupan }} · {{ tanggal(data.periode.mulai) }} – {{ tanggal(data.periode.selesai) }}
    </p>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card card-body">
        <p class="text-sm font-medium text-slate-500">Paket terjual</p>
        <p class="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-900">{{ rupiah(r.nilai_terjual) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ angka(r.terjual) }} paket (nilai bersih)</p>
      </div>
      <div class="card card-body">
        <p class="text-sm font-medium text-slate-500">Pendapatan diakui</p>
        <p class="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-900">{{ rupiah(r.nilai_dipakai) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ angka(r.sesi_dipakai) }} sesi dikerjakan</p>
      </div>
      <div class="card card-body">
        <p class="text-sm font-medium text-slate-500">Refund & hangus</p>
        <p class="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-900">{{ rupiah(r.refund + r.hangus) }}</p>
        <p class="mt-1 text-xs text-slate-500">Refund {{ rupiah(r.refund) }} · hangus (kedaluwarsa) {{ rupiah(r.hangus) }}</p>
      </div>
      <div class="card card-body border-brand-900 bg-brand-900 text-white inset-shadow-dark">
        <p class="text-sm font-medium text-white/60">Sisa kewajiban (hari ini)</p>
        <p class="mt-2 truncate text-3xl font-semibold tracking-tight">{{ rupiah(r.sisa_kewajiban) }}</p>
        <p class="mt-1 text-xs text-white/50">{{ angka(r.sisa_sesi) }} sesi tersisa di {{ angka(r.paket_aktif) }} paket aktif</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2 class="card-title">Per paket</h2><span class="text-xs text-slate-500">Terjual, terpakai & refund = periode · sisa = per hari ini</span></div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Paket</th><th class="text-right">Terjual</th><th class="text-right">Nilai terjual</th><th class="text-right">Sesi terpakai</th>
              <th class="text-right">Pendapatan diakui</th><th class="text-right">Refund</th><th class="text-right">Paket aktif</th><th class="text-right">Sisa kewajiban</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in data.per_paket" :key="p.paket_id">
              <td class="font-medium">{{ p.nama }}</td>
              <td class="text-right tabular-nums">{{ angka(p.terjual) }}</td>
              <td class="text-right tabular-nums">{{ rupiah(p.nilai_terjual) }}</td>
              <td class="text-right tabular-nums">{{ angka(p.sesi_dipakai) }}</td>
              <td class="text-right tabular-nums">{{ rupiah(p.nilai_dipakai) }}</td>
              <td class="text-right tabular-nums">{{ p.refund ? rupiah(p.refund) : '-' }}</td>
              <td class="text-right tabular-nums">{{ angka(p.aktif) }} <span class="text-xs text-slate-500">({{ p.sisa_sesi }} sesi)</span></td>
              <td class="text-right font-medium tabular-nums">{{ rupiah(p.sisa_kewajiban) }}</td>
            </tr>
            <tr v-if="!data.per_paket.length"><td colspan="8" class="py-6 text-center text-slate-400">Belum ada data paket.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Segera kedaluwarsa (≤ 30 hari)</h2>
        <span class="text-xs text-slate-500">Paket yang masih bersisa — ingatkan pasien untuk menjadwalkan sesi</span>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Paket</th><th>Pasien</th><th>Berlaku sampai</th><th class="text-right">Sisa sesi</th><th class="text-right">Nilai sisa</th></tr></thead>
          <tbody>
            <tr v-for="p in data.segera_kedaluwarsa" :key="p.id">
              <td><p class="font-medium">{{ p.nama }}</p><p class="text-xs tabular-nums text-slate-500">{{ p.no_paket }}</p></td>
              <td><RouterLink :to="`/pasien/${p.pasien_id}`" class="hover:text-brand-700 hover:underline">{{ p.pasien_nama }}</RouterLink> <span class="text-xs text-slate-500">RM {{ p.no_rm }}</span></td>
              <td class="whitespace-nowrap">{{ tanggal(p.berlaku_sampai) }} <span class="text-xs" :class="sisaHari(p.berlaku_sampai) <= 7 ? 'font-semibold text-rose-600' : 'text-slate-500'">({{ sisaHari(p.berlaku_sampai) }} hari)</span></td>
              <td class="text-right tabular-nums">{{ p.sisa_sesi }}</td>
              <td class="text-right tabular-nums">{{ rupiah(p.sisa_nilai) }}</td>
            </tr>
            <tr v-if="!data.segera_kedaluwarsa.length"><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada paket bersisa yang kedaluwarsa dalam 30 hari.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div v-else-if="loading" class="flex items-center gap-2 text-slate-500"><AppSpinner />Memuat laporan...</div>
</template>
