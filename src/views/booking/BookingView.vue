<script setup>
/**
 * Kalender booking multi-resource (PRD BK-01..03, BK-08, BK-09, AN-01).
 * Tampilan: per petugas (kolom = dokter/terapis, area abu = di luar jam praktik), per ruang/alat, dan daftar mingguan.
 * Klik area kosong kolom petugas → booking baru di jam itu. Klik booking → detail + aksi (konfirmasi, check-in, batal, no-show).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import BookingFormModal from '@/components/booking/BookingFormModal.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useQueryAction } from '@/composables/useQueryAction'
import api, { errorMessage } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { HARI, STATUS_APPOINTMENT, hariIni, isoTanggal, jam, tambahHari, tanggal, toOptions, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const bisaKelola = computed(() => auth.can('booking.kelola'))

const PIKSEL_PER_MENIT = 1.2
const MODE = [
  { value: 'petugas', label: 'Per petugas' },
  { value: 'ruang', label: 'Per ruang/alat' },
  { value: 'daftar', label: 'Daftar minggu ini' },
]

const mode = ref(sessionStorage.getItem('eklinik_booking_mode') ?? 'petugas')
watch(mode, (m) => {
  sessionStorage.setItem('eklinik_booking_mode', m)
  muat()
})
const tgl = ref(hariIni())
const filterStatus = ref('')

const petugas = ref([])
const sumberDayas = ref([])
const praktiks = ref([])
const pengecualians = ref([])
const appointments = ref([])
const loading = ref(false)

/** Senin minggu tanggal terpilih (tampilan daftar). */
const awalMinggu = computed(() => {
  const d = new Date(`${tgl.value}T00:00:00`)
  return tambahHari(tgl.value, -((d.getDay() + 6) % 7))
})

async function muatReferensi() {
  try {
    const [p, sd, j] = await Promise.all([
      cachedGet('/petugas'),
      cachedGet('/sumber-dayas', { status: 'aktif', per_page: 100 }),
      api.get('/jadwals', { silent: true }).then((r) => r.data),
    ])
    petugas.value = p
    sumberDayas.value = sd.data
    praktiks.value = j.praktiks
    pengecualians.value = j.pengecualians
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

let urut = 0
async function muat() {
  const u = ++urut
  loading.value = true
  const [dari, sampai] = mode.value === 'daftar' ? [awalMinggu.value, tambahHari(awalMinggu.value, 6)] : [tgl.value, tgl.value]
  try {
    const { data } = await api.get('/appointments', { params: { dari, sampai, status: filterStatus.value || undefined, per_page: 500 } })
    if (u === urut) appointments.value = data.data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    if (u === urut) loading.value = false
  }
}

function geser(n) {
  tgl.value = tambahHari(tgl.value, mode.value === 'daftar' ? n * 7 : n)
}
watch(tgl, muat)

// ---------- Timeline ----------
const hhmm = (v) => (v ?? '').slice(0, 5)
const menitDari = (hm) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
const menitTanggal = (iso) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
const hariTerpilih = computed(() => new Date(`${tgl.value}T00:00:00`).getDay())

/** Rentang jam kerja satu petugas pada tanggal terpilih: pola mingguan + tambahan − cuti (perkiraan tampilan; backend tetap acuan). */
function jamKerja(userId) {
  const cuti = pengecualians.value.filter((c) => c.user_id === userId && c.tanggal === tgl.value)
  if (cuti.some((c) => c.tipe === 'cuti' && !c.jam_mulai)) return []
  const rentang = [
    ...praktiks.value.filter((j) => j.user_id === userId && j.hari === hariTerpilih.value && j.is_active),
    ...cuti.filter((c) => c.tipe === 'tambahan'),
  ].map((r) => [menitDari(hhmm(r.jam_mulai)), menitDari(hhmm(r.jam_selesai))])
  let hasil = rentang
  for (const c of cuti.filter((c) => c.tipe === 'cuti' && c.jam_mulai)) {
    const [cm, cs] = [menitDari(hhmm(c.jam_mulai)), menitDari(hhmm(c.jam_selesai))]
    hasil = hasil.flatMap(([m, s]) => [[m, Math.min(s, cm)], [Math.max(m, cs), s]].filter(([a, b]) => b > a))
  }
  return hasil
}

const aktif = computed(() => appointments.value.filter((a) => !filterStatus.value || a.status === filterStatus.value))

const kolom = computed(() => {
  if (mode.value === 'ruang') {
    const cols = sumberDayas.value.map((sd) => ({ key: `sd-${sd.id}`, id: sd.id, judul: sd.nama, sub: sd.tipe === 'alat' ? 'Alat' : 'Ruang', kerja: null }))
    return cols.map((c) => ({ ...c, items: aktif.value.filter((a) => a.sumber_dayas?.some((sd) => sd.id === c.id)) }))
  }
  // Petugas yang praktik hari ini atau punya booking; ditambah kolom "Belum ditentukan" bila ada
  const ids = new Set([...petugas.value.filter((p) => jamKerja(p.id).length).map((p) => p.id), ...aktif.value.map((a) => a.petugas_id).filter(Boolean)])
  const cols = [...ids].map((id) => {
    const p = petugas.value.find((x) => x.id === id)
    const a = aktif.value.find((x) => x.petugas_id === id)
    return { key: `p-${id}`, id, judul: p?.name ?? a?.petugas?.name ?? `#${id}`, sub: p?.peran ?? '', kerja: jamKerja(id) }
  })
  if (aktif.value.some((a) => !a.petugas_id)) cols.push({ key: 'p-none', id: null, judul: 'Belum ditentukan', sub: '', kerja: null })
  return cols.map((c) => ({ ...c, items: aktif.value.filter((a) => (a.petugas_id ?? null) === c.id) }))
})

/** Batas timeline: jam kerja paling awal/akhir & booking, dibulatkan ke jam penuh, minimal 08:00–18:00. */
const batas = computed(() => {
  let awal = 8 * 60
  let akhir = 18 * 60
  for (const c of kolom.value) {
    for (const [m, s] of c.kerja ?? []) {
      awal = Math.min(awal, m)
      akhir = Math.max(akhir, s)
    }
    for (const a of c.items) {
      awal = Math.min(awal, menitTanggal(a.mulai_at))
      akhir = Math.max(akhir, menitTanggal(a.selesai_at))
    }
  }
  return [Math.floor(awal / 60) * 60, Math.ceil(akhir / 60) * 60]
})
const tinggi = computed(() => (batas.value[1] - batas.value[0]) * PIKSEL_PER_MENIT)
const jamGaris = computed(() => {
  const out = []
  for (let m = batas.value[0]; m <= batas.value[1]; m += 60) out.push(m)
  return out
})
const posisi = (mulai, selesai) => ({
  top: `${(mulai - batas.value[0]) * PIKSEL_PER_MENIT}px`,
  height: `${Math.max(selesai - mulai, 15) * PIKSEL_PER_MENIT}px`,
})
const labelMenit = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Garis "sekarang" bila melihat hari ini. */
const sekarang = ref(new Date())
const jamTimer = setInterval(() => (sekarang.value = new Date()), 60_000)
onUnmounted(() => clearInterval(jamTimer))
const garisSekarang = computed(() => {
  if (tgl.value !== isoTanggal(sekarang.value)) return null
  const m = sekarang.value.getHours() * 60 + sekarang.value.getMinutes()
  return m >= batas.value[0] && m <= batas.value[1] ? (m - batas.value[0]) * PIKSEL_PER_MENIT : null
})

const WARNA = {
  dijadwalkan: 'border-indigo-400 bg-indigo-50/90',
  dikonfirmasi: 'border-violet-500 bg-violet-50/90',
  hadir: 'border-emerald-500 bg-emerald-50/90',
  batal: 'border-slate-300 bg-slate-100/80 opacity-60',
  tidak_hadir: 'border-rose-400 bg-rose-50/90 opacity-80',
}

function klikKolom(c, e) {
  if (!bisaKelola.value || mode.value !== 'petugas' || c.id === null) return
  const y = e.offsetY
  const menit = Math.floor((batas.value[0] + y / PIKSEL_PER_MENIT) / 15) * 15
  bukaBaru({ petugas_id: c.id, tanggal: tgl.value, jam: labelMenit(menit) })
}

// ---------- Ringkasan ----------
const ringkasan = computed(() => {
  const r = { total: 0, dikonfirmasi: 0, hadir: 0, tidak_hadir: 0, batal: 0 }
  for (const a of appointments.value) {
    r.total++
    if (r[a.status] !== undefined) r[a.status]++
  }
  return r
})

// ---------- Daftar mingguan ----------
const hariMinggu = computed(() => Array.from({ length: 7 }, (_, i) => tambahHari(awalMinggu.value, i)))
const perHari = (iso) => aktif.value.filter((a) => isoTanggal(new Date(a.mulai_at)) === iso)

// ---------- Form & detail ----------
const formOpen = ref(false)
const formAppointment = ref(null)
const formPreset = ref({})

function bukaBaru(preset = {}) {
  formAppointment.value = null
  formPreset.value = { tanggal: tgl.value, ...preset }
  formOpen.value = true
}

function bukaUbah(a) {
  detailOpen.value = false
  formAppointment.value = a
  formOpen.value = true
}

function tersimpan(a) {
  const i = appointments.value.findIndex((x) => x.id === a.id)
  i >= 0 ? appointments.value.splice(i, 1, a) : muat()
  const tanggalBooking = isoTanggal(new Date(a.mulai_at))
  if (mode.value !== 'daftar' && tanggalBooking !== tgl.value) tgl.value = tanggalBooking
}

const detailOpen = ref(false)
const detail = ref(null)
const aksi = ref('')

function bukaDetail(a) {
  detail.value = a
  detailOpen.value = true
}

const bisaDiubah = (a) => ['dijadwalkan', 'dikonfirmasi'].includes(a.status)
const sudahLewat = (a) => new Date(a.mulai_at) <= new Date()
const hariIniBooking = (a) => isoTanggal(new Date(a.mulai_at)) === hariIni()

async function jalankan(nama, url, body = {}, pesan = '') {
  aksi.value = nama
  try {
    const { data } = await api.post(url, body)
    const a = data.appointment ?? data
    tersimpan(a)
    detail.value = a
    if (pesan) toast.success(pesan)
    return data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

const konfirmasi = (a) => jalankan('konfirmasi', `/appointments/${a.id}/konfirmasi`, {}, 'Booking dikonfirmasi.')
const tidakHadir = (a) => confirm(`Tandai ${a.pasien.nama} tidak hadir (no-show)?`) && jalankan('tidak-hadir', `/appointments/${a.id}/tidak-hadir`, {}, 'Ditandai tidak hadir.')

function batal(a) {
  const alasan = prompt(`Batalkan booking ${a.no_booking} (${a.pasien.nama})?\nAlasan pembatalan:`)
  if (alasan === null) return
  jalankan('batal', `/appointments/${a.id}/batal`, { alasan_batal: alasan || null }, 'Booking dibatalkan.')
}

async function checkin(a) {
  const data = await jalankan('checkin', `/appointments/${a.id}/checkin`)
  if (!data?.kunjungan) return
  const k = data.kunjungan
  toast.success(`${k.pasien.nama} check-in: antrian ${k.poli.kode}-${k.no_antrian} (${k.no_registrasi}).`)
}

async function hapus(a) {
  if (!confirm(`Hapus booking ${a.no_booking}? Gunakan "Batalkan" agar riwayat pembatalan tetap tercatat.`)) return
  aksi.value = 'hapus'
  try {
    await api.delete(`/appointments/${a.id}`)
    appointments.value = appointments.value.filter((x) => x.id !== a.id)
    detailOpen.value = false
    toast.success('Booking dihapus.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

const rentangJam = (a) => `${jam(a.mulai_at)}–${jam(a.selesai_at)}`
const namaTreatment = (a) => a.tindakans.map((t) => t.tindakan?.nama).filter(Boolean).join(', ')
const judulTanggal = computed(() => {
  if (mode.value === 'daftar') return `${tanggal(awalMinggu.value)} – ${tanggal(tambahHari(awalMinggu.value, 6))}`
  return `${HARI[hariTerpilih.value]}, ${tanggal(tgl.value)}`
})

useQueryAction('baru', () => bukaBaru())

onMounted(async () => {
  await muatReferensi()
  muat()
})
</script>

<template>
  <PageHeader title="Kalender Booking" :subtitle="`Jadwal booking dokter, terapis, ruang & alat${auth.cabang ? ` · ${auth.cabang.nama}` : ''}`">
    <RouterLink to="/booking/jadwal" class="btn btn-secondary">Jadwal praktik</RouterLink>
    <button v-if="bisaKelola" class="btn btn-primary" @click="bukaBaru()">+ Booking</button>
  </PageHeader>

  <p v-if="!auth.cabang && auth.lintasCabang" class="alert alert-warning mb-4">Pilih cabang di header: booking & jadwal berlaku per cabang.</p>

  <div class="card">
    <div class="card-header flex-wrap gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-secondary btn-icon btn-sm" aria-label="Sebelumnya" @click="geser(-1)">‹</button>
        <button class="btn btn-secondary btn-sm" @click="tgl = hariIni()">Hari ini</button>
        <button class="btn btn-secondary btn-icon btn-sm" aria-label="Berikutnya" @click="geser(1)">›</button>
        <input v-model="tgl" type="date" class="input w-auto py-1.5" aria-label="Tanggal" />
        <span class="font-semibold text-slate-800">{{ judulTanggal }}</span>
        <AppSpinner v-if="loading" class="text-slate-400" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <FilterSelect v-model="filterStatus" placeholder="Semua status" :options="toOptions(STATUS_APPOINTMENT)" @change="muat()" />
        <div class="tabs">
          <button v-for="m in MODE" :key="m.value" class="tab" :class="{ 'tab-active': mode === m.value }" @click="mode = m.value">{{ m.label }}</button>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-5 py-2 text-xs text-slate-600">
      <span><b class="tabular-nums text-slate-800">{{ ringkasan.total }}</b> booking</span>
      <span><b class="tabular-nums text-violet-700">{{ ringkasan.dikonfirmasi }}</b> dikonfirmasi</span>
      <span><b class="tabular-nums text-emerald-700">{{ ringkasan.hadir }}</b> hadir</span>
      <span><b class="tabular-nums text-rose-600">{{ ringkasan.tidak_hadir }}</b> tidak hadir</span>
      <span><b class="tabular-nums">{{ ringkasan.batal }}</b> batal</span>
    </div>

    <!-- Timeline per petugas / ruang -->
    <div v-if="mode !== 'daftar'" class="overflow-x-auto [contain:inline-size]">
      <div v-if="!kolom.length" class="py-14 text-center text-sm text-slate-400">
        {{ mode === 'ruang' ? 'Belum ada ruang/alat aktif di cabang ini.' : 'Tidak ada petugas yang praktik dan belum ada booking pada tanggal ini.' }}
      </div>
      <div v-else class="flex min-w-max">
        <!-- Sumbu jam -->
        <div class="sticky left-0 z-10 w-14 shrink-0 bg-white/70 backdrop-blur">
          <div class="h-12 border-b border-line" />
          <div class="relative" :style="{ height: `${tinggi}px` }">
            <span v-for="m in jamGaris" :key="m" class="absolute -translate-y-1/2 pl-2 text-[11px] tabular-nums text-slate-400" :style="{ top: `${(m - batas[0]) * PIKSEL_PER_MENIT}px` }">{{ labelMenit(m) }}</span>
          </div>
        </div>
        <div v-for="c in kolom" :key="c.key" class="w-48 shrink-0 border-l border-line">
          <div class="h-12 border-b border-line px-2 py-1.5">
            <p class="truncate text-sm font-semibold" :title="c.judul">{{ c.judul }}</p>
            <p class="truncate text-[11px] text-slate-500">{{ c.sub }}<template v-if="c.kerja && !c.kerja.length"> · tidak praktik</template></p>
          </div>
          <div
            class="relative"
            :class="{ 'cursor-copy': bisaKelola && mode === 'petugas' && c.id !== null, 'bg-slate-200/40': c.kerja !== null }"
            :style="{ height: `${tinggi}px` }"
            @click.self="klikKolom(c, $event)"
          >
            <!-- jam praktik (putih) di atas latar abu = di luar jadwal -->
            <div v-for="([m, s], i) in c.kerja ?? []" :key="i" class="pointer-events-none absolute inset-x-0 bg-white/60" :style="posisi(m, s)" />
            <div v-for="m in jamGaris" :key="m" class="pointer-events-none absolute inset-x-0 border-t border-line/70" :style="{ top: `${(m - batas[0]) * PIKSEL_PER_MENIT}px` }" />
            <div v-if="garisSekarang !== null" class="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-500" :style="{ top: `${garisSekarang}px` }" />
            <button
              v-for="a in c.items"
              :key="a.id"
              class="absolute inset-x-1 z-[5] overflow-hidden rounded-xl border-l-4 px-2 py-1 text-left text-xs shadow-sm transition hover:shadow-md"
              :class="WARNA[a.status]"
              :style="posisi(menitTanggal(a.mulai_at), menitTanggal(a.selesai_at))"
              :title="`${rentangJam(a)} · ${a.pasien.nama} · ${namaTreatment(a)}`"
              @click="bukaDetail(a)"
            >
              <p class="font-semibold tabular-nums">{{ rentangJam(a) }}<span v-if="a.minta_ubah_at" class="ml-1 rounded bg-amber-500 px-1 text-[10px] font-bold text-white" title="Pasien meminta ubah jadwal lewat WhatsApp">UBAH?</span></p>
              <p class="truncate font-medium text-slate-800">{{ a.pasien.nama }}</p>
              <p class="truncate text-slate-600">{{ namaTreatment(a) }}</p>
              <p v-if="mode === 'ruang'" class="truncate text-slate-500">{{ a.petugas?.name }}</p>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Daftar mingguan -->
    <div v-else class="divide-y divide-line">
      <div v-for="h in hariMinggu" :key="h" class="px-5 py-3">
        <p class="mb-2 text-sm font-semibold" :class="h === hariIni() ? 'text-brand-900' : 'text-slate-700'">
          {{ HARI[new Date(`${h}T00:00:00`).getDay()] }}, {{ tanggal(h) }} <span class="text-xs font-normal text-slate-500">· {{ perHari(h).length }} booking</span>
        </p>
        <div v-if="perHari(h).length" class="overflow-x-auto">
          <table class="table">
            <tbody>
              <tr v-for="a in perHari(h)" :key="a.id" class="cursor-pointer" @click="bukaDetail(a)">
                <td class="w-28 whitespace-nowrap tabular-nums">{{ rentangJam(a) }}</td>
                <td>
                  <p class="font-medium">{{ a.pasien.nama }} <span class="text-xs text-slate-500">· {{ a.pasien.no_rm }}</span></p>
                  <p class="text-xs text-slate-500">{{ namaTreatment(a) }}</p>
                </td>
                <td class="text-slate-600">{{ a.petugas?.name ?? '-' }}</td>
                <td class="text-xs text-slate-500">{{ a.sumber_dayas.map((s) => s.nama).join(', ') || '-' }}</td>
                <td class="text-right"><StatusBadge :status="a.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-xs text-slate-400">Tidak ada booking.</p>
      </div>
    </div>
  </div>

  <BookingFormModal v-model="formOpen" :appointment="formAppointment" :preset="formPreset" @saved="tersimpan" />

  <AppModal v-model="detailOpen" :title="detail ? `Booking ${detail.no_booking}` : 'Booking'" size="max-w-xl">
    <div v-if="detail" class="space-y-4 text-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-base font-semibold">{{ detail.pasien.nama }}</p>
          <p class="text-slate-600">RM {{ detail.pasien.no_rm }}<template v-if="detail.pasien.no_hp"> · {{ detail.pasien.no_hp }}</template></p>
        </div>
        <StatusBadge :status="detail.status" />
      </div>
      <dl class="grid grid-cols-3 gap-x-3 gap-y-2">
        <dt class="text-slate-500">Jadwal</dt>
        <dd class="col-span-2">{{ HARI[new Date(detail.mulai_at).getDay()] }}, {{ tanggal(detail.mulai_at) }} · <b class="tabular-nums">{{ rentangJam(detail) }}</b></dd>
        <dt class="text-slate-500">Treatment</dt>
        <dd class="col-span-2">
          <p v-for="t in detail.tindakans" :key="t.id">{{ t.tindakan?.nama }} <span class="text-xs text-slate-500">{{ t.durasi_menit }}{{ t.buffer_menit ? `+${t.buffer_menit}` : '' }} mnt</span></p>
        </dd>
        <dt class="text-slate-500">Petugas</dt>
        <dd class="col-span-2">{{ detail.petugas?.name ?? 'Belum ditentukan' }}</dd>
        <dt class="text-slate-500">Poli</dt>
        <dd class="col-span-2">{{ detail.poli?.nama ?? '-' }}</dd>
        <dt class="text-slate-500">Ruang/alat</dt>
        <dd class="col-span-2">{{ detail.sumber_dayas.map((s) => s.nama).join(', ') || '-' }}</dd>
        <template v-if="detail.catatan">
          <dt class="text-slate-500">Catatan</dt>
          <dd class="col-span-2 whitespace-pre-line">{{ detail.catatan }}</dd>
        </template>
        <template v-if="detail.alasan_batal">
          <dt class="text-slate-500">Alasan batal</dt>
          <dd class="col-span-2">{{ detail.alasan_batal }}</dd>
        </template>
        <template v-if="detail.kunjungan">
          <dt class="text-slate-500">Kunjungan</dt>
          <dd class="col-span-2">
            <RouterLink :to="`/kunjungan/${detail.kunjungan.id}`" class="underline">{{ detail.kunjungan.no_registrasi }}</RouterLink>
            · antrian {{ detail.kunjungan.no_antrian }} <StatusBadge :status="detail.kunjungan.status" />
          </dd>
        </template>
      </dl>
      <p v-if="bisaDiubah(detail) && hariIniBooking(detail) && !detail.poli_id" class="alert alert-warning">Lengkapi poli (Ubah) sebelum check-in.</p>
      <p v-if="detail.minta_ubah_at" class="alert alert-warning">Pasien meminta ubah jadwal lewat WhatsApp ({{ waktu(detail.minta_ubah_at) }}). Hubungi pasien lalu ubah jadwal — tanda ini hilang setelah booking diubah.</p>
      <p v-if="detail.status === 'dikonfirmasi' && detail.dikonfirmasi_via === 'wa'" class="text-xs text-emerald-700">✓ Dikonfirmasi pasien lewat WhatsApp</p>
    </div>
    <template #footer>
      <template v-if="detail && bisaKelola">
        <button v-if="!detail.kunjungan_id" class="btn btn-ghost text-rose-600 mr-auto" :disabled="!!aksi" @click="hapus(detail)">Hapus</button>
        <template v-if="bisaDiubah(detail)">
          <button class="btn btn-secondary" :disabled="!!aksi" @click="batal(detail)"><AppSpinner v-if="aksi === 'batal'" />Batalkan</button>
          <button v-if="sudahLewat(detail)" class="btn btn-secondary" :disabled="!!aksi" @click="tidakHadir(detail)"><AppSpinner v-if="aksi === 'tidak-hadir'" />Tidak hadir</button>
          <button class="btn btn-secondary" :disabled="!!aksi" @click="bukaUbah(detail)">Ubah</button>
          <button v-if="detail.status === 'dijadwalkan'" class="btn btn-secondary" :disabled="!!aksi" @click="konfirmasi(detail)"><AppSpinner v-if="aksi === 'konfirmasi'" />Konfirmasi</button>
          <button v-if="hariIniBooking(detail)" class="btn btn-primary" :disabled="!!aksi || !detail.poli_id" @click="checkin(detail)"><AppSpinner v-if="aksi === 'checkin'" />Check-in</button>
        </template>
      </template>
      <button v-if="detail?.kunjungan_id" class="btn btn-primary" @click="router.push(`/kunjungan/${detail.kunjungan_id}`)">Buka kunjungan</button>
    </template>
  </AppModal>
</template>
