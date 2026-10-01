import api from '@/lib/api'

/**
 * Foto klinis (PRD FT-01, FT-03): gambar selalu digambar ulang di kanvas sebelum diunggah, sehingga
 * - ukuran dibatasi (sisi terpanjang 2048 px, JPEG 0,9) — hemat penyimpanan & cepat dibuka;
 * - metadata EXIF (termasuk lokasi GPS & model perangkat) terbuang;
 * - thumbnail (360 px) dibuat di browser karena server tidak punya pustaka gambar; ikut dienkripsi di server.
 */
const MAKS = 2048
const THUMB = 360

async function gambar(sumber, lebarAsli, tinggiAsli, maks, kualitas) {
  const skala = Math.min(1, maks / Math.max(lebarAsli, tinggiAsli))
  const lebar = Math.round(lebarAsli * skala)
  const tinggi = Math.round(tinggiAsli * skala)
  const canvas = document.createElement('canvas')
  canvas.width = lebar
  canvas.height = tinggi
  canvas.getContext('2d').drawImage(sumber, 0, 0, lebar, tinggi)
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto.'))), 'image/jpeg', kualitas),
  )
  return { blob, lebar, tinggi }
}

/**
 * @param {File|Blob|HTMLVideoElement} sumber berkas dari input kamera/galeri, atau frame video kamera
 * @returns {Promise<{ foto: Blob, thumbnail: Blob, lebar: number, tinggi: number }>}
 */
export async function siapkanFoto(sumber) {
  let bitmap = sumber
  let lebar = sumber.videoWidth
  let tinggi = sumber.videoHeight

  if (sumber instanceof Blob) {
    try {
      bitmap = await createImageBitmap(sumber, { imageOrientation: 'from-image' })
    } catch {
      bitmap = await createImageBitmap(sumber)
    }
    lebar = bitmap.width
    tinggi = bitmap.height
  }
  if (!lebar || !tinggi) throw new Error('Kamera belum siap. Coba lagi.')

  const foto = await gambar(bitmap, lebar, tinggi, MAKS, 0.9)
  const thumbnail = await gambar(bitmap, lebar, tinggi, THUMB, 0.75)
  if (bitmap !== sumber) bitmap.close?.()
  return { foto: foto.blob, thumbnail: thumbnail.blob, lebar: foto.lebar, tinggi: foto.tinggi }
}

/**
 * Unggah satu foto klinis beserta metadatanya ke `POST /berkas` (kategori foto_klinis).
 * @returns {Promise<object>} berkas tersimpan (bentuk sama dengan item `GET /berkas`)
 */
export async function unggahFoto({ pasienId, kunjunganId, kunjunganTindakanId, protokolId, posisi, tahap, keterangan, hasil, namaFile }) {
  const data = new FormData()
  data.append('file', hasil.foto, `${namaFile}.jpg`)
  data.append('thumbnail', hasil.thumbnail, `${namaFile}-thumb.jpg`)
  data.append('kategori', 'foto_klinis')
  data.append('pasien_id', String(pasienId))
  data.append('lebar', String(hasil.lebar))
  data.append('tinggi', String(hasil.tinggi))
  if (kunjunganId) data.append('kunjungan_id', String(kunjunganId))
  if (kunjunganTindakanId) data.append('kunjungan_tindakan_id', String(kunjunganTindakanId))
  if (protokolId) data.append('protokol_foto_id', String(protokolId))
  if (posisi) data.append('posisi', posisi)
  if (tahap) data.append('tahap', tahap)
  if (keterangan) data.append('keterangan', keterangan)
  return (await api.post('/berkas', data)).data
}

/** Label posisi dari protokol berkas (`berkas.protokol.posisi`), fallback kodenya. */
export function labelPosisi(berkas) {
  return berkas.protokol?.posisi?.find((p) => p.kode === berkas.posisi)?.label ?? berkas.posisi ?? 'Tanpa posisi'
}

/**
 * Tautan bertanda tangan untuk banyak berkas sekaligus (`POST /berkas/tautan`). Setiap tautan tercatat audit,
 * jadi minta hanya untuk foto yang benar-benar ditampilkan. @returns {Promise<Record<string, string>>} uuid → url
 */
export async function tautanFoto(uuids, { pratinjau = false } = {}) {
  const hasil = {}
  for (let i = 0; i < uuids.length; i += 60) {
    const { data } = await api.post('/berkas/tautan', { uuids: uuids.slice(i, i + 60), pratinjau }, { silent: true })
    for (const t of data) hasil[t.uuid] = t.url
  }
  return hasil
}
