<script setup>
/**
 * Komisi & jasa medis (PRD KM-01, KM-03, TR-01): rekap per petugas per periode (bulan) di cabang aktif, slip per petugas,
 * hitung ulang periode draf, setujui & kunci periode; tab Aturan untuk mengelola aturan komisi per treatment/kategori/semua.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import SlipKomisi from '@/components/komisi/SlipKomisi.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { rupiah, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const bisaKelola = computed(() => auth.can('komisi.kelola'))
const bisaSetujui = computed(() => auth.can('komisi.setujui'))

const sekarang = new Date()
const periode = ref(`${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}`)
const tab = ref('rekap')

// ---------- Rekap ----------
const rekap = ref(null)
const loading = ref(false)
const aksi = ref('')

async function muatRekap() {
  loading.value = true
  try {
    rekap.value = (await api.get('/komisi/rekap', { params: { periode: periode.value } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}
watch(periode, () => tab.value === 'rekap' && muatRekap())

const terkunci = computed(() => rekap.value?.status === 'disetujui')
const perluCabang = computed(() => !auth.cabang && auth.lintasCabang)

async function hitungUlang() {
  if (!confirm(`Hitung ulang komisi ${periode.value} memakai aturan terbaru? Periode belum disetujui sehingga angka akan berubah.`)) return
  aksi.value = 'hitung'
  try {
    rekap.value = (await api.post('/komisi/hitung-ulang', { periode: periode.value })).data
    toast.success('Komisi dihitung ulang.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

const setujuiOpen = ref(false)
const catatanSetujui = ref('')
async function setujui() {
  aksi.value = 'setujui'
  try {
    rekap.value = (await api.post('/komisi/setujui', { periode: periode.value, catatan: catatanSetujui.value || null })).data
    toast.success(`Komisi ${periode.value} disetujui & dikunci.`)
    setujuiOpen.value = false
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aksi.value = ''
  }
}

// ---------- Slip ----------
const slip = ref(null)
const slipLoading = ref(null)
const slipOpen = computed({ get: () => !!slip.value, set: (v) => !v && (slip.value = null) })
async function bukaSlip(p) {
  slipLoading.value = p.user_id
  try {
    slip.value = (await api.get('/komisi/rincian', { params: { periode: periode.value, user_id: p.user_id } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    slipLoading.value = null
  }
}

// ---------- Aturan ----------
const PERAN = { dokter: 'Dokter', terapis: 'Terapis / perawat', asisten: 'Asisten' }
const aturans = ref([])
const aturanLoading = ref(false)
const kategoris = ref([])
const cabangs = ref([])

async function muatAturan() {
  aturanLoading.value = true
  try {
    const [a, k, c] = await Promise.all([api.get('/aturan-komisis', { params: { per_page: 200 } }).then((r) => r.data.data), cachedGet('/kategori-tindakans'), cachedGet('/cabangs')])
    aturans.value = a
    kategoris.value = k
    cabangs.value = c
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aturanLoading.value = false
  }
}

const cakupan = (a) => (a.tindakan ? `Treatment: ${a.tindakan.nama}` : a.kategori ? `Kategori: ${a.kategori.nama}` : 'Semua treatment')
const nilaiAturan = (a) => (a.jenis === 'persen' ? `${a.nilai}% dari nilai tindakan` : `${rupiah(a.nilai)} per tindakan`)

const formOpen = ref(false)
const editing = ref(null)
const form = reactive({ cakupan: 'semua', tindakan: null, kategori_id: '', cabang_id: '', peran: 'dokter', jenis: 'persen', nilai: 10, is_active: true, keterangan: '' })
const errors = ref({})
const saving = ref(false)

function bukaForm(a = null) {
  editing.value = a
  errors.value = {}
  Object.assign(form, {
    cakupan: a?.tindakan_id ? 'treatment' : a?.kategori_id ? 'kategori' : 'semua',
    tindakan: a?.tindakan ?? null,
    kategori_id: a?.kategori_id ?? '',
    cabang_id: a?.cabang_id ?? '',
    peran: a?.peran ?? 'dokter',
    jenis: a?.jenis ?? 'persen',
    nilai: a?.nilai ?? 10,
    is_active: a?.is_active ?? true,
    keterangan: a?.keterangan ?? '',
  })
  formOpen.value = true
}

async function simpanAturan() {
  saving.value = true
  errors.value = {}
  const payload = {
    tindakan_id: form.cakupan === 'treatment' ? form.tindakan?.id ?? null : null,
    kategori_id: form.cakupan === 'kategori' ? form.kategori_id || null : null,
    cabang_id: form.cabang_id || null,
    peran: form.peran,
    jenis: form.jenis,
    nilai: form.nilai,
    is_active: form.is_active,
    keterangan: form.keterangan || null,
  }
  if (form.cakupan === 'treatment' && !payload.tindakan_id) {
    saving.value = false
    return toast.error('Pilih treatment.')
  }
  try {
    editing.value ? await api.put(`/aturan-komisis/${editing.value.id}`, payload) : await api.post('/aturan-komisis', payload)
    toast.success('Aturan komisi tersimpan. Komisi periode berjalan memakai aturan baru setelah dihitung ulang.')
    formOpen.value = false
    muatAturan()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function hapusAturan(a) {
  if (!confirm(`Hapus aturan "${cakupan(a)} · ${PERAN[a.peran]}"? Komisi yang sudah tercatat tidak berubah.`)) return
  try {
    await api.delete(`/aturan-komisis/${a.id}`)
    aturans.value = aturans.value.filter((x) => x.id !== a.id)
    toast.success('Aturan dihapus.')
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function pilihTab(t) {
  tab.value = t
  t === 'rekap' ? muatRekap() : muatAturan()
}

onMounted(muatRekap)
</script>

<template>
  <PageHeader title="Komisi & Jasa Medis" :subtitle="`Komisi dokter, terapis & asisten per periode${auth.cabang ? ` · ${auth.cabang.nama}` : ''}`">
    <input v-if="tab === 'rekap'" v-model="periode" type="month" class="input w-auto" aria-label="Periode" />
  </PageHeader>

  <div class="tabs mb-4">
    <button class="tab" :class="{ 'tab-active': tab === 'rekap' }" @click="pilihTab('rekap')">Rekap periode</button>
    <button v-if="bisaKelola" class="tab" :class="{ 'tab-active': tab === 'aturan' }" @click="pilihTab('aturan')">Aturan komisi</button>
  </div>

  <!-- Rekap -->
  <div v-if="tab === 'rekap'" class="card">
    <div class="card-header flex-wrap">
      <div class="flex items-center gap-3">
        <h2 class="card-title">Rekap {{ periode }}</h2>
        <StatusBadge v-if="rekap" :status="terkunci ? 'disetujui' : 'draf'" />
        <span v-if="terkunci" class="text-xs text-slate-500">oleh {{ rekap.disetujui_oleh }}, {{ waktu(rekap.disetujui_at) }}</span>
        <AppSpinner v-if="loading" class="text-slate-400" />
      </div>
      <div v-if="!perluCabang" class="flex gap-2">
        <button v-if="bisaKelola && !terkunci" class="btn btn-secondary btn-sm" :disabled="!!aksi" @click="hitungUlang"><AppSpinner v-if="aksi === 'hitung'" size="size-3" />Hitung ulang</button>
        <button v-if="bisaSetujui && !terkunci" class="btn btn-primary btn-sm" :disabled="!!aksi" @click="setujuiOpen = true">Setujui & kunci</button>
      </div>
    </div>
    <p v-if="perluCabang" class="alert alert-warning m-5">Menampilkan semua cabang. Pilih cabang di header untuk menghitung ulang atau menyetujui periode.</p>
    <p v-if="rekap?.catatan" class="px-5 pt-3 text-xs text-slate-600">Catatan persetujuan: {{ rekap.catatan }}</p>
    <div class="overflow-x-auto">
      <table class="table">
        <thead><tr><th>Petugas</th><th>Peran</th><th class="text-right">Tindakan</th><th class="text-right">Komisi</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="loading && !rekap" :cols="5" />
          <tr v-for="p in rekap?.petugas ?? []" :key="p.user_id">
            <td class="font-medium">{{ p.nama }}</td>
            <td class="text-xs text-slate-600">{{ p.per_peran.map((r) => `${r.label} ${rupiah(r.total)}`).join(' · ') }}</td>
            <td class="text-right tabular-nums">{{ p.jumlah_tindakan }}</td>
            <td class="text-right font-semibold tabular-nums" :class="{ 'text-rose-600': p.total < 0 }">{{ rupiah(p.total) }}</td>
            <td class="text-right">
              <button v-if="bisaKelola" class="btn btn-ghost btn-sm" :disabled="slipLoading === p.user_id" @click="bukaSlip(p)"><AppSpinner v-if="slipLoading === p.user_id" size="size-3" />Slip</button>
            </td>
          </tr>
          <tr v-if="rekap && !rekap.petugas.length">
            <td colspan="5" class="py-10 text-center text-slate-400">
              Belum ada komisi di periode ini.<template v-if="bisaKelola"> Pastikan aturan komisi sudah dibuat, lalu klik "Hitung ulang".</template>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="rekap?.petugas?.length">
          <tr><td colspan="3" class="font-semibold">Total</td><td class="text-right font-semibold tabular-nums">{{ rupiah(rekap.total) }}</td><td /></tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- Aturan -->
  <div v-else class="card">
    <div class="card-header">
      <div>
        <h2 class="card-title">Aturan komisi</h2>
        <p class="text-xs text-slate-500">Aturan paling spesifik dipakai: treatment &gt; kategori &gt; semua; aturan khusus cabang diutamakan.</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="bukaForm()">+ Aturan</button>
    </div>
    <div class="overflow-x-auto">
      <table class="table">
        <thead><tr><th>Cakupan</th><th>Cabang</th><th>Peran</th><th>Komisi</th><th>Status</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="aturanLoading && !aturans.length" :cols="6" />
          <tr v-for="a in aturans" :key="a.id">
            <td>{{ cakupan(a) }}<p v-if="a.keterangan" class="text-xs text-slate-500">{{ a.keterangan }}</p></td>
            <td class="text-slate-600">{{ a.cabang?.nama ?? 'Semua cabang' }}</td>
            <td>{{ PERAN[a.peran] }}</td>
            <td class="tabular-nums">{{ nilaiAturan(a) }}</td>
            <td><StatusBadge :status="a.is_active ? 'aktif' : 'nonaktif'" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="bukaForm(a)">Ubah</button>
              <button class="btn btn-ghost btn-sm text-rose-600" @click="hapusAturan(a)">Hapus</button>
            </td>
          </tr>
          <tr v-if="!aturanLoading && !aturans.length"><td colspan="6" class="py-10 text-center text-slate-400">Belum ada aturan komisi.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <AppModal v-model="formOpen" :title="editing ? 'Ubah Aturan Komisi' : 'Aturan Komisi Baru'">
    <form id="form-aturan" class="grid gap-4 sm:grid-cols-2" @submit.prevent="simpanAturan">
      <div class="sm:col-span-2">
        <p class="label">Berlaku untuk</p>
        <div class="grid grid-cols-3 gap-2">
          <label v-for="[v, l] in [['semua', 'Semua treatment'], ['kategori', 'Kategori'], ['treatment', 'Treatment']]" :key="v" class="choice" :class="{ 'choice-active': form.cakupan === v }">
            <input v-model="form.cakupan" type="radio" :value="v" class="sr-only" />{{ l }}
          </label>
        </div>
      </div>
      <div v-if="form.cakupan === 'kategori'" class="sm:col-span-2">
        <label class="label" for="ak-kategori">Kategori *</label>
        <select id="ak-kategori" v-model="form.kategori_id" class="input" :class="{ 'input-error': errors.kategori_id }" required>
          <option value="" disabled>Pilih kategori</option>
          <option v-for="k in kategoris" :key="k.id" :value="k.id">{{ k.nama }}</option>
        </select>
      </div>
      <div v-if="form.cakupan === 'treatment'" class="sm:col-span-2">
        <label class="label">Treatment *</label>
        <div v-if="form.tindakan" class="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2 text-sm">
          <span>{{ form.tindakan.nama }}</span>
          <button type="button" class="text-xs text-slate-400 hover:text-slate-700" @click="form.tindakan = null">ganti</button>
        </div>
        <AsyncSelect v-else endpoint="/tindakans" placeholder="Cari treatment..." @select="(t) => (form.tindakan = t)">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ rupiah(item.tarif) }}</span></template>
        </AsyncSelect>
        <p v-if="errors.tindakan_id" class="field-error">{{ errors.tindakan_id }}</p>
      </div>
      <div>
        <label class="label" for="ak-peran">Peran *</label>
        <select id="ak-peran" v-model="form.peran" class="input" :class="{ 'input-error': errors.peran }">
          <option v-for="(l, v) in PERAN" :key="v" :value="v">{{ l }}</option>
        </select>
        <p v-if="errors.peran" class="field-error">{{ errors.peran }}</p>
      </div>
      <div>
        <label class="label" for="ak-cabang">Cabang</label>
        <select id="ak-cabang" v-model="form.cabang_id" class="input">
          <option value="">Semua cabang</option>
          <option v-for="c in cabangs" :key="c.id" :value="c.id">{{ c.nama }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="ak-jenis">Jenis *</label>
        <select id="ak-jenis" v-model="form.jenis" class="input">
          <option value="persen">Persen dari nilai tindakan</option>
          <option value="nominal">Nominal per tindakan</option>
        </select>
      </div>
      <div>
        <label class="label" for="ak-nilai">{{ form.jenis === 'persen' ? 'Persen (%) *' : 'Nominal (Rp) *' }}</label>
        <input id="ak-nilai" v-model.number="form.nilai" type="number" min="0" step="any" :max="form.jenis === 'persen' ? 100 : undefined" class="input" :class="{ 'input-error': errors.nilai }" required />
        <p v-if="errors.nilai" class="field-error">{{ errors.nilai }}</p>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="ak-ket">Keterangan</label>
        <input id="ak-ket" v-model="form.keterangan" class="input" maxlength="255" />
      </div>
      <label class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif</label>
      <p class="text-xs text-slate-500 sm:col-span-2">
        Dasar persen mengikuti Pengaturan (default: setelah bagian diskon & promo tagihan; pajak tidak dihitung). Sesi paket memakai nilai per sesi paket.
      </p>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-aturan" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>

  <AppModal v-model="setujuiOpen" title="Setujui & Kunci Komisi">
    <div class="space-y-3 text-sm">
      <p>Total komisi {{ periode }}: <b class="tabular-nums">{{ rupiah(rekap?.total) }}</b> untuk {{ rekap?.petugas?.length ?? 0 }} petugas.</p>
      <p class="text-slate-600">Setelah disetujui, angka periode ini tidak berubah lagi. Refund atau koreksi berikutnya masuk ke periode terbuka berikutnya.</p>
      <div>
        <label class="label" for="catatan-setujui">Catatan</label>
        <input id="catatan-setujui" v-model="catatanSetujui" class="input" maxlength="255" placeholder="mis. Dibayar bersama gaji Oktober" />
      </div>
    </div>
    <template #footer>
      <button class="btn btn-secondary" @click="setujuiOpen = false">Batal</button>
      <button class="btn btn-primary" :disabled="aksi === 'setujui'" @click="setujui"><AppSpinner v-if="aksi === 'setujui'" />Setujui</button>
    </template>
  </AppModal>

  <AppModal v-model="slipOpen" title="Slip Komisi" size="max-w-3xl">
    <SlipKomisi v-if="slip" :data="slip" />
    <template #footer>
      <button class="btn btn-secondary" @click="slip = null">Tutup</button>
      <button class="btn btn-primary" @click="printElement('#slip-komisi', 'Slip Komisi')">Cetak</button>
    </template>
  </AppModal>
</template>
