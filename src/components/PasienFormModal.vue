<script setup>
import { reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { hariIni } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({ pasien: { type: Object, default: null } })
const emit = defineEmits(['saved'])

const toast = useToastStore()
const kosong = {
  nama: '', nik: '', no_bpjs: '', jenis_kelamin: 'L', tempat_lahir: '', tanggal_lahir: '',
  golongan_darah: '', no_hp: '', pekerjaan: '', alamat: '',
}
const form = reactive({ ...kosong })
const errors = ref({})
const saving = ref(false)

watch(open, (value) => {
  if (!value) return
  errors.value = {}
  Object.assign(form, kosong, props.pasien ? Object.fromEntries(Object.keys(kosong).map((k) => [k, props.pasien[k] ?? ''])) : {})
})

async function submit() {
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
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-pasien" class="btn btn-primary" :disabled="saving">
        <AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}
      </button>
    </template>
  </AppModal>
</template>
