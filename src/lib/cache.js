import api from '@/lib/api'

/**
 * Cache in-memory untuk data referensi yang jarang berubah (poli, dokter) agar tidak diminta ulang
 * setiap pindah halaman. Hilang saat reload browser; dihapus manual lewat `invalidate()` setelah data master diubah.
 */
const TTL = 5 * 60 * 1000
const store = new Map()

export function cachedGet(url, params = {}) {
  const key = `${url}?${new URLSearchParams(params)}`
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.promise

  const promise = api.get(url, { params }).then((r) => r.data)
  store.set(key, { at: Date.now(), promise })
  promise.catch(() => store.delete(key)) // jangan cache kegagalan
  return promise
}

/** Hapus cache yang URL-nya diawali salah satu prefix, mis. invalidate('/polis', '/dokters'). */
export function invalidate(...prefixes) {
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) store.delete(key)
  }
}

export const getPolisAktif = () => cachedGet('/polis', { aktif: 1 })
export const getDokters = () => cachedGet('/dokters')
