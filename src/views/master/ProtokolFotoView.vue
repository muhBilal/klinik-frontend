<script setup>
/**
 * Protokol foto klinis (PRD FT-01): daftar posisi standar yang diambil berurutan saat memotret pasien.
 * Kode posisi dipakai mencocokkan foto before-after lintas kunjungan — jangan diubah setelah dipakai.
 */
import { onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useList } from '@/composables/useList'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { invalidate } from '@/lib/cache'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const { items, loading, load, reload } = useList('/protokol-fotos')

const formOpen = ref(false)
const editing = ref(null)
const form = reactive({ nama: '', deskripsi: '', is_active: true, posisi: [] })
const errors = ref({})
const saving = ref(false)
const deleting = ref(null)

function buka(row = null) {
  editing.value = row
  errors.value = {}
  Object.assign(form, {
    nama: row?.nama ?? '',
    deskripsi: row?.deskripsi ?? '',
    is_active: row?.is_active ?? true,
    posisi: (row?.posisi ?? [{ kode: '', label: '', petunjuk: '' }]).map((p) => ({ ...p })),
  })
  formOpen.value = true
}

function geser(i, arah) {
  const j = i + arah
  if (j < 0 || j >= form.posisi.length) return
  ;[form.posisi[i], form.posisi[j]] = [form.posisi[j], form.posisi[i]]
}

async function simpan() {
  saving.value = true
  errors.value = {}
  const payload = { ...form, posisi: form.posisi.map((p) => ({ kode: p.kode || null, label: p.label, petunjuk: p.petunjuk || null })) }
  try {
    if (editing.value) await api.put(`/protokol-fotos/${editing.value.id}`, payload)
    else await api.post('/protokol-fotos', payload)
    invalidate('/protokol-fotos')
    toast.success('Protokol foto tersimpan.')
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
  if (!confirm(`Hapus protokol "${row.nama}"?`)) return
  deleting.value = row.id
  try {
    await api.delete(`/protokol-fotos/${row.id}`)
    invalidate('/protokol-fotos')
    toast.success('Protokol dihapus.')
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
  <PageHeader title="Protokol Foto" subtitle="Posisi foto standar per jenis dokumentasi: wajah depan/45°/profil, ekspresi injeksi, intraoral, tubuh">
    <button class="btn btn-primary" @click="buka()">+ Protokol Baru</button>
  </PageHeader>

  <div class="card">
    <div class="overflow-x-auto transition-opacity" :class="{ 'opacity-60': loading && items.length }">
      <table class="table">
        <thead><tr><th>Protokol</th><th>Posisi</th><th>Treatment</th><th>Status</th><th /></tr></thead>
        <tbody>
          <TableSkeleton v-if="loading && !items.length" :cols="5" />
          <tr v-for="p in items" :key="p.id">
            <td>
              <p class="font-medium">{{ p.nama }}</p>
              <p class="text-xs text-slate-500">{{ p.deskripsi ?? '' }}</p>
            </td>
            <td class="text-xs text-slate-600">{{ p.posisi.map((x) => x.label).join(' · ') }}</td>
            <td class="text-slate-600">{{ p.tindakans_count ? `${p.tindakans_count} treatment` : '-' }}</td>
            <td><StatusBadge :status="p.is_active ? 'aktif' : 'nonaktif'" /></td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="buka(p)">Ubah</button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === p.id" @click="hapus(p)"><AppSpinner v-if="deleting === p.id" size="size-3" />Hapus</button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="5" class="py-10 text-center text-slate-400">Belum ada protokol.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <AppModal v-model="formOpen" :title="editing ? 'Ubah Protokol Foto' : 'Protokol Foto Baru'" size="max-w-3xl">
    <form id="form-protokol" class="space-y-4" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="pf-nama">Nama protokol *</label>
          <input id="pf-nama" v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" maxlength="100" required />
          <p v-if="errors.nama" class="field-error">{{ errors.nama }}</p>
        </div>
        <div>
          <label class="label" for="pf-desk">Deskripsi</label>
          <input id="pf-desk" v-model="form.deskripsi" class="input" maxlength="255" />
        </div>
      </div>
      <div class="space-y-2">
        <p class="label">Posisi (urutan pengambilan) *</p>
        <div v-for="(p, i) in form.posisi" :key="i" class="grid gap-2 rounded-2xl border border-line bg-white/40 p-3 sm:grid-cols-[2rem_1fr_9rem_auto]">
          <span class="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{{ i + 1 }}</span>
          <div class="space-y-2">
            <input v-model="p.label" class="input py-1.5" placeholder="Label, mis. 45° kanan" maxlength="50" required :aria-label="`Label posisi ${i + 1}`" />
            <input v-model="p.petunjuk" class="input py-1.5" placeholder="Petunjuk untuk petugas (opsional)" maxlength="255" :aria-label="`Petunjuk posisi ${i + 1}`" />
            <p v-if="errors[`posisi.${i}.kode`] || errors[`posisi.${i}.label`]" class="field-error">{{ errors[`posisi.${i}.kode`] || errors[`posisi.${i}.label`] }}</p>
          </div>
          <input v-model="p.kode" class="input py-1.5 font-mono text-xs" placeholder="kode (otomatis)" maxlength="30" :aria-label="`Kode posisi ${i + 1}`" />
          <div class="flex gap-1">
            <button type="button" class="btn-icon size-8" :aria-label="`Naikkan posisi ${i + 1}`" @click="geser(i, -1)">↑</button>
            <button type="button" class="btn-icon size-8" :aria-label="`Turunkan posisi ${i + 1}`" @click="geser(i, 1)">↓</button>
            <button type="button" class="btn-icon size-8 text-rose-600" :disabled="form.posisi.length === 1" :aria-label="`Hapus posisi ${i + 1}`" @click="form.posisi.splice(i, 1)">&times;</button>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" @click="form.posisi.push({ kode: '', label: '', petunjuk: '' })">+ Tambah posisi</button>
        <p class="text-xs text-slate-400">Kode posisi mencocokkan foto before-after antar kunjungan; kosongkan agar dibuat dari label. Jangan ubah kode yang sudah dipakai.</p>
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" class="accent-brand-600" /> Aktif (dapat dipilih saat mengambil foto)</label>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-protokol" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>
</template>
