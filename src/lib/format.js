const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export const rupiah = (value) => rupiahFormatter.format(Number(value ?? 0))

export const angka = (value) => new Intl.NumberFormat('id-ID').format(Number(value ?? 0))

export function tanggal(value) {
  if (!value) return '-'
  // "YYYY-MM-DD" diparse sebagai tanggal lokal, bukan UTC
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function waktu(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function jam(value) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/** Tanggal (zona waktu lokal) dalam format YYYY-MM-DD; tanpa argumen = hari ini. */
export function isoTanggal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Tanggal hari ini (zona waktu lokal) dalam format YYYY-MM-DD. */
export function hariIni() {
  return isoTanggal()
}

/** Path ikon garis (heroicons outline) untuk `AppIcon` — dipakai sebagai pengganti emoji. */
export const IKON = {
  bintang: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  centang: 'M4.5 12.75l6 6 9-13.5',
}

/** Kategori baris tagihan (kolom `tagihan_items.kategori`). */
export const KATEGORI_TAGIHAN = { konsultasi: 'Konsultasi', tindakan: 'Tindakan', obat: 'Obat', produk: 'Produk', paket: 'Paket', deposit: 'Deposit', lainnya: 'Lainnya' }

export const jenisKelamin = (jk) => ({ L: 'Laki-laki', P: 'Perempuan' })[jk] ?? '-'

export const PENJAMIN = { umum: 'Umum', bpjs: 'BPJS', asuransi: 'Asuransi' }

export const METODE_BAYAR = { tunai: 'Tunai', debit: 'Kartu Debit', qris: 'QRIS', transfer: 'Transfer', penjamin: 'Ditanggung Penjamin' }

/** Kategori lampiran klinis (enum KategoriBerkas di backend). */
export const KATEGORI_BERKAS = {
  foto_klinis: 'Foto klinis',
  informed_consent: 'Informed consent',
  radiologi: 'Radiologi',
  hasil_penunjang: 'Hasil penunjang',
  lainnya: 'Lainnya',
}

/** Ukuran berkas (byte) yang mudah dibaca. */
export const ukuranBerkas = (byte) => (byte < 1024 * 1024 ? `${Math.max(1, Math.round(byte / 1024))} KB` : `${(byte / 1024 / 1024).toFixed(1)} MB`)

export const STATUS_KUNJUNGAN = {
  menunggu: 'Menunggu',
  diperiksa: 'Diperiksa',
  menunggu_pembayaran: 'Menunggu bayar',
  selesai: 'Selesai',
  batal: 'Batal',
}

/** Status booking (enum StatusAppointment backend, F1-02). */
export const STATUS_APPOINTMENT = {
  dijadwalkan: 'Dijadwalkan',
  dikonfirmasi: 'Dikonfirmasi',
  hadir: 'Hadir',
  batal: 'Batal',
  tidak_hadir: 'Tidak hadir',
}

/** Nama hari, indeks mengikuti `Date.getDay()` / `Carbon::dayOfWeek` (0 = Minggu). */
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** "YYYY-MM-DD" + n hari → "YYYY-MM-DD" (zona waktu lokal). */
export function tambahHari(iso, n) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return isoTanggal(d)
}

/** Label baris resep: nama obat, atau "Racikan X (krim 30 g)" (FR-01). */
export function labelResepItem(i) {
  if (!i.racikan) return i.obat?.nama ?? '-'
  const isi = i.jumlah_racikan ? ` ${angka(i.jumlah_racikan)} ${i.satuan_racikan ?? ''}`.trimEnd() : ''
  return `Racikan ${i.nama_racikan} (${i.bentuk}${isi})`
}

/** Jumlah baris resep untuk etiket/daftar: "10 tablet" atau "2 racikan". */
export function jumlahResepItem(i) {
  return i.racikan ? `${i.jumlah} racikan` : `${i.jumlah} ${i.obat?.satuan ?? ''}`.trimEnd()
}

export const JENIS_MUTASI = { masuk: 'Masuk', keluar: 'Keluar', penyesuaian: 'Stok opname' }

/** Bentuk catatan tindakan per treatment (enum JenisCatatanTindakan backend). */
export const JENIS_CATATAN = { umum: 'Catatan umum', injeksi: 'Face chart injeksi', energi: 'Parameter laser / energy device' }

/** Reaksi kulit setelah tindakan energy device (CatatanTindakan::PARAMETER backend). */
export const REAKSI_KULIT = {
  tidak_ada: 'Tidak ada',
  eritema_ringan: 'Eritema ringan',
  eritema_sedang: 'Eritema sedang',
  eritema_berat: 'Eritema berat',
  edema: 'Edema',
  purpura: 'Purpura',
  lepuh: 'Lepuh (blister)',
  hiperpigmentasi: 'Hiperpigmentasi',
  lainnya: 'Lainnya',
}

/** Parameter energy device: [key, label, satuan, step]. Urutan = urutan tampil di form. */
export const PARAMETER_ALAT = [
  ['panjang_gelombang_nm', 'Panjang gelombang', 'nm', '1'],
  ['fluence_j_cm2', 'Fluence', 'J/cm²', '0.01'],
  ['spot_size_mm', 'Spot size', 'mm', '0.1'],
  ['durasi_pulsa_ms', 'Durasi pulsa', 'ms', '0.01'],
  ['frekuensi_hz', 'Frekuensi', 'Hz', '0.1'],
  ['energi_total_j', 'Energi total', 'J', '0.1'],
  ['jumlah_shot', 'Jumlah shot', 'shot', '1'],
  ['jumlah_pass', 'Jumlah pass', 'pass', '1'],
]

/** Hubungan penanda tangan informed consent dengan pasien (enum HubunganPenandatangan). */
export const HUBUNGAN_PENANDATANGAN = {
  pasien: 'Pasien sendiri',
  orang_tua: 'Orang tua',
  suami_istri: 'Suami / istri',
  anak: 'Anak',
  saudara: 'Saudara kandung',
  wali: 'Wali',
}

/** Tahap foto klinis relatif terhadap tindakan (enum TahapFoto). */
export const TAHAP_FOTO = { sebelum: 'Sebelum', sesudah: 'Sesudah', kontrol: 'Kontrol' }

/** Tingkat persetujuan foto (enum TingkatPersetujuanFoto) — bertingkat: yang lebih tinggi mencakup yang di bawahnya. */
export const TINGKAT_FOTO = { klinis: 'Klinis saja', edukasi: 'Klinis & edukasi', marketing: 'Klinis, edukasi & marketing' }

/** Spesialisasi poli (enum Spesialisasi) — `gigi` menampilkan odontogram & rencana perawatan di pemeriksaan. */
export const SPESIALISASI = { umum: 'Umum', gigi: 'Kedokteran gigi', kulit: 'Dermatologi & venereologi', estetika: 'Estetika medis', lainnya: 'Lainnya' }

/** Peran dalam tindakan untuk komisi (enum PeranKomisi): dokter = dokter kunjungan, terapis = pelaksana, asisten. */
export const PERAN_KOMISI = { dokter: 'Dokter', terapis: 'Terapis / pelaksana', asisten: 'Asisten', penyesuaian: 'Penyesuaian' }

/** Asal komisi (enum SumberKomisi). */
export const SUMBER_KOMISI = { tindakan: 'Tindakan', konsultasi: 'Konsultasi', penyesuaian: 'Penyesuaian' }

/** Data klinis pasien (PS-03): kategori & keparahan alergi, tipe kulit Fitzpatrick, status hamil/menyusui. */
export const KATEGORI_ALERGI = { obat: 'Obat', makanan: 'Makanan', lingkungan: 'Lingkungan', lainnya: 'Lainnya' }
export const KEPARAHAN_ALERGI = { ringan: 'Ringan', sedang: 'Sedang', berat: 'Berat' }
export const FITZPATRICK = {
  I: 'Selalu terbakar, tidak pernah menggelap',
  II: 'Mudah terbakar, sedikit menggelap',
  III: 'Kadang terbakar, menggelap bertahap',
  IV: 'Jarang terbakar, mudah menggelap',
  V: 'Sangat jarang terbakar, sangat mudah menggelap',
  VI: 'Tidak pernah terbakar, kulit sangat gelap',
}
export const STATUS_KEHAMILAN = { tidak: 'Tidak hamil / menyusui', hamil: 'Hamil', menyusui: 'Menyusui' }

/** Persetujuan data pribadi UU PDP (PS-04): jenis & saluran opt-in marketing. */
export const JENIS_PERSETUJUAN_DATA = { pemrosesan: 'Pemrosesan data pribadi & kesehatan', marketing: 'Informasi promosi (opt-in marketing)' }
export const KANAL_MARKETING = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', telepon: 'Telepon' }

/** Bagian rekam medis yang dikoreksi lewat addendum (enum BagianAddendum). */
export const BAGIAN_ADDENDUM = {
  subjektif: 'Subjektif',
  objektif: 'Objektif',
  asesmen: 'Asesmen',
  plan: 'Plan',
  diagnosa: 'Diagnosa',
  tindakan: 'Tindakan',
  resep: 'Resep',
  lainnya: 'Lainnya',
}

export const SATUAN_OBAT = ['tablet', 'kapsul', 'botol', 'tube', 'sachet', 'ampul', 'vial', 'pcs']

export const GOLONGAN_DARAH = ['A', 'B', 'AB', 'O']

/** Opsi filter umum */
export const OPSI_STATUS_AKTIF = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nonaktif', label: 'Nonaktif' },
]

/** { value: label } atau [value] → [{ value, label }] untuk <FilterSelect>. */
export function toOptions(source) {
  return Array.isArray(source) ? source.map((v) => ({ value: v, label: v })) : Object.entries(source).map(([value, label]) => ({ value, label }))
}

export function debounce(fn, wait = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}
