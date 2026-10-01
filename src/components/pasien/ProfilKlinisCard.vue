<script setup>
/**
 * Profil klinis pasien (PRD PS-03): peringatan (alergi, hamil/menyusui, Fitzpatrick), alergi terstruktur, riwayat obat & penyakit.
 * Data klinis: hanya dimuat untuk `rme.lihat`; diubah tenaga pemeriksaan (`pemeriksaan.vital` / `pemeriksaan.dokter`).
 * `ringkas` = hanya baris peringatan (header pemeriksaan). Expose `peringatan`, `obatAlergi` (Map obat_id → zat) & `muat()`.
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { hariIni, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasien: { type: Object, required: true },
  ringkas: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const toast = useToastStore()

const JENIS = { obat: 'Obat', makanan: 'Makanan', lingkungan: 'Lingkungan', lainnya: 'Lainnya' }
const KEPARAHAN = { ringan: 'Ringan', sedang: 'Sedang', berat: 'Berat' }
const KEHAMILAN = { tidak: 'Tidak hamil / menyusui', hamil: 'Hamil', menyusui: 'Menyusui' }
const FITZPATRICK = {
  1: 'I — selalu terbakar, tidak pernah gelap',
  2: 'II — mudah terbakar, sedikit gelap',
  3: 'III — kadang terbakar, gelap bertahap',
  4: 'IV — jarang terbakar, mudah gelap',
  5: 'V — sangat jarang terbakar, sangat mudah gelap',
  6: 'VI — tidak pernah terbakar, sangat gelap',
}
const WARNA = { bahaya: 'bg-rose-600 text-white', waspada: 'bg-amber-500/90 text-white', info: 'bg-slate-600/80 text-white' }

const bisaLihat = computed(() => auth.can('rme.lihat'))
const bisaUbah = computed(() => auth.can('pemeriksaan.vital', 'pemeriksaan.dokter'))
const data = ref(null)
const loading = ref(false)

const peringatan = computed(() => data.value?.peringatan ?? [])
const obatAlergi = computed(() => new Map((data.value?.alergis ?? []).filter((a) => a.obat_id).map((a) => [a.obat_id, a.zat])))

async function muat() {
  if (!bisaLihat.value) return
  loading.value = true
  try {
    data.value = (await api.get(`/pasiens/${props.pasien.id}/profil-klinis`, { silent: true })).data
    emit('changed', data.value)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}
watch(() => props.pasien.id, muat, { immediate: true })
defineExpose({ muat, peringatan, obatAlergi })

// ---- Ubah ----
const formOpen = ref(false)
const form = reactive({ fitzpatrick: '', status_kehamilan: '', hpht: '', riwayat_obat: '', riwayat_penyakit: '', alergis: [] })
const errors = ref({})
const saving = ref(false)

function bukaForm() {
  const p = data.value?.profil
  Object.assign(form, {
    fitzpatrick: p?.fitzpatrick ?? '',
    status_kehamilan: p?.status_kehamilan ?? '',
    hpht: p?.hpht ?? '',
    riwayat_obat: p?.riwayat_obat ?? '',
    riwayat_penyakit: p?.riwayat_penyakit ?? '',
    alergis: (data.value?.alergis ?? []).map((a) => ({ id: a.id, jenis: a.jenis, zat: a.zat, obat_id: a.obat_id, obat: a.obat, reaksi: a.reaksi ?? '', keparahan: a.keparahan, catatan: a.catatan ?? '' })),
  })
  // Catatan alergi lama (teks bebas) sebagai bantuan saat pertama kali dipindah ke data terstruktur
  if (!form.alergis.length && props.pasien.alergi) form.alergis.push({ jenis: 'lainnya', zat: props.pasien.alergi, obat_id: null, reaksi: '', keparahan: 'sedang', catatan: '' })
  errors.value = {}
  formOpen.value = true
}

function tambahAlergi() {
  form.alergis.push({ jenis: 'obat', zat: '', obat_id: null, obat: null, reaksi: '', keparahan: 'sedang', catatan: '' })
}
function pilihObat(a, obat) {
  a.obat_id = obat.id
  a.obat = obat
  if (!a.zat) a.zat = obat.nama
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    data.value = (await api.put(`/pasiens/${props.pasien.id}/profil-klinis`, {
      fitzpatrick: form.fitzpatrick || null,
      status_kehamilan: form.status_kehamilan || null,
      hpht: form.status_kehamilan === 'hamil' ? form.hpht || null : null,
      riwayat_obat: form.riwayat_obat || null,
      riwayat_penyakit: form.riwayat_penyakit || null,
      alergis: form.alergis.map((a) => ({
        id: a.id, jenis: a.jenis, zat: a.zat, obat_id: a.jenis === 'obat' ? a.obat_id : null, reaksi: a.reaksi || null, keparahan: a.keparahan, catatan: a.catatan || null,
      })),
    })).data
    emit('changed', data.value)
    toast.success('Profil klinis tersimpan.')
    formOpen.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Ringkas: hanya peringatan (header pemeriksaan) -->
  <div v-if="ringkas" class="flex flex-wrap items-center gap-1.5">
    <span v-for="(p, i) in peringatan" :key="i" :class="WARNA[p.tingkat]" class="rounded-full px-2.5 py-0.5 text-xs font-semibold">{{ p.teks }}</span>
    <button v-if="bisaUbah && data" type="button" class="text-xs text-slate-500 underline" @click="bukaForm">{{ peringatan.length ? 'ubah' : '+ alergi / profil klinis' }}</button>
  </div>

  <div v-else-if="bisaLihat" class="card">
    <div class="card-header">
      <h2 class="card-title">Profil Klinis</h2>
      <div class="flex items-center gap-2">
        <AppSpinner v-if="loading" class="text-slate-400" />
        <button v-if="bisaUbah && data" class="btn btn-ghost btn-sm" @click="bukaForm">Ubah</button>
      </div>
    </div>
    <div v-if="data" class="card-body space-y-3 text-sm">
      <div v-if="peringatan.length" class="flex flex-wrap gap-1.5">
        <span v-for="(p, i) in peringatan" :key="i" :class="WARNA[p.tingkat]" class="rounded-full px-2.5 py-0.5 text-xs font-semibold">{{ p.teks }}</span>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt class="text-slate-500">Tipe kulit</dt><dd>{{ data.profil?.fitzpatrick ? `Fitzpatrick ${FITZPATRICK[data.profil.fitzpatrick]}` : '-' }}</dd>
        <template v-if="pasien.jenis_kelamin === 'P'">
          <dt class="text-slate-500">Kehamilan</dt><dd>{{ data.profil?.status_kehamilan ? KEHAMILAN[data.profil.status_kehamilan] : '-' }}</dd>
        </template>
        <dt class="text-slate-500">Obat rutin</dt><dd class="whitespace-pre-line">{{ data.profil?.riwayat_obat || '-' }}</dd>
        <dt class="text-slate-500">Riwayat penyakit</dt><dd class="whitespace-pre-line">{{ data.profil?.riwayat_penyakit || '-' }}</dd>
      </dl>
      <div>
        <p class="mb-1 text-xs font-semibold text-slate-600">Alergi</p>
        <ul v-if="data.alergis.length" class="space-y-1">
          <li v-for="a in data.alergis" :key="a.id" class="flex flex-wrap gap-x-2 text-sm">
            <b :class="{ 'text-rose-600': a.keparahan === 'berat' }">{{ a.zat }}</b>
            <span class="text-xs text-slate-500">{{ JENIS[a.jenis] }} · {{ KEPARAHAN[a.keparahan] }}<template v-if="a.reaksi"> · {{ a.reaksi }}</template></span>
          </li>
        </ul>
        <p v-else class="text-xs text-slate-400">{{ pasien.alergi ? `Catatan lama: ${pasien.alergi}` : 'Tidak ada alergi tercatat.' }}</p>
      </div>
      <p v-if="data.profil?.updated_at" class="text-[11px] text-slate-400">Diperbarui {{ waktu(data.profil.updated_at) }} oleh {{ data.profil.pembaru?.name ?? '-' }}</p>
    </div>
  </div>

  <AppModal v-model="formOpen" title="Profil Klinis & Alergi" size="max-w-3xl">
    <form id="form-profil-klinis" class="space-y-5" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="pk-fitz">Tipe kulit Fitzpatrick</label>
          <select id="pk-fitz" v-model="form.fitzpatrick" class="input">
            <option value="">Belum dinilai</option>
            <option v-for="(l, v) in FITZPATRICK" :key="v" :value="Number(v)">{{ l }}</option>
          </select>
        </div>
        <div v-if="pasien.jenis_kelamin === 'P'">
          <label class="label" for="pk-hamil">Status kehamilan</label>
          <select id="pk-hamil" v-model="form.status_kehamilan" class="input" :class="{ 'input-error': errors.status_kehamilan }">
            <option value="">Belum ditanyakan</option>
            <option v-for="(l, v) in KEHAMILAN" :key="v" :value="v">{{ l }}</option>
          </select>
          <p v-if="errors.status_kehamilan" class="field-error">{{ errors.status_kehamilan }}</p>
        </div>
        <div v-if="form.status_kehamilan === 'hamil'">
          <label class="label" for="pk-hpht">HPHT</label>
          <input id="pk-hpht" v-model="form.hpht" type="date" :max="hariIni()" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="pk-obat">Obat yang rutin dikonsumsi</label>
          <textarea id="pk-obat" v-model="form.riwayat_obat" rows="2" class="input" maxlength="2000" placeholder="mis. Isotretinoin, antikoagulan, kontrasepsi oral" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="pk-penyakit">Riwayat penyakit</label>
          <textarea id="pk-penyakit" v-model="form.riwayat_penyakit" rows="2" class="input" maxlength="2000" placeholder="mis. keloid, herpes, autoimun, diabetes" />
        </div>
      </div>

      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-800">Alergi</h3>
          <button type="button" class="btn btn-secondary btn-sm" @click="tambahAlergi">+ Alergi</button>
        </div>
        <div v-for="(a, i) in form.alergis" :key="i" class="grid gap-2 rounded-2xl border border-line bg-white/40 p-3 sm:grid-cols-[8rem_1fr_7rem_auto]">
          <select v-model="a.jenis" class="input py-1" :aria-label="`Jenis alergi ${i + 1}`">
            <option v-for="(l, v) in JENIS" :key="v" :value="v">{{ l }}</option>
          </select>
          <div>
            <input v-model="a.zat" class="input py-1" :class="{ 'input-error': errors[`alergis.${i}.zat`] }" placeholder="Zat / obat penyebab" :aria-label="`Zat alergi ${i + 1}`" required />
            <div v-if="a.jenis === 'obat'" class="mt-1">
              <p v-if="a.obat" class="text-xs text-slate-600">Terkait obat: <b>{{ a.obat.nama }}</b> <button type="button" class="underline" @click="a.obat_id = null; a.obat = null">lepas</button></p>
              <AsyncSelect v-else endpoint="/obats" placeholder="Hubungkan ke master obat (peringatan resep)..." @select="(o) => pilihObat(a, o)">
                <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.kode }}</span></template>
              </AsyncSelect>
            </div>
          </div>
          <select v-model="a.keparahan" class="input py-1" :aria-label="`Keparahan ${i + 1}`">
            <option v-for="(l, v) in KEPARAHAN" :key="v" :value="v">{{ l }}</option>
          </select>
          <button type="button" class="text-slate-400 hover:text-rose-600" :aria-label="`Hapus alergi ${i + 1}`" @click="form.alergis.splice(i, 1)">&times;</button>
          <input v-model="a.reaksi" class="input py-1 sm:col-span-4" maxlength="255" placeholder="Reaksi (mis. gatal, bengkak, sesak)" :aria-label="`Reaksi ${i + 1}`" />
        </div>
        <p v-if="!form.alergis.length" class="text-xs text-slate-400">Tidak ada alergi.</p>
      </section>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
      <button type="submit" form="form-profil-klinis" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>
</template>
