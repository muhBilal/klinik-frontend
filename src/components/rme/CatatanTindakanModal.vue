<script setup>
/**
 * Catatan tindakan (PRD RM-05): petugas pelaksana, area & catatan, face chart injeksi (ES-01),
 * parameter laser / energy device (ES-02), dan pemakaian BHP aktual (IN-02).
 * Bentuk form mengikuti `jenis_catatan` treatment; terkunci setelah pemeriksaan ditutup.
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import FaceChart from '@/components/rme/FaceChart.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { JENIS_CATATAN, PARAMETER_ALAT, REAKSI_KULIT, angka, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  kunjunganTindakanId: { type: Number, default: null },
  /** Pemeriksaan masih terbuka (belum ditandatangani). */
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['saved'])
const auth = useAuthStore()
const toast = useToastStore()

const SATUAN_DOSIS = ['U', 'ml', 'mg', 'mcg']
const KEDALAMAN = ['Intradermal', 'Subdermal', 'Subkutan', 'Intramuskular', 'Supraperiosteal']
const ALAT_SUNTIK = ['Jarum 30G', 'Jarum 32G', 'Jarum 27G', 'Kanula 25G', 'Kanula 22G']
const AREA_INJEKSI = ['Frontalis (dahi)', 'Glabella', "Crow's feet kanan", "Crow's feet kiri", 'Bunny lines', 'Tear trough kanan', 'Tear trough kiri',
  'Malar / pipi kanan', 'Malar / pipi kiri', 'Nasolabial kanan', 'Nasolabial kiri', 'Bibir', 'Dagu (mentalis)', 'Masseter kanan', 'Masseter kiri', 'Platysma']

const info = ref(null)
const terkunci = ref(false)
const loading = ref(false)
const saving = ref(false)
const errors = ref({})
const tab = ref('catatan')
const terpilih = ref(-1)
const petugas = ref([])
const alats = ref([])
const batches = reactive({})
const form = reactive({ jenis: 'umum', petugas_id: '', area: '', catatan: '', sumber_daya_id: '', parameter: {}, titiks: [] })

const bhps = ref([])
const bhpLoading = ref(false)
const bhpSaving = ref(false)
const bhpErrors = ref({})

const bolehUbah = computed(() => props.editable && !terkunci.value && auth.can('rme.tindakan'))
const bolehBhp = computed(() => auth.can('inventori.kelola'))
const bhpTerkunci = computed(() => bhps.value.some((b) => b.stok_dipotong))
const bolehUbahBhp = computed(() => props.editable && !terkunci.value && !bhpTerkunci.value)

const TABS = computed(() => [
  ['catatan', 'Catatan'],
  ...(form.jenis === 'injeksi' ? [['face', `Face chart (${form.titiks.length})`]] : []),
  ...(form.jenis === 'energi' ? [['alat', 'Parameter alat']] : []),
  ...(bolehBhp.value ? [['bhp', 'Pemakaian BHP']] : []),
])

/** Total dosis per produk & satuan dari titik face chart (untuk dicocokkan dengan BHP). */
const totalProduk = computed(() => {
  const total = new Map()
  for (const t of form.titiks) {
    if (!t.obat_id || !t.jumlah) continue
    const key = `${t.obat_id}|${t.satuan ?? ''}`
    total.set(key, { nama: t.obat_nama, satuan: t.satuan, jumlah: (total.get(key)?.jumlah ?? 0) + Number(t.jumlah) })
  }
  return [...total.values()]
})

watch(open, (buka) => buka && props.kunjunganTindakanId && muat())
watch(() => form.jenis, (jenis) => jenis === 'energi' && muatAlat())

async function muat() {
  loading.value = true
  errors.value = {}
  tab.value = 'catatan'
  terpilih.value = -1
  try {
    const [{ data }, daftarPetugas] = await Promise.all([
      api.get(`/kunjungan-tindakans/${props.kunjunganTindakanId}/catatan`),
      cachedGet('/petugas').catch(() => []),
    ])
    info.value = data.kunjungan_tindakan
    terkunci.value = data.terkunci
    petugas.value = daftarPetugas
    const c = data.catatan
    Object.assign(form, {
      jenis: data.jenis,
      petugas_id: info.value.petugas_id ?? '',
      area: c?.area ?? '',
      catatan: c?.catatan ?? '',
      sumber_daya_id: c?.sumber_daya_id ?? '',
      parameter: {
        ...Object.fromEntries(PARAMETER_ALAT.map(([key]) => [key, ''])),
        pendingin: '',
        reaksi_kulit: '',
        endpoint_klinis: '',
        ...(c?.parameter ?? {}),
      },
      titiks: (c?.titiks ?? []).map((t) => ({ ...t, obat_nama: t.obat?.nama ?? null })),
    })
    for (const t of form.titiks) if (t.obat_id) muatBatch(t.obat_id)
    if (bolehBhp.value) muatBhp()
    // Buka langsung bagian khusus treatment (tombol di pemeriksaan berlabel "Face chart" / "Parameter alat").
    tab.value = data.jenis === 'injeksi' ? 'face' : data.jenis === 'energi' ? 'alat' : 'catatan'
  } catch (e) {
    toast.error(errorMessage(e))
    open.value = false
  } finally {
    loading.value = false
  }
}

async function muatAlat() {
  if (alats.value.length) return
  try {
    alats.value = (await cachedGet('/sumber-dayas', { tipe: 'alat', status: 'aktif', per_page: 100 })).data
  } catch {
    alats.value = [] // tanpa izin booking.lihat: alat tidak bisa dipilih, parameter tetap bisa diisi
  }
}

/** Batch tersedia per produk (FEFO) di cabang aktif; butuh izin inventori.kelola. */
async function muatBatch(obatId) {
  if (!batches[obatId]) {
    try {
      batches[obatId] = (await api.get('/stok-batches', { params: { obat_id: obatId, tersedia: 1, per_page: 50 }, silent: true })).data.data
    } catch {
      batches[obatId] = []
    }
  }
  return batches[obatId]
}

function tambahTitik({ x, y, area }) {
  // Titik baru mewarisi produk/batch/dosis titik sebelumnya: lazimnya satu produk untuk semua titik.
  const prev = form.titiks.at(-1)
  form.titiks.push({
    x, y, area, tampilan: 'depan',
    obat_id: prev?.obat_id ?? null, obat_nama: prev?.obat_nama ?? null, batch_id: prev?.batch_id ?? null,
    jumlah: prev?.jumlah ?? '', satuan: prev?.satuan ?? 'U', kedalaman: prev?.kedalaman ?? '', alat: prev?.alat ?? '', catatan: '',
  })
  terpilih.value = form.titiks.length - 1
}

/** Produk dipilih untuk satu titik juga diisikan ke titik lain yang belum berproduk; batch default = FEFO pertama. */
async function pilihObat(t, obat) {
  const titiks = [t, ...form.titiks.filter((x) => x !== t && !x.obat_id)]
  for (const x of titiks) {
    x.obat_id = obat.id
    x.obat_nama = obat.nama
    x.batch_id = null
    if (/ml|syringe/i.test(obat.satuan)) x.satuan = 'ml'
  }
  const daftar = await muatBatch(obat.id)
  if (daftar.length) for (const x of titiks) if (x.obat_id === obat.id && !x.batch_id) x.batch_id = daftar[0].id
}

function hapusTitik(i) {
  form.titiks.splice(i, 1)
  terpilih.value = -1
}

function payload() {
  const data = { jenis: form.jenis, area: form.area || null, catatan: form.catatan || null, petugas_id: form.petugas_id || null }
  if (form.jenis === 'energi') {
    data.sumber_daya_id = form.sumber_daya_id || null
    data.parameter = Object.fromEntries(Object.entries(form.parameter).filter(([, v]) => v !== '' && v !== null))
  }
  if (form.jenis === 'injeksi') {
    data.titiks = form.titiks.map((t) => ({
      tampilan: t.tampilan ?? 'depan', x: t.x, y: t.y, area: t.area || null, obat_id: t.obat_id || null, batch_id: t.batch_id || null,
      jumlah: t.jumlah === '' || t.jumlah === null ? null : Number(t.jumlah), satuan: t.satuan || null,
      kedalaman: t.kedalaman || null, alat: t.alat || null, catatan: t.catatan || null,
    }))
  }
  return data
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.put(`/kunjungan-tindakans/${props.kunjunganTindakanId}/catatan`, payload())
    toast.success('Catatan tindakan tersimpan.')
    emit('saved', { id: props.kunjunganTindakanId, catatan: data, petugas_id: form.petugas_id || null })
    open.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
    if (Object.keys(errors.value).some((k) => k.startsWith('titiks'))) tab.value = 'face'
    else if (Object.keys(errors.value).some((k) => k.startsWith('parameter') || k === 'sumber_daya_id')) tab.value = 'alat'
  } finally {
    saving.value = false
  }
}

// ---- Pemakaian BHP aktual (IN-02) ----
function isiBhp(rows) {
  bhps.value = rows.map((b) => ({
    obat_id: b.obat_id, nama: b.obat?.nama, kode: b.obat?.kode, satuan: b.obat?.satuan, fraksional: b.obat?.fraksional,
    jumlah_standar: b.jumlah_standar, jumlah: b.jumlah, stok_dipotong: b.stok_dipotong,
  }))
}

async function muatBhp() {
  bhpLoading.value = true
  try {
    isiBhp((await api.get(`/kunjungan-tindakans/${props.kunjunganTindakanId}/bhps`)).data)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    bhpLoading.value = false
  }
}

function tambahBhp(obat) {
  if (bhps.value.some((b) => b.obat_id === obat.id)) return toast.info('Bahan sudah ada di daftar.')
  bhps.value.push({ obat_id: obat.id, nama: obat.nama, kode: obat.kode, satuan: obat.satuan, fraksional: obat.fraksional, jumlah_standar: 0, jumlah: 1 })
}

async function simpanBhp() {
  bhpSaving.value = true
  bhpErrors.value = {}
  try {
    const { data } = await api.put(`/kunjungan-tindakans/${props.kunjunganTindakanId}/bhps`, {
      bhps: bhps.value.map(({ obat_id, jumlah }) => ({ obat_id, jumlah })),
    })
    isiBhp(data.bhps)
    toast.success('Pemakaian BHP tersimpan. Stok dipotong saat pemeriksaan ditutup.')
  } catch (e) {
    bhpErrors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    bhpSaving.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" :title="`Catatan Tindakan${info ? ` · ${info.tindakan?.nama}` : ''}`" size="max-w-5xl">
    <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500"><AppSpinner />Memuat catatan tindakan...</div>
    <template v-else-if="info">
      <p v-if="!bolehUbah" class="alert alert-warning mb-4">
        {{ terkunci || !editable ? 'Pemeriksaan sudah ditutup; catatan tindakan hanya dapat dibaca.' : 'Anda tidak memiliki izin mengisi catatan tindakan.' }}
      </p>

      <div class="tabs mb-5 w-fit">
        <button v-for="[key, label] in TABS" :key="key" type="button" :class="{ 'tab-active': tab === key }" class="tab" @click="tab = key">{{ label }}</button>
      </div>

      <form id="form-catatan" @submit.prevent="simpan">
        <!-- Catatan umum -->
        <div v-show="tab === 'catatan'" class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="ct-jenis">Bentuk catatan</label>
            <select id="ct-jenis" v-model="form.jenis" class="input" :disabled="!bolehUbah">
              <option v-for="(label, val) in JENIS_CATATAN" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="label" for="ct-petugas">Petugas pelaksana</label>
            <select id="ct-petugas" v-model="form.petugas_id" class="input" :class="{ 'input-error': errors.petugas_id }" :disabled="!bolehUbah">
              <option value="">— Belum ditentukan —</option>
              <option v-for="p in petugas" :key="p.id" :value="p.id">{{ p.name }} · {{ p.peran }}</option>
              <option v-if="info.petugas && !petugas.some((p) => p.id === info.petugas.id)" :value="info.petugas.id">{{ info.petugas.name }}</option>
            </select>
            <p v-if="errors.petugas_id" class="field-error">{{ errors.petugas_id }}</p>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="ct-area">Area tindakan</label>
            <input id="ct-area" v-model="form.area" class="input" maxlength="255" placeholder="Mis. seluruh wajah, dahi & glabella, punggung" :disabled="!bolehUbah" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="ct-catatan">Catatan pelaksanaan</label>
            <textarea id="ct-catatan" v-model="form.catatan" rows="4" class="input" maxlength="5000" placeholder="Langkah tindakan, respons pasien, instruksi pasca tindakan..." :disabled="!bolehUbah" />
          </div>
        </div>

        <!-- Face chart injeksi (ES-01) -->
        <div v-if="form.jenis === 'injeksi'" v-show="tab === 'face'" class="grid gap-5 lg:grid-cols-[18rem_1fr]">
          <div>
            <FaceChart v-model="form.titiks" v-model:terpilih="terpilih" :readonly="!bolehUbah" @tambah="tambahTitik" />
            <div v-if="totalProduk.length" class="mt-3 rounded-2xl border border-line bg-white/40 px-4 py-3 text-sm">
              <p class="text-xs font-semibold text-slate-500">Total per produk</p>
              <p v-for="p in totalProduk" :key="`${p.nama}${p.satuan}`" class="tabular-nums">{{ p.nama }}: <b>{{ angka(p.jumlah) }} {{ p.satuan }}</b></p>
              <p class="mt-1 text-xs text-slate-400">Sesuaikan pemakaian BHP (satuan stok) di tab Pemakaian BHP.</p>
            </div>
          </div>
          <div class="min-w-0 space-y-2">
            <datalist id="ct-area-injeksi"><option v-for="a in AREA_INJEKSI" :key="a" :value="a" /></datalist>
            <datalist id="ct-kedalaman"><option v-for="k in KEDALAMAN" :key="k" :value="k" /></datalist>
            <datalist id="ct-alat-suntik"><option v-for="a in ALAT_SUNTIK" :key="a" :value="a" /></datalist>
            <p v-if="!form.titiks.length" class="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-slate-400">Belum ada titik. Klik diagram wajah untuk menandai titik suntik.</p>
            <div
              v-for="(t, i) in form.titiks"
              :key="i"
              :class="terpilih === i ? 'border-rose-300 bg-rose-50/60' : 'border-line bg-white/40'"
              class="rounded-2xl border p-3"
              @click="terpilih = i"
            >
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <div class="col-span-2 flex items-center gap-2">
                  <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{{ i + 1 }}</span>
                  <input v-model="t.area" list="ct-area-injeksi" class="input py-1" placeholder="Area" maxlength="100" :disabled="!bolehUbah" :aria-label="`Area titik ${i + 1}`" />
                </div>
                <div class="col-span-2">
                  <AsyncSelect v-if="bolehUbah && !t.obat_id" endpoint="/obats" :params="{ aktif: 1 }" placeholder="Cari produk..." @select="(o) => pilihObat(t, o)">
                    <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.satuan }}</span></template>
                  </AsyncSelect>
                  <div v-else class="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-1.5 text-sm">
                    <span class="truncate">{{ t.obat_nama ?? 'Tanpa produk' }}</span>
                    <button v-if="bolehUbah" type="button" class="text-xs text-slate-400 hover:text-slate-700" @click="t.obat_id = null; t.batch_id = null">ganti</button>
                  </div>
                </div>
                <div class="col-span-2">
                  <select v-model="t.batch_id" class="input py-1" :class="{ 'input-error': errors[`titiks.${i}.batch_id`] }" :disabled="!bolehUbah || !t.obat_id" :aria-label="`Batch titik ${i + 1}`">
                    <option :value="null">— Batch —</option>
                    <option v-for="b in batches[t.obat_id] ?? []" :key="b.id" :value="b.id">{{ b.no_batch ?? 'tanpa nomor' }} · exp {{ tanggal(b.kedaluwarsa) }} · sisa {{ angka(b.jumlah) }}</option>
                    <option v-if="t.batch && !(batches[t.obat_id] ?? []).some((b) => b.id === t.batch_id)" :value="t.batch_id">{{ t.batch.no_batch ?? 'tanpa nomor' }}</option>
                  </select>
                  <p v-if="errors[`titiks.${i}.batch_id`]" class="field-error">{{ errors[`titiks.${i}.batch_id`] }}</p>
                </div>
                <div class="col-span-2 flex gap-1 sm:col-span-2">
                  <input v-model="t.jumlah" type="number" min="0" step="0.001" class="input py-1 text-right" placeholder="Dosis" :disabled="!bolehUbah" :aria-label="`Dosis titik ${i + 1}`" />
                  <select v-model="t.satuan" class="input w-20 py-1" :disabled="!bolehUbah" :aria-label="`Satuan titik ${i + 1}`">
                    <option v-for="s in SATUAN_DOSIS" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
                <input v-model="t.kedalaman" list="ct-kedalaman" class="input col-span-1 py-1 sm:col-span-2" placeholder="Kedalaman" maxlength="30" :disabled="!bolehUbah" :aria-label="`Kedalaman titik ${i + 1}`" />
                <div class="col-span-1 flex gap-1 sm:col-span-2">
                  <input v-model="t.alat" list="ct-alat-suntik" class="input py-1" placeholder="Jarum / kanula" maxlength="50" :disabled="!bolehUbah" :aria-label="`Jarum atau kanula titik ${i + 1}`" />
                  <button v-if="bolehUbah" type="button" class="btn-icon size-8 shrink-0 text-slate-400 hover:text-rose-600" :aria-label="`Hapus titik ${i + 1}`" @click.stop="hapusTitik(i)">&times;</button>
                </div>
              </div>
              <p v-for="field in ['x', 'y', 'jumlah', 'obat_id']" :key="field" v-show="errors[`titiks.${i}.${field}`]" class="field-error">{{ errors[`titiks.${i}.${field}`] }}</p>
            </div>
          </div>
        </div>

        <!-- Parameter laser / energy device (ES-02) -->
        <div v-if="form.jenis === 'energi'" v-show="tab === 'alat'" class="grid gap-4 sm:grid-cols-4">
          <div class="sm:col-span-2">
            <label class="label" for="ct-alat">Alat</label>
            <select id="ct-alat" v-model="form.sumber_daya_id" class="input" :class="{ 'input-error': errors.sumber_daya_id }" :disabled="!bolehUbah">
              <option value="">— Pilih alat —</option>
              <option v-for="a in alats" :key="a.id" :value="a.id">{{ a.nama }} ({{ a.kode }})</option>
            </select>
            <p v-if="errors.sumber_daya_id" class="field-error">{{ errors.sumber_daya_id }}</p>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="ct-pendingin">Pendingin</label>
            <input id="ct-pendingin" v-model="form.parameter.pendingin" class="input" maxlength="100" placeholder="Mis. contact cooling, cold air" :disabled="!bolehUbah" />
          </div>
          <div v-for="[key, label, unit, step] in PARAMETER_ALAT" :key="key">
            <label class="label" :for="`ct-${key}`">{{ label }}</label>
            <div class="relative">
              <input
                :id="`ct-${key}`"
                v-model="form.parameter[key]"
                type="number"
                min="0"
                :step="step"
                class="input pr-14"
                :class="{ 'input-error': errors[`parameter.${key}`] }"
                :disabled="!bolehUbah"
              />
              <span class="pointer-events-none absolute top-2 right-3 text-xs text-slate-400">{{ unit }}</span>
            </div>
            <p v-if="errors[`parameter.${key}`]" class="field-error">{{ errors[`parameter.${key}`] }}</p>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="ct-reaksi">Reaksi kulit</label>
            <select id="ct-reaksi" v-model="form.parameter.reaksi_kulit" class="input" :class="{ 'input-error': errors['parameter.reaksi_kulit'] }" :disabled="!bolehUbah">
              <option value="">— Pilih —</option>
              <option v-for="(label, val) in REAKSI_KULIT" :key="val" :value="val">{{ label }}</option>
            </select>
            <p v-if="errors['parameter.reaksi_kulit']" class="field-error">{{ errors['parameter.reaksi_kulit'] }}</p>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="ct-endpoint">Endpoint klinis</label>
            <input id="ct-endpoint" v-model="form.parameter.endpoint_klinis" class="input" maxlength="255" placeholder="Mis. eritema perifolikular" :disabled="!bolehUbah" />
          </div>
        </div>
      </form>

      <!-- Pemakaian BHP (IN-02) -->
      <div v-if="bolehBhp" v-show="tab === 'bhp'" class="space-y-3">
        <p class="text-xs text-slate-500">
          Draft dari BHP standar katalog; koreksi dengan pemakaian nyata (satuan stok, boleh desimal untuk bahan fraksional). Stok dipotong FEFO saat pemeriksaan ditutup.
        </p>
        <p v-if="bhpTerkunci" class="alert alert-warning">Stok sudah dipotong; selisih diselesaikan lewat stok opname.</p>
        <AsyncSelect v-if="bolehUbahBhp" endpoint="/obats" :params="{ aktif: 1 }" placeholder="Tambah bahan..." @select="tambahBhp">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.satuan }}</span></template>
        </AsyncSelect>
        <div v-if="bhpLoading" class="flex items-center gap-2 text-sm text-slate-500"><AppSpinner />Memuat BHP...</div>
        <div v-else class="overflow-x-auto rounded-xl border border-line bg-white/30">
          <table class="table">
            <thead><tr><th>Bahan</th><th class="text-right">Standar</th><th class="w-36">Pemakaian</th><th>Satuan</th><th class="w-8" /></tr></thead>
            <tbody>
              <tr v-for="(b, i) in bhps" :key="b.obat_id">
                <td>{{ b.nama }} <span class="text-xs text-slate-400">{{ b.kode }}</span></td>
                <td class="text-right tabular-nums text-slate-500">{{ angka(b.jumlah_standar) }}</td>
                <td>
                  <input v-model.number="b.jumlah" type="number" min="0" :step="b.fraksional ? 0.001 : 1" class="input py-1" :disabled="!bolehUbahBhp" :aria-label="`Pemakaian ${b.nama}`" />
                </td>
                <td class="text-slate-600">{{ b.satuan }}<span v-if="b.stok_dipotong" class="ml-1 text-xs text-emerald-600">· dipotong</span></td>
                <td><button v-if="bolehUbahBhp" type="button" class="text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${b.nama}`" @click="bhps.splice(i, 1)">&times;</button></td>
              </tr>
              <tr v-if="!bhps.length"><td colspan="5" class="py-4 text-center text-slate-400">Tidak ada BHP.</td></tr>
            </tbody>
          </table>
        </div>
        <p v-if="bhpErrors.bhps" class="field-error">{{ bhpErrors.bhps }}</p>
        <div v-if="bolehUbahBhp" class="flex justify-end">
          <button type="button" class="btn btn-secondary" :disabled="bhpSaving" @click="simpanBhp"><AppSpinner v-if="bhpSaving" />Simpan pemakaian BHP</button>
        </div>
      </div>
    </template>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">{{ bolehUbah ? 'Batal' : 'Tutup' }}</button>
      <button v-if="bolehUbah && tab !== 'bhp'" type="submit" form="form-catatan" class="btn btn-primary" :disabled="saving">
        <AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan catatan' }}
      </button>
    </template>
  </AppModal>
</template>
