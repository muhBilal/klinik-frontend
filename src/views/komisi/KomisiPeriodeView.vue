<script setup>
/** Rekap komisi per periode di cabang aktif (PRD KM-03): buat periode → hitung → penyesuaian → setujui & kunci. */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { hariIni, rupiah, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const { items, meta, loading, load } = useList('/komisi-periodes')

const formOpen = ref(false)
const form = reactive({ nama: '', mulai: '', selesai: '', catatan: '' })
const errors = ref({})
const saving = ref(false)

/** Default: bulan berjalan sampai hari ini. */
function buka() {
  const d = new Date()
  const awal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  Object.assign(form, { nama: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), mulai: awal, selesai: hariIni(), catatan: '' })
  errors.value = {}
  formOpen.value = true
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.post('/komisi-periodes', { ...form, catatan: form.catatan || null })
    toast.success('Periode dibuat. Klik "Hitung" untuk menyusun rekap.')
    router.push(`/komisi/${data.id}`)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <PageHeader title="Komisi" subtitle="Rekap komisi & jasa medis per periode dari tagihan kunjungan yang lunas; dikunci setelah disetujui">
    <RouterLink v-if="auth.can('komisi.kelola') && auth.can('master.kelola')" to="/master/tindakan" class="btn btn-secondary">Komisi per treatment</RouterLink>
    <button v-if="auth.can('komisi.kelola')" class="btn btn-primary" @click="buka">+ Periode</button>
  </PageHeader>

  <div class="card">
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead><tr><th>Periode</th><th>Rentang</th><th class="text-right">Total komisi</th><th>Dihitung</th><th>Status</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="6" />
          <tr v-for="p in items" :key="p.id">
            <td>
              <p class="font-medium">{{ p.nama }}</p>
              <p class="text-xs text-slate-500">{{ p.cabang?.nama }} · {{ p.barises_count }} baris</p>
            </td>
            <td class="whitespace-nowrap">{{ tanggal(p.mulai) }} – {{ tanggal(p.selesai) }}</td>
            <td class="text-right font-medium tabular-nums">{{ rupiah(p.total) }}</td>
            <td class="text-xs text-slate-500">{{ p.dihitung_at ? waktu(p.dihitung_at) : 'belum' }}</td>
            <td><StatusBadge :status="p.status" /></td>
            <td class="text-right"><RouterLink :to="`/komisi/${p.id}`" class="btn btn-ghost btn-sm">Buka</RouterLink></td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="6" class="py-10 text-center text-slate-400">Belum ada periode komisi di cabang ini.</td></tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <AppModal v-model="formOpen" title="Periode Komisi Baru">
    <form id="form-periode" class="space-y-4" @submit.prevent="simpan">
      <div>
        <label class="label" for="kp-nama">Nama *</label>
        <input id="kp-nama" v-model="form.nama" class="input" maxlength="100" required />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="kp-mulai">Mulai (tanggal bayar) *</label>
          <input id="kp-mulai" v-model="form.mulai" type="date" class="input" :class="{ 'input-error': errors.mulai }" required />
        </div>
        <div>
          <label class="label" for="kp-selesai">Selesai *</label>
          <input id="kp-selesai" v-model="form.selesai" type="date" class="input" :class="{ 'input-error': errors.selesai }" required />
        </div>
      </div>
      <p v-if="errors.mulai || errors.selesai" class="field-error">{{ errors.mulai || errors.selesai }}</p>
      <p class="text-xs text-slate-500">Rentang periode di cabang yang sama tidak boleh tumpang tindih, agar satu tagihan hanya masuk satu rekap.</p>
      <input v-model="form.catatan" class="input" maxlength="500" placeholder="Catatan (opsional)" />
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-periode" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Buat periode</button>
    </template>
  </AppModal>
</template>
