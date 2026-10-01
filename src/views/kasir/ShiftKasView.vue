<script setup>
/**
 * Shift kas kasir (PRD BL-05): buka dengan modal awal, rekap per metode bayar, tutup dengan hitung kas fisik → selisih.
 * Riwayat shift cabang aktif di bawahnya; klik untuk melihat & mencetak rekap.
 */
import { computed, onMounted, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { METODE_BAYAR, rupiah, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const klinik = useKlinikStore()
const toast = useToastStore()

const aktif = ref(null)
const aktifLoading = ref(true)
const errors = ref({})
const saving = ref(false)
const modalAwal = ref(0)
const kasFisik = ref('')
const catatan = ref('')
const tutupOpen = ref(false)

const { items, meta, loading, load } = useList('/shift-kas', { kasir_id: '' })

async function muatAktif() {
  aktifLoading.value = true
  try {
    const { data } = await api.get('/shift-kas/aktif')
    aktif.value = data?.id ? data : null
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    aktifLoading.value = false
  }
}

async function buka() {
  saving.value = true
  errors.value = {}
  try {
    aktif.value = (await api.post('/shift-kas', { modal_awal: Number(modalAwal.value || 0) })).data
    toast.success('Shift kas dibuka.')
    load(1)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

const selisih = computed(() => (kasFisik.value === '' ? null : Number(kasFisik.value) - (aktif.value?.rekap?.kas_seharusnya ?? 0)))

async function bukaTutup() {
  await muatAktif() // rekap terbaru sebelum menghitung kas
  kasFisik.value = ''
  catatan.value = ''
  errors.value = {}
  tutupOpen.value = true
}

async function tutup() {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.post(`/shift-kas/${aktif.value.id}/tutup`, { kas_fisik: Number(kasFisik.value), catatan: catatan.value || null })
    toast.success(`Shift ditutup. Selisih ${rupiah(data.selisih)}.`)
    tutupOpen.value = false
    aktif.value = null
    lihat.value = data
    load(1)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

// Detail / cetak rekap shift
const lihat = ref(null)
const lihatLoading = ref(null)
async function bukaDetail(row) {
  lihatLoading.value = row.id
  try {
    lihat.value = (await api.get(`/shift-kas/${row.id}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    lihatLoading.value = null
  }
}
const lihatOpen = computed({ get: () => !!lihat.value, set: (v) => !v && (lihat.value = null) })

const warnaSelisih = (v) => (v === null || v === undefined ? '' : v < 0 ? 'text-rose-600' : v > 0 ? 'text-amber-700' : 'text-emerald-700')

onMounted(() => {
  muatAktif()
  load()
})
</script>

<template>
  <PageHeader title="Shift Kas" :subtitle="`Buka & tutup kas harian kasir${auth.cabang ? ` · ${auth.cabang.nama}` : ''}`">
    <RouterLink to="/kasir" class="btn btn-secondary">Ke kasir</RouterLink>
  </PageHeader>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-5">
    <div class="card self-start lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Shift saya</h2><AppSpinner v-if="aktifLoading" class="text-slate-400" /></div>
      <div v-if="aktif" class="card-body space-y-4 text-sm">
        <p class="text-slate-600">Dibuka {{ waktu(aktif.dibuka_at) }} · modal awal <b class="tabular-nums">{{ rupiah(aktif.modal_awal) }}</b></p>
        <table class="table">
          <thead><tr><th>Metode</th><th class="text-right">Transaksi</th><th class="text-right">Total</th></tr></thead>
          <tbody>
            <tr v-for="m in aktif.rekap.per_metode" :key="m.metode">
              <td>{{ METODE_BAYAR[m.metode] ?? m.metode }}</td>
              <td class="text-right tabular-nums">{{ m.jumlah_transaksi }}</td>
              <td class="text-right tabular-nums">{{ rupiah(m.total) }}</td>
            </tr>
            <tr v-if="!aktif.rekap.per_metode.length"><td colspan="3" class="py-4 text-center text-slate-400">Belum ada pembayaran di shift ini.</td></tr>
          </tbody>
        </table>
        <dl class="space-y-1">
          <div class="flex justify-between"><dt class="text-slate-500">Total diterima</dt><dd class="tabular-nums">{{ rupiah(aktif.rekap.total) }}</dd></div>
          <div v-if="aktif.rekap.total_refund" class="flex justify-between"><dt class="text-slate-500">Refund</dt><dd class="tabular-nums">-{{ rupiah(aktif.rekap.total_refund) }}</dd></div>
          <div class="flex justify-between font-semibold"><dt>Kas seharusnya di laci</dt><dd class="tabular-nums">{{ rupiah(aktif.rekap.kas_seharusnya) }}</dd></div>
        </dl>
        <div class="flex gap-2">
          <button class="btn btn-secondary" @click="muatAktif">Segarkan</button>
          <button class="btn btn-primary flex-1" @click="bukaTutup">Tutup shift</button>
        </div>
      </div>
      <form v-else-if="!aktifLoading" class="card-body space-y-3" @submit.prevent="buka">
        <p class="text-sm text-slate-600">Belum ada shift terbuka. Hitung uang di laci kas sebagai modal awal.</p>
        <div>
          <label class="label" for="modal-awal">Modal awal (Rp)</label>
          <input id="modal-awal" v-model.number="modalAwal" type="number" min="0" class="input text-lg" :class="{ 'input-error': errors.modal_awal || errors.shift }" />
          <p v-if="errors.modal_awal || errors.shift" class="field-error">{{ errors.modal_awal || errors.shift }}</p>
        </div>
        <button class="btn btn-primary w-full" :disabled="saving"><AppSpinner v-if="saving" />Buka shift</button>
      </form>
    </div>

    <div class="card lg:col-span-3">
      <div class="card-header"><h2 class="card-title">Riwayat shift</h2><AppSpinner v-if="loading" class="text-slate-400" /></div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Kasir</th><th>Dibuka</th><th>Ditutup</th><th class="text-right">Modal</th><th class="text-right">Kas fisik</th><th class="text-right">Selisih</th><th /></tr></thead>
          <tbody>
            <TableSkeleton v-if="loading && !items.length" :cols="7" />
            <tr v-for="s in items" :key="s.id">
              <td>{{ s.kasir?.name }}</td>
              <td class="whitespace-nowrap text-xs">{{ waktu(s.dibuka_at) }}</td>
              <td class="whitespace-nowrap text-xs">{{ s.ditutup_at ? waktu(s.ditutup_at) : 'masih terbuka' }}</td>
              <td class="text-right tabular-nums">{{ rupiah(s.modal_awal) }}</td>
              <td class="text-right tabular-nums">{{ s.kas_fisik === null ? '-' : rupiah(s.kas_fisik) }}</td>
              <td class="text-right tabular-nums font-medium" :class="warnaSelisih(s.selisih)">{{ s.selisih === null ? '-' : rupiah(s.selisih) }}</td>
              <td class="text-right">
                <button class="btn btn-ghost btn-sm" :disabled="lihatLoading === s.id" @click="bukaDetail(s)"><AppSpinner v-if="lihatLoading === s.id" size="size-3" />Rekap</button>
              </td>
            </tr>
            <tr v-if="!loading && !items.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada shift.</td></tr>
          </tbody>
        </table>
      </div>
      <AppPagination :meta="meta" @change="load" />
    </div>
  </div>

  <AppModal v-model="tutupOpen" title="Tutup Shift Kas">
    <form id="form-tutup" class="space-y-3" @submit.prevent="tutup">
      <p class="text-sm text-slate-600">Kas seharusnya: <b class="tabular-nums">{{ rupiah(aktif?.rekap?.kas_seharusnya) }}</b> (modal awal + tunai diterima − refund tunai).</p>
      <div>
        <label class="label" for="kas-fisik">Uang fisik di laci (Rp) *</label>
        <input id="kas-fisik" v-model="kasFisik" type="number" min="0" class="input text-lg" :class="{ 'input-error': errors.kas_fisik }" required />
        <p v-if="errors.kas_fisik" class="field-error">{{ errors.kas_fisik }}</p>
      </div>
      <p v-if="selisih !== null" class="text-sm" :class="warnaSelisih(selisih)">
        Selisih {{ rupiah(selisih) }} {{ selisih < 0 ? '(uang kurang)' : selisih > 0 ? '(uang lebih)' : '(pas)' }}
      </p>
      <div>
        <label class="label" for="catatan-shift">Catatan</label>
        <input id="catatan-shift" v-model="catatan" class="input" maxlength="255" :placeholder="selisih ? 'Wajib dijelaskan bila ada selisih' : ''" />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="tutupOpen = false">Batal</button>
      <button type="submit" form="form-tutup" class="btn btn-primary" :disabled="saving || kasFisik === ''"><AppSpinner v-if="saving" />Tutup shift</button>
    </template>
  </AppModal>

  <AppModal v-model="lihatOpen" title="Rekap Shift">
    <div v-if="lihat" id="rekap-shift" class="space-y-3 text-sm">
      <div class="border-b border-dashed border-slate-300 pb-2">
        <p class="font-semibold">{{ klinik.nama }} · {{ lihat.cabang?.nama }}</p>
        <p class="text-xs text-slate-500">Rekap shift kas · {{ lihat.kasir?.name }}</p>
        <p class="text-xs text-slate-500">{{ waktu(lihat.dibuka_at) }} – {{ lihat.ditutup_at ? waktu(lihat.ditutup_at) : 'masih terbuka' }}</p>
      </div>
      <table class="table">
        <tbody>
          <tr v-for="m in lihat.rekap.per_metode" :key="m.metode">
            <td>{{ METODE_BAYAR[m.metode] ?? m.metode }} ({{ m.jumlah_transaksi }})</td>
            <td class="text-right tabular-nums">{{ rupiah(m.total) }}</td>
          </tr>
        </tbody>
      </table>
      <dl class="space-y-1">
        <div class="flex justify-between"><dt>Modal awal</dt><dd class="tabular-nums">{{ rupiah(lihat.modal_awal) }}</dd></div>
        <div class="flex justify-between"><dt>Total diterima</dt><dd class="tabular-nums">{{ rupiah(lihat.rekap.total) }}</dd></div>
        <div class="flex justify-between"><dt>Refund</dt><dd class="tabular-nums">{{ rupiah(lihat.rekap.total_refund) }}</dd></div>
        <div class="flex justify-between"><dt>Kas seharusnya</dt><dd class="tabular-nums">{{ rupiah(lihat.rekap.kas_seharusnya) }}</dd></div>
        <div class="flex justify-between"><dt>Kas fisik</dt><dd class="tabular-nums">{{ lihat.kas_fisik === null ? '-' : rupiah(lihat.kas_fisik) }}</dd></div>
        <div class="flex justify-between font-semibold" :class="warnaSelisih(lihat.selisih)"><dt>Selisih</dt><dd class="tabular-nums">{{ lihat.selisih === null ? '-' : rupiah(lihat.selisih) }}</dd></div>
      </dl>
      <p v-if="lihat.catatan" class="text-xs text-slate-600">Catatan: {{ lihat.catatan }}</p>
    </div>
    <template #footer>
      <button class="btn btn-secondary" @click="lihat = null">Tutup</button>
      <button class="btn btn-primary" @click="printElement('#rekap-shift', 'Rekap Shift', { lebar: klinik.info?.cetak?.lebar_struk })">Cetak</button>
    </template>
  </AppModal>
</template>
