<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage } from '@/lib/api'
import { PENJAMIN, hariIni, jam, jenisKelamin } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const polis = ref([])

const TABS = [
  { value: 'menunggu,diperiksa', label: 'Dalam antrian' },
  { value: 'menunggu_pembayaran,selesai', label: 'Selesai diperiksa' },
  { value: '', label: 'Semua' },
]

const { items, loading, filters, load } = useList('/kunjungans', {
  tanggal: hariIni(),
  poli_id: auth.user?.poli_id ?? '',
  dokter_id: '',
  status: TABS[0].value,
  q: '',
})

async function panggil(k) {
  try {
    await api.post(`/kunjungans/${k.id}/panggil`)
    toast.success(`Memanggil ${k.pasien.nama} (antrian ${k.no_antrian}).`)
    router.push(`/pemeriksaan/${k.id}`)
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

let timer
onMounted(async () => {
  polis.value = (await api.get('/polis', { params: { aktif: 1 } })).data
  load()
  // Segarkan antrian otomatis setiap 30 detik
  timer = setInterval(() => load(), 30000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <PageHeader title="Antrian Poli" subtitle="Panggil pasien dan lakukan pemeriksaan">
    <button class="btn btn-secondary" :disabled="loading" @click="load()">Muat ulang</button>
  </PageHeader>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="flex gap-1">
        <button v-for="t in TABS" :key="t.value" :class="{ 'tab-active': filters.status === t.value }" class="tab" @click="filters.status = t.value; load()">{{ t.label }}</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <input v-model="filters.tanggal" type="date" class="input w-auto py-1.5" @change="load()" />
        <select v-model="filters.poli_id" class="input w-auto py-1.5" @change="load()">
          <option value="">Semua poli</option>
          <option v-for="p in polis" :key="p.id" :value="p.id">{{ p.nama }}</option>
        </select>
        <label v-if="auth.user?.role === 'dokter'" class="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" class="accent-brand-600" :checked="!!filters.dokter_id" @change="filters.dokter_id = $event.target.checked ? auth.user.id : ''; load()" />
          Pasien saya saja
        </label>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr><th>No.</th><th>Pasien</th><th>Keluhan</th><th>Penjamin</th><th>Dokter</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="k in items" :key="k.id" :class="{ 'bg-sky-50/40': k.status === 'diperiksa' }">
            <td class="font-mono text-lg font-semibold text-brand-700">{{ k.no_antrian }}</td>
            <td>
              <p class="font-medium">{{ k.pasien.nama }}</p>
              <p class="text-xs text-slate-500">RM {{ k.pasien.no_rm }} · {{ jenisKelamin(k.pasien.jenis_kelamin) }} · {{ k.poli.nama }} · {{ jam(k.created_at) }}</p>
            </td>
            <td class="max-w-56 truncate text-slate-600" :title="k.keluhan">{{ k.keluhan ?? '-' }}</td>
            <td>{{ PENJAMIN[k.penjamin] }}</td>
            <td class="text-slate-600">{{ k.dokter?.name ?? '-' }}</td>
            <td><StatusBadge :status="k.status" /></td>
            <td class="text-right whitespace-nowrap">
              <template v-if="k.status === 'menunggu'">
                <RouterLink v-if="auth.user?.role === 'perawat'" :to="`/pemeriksaan/${k.id}`" class="btn btn-secondary btn-sm">Isi TTV</RouterLink>
                <button class="btn btn-primary btn-sm" @click="panggil(k)">Panggil</button>
              </template>
              <RouterLink v-else-if="k.status === 'diperiksa'" :to="`/pemeriksaan/${k.id}`" class="btn btn-primary btn-sm">Lanjutkan</RouterLink>
              <RouterLink v-else :to="`/kunjungan/${k.id}`" class="btn btn-ghost btn-sm">Lihat</RouterLink>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" class="py-10 text-center text-slate-400">Tidak ada pasien pada antrian ini.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
