<script setup>
/**
 * Form identitas pasien. Deteksi pasien ganda (PRD PS-02): saat NIK, No. HP, atau nama + tanggal lahir diisi, kandidat pasien
 * yang mirip ditampilkan; pada pasien baru, front office bisa langsung memakai data yang sudah ada.
 */
import { reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { debounce, hariIni, jenisKelamin, tanggal } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({ pasien: { type: Object, default: null } })
const emit = defineEmits(['saved'])

const toast = useToastStore()
const kosong = {
  nama: '', nik: '', no_bpjs: '', jenis_kelamin: 'L', tempat_lahir: '', tanggal_lahir: '',
  golongan_darah: '', no_hp: '', pekerjaan: '', alamat: '', alergi: '',
}
const form = reactive({ ...kosong })
const errors = ref({})
const saving = ref(false)

// ---- Deteksi pasien ganda (PS-02) ----
const kandidat = ref([])
const cekDuplikat = debounce(async () => {
  if (!open.value) return
  const params = { nama: form.nama, tanggal_lahir: form.tanggal_lahir, no_hp: form.no_hp, nik: form.nik, kecuali_id: props.pasien?.id }
  if (!(form.nik?.length === 16 || (form.no_hp ?? '').replace(/\D/g, '').length >= 9 || (form.nama && form.tanggal_lahir))) {
    kandidat.value = []
    return
  }
  try {
    kandidat.value = (await api.get('/pasiens-duplikat', { params, silent: true })).data
  } catch {
    kandidat.value = []
  }
}, 500)
watch(() => [form.nik, form.no_hp, form.nama, form.tanggal_lahir], () => cekDuplikat())

function pakai(p) {
  toast.info(`Memakai data pasien yang sudah terdaftar: ${p.nama} (RM ${p.no_rm}).`)
  emit('saved', p)
  open.value = false
}

watch(open, (value) => {
  if (!value) return
  kandidat.value = []
  errors.value = {}
  Object.assign(form, kosong, props.pasien ? Object.fromEntries(Object.keys(kosong).map((k) => [k, props.pasien[k] ?? ''])) : {})
})

async function submit() {
  if (!props.pasien && kandidat.value.length && !confirm(`Ada ${kandidat.value.length} pasien yang mirip. Tetap simpan sebagai pasien baru?`)) return
  saving.value = true
  errors.value = {}
  try {
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    const { data } = props.pasien ? await api.put(`/pasiens/${props.pasien.id}`, payload) : await api.post('/pasiens', payload)
    toast.success(props.pasien ? 'Data pasien diperbarui.' : `Pasien terdaftar dengan No. RM ${data.no_rm}.`)
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
  <AppModal v-model="open" :title="pasien ? `Ubah Data Pasien · ${pasien.no_rm}` : 'Pasien Baru'" size="max-w-2xl">
    <form id="form-pasien" class="grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
      <div class="sm:col-span-2">
        <label class="label">Nama lengkap *</label>
        <input v-model="form.nama" class="input" :class="{ 'input-error': errors.nama }" required />
        <p v-if="errors.nama" class="field-error">{{ errors.nama }}</p>
      </div>
      <div>
        <label class="label">NIK</label>
        <input v-model="form.nik" class="input" :class="{ 'input-error': errors.nik }" inputmode="numeric" maxlength="16" />
        <p v-if="errors.nik" class="field-error">{{ errors.nik }}</p>
      </div>
      <div>
        <label class="label">No. BPJS</label>
        <input v-model="form.no_bpjs" class="input" :class="{ 'input-error': errors.no_bpjs }" inputmode="numeric" maxlength="13" />
        <p v-if="errors.no_bpjs" class="field-error">{{ errors.no_bpjs }}</p>
      </div>
      <div>
        <label class="label">Jenis kelamin *</label>
        <div class="flex gap-4 pt-1.5 text-sm">
          <label class="flex items-center gap-2"><input v-model="form.jenis_kelamin" type="radio" value="L" class="accent-brand-600" /> Laki-laki</label>
          <label class="flex items-center gap-2"><input v-model="form.jenis_kelamin" type="radio" value="P" class="accent-brand-600" /> Perempuan</label>
        </div>
      </div>
      <div>
        <label class="label">Golongan darah</label>
        <select v-model="form.golongan_darah" class="input">
          <option value="">Tidak diketahui</option>
          <option v-for="g in ['A', 'B', 'AB', 'O']" :key="g">{{ g }}</option>
        </select>
      </div>
      <div>
        <label class="label">Tempat lahir</label>
        <input v-model="form.tempat_lahir" class="input" />
      </div>
      <div>
        <label class="label">Tanggal lahir *</label>
        <input v-model="form.tanggal_lahir" type="date" :max="hariIni()" class="input" :class="{ 'input-error': errors.tanggal_lahir }" required />
        <p v-if="errors.tanggal_lahir" class="field-error">{{ errors.tanggal_lahir }}</p>
      </div>
      <div>
        <label class="label">No. HP</label>
        <input v-model="form.no_hp" type="tel" class="input" />
      </div>
      <div>
        <label class="label">Pekerjaan</label>
        <input v-model="form.pekerjaan" class="input" />
      </div>
      <div class="sm:col-span-2">
        <label class="label">Alamat</label>
        <textarea v-model="form.alamat" rows="2" class="input" />
      </div>
      <div v-if="kandidat.length" class="alert alert-warning space-y-2 sm:col-span-2" role="status">
        <p class="font-medium">Kemungkinan pasien sudah terdaftar:</p>
        <div v-for="k in kandidat" :key="k.id" class="flex flex-wrap items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
          <div class="min-w-0 flex-1">
            <p class="font-medium">{{ k.nama }} <span class="text-xs text-slate-500">· RM {{ k.no_rm }}</span></p>
            <p class="text-xs text-slate-600">
              {{ jenisKelamin(k.jenis_kelamin) }}, lahir {{ tanggal(k.tanggal_lahir) }}<template v-if="k.no_hp"> · {{ k.no_hp }}</template>
              · <b>{{ k.alasan.join(', ') }}</b>
            </p>
          </div>
          <button v-if="!pasien" type="button" class="btn btn-secondary btn-sm" @click="pakai(k)">Gunakan pasien ini</button>
          <RouterLink v-else :to="`/pasien/${k.id}`" class="btn btn-ghost btn-sm" @click="open = false">Lihat</RouterLink>
        </div>
      </div>
      <div class="sm:col-span-2">
        <label class="label">Riwayat alergi</label>
        <input v-model="form.alergi" class="input" placeholder="Contoh: Amoxicillin, seafood" />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-pasien" class="btn btn-primary" :disabled="saving">
        <AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}
      </button>
    </template>
  </AppModal>
</template>
