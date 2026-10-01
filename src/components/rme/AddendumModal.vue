<script setup>
/**
 * Addendum rekam medis (PRD RM-07): koreksi setelah RME ditandatangani. Isi lama tidak diubah; addendum ditambahkan
 * dengan alasan, penulis & waktu, dan tidak bisa diubah/dihapus.
 */
import { reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { BAGIAN_ADDENDUM } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({ kunjunganId: { type: Number, required: true } })
const emit = defineEmits(['saved'])
const toast = useToastStore()

const form = reactive({ bagian: 'asesmen', isi: '', alasan: '' })
const errors = ref({})
const saving = ref(false)

watch(open, (buka) => {
  if (buka) {
    Object.assign(form, { bagian: 'asesmen', isi: '', alasan: '' })
    errors.value = {}
  }
})

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    const { data } = await api.post(`/kunjungans/${props.kunjunganId}/addendum`, form)
    toast.success('Addendum ditambahkan ke rekam medis.')
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
  <AppModal v-model="open" title="Tambah Addendum">
    <form id="form-addendum" class="space-y-4" @submit.prevent="simpan">
      <p class="text-sm text-slate-500">Rekam medis yang sudah ditandatangani tidak diubah. Koreksi dicatat sebagai addendum atas nama Anda dan tidak dapat dihapus.</p>
      <div>
        <label class="label" for="add-bagian">Bagian yang dikoreksi *</label>
        <select id="add-bagian" v-model="form.bagian" class="input">
          <option v-for="(label, val) in BAGIAN_ADDENDUM" :key="val" :value="val">{{ label }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="add-isi">Isi koreksi / tambahan *</label>
        <textarea id="add-isi" v-model="form.isi" rows="4" class="input" :class="{ 'input-error': errors.isi }" maxlength="5000" required />
        <p v-if="errors.isi" class="field-error">{{ errors.isi }}</p>
      </div>
      <div>
        <label class="label" for="add-alasan">Alasan koreksi *</label>
        <input id="add-alasan" v-model="form.alasan" class="input" :class="{ 'input-error': errors.alasan }" maxlength="500" required placeholder="Mis. salah ketik derajat keparahan" />
        <p v-if="errors.alasan" class="field-error">{{ errors.alasan }}</p>
      </div>
      <p v-if="errors.sip || errors.addendum" class="alert alert-danger">{{ errors.sip || errors.addendum }}</p>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-addendum" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Tambahkan</button>
    </template>
  </AppModal>
</template>
