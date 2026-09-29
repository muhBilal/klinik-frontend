<script setup>
/**
 * Kotak pencarian dengan dropdown hasil dari endpoint API (paginated Laravel).
 * Emit `select` saat item dipilih; input dikosongkan kembali kecuali `keepLabel`.
 */
import { ref, watch } from 'vue'
import api from '@/lib/api'
import { debounce } from '@/lib/format'

const props = defineProps({
  endpoint: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
  placeholder: { type: String, default: 'Ketik untuk mencari...' },
  itemKey: { type: String, default: 'id' },
  disabled: { type: Boolean, default: false },
  minChars: { type: Number, default: 1 },
})
const emit = defineEmits(['select'])

const query = ref('')
const results = ref([])
const open = ref(false)
const loading = ref(false)
const highlighted = ref(0)

const search = debounce(async (q) => {
  if (q.trim().length < props.minChars) {
    results.value = []
    return
  }
  loading.value = true
  try {
    const { data } = await api.get(props.endpoint, { params: { ...props.params, q, per_page: 10 } })
    results.value = Array.isArray(data) ? data : data.data
    highlighted.value = 0
    open.value = true
  } finally {
    loading.value = false
  }
}, 250)

watch(query, (q) => search(q))

function choose(item) {
  emit('select', item)
  query.value = ''
  results.value = []
  open.value = false
}

function onBlur() {
  setTimeout(() => (open.value = false), 150)
}

function onKeydown(e) {
  if (!open.value || !results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlighted.value = (highlighted.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlighted.value = (highlighted.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    choose(results.value[highlighted.value])
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="relative">
    <input
      v-model="query"
      type="search"
      class="input pr-8"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      @keydown="onKeydown"
      @focus="results.length && (open = true)"
      @blur="onBlur"
    />
    <span v-if="loading" class="absolute top-2.5 right-3 size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
    <ul v-if="open" class="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
      <li v-if="!results.length" class="px-3 py-2 text-sm text-slate-400">Tidak ada hasil</li>
      <li
        v-for="(item, i) in results"
        :key="item[itemKey]"
        :class="i === highlighted ? 'bg-brand-50' : ''"
        class="cursor-pointer px-3 py-2 text-sm hover:bg-brand-50"
        @mousedown.prevent="choose(item)"
        @mouseenter="highlighted = i"
      >
        <slot :item="item">{{ item.nama ?? item.name }}</slot>
      </li>
    </ul>
  </div>
</template>
