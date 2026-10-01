<script setup>
/**
 * Kotak pencarian dengan dropdown hasil dari endpoint API (paginated Laravel).
 * Emit `select` saat item dipilih; input dikosongkan kembali kecuali `keepLabel`.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { isCanceled } from '@/lib/api'
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
let controller = null

const search = debounce(async (q) => {
  controller?.abort()
  if (q.trim().length < props.minChars) {
    results.value = []
    loading.value = false
    return
  }
  const current = (controller = new AbortController())
  loading.value = true
  try {
    // simple=1: backend tidak menghitung total baris (lebih ringan untuk autocomplete)
    const { data } = await api.get(props.endpoint, { params: { ...props.params, q, per_page: 10, simple: 1 }, signal: current.signal, silent: true })
    results.value = Array.isArray(data) ? data : data.data
    highlighted.value = 0
    open.value = true
  } catch (e) {
    if (!isCanceled(e)) results.value = []
  } finally {
    if (controller === current) loading.value = false
  }
}, 250)

onBeforeUnmount(() => controller?.abort())

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
  // Enter di kotak pencarian tidak pernah mengirim form induk (hasil mungkin belum termuat)
  if (e.key === 'Enter') e.preventDefault()
  if (!open.value || !results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlighted.value = (highlighted.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlighted.value = (highlighted.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
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
    <AppSpinner v-if="loading" class="absolute top-2.5 right-3 text-brand-600" />
    <ul
      v-if="open"
      class="absolute z-30 mt-1.5 max-h-72 w-full motion-safe:animate-pop overflow-auto rounded-xl border border-white/80 bg-white/95 p-1 shadow-glass-lg backdrop-blur-xl"
    >
      <li v-if="!results.length" class="px-3 py-2 text-sm text-slate-400">Tidak ada hasil</li>
      <li
        v-for="(item, i) in results"
        :key="item[itemKey]"
        :class="i === highlighted ? 'bg-brand-500/10' : ''"
        class="cursor-pointer rounded-lg px-3 py-2 text-sm"
        @mousedown.prevent="choose(item)"
        @mouseenter="highlighted = i"
      >
        <slot :item="item">{{ item.nama ?? item.name }}</slot>
      </li>
    </ul>
  </div>
</template>
