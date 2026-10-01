<script setup>
/**
 * Jadwal praktik mingguan, cuti & jadwal tambahan per petugas di cabang aktif (PRD BK-03).
 * Ringkasan semua petugas per hari; klik petugas untuk mengubah jadwalnya (izin `jadwal.kelola`).
 */
import { computed, onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { HARI, hariIni, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const bisaKelola = computed(() => auth.can('jadwal.kelola'))

// Senin dulu, Minggu terakhir
const URUTAN_HARI = [1, 2, 3, 4, 5, 6, 0]
const hhmm = (v) => (v ?? '').slice(0, 5)

const petugas = ref([])
const praktiks = ref([])
const pengecualians = ref([])
const loading = ref(true)
const terpilih = ref(null)

async function muat() {
  loading.value = true
  try {
    const [p, j] = await Promise.all([cachedGet('/petugas'), api.get('/jadwals').then((r) => r.data)])
    petugas.value = p
    praktiks.value = j.praktiks
    pengecualians.value = j.pengecualians
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

/** Petugas medis + petugas yang sudah punya jadwal (mis. sudah tidak tercatat medis). */
const daftarPetugas = computed(() => {
  const map = new Map(petugas.value.map((p) => [p.id, { id: p.id, name: p.name, peran: p.peran }]))
  for (const j of praktiks.value) if (!map.has(j.user_id)) map.set(j.user_id, { id: j.user_id, name: j.user?.name ?? `#${j.user_id}`, peran: null })
  return [...map.values()]
})

const jadwalHari = (userId, hari) => praktiks.value.filter((j) => j.user_id === userId && j.hari === hari)
const cutiMendatang = (userId) => pengecualians.value.filter((c) => c.user_id === userId && c.tanggal >= hariIni())

const praktikTerpilih = computed(() => (terpilih.value ? praktiks.value.filter((j) => j.user_id === terpilih.value.id) : []))
const pengecualianTerpilih = computed(() => (terpilih.value ? pengecualians.value.filter((c) => c.user_id === terpilih.value.id) : []))

// Form jadwal praktik
const praktikOpen = ref(false)
const praktikEdit = ref(null)
const praktikForm = reactive({ hari: 1, jam_mulai: '09:00', jam_selesai: '17:00', is_active: true })
const errors = ref({})
const saving = ref(false)

function bukaPraktik(row = null, hari = 1) {
  praktikEdit.value = row
  errors.value = {}
  Object.assign(praktikForm, row
    ? { hari: row.hari, jam_mulai: hhmm(row.jam_mulai), jam_selesai: hhmm(row.jam_selesai), is_active: row.is_active }
    : { hari, jam_mulai: '09:00', jam_selesai: '17:00', is_active: true })
  praktikOpen.value = true
}

async function simpanPraktik() {
  saving.value = true
  errors.value = {}
  try {
    const payload = { ...praktikForm, user_id: terpilih.value.id }
    const { data } = praktikEdit.value
      ? await api.put(`/jadwals/${praktikEdit.value.id}`, payload)
      : await api.post('/jadwals', payload)
    const i = praktiks.value.findIndex((j) => j.id === data.id)
    i >= 0 ? praktiks.value.splice(i, 1, data) : praktiks.value.push(data)
    praktiks.value.sort((a, b) => a.hari - b.hari || a.jam_mulai.localeCompare(b.jam_mulai))
    toast.success('Jadwal praktik tersimpan.')
    praktikOpen.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

/** Salin jadwal Senin ke Selasa–Jumat (pola klinik umum). */
async function salinSenin() {
  const senin = praktikTerpilih.value.filter((j) => j.hari === 1)
  if (!senin.length) return toast.info('Belum ada jadwal Senin untuk disalin.')
  if (!confirm('Salin jadwal Senin ke Selasa–Jumat? Hari yang sudah punya jadwal dilewati.')) return
  saving.value = true
  try {
    for (const hari of [2, 3, 4, 5]) {
      if (praktikTerpilih.value.some((j) => j.hari === hari)) continue
      for (const j of senin) {
        const { data } = await api.post('/jadwals', { user_id: terpilih.value.id, hari, jam_mulai: hhmm(j.jam_mulai), jam_selesai: hhmm(j.jam_selesai), is_active: true })
        praktiks.value.push(data)
      }
    }
    praktiks.value.sort((a, b) => a.hari - b.hari || a.jam_mulai.localeCompare(b.jam_mulai))
    toast.success('Jadwal disalin.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function hapusPraktik(row) {
  if (!confirm(`Hapus jadwal ${HARI[row.hari]} ${hhmm(row.jam_mulai)}–${hhmm(row.jam_selesai)}?`)) return
  try {
    await api.delete(`/jadwals/${row.id}`)
    praktiks.value = praktiks.value.filter((j) => j.id !== row.id)
    toast.success('Jadwal dihapus.')
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

// Form cuti / jadwal tambahan
const cutiOpen = ref(false)
const cutiForm = reactive({ tipe: 'cuti', tanggal: hariIni(), sehari: true, jam_mulai: '', jam_selesai: '', keterangan: '' })

function bukaCuti(tipe = 'cuti') {
  errors.value = {}
  Object.assign(cutiForm, { tipe, tanggal: hariIni(), sehari: tipe === 'cuti', jam_mulai: tipe === 'tambahan' ? '09:00' : '', jam_selesai: tipe === 'tambahan' ? '13:00' : '', keterangan: '' })
  cutiOpen.value = true
}

async function simpanCuti() {
  saving.value = true
  errors.value = {}
  try {
    const sehari = cutiForm.tipe === 'cuti' && cutiForm.sehari
    const { data } = await api.post('/jadwal-pengecualians', {
      user_id: terpilih.value.id,
      tipe: cutiForm.tipe,
      tanggal: cutiForm.tanggal,
      jam_mulai: sehari ? null : cutiForm.jam_mulai || null,
      jam_selesai: sehari ? null : cutiForm.jam_selesai || null,
      keterangan: cutiForm.keterangan || null,
    })
    pengecualians.value.push(data)
    pengecualians.value.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    toast.success(cutiForm.tipe === 'cuti' ? 'Cuti tersimpan.' : 'Jadwal tambahan tersimpan.')
    cutiOpen.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function hapusCuti(row) {
  if (!confirm(`Hapus ${row.tipe === 'cuti' ? 'cuti' : 'jadwal tambahan'} ${tanggal(row.tanggal)}?`)) return
  try {
    await api.delete(`/jadwal-pengecualians/${row.id}`)
    pengecualians.value = pengecualians.value.filter((c) => c.id !== row.id)
    toast.success('Dihapus.')
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

const rentangCuti = (c) => (c.jam_mulai ? `${hhmm(c.jam_mulai)}–${hhmm(c.jam_selesai)}` : 'sehari penuh')

onMounted(muat)
</script>

<template>
  <PageHeader title="Jadwal Praktik" :subtitle="`Jadwal mingguan, cuti & jadwal tambahan petugas${auth.cabang ? ` di ${auth.cabang.nama}` : ''}. Slot booking hanya ditawarkan di jam praktik.`" />

  <p v-if="!auth.cabang && auth.lintasCabang" class="alert alert-warning mb-4">Pilih cabang di header untuk mengubah jadwal; jadwal berlaku per cabang.</p>

  <div class="card">
    <div class="card-header"><h2 class="card-title">Ringkasan mingguan</h2><AppSpinner v-if="loading" class="text-slate-400" /></div>
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Petugas</th>
            <th v-for="h in URUTAN_HARI" :key="h" class="text-center">{{ HARI[h].slice(0, 3) }}</th>
            <th>Cuti mendatang</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !daftarPetugas.length" :cols="10" />
          <tr v-for="p in daftarPetugas" :key="p.id" :class="{ 'bg-white/50': terpilih?.id === p.id }">
            <td>
              <p class="font-medium">{{ p.name }}</p>
              <p class="text-xs text-slate-500">{{ p.peran ?? '-' }}</p>
            </td>
            <td v-for="h in URUTAN_HARI" :key="h" class="text-center text-xs tabular-nums whitespace-nowrap">
              <template v-if="jadwalHari(p.id, h).length">
                <p v-for="j in jadwalHari(p.id, h)" :key="j.id" :class="{ 'text-slate-400 line-through': !j.is_active }">{{ hhmm(j.jam_mulai) }}–{{ hhmm(j.jam_selesai) }}</p>
              </template>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="text-xs">
              <p v-for="c in cutiMendatang(p.id).slice(0, 2)" :key="c.id" :class="c.tipe === 'cuti' ? 'text-rose-600' : 'text-emerald-700'">
                {{ c.tipe === 'cuti' ? 'Cuti' : 'Tambahan' }} {{ tanggal(c.tanggal) }}
              </p>
              <p v-if="cutiMendatang(p.id).length > 2" class="text-slate-400">+{{ cutiMendatang(p.id).length - 2 }} lagi</p>
            </td>
            <td class="text-right"><button class="btn btn-ghost btn-sm" @click="terpilih = p">{{ bisaKelola ? 'Atur' : 'Lihat' }}</button></td>
          </tr>
          <tr v-if="!loading && !daftarPetugas.length"><td colspan="10" class="py-10 text-center text-slate-400">Belum ada petugas medis di cabang ini.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="terpilih" class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <div class="card self-start">
      <div class="card-header flex-wrap">
        <h2 class="card-title">Jadwal mingguan · {{ terpilih.name }}</h2>
        <div v-if="bisaKelola" class="flex gap-2">
          <button class="btn btn-ghost btn-sm" :disabled="saving" @click="salinSenin">Salin Senin → Jumat</button>
          <button class="btn btn-secondary btn-sm" @click="bukaPraktik()">+ Jadwal</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Hari</th><th>Jam</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr v-for="j in praktikTerpilih" :key="j.id">
              <td>{{ HARI[j.hari] }}</td>
              <td class="tabular-nums">{{ hhmm(j.jam_mulai) }}–{{ hhmm(j.jam_selesai) }}</td>
              <td class="text-xs" :class="j.is_active ? 'text-emerald-700' : 'text-slate-400'">{{ j.is_active ? 'Aktif' : 'Nonaktif' }}</td>
              <td class="text-right whitespace-nowrap">
                <template v-if="bisaKelola">
                  <button class="btn btn-ghost btn-sm" @click="bukaPraktik(j)">Ubah</button>
                  <button class="btn btn-ghost btn-sm text-rose-600" @click="hapusPraktik(j)">Hapus</button>
                </template>
              </td>
            </tr>
            <tr v-if="!praktikTerpilih.length"><td colspan="4" class="py-6 text-center text-slate-400">Belum ada jadwal rutin.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card self-start">
      <div class="card-header flex-wrap">
        <h2 class="card-title">Cuti & jadwal tambahan</h2>
        <div v-if="bisaKelola" class="flex gap-2">
          <button class="btn btn-secondary btn-sm" @click="bukaCuti('tambahan')">+ Tambahan</button>
          <button class="btn btn-secondary btn-sm" @click="bukaCuti('cuti')">+ Cuti</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Tanggal</th><th>Jenis</th><th>Jam</th><th>Keterangan</th><th /></tr></thead>
          <tbody>
            <tr v-for="c in pengecualianTerpilih" :key="c.id" :class="{ 'opacity-50': c.tanggal < hariIni() }">
              <td class="whitespace-nowrap">{{ tanggal(c.tanggal) }}</td>
              <td :class="c.tipe === 'cuti' ? 'text-rose-600' : 'text-emerald-700'">{{ c.tipe === 'cuti' ? 'Cuti' : 'Tambahan' }}</td>
              <td class="tabular-nums whitespace-nowrap">{{ rentangCuti(c) }}</td>
              <td class="text-slate-600">{{ c.keterangan ?? '-' }}</td>
              <td class="text-right"><button v-if="bisaKelola" class="btn btn-ghost btn-sm text-rose-600" @click="hapusCuti(c)">Hapus</button></td>
            </tr>
            <tr v-if="!pengecualianTerpilih.length"><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada cuti / jadwal tambahan.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <AppModal v-model="praktikOpen" :title="praktikEdit ? 'Ubah Jadwal Praktik' : 'Jadwal Praktik Baru'">
    <form id="form-praktik" class="grid gap-4 sm:grid-cols-2" @submit.prevent="simpanPraktik">
      <div class="sm:col-span-2">
        <label class="label" for="jp-hari">Hari *</label>
        <select id="jp-hari" v-model.number="praktikForm.hari" class="input" :class="{ 'input-error': errors.hari }">
          <option v-for="h in URUTAN_HARI" :key="h" :value="h">{{ HARI[h] }}</option>
        </select>
        <p v-if="errors.hari" class="field-error">{{ errors.hari }}</p>
      </div>
      <div>
        <label class="label" for="jp-mulai">Jam mulai *</label>
        <input id="jp-mulai" v-model="praktikForm.jam_mulai" type="time" class="input" :class="{ 'input-error': errors.jam_mulai }" required />
        <p v-if="errors.jam_mulai" class="field-error">{{ errors.jam_mulai }}</p>
      </div>
      <div>
        <label class="label" for="jp-selesai">Jam selesai *</label>
        <input id="jp-selesai" v-model="praktikForm.jam_selesai" type="time" class="input" :class="{ 'input-error': errors.jam_selesai }" required />
        <p v-if="errors.jam_selesai" class="field-error">{{ errors.jam_selesai }}</p>
      </div>
      <label class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="praktikForm.is_active" type="checkbox" class="accent-brand-600" /> Aktif</label>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="praktikOpen = false">Batal</button>
      <button type="submit" form="form-praktik" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>

  <AppModal v-model="cutiOpen" :title="cutiForm.tipe === 'cuti' ? 'Cuti / Izin' : 'Jadwal Tambahan'">
    <form id="form-cuti" class="grid gap-4 sm:grid-cols-2" @submit.prevent="simpanCuti">
      <div class="sm:col-span-2">
        <label class="label" for="jc-tanggal">Tanggal *</label>
        <input id="jc-tanggal" v-model="cutiForm.tanggal" type="date" class="input" :class="{ 'input-error': errors.tanggal }" required />
        <p v-if="errors.tanggal" class="field-error">{{ errors.tanggal }}</p>
      </div>
      <label v-if="cutiForm.tipe === 'cuti'" class="flex items-center gap-2 text-sm sm:col-span-2">
        <input v-model="cutiForm.sehari" type="checkbox" class="accent-brand-600" /> Sehari penuh
      </label>
      <template v-if="cutiForm.tipe === 'tambahan' || !cutiForm.sehari">
        <div>
          <label class="label" for="jc-mulai">Jam mulai *</label>
          <input id="jc-mulai" v-model="cutiForm.jam_mulai" type="time" class="input" :class="{ 'input-error': errors.jam_mulai }" required />
          <p v-if="errors.jam_mulai" class="field-error">{{ errors.jam_mulai }}</p>
        </div>
        <div>
          <label class="label" for="jc-selesai">Jam selesai *</label>
          <input id="jc-selesai" v-model="cutiForm.jam_selesai" type="time" class="input" :class="{ 'input-error': errors.jam_selesai }" required />
          <p v-if="errors.jam_selesai" class="field-error">{{ errors.jam_selesai }}</p>
        </div>
      </template>
      <div class="sm:col-span-2">
        <label class="label" for="jc-ket">Keterangan</label>
        <input id="jc-ket" v-model="cutiForm.keterangan" class="input" :placeholder="cutiForm.tipe === 'cuti' ? 'mis. Seminar, cuti tahunan' : 'mis. Praktik Minggu khusus promo'" />
      </div>
      <p v-if="cutiForm.tipe === 'cuti'" class="text-xs text-slate-500 sm:col-span-2">Booking yang sudah ada di jam cuti tidak dibatalkan otomatis — cek kalender booking.</p>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="cutiOpen = false">Batal</button>
      <button type="submit" form="form-cuti" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>
</template>
