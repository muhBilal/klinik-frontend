<script setup>
/**
 * Detail rekap komisi (PRD KM-03): ringkasan per petugas, rincian baris, hitung ulang (draf), penyesuaian manual, setujui & kunci,
 * slip per petugas (cetak).
 */
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import SlipKomisi from '@/components/komisi/SlipKomisi.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { PERAN_KOMISI, SUMBER_KOMISI, rupiah, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const data = ref(null)
const loadError = ref('')
const bekerja = ref('')
const filterUser = ref('')

const draf = computed(() => data.value?.status === 'draf')
const bolehKelola = computed(() => draf.value && auth.can('komisi.kelola'))
const baris = computed(() => (data.value?.barises ?? []).filter((b) => !filterUser.value || b.user_id === Number(filterUser.value)))

async function load() {
  loadError.value = ''
  try {
    data.value = (await api.get(`/komisi-periodes/${route.params.id}`)).data
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}

async function jalankan(kunci, promise, pesan) {
  bekerja.value = kunci
  try {
    data.value = (await promise).data
    toast.success(pesan)
    return true
  } catch (e) {
    toast.error(errorMessage(e))
    return false
  } finally {
    bekerja.value = ''
  }
}

const hitung = () => jalankan('hitung', api.post(`/komisi-periodes/${route.params.id}/hitung`), 'Rekap komisi dihitung ulang.')
const setujui = () =>
  confirm('Setujui & kunci rekap ini? Setelah disetujui, rekap tidak bisa dihitung ulang, diubah, atau dihapus.') &&
  jalankan('setujui', api.post(`/komisi-periodes/${route.params.id}/setujui`), 'Rekap disetujui & dikunci.')

async function hapusPeriode() {
  if (!confirm(`Hapus periode "${data.value.nama}"?`)) return
  try {
    await api.delete(`/komisi-periodes/${route.params.id}`)
    toast.success('Periode dihapus.')
    router.push('/komisi')
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

// ---- Penyesuaian manual ----
const sesuai = reactive({ open: false, user_id: '', komisi: '', keterangan: '' })
const petugasList = ref([])
const errors = ref({})

async function bukaPenyesuaian(userId = '') {
  Object.assign(sesuai, { open: true, user_id: userId, komisi: '', keterangan: '' })
  errors.value = {}
  try {
    petugasList.value = await cachedGet('/petugas')
  } catch {
    petugasList.value = []
  }
}

async function simpanPenyesuaian() {
  bekerja.value = 'penyesuaian'
  errors.value = {}
  try {
    data.value = (await api.post(`/komisi-periodes/${route.params.id}/penyesuaian`, { user_id: Number(sesuai.user_id), komisi: Number(sesuai.komisi), keterangan: sesuai.keterangan })).data
    toast.success('Penyesuaian ditambahkan.')
    sesuai.open = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    bekerja.value = ''
  }
}

const hapusPenyesuaian = (b) =>
  confirm(`Hapus penyesuaian "${b.deskripsi}"?`) && jalankan('hapus', api.delete(`/komisi-periodes/${route.params.id}/penyesuaian/${b.id}`), 'Penyesuaian dihapus.')

// ---- Slip ----
const slip = ref(null)
const slipOpen = ref(false)

function bukaSlip(r) {
  slip.value = { petugas: r.user, barises: data.value.barises.filter((b) => b.user_id === r.user.id) }
  slipOpen.value = true
}

async function cetakSlip() {
  await nextTick()
  printElement('#slip-komisi', `Slip komisi ${slip.value.petugas.name} — ${data.value.nama}`)
}

const peranRingkas = (perPeran) => Object.entries(perPeran ?? {}).map(([p, n]) => `${PERAN_KOMISI[p] ?? p} ${rupiah(n)}`).join(' · ')

onMounted(load)
</script>

<template>
  <template v-if="data">
    <PageHeader :title="`Komisi ${data.nama}`" :subtitle="`${data.cabang?.nama} · pembayaran ${tanggal(data.mulai)} – ${tanggal(data.selesai)}`">
      <RouterLink to="/komisi" class="btn btn-secondary">Kembali</RouterLink>
      <template v-if="draf">
        <button v-if="bolehKelola" class="btn btn-ghost text-rose-600" @click="hapusPeriode">Hapus</button>
        <button v-if="bolehKelola" class="btn btn-secondary" :disabled="!!bekerja" @click="bukaPenyesuaian()">+ Penyesuaian</button>
        <button v-if="bolehKelola" class="btn btn-secondary" :disabled="!!bekerja" @click="hitung"><AppSpinner v-if="bekerja === 'hitung'" />{{ data.dihitung_at ? 'Hitung ulang' : 'Hitung' }}</button>
        <button v-if="auth.can('komisi.setujui')" class="btn btn-primary" :disabled="!!bekerja || !data.dihitung_at" @click="setujui"><AppSpinner v-if="bekerja === 'setujui'" />Setujui & kunci</button>
      </template>
    </PageHeader>

    <div class="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div class="card card-body">
        <p class="text-xs font-medium text-slate-500">Total komisi</p>
        <p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{{ rupiah(data.total) }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ data.ringkasan.length }} petugas · {{ data.barises.length }} baris</p>
      </div>
      <div class="card card-body text-sm">
        <p class="text-xs font-medium text-slate-500">Status</p>
        <p class="mt-1"><StatusBadge :status="data.status" /></p>
        <p class="mt-2 text-xs text-slate-500">
          <template v-if="data.disetujui_at">Disetujui {{ waktu(data.disetujui_at) }} oleh {{ data.penyetuju?.name }}</template>
          <template v-else-if="data.dihitung_at">Dihitung {{ waktu(data.dihitung_at) }} oleh {{ data.penghitung?.name }}</template>
          <template v-else>Belum dihitung</template>
        </p>
      </div>
      <div class="card card-body text-sm">
        <p class="text-xs font-medium text-slate-500">Dasar perhitungan</p>
        <p class="mt-1 font-medium">{{ data.dasar === 'bruto' ? 'Bruto (sebelum diskon)' : data.dasar === 'neto' ? 'Neto (setelah diskon & promo)' : '—' }}</p>
        <p class="mt-2 text-xs text-slate-500">Dari tagihan kunjungan lunas pada rentang tanggal; sesi paket memakai nilai per sesi.</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="card-header"><h2 class="card-title">Per petugas</h2></div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Petugas</th><th>Rincian per peran</th><th class="text-right">Baris</th><th class="text-right">Total</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in data.ringkasan" :key="r.user.id">
              <td class="font-medium">{{ r.user.name }}</td>
              <td class="text-xs text-slate-600">{{ peranRingkas(r.per_peran) }}</td>
              <td class="text-right tabular-nums">{{ r.jumlah_baris }}</td>
              <td class="text-right font-medium tabular-nums">{{ rupiah(r.total) }}</td>
              <td class="text-right whitespace-nowrap">
                <button class="btn btn-ghost btn-sm" @click="filterUser = String(r.user.id)">Rincian</button>
                <button class="btn btn-ghost btn-sm" @click="bukaSlip(r)">Slip</button>
              </td>
            </tr>
            <tr v-if="!data.ringkasan.length"><td colspan="5" class="py-8 text-center text-slate-400">{{ data.dihitung_at ? 'Tidak ada komisi pada periode ini.' : 'Klik "Hitung" untuk menyusun rekap.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header flex-wrap">
        <h2 class="card-title">Rincian</h2>
        <select v-model="filterUser" class="input ml-auto w-auto py-1.5 text-sm" aria-label="Filter petugas">
          <option value="">Semua petugas</option>
          <option v-for="r in data.ringkasan" :key="r.user.id" :value="String(r.user.id)">{{ r.user.name }}</option>
        </select>
      </div>
      <div class="overflow-x-auto">
        <table class="table text-sm">
          <thead><tr><th>Tanggal</th><th>Petugas</th><th>Uraian</th><th>Peran</th><th class="text-right">Dasar</th><th class="text-right">Komisi</th><th /></tr></thead>
          <tbody>
            <tr v-for="b in baris" :key="b.id">
              <td class="whitespace-nowrap">{{ tanggal(b.tanggal) }}</td>
              <td>{{ b.user?.name }}</td>
              <td>
                {{ b.deskripsi }}
                <span class="block text-xs text-slate-500">{{ SUMBER_KOMISI[b.sumber] }}<template v-if="b.jenis"> · {{ b.jenis === 'persen' ? `${Number(b.nilai).toLocaleString('id-ID')}%` : rupiah(b.nilai) }}</template></span>
              </td>
              <td class="whitespace-nowrap">{{ PERAN_KOMISI[b.peran] }}</td>
              <td class="text-right tabular-nums">{{ b.dasar ? rupiah(b.dasar) : '' }}</td>
              <td class="text-right font-medium tabular-nums" :class="{ 'text-rose-600': b.komisi < 0 }">{{ rupiah(b.komisi) }}</td>
              <td class="text-right">
                <button v-if="bolehKelola && b.sumber === 'penyesuaian'" class="text-xs text-rose-600 hover:underline" :disabled="!!bekerja" @click="hapusPenyesuaian(b)">Hapus</button>
              </td>
            </tr>
            <tr v-if="!baris.length"><td colspan="7" class="py-8 text-center text-slate-400">Tidak ada baris.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Penyesuaian -->
    <AppModal v-model="sesuai.open" title="Penyesuaian Komisi">
      <form id="form-penyesuaian" class="space-y-3 text-sm" @submit.prevent="simpanPenyesuaian">
        <div>
          <label class="label" for="ps-user">Petugas *</label>
          <select id="ps-user" v-model="sesuai.user_id" class="input" :class="{ 'input-error': errors.user_id }" required>
            <option value="">— Pilih petugas —</option>
            <option v-for="p in petugasList" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="ps-komisi">Nominal (Rp) *</label>
          <input id="ps-komisi" v-model="sesuai.komisi" type="number" class="input" :class="{ 'input-error': errors.komisi }" required placeholder="Negatif = potongan" />
          <p v-if="errors.komisi" class="field-error">{{ errors.komisi }}</p>
        </div>
        <div>
          <label class="label" for="ps-ket">Keterangan *</label>
          <input id="ps-ket" v-model="sesuai.keterangan" class="input" maxlength="255" required placeholder="Mis. bonus target bulanan" />
        </div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="sesuai.open = false">Batal</button>
        <button type="submit" form="form-penyesuaian" class="btn btn-primary" :disabled="bekerja === 'penyesuaian'"><AppSpinner v-if="bekerja === 'penyesuaian'" />Tambah</button>
      </template>
    </AppModal>

    <!-- Slip -->
    <AppModal v-model="slipOpen" title="Slip Komisi" size="max-w-3xl">
      <SlipKomisi v-if="slip" :periode="data" :petugas="slip.petugas" :barises="slip.barises" />
      <template #footer>
        <button class="btn btn-secondary" @click="slipOpen = false">Tutup</button>
        <button class="btn btn-primary" @click="cetakSlip">Cetak</button>
      </template>
    </AppModal>
  </template>
  <PageLoading v-else :error="loadError" text="Memuat rekap komisi..." @retry="load" />
</template>
