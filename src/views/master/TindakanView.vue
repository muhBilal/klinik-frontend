<script setup>
/**
 * Katalog treatment (PRD TR-01): kategori, durasi + buffer, harga dasar, harga per cabang, BHP standar,
 * serta atribut RME: kode ICD-9-CM default, bentuk catatan tindakan, dan template informed consent wajib (RM-02/03/05).
 * Harga cabang: "dasar" = ikut harga dasar (tidak dikirim), "khusus" = tarif cabang, "tidak" = tidak dilayani di cabang itu.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import { useQueryAction } from '@/composables/useQueryAction'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { JENIS_CATATAN, OPSI_STATUS_AKTIF, angka, rupiah } from '@/lib/format'
import { referensiGigi } from '@/lib/gigi'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const { items, meta, loading, filters, load, reload, search, isFiltered, reset } = useList('/tindakans', { q: '', kategori_id: '', status: '' })

const kategoris = ref([])
const cabangs = ref([])
const templateConsents = ref([])
const protokolFotos = ref([])
const kondisiGigi = ref([])
const opsiKategori = computed(() => kategoris.value.map((k) => ({ value: k.id, label: `${k.nama}${k.is_active ? '' : ' (nonaktif)'}` })))

// Kategori & cabang dibutuhkan form; form bisa dibuka sebelum mount selesai (?baru=1), jadi ditunggu di buka().
let referensi = null
function muatReferensi() {
  referensi ??= Promise.all([
    cachedGet('/kategori-tindakans'), cachedGet('/cabangs'), cachedGet('/template-consents', { aktif: 1 }), cachedGet('/protokol-fotos', { aktif: 1 }),
    referensiGigi(),
  ])
    .then(([k, c, t, p, g]) => {
      kategoris.value = k
      cabangs.value = c
      templateConsents.value = t
      protokolFotos.value = p
      kondisiGigi.value = g.daftar
    })
    .catch((e) => {
      referensi = null
      toast.error(errorMessage(e))
    })
  return referensi
}

const MODE_HARGA = [
  ['dasar', 'Harga dasar'],
  ['khusus', 'Harga khusus'],
  ['tidak', 'Tidak dilayani'],
]

const durasi = (t) => `${t.durasi_menit} mnt${t.buffer_menit ? ` + ${t.buffer_menit}` : ''}`

// Form
const formOpen = ref(false)
const editing = ref(null)
const detailLoading = ref(null)
const form = reactive({})
const errors = ref({})
const saving = ref(false)

/** Baris harga yang dikirim (bukan "harga dasar"); indeksnya dipakai untuk pesan error `hargas.N.*`. */
const hargaDikirim = computed(() => (form.hargas ?? []).filter((h) => h.mode !== 'dasar'))
const errorHarga = (h, field) => errors.value[`hargas.${hargaDikirim.value.indexOf(h)}.${field}`]
const totalMenit = computed(() => (Number(form.durasi_menit) || 0) + (Number(form.buffer_menit) || 0))

/** Grid harga = semua cabang yang bisa dipilih + cabang yang sudah punya harga khusus (mis. cabang nonaktif). */
function gridHarga(detail) {
  const tersimpan = new Map((detail?.hargas ?? []).map((h) => [h.cabang_id, h]))
  const daftar = new Map(cabangs.value.map((c) => [c.id, c]))
  for (const h of detail?.hargas ?? []) if (!daftar.has(h.cabang_id)) daftar.set(h.cabang_id, h.cabang)

  return [...daftar.values()].map((c) => {
    const h = tersimpan.get(c.id)
    return {
      cabang_id: c.id,
      nama: c.nama,
      kode: c.kode,
      nonaktif: c.is_active === false,
      mode: !h ? 'dasar' : h.tersedia ? 'khusus' : 'tidak',
      tarif: h?.tarif ?? detail?.tarif ?? 0,
    }
  })
}

async function buka(row = null) {
  errors.value = {}
  let detail = null
  if (row) detailLoading.value = row.id
  try {
    ;[detail] = await Promise.all([row ? api.get(`/tindakans/${row.id}`).then((r) => r.data) : null, muatReferensi()])
  } catch (e) {
    return toast.error(errorMessage(e))
  } finally {
    detailLoading.value = null
  }
  editing.value = row
  Object.assign(form, {
    kode: detail?.kode ?? '',
    nama: detail?.nama ?? '',
    // Treatment baru mengikuti filter kategori yang sedang dipilih
    kategori_id: detail ? (detail.kategori_id ?? '') : filters.kategori_id || '',
    durasi_menit: detail?.durasi_menit ?? 30,
    buffer_menit: detail?.buffer_menit ?? 0,
    tarif: detail?.tarif ?? 0,
    is_active: detail?.is_active ?? true,
    icd9cm: detail?.icd9cm ?? null,
    jenis_catatan: detail?.jenis_catatan ?? 'umum',
    template_consent_id: detail?.template_consent_id ?? '',
    template_consent: detail?.template_consent ?? null,
    protokol_foto_id: detail?.protokol_foto_id ?? '',
    protokol_foto: detail?.protokol_foto ?? null,
    per_gigi: detail?.per_gigi ?? false,
    kondisi_gigi_hasil: detail?.kondisi_gigi_hasil ?? '',
    hargas: gridHarga(detail),
    bhps: (detail?.bhps ?? []).map((b) => ({ obat_id: b.obat_id, kode: b.obat.kode, nama: b.obat.nama, satuan: b.obat.satuan, jumlah: b.jumlah })),
  })
  formOpen.value = true
}

function tambahBhp(obat) {
  if (form.bhps.some((b) => b.obat_id === obat.id)) return toast.info('Bahan sudah ada di daftar BHP.')
  form.bhps.push({ obat_id: obat.id, kode: obat.kode, nama: obat.nama, satuan: obat.satuan, jumlah: 1 })
}

function payload() {
  return {
    kode: form.kode,
    nama: form.nama,
    kategori_id: form.kategori_id || null,
    durasi_menit: form.durasi_menit,
    buffer_menit: form.buffer_menit === '' ? null : form.buffer_menit,
    tarif: form.tarif,
    is_active: form.is_active,
    icd9cm_id: form.icd9cm?.id ?? null,
    jenis_catatan: form.jenis_catatan,
    template_consent_id: form.template_consent_id || null,
    protokol_foto_id: form.protokol_foto_id || null,
    per_gigi: form.per_gigi || !!form.kondisi_gigi_hasil,
    kondisi_gigi_hasil: form.kondisi_gigi_hasil || null,
    hargas: hargaDikirim.value.map((h) => ({ cabang_id: h.cabang_id, tarif: h.mode === 'khusus' ? h.tarif : form.tarif, tersedia: h.mode === 'khusus' })),
    bhps: form.bhps.map(({ obat_id, jumlah }) => ({ obat_id, jumlah })),
  }
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    if (editing.value) await api.put(`/tindakans/${editing.value.id}`, payload())
    else await api.post('/tindakans', payload())
    toast.success('Treatment tersimpan.')
    formOpen.value = false
    editing.value ? reload() : load(1)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

const deleting = ref(null)

async function hapus(row) {
  if (!confirm(`Hapus treatment "${row.nama}"?`)) return
  deleting.value = row.id
  try {
    await api.delete(`/tindakans/${row.id}`)
    toast.success('Treatment dihapus.')
    reload()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = null
  }
}

// Aksi "Treatment baru" dari pencarian global (?baru=1)
useQueryAction('baru', () => buka())

onMounted(() => {
  load()
  muatReferensi()
})
</script>

<template>
  <PageHeader title="Katalog Treatment" subtitle="Treatment & tindakan: kategori, durasi, harga per cabang, dan BHP standar">
    <RouterLink to="/master/kategori-treatment" class="btn btn-secondary">Kategori</RouterLink>
    <button class="btn btn-primary" @click="buka()">+ Treatment Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="filter-bar">
        <input v-model="filters.q" type="search" class="input w-72 max-w-full py-1.5" placeholder="Cari kode atau nama treatment..." @input="search" />
        <FilterSelect v-model="filters.kategori_id" placeholder="Semua kategori" :options="opsiKategori" @change="load()" />
        <FilterSelect v-model="filters.status" placeholder="Semua status" :options="OPSI_STATUS_AKTIF" @change="load()" />
        <button v-if="isFiltered" class="btn btn-ghost btn-sm" @click="reset()">Reset filter</button>
      </div>
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Treatment</th>
            <th>Durasi</th>
            <th class="text-right">Harga dasar</th>
            <th v-if="auth.cabang" class="text-right">{{ auth.cabang.nama }}</th>
            <th>Harga cabang</th>
            <th class="text-right">BHP</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="auth.cabang ? 9 : 8" />
          <tr v-for="t in items" :key="t.id">
            <td class="tabular-nums text-xs">{{ t.kode }}</td>
            <td>
              <p class="font-medium">{{ t.nama }}</p>
              <p class="text-xs text-slate-500">
                {{ t.kategori?.nama ?? 'Tanpa kategori' }}<template v-if="t.icd9cm"> · ICD-9-CM {{ t.icd9cm.kode }}</template>
                <span v-if="t.template_consent_id" class="text-amber-700"> · wajib consent</span>
                <template v-if="t.per_gigi"> · per gigi<template v-if="t.kondisi_gigi_hasil"> → {{ t.kondisi_gigi_hasil }}</template></template>
              </p>
            </td>
            <td class="whitespace-nowrap tabular-nums text-slate-600" title="Durasi tindakan + buffer sterilisasi/persiapan">{{ durasi(t) }}</td>
            <td class="text-right tabular-nums">{{ rupiah(t.tarif) }}</td>
            <td v-if="auth.cabang" class="text-right tabular-nums">
              <span v-if="!t.tersedia" class="text-xs text-slate-400">tidak dilayani</span>
              <span v-else :class="{ 'font-semibold': t.tarif_cabang !== t.tarif }">{{ rupiah(t.tarif_cabang) }}</span>
            </td>
            <td class="text-slate-600">{{ t.hargas_count ? `${t.hargas_count} cabang khusus` : '-' }}</td>
            <td class="text-right tabular-nums text-slate-600">{{ t.bhps_count ? `${t.bhps_count} bahan` : '-' }}</td>
            <td><StatusBadge :status="t.is_active ? 'aktif' : 'nonaktif'" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" :disabled="detailLoading === t.id" @click="buka(t)">
                <AppSpinner v-if="detailLoading === t.id" size="size-3" />Ubah
              </button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === t.id" @click="hapus(t)">
                <AppSpinner v-if="deleting === t.id" size="size-3" />Hapus
              </button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td :colspan="auth.cabang ? 9 : 8" class="py-10 text-center text-slate-400">Belum ada treatment.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <AppModal v-model="formOpen" :title="editing ? 'Ubah Treatment' : 'Treatment Baru'" size="max-w-3xl">
    <form id="form-tindakan" class="space-y-6" @submit.prevent="simpan">
      <!-- Informasi utama -->
      <div class="grid gap-4 sm:grid-cols-4">
        <div>
          <label class="label">Kode *</label>
          <input v-model="form.kode" class="input" :class="{ 'input-error': errors.kode }" placeholder="TRT-001" required />
          <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
        </div>
        <div class="sm:col-span-3">
          <label class="label">Nama treatment *</label>
          <input v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" required />
          <p v-if="errors.nama" class="field-error">{{ errors.nama }}</p>
        </div>
        <div class="sm:col-span-2">
          <label class="label">Kategori</label>
          <select v-model="form.kategori_id" class="input" :class="{ 'input-error': errors.kategori_id }">
            <option value="">— Tanpa kategori —</option>
            <option v-for="k in opsiKategori" :key="k.value" :value="k.value">{{ k.label }}</option>
          </select>
          <p v-if="errors.kategori_id" class="field-error">{{ errors.kategori_id }}</p>
        </div>
        <div class="sm:col-span-2">
          <label class="label">Harga dasar (Rp) *</label>
          <input v-model.number="form.tarif" type="number" min="0" class="input" :class="{ 'input-error': errors.tarif }" required />
          <p v-if="errors.tarif" class="field-error">{{ errors.tarif }}</p>
        </div>
        <div>
          <label class="label">Durasi (menit) *</label>
          <input v-model.number="form.durasi_menit" type="number" min="1" max="720" class="input" :class="{ 'input-error': errors.durasi_menit }" required />
          <p v-if="errors.durasi_menit" class="field-error">{{ errors.durasi_menit }}</p>
        </div>
        <div>
          <label class="label">Buffer (menit)</label>
          <input v-model.number="form.buffer_menit" type="number" min="0" max="240" class="input" :class="{ 'input-error': errors.buffer_menit }" />
          <p v-if="errors.buffer_menit" class="field-error">{{ errors.buffer_menit }}</p>
        </div>
        <p class="self-end pb-2 text-xs text-slate-500 sm:col-span-2">
          Slot booking: <b class="text-slate-700">{{ totalMenit }} menit</b> (tindakan + sterilisasi/persiapan)
        </p>
        <label class="flex items-center gap-2 text-sm sm:col-span-4">
          <input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif (dapat dipilih di pemeriksaan)
        </label>
      </div>

      <!-- Rekam medis: kode tindakan, bentuk catatan, informed consent (RM-02/03/05) -->
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-800">Rekam medis</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label">Kode ICD-9-CM default</label>
            <div v-if="form.icd9cm" class="flex items-center justify-between gap-2 rounded-2xl bg-white/60 px-3 py-2 text-sm">
              <span><b class="tabular-nums">{{ form.icd9cm.kode }}</b> {{ form.icd9cm.nama }}</span>
              <button type="button" class="text-xs text-slate-400 hover:text-slate-700" @click="form.icd9cm = null">ganti</button>
            </div>
            <AsyncSelect v-else endpoint="/icd9cms" placeholder="Cari kode / nama tindakan ICD-9-CM..." @select="(icd) => (form.icd9cm = icd)">
              <template #default="{ item }"><b class="tabular-nums">{{ item.kode }}</b> {{ item.nama }}</template>
            </AsyncSelect>
            <p v-if="errors.icd9cm_id" class="field-error">{{ errors.icd9cm_id }}</p>
            <p v-else class="mt-1 text-xs text-slate-400">Disalin ke tindakan kunjungan (bisa diubah dokter); dipakai laporan & SATUSEHAT (Procedure).</p>
          </div>
          <div>
            <label class="label" for="t-jenis-catatan">Bentuk catatan tindakan</label>
            <select id="t-jenis-catatan" v-model="form.jenis_catatan" class="input">
              <option v-for="(label, val) in JENIS_CATATAN" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="label" for="t-consent">Informed consent</label>
            <select id="t-consent" v-model="form.template_consent_id" class="input" :class="{ 'input-error': errors.template_consent_id }">
              <option value="">— Tidak wajib consent —</option>
              <option v-for="c in templateConsents" :key="c.id" :value="c.id">Wajib: {{ c.nama }}</option>
              <option v-if="form.template_consent && !templateConsents.some((c) => c.id === form.template_consent.id)" :value="form.template_consent.id">
                Wajib: {{ form.template_consent.nama }} (nonaktif)
              </option>
            </select>
            <p v-if="errors.template_consent_id" class="field-error">{{ errors.template_consent_id }}</p>
            <p v-else class="mt-1 text-xs text-slate-400">Wajib = pemeriksaan tidak bisa ditutup sebelum pasien menandatangani consent.</p>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="t-protokol">Protokol foto klinis</label>
            <select id="t-protokol" v-model="form.protokol_foto_id" class="input" :class="{ 'input-error': errors.protokol_foto_id }">
              <option value="">— Tanpa protokol (pilih saat memotret) —</option>
              <option v-for="p in protokolFotos" :key="p.id" :value="p.id">{{ p.nama }} ({{ p.posisi.length }} posisi)</option>
              <option v-if="form.protokol_foto && !protokolFotos.some((p) => p.id === form.protokol_foto.id)" :value="form.protokol_foto.id">{{ form.protokol_foto.nama }} (nonaktif)</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Dipakai otomatis saat mengambil foto before-after treatment ini.</p>
          </div>
          <!-- Kedokteran gigi (DG-01/07) -->
          <div class="flex items-start pt-6">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.per_gigi" type="checkbox" class="accent-brand-600" :disabled="!!form.kondisi_gigi_hasil" />
              Tindakan per gigi (wajib nomor gigi, ditagih per gigi)
            </label>
          </div>
          <div>
            <label class="label" for="t-kondisi-gigi">Kondisi gigi setelah tindakan</label>
            <select id="t-kondisi-gigi" v-model="form.kondisi_gigi_hasil" class="input" :class="{ 'input-error': errors.kondisi_gigi_hasil }">
              <option value="">— Tidak mengubah odontogram —</option>
              <option v-for="k in kondisiGigi" :key="k.kode" :value="k.kode">{{ k.kode }} · {{ k.label }}{{ k.cakupan === 'permukaan' ? ' (per permukaan)' : '' }}</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Mis. tambal komposit → <b>cof</b>, cabut → <b>mis</b>. Odontogram diperbarui otomatis saat tindakan dicatat.</p>
          </div>
        </div>
      </section>

      <!-- Harga per cabang -->
      <section>
        <h3 class="text-sm font-semibold text-slate-800">Harga per cabang</h3>
        <p class="mb-2 text-xs text-slate-500">Cabang tanpa harga khusus memakai harga dasar {{ rupiah(form.tarif) }}.</p>
        <div class="overflow-x-auto rounded-xl border border-line bg-white/30">
          <table class="table">
            <thead><tr><th>Cabang</th><th class="w-44">Harga</th><th class="w-44 text-right">Tarif (Rp)</th></tr></thead>
            <tbody>
              <tr v-for="h in form.hargas" :key="h.cabang_id">
                <td>
                  {{ h.nama }} <span class="text-xs text-slate-400">{{ h.kode }}{{ h.nonaktif ? ' · nonaktif' : '' }}</span>
                  <p v-if="errorHarga(h, 'cabang_id')" class="field-error">{{ errorHarga(h, 'cabang_id') }}</p>
                </td>
                <td>
                  <select v-model="h.mode" class="input py-1" :aria-label="`Harga ${h.nama}`">
                    <option v-for="[val, label] in MODE_HARGA" :key="val" :value="val">{{ label }}</option>
                  </select>
                </td>
                <td class="text-right">
                  <input
                    v-if="h.mode === 'khusus'"
                    v-model.number="h.tarif"
                    type="number"
                    min="0"
                    class="input py-1 text-right"
                    :class="{ 'input-error': errorHarga(h, 'tarif') }"
                    required
                  />
                  <span v-else-if="h.mode === 'dasar'" class="tabular-nums text-slate-500">{{ rupiah(form.tarif) }}</span>
                  <span v-else class="text-xs text-slate-400">tidak tampil di pemeriksaan</span>
                  <p v-if="errorHarga(h, 'tarif')" class="field-error">{{ errorHarga(h, 'tarif') }}</p>
                </td>
              </tr>
              <tr v-if="!form.hargas?.length"><td colspan="3" class="py-4 text-center text-slate-400">Belum ada cabang.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- BHP standar -->
      <section class="space-y-2">
        <div>
          <h3 class="text-sm font-semibold text-slate-800">Bahan habis pakai (BHP) standar</h3>
          <p class="text-xs text-slate-500">Pemakaian per satu kali treatment, dalam satuan stok (boleh desimal, mis. 0,3 vial).</p>
        </div>
        <AsyncSelect endpoint="/obats" :params="{ aktif: 1 }" placeholder="Cari bahan / obat..." @select="tambahBhp">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.satuan }} · stok {{ angka(item.stok) }}</span></template>
        </AsyncSelect>
        <p v-if="errors.bhps" class="field-error">{{ errors.bhps }}</p>
        <div v-if="form.bhps?.length" class="overflow-x-auto rounded-xl border border-line bg-white/30">
          <table class="table">
            <thead><tr><th>Bahan</th><th class="w-36">Jumlah</th><th>Satuan</th><th class="w-8" /></tr></thead>
            <tbody>
              <tr v-for="(b, i) in form.bhps" :key="b.obat_id">
                <td>
                  {{ b.nama }} <span class="text-xs text-slate-400">{{ b.kode }}</span>
                  <p v-if="errors[`bhps.${i}.obat_id`]" class="field-error">{{ errors[`bhps.${i}.obat_id`] }}</p>
                </td>
                <td>
                  <input v-model.number="b.jumlah" type="number" min="0.001" step="0.001" class="input py-1" :class="{ 'input-error': errors[`bhps.${i}.jumlah`] }" required />
                  <p v-if="errors[`bhps.${i}.jumlah`]" class="field-error">{{ errors[`bhps.${i}.jumlah`] }}</p>
                </td>
                <td class="text-slate-600">{{ b.satuan }}</td>
                <td><button type="button" class="text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${b.nama}`" @click="form.bhps.splice(i, 1)">&times;</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-tindakan" class="btn btn-primary" :disabled="saving">
        <AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}
      </button>
    </template>
  </AppModal>
</template>
