<script setup>
/**
 * Stok per batch & kedaluwarsa di cabang aktif (PRD IN-01, IN-03, IN-05): penerimaan barang per batch, stok opname per batch,
 * mutasi antar cabang, buang batch kedaluwarsa, dan daftar yang akan kedaluwarsa. Pengeluaran tetap FEFO otomatis di backend.
 * `?obat_id=` membuka daftar batch satu obat (dari halaman Obat & Stok).
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import { useQueryAction } from '@/composables/useQueryAction'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { angka, hariIni, tambahHari, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'tersedia', label: 'Stok tersedia' },
  { value: 'kedaluwarsa', label: 'Akan kedaluwarsa' },
  { value: 'habis', label: 'Batch kosong' },
]
const tab = ref('tersedia')
const hariAlert = ref(60)

const { items, meta, loading, filters, load, search } = useList('/stok-batches', {
  q: '',
  obat_id: route.query.obat_id ?? '',
  tersedia: 1,
  habis: '',
  per_page: 50,
})
const kedaluwarsa = ref([])
const kedaluwarsaLoading = ref(false)

async function muatKedaluwarsa() {
  kedaluwarsaLoading.value = true
  try {
    kedaluwarsa.value = (await api.get('/stok-batches/kedaluwarsa', { params: { hari: hariAlert.value } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    kedaluwarsaLoading.value = false
  }
}

function pilihTab(t) {
  tab.value = t
  if (t === 'kedaluwarsa') return muatKedaluwarsa()
  Object.assign(filters, { tersedia: t === 'tersedia' ? 1 : '', habis: t === 'habis' ? 1 : '' })
  load(1)
}

function muatUlang() {
  tab.value === 'kedaluwarsa' ? muatKedaluwarsa() : load()
}

const baris = computed(() => (tab.value === 'kedaluwarsa' ? kedaluwarsa.value : items.value))
const sedangMemuat = computed(() => (tab.value === 'kedaluwarsa' ? kedaluwarsaLoading.value : loading.value))
const obatTerfilter = computed(() => (filters.obat_id ? items.value[0]?.obat : null))

function hapusFilterObat() {
  filters.obat_id = ''
  router.replace({ query: {} })
  load(1)
}

/** Status kedaluwarsa batch: lewat / ≤ 30 hari / ≤ 90 hari. */
function statusKedaluwarsa(b) {
  if (!b.kedaluwarsa) return { label: 'tanpa tanggal', kelas: 'text-slate-400' }
  const hari = Math.round((new Date(`${b.kedaluwarsa}T00:00:00`) - new Date(`${hariIni()}T00:00:00`)) / 86_400_000)
  if (hari < 0) return { label: `lewat ${-hari} hari`, kelas: 'text-rose-600 font-semibold', lewat: true }
  if (hari <= 30) return { label: `${hari} hari lagi`, kelas: 'text-rose-600' }
  if (hari <= 90) return { label: `${hari} hari lagi`, kelas: 'text-amber-700' }
  return { label: '', kelas: 'text-slate-600' }
}
const vialLewat = (b) => b.kedaluwarsa_dibuka_at && new Date(b.kedaluwarsa_dibuka_at) < new Date()

// ---------- Terima barang ----------
const terimaOpen = ref(false)
const terima = reactive({ obat: null, jumlah: '', no_batch: '', kedaluwarsa: '', keterangan: '' })
const errors = ref({})
const saving = ref(false)

function bukaTerima(obat = null) {
  errors.value = {}
  Object.assign(terima, { obat, jumlah: '', no_batch: '', kedaluwarsa: tambahHari(hariIni(), 365), keterangan: '' })
  terimaOpen.value = true
}

async function simpanTerima() {
  if (!terima.obat) return toast.error('Pilih obat / bahan terlebih dahulu.')
  saving.value = true
  errors.value = {}
  try {
    await api.post('/stok-batches', {
      obat_id: terima.obat.id,
      jumlah: terima.jumlah,
      no_batch: terima.no_batch || null,
      kedaluwarsa: terima.kedaluwarsa || null,
      keterangan: terima.keterangan || null,
    })
    toast.success(`Penerimaan ${angka(terima.jumlah)} ${terima.obat.satuan} ${terima.obat.nama} tercatat.`)
    terimaOpen.value = false
    muatUlang()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

// ---------- Opname / mutasi / buang ----------
const aksi = ref(null) // { jenis: 'opname'|'mutasi', batch }
const aksiForm = reactive({ jumlah: '', cabang_tujuan_id: '', keterangan: '' })
const cabangs = ref([])
const cabangTujuan = computed(() => cabangs.value.filter((c) => c.is_active && c.id !== aksi.value?.batch?.cabang_id))
const aksiOpen = computed({ get: () => !!aksi.value, set: (v) => !v && (aksi.value = null) })
const selisihOpname = computed(() => (aksiForm.jumlah === '' || !aksi.value ? null : Number(aksiForm.jumlah) - Number(aksi.value.batch.jumlah)))

async function bukaAksi(jenis, batch) {
  errors.value = {}
  Object.assign(aksiForm, { jumlah: jenis === 'opname' ? batch.jumlah : '', cabang_tujuan_id: '', keterangan: '' })
  if (jenis === 'mutasi' && !cabangs.value.length) cabangs.value = await cachedGet('/cabangs').catch(() => [])
  aksi.value = { jenis, batch }
}

async function simpanAksi() {
  const { jenis, batch } = aksi.value
  saving.value = true
  errors.value = {}
  try {
    if (jenis === 'opname') {
      await api.post(`/stok-batches/${batch.id}/sesuaikan`, { jumlah: aksiForm.jumlah, keterangan: aksiForm.keterangan || 'Stok opname' })
      toast.success('Hasil opname tersimpan di kartu stok.')
    } else {
      await api.post(`/stok-batches/${batch.id}/mutasi`, { cabang_tujuan_id: aksiForm.cabang_tujuan_id, jumlah: aksiForm.jumlah, keterangan: aksiForm.keterangan || null })
      toast.success('Mutasi antar cabang tercatat.')
    }
    aksi.value = null
    muatUlang()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

const membuang = ref(null)
async function buang(b) {
  if (!confirm(`Buang sisa ${angka(b.jumlah)} ${b.obat.satuan} ${b.obat.nama} batch ${b.no_batch ?? '(tanpa nomor)'}? Tercatat sebagai pengeluaran di kartu stok.`)) return
  membuang.value = b.id
  try {
    await api.post(`/stok-batches/${b.id}/buang`, { keterangan: 'Dibuang: kedaluwarsa' })
    toast.success('Batch dibuang.')
    muatUlang()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    membuang.value = null
  }
}

useQueryAction('terima', () => bukaTerima())

onMounted(() => load())
</script>

<template>
  <PageHeader title="Stok Batch & Kedaluwarsa" :subtitle="`Stok per batch${auth.cabang ? ` di ${auth.cabang.nama}` : ' semua cabang'}. Pengeluaran otomatis memakai batch yang paling cepat kedaluwarsa (FEFO).`">
    <RouterLink to="/farmasi/obat" class="btn btn-secondary">Obat & Stok</RouterLink>
    <button class="btn btn-primary" @click="bukaTerima()">+ Terima barang</button>
  </PageHeader>

  <p v-if="!auth.cabang && auth.lintasCabang" class="alert alert-warning mb-4">Menampilkan semua cabang. Pilih cabang di header untuk menerima barang ke cabang tertentu.</p>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="tabs">
        <button v-for="t in TABS" :key="t.value" class="tab" :class="{ 'tab-active': tab === t.value }" @click="pilihTab(t.value)">{{ t.label }}</button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <template v-if="tab === 'kedaluwarsa'">
          <label class="text-sm text-slate-600" for="hari-alert">dalam</label>
          <select id="hari-alert" v-model.number="hariAlert" class="input w-auto py-1.5" @change="muatKedaluwarsa">
            <option v-for="h in [30, 60, 90, 180]" :key="h" :value="h">{{ h }} hari</option>
          </select>
        </template>
        <input v-else v-model="filters.q" type="search" class="input w-64 max-w-full py-1.5" placeholder="Cari obat / no. batch..." @input="search" />
        <AppSpinner v-if="sedangMemuat" class="text-slate-400" />
      </div>
    </div>
    <div v-if="filters.obat_id && tab !== 'kedaluwarsa'" class="flex items-center gap-2 border-b border-line px-5 py-2 text-sm">
      Hanya batch <b>{{ obatTerfilter?.nama ?? `obat #${filters.obat_id}` }}</b>
      <button class="btn btn-ghost btn-sm" @click="hapusFilterObat">Tampilkan semua</button>
      <button v-if="obatTerfilter" class="btn btn-secondary btn-sm ml-auto" @click="bukaTerima(obatTerfilter)">+ Terima {{ obatTerfilter.nama }}</button>
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': sedangMemuat && baris.length }">
      <table class="table">
        <thead>
          <tr>
            <th>Obat / bahan</th>
            <th>No. batch</th>
            <th>Kedaluwarsa</th>
            <th class="text-right">Sisa</th>
            <th v-if="tab !== 'kedaluwarsa'" class="text-right">Awal</th>
            <th v-if="!auth.cabang">Cabang</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="sedangMemuat && !baris.length" :cols="7" />
          <tr v-for="b in baris" :key="b.id">
            <td>
              <p class="font-medium">{{ b.obat?.nama }}</p>
              <p class="text-xs text-slate-500">{{ b.obat?.kode }}<template v-if="b.obat?.fraksional"> · fraksional</template></p>
            </td>
            <td class="tabular-nums">{{ b.no_batch ?? '—' }}</td>
            <td class="whitespace-nowrap">
              <p>{{ b.kedaluwarsa ? tanggal(b.kedaluwarsa) : '-' }}</p>
              <p class="text-xs" :class="statusKedaluwarsa(b).kelas">{{ statusKedaluwarsa(b).label }}</p>
              <p v-if="b.dibuka_at" class="text-xs" :class="vialLewat(b) ? 'text-rose-600' : 'text-slate-500'">
                dibuka {{ waktu(b.dibuka_at) }}<template v-if="b.kedaluwarsa_dibuka_at">, pakai s.d. {{ waktu(b.kedaluwarsa_dibuka_at) }}</template>
              </p>
            </td>
            <td class="text-right tabular-nums font-medium">{{ angka(b.jumlah) }} <span class="text-xs font-normal text-slate-500">{{ b.obat?.satuan }}</span></td>
            <td v-if="tab !== 'kedaluwarsa'" class="text-right tabular-nums text-slate-500">{{ angka(b.jumlah_awal) }}</td>
            <td v-if="!auth.cabang" class="text-slate-600">{{ b.cabang?.nama ?? '-' }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="bukaAksi('opname', b)">Opname</button>
              <button v-if="b.jumlah > 0 && !statusKedaluwarsa(b).lewat" class="btn btn-ghost btn-sm" @click="bukaAksi('mutasi', b)">Mutasi</button>
              <button v-if="b.jumlah > 0 && (statusKedaluwarsa(b).lewat || vialLewat(b))" class="btn btn-ghost btn-sm text-rose-600" :disabled="membuang === b.id" @click="buang(b)">
                <AppSpinner v-if="membuang === b.id" size="size-3" />Buang
              </button>
            </td>
          </tr>
          <tr v-if="!sedangMemuat && !baris.length">
            <td colspan="7" class="py-10 text-center text-slate-400">{{ tab === 'kedaluwarsa' ? `Tidak ada batch yang kedaluwarsa dalam ${hariAlert} hari.` : 'Tidak ada batch.' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination v-if="tab !== 'kedaluwarsa'" :meta="meta" @change="load" />
  </div>

  <!-- Terima barang -->
  <AppModal v-model="terimaOpen" title="Terima Barang">
    <form id="form-terima" class="grid gap-4 sm:grid-cols-2" @submit.prevent="simpanTerima">
      <div class="sm:col-span-2">
        <label class="label">Obat / bahan *</label>
        <div v-if="terima.obat" class="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2 text-sm">
          <span>{{ terima.obat.nama }} <span class="text-xs text-slate-500">· {{ terima.obat.satuan }}</span></span>
          <button type="button" class="text-xs text-slate-400 hover:text-slate-700" @click="terima.obat = null">ganti</button>
        </div>
        <AsyncSelect v-else endpoint="/obats" :params="{ aktif: 1 }" placeholder="Cari obat / bahan..." @select="(o) => (terima.obat = o)">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.satuan }} · stok {{ angka(item.stok) }}</span></template>
        </AsyncSelect>
        <p v-if="errors.obat_id" class="field-error">{{ errors.obat_id }}</p>
      </div>
      <div>
        <label class="label" for="t-jumlah">Jumlah *</label>
        <input id="t-jumlah" v-model.number="terima.jumlah" type="number" step="any" min="0" class="input" :class="{ 'input-error': errors.jumlah }" required />
        <p v-if="errors.jumlah" class="field-error">{{ errors.jumlah }}</p>
      </div>
      <div>
        <label class="label" for="t-batch">No. batch</label>
        <input id="t-batch" v-model="terima.no_batch" class="input" maxlength="50" placeholder="Tertera di kemasan" />
      </div>
      <div>
        <label class="label" for="t-ed">Tanggal kedaluwarsa</label>
        <input id="t-ed" v-model="terima.kedaluwarsa" type="date" class="input" :class="{ 'input-error': errors.kedaluwarsa }" :min="tambahHari(hariIni(), 1)" />
        <p v-if="errors.kedaluwarsa" class="field-error">{{ errors.kedaluwarsa }}</p>
      </div>
      <div>
        <label class="label" for="t-ket">Keterangan</label>
        <input id="t-ket" v-model="terima.keterangan" class="input" maxlength="255" placeholder="mis. Faktur PBF no. 123" />
      </div>
      <p class="text-xs text-slate-500 sm:col-span-2">Batch dengan nomor & kedaluwarsa yang sama di cabang ini akan ditambah, bukan diduplikasi.</p>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="terimaOpen = false">Batal</button>
      <button type="submit" form="form-terima" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>

  <!-- Opname / mutasi -->
  <AppModal v-model="aksiOpen" :title="aksi?.jenis === 'opname' ? 'Stok Opname Batch' : 'Mutasi ke Cabang Lain'">
    <form v-if="aksi" id="form-aksi-batch" class="space-y-3" @submit.prevent="simpanAksi">
      <p class="text-sm text-slate-600">
        {{ aksi.batch.obat?.nama }} · batch {{ aksi.batch.no_batch ?? '(tanpa nomor)' }} · sisa tercatat <b class="tabular-nums">{{ angka(aksi.batch.jumlah) }} {{ aksi.batch.obat?.satuan }}</b>
      </p>
      <div v-if="aksi.jenis === 'mutasi'">
        <label class="label" for="a-cabang">Cabang tujuan *</label>
        <select id="a-cabang" v-model="aksiForm.cabang_tujuan_id" class="input" :class="{ 'input-error': errors.cabang_tujuan_id }" required>
          <option value="" disabled>Pilih cabang</option>
          <option v-for="c in cabangTujuan" :key="c.id" :value="c.id">{{ c.nama }}</option>
        </select>
        <p v-if="errors.cabang_tujuan_id" class="field-error">{{ errors.cabang_tujuan_id }}</p>
      </div>
      <div>
        <label class="label" for="a-jumlah">{{ aksi.jenis === 'opname' ? 'Jumlah fisik hasil hitung *' : 'Jumlah dipindahkan *' }}</label>
        <input id="a-jumlah" v-model="aksiForm.jumlah" type="number" step="any" min="0" class="input text-lg" :class="{ 'input-error': errors.jumlah }" required />
        <p v-if="errors.jumlah" class="field-error">{{ errors.jumlah }}</p>
        <p v-else-if="aksi.jenis === 'opname' && selisihOpname" class="mt-1 text-sm" :class="selisihOpname < 0 ? 'text-rose-600' : 'text-amber-700'">
          Selisih {{ selisihOpname > 0 ? '+' : '' }}{{ angka(selisihOpname) }} {{ aksi.batch.obat?.satuan }}
        </p>
      </div>
      <div>
        <label class="label" for="a-ket">Keterangan</label>
        <input id="a-ket" v-model="aksiForm.keterangan" class="input" maxlength="200" :placeholder="aksi.jenis === 'opname' ? 'mis. Opname bulanan, vial pecah' : 'mis. Permintaan cabang'" />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="aksi = null">Batal</button>
      <button type="submit" form="form-aksi-batch" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>
</template>
