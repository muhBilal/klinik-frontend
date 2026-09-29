import { ref, toValue } from 'vue'
import api, { errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'

/**
 * State halaman detail: `data`, `loading`, `error`, `load()`.
 * Gagal pada muat pertama -> `error` (ditampilkan <PageLoading> dengan tombol coba lagi);
 * gagal saat data sudah tampil -> toast, data lama tetap ditampilkan.
 */
export function useDetail(url, params = {}) {
  const toast = useToastStore()
  const data = ref(null)
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    try {
      data.value = (await api.get(toValue(url), { params: toValue(params) })).data
    } catch (e) {
      if (data.value) toast.error(errorMessage(e))
      else error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
    return data.value
  }

  return { data, loading, error, load }
}
