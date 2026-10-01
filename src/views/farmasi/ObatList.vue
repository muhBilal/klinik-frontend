<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import ImporMasterButton from '@/components/ImporMasterButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { angka, rupiah, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const { items, meta, loading, filters, load, reload, search } = useList('/obats', { q: '', menipis: '' })

// Form obat
const formOpen = ref(false)
const editing = ref(null)
const form = reactive({})
const errors = ref({})
const saving = ref(false)

function bukaForm(obat = null) {
  editing.value = obat
  errors.value = {}
  Object.assign(form, obat
    ? { jenis: 'obat', no_bpom: '', fraksional: false, jam_pakai_setelah_buka: '', ...obat }
    : { kode: '', nama: '', satuan: 'tablet', jenis: 'obat', no_bpom: '', fraksional: false, jam_pakai_setelah_buka: '', harga: 0, stok_minimum: 10, stok_awal: 0, is_active: true })
  formOpen.value = true
}

const JENIS_PRODUK = { obat: 'Obat', skincare: 'Skincare / kosmetik', bhp: 'Bahan habis pakai', alkes: 'Alat kesehatan' }
const payloadObat = () => ({ ...form, no_bpom: form.no_bpom || null, jam_pakai_setelah_buka: form.fraksional && form.jam_pakai_setelah_buka ? form.jam_pakai_setelah_buka : null })

async function simpanObat() {
  saving.value = true
  errors.value = {}
  try {
    if (editing.value) {
      // Perbarui baris di tempat, tanpa memuat ulang tabel
      Object.assign(editing.value, (await api.put(`/obats/${editing.value.id}`, payloadObat())).data)
    } else {
      await api.post('/obats', payloadObat())
      reload()
    }
    toast.success('Data obat tersimpan.')
    formOpen.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

// Mutasi stok
const mutasiOpen = ref(false)
const mutasiObat = ref(null)
const mutasi = reactive({ jenis: 'masuk', jumlah: '', keterangan: '' })

function bukaMutasi(obat) {
  mutasiObat.value = obat
  Object.assign(mutasi, { jenis: 'masuk', jumlah: '', keterangan: '' })
  errors.value = {}
  mutasiOpen.value = true
}

async function simpanMutasi() {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.post(`/obats/${mutasiObat.value.id}/mutasi`, mutasi)
    toast.success(`Stok ${data.obat.nama} sekarang ${data.obat.stok} ${data.obat.satuan}.`)
    mutasiOpen.value = false
    Object.assign(mutasiObat.value, data.obat)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

// Kartu stok
const kartuOpen = ref(false)
const kartuObat = ref(null)
const kartu = ref({ data: [] })
const kartuLoading = ref(false)

async function bukaKartu(obat, page = 1) {
  if (kartuObat.value?.id !== obat.id) kartu.value = { data: [] } // jangan tampilkan kartu obat sebelumnya
  kartuObat.value = obat
  kartuOpen.value = true
  kartuLoading.value = true
  try {
    kartu.value = (await api.get(`/obats/${obat.id}/mutasi`, { params: { page } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    kartuLoading.value = false
  }
}

const deleting = ref(null)

async function hapus(obat) {
  if (!confirm(`Hapus obat ${obat.nama}?`)) return
  deleting.value = obat.id
  try {
    await api.delete(`/obats/${obat.id}`)
    toast.success('Obat dihapus.')
    reload()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = null
  }
}

onMounted(() => load())
</script>

<template>
  <PageHeader title="Obat & Stok" subtitle="Master obat, penerimaan stok, dan kartu stok">
    <ImporMasterButton v-if="auth.can('master.kelola')" jenis="obat" @selesai="reload" />
    <button class="btn btn-primary" @click="bukaForm()">+ Obat Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header">
      <input v-model="filters.q" type="search" class="input max-w-sm" placeholder="Cari kode atau nama obat..." @input="search" />
      <label class="flex items-center gap-2 text-sm text-slate-600">
        <input v-model="filters.menipis" type="checkbox" true-value="1" false-value="" class="accent-brand-600" @change="load()" />
        Stok menipis saja
      </label>
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead>
          <tr><th>Kode</th><th>Nama</th><th>Satuan</th><th class="text-right">Harga</th><th class="text-right">Stok</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="7" />
          <tr v-for="o in items" :key="o.id">
            <td class="tabular-nums text-xs">{{ o.kode }}</td>
            <td>
              <p class="font-medium">{{ o.nama }}</p>
              <p class="text-xs text-slate-500">
                {{ JENIS_PRODUK[o.jenis] ?? 'Obat' }}<template v-if="o.no_bpom"> · BPOM {{ o.no_bpom }}</template><template v-if="o.fraksional"> · fraksional</template>
              </p>
            </td>
            <td>{{ o.satuan }}</td>
            <td class="text-right tabular-nums">{{ rupiah(o.harga) }}</td>
            <td class="text-right tabular-nums">
              <span :class="o.stok <= o.stok_minimum ? 'font-semibold text-rose-600' : ''">{{ angka(o.stok) }}</span>
              <p class="text-[11px] text-slate-400">min {{ o.stok_minimum }}</p>
            </td>
            <td><StatusBadge :status="o.is_active ? 'aktif' : 'nonaktif'" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-secondary btn-sm" @click="bukaMutasi(o)">Mutasi stok</button>
              <RouterLink v-if="auth.can('inventori.kelola')" :to="{ path: '/farmasi/stok', query: { obat_id: o.id } }" class="btn btn-ghost btn-sm">Batch</RouterLink>
              <button class="btn btn-ghost btn-sm" @click="bukaKartu(o)">Kartu stok</button>
              <button class="btn btn-ghost btn-sm" @click="bukaForm(o)">Ubah</button>
              <button v-if="auth.can('master.kelola')" class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === o.id" @click="hapus(o)">
                <AppSpinner v-if="deleting === o.id" size="size-3" />Hapus
              </button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="7" class="py-10 text-center text-slate-400">Tidak ada data obat.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <!-- Form obat -->
  <AppModal v-model="formOpen" :title="editing ? 'Ubah Obat' : 'Obat Baru'">
    <form id="form-obat" class="grid gap-4 sm:grid-cols-2" @submit.prevent="simpanObat">
      <div>
        <label class="label">Kode *</label>
        <input v-model="form.kode" class="input" :class="{ 'input-error': errors.kode }" required />
        <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
      </div>
      <div>
        <label class="label">Satuan *</label>
        <input v-model="form.satuan" class="input" list="satuan-obat" required />
        <datalist id="satuan-obat"><option v-for="s in ['tablet', 'kapsul', 'botol', 'tube', 'sachet', 'ampul', 'vial', 'pcs']" :key="s" :value="s" /></datalist>
      </div>
      <div class="sm:col-span-2">
        <label class="label">Nama obat *</label>
        <input v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" required />
        <p v-if="errors.nama" class="field-error">{{ errors.nama }}</p>
      </div>
      <div>
        <label class="label" for="ob-jenis">Jenis produk</label>
        <select id="ob-jenis" v-model="form.jenis" class="input">
          <option v-for="(l, v) in JENIS_PRODUK" :key="v" :value="v">{{ l }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="ob-bpom">No. notifikasi / izin edar BPOM{{ form.jenis === 'skincare' ? ' *' : '' }}</label>
        <input id="ob-bpom" v-model="form.no_bpom" class="input uppercase" :class="{ 'input-error': errors.no_bpom }" maxlength="30" :placeholder="form.jenis === 'skincare' ? 'NA18210100123' : 'opsional'" :required="form.jenis === 'skincare'" />
        <p v-if="errors.no_bpom" class="field-error">{{ errors.no_bpom }}</p>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="form.fraksional" type="checkbox" class="accent-brand-600" /> Boleh dipakai sebagian (vial, tube, ml)
      </label>
      <div v-if="form.fraksional">
        <label class="label" for="ob-jam">Masa pakai setelah dibuka (jam)</label>
        <input id="ob-jam" v-model.number="form.jam_pakai_setelah_buka" type="number" min="1" class="input" :class="{ 'input-error': errors.jam_pakai_setelah_buka }" placeholder="mis. 24 untuk botulinum" />
      </div>
      <div>
        <label class="label">Harga jual / satuan *</label>
        <input v-model.number="form.harga" type="number" min="0" class="input" required />
      </div>
      <div>
        <label class="label">Stok minimum *</label>
        <input v-model.number="form.stok_minimum" type="number" min="0" class="input" required />
      </div>
      <div v-if="!editing">
        <label class="label">Stok awal</label>
        <input v-model.number="form.stok_awal" type="number" min="0" class="input" />
      </div>
      <label class="flex items-center gap-2 self-end pb-2 text-sm">
        <input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif (dapat diresepkan)
      </label>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-obat" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>

  <!-- Mutasi stok -->
  <AppModal v-model="mutasiOpen" :title="`Mutasi Stok · ${mutasiObat?.nama ?? ''}`" size="max-w-md">
    <form id="form-mutasi" class="space-y-4" @submit.prevent="simpanMutasi">
      <p class="text-sm text-slate-600">Stok saat ini: <b>{{ mutasiObat?.stok }} {{ mutasiObat?.satuan }}</b></p>
      <div class="grid grid-cols-3 gap-2">
        <label
          v-for="[val, label] in [['masuk', 'Masuk'], ['keluar', 'Keluar'], ['penyesuaian', 'Stok opname']]"
          :key="val"
          :class="{ 'choice-active': mutasi.jenis === val }"
          class="choice px-2"
        >
          <input v-model="mutasi.jenis" type="radio" :value="val" class="sr-only" />{{ label }}
        </label>
      </div>
      <div>
        <label class="label">{{ mutasi.jenis === 'penyesuaian' ? 'Stok fisik hasil opname' : 'Jumlah' }} *</label>
        <input v-model.number="mutasi.jumlah" type="number" min="0" class="input" :class="{ 'input-error': errors.jumlah }" required />
        <p v-if="errors.jumlah" class="field-error">{{ errors.jumlah }}</p>
      </div>
      <div>
        <label class="label">Keterangan</label>
        <input v-model="mutasi.keterangan" class="input" :placeholder="mutasi.jenis === 'masuk' ? 'Contoh: Faktur PBF no. 123' : mutasi.jenis === 'keluar' ? 'Contoh: Kadaluarsa' : 'Contoh: Stok opname bulanan'" />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="mutasiOpen = false">Batal</button>
      <button type="submit" form="form-mutasi" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>

  <!-- Kartu stok -->
  <AppModal v-model="kartuOpen" :title="`Kartu Stok · ${kartuObat?.nama ?? ''}`" size="max-w-3xl">
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': kartuLoading && kartu.data.length }">
      <table class="table">
        <thead><tr><th>Waktu</th><th>Jenis</th><th class="text-right">Jumlah</th><th class="text-right">Stok akhir</th><th>Referensi / Keterangan</th><th>Petugas</th></tr></thead>
        <tbody>
          <TableSkeleton v-if="kartuLoading && !kartu.data.length" :cols="6" :rows="4" />
          <tr v-for="m in kartu.data" :key="m.id">
            <td class="whitespace-nowrap text-slate-600">{{ waktu(m.created_at) }}</td>
            <td class="capitalize">{{ m.jenis }}</td>
            <td :class="m.jumlah < 0 ? 'text-rose-600' : 'text-emerald-600'" class="text-right font-medium tabular-nums">{{ m.jumlah > 0 ? '+' : '' }}{{ m.jumlah }}</td>
            <td class="text-right tabular-nums">{{ m.stok_akhir }}</td>
            <td>{{ [m.referensi, m.keterangan].filter(Boolean).join(' · ') || '-' }}</td>
            <td class="text-slate-600">{{ m.user?.name ?? '-' }}</td>
          </tr>
          <tr v-if="!kartuLoading && !kartu.data.length"><td colspan="6" class="py-6 text-center text-slate-400">Belum ada mutasi.</td></tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="kartu" @change="(p) => bukaKartu(kartuObat, p)" />
  </AppModal>
</template>
