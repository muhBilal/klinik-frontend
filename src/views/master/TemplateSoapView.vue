<script setup>
/**
 * Template SOAP per spesialisasi (poli) & per treatment (PRD RM-01, DR-03). Dipakai dokter lewat tombol "Template" di
 * pemeriksaan. `akses_terbatas` menandai kunjungan yang memakai template (mis. kasus IMS) sebagai rahasia.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { OPSI_STATUS_AKTIF } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const { items, loading, filters, load, reload, search, isFiltered, reset } = useList('/template-soaps', { q: '', poli_id: '', status: '' })

const SOAP = [
  ['subjektif', 'S — Subjektif'],
  ['objektif', 'O — Objektif'],
  ['asesmen', 'A — Asesmen'],
  ['plan', 'P — Plan'],
]

const polis = ref([])
const opsiPoli = computed(() => polis.value.map((p) => ({ value: p.id, label: p.nama })))

const formOpen = ref(false)
const editing = ref(null)
const form = reactive({})
const errors = ref({})
const saving = ref(false)
const deleting = ref(null)

function buka(row = null) {
  editing.value = row
  errors.value = {}
  Object.assign(form, {
    nama: row?.nama ?? '',
    poli_id: row?.poli_id ?? (filters.poli_id || ''),
    tindakan: row?.tindakan ?? null,
    subjektif: row?.subjektif ?? '',
    objektif: row?.objektif ?? '',
    asesmen: row?.asesmen ?? '',
    plan: row?.plan ?? '',
    diagnosas: [...(row?.diagnosas ?? [])],
    akses_terbatas: row?.akses_terbatas ?? false,
    is_active: row?.is_active ?? true,
  })
  formOpen.value = true
}

function tambahDiagnosa(icd) {
  if (form.diagnosas.some((d) => d.id === icd.id)) return toast.info('Diagnosa sudah ada.')
  form.diagnosas.push(icd)
  if (icd.sensitif) form.akses_terbatas = true
}

async function simpan() {
  saving.value = true
  errors.value = {}
  const payload = {
    nama: form.nama,
    poli_id: form.poli_id || null,
    tindakan_id: form.tindakan?.id ?? null,
    ...Object.fromEntries(SOAP.map(([key]) => [key, form[key] || null])),
    icd10_ids: form.diagnosas.map((d) => d.id),
    akses_terbatas: form.akses_terbatas,
    is_active: form.is_active,
  }
  try {
    if (editing.value) await api.put(`/template-soaps/${editing.value.id}`, payload)
    else await api.post('/template-soaps', payload)
    toast.success('Template SOAP tersimpan.')
    formOpen.value = false
    reload()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function hapus(row) {
  if (!confirm(`Hapus template "${row.nama}"?`)) return
  deleting.value = row.id
  try {
    await api.delete(`/template-soaps/${row.id}`)
    toast.success('Template dihapus.')
    reload()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = null
  }
}

onMounted(async () => {
  load()
  polis.value = await cachedGet('/polis', { aktif: 1 }).catch(() => [])
})
</script>

<template>
  <PageHeader title="Template SOAP" subtitle="Template pemeriksaan per poli & treatment: isi awal S/O/A/P dan saran diagnosa">
    <button class="btn btn-primary" @click="buka()">+ Template Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="filter-bar">
        <input v-model="filters.q" type="search" class="input w-64 max-w-full py-1.5" placeholder="Cari nama template..." @input="search" />
        <FilterSelect v-model="filters.poli_id" placeholder="Semua poli" :options="opsiPoli" @change="load()" />
        <FilterSelect v-model="filters.status" placeholder="Semua status" :options="OPSI_STATUS_AKTIF" @change="load()" />
        <button v-if="isFiltered" class="btn btn-ghost btn-sm" @click="reset()">Reset filter</button>
      </div>
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead><tr><th>Template</th><th>Poli</th><th>Treatment</th><th>Saran diagnosa</th><th>Status</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="6" />
          <tr v-for="t in items" :key="t.id">
            <td>
              <p class="font-medium">{{ t.nama }}</p>
              <p v-if="t.akses_terbatas" class="text-xs text-rose-700">🔒 akses terbatas</p>
            </td>
            <td class="text-slate-600">{{ t.poli?.nama ?? 'Semua poli' }}</td>
            <td class="text-slate-600">{{ t.tindakan?.nama ?? '-' }}</td>
            <td class="text-xs tabular-nums text-slate-600">{{ t.diagnosas.map((d) => d.kode).join(', ') || '-' }}</td>
            <td><StatusBadge :status="t.is_active ? 'aktif' : 'nonaktif'" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="buka(t)">Ubah</button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === t.id" @click="hapus(t)"><AppSpinner v-if="deleting === t.id" size="size-3" />Hapus</button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="6" class="py-10 text-center text-slate-400">Belum ada template.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <AppModal v-model="formOpen" :title="editing ? 'Ubah Template SOAP' : 'Template SOAP Baru'" size="max-w-3xl">
    <form id="form-template-soap" class="space-y-4" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="ts-nama">Nama template *</label>
          <input id="ts-nama" v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" maxlength="150" required />
          <p v-if="errors.nama" class="field-error">{{ errors.nama }}</p>
        </div>
        <div>
          <label class="label" for="ts-poli">Poli / spesialisasi</label>
          <select id="ts-poli" v-model="form.poli_id" class="input">
            <option value="">Semua poli</option>
            <option v-for="p in opsiPoli" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div>
          <label class="label">Treatment terkait (opsional)</label>
          <div v-if="form.tindakan" class="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2 text-sm">
            <span class="truncate">{{ form.tindakan.nama }}</span>
            <button type="button" class="text-xs text-slate-400 hover:text-slate-700" @click="form.tindakan = null">lepas</button>
          </div>
          <AsyncSelect v-else endpoint="/tindakans" :params="{ aktif: 1 }" placeholder="Cari treatment..." @select="(t) => (form.tindakan = t)" />
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div v-for="[key, label] in SOAP" :key="key">
          <label class="label" :for="`ts-${key}`">{{ label }}</label>
          <textarea :id="`ts-${key}`" v-model="form[key]" rows="5" class="input" maxlength="5000" />
        </div>
      </div>
      <div class="space-y-2">
        <label class="label">Saran diagnosa (maks. 10)</label>
        <AsyncSelect endpoint="/icd10s" placeholder="Cari kode / nama diagnosa..." @select="tambahDiagnosa">
          <template #default="{ item }"><b class="tabular-nums">{{ item.kode }}</b> {{ item.nama }}<span v-if="item.sensitif" class="text-xs text-rose-600"> · sensitif</span></template>
        </AsyncSelect>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="(d, i) in form.diagnosas" :key="d.id" class="chip">
            <b class="tabular-nums">{{ d.kode }}</b> {{ d.nama }}
            <button type="button" class="ml-1 text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${d.kode}`" @click="form.diagnosas.splice(i, 1)">&times;</button>
          </span>
        </div>
        <p v-if="errors.icd10_ids" class="field-error">{{ errors.icd10_ids }}</p>
      </div>
      <label class="flex items-start gap-2 text-sm">
        <input v-model="form.akses_terbatas" type="checkbox" class="mt-0.5 accent-rose-600" />
        <span>Akses terbatas<span class="block text-xs text-slate-400">Kunjungan yang memakai template ini hanya dapat dibuka tim yang menangani (mis. kasus IMS).</span></span>
      </label>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif (tampil di pemeriksaan)</label>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-template-soap" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>
</template>
