<script setup>
/**
 * Katalog paket multi-sesi (PRD TR-02): beberapa treatment × jumlah sesi, harga paket, masa berlaku, berlaku lintas cabang.
 * Paket yang sudah terjual tidak berubah bila katalog diubah (isi & harga di-snapshot saat dibeli).
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
import { invalidate } from '@/lib/cache'
import { OPSI_STATUS_AKTIF, rupiah } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const { items, loading, filters, load, reload, search } = useList('/pakets', { q: '', status: '' })

const formOpen = ref(false)
const editing = ref(null)
const form = reactive({ kode: '', nama: '', deskripsi: '', harga: 0, masa_berlaku_hari: '', lintas_cabang: true, is_active: true, items: [] })
const errors = ref({})
const saving = ref(false)
const deleting = ref(null)

const nilaiNormal = computed(() => form.items.reduce((s, i) => s + i.tarif * i.jumlah_sesi, 0))
const hemat = (normal, harga) => (normal > harga && normal > 0 ? Math.round(((normal - harga) / normal) * 100) : 0)

function buka(row = null) {
  editing.value = row
  errors.value = {}
  Object.assign(form, {
    kode: row?.kode ?? '',
    nama: row?.nama ?? '',
    deskripsi: row?.deskripsi ?? '',
    harga: row?.harga ?? 0,
    masa_berlaku_hari: row?.masa_berlaku_hari ?? '',
    lintas_cabang: row?.lintas_cabang ?? true,
    is_active: row?.is_active ?? true,
    items: (row?.items ?? []).map((i) => ({ tindakan_id: i.tindakan_id, nama: i.tindakan?.nama, tarif: i.tindakan?.tarif ?? 0, jumlah_sesi: i.jumlah_sesi })),
  })
  formOpen.value = true
}

function tambahItem(t) {
  const ada = form.items.find((i) => i.tindakan_id === t.id)
  if (ada) return ada.jumlah_sesi++
  form.items.push({ tindakan_id: t.id, nama: t.nama, tarif: t.tarif, jumlah_sesi: 1 })
}

async function simpan() {
  saving.value = true
  errors.value = {}
  const payload = {
    ...form,
    masa_berlaku_hari: form.masa_berlaku_hari === '' ? null : Number(form.masa_berlaku_hari),
    items: form.items.map(({ tindakan_id, jumlah_sesi }) => ({ tindakan_id, jumlah_sesi })),
  }
  try {
    if (editing.value) await api.put(`/pakets/${editing.value.id}`, payload)
    else await api.post('/pakets', payload)
    invalidate('/pakets')
    toast.success('Paket tersimpan.')
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
  if (!confirm(`Hapus paket "${row.nama}"?`)) return
  deleting.value = row.id
  try {
    await api.delete(`/pakets/${row.id}`)
    invalidate('/pakets')
    toast.success('Paket dihapus.')
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
  <PageHeader title="Paket Treatment" subtitle="Paket multi-sesi dibayar di muka: isi treatment, jumlah sesi, harga & masa berlaku">
    <button class="btn btn-primary" @click="buka()">+ Paket Baru</button>
  </PageHeader>

  <div class="card">
    <div class="card-header flex-wrap">
      <div class="filter-bar">
        <input v-model="filters.q" type="search" class="input w-64" placeholder="Cari kode / nama paket..." @input="search" />
        <FilterSelect v-model="filters.status" placeholder="Semua status" :options="OPSI_STATUS_AKTIF" @change="load()" />
      </div>
    </div>
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead><tr><th>Paket</th><th>Isi</th><th class="text-right">Harga</th><th>Berlaku</th><th class="text-center">Terjual</th><th>Status</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="7" />
          <tr v-for="p in items" :key="p.id">
            <td>
              <p class="font-medium">{{ p.nama }}</p>
              <p class="text-xs text-slate-500"><span class="tabular-nums">{{ p.kode }}</span><template v-if="!p.lintas_cabang"> · hanya cabang pembelian</template></p>
            </td>
            <td class="text-xs text-slate-600">{{ p.items.map((i) => `${i.tindakan?.nama} ×${i.jumlah_sesi}`).join(' · ') }}</td>
            <td class="text-right tabular-nums">
              {{ rupiah(p.harga) }}
              <p v-if="hemat(p.nilai_normal, p.harga)" class="text-xs text-emerald-700">hemat {{ hemat(p.nilai_normal, p.harga) }}% dari {{ rupiah(p.nilai_normal) }}</p>
            </td>
            <td class="whitespace-nowrap text-slate-600">{{ p.masa_berlaku_hari ? `${p.masa_berlaku_hari} hari` : 'Tanpa batas' }}</td>
            <td class="text-center tabular-nums">{{ p.terjual_count }}</td>
            <td><StatusBadge :status="p.is_active ? 'aktif' : 'nonaktif'" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="buka(p)">Ubah</button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === p.id" @click="hapus(p)"><AppSpinner v-if="deleting === p.id" size="size-3" />Hapus</button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="7" class="py-10 text-center text-slate-400">Belum ada paket.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <AppModal v-model="formOpen" :title="editing ? 'Ubah Paket' : 'Paket Baru'" size="max-w-3xl">
    <form id="form-paket" class="space-y-4" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label class="label" for="pk-kode">Kode *</label>
          <input id="pk-kode" v-model="form.kode" class="input" :class="{ 'input-error': errors.kode }" maxlength="20" placeholder="PKT-LSR6" required />
          <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
        </div>
        <div>
          <label class="label" for="pk-nama">Nama paket *</label>
          <input id="pk-nama" v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" maxlength="150" required />
        </div>
      </div>
      <div>
        <label class="label" for="pk-desk">Deskripsi / syarat</label>
        <textarea id="pk-desk" v-model="form.deskripsi" rows="2" class="input" maxlength="2000" placeholder="Mis. jarak antar sesi minimal 2 minggu" />
      </div>

      <div class="space-y-2">
        <p class="label">Isi paket *</p>
        <AsyncSelect endpoint="/tindakans" :params="{ aktif: 1 }" placeholder="Cari treatment untuk ditambahkan..." @select="tambahItem">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ rupiah(item.tarif) }}</span></template>
        </AsyncSelect>
        <p v-if="errors.items" class="field-error">{{ errors.items }}</p>
        <div v-for="(i, idx) in form.items" :key="i.tindakan_id" class="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/40 px-3 py-2 text-sm">
          <span class="min-w-40 flex-1 font-medium">{{ i.nama }}</span>
          <label class="flex items-center gap-1.5 text-xs text-slate-500">
            <input v-model.number="i.jumlah_sesi" type="number" min="1" max="100" class="input w-20 py-1 text-sm" :aria-label="`Jumlah sesi ${i.nama}`" /> sesi
          </label>
          <span class="w-28 text-right text-xs tabular-nums text-slate-500">{{ rupiah(i.tarif * i.jumlah_sesi) }}</span>
          <button type="button" class="text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${i.nama}`" @click="form.items.splice(idx, 1)">&times;</button>
          <p v-if="errors[`items.${idx}.tindakan_id`] || errors[`items.${idx}.jumlah_sesi`]" class="field-error w-full">{{ errors[`items.${idx}.tindakan_id`] || errors[`items.${idx}.jumlah_sesi`] }}</p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="label" for="pk-harga">Harga paket (Rp) *</label>
          <input id="pk-harga" v-model.number="form.harga" type="number" min="0" class="input" :class="{ 'input-error': errors.harga }" required />
          <p class="mt-1 text-xs text-slate-500">
            Harga normal {{ rupiah(nilaiNormal) }}<template v-if="hemat(nilaiNormal, form.harga)"> · hemat {{ hemat(nilaiNormal, form.harga) }}%</template>
          </p>
        </div>
        <div>
          <label class="label" for="pk-masa">Masa berlaku (hari)</label>
          <input id="pk-masa" v-model="form.masa_berlaku_hari" type="number" min="1" max="3650" class="input" :class="{ 'input-error': errors.masa_berlaku_hari }" placeholder="Kosong = tanpa batas" />
          <p class="mt-1 text-xs text-slate-500">Dihitung sejak paket lunas.</p>
        </div>
        <div class="space-y-2 pt-6 text-sm">
          <label class="flex items-center gap-2"><input v-model="form.lintas_cabang" type="checkbox" class="accent-brand-600" /> Bisa dipakai di semua cabang</label>
          <label class="flex items-center gap-2"><input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif (dapat dijual)</label>
        </div>
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-paket" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>
</template>
