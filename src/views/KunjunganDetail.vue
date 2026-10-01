<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import FotoKlinisCard from '@/components/foto/FotoKlinisCard.vue'
import OdontogramCard from '@/components/gigi/OdontogramCard.vue'
import LampiranBerkas from '@/components/LampiranBerkas.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import RekamMedisRingkas from '@/components/RekamMedisRingkas.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AddendumModal from '@/components/rme/AddendumModal.vue'
import { useDetail } from '@/composables/useDetail'
import api, { errorMessage } from '@/lib/api'
import { PENJAMIN, jenisKelamin, rupiah, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const { data: k, error, load } = useDetail(() => `/kunjungans/${route.params.id}`)

const verifikasi = ref(null)
/** Odontogram tampil untuk kunjungan poli gigi atau yang mencatat kondisi gigi (DG-01). */
const tampilGigi = computed(() => k.value?.poli?.spesialisasi === 'gigi' || !!k.value?.odontogram_dicatat?.length || !!k.value?.odontogram_diakhiri?.length)
const memverifikasi = ref(false)
const addendumOpen = ref(false)

/** Cocokkan hash tanda tangan dengan isi rekam medis saat ini (RM-07). */
async function cekKeutuhan() {
  memverifikasi.value = true
  try {
    verifikasi.value = (await api.get(`/kunjungans/${route.params.id}/verifikasi`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memverifikasi.value = false
  }
}

function addendumTersimpan(a) {
  k.value.pemeriksaan.addendums = [...(k.value.pemeriksaan.addendums ?? []), a]
}

onMounted(load)
</script>

<template>
  <template v-if="k">
    <PageHeader :title="`Kunjungan ${k.no_registrasi}`" :subtitle="`${k.poli.nama} · ${tanggal(k.tanggal)}`">
      <button class="btn btn-secondary" @click="router.back()">Kembali</button>
      <!-- Addendum hanya untuk kunjungan cabang aktif (backend menolak cabang lain) -->
      <button
        v-if="auth.can('pemeriksaan.dokter') && k.pemeriksaan?.ditandatangani_at && (!auth.cabang || auth.cabang.id === k.cabang_id)"
        class="btn btn-secondary"
        @click="addendumOpen = true"
      >
        Tambah addendum
      </button>
    </PageHeader>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div class="card self-start">
        <div class="card-header"><h2 class="card-title">Pasien</h2><StatusBadge :status="k.status" /></div>
        <dl class="card-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-slate-500">Nama</dt><dd class="font-medium">{{ k.pasien.nama }}</dd>
          <dt class="text-slate-500">No. RM</dt><dd class="tabular-nums">{{ k.pasien.no_rm }}</dd>
          <dt class="text-slate-500">JK / Umur</dt><dd>{{ jenisKelamin(k.pasien.jenis_kelamin) }} · {{ k.pasien.umur }}</dd>
          <dt class="text-slate-500">Cabang</dt><dd>{{ k.cabang?.nama ?? '-' }}</dd>
          <dt class="text-slate-500">Penjamin</dt><dd>{{ PENJAMIN[k.penjamin] }} {{ k.no_penjamin ?? '' }}</dd>
          <dt class="text-slate-500">Dokter</dt><dd>{{ k.dokter?.name ?? '-' }}</dd>
          <dt class="text-slate-500">Keluhan</dt><dd>{{ k.keluhan ?? '-' }}</dd>
          <dt class="text-slate-500">Dipanggil</dt><dd>{{ waktu(k.dipanggil_at) }}</dd>
          <dt class="text-slate-500">Selesai</dt><dd>{{ waktu(k.selesai_at) }}</dd>
          <template v-if="k.tagihan">
            <dt class="text-slate-500">Tagihan</dt>
            <dd>{{ rupiah(k.tagihan.grand_total) }} <StatusBadge :status="k.tagihan.status" /></dd>
          </template>
        </dl>
      </div>
      <div v-if="auth.can('rme.lihat')" class="space-y-5 lg:col-span-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Rekam Medis</h2>
            <template v-if="k.pemeriksaan?.ditandatangani_at">
              <span v-if="verifikasi" :class="verifikasi.valid ? 'text-emerald-700' : 'text-rose-700'" class="text-xs font-semibold">
                {{ verifikasi.valid ? '✓ Isi utuh sesuai tanda tangan' : '⚠ Isi berubah setelah ditandatangani' }}
              </span>
              <button v-else class="btn btn-ghost btn-sm" :disabled="memverifikasi" @click="cekKeutuhan"><AppSpinner v-if="memverifikasi" size="size-3" />Cek keutuhan</button>
            </template>
          </div>
          <div class="card-body"><RekamMedisRingkas :kunjungan="k" /></div>
        </div>
        <template v-if="!k.rme_disembunyikan">
          <OdontogramCard v-if="tampilGigi" :pasien="k.pasien" :kunjungan-id="k.id" />
          <FotoKlinisCard :pasien="k.pasien" :kunjungan-id="k.id" />
          <LampiranBerkas :pasien-id="k.pasien_id" :kunjungan-id="k.id" readonly tanpa-foto />
        </template>
      </div>
      <div v-else class="card self-start lg:col-span-2">
        <div class="card-body text-sm text-slate-500">Isi rekam medis hanya dapat dilihat tenaga medis (izin <code>rme.lihat</code>).</div>
      </div>
    </div>

    <AddendumModal v-model="addendumOpen" :kunjungan-id="k.id" @saved="addendumTersimpan" />
  </template>
  <PageLoading v-else :error="error" text="Memuat rekam medis..." @retry="load" />
</template>
