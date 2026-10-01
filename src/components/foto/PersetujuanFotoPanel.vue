<script setup>
/**
 * Consent foto klinis bertingkat per pasien (PRD FT-04): status yang berlaku, tanda tangan baru (menggantikan yang lama),
 * cabut, riwayat, dan lihat/cetak naskah. Foto klinis baru hanya bisa diunggah selama ada persetujuan yang berlaku.
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import KakiDokumen from '@/components/KakiDokumen.vue'
import KopDokumen from '@/components/KopDokumen.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import SignaturePad from '@/components/SignaturePad.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { HUBUNGAN_PENANDATANGAN, TINGKAT_FOTO, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasien: { type: Object, required: true },
  kunjunganId: { type: Number, default: null },
})
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const toast = useToastStore()

const data = ref(null)
const loading = ref(false)
const bolehKelola = computed(() => auth.can('pasien.kelola', 'rme.tindakan'))
const aktif = computed(() => data.value?.aktif ?? null)
const riwayatOpen = ref(false)

async function muat() {
  loading.value = true
  try {
    data.value = (await api.get(`/pasiens/${props.pasien.id}/persetujuan-foto`, { silent: true })).data
    emit('changed', data.value.aktif)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}
watch(() => props.pasien.id, muat, { immediate: true })

// ---- Tanda tangan baru ----
const formOpen = ref(false)
const form = reactive({ tingkat: 'klinis', penandatangan_nama: '', hubungan: 'pasien', ttd: '' })
const naskah = ref('')
const naskahLoading = ref(false)
const saving = ref(false)
const errors = ref({})

function bukaForm() {
  Object.assign(form, { tingkat: aktif.value?.tingkat ?? 'klinis', penandatangan_nama: props.pasien.nama, hubungan: 'pasien', ttd: '' })
  errors.value = {}
  formOpen.value = true
  muatNaskah()
}

async function muatNaskah() {
  naskahLoading.value = true
  try {
    naskah.value = (await api.get(`/pasiens/${props.pasien.id}/persetujuan-foto/pratinjau`, { params: { tingkat: form.tingkat } })).data.isi
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
    await api.post(`/pasiens/${props.pasien.id}/persetujuan-foto`, { ...form, kunjungan_id: props.kunjunganId })
    toast.success('Persetujuan foto tersimpan.')
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
const cabutOpen = ref(false)
const alasan = ref('')
const mencabut = ref(false)

async function cabut() {
  mencabut.value = true
  try {
    await api.post(`/persetujuan-fotos/${aktif.value.uuid}/cabut`, { alasan: alasan.value })
    toast.success('Persetujuan foto dicabut. Foto baru tidak dapat diambil.')
    cabutOpen.value = false
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
    dokumen.value = (await api.get(`/persetujuan-fotos/${uuid}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
}
</script>

<template>
  <div class="space-y-2 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <AppSpinner v-if="loading && !data" size="size-3" class="text-slate-400" />
      <template v-else-if="aktif">
        <span class="rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-800">✓ Persetujuan foto: {{ TINGKAT_FOTO[aktif.tingkat] }}</span>
        <span class="text-xs text-slate-500">{{ tanggal(aktif.ditandatangani_at) }}</span>
      </template>
      <span v-else-if="data" class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800">Belum ada persetujuan foto yang berlaku</span>
      <div class="ml-auto flex gap-1">
        <button v-if="aktif" type="button" class="btn btn-ghost btn-sm" @click="lihat(aktif.uuid)">Lihat</button>
        <button v-if="bolehKelola" type="button" :class="aktif ? 'btn-ghost' : 'btn-primary'" class="btn btn-sm" @click="bukaForm">{{ aktif ? 'Ubah tingkat' : 'Tanda tangani' }}</button>
        <button v-if="bolehKelola && aktif" type="button" class="btn btn-ghost btn-sm text-rose-600" @click="cabutOpen = true">Cabut</button>
        <button v-if="data?.riwayat?.length" type="button" class="btn btn-ghost btn-sm" @click="riwayatOpen = !riwayatOpen">Riwayat ({{ data.riwayat.length }})</button>
      </div>
    </div>
    <ul v-if="riwayatOpen" class="divide-y divide-line rounded-2xl border border-line bg-white/40 text-xs">
      <li v-for="r in data.riwayat" :key="r.uuid" class="flex flex-wrap items-center gap-2 px-3 py-2">
        <StatusBadge :status="r.status" />
        <span class="font-medium">{{ TINGKAT_FOTO[r.tingkat] }}</span>
        <span class="text-slate-500">{{ r.penandatangan_nama }} · {{ waktu(r.ditandatangani_at) }}</span>
        <span v-if="r.alasan_cabut" class="text-slate-500">· dicabut: {{ r.alasan_cabut }}</span>
        <button type="button" class="ml-auto underline" @click="lihat(r.uuid)">lihat</button>
      </li>
    </ul>

    <!-- Tanda tangan persetujuan -->
    <AppModal v-model="formOpen" title="Persetujuan Foto Klinis" size="max-w-3xl">
      <form id="form-persetujuan-foto" class="space-y-4" @submit.prevent="simpan">
        <fieldset>
          <legend class="label">Penggunaan foto yang diizinkan *</legend>
          <div class="grid gap-2 sm:grid-cols-3">
            <label
              v-for="t in data?.tingkat ?? []"
              :key="t.value"
              :class="{ 'choice-active': form.tingkat === t.value }"
              class="choice text-left"
            >
              <input v-model="form.tingkat" type="radio" :value="t.value" class="sr-only" @change="muatNaskah" />
              <span class="font-semibold">{{ t.label }}</span>
              <span class="block text-xs opacity-75">{{ t.keterangan }}</span>
            </label>
          </div>
        </fieldset>
        <div v-if="naskahLoading" class="flex items-center gap-2 text-slate-500"><AppSpinner />Menyiapkan naskah...</div>
        <article v-else class="max-h-64 overflow-y-auto rounded-2xl border border-line bg-white px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-slate-800">{{ naskah }}</article>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="pf-nama">Nama penanda tangan *</label>
            <input id="pf-nama" v-model="form.penandatangan_nama" class="input" :class="{ 'input-error': errors.penandatangan_nama }" maxlength="150" required />
          </div>
          <div>
            <label class="label" for="pf-hubungan">Hubungan dengan pasien *</label>
            <select id="pf-hubungan" v-model="form.hubungan" class="input">
              <option v-for="(label, val) in HUBUNGAN_PENANDATANGAN" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
        </div>
        <SignaturePad v-model="form.ttd" :label="`Tanda tangan ${form.penandatangan_nama || 'pasien'} *`" :invalid="!!errors.ttd" />
        <p v-if="errors.ttd" class="field-error">{{ errors.ttd }}</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
        <button type="submit" form="form-persetujuan-foto" class="btn btn-primary" :disabled="saving || !form.ttd || !naskah">
          <AppSpinner v-if="saving" />Simpan persetujuan
        </button>
      </template>
    </AppModal>

    <!-- Cabut -->
    <AppModal v-model="cabutOpen" title="Cabut Persetujuan Foto">
      <p class="mb-3 text-sm text-slate-600">Foto yang sudah menjadi bagian rekam medis tetap tersimpan, tetapi tidak lagi dipakai di luar keperluan klinis dan foto baru tidak dapat diambil.</p>
      <label class="label" for="pf-alasan">Alasan *</label>
      <textarea id="pf-alasan" v-model="alasan" rows="2" class="input" maxlength="500" />
      <template #footer>
        <button class="btn btn-secondary" @click="cabutOpen = false">Batal</button>
        <button class="btn btn-danger" :disabled="!alasan.trim() || mencabut" @click="cabut"><AppSpinner v-if="mencabut" />Cabut persetujuan</button>
      </template>
    </AppModal>

    <!-- Lihat / cetak -->
    <AppModal :model-value="!!dokumen" title="Persetujuan Foto Klinis" size="max-w-3xl" @update:model-value="dokumen = null">
      <template v-if="dokumen">
        <p v-if="!dokumen.checksum_valid" class="alert alert-danger mb-3">Sidik dokumen tidak cocok: dokumen berubah di luar aplikasi.</p>
        <article id="cetak-persetujuan-foto" class="space-y-3 rounded-2xl border border-line bg-white px-6 py-5 text-sm leading-relaxed text-slate-800">
          <KopDokumen :cabang="dokumen.cabang" />
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold uppercase tracking-wide">Persetujuan Pengambilan & Penggunaan Foto Klinis</h3>
            <StatusBadge :status="dokumen.status" />
          </div>
          <p class="text-xs text-slate-500">{{ dokumen.pasien?.nama }} · RM {{ dokumen.pasien?.no_rm }} · Tingkat: <b>{{ TINGKAT_FOTO[dokumen.tingkat] }}</b></p>
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
        <button class="btn btn-primary" @click="printElement('#cetak-persetujuan-foto', 'Persetujuan foto klinis')">Cetak</button>
      </template>
    </AppModal>
  </div>
</template>
