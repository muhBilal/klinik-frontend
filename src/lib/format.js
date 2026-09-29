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

export const ROLES = {
  admin: 'Administrator',
  pendaftaran: 'Pendaftaran',
  perawat: 'Perawat',
  dokter: 'Dokter',
  apoteker: 'Apoteker',
  kasir: 'Kasir',
}

export const STATUS_KUNJUNGAN = {
  menunggu: 'Menunggu',
  diperiksa: 'Diperiksa',
  menunggu_pembayaran: 'Menunggu bayar',
  selesai: 'Selesai',
  batal: 'Batal',
}

export const JENIS_MUTASI = { masuk: 'Masuk', keluar: 'Keluar', penyesuaian: 'Stok opname' }

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
