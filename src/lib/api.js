import axios from 'axios'

export const TOKEN_KEY = 'eklinik_token'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token kedaluwarsa / dicabut -> kembali ke login
    if (error.response?.status === 401 && !error.config.url.endsWith('/login')) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** Pesan error yang ramah untuk ditampilkan di toast. */
export function errorMessage(error) {
  const res = error?.response
  if (!res) return 'Tidak dapat terhubung ke server. Periksa koneksi atau pastikan backend berjalan.'
  if (res.status === 422 && res.data?.errors) return Object.values(res.data.errors)[0][0]
  return res.data?.message || `Terjadi kesalahan (${res.status}).`
}

/** Error validasi Laravel -> { field: 'pesan pertama' } */
export function validationErrors(error) {
  const errors = error?.response?.status === 422 ? error.response.data.errors ?? {} : {}
  return Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key, messages[0]]))
}

export default api
