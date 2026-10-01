<script setup>
/**
 * Ubah data klinis pasien (PRD PS-03): alergi terstruktur (alergi obat bisa ditautkan ke master obat untuk peringatan resep),
 * tipe kulit Fitzpatrick, status hamil/menyusui (perempuan), riwayat obat & penyakit. PUT /pasiens/{id}/klinis, alergi replace-all.
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { FITZPATRICK, KATEGORI_ALERGI, KEPARAHAN_ALERGI, STATUS_KEHAMILAN, tanggal } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  pasien: { type: Object, required: true },
  klinis: { type: Object, default: null },
  alergis: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'saved'])
const toast = useToastStore()

const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const perempuan = computed(() => props.pasien.jenis_kelamin === 'P')
const form = reactive({})
const errors = ref({})
const saving = ref(false)

watch(open, (v) => {
  if (!v) return
  errors.value = {}
  Object.assign(form, {
    fitzpatrick: props.klinis?.fitzpatrick ?? '',
    status_kehamilan: props.klinis?.status_kehamilan ?? '',
    konfirmasi_kehamilan: false,
    riwayat_obat: props.klinis?.riwayat_obat ?? '',
    riwayat_penyakit: props.klinis?.riwayat_penyakit ?? '',
    alergis: props.alergis.map((a) => ({ ...a, obat: a.obat ?? null })),
  })
})

const statusTetap = computed(() => !!form.status_kehamilan && form.status_kehamilan === (props.klinis?.status_kehamilan ?? ''))

function tambahAlergi() {
  form.alergis.push({ id: null, kategori: 'obat', zat: '', obat_id: null, obat: null, reaksi: '', keparahan: '' })
}

function tautkanObat(a, obat) {
  a.obat_id = obat.id
  a.obat = obat
  if (!a.zat.trim()) a.zat = obat.nama
}

const errAlergi = (i, field) => errors.value[`alergis.${i}.${field}`]

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.put(`/pasiens/${props.pasien.id}/klinis`, {
      fitzpatrick: form.fitzpatrick || null,
      status_kehamilan: perempuan.value ? form.status_kehamilan || null : null,
      konfirmasi_kehamilan: perempuan.value && form.konfirmasi_kehamilan,
      riwayat_obat: form.riwayat_obat || null,
      riwayat_penyakit: form.riwayat_penyakit || null,
      alergis: form.alergis.map((a) => ({
        id: a.id ?? null,
        kategori: a.kategori,
        zat: a.zat,
        obat_id: a.kategori === 'obat' ? (a.obat_id ?? null) : null,
        reaksi: a.reaksi || null,
        keparahan: a.keparahan || null,
      })),
    })
    toast.success('Data klinis pasien tersimpan.')
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
  <AppModal v-model="open" :title="`Data Klinis · ${pasien.nama}`" size="max-w-3xl">
    <form id="form-data-klinis" class="space-y-6" @submit.prevent="simpan">
      <!-- Alergi -->
      <section class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">Alergi</h3>
            <p class="text-xs text-slate-500">Tautkan alergi obat ke master obat agar resep yang memuatnya diberi peringatan.</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm shrink-0 whitespace-nowrap" @click="tambahAlergi">+ Alergi</button>
        </div>
        <p v-if="!form.alergis?.length" class="rounded-xl bg-white/40 px-3 py-2 text-sm text-slate-400">Belum ada alergi tercatat.</p>
        <!-- Grid per alergi: turun baris di layar sempit, bukan tabel yang terjepit -->
        <div v-else class="divide-y divide-line rounded-xl border border-line bg-white/30">
          <div v-for="(a, i) in form.alergis" :key="a.id ?? `baru-${i}`" class="space-y-2 px-4 py-3">
            <!-- HP: kategori | keparahan | ×, lalu zat selebar baris. Layar lebar: kategori | zat | keparahan | × -->
            <div class="grid grid-cols-[1fr_1fr_auto] items-start gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_8rem_auto]">
              <select v-model="a.kategori" class="input py-1 sm:col-start-1 sm:row-start-1" :aria-label="`Kategori alergi ${i + 1}`" :class="{ 'input-error': errAlergi(i, 'kategori') }">
                <option v-for="(label, val) in KATEGORI_ALERGI" :key="val" :value="val">{{ label }}</option>
              </select>
              <select v-model="a.keparahan" class="input py-1 sm:col-start-3 sm:row-start-1" :aria-label="`Keparahan alergi ${i + 1}`">
                <option value="">Keparahan</option>
                <option v-for="(label, val) in KEPARAHAN_ALERGI" :key="val" :value="val">{{ label }}</option>
              </select>
              <button type="button" class="pt-1 text-slate-400 hover:text-rose-600 sm:col-start-4 sm:row-start-1" :aria-label="`Hapus alergi ${a.zat || i + 1}`" @click="form.alergis.splice(i, 1)">&times;</button>
              <div class="col-span-3 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <input
                  :id="`alergi-zat-${i}`"
                  v-model="a.zat"
                  class="input py-1"
                  :class="{ 'input-error': errAlergi(i, 'zat') }"
                  maxlength="150"
                  :placeholder="a.kategori === 'obat' ? 'Nama obat / zat aktif' : 'Penyebab, mis. udang, lateks'"
                  required
                />
                <p v-if="errAlergi(i, 'zat')" class="field-error">{{ errAlergi(i, 'zat') }}</p>
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              <input v-model="a.reaksi" class="input py-1" maxlength="255" placeholder="Reaksi, mis. ruam, sesak napas" :aria-label="`Reaksi alergi ${i + 1}`" />
              <div v-if="a.kategori === 'obat'" class="text-xs">
                <p v-if="a.obat_id" class="flex flex-wrap items-center gap-2 py-1.5 text-slate-600">
                  Tertaut obat: <b>{{ a.obat?.nama ?? `#${a.obat_id}` }}</b>
                  <button type="button" class="underline" @click="(a.obat_id = null), (a.obat = null)">lepas</button>
                </p>
                <AsyncSelect v-else endpoint="/obats" placeholder="Tautkan ke master obat (opsional)..." @select="(o) => tautkanObat(a, o)">
                  <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.kode }}</span></template>
                </AsyncSelect>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Profil klinis -->
      <section class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="dk-fitzpatrick">Tipe kulit Fitzpatrick</label>
          <select id="dk-fitzpatrick" v-model="form.fitzpatrick" class="input" :class="{ 'input-error': errors.fitzpatrick }">
            <option value="">— Belum dinilai —</option>
            <option v-for="(ket, tipe) in FITZPATRICK" :key="tipe" :value="tipe">Tipe {{ tipe }} — {{ ket }}</option>
          </select>
        </div>
        <div v-if="perempuan">
          <label class="label" for="dk-hamil">Hamil / menyusui</label>
          <select id="dk-hamil" v-model="form.status_kehamilan" class="input" :class="{ 'input-error': errors.status_kehamilan }">
            <option value="">— Belum ditanyakan —</option>
            <option v-for="(label, val) in STATUS_KEHAMILAN" :key="val" :value="val">{{ label }}</option>
          </select>
          <p v-if="errors.status_kehamilan" class="field-error">{{ errors.status_kehamilan }}</p>
          <label v-else-if="statusTetap" class="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <input v-model="form.konfirmasi_kehamilan" type="checkbox" class="accent-brand-600" />
            Sudah dikonfirmasi ulang hari ini (dicatat {{ tanggal(klinis?.status_kehamilan_at) }})
          </label>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="dk-obat">Riwayat obat</label>
          <textarea
            id="dk-obat"
            v-model="form.riwayat_obat"
            rows="2"
            class="input"
            maxlength="2000"
            placeholder="Obat rutin / yang sedang & pernah dikonsumsi, mis. isotretinoin (berhenti Mei 2026), aspirin, pil KB"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="dk-penyakit">Riwayat penyakit / kondisi medis</label>
          <textarea id="dk-penyakit" v-model="form.riwayat_penyakit" rows="2" class="input" maxlength="2000" placeholder="Mis. keloid, diabetes, autoimun, epilepsi, herpes berulang" />
        </div>
      </section>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-data-klinis" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan</button>
    </template>
  </AppModal>
</template>
