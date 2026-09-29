import { reactive, ref } from 'vue'
import api, { errorMessage } from '@/lib/api'
import { debounce } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

/**
 * State list + filter untuk endpoint index Laravel (paginated maupun array biasa).
 */
export function useList(endpoint, initialFilters = {}) {
  const toast = useToastStore()
  const items = ref([])
  const meta = ref(null)
  const loading = ref(false)
  const filters = reactive({ ...initialFilters })

  async function load(page = 1) {
    loading.value = true
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v !== '' && v !== null && v !== undefined))
      const { data } = await api.get(endpoint, { params })
      if (Array.isArray(data)) {
        items.value = data
        meta.value = null
      } else {
        items.value = data.data
        meta.value = { current_page: data.current_page, last_page: data.last_page, from: data.from, to: data.to, total: data.total }
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      loading.value = false
    }
  }

  const reload = () => load(meta.value?.current_page ?? 1)
  const search = debounce(() => load(1), 350)

  return { items, meta, loading, filters, load, reload, search }
}
