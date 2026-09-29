import { computed, onScopeDispose, reactive, ref } from 'vue'
import api, { errorMessage, isCanceled } from '@/lib/api'
import { debounce } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

/**
 * State list + filter untuk endpoint index Laravel (paginated maupun array biasa).
 * Request sebelumnya dibatalkan bila ada request baru (ketik cepat, ganti tab) atau halaman ditutup.
 */
export function useList(endpoint, initialFilters = {}) {
  const toast = useToastStore()
  const items = ref([])
  const meta = ref(null)
  const loading = ref(false)
  const filters = reactive({ ...initialFilters })
  let controller = null

  /** `silent`: segarkan di latar belakang tanpa indikator loading (auto-refresh). */
  async function load(page = 1, { silent = false } = {}) {
    controller?.abort()
    const current = (controller = new AbortController())
    if (!silent) loading.value = true
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v !== '' && v !== null && v !== undefined))
      const { data } = await api.get(endpoint, { params, signal: current.signal, silent })
      if (Array.isArray(data)) {
        items.value = data
        meta.value = null
      } else {
        items.value = data.data
        meta.value = { current_page: data.current_page, last_page: data.last_page, from: data.from, to: data.to, total: data.total }
      }
    } catch (e) {
      if (!isCanceled(e) && !silent) toast.error(errorMessage(e))
    } finally {
      if (controller === current) {
        loading.value = false
        controller = null
      }
    }
  }

  const reload = (options) => load(meta.value?.current_page ?? 1, options)
  const search = debounce(() => load(1), 350)

  // Filter berbeda dari nilai awal → tampilkan tombol "Reset"
  const isFiltered = computed(() => Object.keys(initialFilters).some((key) => (filters[key] ?? '') !== (initialFilters[key] ?? '')))
  function reset() {
    Object.assign(filters, initialFilters)
    return load(1)
  }

  onScopeDispose(() => controller?.abort())

  return { items, meta, loading, filters, load, reload, search, isFiltered, reset }
}
