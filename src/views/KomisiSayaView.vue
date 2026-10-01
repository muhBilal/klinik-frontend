<script setup>
/** Slip komisi milik petugas yang login, lintas cabang (PRD KM-03). */
import { onMounted, ref, watch } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import SlipKomisi from '@/components/komisi/SlipKomisi.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import api, { errorMessage } from '@/lib/api'
import { printElement } from '@/lib/print'

const sekarang = new Date()
const periode = ref(`${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}`)
const data = ref(null)
const loading = ref(false)
const error = ref('')

async function muat() {
  loading.value = true
  error.value = ''
  try {
    data.value = (await api.get('/komisi/rincian', { params: { periode: periode.value } })).data
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
watch(periode, muat)
onMounted(muat)
</script>

<template>
  <PageHeader title="Komisi Saya" subtitle="Komisi & jasa medis dari tindakan yang Anda kerjakan, per bulan">
    <input v-model="periode" type="month" class="input w-auto" aria-label="Periode" />
    <button v-if="data" class="btn btn-secondary" @click="printElement('#slip-komisi', 'Slip Komisi')">Cetak</button>
  </PageHeader>
  <div v-if="data" class="card">
    <div class="card-body relative">
      <AppSpinner v-if="loading" class="absolute right-5 top-5 text-slate-400" />
      <SlipKomisi :data="data" />
    </div>
  </div>
  <PageLoading v-else :error="error" text="Memuat komisi..." @retry="muat" />
</template>
