<script setup>
/**
 * Persetujuan data pribadi UU PDP (PRD PS-04): pemrosesan data & opt-in marketing terpisah. Status, tanda tangan formulir
 * (pemrosesan selalu; marketing sesuai pilihan pasien), cabut per jenis (cabut pemrosesan ikut mencabut marketing), riwayat,
 * lihat/cetak naskah. `ringkas` = tampilan satu baris (form pendaftaran).
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import SignaturePad from '@/components/SignaturePad.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { HUBUNGAN_PENANDATANGAN, JENIS_PERSETUJUAN_DATA, KANAL_MARKETING, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasien: { type: Object, required: true },
  ringkas: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const klinik = useKlinikStore()
const toast = useToastStore()

const data = ref(null)
const loading = ref(false)
const bolehKelola = computed(() => auth.can('pasien.kelola'))
const riwayatOpen = ref(false)
const teksKanal = (kanal) => (kanal ?? []).map((k) => KANAL_MARKETING[k] ?? k).join(', ')

async function muat() {
  loading.value = true
  try {
    data.value = (await api.get(`/pasiens/${props.pasien.id}/persetujuan-data`, { silent: true })).data
    emit('changed', { pemrosesan: data.value.pemrosesan, marketing: data.value.marketing })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}
watch(() => props.pasien.id, muat, { immediate: true })

// ---- Formulir persetujuan ----
const formOpen = ref(false)
const form = reactive({ setuju_pemrosesan: false, marketing: false, kanal: [], penandatangan_nama: '', hubungan: 'pasien', ttd: '' })
const naskah = ref(null)
const naskahLoading = ref(false)
const saving = ref(false)
const errors = ref({})

function bukaForm() {
  Object.assign(form, {
    setuju_pemrosesan: false,
    marketing: !!data.value?.marketing,
    kanal: data.value?.marketing?.kanal ?? ['whatsapp'],
    penandatangan_nama: props.pasien.nama,
    hubungan: 'pasien',
    ttd: '',
  })
  errors.value = {}
  formOpen.value = true
  muatNaskah()
}

async function muatNaskah() {
  naskahLoading.value = true
  try {
    naskah.value = (await api.get(`/pasiens/${props.pasien.id}/persetujuan-data/pratinjau`, { params: { kanal: form.kanal } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    naskahLoading.value = false
  }
}
watch(() => [...form.kanal], () => formOpen.value && form.marketing && muatNaskah())

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    await api.post(`/pasiens/${props.pasien.id}/persetujuan-data`, { ...form, kanal: form.marketing ? form.kanal : null })
    toast.success(form.marketing ? 'Persetujuan data & opt-in marketing tersimpan.' : 'Persetujuan pemrosesan data tersimpan.')
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
const dicabut = ref(null)
const alasan = ref('')
const mencabut = ref(false)

async function cabut() {
  mencabut.value = true
  try {
    await api.post(`/persetujuan-datas/${dicabut.value.uuid}/cabut`, { alasan: alasan.value })
    toast.success(dicabut.value.jenis === 'marketing' ? 'Opt-in marketing dicabut.' : 'Persetujuan pemrosesan data dicabut.')
    dicabut.value = null
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
</script>

<template>
  <div class="space-y-2 text-sm" data-persetujuan-data>
    <div class="flex flex-wrap items-center gap-2">
      <AppSpinner v-if="loading && !data" size="size-3" class="text-slate-400" />
      <template v-else-if="data">
        <span v-if="data.pemrosesan" class="rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          Persetujuan data berlaku<template v-if="!ringkas"> · {{ tanggal(data.pemrosesan.ditandatangani_at) }}</template>
        </span>
        <span v-else class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800">Belum ada persetujuan pemrosesan data</span>
        <span v-if="data.marketing" class="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-800">Opt-in promosi: {{ teksKanal(data.marketing.kanal) }}</span>
        <span v-else-if="!ringkas" class="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-600">Tidak opt-in promosi</span>
      </template>
      <div class="ml-auto flex flex-wrap gap-1">
        <button v-if="bolehKelola && data" type="button" :class="data.pemrosesan ? 'btn-ghost' : 'btn-primary'" class="btn btn-sm" @click="bukaForm">
          {{ data.pemrosesan ? 'Perbarui' : 'Minta persetujuan' }}
        </button>
        <template v-if="!ringkas">
          <button v-if="data?.pemrosesan" type="button" class="btn btn-ghost btn-sm" @click="lihat(data.pemrosesan.uuid)">Lihat</button>
          <button v-if="bolehKelola && data?.marketing" type="button" class="btn btn-ghost btn-sm text-rose-600" @click="dicabut = data.marketing">Cabut opt-in</button>
          <button v-if="bolehKelola && data?.pemrosesan" type="button" class="btn btn-ghost btn-sm text-rose-600" @click="dicabut = data.pemrosesan">Cabut persetujuan</button>
          <button v-if="data?.riwayat?.length" type="button" class="btn btn-ghost btn-sm" @click="riwayatOpen = !riwayatOpen">Riwayat ({{ data.riwayat.length }})</button>
        </template>
      </div>
    </div>
    <ul v-if="riwayatOpen && !ringkas" class="divide-y divide-line rounded-2xl border border-line bg-white/40 text-xs">
      <li v-for="r in data.riwayat" :key="r.uuid" class="flex flex-wrap items-center gap-2 px-3 py-2">
        <StatusBadge :status="r.status" />
        <span class="font-medium">{{ r.jenis === 'marketing' ? `Promosi (${teksKanal(r.kanal)})` : 'Pemrosesan data' }}</span>
        <span class="text-slate-500">{{ r.penandatangan_nama }} · {{ waktu(r.ditandatangani_at) }}</span>
        <span v-if="r.alasan_cabut" class="text-slate-500">· dicabut: {{ r.alasan_cabut }}</span>
        <button type="button" class="ml-auto underline" @click="lihat(r.uuid)">lihat</button>
      </li>
    </ul>

    <!-- Formulir persetujuan -->
    <AppModal v-model="formOpen" title="Persetujuan Data Pribadi (UU PDP)" size="max-w-3xl">
      <form id="form-persetujuan-data" class="space-y-4" @submit.prevent="simpan">
        <div v-if="naskahLoading && !naskah" class="flex items-center gap-2 text-slate-500"><AppSpinner />Menyiapkan naskah...</div>
        <template v-else-if="naskah">
          <section class="space-y-2">
            <h3 class="text-sm font-semibold text-slate-800">1. {{ JENIS_PERSETUJUAN_DATA.pemrosesan }}</h3>
            <article class="max-h-56 overflow-y-auto rounded-2xl border border-line bg-white px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-slate-800">{{ naskah.pemrosesan }}</article>
            <label class="flex items-start gap-2 text-sm">
              <input v-model="form.setuju_pemrosesan" type="checkbox" class="mt-0.5 accent-brand-600" required />
              <span>Pasien/wali telah membaca dan <b>menyetujui</b> pemrosesan data pribadi & kesehatan di atas *</span>
            </label>
            <p v-if="errors.setuju_pemrosesan" class="field-error">{{ errors.setuju_pemrosesan }}</p>
          </section>

          <!-- Opt-in marketing terpisah: tidak dicentang bawaan, tidak memengaruhi layanan -->
          <section class="space-y-2 rounded-2xl border border-line bg-white/40 p-4">
            <h3 class="text-sm font-semibold text-slate-800">2. {{ JENIS_PERSETUJUAN_DATA.marketing }} <span class="font-normal text-slate-500">— opsional</span></h3>
            <div class="flex flex-wrap gap-2">
              <label :class="{ 'choice-active': !form.marketing }" class="choice"><input v-model="form.marketing" type="radio" :value="false" class="sr-only" />Tidak bersedia</label>
              <label :class="{ 'choice-active': form.marketing }" class="choice"><input v-model="form.marketing" type="radio" :value="true" class="sr-only" @change="muatNaskah" />Bersedia menerima promosi</label>
            </div>
            <template v-if="form.marketing">
              <fieldset class="flex flex-wrap gap-x-4 gap-y-1">
                <legend class="label">Melalui *</legend>
                <label v-for="(label, val) in KANAL_MARKETING" :key="val" class="flex items-center gap-1.5 text-sm">
                  <input v-model="form.kanal" type="checkbox" :value="val" class="accent-brand-600" />{{ label }}
                </label>
              </fieldset>
              <p v-if="errors.kanal" class="field-error">{{ errors.kanal }}</p>
              <article class="max-h-40 overflow-y-auto rounded-2xl border border-line bg-white px-5 py-3 text-sm leading-relaxed whitespace-pre-line text-slate-800">{{ naskah.marketing }}</article>
            </template>
          </section>

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
          <p v-if="errors.ttd" class="field-error">{{ errors.ttd }}</p>
        </template>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="formOpen = false">Batal</button>
        <button
          type="submit"
          form="form-persetujuan-data"
          class="btn btn-primary"
          :disabled="saving || !form.ttd || !form.setuju_pemrosesan || (form.marketing && !form.kanal.length)"
        >
          <AppSpinner v-if="saving" />Simpan persetujuan
        </button>
      </template>
    </AppModal>

    <!-- Cabut -->
    <AppModal :model-value="!!dicabut" :title="dicabut?.jenis === 'marketing' ? 'Cabut Opt-in Promosi' : 'Cabut Persetujuan Pemrosesan Data'" @update:model-value="dicabut = null">
      <p class="mb-3 text-sm text-slate-600">
        <template v-if="dicabut?.jenis === 'marketing'">Pasien tidak lagi dikirimi informasi promosi. Layanan tidak terpengaruh.</template>
        <template v-else>
          Opt-in promosi ikut dicabut. Rekam medis yang wajib disimpan klinik tetap tersimpan; bila klinik mewajibkan persetujuan, kunjungan baru
          tidak dapat didaftarkan sampai pasien menyetujui lagi.
        </template>
      </p>
      <label class="label" for="pd-alasan">Alasan *</label>
      <textarea id="pd-alasan" v-model="alasan" rows="2" class="input" maxlength="500" />
      <template #footer>
        <button class="btn btn-secondary" @click="dicabut = null">Batal</button>
        <button class="btn btn-danger" :disabled="!alasan.trim() || mencabut" @click="cabut"><AppSpinner v-if="mencabut" />Cabut</button>
      </template>
    </AppModal>

    <!-- Lihat / cetak -->
    <AppModal :model-value="!!dokumen" title="Persetujuan Data Pribadi" size="max-w-3xl" @update:model-value="dokumen = null">
      <template v-if="dokumen">
        <p v-if="!dokumen.checksum_valid" class="alert alert-danger mb-3">Sidik dokumen tidak cocok: dokumen berubah di luar aplikasi.</p>
        <article id="cetak-persetujuan-data" class="space-y-3 rounded-2xl border border-line bg-white px-6 py-5 text-sm leading-relaxed text-slate-800">
          <header class="border-b border-slate-300 pb-2 text-center">
            <p class="text-base font-bold">{{ klinik.nama }}</p>
            <p class="text-xs text-slate-600">{{ dokumen.cabang?.nama }}</p>
          </header>
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold uppercase tracking-wide">Persetujuan {{ JENIS_PERSETUJUAN_DATA[dokumen.jenis] }}</h3>
            <StatusBadge :status="dokumen.status" />
          </div>
          <p class="text-xs text-slate-500">{{ dokumen.pasien?.nama }} · RM {{ dokumen.pasien?.no_rm }}<template v-if="dokumen.kanal?.length"> · Melalui: <b>{{ teksKanal(dokumen.kanal) }}</b></template></p>
          <p class="whitespace-pre-line">{{ dokumen.isi }}</p>
          <figure class="max-w-xs">
            <figcaption class="text-xs text-slate-500">{{ HUBUNGAN_PENANDATANGAN[dokumen.hubungan] }}</figcaption>
            <img :src="dokumen.ttd" alt="Tanda tangan" class="h-24 w-full object-contain" draggable="false" @contextmenu.prevent />
            <p class="border-t border-slate-400 pt-1 text-center font-medium">{{ dokumen.penandatangan_nama }}</p>
          </figure>
          <p class="text-[11px] text-slate-500">
            Ditandatangani {{ waktu(dokumen.ditandatangani_at) }} · dicatat oleh {{ dokumen.pembuat?.name ?? '-' }}
            <template v-if="dokumen.berakhir_at"> · berakhir {{ waktu(dokumen.berakhir_at) }}</template>
            <template v-if="dokumen.alasan_cabut"> ({{ dokumen.alasan_cabut }})</template> · ID {{ dokumen.uuid }}
          </p>
        </article>
      </template>
      <template #footer>
        <button class="btn btn-secondary" @click="dokumen = null">Tutup</button>
        <button class="btn btn-primary" @click="printElement('#cetak-persetujuan-data', 'Persetujuan data pribadi')">Cetak</button>
      </template>
    </AppModal>
  </div>
</template>
