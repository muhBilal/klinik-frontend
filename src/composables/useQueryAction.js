import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Jalankan aksi sekali saat URL berisi `?{key}=...` (mis. `?baru=1` dari command palette),
 * lalu hapus parameternya agar refresh tidak menjalankannya lagi.
 */
export function useQueryAction(key, action) {
  const route = useRoute()
  const router = useRouter()

  watch(
    () => route.query[key],
    (value) => {
      if (!value) return
      action(value)
      const { [key]: _, ...query } = route.query
      router.replace({ query })
    },
    { immediate: true },
  )
}
