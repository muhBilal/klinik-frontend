<script setup>
/**
 * Consent UU PDP per pasien (PRD PS-04): persetujuan pemrosesan data pribadi & kesehatan, dan opt-in pemasaran — dua persetujuan
 * terpisah, masing-masing bertanda tangan, bisa diganti/dicabut, tidak pernah dihapus. Status dibaca semua pemegang `pasien.lihat`.
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import KakiDokumen from '@/components/KakiDokumen.vue'
import KopDokumen from '@/components/KopDokumen.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import SignaturePad from '@/components/SignaturePad.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { HUBUNGAN_PENANDATANGAN, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({ pasien: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const toast = useToastStore()

const JENIS = {
  pemrosesan: { label: 'Pemrosesan data pribadi & kesehatan', singkat: 'Pemrosesan data' },
  marketing: { label: 'Informasi promosi & pemasaran', singkat: 'Marketing' },
}

const data = ref(null)
const loading = ref(false)
const bolehKelola = computed(() => auth.can('pasien.kelola', 'rme.tindakan'))
const riwayatOpen = ref(false)

async function muat() {
  loading.value = true
  try {
    data.value = (await api.get(`/pasiens/${props.pasien.id}/persetujuan-data`, { silent: true })).data
    emit('changed', { pemrosesan: data.value.pemrosesan?.setuju ?? null, marketing: data.value.marketing?.setuju ?? null })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}
watch(() => props.pasien.id, muat, { immediate: true })
defineExpose({ muat })

// ---- Tanda tangan ----
const formOpen = ref(false)
const form = reactive({ jenis: 'pemrosesan', setuju: true, penandatangan_nama: '', hubungan: 'pasien', ttd: '' })
const naskah = ref('')
const naskahLoading = ref(false)
const saving = ref(false)
const errors = ref({})

function bukaForm(jenis) {
  Object.assign(form, { jenis, setuju: true, penandatangan_nama: props.pasien.nama, hubungan: 'pasien', ttd: '' })
  errors.value = {}
  formOpen.value = true
  muatNaskah()
}

async function muatNaskah() {
  naskahLoading.value = true
  try {
    naskah.value = (await api.get(`/pasiens/${props.pasien.id}/persetujuan-data/pratinjau`, { params: { jenis: form.jenis, setuju: form.setuju ? 1 : 0 } })).data.isi
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    naskahLoading.value = false
  }
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    await api.post(`/pasiens/${props.pasien.id}/persetujuan-data`, form)
    toast.success(`${JENIS[form.jenis].singkat}: ${form.setuju ? 'setuju' : 'menolak'} tercatat.`)
    formOpen.value = false
    muat()
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

// ---- Cabut ----
const cabutItem = ref(null)
const alasan = ref('')
const mencabut = ref(false)
async function cabut() {
  mencabut.value = true
  try {
    await api.post(`/persetujuan-datas/${cabutItem.value.uuid}/cabut`, { alasan: alasan.value })
    toast.success('Persetujuan dicabut.')
    cabutItem.value = null
    alasan.value = ''
    muat()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    mencabut.value = false
  }
}

// ---- Lihat / cetak (tercatat audit) ----
const dokumen = ref(null)
async function lihat(uuid) {
  try {
    dokumen.value = (await api.get(`/persetujuan-datas/${uuid}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function status(jenis) {
  const p = data.value?.[jenis]
  if (!p) return { teks: 'Belum ada', kelas: 'bg-amber-500/15 text-amber-800' }
  return p.setuju ? { teks: '✓ Setuju', kelas: 'bg-emerald-600/10 text-emerald-800' } : { teks: 'Menolak', kelas: 'bg-slate-500/15 text-slate-700' }
}
</script>

<template>
  <div class="space-y-2 text-sm">
    <AppSpinner v-if="loading && !data" size="size-3" class="text-slate-400" />
    <template v-else-if="data">
      <p v-if="data.wajib && !data.pemrosesan" class="alert alert-warning">Klinik mewajibkan persetujuan pemrosesan data sebelum pendaftaran & booking.</p>
      <div v-for="(j, key) in JENIS" :key="key" class="flex flex-wrap items-center gap-2">
        <span class="w-28 shrink-0 text-slate-600">{{ j.singkat }}</span>
        <span :class="status(key).kelas" class="rounded-full px-2.5 py-1 text-xs font-semibold">{{ status(key).teks }}</span>
        <span v-if="data[key]" class="text-xs text-slate-500">{{ tanggal(data[key].ditandatangani_at) }}</span>
        <div class="ml-auto flex gap-1">
          <button v-if="data[key]" type="button" class="btn btn-ghost btn-sm" @click="lihat(data[key].uuid)">Lihat</button>
          <button v-if="bolehKelola" type="button" :class="data[key] ? 'btn-ghost' : 'btn-primary'" class="btn btn-sm" @click="bukaForm(key)">
            {{ data[key] ? 'Perbarui' : 'Tanda tangani' }}
          </button>
          <button v-if="bolehKelola && data[key]" type="button" class="btn btn-ghost btn-sm text-rose-600" @click="cabutItem = data[key]">Cabut</button>
        </div>
      </div>
      <button v-if="data.riwayat.length" type="button" class="btn btn-ghost btn-sm" @click="riwayatOpen = !riwayatOpen">Riwayat ({{ data.riwayat.length }})</button>
      <ul v-if="riwayatOpen" class="divide-y divide-line rounded-2xl border border-line bg-white/40 text-xs">
        <li v-for="r in data.riwayat" :key="r.uuid" class="flex flex-wrap items-center gap-2 px-3 py-2">
          <StatusBadge :status="r.status" />
          <span class="font-medium">{{ JENIS[r.jenis]?.singkat }} · {{ r.setuju ? 'setuju' : 'menolak' }}</span>
          <span class="text-slate-500">{{ r.penandatangan_nama }} · {{ waktu(r.ditandatangani_at) }}</span>
          <span v-if="r.alasan_cabut" class="text-slate-500">· dicabut: {{ r.alasan_cabut }}</span>
          <button type="button" class="ml-auto underline" @click="lihat(r.uuid)">lihat</button>
        </li>
      </ul>
    </template>

    <AppModal v-model="formOpen" :title="JENIS[form.jenis].label" size="max-w-3xl">
      <form id="form-persetujuan-data" class="space-y-4" @submit.prevent="simpan">
        <div v-if="form.jenis === 'marketing'" class="grid grid-cols-2 gap-2">
          <label class="choice" :class="{ 'choice-active': form.setuju }"><input v-model="form.setuju" type="radio" :value="true" class="sr-only" @change="muatNaskah" />Setuju dihubungi</label>
          <label class="choice" :class="{ 'choice-active': !form.setuju }"><input v-model="form.setuju" type="radio" :value="false" class="sr-only" @change="muatNaskah" />Tidak setuju</label>
        </div>
        <div v-if="naskahLoading" class="flex items-center gap-2 text-slate-500"><AppSpinner />Menyiapkan naskah...</div>
        <article v-else class="max-h-64 overflow-y-auto rounded-2xl border border-line bg-white px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-slate-800">{{ naskah }}</article>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="pd-nama">Nama penanda tangan *</label>
            <input id="pd-nama" v-model="form.penandatangan_nama" class="input" :class="{ 'input-error': errors.penandatangan_nama }" maxlength="150" required />
          </div>
          <div>
            <label class="label" for="pd-hubungan">Hubungan dengan pasien *</label>
            <select id="pd-hubungan" v-model="form.hubungan" class="input">
              <option v-for="(label, val) in HUBUNGAN_PENANDATANGAN" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
        </div>
        <SignaturePad v-model="form.ttd" :label="`Tanda tangan ${form.penandatangan_nama || 'pasien'} *`" :invalid="!!errors.ttd" />
        <p v-if="errors.ttd || errors.setuju" class="field-error">{{ errors.ttd || errors.setuju }}</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
        <button type="submit" form="form-persetujuan-data" class="btn btn-primary" :disabled="saving || !form.ttd || !naskah"><AppSpinner v-if="saving" />Simpan</button>
      </template>
    </AppModal>

    <AppModal :model-value="!!cabutItem" title="Cabut Persetujuan" @update:model-value="cabutItem = null">
      <p class="mb-3 text-sm text-slate-600">
        <template v-if="cabutItem?.jenis === 'marketing'">Pasien tidak akan menerima pesan pemasaran lagi.</template>
        <template v-else>Data rekam medis tetap disimpan sesuai kewajiban retensi; pemrosesan di luar pelayanan dihentikan.</template>
      </p>
      <label class="label" for="pd-alasan">Alasan *</label>
      <textarea id="pd-alasan" v-model="alasan" rows="2" class="input" maxlength="255" />
      <template #footer>
        <button class="btn btn-secondary" @click="cabutItem = null">Batal</button>
        <button class="btn btn-danger" :disabled="!alasan.trim() || mencabut" @click="cabut"><AppSpinner v-if="mencabut" />Cabut</button>
      </template>
    </AppModal>

    <AppModal :model-value="!!dokumen" title="Persetujuan Data Pribadi" size="max-w-3xl" @update:model-value="dokumen = null">
      <template v-if="dokumen">
        <p v-if="!dokumen.checksum_valid" class="alert alert-danger mb-3">Sidik dokumen tidak cocok: dokumen berubah di luar aplikasi.</p>
        <article id="cetak-persetujuan-data" class="space-y-3 rounded-2xl border border-line bg-white px-6 py-5 text-sm leading-relaxed text-slate-800">
          <KopDokumen :cabang="dokumen.cabang" />
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold uppercase tracking-wide">{{ JENIS[dokumen.jenis]?.label }}</h3>
            <StatusBadge :status="dokumen.status" />
          </div>
          <p class="text-xs text-slate-500">{{ dokumen.pasien?.nama }} · RM {{ dokumen.pasien?.no_rm }} · <b>{{ dokumen.setuju ? 'Setuju' : 'Tidak setuju' }}</b></p>
          <p class="whitespace-pre-line">{{ dokumen.isi }}</p>
          <figure class="max-w-xs">
            <figcaption class="text-xs text-slate-500">{{ HUBUNGAN_PENANDATANGAN[dokumen.hubungan] }}</figcaption>
            <img :src="dokumen.ttd" alt="Tanda tangan" class="h-24 w-full object-contain" draggable="false" @contextmenu.prevent />
            <p class="border-t border-slate-400 pt-1 text-center font-medium">{{ dokumen.penandatangan_nama }}</p>
          </figure>
          <p class="text-[11px] text-slate-500">
            Ditandatangani {{ waktu(dokumen.ditandatangani_at) }} · dicatat oleh {{ dokumen.pembuat?.name ?? '-' }}
            <template v-if="dokumen.berakhir_at"> · berakhir {{ waktu(dokumen.berakhir_at) }}</template> · ID {{ dokumen.uuid }}
          </p>
          <KakiDokumen />
        </article>
      </template>
      <template #footer>
        <button class="btn btn-secondary" @click="dokumen = null">Tutup</button>
        <button class="btn btn-primary" @click="printElement('#cetak-persetujuan-data', 'Persetujuan data pribadi')">Cetak</button>
      </template>
    </AppModal>
  </div>
</template>
