import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { CABANG_KEY, TOKEN_KEY } from '@/lib/api'
import { invalidate } from '@/lib/cache'

/** Data sesi tab (mis. halaman terakhir per modul) tidak boleh terbawa ke pengguna berikutnya di perangkat bersama. */
export function lupakanSesiTab() {
  try {
    sessionStorage.clear()
  } catch {
    /* storage diblokir */
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY))
  const user = ref(null)
  /** Id cabang aktif (string) untuk user lintas cabang; '' = semua cabang. User terikat cabang: selalu cabangnya. */
  const cabangAktif = ref(localStorage.getItem(CABANG_KEY) ?? '')

  const isLoggedIn = computed(() => !!token.value)
  const izin = computed(() => new Set(user.value?.izin ?? []))
  const lintasCabang = computed(() => !!user.value && !user.value.cabang_id)
  const cabangs = computed(() => user.value?.cabangs ?? [])
  const cabang = computed(() => cabangs.value.find((c) => String(c.id) === String(cabangAktif.value)) ?? null)
  /** Peran wajib 2FA tetapi belum mengaktifkannya: hanya halaman profil yang boleh dibuka. */
  const perlu2fa = computed(() => !!user.value?.two_factor?.wajib && !user.value?.two_factor?.aktif)

  /** Punya salah satu izin (sama dengan middleware `izin:` di backend; administrator memegang semua izin). */
  function can(...kode) {
    return kode.some((k) => izin.value.has(k))
  }

  function setUser(data) {
    user.value = data
    // Sinkronkan cabang aktif dengan cabang yang boleh diakses
    if (data.cabang_id) setCabang(String(data.cabang_id))
    else if (cabangAktif.value && !data.cabangs.some((c) => String(c.id) === String(cabangAktif.value))) setCabang('')
  }

  function setCabang(id) {
    cabangAktif.value = id ? String(id) : ''
    if (cabangAktif.value) localStorage.setItem(CABANG_KEY, cabangAktif.value)
    else localStorage.removeItem(CABANG_KEY)
    invalidate('/') // data referensi (dokter, poli) bisa berbeda per cabang
  }

  function simpanToken(data) {
    token.value = data.token
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
  }

  /** @returns {Promise<{ tantangan?: string }>} `tantangan` terisi bila akun memakai 2FA (lanjut ke login2fa). */
  async function login(email, password) {
    const { data } = await api.post('/login', { email, password, device_name: navigator.userAgent.slice(0, 100) })
    if (data.two_factor) return { tantangan: data.tantangan }
    simpanToken(data)
    return {}
  }

  async function login2fa(tantangan, kode) {
    const { data } = await api.post('/login/2fa', { tantangan, kode })
    simpanToken(data)
  }

  async function fetchMe() {
    const { data } = await api.get('/me')
    setUser(data)
  }

  async function logout() {
    try {
      await api.post('/logout')
    } finally {
      clear()
    }
  }

  function clear() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    lupakanSesiTab()
  }

  return {
    token, user, cabangAktif, isLoggedIn, izin, lintasCabang, cabangs, cabang, perlu2fa,
    can, setCabang, login, login2fa, fetchMe, logout, clear,
  }
})
