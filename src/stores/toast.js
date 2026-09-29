import { defineStore } from 'pinia'
import { ref } from 'vue'

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref([])

  function push(message, type = 'success', timeout = 4000) {
    const id = nextId++
    items.value.push({ id, message, type })
    setTimeout(() => dismiss(id), timeout)
  }

  function dismiss(id) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return {
    items,
    dismiss,
    success: (message) => push(message, 'success'),
    error: (message) => push(message, 'error', 6000),
    info: (message) => push(message, 'info'),
  }
})
