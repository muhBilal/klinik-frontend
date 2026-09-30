<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { invalidate } from '@/lib/cache'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()

const perans = ref([])
const katalog = ref([]) // [{ grup, izin: [{ kode, label }] }]
const loading = ref(true)
const open = ref(false)
const editing = ref(null)
const form = reactive({ kode: '', nama: '', deskripsi: '', izin: [] })
const errors = ref({})
const saving = ref(false)
const deleting = ref(null)

const labelIzin = computed(() => Object.fromEntries(katalog.value.flatMap((g) => g.izin.map((i) => [i.kode, i.label]))))

async function load() {
  loading.value = true
  try {
    ;[perans.value, katalog.value] = await Promise.all([api.get('/perans').then((r) => r.data), api.get('/izins').then((r) => r.data)])
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

function buka(peran = null) {
  editing.value = peran
  errors.value = {}
  Object.assign(form, {
    kode: peran?.kode ?? '',
    nama: peran?.nama ?? '',
    deskripsi: peran?.deskripsi ?? '',
    izin: [...(peran?.izin ?? [])],
  })
  open.value = true
}

function toggleGrup(grup, pilih) {
  const kodes = grup.izin.map((i) => i.kode)
  form.izin = pilih ? [...new Set([...form.izin, ...kodes])] : form.izin.filter((k) => !kodes.includes(k))
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    const payload = { ...form, deskripsi: form.deskripsi || null }
    if (editing.value) await api.put(`/perans/${editing.value.id}`, payload)
    else await api.post('/perans', payload)
    toast.success('Peran tersimpan. Pengguna dengan peran ini mendapat izin baru pada permintaan berikutnya.')
    open.value = false
    invalidate('/perans', '/dokters')
    if (editing.value?.kode === auth.user?.role) auth.fetchMe()
    load()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function hapus(peran) {
  if (!confirm(`Hapus peran "${peran.nama}"?`)) return
  deleting.value = peran.id
  try {
    await api.delete(`/perans/${peran.id}`)
    toast.success('Peran dihapus.')
    invalidate('/perans')
    load()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = null
  }
}

onMounted(load)
</script>

<template>
  <PageHeader title="Peran & Izin" subtitle="Hak akses ditentukan izin setiap peran. Pengguna tanpa izin rme.lihat tidak dapat melihat isi rekam medis.">
    <button class="btn btn-primary" @click="buka()">+ Tambah peran</button>
  </PageHeader>

  <div class="card">
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr><th>Peran</th><th>Izin</th><th class="text-right">Pengguna</th><th /></tr>
        </thead>
        <tbody>
          <TableSkeleton v-if="loading && !perans.length" :cols="4" />
          <tr v-for="p in perans" :key="p.id">
            <td class="align-top">
              <p class="font-medium">{{ p.nama }} <span v-if="p.is_sistem" class="chip ml-1 text-[10px]">sistem</span></p>
              <p class="text-xs text-slate-500"><code>{{ p.kode }}</code><template v-if="p.deskripsi"> · {{ p.deskripsi }}</template></p>
            </td>
            <td class="max-w-xl text-xs text-slate-600">
              <span v-if="p.akses_penuh" class="font-medium text-slate-900">Akses penuh (semua izin)</span>
              <template v-else-if="p.izin.length">{{ p.izin.map((k) => labelIzin[k] ?? k).join(' · ') }}</template>
              <span v-else class="text-slate-400">Tanpa izin</span>
            </td>
            <td class="text-right tabular-nums">{{ p.users_count }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="btn btn-ghost btn-sm" @click="buka(p)">Ubah</button>
              <button v-if="!p.is_sistem" class="btn btn-ghost btn-sm text-rose-600" :disabled="deleting === p.id" @click="hapus(p)">
                <AppSpinner v-if="deleting === p.id" size="size-3" />Hapus
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <AppModal v-model="open" :title="editing ? `Ubah peran ${editing.nama}` : 'Tambah peran'" size="max-w-3xl">
    <form id="form-peran" class="space-y-5" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="peran-kode">Kode *</label>
          <input id="peran-kode" v-model="form.kode" class="input font-mono" :class="{ 'input-error': errors.kode }" :disabled="editing?.is_sistem" placeholder="mis. terapis_senior" required />
          <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
          <p v-else-if="editing?.is_sistem" class="mt-1 text-xs text-slate-400">Kode peran sistem tidak dapat diubah.</p>
        </div>
        <div>
          <label class="label" for="peran-nama">Nama *</label>
          <input id="peran-nama" v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" required />
          <p v-if="errors.nama" class="field-error">{{ errors.nama }}</p>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="peran-deskripsi">Deskripsi</label>
          <input id="peran-deskripsi" v-model="form.deskripsi" class="input" maxlength="255" />
        </div>
      </div>

      <p v-if="editing?.akses_penuh" class="alert alert-warning py-2">Administrator selalu memegang semua izin; daftar izin tidak dapat diubah.</p>
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <fieldset v-for="g in katalog" :key="g.grup" class="rounded-2xl border border-line bg-white/50 p-4">
          <legend class="flex w-full items-center justify-between px-1 text-sm font-semibold text-slate-800">
            {{ g.grup }}
            <span class="flex gap-2 text-xs font-normal">
              <button type="button" class="text-slate-500 hover:underline" @click="toggleGrup(g, true)">semua</button>
              <button type="button" class="text-slate-500 hover:underline" @click="toggleGrup(g, false)">kosongkan</button>
            </span>
          </legend>
          <label v-for="i in g.izin" :key="i.kode" class="mt-2 flex items-start gap-2 text-sm">
            <input v-model="form.izin" type="checkbox" :value="i.kode" class="mt-0.5 accent-brand-600" />
            <span>{{ i.label }} <code class="text-[11px] text-slate-400">{{ i.kode }}</code></span>
          </label>
        </fieldset>
        <p v-if="errors.izin" class="field-error sm:col-span-2">{{ errors.izin }}</p>
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-peran" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
    </template>
  </AppModal>
</template>
