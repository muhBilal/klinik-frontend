/**
 * Perkecil gambar di browser lewat <canvas> lalu keluarkan sebagai data URI.
 * Dilakukan di sisi klien agar server tidak perlu ekstensi GD/Imagick.
 */

/** Ukuran & mutu foto profil: 256px cukup untuk avatar terbesar (80px @3x). */
const AVATAR_SIZE = 256
const AVATAR_QUALITY = 0.82

/** Baca File jadi data URI. */
const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'))
    reader.readAsDataURL(file)
  })

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Berkas bukan gambar yang valid.'))
    img.src = src
  })

/**
 * File gambar -> data URI JPEG persegi `size`x`size`, dipotong di tengah (cover).
 * @returns {Promise<string>}
 */
export async function toSquareDataUrl(file, size = AVATAR_SIZE) {
  const img = await loadImage(await readFile(file))

  // Sisi terpendek jadi area potong -> gambar tidak gepeng
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas
    .getContext('2d')
    .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)

  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY)
}
