<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import BookingFormModal from '@/components/booking/BookingFormModal.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import FotoKlinisCard from '@/components/foto/FotoKlinisCard.vue'
import OdontogramCard from '@/components/gigi/OdontogramCard.vue'
import PaketPasienCard from '@/components/paket/PaketPasienCard.vue'
import RencanaPerawatanCard from '@/components/gigi/RencanaPerawatanCard.vue'
import PersetujuanFotoPanel from '@/components/foto/PersetujuanFotoPanel.vue'
import PersetujuanDataPanel from '@/components/pasien/PersetujuanDataPanel.vue'
import ProfilKlinisCard from '@/components/pasien/ProfilKlinisCard.vue'
import LampiranBerkas from '@/components/LampiranBerkas.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import PasienFormModal from '@/components/PasienFormModal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDetail } from '@/composables/useDetail'
import api, { errorMessage } from '@/lib/api'
import { PENJAMIN, STATUS_KUNJUNGAN, jenisKelamin, tanggal, toOptions } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const auth = useAuthStore()
const toast = useToastStore()
const { data: pasien, error, load } = useDetail(() => `/pasiens/${route.params.id}`)
const formOpen = ref(false)
const bookingOpen = ref(false)

// Lookup IHS Number via NIK (PS-05)
const cekIhs = ref(false)
async function lookupIhs() {
  cekIhs.value = true
  try {
    const { data } = await api.post(`/pasiens/${pasien.value.id}/satusehat`)
    pasien.value.ihs_id = data.ihs_id
    toast.success(`IHS Number: ${data.ihs_id}`)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    cekIhs.value = false
  }
}

// Respons simpan sudah berisi identitas terbaru; riwayat kunjungan tidak berubah -> tidak perlu muat ulang.
const onSaved = (data) => Object.assign(pasien.value, data)

// Filter riwayat di sisi klien (riwayat sudah termuat seluruhnya bersama detail pasien)
const riwayatFilter = reactive({ poli: '', status: '', penjamin: '' })
const opsiPoli = computed(() => [...new Set((pasien.value?.kunjungans ?? []).map((k) => k.poli?.nama).filter(Boolean))].map((nama) => ({ value: nama, label: nama })))
const riwayat = computed(() =>
  (pasien.value?.kunjungans ?? []).filter(
    (k) =>
      (!riwayatFilter.poli || k.poli?.nama === riwayatFilter.poli) &&
      (!riwayatFilter.status || k.status === riwayatFilter.status) &&
      (!riwayatFilter.penjamin || k.penjamin === riwayatFilter.penjamin),
  ),
)
/** Odontogram & rencana perawatan: pasien punya data gigi atau pernah berkunjung ke poli gigi (DG-01/02). */
const tampilGigi = computed(() => !!pasien.value?.data_gigi || (pasien.value?.kunjungans ?? []).some((k) => k.poli?.spesialisasi === 'gigi'))
const riwayatDifilter = computed(() => Object.values(riwayatFilter).some(Boolean))
const resetRiwayat = () => Object.assign(riwayatFilter, { poli: '', status: '', penjamin: '' })

onMounted(load)
</script>

<template>
  <template v-if="pasien">
    <PageHeader :title="pasien.nama" :subtitle="`No. RM ${pasien.no_rm}`">
      <RouterLink to="/pasien" class="btn btn-secondary">Kembali</RouterLink>
      <RouterLink v-if="auth.can('audit.lihat')" :to="{ path: '/admin/audit', query: { pasien_id: pasien.id } }" class="btn btn-secondary" title="Siapa saja yang mengakses & mengubah data pasien ini">Jejak Akses</RouterLink>
      <button v-if="auth.can('pasien.kelola')" class="btn btn-secondary" @click="formOpen = true">Ubah Data</button>
      <button v-if="auth.can('booking.kelola')" class="btn btn-secondary" @click="bookingOpen = true">Booking</button>
      <RouterLink v-if="auth.can('kunjungan.daftar')" :to="{ path: '/pendaftaran', query: { pasien_id: pasien.id } }" class="btn btn-primary">Daftarkan Kunjungan</RouterLink>
    </PageHeader>
    <BookingFormModal v-model="bookingOpen" :preset="{ pasien }" />

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Identitas Pasien</h2></div>
        <dl class="card-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt class="text-slate-500">NIK</dt><dd class="tabular-nums">{{ pasien.nik ?? '-' }}</dd>
          <dt class="text-slate-500">No. BPJS</dt><dd class="tabular-nums">{{ pasien.no_bpjs ?? '-' }}</dd>
          <!-- IHS Number SATUSEHAT (PS-05) -->
          <dt class="text-slate-500">IHS SATUSEHAT</dt>
          <dd class="flex flex-wrap items-center gap-2 tabular-nums">
            {{ pasien.ihs_id ?? '-' }}
            <button v-if="auth.can('pasien.kelola', 'integrasi.kelola') && pasien.nik" type="button" class="text-xs underline" :disabled="cekIhs" @click="lookupIhs">
              {{ cekIhs ? 'mengecek…' : pasien.ihs_id ? 'cek ulang' : 'cek via NIK' }}
            </button>
          </dd>
          <dt class="text-slate-500">Jenis kelamin</dt><dd>{{ jenisKelamin(pasien.jenis_kelamin) }}</dd>
          <dt class="text-slate-500">TTL</dt><dd>{{ pasien.tempat_lahir ?? '-' }}, {{ tanggal(pasien.tanggal_lahir) }} ({{ pasien.umur }})</dd>
          <dt class="text-slate-500">Gol. darah</dt><dd>{{ pasien.golongan_darah ?? '-' }}</dd>
          <dt class="text-slate-500">No. HP</dt><dd>{{ pasien.no_hp ?? '-' }}</dd>
          <dt class="text-slate-500">Pekerjaan</dt><dd>{{ pasien.pekerjaan ?? '-' }}</dd>
          <dt class="text-slate-500">Alamat</dt><dd>{{ pasien.alamat ?? '-' }}</dd>
          <dt class="text-slate-500">Alergi</dt><dd :class="pasien.alergi ? 'font-medium text-rose-600' : ''">{{ pasien.alergi ?? 'Tidak ada' }}</dd>
        </dl>
        <!-- Consent UU PDP (PS-04): pemrosesan data & marketing terpisah -->
        <div class="border-t border-line px-5 py-4">
          <p class="mb-2 text-xs font-semibold text-slate-600">Persetujuan data pribadi (UU PDP)</p>
          <PersetujuanDataPanel :pasien="pasien" />
        </div>
      </div>

      <div class="card lg:col-span-2">
        <div class="card-header flex-wrap">
          <h2 class="card-title">Riwayat Kunjungan</h2>
          <div v-if="pasien.kunjungans.length" class="filter-bar">
            <FilterSelect v-model="riwayatFilter.poli" placeholder="Semua poli" :options="opsiPoli" />
            <FilterSelect v-model="riwayatFilter.status" placeholder="Semua status" :options="toOptions(STATUS_KUNJUNGAN)" />
            <FilterSelect v-model="riwayatFilter.penjamin" placeholder="Semua penjamin" :options="toOptions(PENJAMIN)" />
            <button v-if="riwayatDifilter" class="btn btn-ghost btn-sm" @click="resetRiwayat">Reset filter</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr><th>Tanggal</th><th>Poli / Dokter</th><th v-if="auth.can('rme.lihat')">Diagnosa</th><th>Penjamin</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="k in riwayat" :key="k.id">
                <td class="whitespace-nowrap">{{ tanggal(k.tanggal) }}</td>
                <td>
                  <p>{{ k.poli?.nama }}</p>
                  <p class="text-xs text-slate-500">{{ k.dokter?.name ?? '-' }}<template v-if="k.cabang"> · {{ k.cabang.nama }}</template></p>
                </td>
                <td v-if="auth.can('rme.lihat')" class="text-xs">
                  <p v-for="d in k.pemeriksaan?.diagnosas ?? []" :key="d.id"><span class="tabular-nums font-semibold">{{ d.icd10.kode }}</span> {{ d.icd10.nama }}</p>
                  <span v-if="!k.pemeriksaan?.diagnosas?.length" class="text-slate-400">-</span>
                </td>
                <td>{{ PENJAMIN[k.penjamin] }}</td>
                <td><StatusBadge :status="k.status" /></td>
                <td class="text-right"><RouterLink :to="`/kunjungan/${k.id}`" class="btn btn-ghost btn-sm">Lihat</RouterLink></td>
              </tr>
              <tr v-if="!riwayat.length">
                <td colspan="6" class="py-10 text-center text-slate-400">
                  {{ riwayatDifilter ? 'Tidak ada kunjungan yang cocok dengan filter.' : 'Belum ada riwayat kunjungan.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Profil klinis & alergi terstruktur (PS-03) — data klinis, hanya rme.lihat -->
      <div v-if="auth.can('rme.lihat')" class="lg:col-span-3"><ProfilKlinisCard :pasien="pasien" /></div>
      <!-- Paket multi-sesi: sisa sesi, jual paket (kasir), perpanjang/alihkan/refund (manajer) -->
      <div class="lg:col-span-3"><PaketPasienCard :pasien="pasien" /></div>
      <!-- Kedokteran gigi: odontogram terkini (+ status pada kunjungan sebelumnya) & rencana perawatan -->
      <template v-if="auth.can('rme.lihat') && tampilGigi">
        <div class="lg:col-span-3"><OdontogramCard :pasien="pasien" /></div>
        <div class="lg:col-span-3"><RencanaPerawatanCard :pasien="pasien" /></div>
      </template>
      <!-- Foto klinis semua kunjungan + perbandingan before-after (FT-02); tanpa rme.lihat hanya status persetujuan foto -->
      <div v-if="auth.can('rme.lihat')" class="lg:col-span-3">
        <FotoKlinisCard :pasien="pasien" />
      </div>
      <div v-else class="card lg:col-span-3">
        <div class="card-header"><h2 class="card-title">Persetujuan Foto Klinis</h2></div>
        <div class="card-body"><PersetujuanFotoPanel :pasien="pasien" /></div>
      </div>
      <div v-if="auth.can('rme.lihat')" class="lg:col-span-3">
        <LampiranBerkas :pasien-id="pasien.id" tanpa-foto />
      </div>
    </div>

    <PasienFormModal v-model="formOpen" :pasien="pasien" @saved="onSaved" />
  </template>
  <PageLoading v-else :error="error" @retry="load" />
</template>
