<script setup>
/**
 * Pemantauan integrasi (PRD v2 5.14 SATUSEHAT SS-05; BK-06 & CR-01 WhatsApp): status konfigurasi, antrean kirim, galat, kirim ulang.
 * Kredensial hanya di .env server (tidak pernah tampil di sini).
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage } from '@/lib/api'
import { tanggal, waktu } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const tab = ref(sessionStorage.getItem('eklinik_integrasi_tab') ?? 'satusehat')
watch(tab, (t) => sessionStorage.setItem('eklinik_integrasi_tab', t))

// ---------- SATUSEHAT ----------
const ss = ref(null)
const ssList = useList('/satusehat/kirims', { status: '' })
const aksi = ref('')

async function muatSatuSehat() {
  try {
    ss.value = (await api.get('/satusehat/status')).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
  ssList.load()
}

async function tesKoneksi() {
  aksi.value = 'tes'
  try {
    toast.success((await api.post('/satusehat/tes-koneksi')).data.message)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

async function kirimUlang(row) {
  aksi.value = `ss-${row.id}`
  try {
    Object.assign(row, (await api.post(`/satusehat/kirims/${row.id}/ulang`)).data)
    toast.success('Kunjungan dijadwalkan kirim ulang.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

async function kirimUlangSemua() {
  if (!confirm('Kirim ulang semua kunjungan yang gagal? Pastikan data penyebab galat sudah diperbaiki.')) return
  aksi.value = 'semua'
  try {
    const { data } = await api.post('/satusehat/kirim-ulang-gagal')
    toast.success(`${data.dijadwalkan} kunjungan dijadwalkan kirim ulang.`)
    muatSatuSehat()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

// ---------- WhatsApp ----------
const wa = ref(null)
const waList = useList('/whatsapp/pesan', { status: '', jenis: '' })
const JENIS = { reminder_h1: 'Reminder H-1', reminder_2jam: 'Reminder 2 jam', followup_h1: 'Follow-up H+1', followup_h7: 'Follow-up H+7' }
const STATUS_WA = { antre: 'Antre', terkirim: 'Terkirim', diterima: 'Diterima', dibaca: 'Dibaca', gagal: 'Gagal' }
const BALASAN = { konfirmasi: 'Konfirmasi', ubah_jadwal: 'Minta ubah jadwal' }

async function muatWhatsApp() {
  try {
    wa.value = (await api.get('/whatsapp/status')).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
  waList.load()
}

async function jalankanPenjadwal() {
  aksi.value = 'jadwal'
  try {
    const { data } = await api.post('/whatsapp/jadwalkan')
    toast.success(`${data.dibuat} pesan baru dijadwalkan.`)
    muatWhatsApp()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

async function kirimUlangPesan(row) {
  aksi.value = `wa-${row.id}`
  try {
    Object.assign(row, (await api.post(`/whatsapp/pesan/${row.id}/ulang`)).data)
    toast.success('Pesan dijadwalkan kirim ulang.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

// ---------- Sistem (observabilitas, PRD v2 7.2) ----------
const sistem = ref(null)
const jobGagal = ref([])
async function muatSistem() {
  try {
    ;[sistem.value, jobGagal.value] = await Promise.all([api.get('/sistem/status').then((r) => r.data), api.get('/sistem/job-gagal').then((r) => r.data)])
  } catch (e) {
    toast.error(errorMessage(e))
  }
}
async function aksiJob(j, jenis) {
  if (jenis === 'hapus' && !confirm('Hapus catatan job gagal ini?')) return
  aksi.value = `job-${j.uuid}`
  try {
    jenis === 'ulang' ? await api.post(`/sistem/job-gagal/${j.uuid}/ulang`) : await api.delete(`/sistem/job-gagal/${j.uuid}`)
    toast.success(jenis === 'ulang' ? 'Job dijadwalkan ulang.' : 'Dihapus.')
    muatSistem()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

const opsiStatusSs = [{ value: 'menunggu', label: 'Menunggu' }, { value: 'terkirim', label: 'Terkirim' }, { value: 'gagal', label: 'Gagal' }]
const opsiStatusWa = Object.entries(STATUS_WA).map(([value, label]) => ({ value, label }))
const opsiJenis = Object.entries(JENIS).map(([value, label]) => ({ value, label }))
const kepatuhan = computed(() => ss.value?.kepatuhan_30_hari)

function muat() {
  if (tab.value === 'satusehat') muatSatuSehat()
  else if (tab.value === 'whatsapp') muatWhatsApp()
  else muatSistem()
}
watch(tab, muat)
onMounted(muat)
</script>

<template>
  <PageHeader title="Integrasi" subtitle="SATUSEHAT (Kemenkes) & WhatsApp Business — status, antrean kirim, dan galat" />

  <div class="tabs mb-4">
    <button class="tab" :class="{ 'tab-active': tab === 'satusehat' }" @click="tab = 'satusehat'">SATUSEHAT</button>
    <button class="tab" :class="{ 'tab-active': tab === 'whatsapp' }" @click="tab = 'whatsapp'">WhatsApp</button>
    <button class="tab" :class="{ 'tab-active': tab === 'sistem' }" @click="tab = 'sistem'">Sistem</button>
  </div>

  <!-- Sistem: scheduler, antrean, job gagal -->
  <template v-if="tab === 'sistem'">
    <div v-if="sistem" class="mb-5 grid gap-4 lg:grid-cols-3">
      <div class="card card-body text-sm">
        <p class="text-slate-500">Scheduler</p>
        <p class="text-2xl font-semibold" :class="sistem.scheduler.sehat ? 'text-emerald-700' : 'text-rose-600'">{{ sistem.scheduler.sehat ? 'Berjalan' : 'Tidak berjalan' }}</p>
        <p class="text-xs text-slate-500">
          {{ sistem.scheduler.detak_terakhir ? `Detak terakhir ${waktu(sistem.scheduler.detak_terakhir)} (${sistem.scheduler.menit_lalu} menit lalu)` : 'Belum pernah berdetak' }}
        </p>
        <p v-if="!sistem.scheduler.sehat" class="mt-1 text-xs text-rose-700">Reminder WhatsApp & pembersihan token tidak berjalan. Pastikan proses <code>schedule:work</code> aktif.</p>
      </div>
      <div class="card card-body text-sm">
        <p class="text-slate-500">Antrean job</p>
        <div class="mt-2 grid grid-cols-3 gap-2 text-center">
          <div class="tile"><p class="text-xl font-semibold tabular-nums">{{ sistem.antrean.menunggu }}</p><p class="text-xs text-slate-500">menunggu</p></div>
          <div class="tile"><p class="text-xl font-semibold tabular-nums">{{ sistem.antrean.tertunda }}</p><p class="text-xs text-slate-500">dijeda</p></div>
          <div class="tile"><p class="text-xl font-semibold tabular-nums" :class="{ 'text-rose-600': sistem.antrean.gagal }">{{ sistem.antrean.gagal }}</p><p class="text-xs text-slate-500">gagal</p></div>
        </div>
      </div>
      <div class="card card-body text-sm">
        <p class="text-slate-500">Versi</p>
        <p class="mt-1">PHP {{ sistem.versi.php }} · Laravel {{ sistem.versi.laravel }}</p>
        <p class="text-xs text-slate-500">Lingkungan: {{ sistem.versi.lingkungan }}</p>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2 class="card-title">Job gagal</h2><button class="btn btn-ghost btn-sm" @click="muatSistem">Segarkan</button></div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Waktu</th><th>Job</th><th>Galat</th><th /></tr></thead>
          <tbody>
            <tr v-for="j in jobGagal" :key="j.uuid">
              <td class="whitespace-nowrap text-xs">{{ waktu(j.failed_at) }}</td>
              <td class="text-xs">{{ j.job.split('\\').pop() }}</td>
              <td class="max-w-lg text-xs text-rose-700">{{ j.galat }}</td>
              <td class="text-right whitespace-nowrap">
                <button class="btn btn-ghost btn-sm" :disabled="aksi === `job-${j.uuid}`" @click="aksiJob(j, 'ulang')">Coba ulang</button>
                <button class="btn btn-ghost btn-sm text-rose-600" :disabled="aksi === `job-${j.uuid}`" @click="aksiJob(j, 'hapus')">Hapus</button>
              </td>
            </tr>
            <tr v-if="!jobGagal.length"><td colspan="4" class="py-8 text-center text-slate-400">Tidak ada job gagal.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>

  <!-- SATUSEHAT -->
  <template v-else-if="tab === 'satusehat'">
    <div class="mb-5 grid gap-4 lg:grid-cols-3">
      <div class="card card-body space-y-2 text-sm">
        <p class="text-slate-500">Status integrasi</p>
        <template v-if="ss">
          <p class="text-2xl font-semibold">{{ ss.aktif ? 'Aktif' : 'Nonaktif' }} <span class="text-sm font-normal text-slate-500">· {{ ss.env }}</span></p>
          <p :class="ss.terkonfigurasi ? 'text-emerald-700' : 'text-rose-600'">{{ ss.terkonfigurasi ? `Kredensial terisi · Organization ${ss.organization_id}` : 'Kredensial belum diisi di .env server' }}</p>
          <button class="btn btn-secondary btn-sm" :disabled="!!aksi || !ss.terkonfigurasi" @click="tesKoneksi"><AppSpinner v-if="aksi === 'tes'" size="size-3" />Tes koneksi</button>
        </template>
        <AppSpinner v-else class="text-slate-400" />
      </div>
      <div class="card card-body text-sm">
        <p class="text-slate-500">Kepatuhan 30 hari (target &gt; 98%)</p>
        <template v-if="kepatuhan">
          <p class="text-3xl font-semibold tabular-nums" :class="kepatuhan.persen !== null && kepatuhan.persen < 98 ? 'text-rose-600' : 'text-emerald-700'">
            {{ kepatuhan.persen === null ? '-' : `${kepatuhan.persen}%` }}
          </p>
          <p class="text-xs text-slate-500">{{ kepatuhan.terkirim }} dari {{ kepatuhan.ditandatangani }} kunjungan bertanda tangan sudah terkirim</p>
        </template>
      </div>
      <div class="card card-body text-sm">
        <p class="text-slate-500">Antrean kirim</p>
        <div v-if="ss" class="mt-2 grid grid-cols-3 gap-2 text-center">
          <div class="tile"><p class="text-xl font-semibold tabular-nums">{{ ss.per_status.menunggu }}</p><p class="text-xs text-slate-500">menunggu</p></div>
          <div class="tile"><p class="text-xl font-semibold tabular-nums text-emerald-700">{{ ss.per_status.terkirim }}</p><p class="text-xs text-slate-500">terkirim</p></div>
          <div class="tile"><p class="text-xl font-semibold tabular-nums text-rose-600">{{ ss.per_status.gagal }}</p><p class="text-xs text-slate-500">gagal</p></div>
        </div>
      </div>
    </div>

    <div v-if="ss && !ss.terkonfigurasi" class="alert alert-warning mb-5 text-sm">
      <p class="font-medium">Langkah aktivasi</p>
      <ol class="mt-1 list-decimal space-y-0.5 pl-5">
        <li>Daftarkan klinik di portal SATUSEHAT untuk mendapatkan Organization ID, Client ID & Client Secret (mulai dari sandbox).</li>
        <li>Isi <code>SATUSEHAT_CLIENT_ID</code>, <code>SATUSEHAT_CLIENT_SECRET</code>, <code>SATUSEHAT_ORGANIZATION_ID</code>, lalu <code>SATUSEHAT_AKTIF=true</code> di .env server.</li>
        <li>Isi Location ID per cabang (Master Cabang) dan NIK dokter (Master Pengguna). Pasien wajib ber-NIK.</li>
        <li>Setelah uji sandbox lulus, ganti <code>SATUSEHAT_ENV=production</code> dengan kredensial produksi.</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-header flex-wrap">
        <div class="filter-bar">
          <FilterSelect v-model="ssList.filters.status" placeholder="Semua status" :options="opsiStatusSs" @change="ssList.load()" />
          <AppSpinner v-if="ssList.loading.value" class="text-slate-400" />
        </div>
        <button v-if="ss?.per_status.gagal" class="btn btn-secondary btn-sm" :disabled="!!aksi" @click="kirimUlangSemua"><AppSpinner v-if="aksi === 'semua'" size="size-3" />Kirim ulang semua gagal</button>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Kunjungan</th><th>Pasien</th><th>Status</th><th>Percobaan</th><th>Keterangan</th><th /></tr></thead>
          <tbody>
            <TableSkeleton v-if="ssList.loading.value && !ssList.items.value.length" :cols="6" />
            <tr v-for="k in ssList.items.value" :key="k.id">
              <td>
                <RouterLink :to="`/kunjungan/${k.kunjungan_id}`" class="font-medium underline">{{ k.kunjungan?.no_registrasi }}</RouterLink>
                <p class="text-xs text-slate-500">{{ tanggal(k.kunjungan?.tanggal) }} · {{ k.kunjungan?.dokter?.name ?? '-' }}</p>
              </td>
              <td>{{ k.kunjungan?.pasien?.nama }} <span class="text-xs text-slate-500">· {{ k.kunjungan?.pasien?.no_rm }}</span></td>
              <td><StatusBadge :status="k.status" /></td>
              <td class="tabular-nums text-xs">{{ k.percobaan }}× <span v-if="k.terakhir_dicoba_at" class="block text-slate-400">{{ waktu(k.terakhir_dicoba_at) }}</span></td>
              <td class="max-w-md text-xs" :class="k.error ? 'text-rose-700' : 'text-slate-500'">{{ k.error ?? (k.encounter_id ? `Encounter ${k.encounter_id}` : '-') }}</td>
              <td class="text-right">
                <button v-if="k.status !== 'terkirim'" class="btn btn-ghost btn-sm" :disabled="aksi === `ss-${k.id}`" @click="kirimUlang(k)"><AppSpinner v-if="aksi === `ss-${k.id}`" size="size-3" />Kirim ulang</button>
              </td>
            </tr>
            <tr v-if="!ssList.loading.value && !ssList.items.value.length"><td colspan="6" class="py-10 text-center text-slate-400">Belum ada kunjungan di antrean SATUSEHAT.</td></tr>
          </tbody>
        </table>
      </div>
      <AppPagination :meta="ssList.meta.value" @change="ssList.load" />
    </div>
  </template>

  <!-- WhatsApp -->
  <template v-else>
    <div class="mb-5 grid gap-4 lg:grid-cols-3">
      <div class="card card-body space-y-2 text-sm">
        <p class="text-slate-500">Status</p>
        <template v-if="wa">
          <p class="text-2xl font-semibold">{{ wa.aktif ? 'Aktif' : 'Nonaktif' }} <span class="text-sm font-normal text-slate-500">· driver {{ wa.driver }}</span></p>
          <p v-if="wa.driver === 'log'" class="text-amber-700">Mode uji: pesan hanya dicatat di log server, tidak terkirim ke pasien.</p>
          <p v-else :class="wa.terkonfigurasi ? 'text-emerald-700' : 'text-rose-600'">{{ wa.terkonfigurasi ? 'Kredensial WhatsApp Cloud API terisi' : 'Token / Phone Number ID belum diisi' }}</p>
          <p :class="wa.webhook_siap ? 'text-emerald-700' : 'text-amber-700'">{{ wa.webhook_siap ? 'Webhook siap (verify token & app secret terisi)' : 'Webhook belum dikonfigurasi — status baca & tombol balasan tidak tercatat' }}</p>
          <button class="btn btn-secondary btn-sm" :disabled="!!aksi || !wa.aktif" @click="jalankanPenjadwal"><AppSpinner v-if="aksi === 'jadwal'" size="size-3" />Jalankan penjadwal sekarang</button>
        </template>
        <AppSpinner v-else class="text-slate-400" />
      </div>
      <div class="card card-body text-sm lg:col-span-2">
        <p class="text-slate-500">Pesan 7 hari terakhir</p>
        <div v-if="wa" class="mt-2 grid grid-cols-5 gap-2 text-center">
          <div v-for="(l, s) in STATUS_WA" :key="s" class="tile">
            <p class="text-xl font-semibold tabular-nums" :class="{ 'text-rose-600': s === 'gagal' && wa.per_status_7_hari[s] }">{{ wa.per_status_7_hari[s] }}</p>
            <p class="text-xs text-slate-500">{{ l }}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          Penjadwal berjalan tiap 10 menit: reminder H-1 (setelah jam yang diatur), reminder ±2 jam sebelum jadwal, follow-up H+1 / H+7. Atur di Pengaturan → WhatsApp.
          Webhook: <code>/api/webhook/whatsapp</code>.
        </p>
      </div>
    </div>

    <div class="card">
      <div class="card-header flex-wrap">
        <div class="filter-bar">
          <FilterSelect v-model="waList.filters.jenis" placeholder="Semua jenis" :options="opsiJenis" @change="waList.load()" />
          <FilterSelect v-model="waList.filters.status" placeholder="Semua status" :options="opsiStatusWa" @change="waList.load()" />
          <AppSpinner v-if="waList.loading.value" class="text-slate-400" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Pasien</th><th>Jenis</th><th>Isi</th><th>Status</th><th>Balasan</th><th /></tr></thead>
          <tbody>
            <TableSkeleton v-if="waList.loading.value && !waList.items.value.length" :cols="6" />
            <tr v-for="p in waList.items.value" :key="p.id">
              <td>{{ p.pasien?.nama }} <span class="block text-xs text-slate-500">{{ p.no_tujuan }}</span></td>
              <td class="whitespace-nowrap text-xs">{{ JENIS[p.jenis] ?? p.jenis }}<span class="block text-slate-400">{{ waktu(p.created_at) }}</span></td>
              <td class="max-w-md text-xs text-slate-600">{{ p.pratinjau }}<span v-if="p.error" class="block text-rose-700">{{ p.error }}</span></td>
              <td><StatusBadge :status="`wa_${p.status}`" /></td>
              <td class="text-xs">{{ BALASAN[p.balasan] ?? '-' }}</td>
              <td class="text-right">
                <button v-if="['gagal', 'antre'].includes(p.status)" class="btn btn-ghost btn-sm" :disabled="aksi === `wa-${p.id}`" @click="kirimUlangPesan(p)"><AppSpinner v-if="aksi === `wa-${p.id}`" size="size-3" />Kirim ulang</button>
              </td>
            </tr>
            <tr v-if="!waList.loading.value && !waList.items.value.length"><td colspan="6" class="py-10 text-center text-slate-400">Belum ada pesan WhatsApp.</td></tr>
          </tbody>
        </table>
      </div>
      <AppPagination :meta="waList.meta.value" @change="waList.load" />
    </div>
  </template>
</template>
