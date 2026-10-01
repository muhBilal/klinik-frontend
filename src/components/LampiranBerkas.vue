<script setup>
/**
 * Lampiran klinis terenkripsi (foto klinis, informed consent, radiologi, ...).
 * Daftar butuh izin rme.lihat; unggah & hapus butuh berkas.kelola. Berkas dibuka lewat tautan bertanda tangan
 * (`GET /berkas/{uuid}/tautan`) yang berlaku beberapa menit — setiap pembukaan tercatat di audit log,
 * jadi tautan hanya diminta saat pengguna menekan "Lihat".
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { KATEGORI_BERKAS, toOptions, ukuranBerkas, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasienId: { type: Number, required: true },
  /** Diisi = lampiran kunjungan ini saja (unggahan baru ikut terikat ke kunjungan). Kosong = semua lampiran pasien. */
  kunjunganId: { type: Number, default: null },
  readonly: { type: Boolean, default: false },
  /** Sembunyikan foto klinis (ditampilkan kartu Foto Klinis tersendiri, F1-06). */
  tanpaFoto: { type: Boolean, default: false },
})

const auth = useAuthStore()
const toast = useToastStore()

const bisaKelola = computed(() => !props.readonly && auth.can('berkas.kelola'))
const items = ref([])
const loading = ref(false)
const form = reactive({ file: null, kategori: props.tanpaFoto ? 'hasil_penunjang' : 'foto_klinis', keterangan: '' })
const errors = ref({})
const uploading = ref(false)
const inputFile = ref(null)
const preview = ref(null)
const membuka = ref(null)
const menghapus = ref(null)
const kategoriOptions = toOptions(KATEGORI_BERKAS).filter((o) => !props.tanpaFoto || o.value !== 'foto_klinis')
const daftar = computed(() => (props.tanpaFoto ? items.value.filter((b) => b.kategori !== 'foto_klinis') : items.value))

async function load() {
  loading.value = true
  try {
    const params = props.kunjunganId ? { kunjungan_id: props.kunjunganId } : { pasien_id: props.pasienId }
    items.value = (await api.get('/berkas', { params, silent: true })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

function pilihFile(e) {
  form.file = e.target.files?.[0] ?? null
}

async function unggah() {
  if (!form.file) return
  uploading.value = true
  errors.value = {}
  const data = new FormData()
  data.append('file', form.file)
  data.append('kategori', form.kategori)
  data.append('pasien_id', String(props.pasienId))
  if (props.kunjunganId) data.append('kunjungan_id', String(props.kunjunganId))
  if (form.keterangan) data.append('keterangan', form.keterangan)
  try {
    const { data: berkas } = await api.post('/berkas', data)
    items.value.unshift(berkas)
    form.file = null
    form.keterangan = ''
    if (inputFile.value) inputFile.value.value = ''
    toast.success('Berkas diunggah dan disimpan terenkripsi.')
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    uploading.value = false
  }
}

async function buka(b) {
  const gambar = b.mime.startsWith('image/')
  // Jendela dibuka sebelum request agar tidak diblokir popup blocker
  const jendela = gambar ? null : window.open('about:blank', '_blank')
  membuka.value = b.uuid
  try {
    const { data } = await api.get(`/berkas/${b.uuid}/tautan`)
    if (gambar) preview.value = { berkas: b, url: data.url }
    else if (jendela) jendela.location.href = data.url
  } catch (e) {
    jendela?.close()
    toast.error(errorMessage(e))
  } finally {
    membuka.value = null
  }
}

async function hapus(b) {
  if (!confirm(`Hapus lampiran "${b.nama_file}" dari daftar? Berkas tetap disimpan untuk retensi rekam medis.`)) return
  menghapus.value = b.uuid
  try {
    await api.delete(`/berkas/${b.uuid}`)
    items.value = items.value.filter((i) => i.uuid !== b.uuid)
    toast.success('Lampiran dihapus dari daftar.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    menghapus.value = null
  }
}

onMounted(load)
watch(() => [props.pasienId, props.kunjunganId], load)
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">{{ tanpaFoto ? 'Lampiran' : 'Lampiran & Foto Klinis' }}</h2>
      <AppSpinner v-if="loading" class="text-slate-400" />
    </div>
    <div class="card-body space-y-4">
      <form v-if="bisaKelola" class="grid gap-3 sm:grid-cols-[1fr_auto]" @submit.prevent="unggah">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="sm:col-span-3">
            <input
              ref="inputFile"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              class="input py-1.5 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900/5 file:px-3 file:py-1 file:text-sm"
              :class="{ 'input-error': errors.file }"
              @change="pilihFile"
            />
            <p v-if="errors.file" class="field-error">{{ errors.file }}</p>
          </div>
          <select v-model="form.kategori" class="input" aria-label="Kategori">
            <option v-for="o in kategoriOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <input v-model="form.keterangan" class="input sm:col-span-2" maxlength="255" placeholder="Keterangan (mis. sebelum tindakan, tampak depan)" />
        </div>
        <button type="submit" class="btn btn-primary self-start" :disabled="!form.file || uploading">
          <AppSpinner v-if="uploading" />{{ uploading ? 'Mengunggah...' : 'Unggah' }}
        </button>
      </form>

      <ul v-if="daftar.length" class="divide-y divide-line">
        <li v-for="b in daftar" :key="b.uuid" class="flex flex-wrap items-center gap-3 py-2.5 text-sm">
          <span class="chip">{{ KATEGORI_BERKAS[b.kategori] ?? b.kategori }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-800">{{ b.nama_file }}</p>
            <p class="text-xs text-slate-500">
              {{ b.keterangan ? `${b.keterangan} · ` : '' }}{{ ukuranBerkas(b.ukuran) }} · {{ b.pengunggah?.name ?? '-' }} · {{ waktu(b.created_at) }}
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" :disabled="membuka === b.uuid" @click="buka(b)">
            <AppSpinner v-if="membuka === b.uuid" size="size-3" />Lihat
          </button>
          <button v-if="bisaKelola" class="btn btn-ghost btn-sm text-rose-600" :disabled="menghapus === b.uuid" @click="hapus(b)">Hapus</button>
        </li>
      </ul>
      <p v-else-if="!loading" class="py-4 text-center text-sm text-slate-400">Belum ada lampiran.</p>

      <p class="text-xs text-slate-400">Berkas disimpan terenkripsi. Tautan hanya berlaku beberapa menit dan setiap pembukaan tercatat di audit log.</p>
    </div>
  </div>

  <AppModal :model-value="!!preview" :title="preview?.berkas.nama_file ?? ''" size="max-w-3xl" @update:model-value="preview = null">
    <img
      v-if="preview"
      :src="preview.url"
      :alt="preview.berkas.keterangan ?? preview.berkas.nama_file"
      class="mx-auto max-h-[70vh] rounded-2xl select-none"
      draggable="false"
      @contextmenu.prevent
    />
    <p v-if="preview?.berkas.keterangan" class="mt-3 text-center text-sm text-slate-500">{{ preview.berkas.keterangan }}</p>
  </AppModal>
</template>
