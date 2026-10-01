/**
 * Notasi gigi FDI & permukaan untuk odontogram (PRD DG-01). Kode kondisi, label, cakupan & warna TIDAK didefinisikan di
 * sini — selalu dari backend (`GET /odontogram/referensi`, lewat `referensiGigi()`), sumber yang sama dengan validasi.
 */
import { cachedGet } from '@/lib/cache'

/**
 * Tata letak baku odontogram: dilihat dari depan pasien, jadi kuadran kanan pasien (1, 4, 5, 8) di sisi kiri gambar.
 * Baris: tetap atas, sulung atas, sulung bawah, tetap bawah.
 */
export const BARIS_GIGI = [
  { rahang: 'atas', sulung: false, kiri: [18, 17, 16, 15, 14, 13, 12, 11], kanan: [21, 22, 23, 24, 25, 26, 27, 28] },
  { rahang: 'atas', sulung: true, kiri: [55, 54, 53, 52, 51], kanan: [61, 62, 63, 64, 65] },
  { rahang: 'bawah', sulung: true, kiri: [85, 84, 83, 82, 81], kanan: [71, 72, 73, 74, 75] },
  { rahang: 'bawah', sulung: false, kiri: [48, 47, 46, 45, 44, 43, 42, 41], kanan: [31, 32, 33, 34, 35, 36, 37, 38] },
]

export const SEMUA_GIGI = BARIS_GIGI.flatMap((b) => [...b.kiri, ...b.kanan])

export const PERMUKAAN = ['M', 'O', 'D', 'B', 'L']

const kuadran = (g) => Math.floor(g / 10)

export const gigiValid = (g) => SEMUA_GIGI.includes(Number(g))
export const sulung = (g) => kuadran(g) >= 5
export const anterior = (g) => g % 10 <= 3
export const rahangAtas = (g) => [1, 2, 5, 6].includes(kuadran(g))
/** Kuadran kanan pasien (kiri gambar): permukaan mesial menghadap ke kanan, ke garis tengah. */
export const sisiKananPasien = (g) => [1, 4, 5, 8].includes(kuadran(g))

export function labelPermukaan(g, kode) {
  return {
    M: 'Mesial',
    D: 'Distal',
    O: anterior(g) ? 'Insisal' : 'Oklusal',
    B: anterior(g) ? 'Labial' : 'Bukal',
    L: rahangAtas(g) ? 'Palatal' : 'Lingual',
  }[kode] ?? kode
}

/** Urutkan & hilangkan duplikat permukaan: ['O','M'] / 'om' → 'MO'; '' bila kosong. */
export function normalPermukaan(nilai) {
  const huruf = (Array.isArray(nilai) ? nilai : String(nilai ?? '').split('')).map((h) => h.toUpperCase())
  return PERMUKAAN.filter((p) => huruf.includes(p)).join('')
}

/** "gigi 16 (MO)" — sama dengan format tagihan backend (`App\Support\Gigi::format`). */
export const formatGigi = (gigi, permukaan) => (gigi ? `gigi ${gigi}${permukaan ? ` (${permukaan})` : ''}` : '')

/** Nama jenis gigi untuk tooltip, mis. "Molar 1 tetap kanan atas". */
export function namaGigi(g) {
  const urutan = g % 10
  const jenis = sulung(g)
    ? ['Insisivus sentral', 'Insisivus lateral', 'Kaninus', 'Molar 1', 'Molar 2'][urutan - 1]
    : ['Insisivus sentral', 'Insisivus lateral', 'Kaninus', 'Premolar 1', 'Premolar 2', 'Molar 1', 'Molar 2', 'Molar 3'][urutan - 1]
  return `${jenis} ${sulung(g) ? 'sulung' : 'tetap'} ${sisiKananPasien(g) ? 'kanan' : 'kiri'} ${rahangAtas(g) ? 'atas' : 'bawah'}`
}

/** Saran nama fase rencana perawatan (fase disimpan sebagai angka 1–9). */
export const FASE_RENCANA = {
  1: 'Darurat & keluhan utama',
  2: 'Kontrol penyakit (scaling, tambal, cabut)',
  3: 'Perawatan definitif (PSA, mahkota, gigi tiruan)',
  4: 'Pemeliharaan & kontrol berkala',
}
export const labelFase = (f) => `Fase ${f}${FASE_RENCANA[f] ? ` — ${FASE_RENCANA[f]}` : ''}`

/**
 * Referensi kondisi odontogram dari backend: `{ daftar, peta: { kode: {kode, label, cakupan, kelompok, warna} } }`.
 * Di-cache (data referensi, berubah hanya saat rilis).
 */
export async function referensiGigi() {
  const data = await cachedGet('/odontogram/referensi')
  return { daftar: data.kondisi, peta: Object.fromEntries(data.kondisi.map((k) => [k.kode, k])) }
}
