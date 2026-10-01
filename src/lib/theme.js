/**
 * Tema warna aksen (brand) — diterapkan sebagai CSS custom property `--color-brand-*`
 * yang sudah dipakai Tailwind lewat blok `@theme` di style.css.
 *
 * Penyimpanan berlapis: localStorage dipakai agar tema langsung tampil sebelum API menjawab
 * (tanpa kedip), lalu disamakan dengan pilihan yang tersimpan di akun (kolom `users.theme`)
 * supaya ikut berpindah antar perangkat.
 *
 * Warna dihasilkan dari satu rona (hue) memakai ruang warna OKLCH: kecerahan (L) & kroma (C)
 * tiap langkah mengikuti kurva palet Tailwind agar kontras teks tetap terjaga untuk rona apa pun.
 */
import { reactive, watchEffect } from 'vue'
import api, { TOKEN_KEY } from '@/lib/api'

const KEY = 'eklinik_theme'

// [step, lightness, chroma] — kurva langkah 50..800 (langkah 900/950 = warna primary, diatur `depth`)
const STEPS = [
  [50, 0.977, 0.013],
  [100, 0.951, 0.026],
  [200, 0.901, 0.058],
  [300, 0.828, 0.111],
  [400, 0.746, 0.16],
  [500, 0.685, 0.169],
  [600, 0.588, 0.158],
  [700, 0.5, 0.134],
  [800, 0.443, 0.11],
]

/** hue: 0-360 (rona) · chroma: 0.4-1.4 (kepekatan) · depth: 0.38-0.68 (kecerahan warna primary) */
export const DEFAULT_THEME = { hue: 245, chroma: 1, depth: 0.48 }

export const PRESETS = [
  { label: 'Biru Klinis', hue: 245, chroma: 0.95, depth: 0.5 },
  // Dua tema awal aplikasi, dipertahankan sebagai pilihan
  { label: 'Sky (tema awal)', hue: 242, chroma: 0.88, depth: 0.588 },
  { label: 'Teal (ikon awal)', hue: 185, chroma: 0.72, depth: 0.545 },
  { label: 'Indigo', hue: 268, chroma: 1, depth: 0.47 },
  { label: 'Teal', hue: 190, chroma: 0.9, depth: 0.5 },
  { label: 'Hijau Zamrud', hue: 160, chroma: 0.9, depth: 0.52 },
  { label: 'Ungu', hue: 300, chroma: 0.95, depth: 0.48 },
  { label: 'Marun', hue: 15, chroma: 0.95, depth: 0.5 },
  { label: 'Grafit', hue: 255, chroma: 0.25, depth: 0.4 },
]

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

/** Nilai tema yang sah (mengabaikan isi localStorage yang rusak / di luar rentang). */
function sanitize(value) {
  const t = { ...DEFAULT_THEME, ...(value ?? {}) }
  return {
    hue: Number.isFinite(+t.hue) ? ((+t.hue % 360) + 360) % 360 : DEFAULT_THEME.hue,
    chroma: Number.isFinite(+t.chroma) ? clamp(+t.chroma, 0, 1.4) : DEFAULT_THEME.chroma,
    depth: Number.isFinite(+t.depth) ? clamp(+t.depth, 0.38, 0.68) : DEFAULT_THEME.depth,
  }
}

/** { '--color-brand-50': 'oklch(...)', ... } untuk tema tertentu — dipakai juga oleh pratinjau. */
export function themeVars({ hue, chroma, depth }) {
  const vars = {}
  for (const [step, l, c] of STEPS) vars[`--color-brand-${step}`] = `oklch(${l} ${(c * chroma).toFixed(3)} ${hue})`
  // 900 = isian primary (tombol, tab & menu aktif), 950 = status hover-nya
  vars['--color-brand-900'] = `oklch(${depth.toFixed(3)} ${(0.155 * chroma).toFixed(3)} ${hue})`
  vars['--color-brand-950'] = `oklch(${Math.max(0.3, depth - 0.06).toFixed(3)} ${(0.14 * chroma).toFixed(3)} ${hue})`
  return vars
}

export const theme = reactive(sanitize(readStored()))

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null // JSON rusak -> pakai bawaan
  }
}

export function setTheme(value) {
  Object.assign(theme, sanitize(value))
}

let skipSync = false
let syncTimer = null

/** Pakai tema dari akun (dipanggil setelah login / fetchMe) tanpa mengirim balik ke server. */
export function applyStoredTheme(value) {
  if (!value) return
  skipSync = true
  setTheme(value)
}

/** Slider menghasilkan banyak perubahan beruntun -> kirim sekali setelah diam 600 ms. */
function syncToServer() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    // `silent` menahan progress bar; gagal simpan tidak mengganggu (localStorage tetap jadi cadangan)
    api.put('/me/theme', { ...theme }, { silent: true }).catch(() => {})
  }, 600)
}

/** Terapkan tema ke <html> & simpan. Dipanggil sekali dari main.js (sebelum mount, tanpa kedip). */
export function startTheme() {
  watchEffect(() => {
    const style = document.documentElement.style
    for (const [name, value] of Object.entries(themeVars(theme))) style.setProperty(name, value)

    try {
      localStorage.setItem(KEY, JSON.stringify(theme))
    } catch {
      // Penyimpanan penuh / mode privat: tema tetap aktif untuk sesi ini
    }

    // Perubahan yang datang dari server tidak perlu dikirim balik
    if (skipSync) skipSync = false
    else if (localStorage.getItem(TOKEN_KEY)) syncToServer()
  })
}
