<script setup>
/**
 * Impor master resmi dari CSV (PRD v2 AD-10): ICD-10 (`kode;nama[;sensitif]`), ICD-9-CM (`kode;nama`), obat
 * (`kode;nama;satuan;harga[;jenis;no_bpom;stok_minimum]`). Idempoten: kode lama diperbarui, kode baru ditambah, tidak ada yang dihapus.
 */
import { ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'

const props = defineProps({ jenis: { type: String, required: true } })
const emit = defineEmits(['selesai'])
const toast = useToastStore()

const FORMAT = {
  icd10: 'kode;nama;sensitif (ya/kosong)',
  icd9cm: 'kode;nama',
  obat: 'kode;nama;satuan;harga;jenis (obat/skincare/bhp/alkes);no_bpom;stok_minimum',
}
const input = ref(null)
const proses = ref(false)
const hasil = ref(null)

async function pilih(e) {
  const berkas = e.target.files?.[0]
  e.target.value = ''
  if (!berkas) return
  proses.value = true
  try {
    const body = new FormData()
    body.append('berkas', berkas)
    hasil.value = (await api.post(`/impor-master/${props.jenis}`, body)).data
    emit('selesai')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    proses.value = false
  }
}
</script>

<template>
  <button type="button" class="btn btn-secondary" :disabled="proses" :title="`Format CSV: ${FORMAT[jenis]}`" @click="input?.click()">
    <AppSpinner v-if="proses" />Impor CSV
  </button>
  <input ref="input" type="file" accept=".csv,text/csv,text/plain" class="hidden" @change="pilih" />

  <AppModal :model-value="!!hasil" title="Hasil Impor" @update:model-value="hasil = null">
    <div v-if="hasil" class="space-y-3 text-sm">
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="tile"><p class="text-2xl font-semibold tabular-nums">{{ hasil.baru }}</p><p class="text-xs text-slate-500">baru</p></div>
        <div class="tile"><p class="text-2xl font-semibold tabular-nums">{{ hasil.diperbarui }}</p><p class="text-xs text-slate-500">diperbarui</p></div>
        <div class="tile"><p class="text-2xl font-semibold tabular-nums">{{ hasil.sama }}</p><p class="text-xs text-slate-500">tidak berubah</p></div>
      </div>
      <div v-if="hasil.galat.length" class="alert alert-warning">
        <p class="font-medium">{{ hasil.galat.length }} baris dilewati</p>
        <ul class="mt-1 max-h-48 overflow-y-auto text-xs">
          <li v-for="g in hasil.galat" :key="g.baris">Baris {{ g.baris }}: {{ g.pesan }}</li>
        </ul>
      </div>
      <p class="text-xs text-slate-500">Format: {{ FORMAT[jenis] }}. Kode yang tidak ada di berkas tidak dihapus.</p>
    </div>
    <template #footer><button class="btn btn-primary" @click="hasil = null">Tutup</button></template>
  </AppModal>
</template>
