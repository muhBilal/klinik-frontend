<script setup>
/**
 * Voucher & kode promo (PRD TR-06): potongan persen (dengan batas) atau nominal, periode, kuota total & per pasien, minimum
 * transaksi, cabang, dan treatment/paket tertentu. Kasir memasang kode di halaman tagihan; voucher sekali pakai = kuota 1.
 */
import { onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { OPSI_STATUS_AKTIF, hariIni, rupiah, tanggal } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const { items, meta, loading, filters, load, reload, search } = useList('/promos', { q: '', status: '' })

const cabangs = ref([])
const pakets = ref([])
const formOpen = ref(false)
const editing = ref(null)
const form = reactive({})
const errors = ref({})
const saving = ref(false)
const deleting = ref(null)

/** Status tampilan: nonaktif, belum mulai, berakhir, kuota habis, atau berlaku. */
function statusPromo(p) {
  const hari = hariIni()
  if (!p.is_active) return 'nonaktif'
  if (p.mulai > hari) return 'belum_mulai'
  if (p.berakhir && p.berakhir < hari) return 'berakhir'
  if (p.kuota !== null && p.dipakai >= p.kuota) return 'kuota_habis'
  return 'berlaku'
}

const potongan = (p) => (p.jenis === 'persen' ? `${p.nilai}%${p.maks_potongan ? ` maks ${rupiah(p.maks_potongan)}` : ''}` : rupiah(p.nilai))
const cakupan = (p) => [...(p.tindakans ?? []), ...(p.pakets ?? [])].map((x) => x.nama).join(', ') || 'Semua item'

async function buka(row = null) {
  editing.value = row
  errors.value = {}
  Object.assign(form, {
    kode: row?.kode ?? '',
    nama: row?.nama ?? '',
    deskripsi: row?.deskripsi ?? '',
    jenis: row?.jenis ?? 'persen',
    nilai: row?.nilai ?? 10,
    maks_potongan: row?.maks_potongan ?? '',
    min_transaksi: row?.min_transaksi ?? 0,
    mulai: row?.mulai ?? hariIni(),
    berakhir: row?.berakhir ?? '',
    kuota: row?.kuota ?? '',
    kuota_per_pasien: row?.kuota_per_pasien ?? '',
    cabang_ids: [...(row?.cabang_ids ?? [])],
    tindakans: [...(row?.tindakans ?? [])],
    paket_ids: [...(row?.paket_ids ?? [])],
    is_active: row?.is_active ?? true,
  })
  formOpen.value = true
  try {
    ;[cabangs.value, pakets.value] = await Promise.all([cachedGet('/cabangs'), cachedGet('/pakets', { aktif: 1 })])
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function tambahTindakan(t) {
  if (!form.tindakans.some((x) => x.id === t.id)) form.tindakans.push({ id: t.id, nama: t.nama })
}

const angkaAtauNull = (v) => (v === '' || v === null ? null : Number(v))

async function simpan() {
  saving.value = true
  errors.value = {}
  const payload = {
    ...form,
    maks_potongan: form.jenis === 'persen' ? angkaAtauNull(form.maks_potongan) : null,
    min_transaksi: Number(form.min_transaksi || 0),
    berakhir: form.berakhir || null,
    kuota: angkaAtauNull(form.kuota),
    kuota_per_pasien: angkaAtauNull(form.kuota_per_pasien),
    tindakan_ids: form.tindakans.map((t) => t.id),
  }
  delete payload.tindakans
  try {
    if (editing.value) await api.put(`/promos/${editing.value.id}`, payload)
    else await api.post('/promos', payload)
    toast.success('Kode promo tersimpan.')
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
  if (!confirm(`Hapus kode ${row.kode}?`)) return
  deleting.value = row.id
  try {
    await api.delete(`/promos/${row.id}`)
    toast.success('Kode promo dihapus.')
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
  <PageHeader title="Voucher & Promo" subtitle="Kode potongan: periode, kuota, minimum transaksi, cabang & treatment tertentu">
    <button class="btn btn-primary" @click="buka()">+ Kode Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="filter-bar">
        <input v-model="filters.q" type="search" class="input w-64" placeholder="Cari kode / nama..." @input="search" />
        <FilterSelect v-model="filters.status" placeholder="Semua status" :options="OPSI_STATUS_AKTIF" @change="load()" />
      </div>
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead><tr><th>Kode</th><th>Potongan</th><th>Berlaku untuk</th><th>Periode</th><th class="text-right">Dipakai</th><th>Status</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="7" />
          <tr v-for="p in items" :key="p.id">
            <td>
              <p class="font-mono font-semibold">{{ p.kode }}</p>
              <p class="text-xs text-slate-500">{{ p.nama }}</p>
            </td>
            <td class="whitespace-nowrap">
              {{ potongan(p) }}
              <p v-if="p.min_transaksi" class="text-xs text-slate-500">min. {{ rupiah(p.min_transaksi) }}</p>
            </td>
            <td class="max-w-56 text-xs text-slate-600">
              {{ cakupan(p) }}
              <p v-if="p.cabangs?.length" class="text-slate-400">Cabang: {{ p.cabangs.map((c) => c.nama).join(', ') }}</p>
            </td>
            <td class="whitespace-nowrap text-xs">{{ tanggal(p.mulai) }} – {{ p.berakhir ? tanggal(p.berakhir) : 'seterusnya' }}</td>
            <td class="text-right tabular-nums">
              {{ p.dipakai }}<span class="text-slate-400"> / {{ p.kuota ?? '∞' }}</span>
              <p v-if="p.kuota_per_pasien" class="text-xs text-slate-500">maks {{ p.kuota_per_pasien }}×/pasien</p>
            </td>
            <td><StatusBadge :status="statusPromo(p)" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="buka(p)">Ubah</button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === p.id" @click="hapus(p)"><AppSpinner v-if="deleting === p.id" size="size-3" />Hapus</button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="7" class="py-10 text-center text-slate-400">Belum ada kode promo.</td></tr>
        </tbody>
      </table>
    </div>
    <AppPagination :meta="meta" @change="load" />
  </div>

  <AppModal v-model="formOpen" :title="editing ? `Ubah ${editing.kode}` : 'Kode Promo Baru'" size="max-w-3xl">
    <form id="form-promo" class="space-y-4" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <label class="label" for="pr-kode">Kode *</label>
          <input id="pr-kode" v-model="form.kode" class="input font-mono uppercase" :class="{ 'input-error': errors.kode }" maxlength="30" placeholder="WELCOME10" required />
          <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
        </div>
        <div>
          <label class="label" for="pr-nama">Nama *</label>
          <input id="pr-nama" v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" maxlength="150" required />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-4">
        <div>
          <label class="label" for="pr-jenis">Jenis potongan</label>
          <select id="pr-jenis" v-model="form.jenis" class="input">
            <option value="persen">Persen</option>
            <option value="nominal">Nominal (Rp)</option>
          </select>
        </div>
        <div>
          <label class="label" for="pr-nilai">{{ form.jenis === 'persen' ? 'Persen *' : 'Nominal (Rp) *' }}</label>
          <input id="pr-nilai" v-model.number="form.nilai" type="number" min="1" :max="form.jenis === 'persen' ? 100 : undefined" class="input" :class="{ 'input-error': errors.nilai }" required />
          <p v-if="errors.nilai" class="field-error">{{ errors.nilai }}</p>
        </div>
        <div v-if="form.jenis === 'persen'">
          <label class="label" for="pr-maks">Maks. potongan (Rp)</label>
          <input id="pr-maks" v-model="form.maks_potongan" type="number" min="1" class="input" placeholder="Tanpa batas" />
        </div>
        <div>
          <label class="label" for="pr-min">Min. transaksi (Rp)</label>
          <input id="pr-min" v-model="form.min_transaksi" type="number" min="0" class="input" />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-4">
        <div>
          <label class="label" for="pr-mulai">Mulai *</label>
          <input id="pr-mulai" v-model="form.mulai" type="date" class="input" required />
        </div>
        <div>
          <label class="label" for="pr-akhir">Berakhir</label>
          <input id="pr-akhir" v-model="form.berakhir" type="date" class="input" :class="{ 'input-error': errors.berakhir }" />
          <p v-if="errors.berakhir" class="field-error">{{ errors.berakhir }}</p>
        </div>
        <div>
          <label class="label" for="pr-kuota">Kuota total</label>
          <input id="pr-kuota" v-model="form.kuota" type="number" min="1" class="input" placeholder="Tanpa batas" />
        </div>
        <div>
          <label class="label" for="pr-kuota-pasien">Kuota per pasien</label>
          <input id="pr-kuota-pasien" v-model="form.kuota_per_pasien" type="number" min="1" class="input" placeholder="Tanpa batas" />
        </div>
      </div>

      <fieldset class="space-y-2">
        <legend class="label">Hanya untuk treatment / paket tertentu <span class="font-normal text-slate-400">(kosong = semua item tagihan)</span></legend>
        <AsyncSelect endpoint="/tindakans" :params="{ aktif: 1 }" placeholder="Tambah treatment..." @select="tambahTindakan">
          <template #default="{ item }">{{ item.nama }}</template>
        </AsyncSelect>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="(t, i) in form.tindakans" :key="t.id" class="chip">{{ t.nama }} <button type="button" class="text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${t.nama}`" @click="form.tindakans.splice(i, 1)">&times;</button></span>
        </div>
        <div v-if="pakets.length" class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <label v-for="p in pakets" :key="p.id" class="flex items-center gap-1.5"><input v-model="form.paket_ids" type="checkbox" :value="p.id" class="accent-brand-600" /> Paket {{ p.nama }}</label>
        </div>
      </fieldset>

      <fieldset v-if="cabangs.length > 1">
        <legend class="label">Cabang <span class="font-normal text-slate-400">(kosong = semua cabang)</span></legend>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <label v-for="c in cabangs" :key="c.id" class="flex items-center gap-1.5"><input v-model="form.cabang_ids" type="checkbox" :value="c.id" class="accent-brand-600" /> {{ c.nama }}</label>
        </div>
      </fieldset>

      <div>
        <label class="label" for="pr-desk">Keterangan</label>
        <textarea id="pr-desk" v-model="form.deskripsi" rows="2" class="input" maxlength="2000" placeholder="Syarat & ketentuan untuk kasir" />
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif</label>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-promo" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>
</template>
