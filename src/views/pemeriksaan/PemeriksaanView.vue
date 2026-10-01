<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import LampiranBerkas from '@/components/LampiranBerkas.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import RekamMedisRingkas from '@/components/RekamMedisRingkas.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AddendumModal from '@/components/rme/AddendumModal.vue'
import CatatanTindakanModal from '@/components/rme/CatatanTindakanModal.vue'
import ConsentFormModal from '@/components/rme/ConsentFormModal.vue'
import ConsentLihatModal from '@/components/rme/ConsentLihatModal.vue'
import TemplateSoapModal from '@/components/rme/TemplateSoapModal.vue'
import FotoKlinisCard from '@/components/foto/FotoKlinisCard.vue'
import OdontogramCard from '@/components/gigi/OdontogramCard.vue'
import PilihGigi from '@/components/gigi/PilihGigi.vue'
import RencanaPerawatanCard from '@/components/gigi/RencanaPerawatanCard.vue'
import PaketPasienCard from '@/components/paket/PaketPasienCard.vue'
import DataKlinisModal from '@/components/klinis/DataKlinisModal.vue'
import PeringatanKlinis from '@/components/klinis/PeringatanKlinis.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { BAGIAN_ADDENDUM, PENJAMIN, jenisKelamin, rupiah, tanggal, waktu } from '@/lib/format'
import { formatGigi, normalPermukaan, referensiGigi } from '@/lib/gigi'
import { alergiObat } from '@/lib/klinis'
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
const consentKurang = ref([])
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
  akses_terbatas: false,
  diagnosas: [],
  tindakans: [],
  resep: [],
  catatan_resep: '',
})

// Tanpa izin pemeriksaan.dokter (perawat, terapis): hanya tanda vital + anamnesis (S), sama dengan backend.
const isDokter = computed(() => auth.can('pemeriksaan.dokter'))
const isPerawat = computed(() => !isDokter.value)
const bolehTindakan = computed(() => auth.can('rme.tindakan'))
const editable = computed(() => ['menunggu', 'diperiksa'].includes(kunjungan.value?.status))
// Data klinis pasien (PS-03): diubah oleh tenaga yang melakukan anamnesis; tidak terkunci bersama RME kunjungan
const bolehUbahKlinis = computed(() => auth.can('pemeriksaan.vital', 'pemeriksaan.dokter', 'rme.tindakan'))
const klinisOpen = ref(false)
function klinisTersimpan({ klinis, alergis }) {
  kunjungan.value.pasien.klinis = klinis
  kunjungan.value.pasien.alergis = alergis
}
const alergiResep = (r) => alergiObat({ id: r.obat_id, nama: r.nama }, kunjungan.value?.pasien.alergis)
const ditandatangani = computed(() => !!kunjungan.value?.pemeriksaan?.ditandatangani_at)
/** Dokter yang tercatat (bukan admin) tanpa SIP aktif tidak bisa menutup pemeriksaan — backend menolak dengan 422 `sip`. */
const sipBermasalah = computed(() => isDokter.value && !auth.user?.sip_aktif)
const imt = computed(() => {
  const bb = Number(form.berat_badan)
  const tb = Number(form.tinggi_badan) / 100
  return bb && tb ? (bb / (tb * tb)).toFixed(1) : null
})
// Jasa konsultasi poli (treatment) ditagih otomatis, kecuali dokter mencatatnya sebagai tindakan (tidak dobel).
const konsultasi = computed(() => {
  const k = kunjungan.value?.konsultasi
  return k && !form.tindakans.some((t) => t.tindakan_id === k.id) ? k : null
})
// Tindakan yang memakai sesi paket ditagih Rp 0 (TR-02).
const totalEstimasi = computed(
  () =>
    (konsultasi.value?.tarif_cabang ?? 0) +
    form.tindakans.reduce((s, t) => s + (t.paket_pasien_item_id ? 0 : t.tarif * t.jumlah), 0) +
    form.resep.reduce((s, r) => s + r.harga * r.jumlah, 0),
)

function isiForm(k) {
  kunjungan.value = k
  const p = k.pemeriksaan ?? {}
  for (const f of [...VITAL, ...SOAP]) form[f.key] = p[f.key] ?? ''
  if (!form.subjektif && k.keluhan) form.subjektif = k.keluhan
  form.akses_terbatas = !!k.akses_terbatas
  form.diagnosas = (p.diagnosas ?? []).map((d) => ({ icd10_id: d.icd10_id, jenis: d.jenis, kode: d.icd10.kode, nama: d.icd10.nama, sensitif: d.icd10.sensitif }))
  form.tindakans = (k.tindakans ?? []).map((t) => ({
    _key: `t${t.id}`,
    id: t.id,
    tindakan_id: t.tindakan_id,
    jumlah: t.jumlah,
    nama: t.tindakan.nama,
    tarif: t.tarif,
    petugas_id: t.petugas_id ?? '',
    petugas_nama: t.petugas?.name,
    asisten_id: t.asisten_id ?? '',
    asisten_nama: t.asisten?.name,
    icd9cm_id: t.icd9cm_id,
    icd9cm: t.icd9cm,
    template_consent_id: t.tindakan.template_consent_id,
    jenis_catatan: t.tindakan.jenis_catatan,
    protokol_foto_id: t.tindakan.protokol_foto_id,
    per_gigi: t.tindakan.per_gigi,
    kondisi_gigi_hasil: t.tindakan.kondisi_gigi_hasil,
    gigi: t.gigi,
    permukaan: t.permukaan ?? '',
    rencana_item_id: t.rencana_item_id,
    paket_pasien_item_id: t.paket_pasien_item_id ?? null,
    paket_no: t.paket_item?.paket_pasien?.no_paket,
    // Sesi yang sudah dipesan baris tersimpan ini (backend menghitungnya "sedang dipakai") — dikembalikan saat menghitung tersedia.
    paket_awal: t.paket_pasien_item_id ? { id: t.paket_pasien_item_id, jumlah: t.jumlah } : null,
    catatan: t.catatan,
  }))
  form.resep = (k.resep?.items ?? []).map((r) => ({
    obat_id: r.obat_id, jumlah: r.jumlah, aturan_pakai: r.aturan_pakai, nama: r.obat.nama, satuan: r.obat.satuan, harga: r.harga, stok: r.obat.stok,
  }))
  form.catatan_resep = k.resep?.catatan ?? ''
}

// ---- Diagnosa & favorit (RM-02) ----
const favorits = ref([])

async function muatFavorit() {
  if (!isDokter.value) return
  try {
    favorits.value = (await api.get('/icd10s', { params: { favorit: 1, per_page: 50, simple: 1 }, silent: true })).data.data
  } catch {
    favorits.value = []
  }
}

const isFavorit = (icd10Id) => favorits.value.some((f) => f.id === icd10Id)

async function toggleFavorit(d) {
  const id = d.icd10_id ?? d.id
  const hapus = isFavorit(id)
  try {
    if (hapus) await api.delete('/kode-favorits', { data: { jenis: 'icd10', kode_id: id } })
    else await api.post('/kode-favorits', { jenis: 'icd10', kode_id: id })
    favorits.value = hapus ? favorits.value.filter((f) => f.id !== id) : [...favorits.value, { id, kode: d.kode, nama: d.nama, sensitif: d.sensitif }]
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function tambahDiagnosa(icd) {
  if (form.diagnosas.some((d) => d.icd10_id === icd.id)) return toast.info('Diagnosa sudah ditambahkan.')
  form.diagnosas.push({ icd10_id: icd.id, kode: icd.kode, nama: icd.nama, sensitif: icd.sensitif, jenis: form.diagnosas.length ? 'sekunder' : 'primer' })
  if (icd.sensitif && !form.akses_terbatas) {
    form.akses_terbatas = true
    toast.info('Diagnosa sensitif: kunjungan ditandai berakses terbatas.')
  }
}

function jadikanPrimer(index) {
  form.diagnosas.forEach((d, i) => (d.jenis = i === index ? 'primer' : 'sekunder'))
}

const adaDiagnosaSensitif = computed(() => form.diagnosas.some((d) => d.sensitif))

// ---- Template SOAP (RM-01) ----
const templateOpen = ref(false)

function terapkanTemplate({ template, mode }) {
  for (const { key } of SOAP) {
    const isi = template[key]
    if (!isi) continue
    if (mode === 'timpa' || !String(form[key] ?? '').trim()) form[key] = isi
    else if (mode === 'tambah') form[key] = `${form[key]}\n${isi}`
  }
  for (const d of template.diagnosas ?? []) tambahDiagnosaDiam(d)
  if (template.akses_terbatas) form.akses_terbatas = true
  toast.success('Template diterapkan. Periksa isinya lalu simpan.')
}

async function salinSoap() {
  const teks = [
    `S: ${form.subjektif || '-'}`,
    `O: ${form.objektif || '-'}`,
    `A: ${form.asesmen || '-'}`,
    `P: ${form.plan || '-'}`,
  ].join('\n\n')
  try {
    await navigator.clipboard.writeText(teks)
    toast.success('Catatan SOAP disalin ke clipboard.')
  } catch {
    toast.error('Gagal menyalin teks.')
  }
}

function tambahDiagnosaDiam(icd) {
  if (form.diagnosas.some((d) => d.icd10_id === icd.id)) return
  form.diagnosas.push({ icd10_id: icd.id, kode: icd.kode, nama: icd.nama, sensitif: icd.sensitif, jenis: form.diagnosas.length ? 'sekunder' : 'primer' })
  if (icd.sensitif) form.akses_terbatas = true
}

// ---- Tindakan: ICD-9-CM, petugas, catatan & consent (RM-02/03/05) ----
const petugas = ref([])
const icd9Edit = ref(null)

let urutBaru = 0

// Tarif estimasi = harga cabang kunjungan (tarif_cabang); nilai final di-snapshot backend saat disimpan.
// Tindakan per gigi selalu baris baru (satu baris = satu gigi, ditagih per gigi — DG-07).
function tambahTindakan(t, tambahan = {}) {
  const target = t.per_gigi && !tambahan.rencana_item_id ? gigiTarget.value : null
  const gigi = tambahan.gigi ?? target?.gigi ?? null
  const ada = !t.per_gigi && !gigi && !tambahan.rencana_item_id && form.tindakans.find((x) => x.tindakan_id === t.id && !x.gigi && !x.rencana_item_id)
  if (ada) return ada.jumlah++
  form.tindakans.push({
    _key: `baru-${++urutBaru}`,
    tindakan_id: t.id,
    nama: t.nama,
    tarif: t.tarif_cabang,
    jumlah: tambahan.jumlah ?? 1,
    petugas_id: auth.user?.tercatat_dokter ? auth.user.id : kunjungan.value.dokter_id ?? '',
    icd9cm_id: t.icd9cm_id,
    icd9cm: t.icd9cm,
    template_consent_id: t.template_consent_id,
    jenis_catatan: t.jenis_catatan,
    protokol_foto_id: t.protokol_foto_id,
    per_gigi: t.per_gigi,
    kondisi_gigi_hasil: t.kondisi_gigi_hasil,
    gigi,
    permukaan: tambahan.permukaan ?? target?.permukaan ?? '',
    rencana_item_id: tambahan.rencana_item_id ?? null,
    rencana_judul: tambahan.rencana_judul,
    asisten_id: '',
    paket_pasien_item_id: null,
    catatan: null,
  })
  if (target) gigiTarget.value = null
  pakaiPaketOtomatis(form.tindakans.at(-1))
}

// ---- Paket multi-sesi pasien (TR-02): pakai sesi paket → tindakan ditagih Rp 0 ----
const paketAktif = ref([])
const paketCard = ref(null)

async function muatPaket() {
  if (!auth.can('pasien.lihat', 'kasir.tagihan', 'rme.tindakan', 'pemeriksaan.dokter')) return
  try {
    paketAktif.value = (await api.get(`/pasiens/${kunjungan.value.pasien_id}/pakets`, { params: { aktif: 1 }, silent: true })).data
  } catch {
    paketAktif.value = []
  }
}

/**
 * Pilihan paket untuk satu baris tindakan: item paket aktif untuk treatment yang sama. `sisa` = sesi yang tersedia untuk
 * baris ini: sisa backend + sesi yang sudah dipesan baris ini sendiri − baris lain di form yang belum tersimpan.
 */
function opsiPaket(t) {
  const opsi = paketAktif.value.flatMap((p) =>
    p.items
      .filter((i) => i.tindakan_id === t.tindakan_id)
      .map((i) => {
        const dipakaiForm = form.tindakans.filter((x) => x !== t && !x.id && x.paket_pasien_item_id === i.id).reduce((s, x) => s + x.jumlah, 0)
        const milikSendiri = t.paket_awal?.id === i.id ? t.paket_awal.jumlah : 0
        return { id: i.id, no: p.no_paket, sisa: i.sisa + milikSendiri - dipakaiForm }
      }),
  )
  // Baris tersimpan yang memakai sesi terakhir: paketnya sudah "habis" tetapi pilihannya tetap ditampilkan.
  if (t.paket_pasien_item_id && !opsi.some((o) => o.id === t.paket_pasien_item_id)) {
    opsi.push({ id: t.paket_pasien_item_id, no: t.paket_no ?? 'paket', sisa: t.paket_awal?.id === t.paket_pasien_item_id ? t.paket_awal.jumlah : 0 })
  }
  return opsi
}

function pakaiPaketOtomatis(t) {
  if (!t || t.paket_pasien_item_id) return
  const pilihan = opsiPaket(t).find((o) => o.sisa >= t.jumlah)
  if (!pilihan) return
  t.paket_pasien_item_id = pilihan.id
  t.paket_no = pilihan.no
  toast.info(`${t.nama} memakai sesi paket ${pilihan.no} (tersedia ${pilihan.sisa} sesi).`)
}

// ---- Kedokteran gigi: odontogram, rencana perawatan, tindakan per gigi (DG-01/02/07) ----
const odontogramCard = ref(null)
const rencanaCard = ref(null)
const tindakanCard = ref(null)
const petaGigi = ref({})
/** Gigi tujuan tindakan per gigi berikutnya (dari tombol "+ Tindakan untuk gigi ini" di odontogram). */
const gigiTarget = ref(null)

const isGigi = computed(
  () =>
    kunjungan.value?.poli?.spesialisasi === 'gigi' ||
    form.tindakans.some((t) => t.per_gigi || t.gigi) ||
    !!kunjungan.value?.odontogram_dicatat?.length,
)
const itemRencanaDipakai = computed(() => form.tindakans.map((t) => t.rencana_item_id).filter(Boolean))
/** Kondisi hasil seluruh gigi (mis. cabut → hilang) tidak butuh permukaan. */
const tanpaPermukaan = (t) => petaGigi.value[t.kondisi_gigi_hasil]?.cakupan === 'gigi'

watch(isGigi, (v) => v && referensiGigi().then((r) => (petaGigi.value = r.peta)).catch(() => {}), { immediate: true })

function tindakanUntukGigi(target) {
  gigiTarget.value = target
  tindakanCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  toast.info(`Pilih tindakan untuk ${formatGigi(target.gigi, target.permukaan)}.`)
}

function kerjakanRencana(item) {
  if (form.tindakans.some((t) => t.rencana_item_id === item.id)) return toast.info('Item rencana ini sudah ada di daftar tindakan.')
  const t = item.tindakan
  tambahTindakan(
    {
      id: item.tindakan_id, nama: t.nama, tarif_cabang: item.tarif, icd9cm_id: t.icd9cm_id, icd9cm: t.icd9cm, template_consent_id: t.template_consent_id,
      jenis_catatan: t.jenis_catatan, protokol_foto_id: t.protokol_foto_id, per_gigi: t.per_gigi, kondisi_gigi_hasil: t.kondisi_gigi_hasil,
    },
    { gigi: item.gigi, permukaan: item.permukaan ?? '', jumlah: item.jumlah, rencana_item_id: item.id, rencana_judul: item.rencana_judul },
  )
  toast.success(`${t.nama}${item.gigi ? ` ${formatGigi(item.gigi, item.permukaan)}` : ''} ditambahkan ke tindakan. Simpan untuk mencatat.`)
}

function pilihIcd9(t, icd) {
  t.icd9cm_id = icd.id
  t.icd9cm = icd
  icd9Edit.value = null
}

/** Consent terbaru untuk satu baris tindakan: yang berlaku (disetujui) diutamakan. */
function consentTindakan(t) {
  const daftar = (kunjungan.value?.informed_consents ?? []).filter((c) => c.kunjungan_tindakan_id === t.id)
  return daftar.find((c) => c.status === 'disetujui') ?? daftar.at(-1) ?? null
}

const consentBelum = computed(() => form.tindakans.filter((t) => t.template_consent_id && consentTindakan(t)?.status !== 'disetujui'))

const catatanOpen = ref(false)
const catatanId = ref(null)
const consentFormOpen = ref(false)
const consentTindakanAktif = ref(null)
const consentLihatOpen = ref(false)
const consentUuid = ref('')

/** Catatan & consent butuh baris tersimpan (punya id); simpan dulu bila baru ditambahkan. */
async function pastikanTersimpan(t) {
  if (t.id) return t
  if (!isDokter.value || !(await simpan({ silent: true }))) return null
  const sama = (x) =>
    t.rencana_item_id
      ? x.rencana_item_id === t.rencana_item_id
      : x.tindakan_id === t.tindakan_id && (x.gigi ?? null) === (t.gigi ?? null) && (x.permukaan || '') === normalPermukaan(t.permukaan)
  return form.tindakans.find((x) => x.id && sama(x)) ?? null
}

async function bukaCatatan(t) {
  const baris = await pastikanTersimpan(t)
  if (!baris) return
  catatanId.value = baris.id
  catatanOpen.value = true
}

function catatanTersimpan({ id, catatan, petugas_id }) {
  const t = form.tindakans.find((x) => x.id === id)
  if (!t) return
  t.catatan = catatan
  t.petugas_id = petugas_id ?? ''
}

async function ambilConsent(t) {
  const baris = await pastikanTersimpan(t)
  if (!baris) return
  consentTindakanAktif.value = baris
  consentFormOpen.value = true
}

function consentTersimpan(consent) {
  kunjungan.value.informed_consents = [...(kunjungan.value.informed_consents ?? []), consent]
  consentKurang.value = []
}

function lihatConsent(c) {
  consentUuid.value = c.uuid
  consentLihatOpen.value = true
}

// ---- Foto klinis per tindakan (FT-01) ----
const fotoCard = ref(null)
const tindakanFoto = computed(() => form.tindakans.filter((t) => t.id).map((t) => ({ id: t.id, nama: t.nama, protokol_foto_id: t.protokol_foto_id })))

async function fotoTindakan(t) {
  const baris = await pastikanTersimpan(t)
  if (baris) fotoCard.value?.ambil(baris)
}

function consentBerubah(data) {
  kunjungan.value.informed_consents = kunjungan.value.informed_consents.map((c) => (c.uuid === data.uuid ? { ...c, ...data } : c))
}

// ---- Resep ----
function tambahObat(o) {
  if (form.resep.some((r) => r.obat_id === o.id)) return toast.info('Obat sudah ada di resep.')
  const alergi = alergiObat(o, kunjungan.value?.pasien.alergis)
  if (alergi) toast.error(`Perhatian: pasien alergi ${alergi.zat}. Pastikan ${o.nama} aman sebelum diresepkan.`)
  if (o.stok <= 0) toast.info(`Perhatian: stok ${o.nama} kosong.`)
  form.resep.push({ obat_id: o.id, nama: o.nama, satuan: o.satuan, harga: o.harga, stok: o.stok, jumlah: 10, aturan_pakai: ATURAN_PAKAI[0] })
}

function payload() {
  const data = Object.fromEntries([...VITAL, ...SOAP].map((f) => [f.key, form[f.key] === '' ? null : form[f.key]]))
  if (isPerawat.value) return data

  return {
    ...data,
    akses_terbatas: form.akses_terbatas,
    diagnosas: form.diagnosas.map(({ icd10_id, jenis }) => ({ icd10_id, jenis })),
    tindakans: form.tindakans.map(({ id, tindakan_id, jumlah, petugas_id, asisten_id, icd9cm_id, gigi, permukaan, rencana_item_id, paket_pasien_item_id }) => ({
      id: id ?? null, tindakan_id, jumlah, petugas_id: petugas_id || null, asisten_id: asisten_id || null, icd9cm_id: icd9cm_id ?? null,
      gigi: gigi || null, permukaan: gigi && permukaan ? permukaan : null, rencana_item_id: rencana_item_id ?? null,
      paket_pasien_item_id: paket_pasien_item_id || null,
    })),
    resep: form.resep.map(({ obat_id, jumlah, aturan_pakai }) => ({ obat_id, jumlah, aturan_pakai })),
    catatan_resep: form.catatan_resep || null,
  }
}

async function simpan({ silent = false } = {}) {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.put(`/kunjungans/${route.params.id}/pemeriksaan`, payload())
    // Sisa paket dimuat ulang SEBELUM form diisi ulang: sesi yang dipesan baris tersimpan dihitung dari data terbaru.
    if (paketAktif.value.length || form.tindakans.some((t) => t.paket_pasien_item_id)) {
      await muatPaket()
      paketCard.value?.muatUlang()
    }
    isiForm(data)
    // Tindakan per gigi memperbarui odontogram & status item rencana di backend.
    if (isGigi.value) {
      odontogramCard.value?.muatUlang()
      rencanaCard.value?.muatUlang()
    }
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
  if (!confirm('Selesaikan & tanda tangani rekam medis? Setelah ini isi RME terkunci (koreksi hanya lewat addendum) dan tagihan diterbitkan.')) return
  finishing.value = true
  consentKurang.value = []
  try {
    if (!(await simpan({ silent: true }))) return
    await api.post(`/kunjungans/${route.params.id}/selesai`)
    toast.success('Pemeriksaan selesai & ditandatangani. Pasien diarahkan ke kasir.')
    router.push('/antrian')
  } catch (e) {
    consentKurang.value = e.response?.data?.errors?.informed_consent ?? []
    toast.error(errorMessage(e))
  } finally {
    finishing.value = false
  }
}

// ---- Addendum (RM-07) ----
const addendumOpen = ref(false)

function addendumTersimpan(a) {
  kunjungan.value.pemeriksaan.addendums = [...(kunjungan.value.pemeriksaan.addendums ?? []), a]
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
    muatFavorit()
    muatPaket()
    if (isDokter.value) cachedGet('/petugas').then((p) => (petugas.value = p)).catch(() => {})
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
        <button v-if="isDokter" class="btn btn-secondary" @click="templateOpen = true">Template</button>
        <button class="btn btn-secondary" :disabled="saving || finishing" @click="simpan()">
          <AppSpinner v-if="saving && !finishing" />{{ saving && !finishing ? 'Menyimpan...' : 'Simpan' }}
        </button>
        <button v-if="isDokter && kunjungan.status === 'diperiksa'" class="btn btn-primary" :disabled="saving || finishing" @click="selesai">
          <AppSpinner v-if="finishing" />{{ finishing ? 'Memproses...' : 'Selesai & tanda tangani' }}
        </button>
      </template>
      <button v-else-if="isDokter && ditandatangani" class="btn btn-secondary" @click="addendumOpen = true">Tambah addendum</button>
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
      <label
        v-if="isDokter && editable"
        class="ml-auto flex items-center gap-2 rounded-xl px-3 py-2"
        :class="form.akses_terbatas ? 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-400/30' : 'text-slate-500'"
        title="Isi rekam medis hanya dapat dibuka tim yang menangani & pemegang izin rme.terbatas (mis. kasus IMS)"
      >
        <input v-model="form.akses_terbatas" type="checkbox" class="accent-rose-600" :disabled="adaDiagnosaSensitif" />
        🔒 Akses terbatas
        <span v-if="adaDiagnosaSensitif" class="text-xs">(diagnosa sensitif)</span>
      </label>
      <span v-else-if="kunjungan.akses_terbatas" class="ml-auto rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700">🔒 Akses terbatas</span>
    </div>

    <!-- Peringatan klinis pasien (PS-03): alergi, hamil/menyusui, Fitzpatrick, riwayat obat & penyakit -->
    <div class="card mb-5 px-5 py-3">
      <PeringatanKlinis
        :klinis="kunjungan.pasien.klinis"
        :alergis="kunjungan.pasien.alergis ?? []"
        :jenis-kelamin="kunjungan.pasien.jenis_kelamin"
        :tanggal-lahir="kunjungan.pasien.tanggal_lahir"
      >
        <button v-if="bolehUbahKlinis" type="button" class="btn btn-ghost btn-sm ml-auto" @click="klinisOpen = true">Data klinis</button>
      </PeringatanKlinis>
    </div>

    <div v-if="!editable" class="alert alert-warning mb-5">
      Pemeriksaan sudah ditutup<template v-if="ditandatangani"> dan ditandatangani</template>. Data ditampilkan dalam mode baca<template v-if="ditandatangani">; koreksi lewat addendum</template>.
    </div>
    <div v-else-if="sipBermasalah && auth.user?.tercatat_dokter" class="alert alert-warning mb-5">
      No. SIP Anda belum diisi atau sudah kedaluwarsa, sehingga Anda belum bisa menandatangani & menutup pemeriksaan. Hubungi admin untuk memperbarui data SIP.
    </div>
    <div v-if="consentKurang.length" class="alert alert-danger mb-5">
      <p class="font-semibold">Pemeriksaan belum bisa ditutup:</p>
      <ul class="list-disc pl-5"><li v-for="m in consentKurang" :key="m">{{ m }}</li></ul>
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
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
          <div class="card-header flex-wrap">
            <h2 class="card-title">Catatan SOAP</h2>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-ghost btn-sm" @click="salinSoap">Salin SOAP</button>
              <span v-if="isPerawat" class="text-xs text-slate-400">Anda mengisi anamnesis (S); O/A/P diisi dokter</span>
              <button v-else-if="editable" type="button" class="btn btn-ghost btn-sm" @click="templateOpen = true">Pakai template</button>
            </div>
          </div>
          <div class="card-body grid gap-4 sm:grid-cols-2">
            <div v-for="f in SOAP" :key="f.key">
              <label class="label">{{ f.label }}</label>
              <textarea
                v-model="form[f.key]"
                rows="4"
                class="input"
                :placeholder="f.placeholder"
                :disabled="!editable || (isPerawat && f.key !== 'subjektif')"
              />
            </div>
          </div>
        </section>

        <!-- Kedokteran gigi: odontogram & rencana perawatan (poli gigi / ada tindakan per gigi) -->
        <template v-if="isGigi && auth.can('rme.lihat')">
          <OdontogramCard
            ref="odontogramCard"
            :pasien="kunjungan.pasien"
            :kunjungan-id="kunjungan.id"
            :editable="editable"
            :bisa-tambah-tindakan="editable && isDokter"
            @tambah-tindakan="tindakanUntukGigi"
          />
          <RencanaPerawatanCard
            ref="rencanaCard"
            :pasien="kunjungan.pasien"
            :kunjungan="kunjungan"
            :bisa-kerjakan="editable && isDokter"
            :item-dipakai="itemRencanaDipakai"
            :gigi-awal="gigiTarget"
            @kerjakan="kerjakanRencana"
          />
        </template>

        <template v-if="!isPerawat">
          <!-- Diagnosa -->
          <section class="card">
            <div class="card-header"><h2 class="card-title">Diagnosa (ICD-10)</h2></div>
            <div class="card-body space-y-3">
              <AsyncSelect v-if="editable" endpoint="/icd10s" placeholder="Cari kode atau nama penyakit..." @select="tambahDiagnosa">
                <template #default="{ item }">
                  <span v-if="item.favorit" class="text-amber-500">★ </span><span class="tabular-nums font-semibold">{{ item.kode }}</span> {{ item.nama }}
                  <span v-if="item.sensitif" class="text-xs text-rose-600"> · sensitif</span>
                </template>
              </AsyncSelect>
              <div v-if="editable && favorits.length" class="flex flex-wrap gap-1.5">
                <span class="self-center text-xs text-slate-400">Favorit:</span>
                <button
                  v-for="f in favorits"
                  :key="f.id"
                  type="button"
                  class="chip hover:bg-white"
                  :class="{ 'opacity-40': form.diagnosas.some((d) => d.icd10_id === f.id) }"
                  :title="f.nama"
                  @click="tambahDiagnosa(f)"
                >
                  <b class="tabular-nums">{{ f.kode }}</b> <span class="max-w-40 truncate">{{ f.nama }}</span>
                </button>
              </div>
              <p v-if="errors.diagnosas" class="field-error">{{ errors.diagnosas }}</p>
              <ul class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white/30">
                <li v-for="(d, i) in form.diagnosas" :key="d.icd10_id" class="flex items-center gap-3 px-3 py-2 text-sm">
                  <button
                    type="button"
                    :class="isFavorit(d.icd10_id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'"
                    :title="isFavorit(d.icd10_id) ? 'Hapus dari favorit' : 'Jadikan favorit'"
                    :aria-label="isFavorit(d.icd10_id) ? `Hapus ${d.kode} dari favorit` : `Jadikan ${d.kode} favorit`"
                    @click="toggleFavorit(d)"
                  >
                    ★
                  </button>
                  <span class="w-16 tabular-nums font-semibold">{{ d.kode }}</span>
                  <span class="flex-1">{{ d.nama }} <span v-if="d.sensitif" class="text-xs text-rose-600">· sensitif</span></span>
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
        </template>

        <!-- Tindakan: dokter mengelola daftar; tenaga dengan izin rme.tindakan mengisi catatan & consent -->
        <section v-if="isDokter || (bolehTindakan && form.tindakans.length)" ref="tindakanCard" class="card scroll-mt-24">
          <div class="card-header">
            <h2 class="card-title">Tindakan</h2>
            <span v-if="consentBelum.length && editable" class="text-xs font-semibold text-amber-700">{{ consentBelum.length }} tindakan menunggu informed consent</span>
          </div>
          <div class="card-body space-y-3">
            <p v-if="gigiTarget && editable && isDokter" class="flex items-center gap-2 text-xs">
              <span class="chip">Untuk {{ formatGigi(gigiTarget.gigi, gigiTarget.permukaan) }}</span>
              <button type="button" class="text-slate-400 hover:text-slate-700" aria-label="Batal pilih gigi" @click="gigiTarget = null">&times;</button>
            </p>
            <AsyncSelect v-if="editable && isDokter" endpoint="/tindakans" :params="{ aktif: 1, cabang_id: kunjungan.cabang_id }" placeholder="Cari tindakan / treatment..." @select="tambahTindakan">
              <template #default="{ item }">
                {{ item.nama }}
                <span class="text-xs text-slate-500">· {{ rupiah(item.tarif_cabang) }} · {{ item.durasi_menit }} mnt<template v-if="item.kategori"> · {{ item.kategori.nama }}</template><template v-if="item.per_gigi"> · per gigi</template></span>
              </template>
            </AsyncSelect>
            <div v-if="form.tindakans.length" class="space-y-2">
              <div v-for="(t, i) in form.tindakans" :key="t._key" class="rounded-2xl border border-line bg-white/30 p-3">
                <div class="flex flex-wrap items-start gap-3">
                  <div class="min-w-48 flex-1">
                    <p class="font-medium">
                      {{ t.nama }}<span v-if="t.gigi" class="tabular-nums"> · {{ formatGigi(t.gigi, t.permukaan) }}</span>
                      <span v-if="!t.id" class="text-xs font-normal text-amber-700">· belum disimpan</span>
                    </p>
                    <div v-if="opsiPaket(t).length" class="mt-1.5">
                      <label class="sr-only" :for="`paket-${i}`">Pembayaran {{ t.nama }}</label>
                      <select
                        :id="`paket-${i}`"
                        v-model="t.paket_pasien_item_id"
                        class="input w-auto py-1 text-xs"
                        :class="t.paket_pasien_item_id ? 'text-emerald-800' : ''"
                        :disabled="!editable || !isDokter"
                        @change="t.paket_no = opsiPaket(t).find((o) => o.id === t.paket_pasien_item_id)?.no"
                      >
                        <option :value="null">Bayar normal (tidak pakai paket)</option>
                        <option v-for="o in opsiPaket(t)" :key="o.id" :value="o.id" :disabled="o.sisa < t.jumlah && o.id !== t.paket_pasien_item_id">
                          Pakai paket {{ o.no }} · tersedia {{ o.sisa }} sesi
                        </option>
                      </select>
                      <p v-if="errors[`tindakans.${i}.paket_pasien_item_id`]" class="field-error">{{ errors[`tindakans.${i}.paket_pasien_item_id`] }}</p>
                    </div>
                    <p v-if="t.rencana_item_id" class="text-xs text-slate-500">Dari rencana perawatan<template v-if="t.rencana_judul">: {{ t.rencana_judul }}</template></p>
                    <p v-if="errors[`tindakans.${i}.rencana_item_id`]" class="field-error">{{ errors[`tindakans.${i}.rencana_item_id`] }}</p>
                    <div class="mt-0.5 text-xs text-slate-500">
                      <template v-if="icd9Edit === i">
                        <AsyncSelect endpoint="/icd9cms" placeholder="Cari kode / nama tindakan ICD-9-CM..." @select="(icd) => pilihIcd9(t, icd)">
                          <template #default="{ item }"><span v-if="item.favorit" class="text-amber-500">★ </span><b class="tabular-nums">{{ item.kode }}</b> {{ item.nama }}</template>
                        </AsyncSelect>
                      </template>
                      <button v-else type="button" class="hover:text-slate-800" :disabled="!editable || !isDokter" @click="icd9Edit = i">
                        ICD-9-CM: <b class="tabular-nums">{{ t.icd9cm?.kode ?? '—' }}</b> {{ t.icd9cm?.nama ?? '' }}<span v-if="editable && isDokter" class="underline"> ubah</span>
                      </button>
                    </div>
                    <!-- Nomor gigi & permukaan (tindakan per gigi, DG-07) -->
                    <div v-if="t.per_gigi || t.gigi || isGigi" class="mt-1.5">
                      <PilihGigi
                        v-model:gigi="t.gigi"
                        v-model:permukaan="t.permukaan"
                        :id-input="`gigi-${i}`"
                        :tanpa-permukaan="tanpaPermukaan(t)"
                        :disabled="!editable || !isDokter"
                        :invalid="!!errors[`tindakans.${i}.gigi`] || !!errors[`tindakans.${i}.permukaan`]"
                      />
                      <p v-if="errors[`tindakans.${i}.gigi`] || errors[`tindakans.${i}.permukaan`]" class="field-error">
                        {{ errors[`tindakans.${i}.gigi`] ?? errors[`tindakans.${i}.permukaan`] }}
                      </p>
                    </div>
                    <p v-if="t.catatan" class="mt-1 text-xs text-slate-500">
                      Catatan: {{ [t.catatan.area, t.catatan.titiks?.length && `${t.catatan.titiks.length} titik`, t.catatan.parameter && 'parameter alat terisi'].filter(Boolean).join(' · ') || 'terisi' }}
                    </p>
                  </div>
                  <!-- Pelaksana (terapis) & asisten: dasar komisi per peran (KM-01); dokter = dokter kunjungan -->
                  <div class="w-44 space-y-1">
                    <label class="sr-only" :for="`petugas-${i}`">Pelaksana {{ t.nama }}</label>
                    <select :id="`petugas-${i}`" v-model="t.petugas_id" class="input py-1 text-sm" :class="{ 'input-error': errors[`tindakans.${i}.petugas_id`] }" :disabled="!editable || !isDokter" title="Pelaksana tindakan">
                      <option value="">— Pelaksana —</option>
                      <option v-for="p in petugas" :key="p.id" :value="p.id">{{ p.name }}</option>
                      <option v-if="t.petugas_id && !petugas.some((p) => p.id === t.petugas_id)" :value="t.petugas_id">{{ t.petugas_nama ?? `#${t.petugas_id}` }}</option>
                    </select>
                    <p v-if="errors[`tindakans.${i}.petugas_id`]" class="field-error">{{ errors[`tindakans.${i}.petugas_id`] }}</p>
                    <label class="sr-only" :for="`asisten-${i}`">Asisten {{ t.nama }}</label>
                    <select :id="`asisten-${i}`" v-model="t.asisten_id" class="input py-1 text-xs" :class="{ 'input-error': errors[`tindakans.${i}.asisten_id`] }" :disabled="!editable || !isDokter" title="Asisten tindakan (opsional)">
                      <option value="">— Asisten (opsional) —</option>
                      <option v-for="p in petugas" :key="p.id" :value="p.id">{{ p.name }}</option>
                      <option v-if="t.asisten_id && !petugas.some((p) => p.id === t.asisten_id)" :value="t.asisten_id">{{ t.asisten_nama ?? `#${t.asisten_id}` }}</option>
                    </select>
                    <p v-if="errors[`tindakans.${i}.asisten_id`]" class="field-error">{{ errors[`tindakans.${i}.asisten_id`] }}</p>
                  </div>
                  <div class="w-20">
                    <label class="sr-only" :for="`jumlah-${i}`">Jumlah {{ t.nama }}</label>
                    <input :id="`jumlah-${i}`" v-model.number="t.jumlah" type="number" min="1" class="input py-1" :disabled="!editable || !isDokter" />
                  </div>
                  <p class="w-28 pt-1.5 text-right tabular-nums">
                    <template v-if="t.paket_pasien_item_id">{{ rupiah(0) }}<span class="block text-[11px] text-emerald-700">paket</span></template>
                    <template v-else>{{ rupiah(t.tarif * t.jumlah) }}</template>
                  </p>
                  <button v-if="editable && isDokter" type="button" class="pt-1 text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${t.nama}`" @click="form.tindakans.splice(i, 1)">&times;</button>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" class="btn btn-secondary btn-sm" @click="bukaCatatan(t)">
                    {{ t.jenis_catatan === 'injeksi' ? 'Face chart' : t.jenis_catatan === 'energi' ? 'Parameter alat' : 'Catatan tindakan' }}
                  </button>
                  <button v-if="editable && auth.can('berkas.kelola')" type="button" class="btn btn-secondary btn-sm" @click="fotoTindakan(t)">Foto</button>
                  <template v-if="consentTindakan(t)">
                    <button type="button" class="flex items-center gap-1.5 text-xs" @click="lihatConsent(consentTindakan(t))">
                      <StatusBadge :status="consentTindakan(t).status" /> <span class="underline">informed consent</span>
                    </button>
                    <button v-if="editable && bolehTindakan && consentTindakan(t).status !== 'disetujui'" type="button" class="btn btn-ghost btn-sm" @click="ambilConsent(t)">Ambil ulang</button>
                  </template>
                  <button
                    v-else-if="editable && bolehTindakan"
                    type="button"
                    :class="t.template_consent_id ? 'btn-primary' : 'btn-ghost'"
                    class="btn btn-sm"
                    @click="ambilConsent(t)"
                  >
                    {{ t.template_consent_id ? 'Ambil informed consent (wajib)' : 'Informed consent' }}
                  </button>
                  <span v-else-if="t.template_consent_id" class="text-xs text-amber-700">Informed consent wajib — belum diambil</span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-slate-400">Belum ada tindakan.</p>
          </div>
        </section>

        <template v-if="!isPerawat">
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
                        <p v-if="alergiResep(r)" class="text-xs font-semibold text-rose-600">⚠ Pasien alergi {{ alergiResep(r).zat }}</p>
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
          <p class="mt-1 text-xs text-slate-400">
            {{ konsultasi ? `${konsultasi.nama} ${rupiah(konsultasi.tarif_cabang)}` : 'Tanpa jasa konsultasi' }} + tindakan + obat
          </p>
        </div>

        <!-- Tanda tangan & addendum (RM-07) -->
        <div v-if="ditandatangani" class="card">
          <div class="card-header">
            <h2 class="card-title">Tanda Tangan RME</h2>
            <button v-if="isDokter" class="btn btn-ghost btn-sm" @click="addendumOpen = true">+ Addendum</button>
          </div>
          <div class="card-body space-y-3 text-sm">
            <p class="rounded-xl bg-emerald-600/10 px-3 py-2 text-xs text-emerald-800">
              ✓ Ditandatangani oleh <b>{{ kunjungan.pemeriksaan.penandatangan?.name }}</b>
              <template v-if="kunjungan.pemeriksaan.penandatangan?.sip"> (SIP {{ kunjungan.pemeriksaan.penandatangan.sip }})</template>
              · {{ waktu(kunjungan.pemeriksaan.ditandatangani_at) }}
            </p>
            <div v-for="a in kunjungan.pemeriksaan.addendums ?? []" :key="a.id" class="rounded-xl border-l-4 border-amber-400 bg-amber-50/70 px-3 py-2">
              <p class="text-xs text-slate-500">{{ BAGIAN_ADDENDUM[a.bagian] ?? a.bagian }} · {{ a.user?.name }} · {{ waktu(a.created_at) }}</p>
              <p class="whitespace-pre-line">{{ a.isi }}</p>
              <p class="text-xs text-slate-500">Alasan: {{ a.alasan }}</p>
            </div>
            <p v-if="!kunjungan.pemeriksaan.addendums?.length" class="text-xs text-slate-400">Belum ada addendum.</p>
          </div>
        </div>

        <PaketPasienCard ref="paketCard" :pasien="kunjungan.pasien" ringkas />
        <FotoKlinisCard ref="fotoCard" :pasien="kunjungan.pasien" :kunjungan-id="kunjungan.id" :tindakans="tindakanFoto" :bisa-ambil="editable" />
        <LampiranBerkas :pasien-id="kunjungan.pasien_id" :kunjungan-id="kunjungan.id" :readonly="kunjungan.status === 'batal'" tanpa-foto />

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
                <p class="truncate text-xs text-slate-500">
                  <template v-if="r.rme_disembunyikan">🔒 Akses terbatas</template>
                  <template v-else>{{ r.pemeriksaan?.diagnosas?.map((d) => d.icd10.kode + ' ' + d.icd10.nama).join(', ') || '-' }}</template>
                </p>
              </summary>
              <div class="mt-3"><RekamMedisRingkas :kunjungan="r" /></div>
            </details>
          </div>
          <p v-else class="card-body text-sm text-slate-400">Belum ada riwayat kunjungan sebelumnya.</p>
        </div>
      </aside>
    </div>

    <TemplateSoapModal v-model="templateOpen" :poli-id="kunjungan.poli_id" :tindakan-ids="form.tindakans.map((t) => t.tindakan_id)" @terapkan="terapkanTemplate" />
    <CatatanTindakanModal v-model="catatanOpen" :kunjungan-tindakan-id="catatanId" :editable="editable" @saved="catatanTersimpan" />
    <DataKlinisModal
      v-if="bolehUbahKlinis"
      v-model="klinisOpen"
      :pasien="kunjungan.pasien"
      :klinis="kunjungan.pasien.klinis"
      :alergis="kunjungan.pasien.alergis ?? []"
      @saved="klinisTersimpan"
    />
    <ConsentFormModal v-model="consentFormOpen" :kunjungan="kunjungan" :tindakan="consentTindakanAktif" @saved="consentTersimpan" />
    <ConsentLihatModal v-model="consentLihatOpen" :uuid="consentUuid" :bisa-cabut="editable && bolehTindakan" @changed="consentBerubah" />
    <AddendumModal v-model="addendumOpen" :kunjungan-id="kunjungan.id" @saved="addendumTersimpan" />
  </template>
  <PageLoading v-else :error="loadError" text="Memuat data pemeriksaan..." @retry="load" />
</template>
