<script setup>
/**
 * Halaman CRUD generik untuk master data.
 * columns: [{ key, label, format?(value, row), class? }]
 * fields:  [{ key, label, type, options?, required?, full?, placeholder? }]
 * Event `changed` setelah data tersimpan/terhapus.
 */
import { onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { invalidate } from '@/lib/cache'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  endpoint: { type: String, required: true },
  columns: { type: Array, required: true },
  fields: { type: Array, required: true },
  defaults: { type: Object, default: () => ({}) },
  searchable: { type: Boolean, default: true },
  itemLabel: { type: String, default: 'data' },
  /** Prefix cache data referensi yang harus dibuang setelah data berubah (lihat lib/cache.js). */
  invalidates: { type: Array, default: () => [] },
})

const emit = defineEmits(['changed'])
const toast = useToastStore()
const { items, meta, loading, filters, load, reload, search } = useList(props.endpoint, { q: '' })

const open = ref(false)
const editing = ref(null)
const form = reactive({})
const errors = ref({})
const saving = ref(false)
const deleting = ref(null)

function changed() {
  invalidate(props.endpoint, ...props.invalidates)
  reload()
  emit('changed')
}

function buka(row = null) {
  editing.value = row
  errors.value = {}
  for (const key of Object.keys(form)) delete form[key]
  const base = { ...props.defaults }
  for (const f of props.fields) base[f.key] = row ? row[f.key] ?? base[f.key] ?? '' : base[f.key] ?? (f.type === 'checkbox' ? true : '')
  if (row) for (const f of props.fields.filter((f) => f.type === 'password')) base[f.key] = ''
  Object.assign(form, base)
  open.value = true
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    if (editing.value) await api.put(`${props.endpoint}/${editing.value.id}`, payload)
    else await api.post(props.endpoint, payload)
    toast.success(`${props.itemLabel[0].toUpperCase()}${props.itemLabel.slice(1)} tersimpan.`)
    open.value = false
    changed()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function hapus(row) {
  if (!confirm(`Hapus ${props.itemLabel} "${row.nama ?? row.name ?? row.kode}"?`)) return
  deleting.value = row.id
  try {
    await api.delete(`${props.endpoint}/${row.id}`)
    toast.success(`${props.itemLabel} dihapus.`)
    changed()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = null
  }
}

onMounted(() => load())
</script>

<template>
  <PageHeader :title="title" :subtitle="subtitle">
    <button class="btn btn-primary" @click="buka()">+ Tambah {{ itemLabel }}</button>
  </PageHeader>

  <div class="card">
    <div v-if="searchable" class="card-header">
      <input v-model="filters.q" type="search" class="input max-w-sm" placeholder="Cari..." @input="search" />
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :class="c.class">{{ c.label }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="columns.length + 1" />
          <tr v-for="row in items" :key="row.id">
            <td v-for="c in columns" :key="c.key" :class="c.class">
              <slot :name="`cell-${c.key}`" :row="row">{{ c.format ? c.format(row[c.key], row) : row[c.key] ?? '-' }}</slot>
            </td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="buka(row)">Ubah</button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === row.id" @click="hapus(row)">
                <AppSpinner v-if="deleting === row.id" size="size-3" />Hapus
              </button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td :colspan="columns.length + 1" class="py-10 text-center text-slate-400">Belum ada data.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <AppModal v-model="open" :title="`${editing ? 'Ubah' : 'Tambah'} ${itemLabel}`">
    <form id="form-master" class="grid gap-4 sm:grid-cols-2" @submit.prevent="simpan">
      <template v-for="f in fields" :key="f.key">
        <label v-if="f.type === 'checkbox'" class="flex items-center gap-2 text-sm sm:col-span-2">
          <input v-model="form[f.key]" type="checkbox" class="accent-brand-600" /> {{ f.label }}
        </label>
        <div v-else-if="!f.show || f.show(form)" :class="{ 'sm:col-span-2': f.full }">
          <label class="label">{{ f.label }}{{ f.required && !(f.type === 'password' && editing) ? ' *' : '' }}</label>
          <select v-if="f.type === 'select'" v-model="form[f.key]" class="input" :class="{ 'input-error': errors[f.key] }" :required="f.required">
            <option value="">— Pilih —</option>
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <input
            v-else
            v-model="form[f.key]"
            :type="f.type ?? 'text'"
            :min="f.type === 'number' ? 0 : undefined"
            :placeholder="f.type === 'password' && editing ? 'Kosongkan jika tidak diubah' : f.placeholder"
            :required="f.required && !(f.type === 'password' && editing)"
            class="input"
            :class="{ 'input-error': errors[f.key] }"
          />
          <p v-if="errors[f.key]" class="field-error">{{ errors[f.key] }}</p>
        </div>
      </template>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-master" class="btn btn-primary" :disabled="saving">
        <AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}
      </button>
    </template>
  </AppModal>
</template>
