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

/** Tanggal hari ini (zona waktu lokal) dalam format YYYY-MM-DD. */
export function hariIni() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
