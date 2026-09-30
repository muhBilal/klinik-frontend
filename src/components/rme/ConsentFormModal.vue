<script setup>
/**
 * Ambil informed consent di tablet (PRD RM-03): pilih naskah, pasien membaca, memilih setuju/menolak, lalu tanda tangan.
 * Naskah di-render backend (placeholder terisi) dan di-snapshot saat disimpan — yang tampil di sini persis yang tersimpan.
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import SignaturePad from '@/components/SignaturePad.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { HUBUNGAN_PENANDATANGAN } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  kunjungan: { type: Object, required: true },
  /** Baris tindakan kunjungan `{ id, nama, template_consent_id }`; null = consent umum kunjungan. */
  tindakan: { type: Object, default: null },
})
const emit = defineEmits(['saved'])
const toast = useToastStore()

const templates = ref([])
const naskah = ref(null)
const naskahLoading = ref(false)
const saving = ref(false)
const errors = ref({})
const form = reactive({})
const pakaiSaksi = ref(false)

const bisaSimpan = computed(() => naskah.value && form.ttd_penandatangan && form.penandatangan_nama && (!pakaiSaksi.value || (form.saksi_nama && form.ttd_saksi)))

watch(open, async (buka) => {
  if (!buka) return
  errors.value = {}
  naskah.value = null
  pakaiSaksi.value = false
  Object.assign(form, {
    template_consent_id: props.tindakan?.template_consent_id ?? '',
    keputusan: 'setuju',
    penandatangan_nama: props.kunjungan.pasien?.nama ?? '',
    hubungan: 'pasien',
    ttd_penandatangan: '',
    saksi_nama: '',
    ttd_saksi: '',
  })
  try {
    templates.value = await cachedGet('/template-consents', { aktif: 1 })
    if (!form.template_consent_id && templates.value.length === 1) form.template_consent_id = templates.value[0].id
    if (form.template_consent_id) muatNaskah()
  } catch (e) {
    toast.error(errorMessage(e))
  }
})

async function muatNaskah() {
  naskah.value = null
  if (!form.template_consent_id) return
  naskahLoading.value = true
  try {
    naskah.value = (await api.get(`/kunjungans/${props.kunjungan.id}/informed-consents/pratinjau`, {
      params: { template_consent_id: form.template_consent_id, kunjungan_tindakan_id: props.tindakan?.id },
    })).data
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
    const { data } = await api.post(`/kunjungans/${props.kunjungan.id}/informed-consents`, {
      template_consent_id: form.template_consent_id,
      kunjungan_tindakan_id: props.tindakan?.id ?? null,
      keputusan: form.keputusan,
      penandatangan_nama: form.penandatangan_nama,
      hubungan: form.hubungan,
      ttd_penandatangan: form.ttd_penandatangan,
      saksi_nama: pakaiSaksi.value ? form.saksi_nama : null,
      ttd_saksi: pakaiSaksi.value ? form.ttd_saksi : null,
    })
    toast.success(data.status === 'disetujui' ? 'Informed consent tersimpan.' : 'Penolakan tindakan tercatat.')
    emit('saved', data)
    open.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" :title="`Informed Consent${tindakan ? ` · ${tindakan.nama}` : ''}`" size="max-w-3xl">
    <form id="form-consent" class="space-y-5" @submit.prevent="simpan">
      <div>
        <label class="label" for="consent-template">Naskah persetujuan *</label>
        <select id="consent-template" v-model="form.template_consent_id" class="input" :class="{ 'input-error': errors.template_consent_id }" required @change="muatNaskah">
          <option value="">— Pilih naskah —</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.nama }}</option>
        </select>
        <p v-if="errors.template_consent_id" class="field-error">{{ errors.template_consent_id }}</p>
        <p v-if="!templates.length" class="mt-1 text-xs text-slate-400">Belum ada naskah aktif. Tambahkan di Master Data → Template Consent.</p>
      </div>

      <div v-if="naskahLoading" class="flex items-center gap-2 text-sm text-slate-500"><AppSpinner />Menyiapkan naskah...</div>
      <article v-else-if="naskah" class="max-h-80 overflow-y-auto rounded-2xl border border-line bg-white px-5 py-4 text-sm leading-relaxed text-slate-800">
        <h3 class="mb-3 text-center text-base font-semibold uppercase tracking-wide">{{ naskah.judul }}</h3>
        <p class="whitespace-pre-line">{{ naskah.isi }}</p>
      </article>

      <template v-if="naskah">
        <fieldset>
          <legend class="label">Keputusan pasien *</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label :class="{ 'choice-active': form.keputusan === 'setuju' }" class="choice">
              <input v-model="form.keputusan" type="radio" value="setuju" class="sr-only" />
              <span class="font-semibold">Setuju</span>
              <span class="block text-xs opacity-75">Memberikan persetujuan atas tindakan</span>
            </label>
            <label :class="{ 'choice-active': form.keputusan === 'tolak' }" class="choice">
              <input v-model="form.keputusan" type="radio" value="tolak" class="sr-only" />
              <span class="font-semibold">Menolak</span>
              <span class="block text-xs opacity-75">Penolakan tindakan tetap ditandatangani & dicatat</span>
            </label>
          </div>
        </fieldset>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="consent-nama">Nama penanda tangan *</label>
            <input id="consent-nama" v-model="form.penandatangan_nama" class="input" :class="{ 'input-error': errors.penandatangan_nama }" maxlength="150" required />
            <p v-if="errors.penandatangan_nama" class="field-error">{{ errors.penandatangan_nama }}</p>
          </div>
          <div>
            <label class="label" for="consent-hubungan">Hubungan dengan pasien *</label>
            <select id="consent-hubungan" v-model="form.hubungan" class="input">
              <option v-for="(label, val) in HUBUNGAN_PENANDATANGAN" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
        </div>

        <SignaturePad v-model="form.ttd_penandatangan" :label="`Tanda tangan ${form.penandatangan_nama || 'pasien'} *`" :invalid="!!errors.ttd_penandatangan" />
        <p v-if="errors.ttd_penandatangan" class="field-error">{{ errors.ttd_penandatangan }}</p>

        <label class="flex items-center gap-2 text-sm">
          <input v-model="pakaiSaksi" type="checkbox" class="accent-brand-600" /> Dengan saksi
        </label>
        <div v-if="pakaiSaksi" class="space-y-3 rounded-2xl border border-line bg-white/40 p-4">
          <div>
            <label class="label" for="consent-saksi">Nama saksi *</label>
            <input id="consent-saksi" v-model="form.saksi_nama" class="input" :class="{ 'input-error': errors.saksi_nama }" maxlength="150" />
            <p v-if="errors.saksi_nama" class="field-error">{{ errors.saksi_nama }}</p>
          </div>
          <SignaturePad v-model="form.ttd_saksi" label="Tanda tangan saksi *" :invalid="!!errors.ttd_saksi" />
          <p v-if="errors.ttd_saksi" class="field-error">{{ errors.ttd_saksi }}</p>
        </div>

        <p v-if="errors.kunjungan_tindakan_id || errors.status" class="alert alert-danger">{{ errors.kunjungan_tindakan_id || errors.status }}</p>
      </template>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-consent" class="btn btn-primary" :disabled="saving || !bisaSimpan">
        <AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : form.keputusan === 'tolak' ? 'Simpan penolakan' : 'Simpan persetujuan' }}
      </button>
    </template>
  </AppModal>
</template>
