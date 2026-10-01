import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/lib/api'

/**
 * Identitas klinik publik dari `GET /info` (pengaturan klinik): nama, kontak, catatan kaki & lebar struk.
 * Dimuat sekali saat aplikasi dibuka; `muat(true)` setelah admin menyimpan pengaturan.
 */
export const useKlinikStore = defineStore('klinik', () => {
  const info = ref(null)
  let pending = null

  const nama = computed(() => info.value?.klinik?.nama || 'Lefaklinik')

  function muat(paksa = false) {
    if (pending && !paksa) return pending
    pending = api
      .get('/info', { silent: true })
      .then(({ data }) => (info.value = data))
      .catch(() => (pending = null))
    return pending
  }

  return { info, nama, muat }
})
