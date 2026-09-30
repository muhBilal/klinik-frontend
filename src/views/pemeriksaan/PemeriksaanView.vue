<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import LampiranBerkas from '@/components/LampiranBerkas.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import RekamMedisRingkas from '@/components/RekamMedisRingkas.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { PENJAMIN, jenisKelamin, rupiah, tanggal } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const kunjungan = ref(null)
const loadError = ref('')
const riwayat = ref([])
const riwayatLoading = ref(true)
const errors = ref({})
const saving = ref(false)
const calling = ref(false)
const finishing = ref(false)

const VITAL = [
  { key: 'tekanan_darah', label: 'Tekanan darah', unit: 'mmHg', placeholder: '120/80', type: 'text' },
  { key: 'nadi', label: 'Nadi', unit: 'x/mnt', type: 'number' },
  { key: 'suhu', label: 'Suhu', unit: '°C', type: 'number', step: '0.1' },
  { key: 'respirasi', label: 'Respirasi', unit: 'x/mnt', type: 'number' },
  { key: 'berat_badan', label: 'Berat badan', unit: 'kg', type: 'number', step: '0.1' },
  { key: 'tinggi_badan', label: 'Tinggi badan', unit: 'cm', type: 'number', step: '0.1' },
]
const SOAP = [
  { key: 'subjektif', label: 'S — Subjektif (anamnesis)', placeholder: 'Keluhan utama, riwayat penyakit sekarang...' },
  { key: 'objektif', label: 'O — Objektif (pemeriksaan fisik)', placeholder: 'Keadaan umum, hasil pemeriksaan fisik...' },
  { key: 'asesmen', label: 'A — Asesmen', placeholder: 'Kesimpulan klinis...' },
  { key: 'plan', label: 'P — Plan', placeholder: 'Rencana terapi, edukasi, kontrol...' },
]
const ATURAN_PAKAI = ['3 x 1 sesudah makan', '2 x 1 sesudah makan', '1 x 1 sesudah makan', '3 x 1 sebelum makan', '1 x 1 malam hari', 'Bila perlu (demam/nyeri)', 'Oleskan 2 x sehari']

const form = reactive({
  ...Object.fromEntries([...VITAL, ...SOAP].map((f) => [f.key, ''])),
  diagnosas: [],
  tindakans: [],
  resep: [],
  catatan_resep: '',
})

// Tanpa izin pemeriksaan.dokter (perawat, terapis): hanya tanda vital + anamnesis (S), sama dengan backend.
const isDokter = computed(() => auth.can('pemeriksaan.dokter'))
const isPerawat = computed(() => !isDokter.value)
const editable = computed(() => ['menunggu', 'diperiksa'].includes(kunjungan.value?.status))
const imt = computed(() => {
  const bb = Number(form.berat_badan)
  const tb = Number(form.tinggi_badan) / 100
  return bb && tb ? (bb / (tb * tb)).toFixed(1) : null
})
const totalEstimasi = computed(
  () =>
    (kunjungan.value?.poli.tarif_konsultasi ?? 0) +
    form.tindakans.reduce((s, t) => s + t.tarif * t.jumlah, 0) +
    form.resep.reduce((s, r) => s + r.harga * r.jumlah, 0),
)

function isiForm(k) {
  kunjungan.value = k
  const p = k.pemeriksaan ?? {}
  for (const f of [...VITAL, ...SOAP]) form[f.key] = p[f.key] ?? ''
  if (!form.subjektif && k.keluhan) form.subjektif = k.keluhan
  form.diagnosas = (p.diagnosas ?? []).map((d) => ({ icd10_id: d.icd10_id, jenis: d.jenis, kode: d.icd10.kode, nama: d.icd10.nama }))
  form.tindakans = k.tindakans.map((t) => ({ tindakan_id: t.tindakan_id, jumlah: t.jumlah, nama: t.tindakan.nama, tarif: t.tarif }))
  form.resep = (k.resep?.items ?? []).map((r) => ({
    obat_id: r.obat_id, jumlah: r.jumlah, aturan_pakai: r.aturan_pakai, nama: r.obat.nama, satuan: r.obat.satuan, harga: r.harga, stok: r.obat.stok,
  }))
  form.catatan_resep = k.resep?.catatan ?? ''
}

function tambahDiagnosa(icd) {
  if (form.diagnosas.some((d) => d.icd10_id === icd.id)) return toast.info('Diagnosa sudah ditambahkan.')
  form.diagnosas.push({ icd10_id: icd.id, kode: icd.kode, nama: icd.nama, jenis: form.diagnosas.length ? 'sekunder' : 'primer' })
}

function jadikanPrimer(index) {
  form.diagnosas.forEach((d, i) => (d.jenis = i === index ? 'primer' : 'sekunder'))
}

// Tarif estimasi = harga cabang kunjungan (tarif_cabang); nilai final di-snapshot backend saat disimpan.
function tambahTindakan(t) {
  const ada = form.tindakans.find((x) => x.tindakan_id === t.id)
  if (ada) ada.jumlah++
  else form.tindakans.push({ tindakan_id: t.id, nama: t.nama, tarif: t.tarif_cabang, jumlah: 1 })
}

function tambahObat(o) {
  if (form.resep.some((r) => r.obat_id === o.id)) return toast.info('Obat sudah ada di resep.')
  if (o.stok <= 0) toast.info(`Perhatian: stok ${o.nama} kosong.`)
  form.resep.push({ obat_id: o.id, nama: o.nama, satuan: o.satuan, harga: o.harga, stok: o.stok, jumlah: 10, aturan_pakai: ATURAN_PAKAI[0] })
}

function payload() {
  const data = Object.fromEntries([...VITAL, ...SOAP].map((f) => [f.key, form[f.key] === '' ? null : form[f.key]]))
  if (isPerawat.value) return data

  return {
    ...data,
    diagnosas: form.diagnosas.map(({ icd10_id, jenis }) => ({ icd10_id, jenis })),
    tindakans: form.tindakans.map(({ tindakan_id, jumlah }) => ({ tindakan_id, jumlah })),
    resep: form.resep.map(({ obat_id, jumlah, aturan_pakai }) => ({ obat_id, jumlah, aturan_pakai })),
    catatan_resep: form.catatan_resep || null,
  }
}

async function simpan({ silent = false } = {}) {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.put(`/kunjungans/${route.params.id}/pemeriksaan`, payload())
    isiForm(data)
    if (!silent) toast.success('Data pemeriksaan tersimpan.')
    return true
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
    return false
  } finally {
    saving.value = false
  }
}

async function panggil() {
  calling.value = true
  try {
    const { data } = await api.post(`/kunjungans/${route.params.id}/panggil`)
    isiForm(data)
    toast.success('Pasien dipanggil ke ruang periksa.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    calling.value = false
  }
}

async function selesai() {
  if (!form.diagnosas.length) return toast.error('Tambahkan minimal satu diagnosa ICD-10.')
  if (!confirm('Selesaikan pemeriksaan? Data tidak dapat diubah lagi dan tagihan akan diterbitkan.')) return
  finishing.value = true
  try {
    if (!(await simpan({ silent: true }))) return
    await api.post(`/kunjungans/${route.params.id}/selesai`)
    toast.success('Pemeriksaan selesai. Pasien diarahkan ke kasir.')
    router.push('/antrian')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    finishing.value = false
  }
}

// Riwayat dimuat terpisah agar form pemeriksaan bisa langsung tampil dan diisi.
async function loadRiwayat(k) {
  riwayatLoading.value = true
  try {
    riwayat.value = (await api.get(`/pasiens/${k.pasien_id}/riwayat`, { params: { kecuali: k.id } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    riwayatLoading.value = false
  }
}

async function load() {
  loadError.value = ''
  try {
    const { data } = await api.get(`/kunjungans/${route.params.id}`)
    isiForm(data)
    loadRiwayat(data)
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}

onMounted(load)
</script>

<template>
  <template v-if="kunjungan">
    <PageHeader :title="`Pemeriksaan · ${kunjungan.poli.nama}`" :subtitle="`${kunjungan.no_registrasi} · Antrian ${kunjungan.no_antrian} · ${tanggal(kunjungan.tanggal)}`">
      <RouterLink to="/antrian" class="btn btn-secondary">Kembali ke antrian</RouterLink>
      <template v-if="editable">
        <button v-if="kunjungan.status === 'menunggu'" class="btn btn-secondary" :disabled="calling" @click="panggil">
          <AppSpinner v-if="calling" />Panggil pasien
        </button>
        <button class="btn btn-secondary" :disabled="saving || finishing" @click="simpan()">
          <AppSpinner v-if="saving && !finishing" />{{ saving && !finishing ? 'Menyimpan...' : 'Simpan' }}
        </button>
        <button v-if="isDokter && kunjungan.status === 'diperiksa'" class="btn btn-primary" :disabled="saving || finishing" @click="selesai">
          <AppSpinner v-if="finishing" />{{ finishing ? 'Memproses...' : 'Selesai pemeriksaan' }}
        </button>
      </template>
    </PageHeader>

    <!-- Identitas pasien -->
    <div class="card mb-5 flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4 text-sm">
      <div>
        <p class="text-base font-semibold">{{ kunjungan.pasien.nama }}</p>
        <p class="text-slate-500">RM {{ kunjungan.pasien.no_rm }} · {{ jenisKelamin(kunjungan.pasien.jenis_kelamin) }} · {{ kunjungan.pasien.umur }}</p>
      </div>
      <div><p class="text-xs text-slate-500">Penjamin</p><p class="font-medium">{{ PENJAMIN[kunjungan.penjamin] }} {{ kunjungan.no_penjamin ?? '' }}</p></div>
      <div><p class="text-xs text-slate-500">Gol. darah</p><p class="font-medium">{{ kunjungan.pasien.golongan_darah ?? '-' }}</p></div>
      <div><p class="text-xs text-slate-500">Status</p><StatusBadge :status="kunjungan.status" /></div>
      <div v-if="kunjungan.pasien.alergi" class="rounded-xl bg-rose-500/10 px-3 py-2 font-semibold text-rose-700 ring-1 ring-rose-400/30">⚠ Alergi: {{ kunjungan.pasien.alergi }}</div>
    </div>

    <div v-if="!editable" class="alert alert-warning mb-5">
      Pemeriksaan sudah ditutup. Data ditampilkan dalam mode baca.
    </div>

    <div class="grid gap-5 xl:grid-cols-3">
      <div class="space-y-5 xl:col-span-2">
        <!-- Tanda vital -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Tanda Vital</h2>
            <span v-if="imt" class="text-xs text-slate-500">IMT: <b>{{ imt }}</b></span>
          </div>
          <div class="card-body grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div v-for="f in VITAL" :key="f.key">
              <label class="label">{{ f.label }}</label>
              <div class="relative">
                <input
                  v-model="form[f.key]"
                  :type="f.type"
                  :step="f.step"
                  :placeholder="f.placeholder"
                  :disabled="!editable"
                  class="input pr-14"
                  :class="{ 'input-error': errors[f.key] }"
                />
                <span class="pointer-events-none absolute top-2 right-3 text-xs text-slate-400">{{ f.unit }}</span>
              </div>
              <p v-if="errors[f.key]" class="field-error">{{ errors[f.key] }}</p>
            </div>
          </div>
        </section>

        <!-- SOAP -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Catatan SOAP</h2>
            <span v-if="isPerawat" class="text-xs text-slate-400">Anda mengisi anamnesis (S); O/A/P diisi dokter</span>
          </div>
          <div class="card-body grid gap-4 sm:grid-cols-2">
            <div v-for="f in SOAP" :key="f.key">
              <label class="label">{{ f.label }}</label>
              <textarea
                v-model="form[f.key]"
                rows="3"
                class="input"
                :placeholder="f.placeholder"
                :disabled="!editable || (isPerawat && f.key !== 'subjektif')"
              />
            </div>
          </div>
        </section>

        <template v-if="!isPerawat">
          <!-- Diagnosa -->
          <section class="card">
            <div class="card-header"><h2 class="card-title">Diagnosa (ICD-10)</h2></div>
            <div class="card-body space-y-3">
              <AsyncSelect v-if="editable" endpoint="/icd10s" placeholder="Cari kode atau nama penyakit..." @select="tambahDiagnosa">
                <template #default="{ item }"><span class="tabular-nums font-semibold">{{ item.kode }}</span> {{ item.nama }}</template>
              </AsyncSelect>
              <p v-if="errors.diagnosas" class="field-error">{{ errors.diagnosas }}</p>
              <ul class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white/30">
                <li v-for="(d, i) in form.diagnosas" :key="d.icd10_id" class="flex items-center gap-3 px-3 py-2 text-sm">
                  <span class="w-16 tabular-nums font-semibold">{{ d.kode }}</span>
                  <span class="flex-1">{{ d.nama }}</span>
                  <button
                    type="button"
                    :class="d.jenis === 'primer' ? 'bg-brand-900 text-white shadow-sm' : 'bg-slate-900/5 text-slate-500 hover:bg-slate-900/10'"
                    class="rounded-full px-2 py-0.5 text-xs font-semibold transition"
                    :disabled="!editable"
                    @click="jadikanPrimer(i)"
                  >
                    {{ d.jenis }}
                  </button>
                  <button v-if="editable" type="button" class="text-slate-400 hover:text-rose-600" @click="form.diagnosas.splice(i, 1)">&times;</button>
                </li>
                <li v-if="!form.diagnosas.length" class="px-3 py-3 text-sm text-slate-400">Belum ada diagnosa.</li>
              </ul>
            </div>
          </section>

          <!-- Tindakan -->
          <section class="card">
            <div class="card-header"><h2 class="card-title">Tindakan</h2></div>
            <div class="card-body space-y-3">
              <AsyncSelect v-if="editable" endpoint="/tindakans" :params="{ aktif: 1, cabang_id: kunjungan.cabang_id }" placeholder="Cari tindakan / treatment..." @select="tambahTindakan">
                <template #default="{ item }">
                  {{ item.nama }}
                  <span class="text-xs text-slate-500">· {{ rupiah(item.tarif_cabang) }} · {{ item.durasi_menit }} mnt<template v-if="item.kategori"> · {{ item.kategori.nama }}</template></span>
                </template>
              </AsyncSelect>
              <div v-if="form.tindakans.length" class="overflow-x-auto rounded-xl border border-line bg-white/30">
                <table class="table">
                  <thead><tr><th>Tindakan</th><th class="w-24">Jumlah</th><th class="text-right">Tarif</th><th class="w-8" /></tr></thead>
                  <tbody>
                    <tr v-for="(t, i) in form.tindakans" :key="t.tindakan_id">
                      <td>{{ t.nama }}</td>
                      <td><input v-model.number="t.jumlah" type="number" min="1" class="input py-1" :disabled="!editable" /></td>
                      <td class="text-right tabular-nums">{{ rupiah(t.tarif * t.jumlah) }}</td>
                      <td><button v-if="editable" type="button" class="text-slate-400 hover:text-rose-600" @click="form.tindakans.splice(i, 1)">&times;</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- Resep -->
          <section class="card">
            <div class="card-header">
              <h2 class="card-title">Resep Obat</h2>
              <StatusBadge v-if="kunjungan.resep" :status="kunjungan.resep.status" />
            </div>
            <div class="card-body space-y-3">
              <AsyncSelect v-if="editable" endpoint="/obats" :params="{ aktif: 1 }" placeholder="Cari nama obat..." @select="tambahObat">
                <template #default="{ item }">
                  <div class="flex justify-between gap-3">
                    <span>{{ item.nama }}</span>
                    <span :class="item.stok <= item.stok_minimum ? 'text-rose-600' : 'text-slate-500'" class="text-xs whitespace-nowrap">stok {{ item.stok }} {{ item.satuan }}</span>
                  </div>
                </template>
              </AsyncSelect>
              <datalist id="aturan-pakai"><option v-for="a in ATURAN_PAKAI" :key="a" :value="a" /></datalist>
              <div v-if="form.resep.length" class="overflow-x-auto rounded-xl border border-line bg-white/30">
                <table class="table">
                  <thead><tr><th>Obat</th><th class="w-24">Jumlah</th><th>Aturan pakai</th><th class="w-8" /></tr></thead>
                  <tbody>
                    <tr v-for="(r, i) in form.resep" :key="r.obat_id">
                      <td>
                        <p>{{ r.nama }}</p>
                        <p :class="r.jumlah > r.stok ? 'text-rose-600' : 'text-slate-400'" class="text-xs">stok {{ r.stok }} {{ r.satuan }}</p>
                      </td>
                      <td><input v-model.number="r.jumlah" type="number" min="1" class="input py-1" :disabled="!editable" /></td>
                      <td><input v-model="r.aturan_pakai" list="aturan-pakai" class="input py-1" :disabled="!editable" /></td>
                      <td><button v-if="editable" type="button" class="text-slate-400 hover:text-rose-600" @click="form.resep.splice(i, 1)">&times;</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <textarea v-if="form.resep.length" v-model="form.catatan_resep" rows="2" class="input" placeholder="Catatan untuk apoteker (opsional)" :disabled="!editable" />
            </div>
          </section>
        </template>
      </div>

      <!-- Kolom kanan -->
      <aside class="space-y-5">
        <div v-if="!isPerawat" class="card card-body">
          <p class="text-xs font-medium text-slate-500">Estimasi biaya</p>
          <p class="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{{ rupiah(totalEstimasi) }}</p>
          <p class="mt-1 text-xs text-slate-400">Konsultasi {{ rupiah(kunjungan.poli.tarif_konsultasi) }} + tindakan + obat</p>
        </div>

        <LampiranBerkas :pasien-id="kunjungan.pasien_id" :kunjungan-id="kunjungan.id" :readonly="kunjungan.status === 'batal'" />

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Riwayat Kunjungan</h2>
            <AppSpinner v-if="riwayatLoading" class="text-slate-400" />
          </div>
          <div v-if="riwayatLoading && !riwayat.length" class="divide-y divide-line" aria-busy="true">
            <div v-for="i in 3" :key="i" class="space-y-2 px-5 py-3">
              <div class="h-3.5 w-1/2 animate-pulse rounded bg-slate-200/70" />
              <div class="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div v-else-if="riwayat.length" class="max-h-[640px] divide-y divide-line overflow-y-auto">
            <details v-for="r in riwayat" :key="r.id" class="group px-5 py-3">
              <summary class="cursor-pointer list-none text-sm">
                <span class="font-medium">{{ tanggal(r.tanggal) }}</span>
                <span class="text-slate-500"> · {{ r.poli.nama }}<template v-if="r.cabang"> · {{ r.cabang.nama }}</template></span>
                <p class="truncate text-xs text-slate-500">{{ r.pemeriksaan?.diagnosas?.map((d) => d.icd10.kode + ' ' + d.icd10.nama).join(', ') || '-' }}</p>
              </summary>
              <div class="mt-3"><RekamMedisRingkas :kunjungan="r" /></div>
            </details>
          </div>
          <p v-else class="card-body text-sm text-slate-400">Belum ada riwayat kunjungan sebelumnya.</p>
        </div>
      </aside>
    </div>
  </template>
  <PageLoading v-else :error="loadError" text="Memuat data pemeriksaan..." @retry="load" />
</template>
