<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import PasienFormModal from '@/components/PasienFormModal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { getDokters, getPolisAktif } from '@/lib/cache'
import { PENJAMIN, STATUS_KUNJUNGAN, hariIni, jam, jenisKelamin, tanggal, toOptions } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const toast = useToastStore()

const polis = ref([])
const dokters = ref([])
const refLoading = ref(true)
const pasien = ref(null)
const pasienLoading = ref(false)
const pasienBaruOpen = ref(false)
const tiket = ref(null)
const errors = ref({})
const saving = ref(false)
const cancelling = ref(null)

const form = reactive({ poli_id: '', dokter_id: '', penjamin: 'umum', no_penjamin: '', keluhan: '' })

const { items: kunjungans, loading, filters, load, search, isFiltered, reset } = useList('/kunjungans', {
  tanggal: hariIni(),
  poli_id: '',
  status: '',
  penjamin: '',
  q: '',
})
const opsiPoli = computed(() => polis.value.map((p) => ({ value: p.id, label: p.nama })))

const doktersPoli = computed(() => dokters.value.filter((d) => d.poli_id === Number(form.poli_id)))

watch(() => form.poli_id, () => {
  form.dokter_id = doktersPoli.value.length === 1 ? doktersPoli.value[0].id : ''
})

watch(() => form.penjamin, (penjamin) => {
  form.no_penjamin = penjamin === 'bpjs' ? pasien.value?.no_bpjs ?? '' : ''
})

function pilihPasien(p) {
  pasien.value = p
  errors.value = {}
  if (form.penjamin === 'bpjs') form.no_penjamin = p.no_bpjs ?? ''
}

async function daftar() {
  if (!pasien.value) return toast.error('Pilih pasien terlebih dahulu.')
  saving.value = true
  errors.value = {}
  try {
    const payload = { ...form, pasien_id: pasien.value.id, dokter_id: form.dokter_id || null, no_penjamin: form.no_penjamin || null }
    const { data } = await api.post('/kunjungans', payload)
    tiket.value = data
    toast.success(`${data.pasien.nama} terdaftar di ${data.poli.nama}, antrian nomor ${data.no_antrian}.`)
    pasien.value = null
    Object.assign(form, { penjamin: 'umum', no_penjamin: '', keluhan: '' })
    load()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function batal(k) {
  if (!confirm(`Batalkan kunjungan ${k.pasien.nama} (antrian ${k.poli.kode}-${k.no_antrian})?`)) return
  cancelling.value = k.id
  try {
    await api.post(`/kunjungans/${k.id}/batal`)
    k.status = 'batal' // cukup ubah baris ini, tidak perlu memuat ulang daftar
    toast.success('Kunjungan dibatalkan.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    cancelling.value = null
  }
}

async function loadReferensi() {
  try {
    const [p, d] = await Promise.all([getPolisAktif(), getDokters()])
    polis.value = p
    dokters.value = d
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    refLoading.value = false
  }
}

async function loadPasienDariQuery() {
  pasienLoading.value = true
  try {
    // ringkas=1: cukup identitas, tanpa riwayat kunjungan
    pasien.value = (await api.get(`/pasiens/${route.query.pasien_id}`, { params: { ringkas: 1 } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    pasienLoading.value = false
  }
}

// Semua dimuat paralel
onMounted(() => {
  loadReferensi()
  if (route.query.pasien_id) loadPasienDariQuery()
  load()
})
</script>

<template>
  <PageHeader title="Pendaftaran Kunjungan" subtitle="Daftarkan pasien ke poli dan terbitkan nomor antrian" />

  <div class="grid gap-5 xl:grid-cols-5">
    <form class="card self-start xl:col-span-2" @submit.prevent="daftar">
      <div class="card-header"><h2 class="card-title">Form Pendaftaran</h2></div>
      <div class="card-body space-y-4">
        <div>
          <label class="label">Pasien *</label>
          <div v-if="pasienLoading" class="flex items-center gap-2 rounded-xl border border-white/70 bg-white/40 p-3 text-sm text-slate-500">
            <AppSpinner class="text-brand-600" /> Memuat data pasien...
          </div>
          <div v-else-if="pasien" class="flex items-start justify-between gap-3 rounded-xl border border-brand-300/50 bg-brand-500/10 p-3">
            <div class="text-sm">
              <p class="font-semibold">{{ pasien.nama }}</p>
              <p class="text-slate-600">RM {{ pasien.no_rm }} · {{ jenisKelamin(pasien.jenis_kelamin) }} · {{ pasien.umur }}</p>
              <p v-if="pasien.alergi" class="mt-1 text-xs font-medium text-rose-600">Alergi: {{ pasien.alergi }}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" @click="pasien = null">Ganti</button>
          </div>
          <div v-else class="flex gap-2">
            <div class="flex-1">
              <AsyncSelect endpoint="/pasiens" placeholder="Cari nama / No. RM / NIK..." @select="pilihPasien">
                <template #default="{ item }">
                  <p class="font-medium">{{ item.nama }} <span class="tabular-nums text-xs text-slate-500">· {{ item.no_rm }}</span></p>
                  <p class="text-xs text-slate-500">{{ jenisKelamin(item.jenis_kelamin) }}, {{ item.umur }} · {{ item.alamat ?? '-' }}</p>
                </template>
              </AsyncSelect>
            </div>
            <button type="button" class="btn btn-secondary" @click="pasienBaruOpen = true">+ Baru</button>
          </div>
          <p v-if="errors.pasien_id" class="field-error">{{ errors.pasien_id }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label">Poli tujuan *</label>
            <select v-model="form.poli_id" class="input" :class="{ 'input-error': errors.poli_id }" :disabled="refLoading" required>
              <option value="" disabled>{{ refLoading ? 'Memuat poli...' : 'Pilih poli' }}</option>
              <option v-for="p in polis" :key="p.id" :value="p.id">{{ p.nama }}</option>
            </select>
            <p v-if="errors.poli_id" class="field-error">{{ errors.poli_id }}</p>
          </div>
          <div>
            <label class="label">Dokter</label>
            <select v-model="form.dokter_id" class="input" :disabled="!form.poli_id">
              <option value="">Dokter jaga</option>
              <option v-for="d in doktersPoli" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="label">Penjamin *</label>
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="(label, key) in PENJAMIN"
              :key="key"
              :class="{ 'choice-active': form.penjamin === key }"
              class="choice"
            >
              <input v-model="form.penjamin" type="radio" :value="key" class="sr-only" />{{ label }}
            </label>
          </div>
        </div>
        <div v-if="form.penjamin !== 'umum'">
          <label class="label">No. kartu {{ PENJAMIN[form.penjamin] }} *</label>
          <input v-model="form.no_penjamin" class="input" :class="{ 'input-error': errors.no_penjamin }" />
          <p v-if="errors.no_penjamin" class="field-error">{{ errors.no_penjamin }}</p>
        </div>
        <div>
          <label class="label">Keluhan utama</label>
          <textarea v-model="form.keluhan" rows="2" class="input" placeholder="Contoh: demam sejak 3 hari" />
        </div>
        <button type="submit" class="btn btn-primary w-full" :disabled="saving || !pasien">
          <AppSpinner v-if="saving" />{{ saving ? 'Mendaftarkan...' : 'Daftarkan & Ambil Antrian' }}
        </button>
      </div>
    </form>

    <div class="card xl:col-span-3">
      <div class="card-header flex-col items-stretch">
        <h2 class="card-title flex items-center gap-2">Kunjungan {{ tanggal(filters.tanggal) }} <AppSpinner v-if="loading" class="text-slate-400" /></h2>
        <div class="filter-bar">
          <input v-model="filters.q" type="search" class="input w-48 py-1.5" placeholder="Nama / No. RM" @input="search" />
          <input v-model="filters.tanggal" type="date" :class="{ 'filter-active': filters.tanggal !== hariIni() }" class="filter" aria-label="Tanggal" @change="load()" />
          <FilterSelect v-model="filters.poli_id" placeholder="Semua poli" :options="opsiPoli" @change="load()" />
          <FilterSelect v-model="filters.status" placeholder="Semua status" :options="toOptions(STATUS_KUNJUNGAN)" @change="load()" />
          <FilterSelect v-model="filters.penjamin" placeholder="Semua penjamin" :options="toOptions(PENJAMIN)" @change="load()" />
          <button v-if="isFiltered" class="btn btn-ghost btn-sm" @click="reset()">Reset filter</button>
        </div>
      </div>
      <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && kunjungans.length }">
        <table class="table">
          <thead>
            <tr><th>Antrian</th><th>Pasien</th><th>Poli / Dokter</th><th>Penjamin</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            <TableSkeleton v-if="loading && !kunjungans.length" :cols="6" />
            <tr v-for="k in kunjungans" :key="k.id">
              <td class="tabular-nums font-semibold text-brand-700">{{ k.poli.kode }}-{{ String(k.no_antrian).padStart(3, '0') }}</td>
              <td>
                <p class="font-medium">{{ k.pasien.nama }}</p>
                <p class="text-xs text-slate-500">RM {{ k.pasien.no_rm }} · daftar {{ jam(k.created_at) }}</p>
              </td>
              <td>
                <p>{{ k.poli.nama }}</p>
                <p class="text-xs text-slate-500">{{ k.dokter?.name ?? 'Dokter jaga' }}</p>
              </td>
              <td>{{ PENJAMIN[k.penjamin] }}</td>
              <td><StatusBadge :status="k.status" /></td>
              <td class="text-right whitespace-nowrap">
                <button class="btn btn-ghost btn-sm" @click="tiket = k">Tiket</button>
                <button v-if="k.status === 'menunggu'" class="btn btn-ghost btn-sm text-rose-600" :disabled="cancelling === k.id" @click="batal(k)">
                  <AppSpinner v-if="cancelling === k.id" size="size-3" />Batal
                </button>
              </td>
            </tr>
            <tr v-if="!loading && !kunjungans.length">
              <td colspan="6" class="py-10 text-center text-slate-400">{{ isFiltered ? 'Tidak ada kunjungan yang cocok dengan filter.' : 'Belum ada kunjungan.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <PasienFormModal v-model="pasienBaruOpen" @saved="pilihPasien" />

  <AppModal :model-value="!!tiket" title="Tiket Antrian" size="max-w-xs" @update:model-value="tiket = null">
    <div v-if="tiket" id="tiket" class="text-center">
      <p class="text-xs tracking-widest text-slate-500 uppercase">E-Klinik · {{ tiket.poli.nama }}</p>
      <p class="my-3 tabular-nums text-5xl font-bold text-brand-700">{{ tiket.poli.kode }}-{{ String(tiket.no_antrian).padStart(3, '0') }}</p>
      <p class="font-medium">{{ tiket.pasien.nama }}</p>
      <p class="text-sm text-slate-500">RM {{ tiket.pasien.no_rm }} · {{ PENJAMIN[tiket.penjamin] }}</p>
      <p class="mt-2 text-xs text-slate-400">{{ tiket.no_registrasi }} · {{ tanggal(tiket.tanggal) }}</p>
    </div>
    <template #footer>
      <button class="btn btn-primary" @click="printElement('#tiket', 'Tiket Antrian')">Cetak</button>
    </template>
  </AppModal>
</template>
