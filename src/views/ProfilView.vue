<script setup>
import { computed, reactive, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { errorMessage, validationErrors } from '@/lib/api'
import { toSquareDataUrl } from '@/lib/image'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()

const saving = ref(false)
const errors = ref({})

const fileEl = ref(null)

const form = reactive({
  name: auth.user?.name ?? '',
  email: auth.user?.email ?? '',
  avatar: auth.user?.avatar ?? '',
  sip: auth.user?.sip ?? '',
  current_password: '',
  password: '',
  password_confirmation: '',
})

const isDokter = computed(() => auth.user?.role === 'dokter')

/** Pratinjau memakai foto yang sedang dipilih di form, bukan yang tersimpan. */
const preview = computed(() => ({ name: form.name, avatar: form.avatar }))

const ICON_CAMERA = 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z'
const ICON_TRASH = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'

/** Gambar diperkecil di browser (256px) lalu dikirim sebagai data URI -> server tanpa GD. */
async function pickFile(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // agar memilih berkas sama dua kali tetap memicu change
  if (!file) return

  if (!file.type.startsWith('image/')) return toast.error('Berkas harus berupa gambar.')
  if (file.size > 8 * 1024 * 1024) return toast.error('Ukuran gambar maksimal 8 MB.')

  try {
    form.avatar = await toSquareDataUrl(file)
    errors.value = { ...errors.value, avatar: undefined }
  } catch (error) {
    toast.error(error.message)
  }
}

async function submit() {
  if (form.password && form.password !== form.password_confirmation) {
    errors.value = { password_confirmation: 'Konfirmasi password tidak sama.' }
    return
  }

  saving.value = true
  errors.value = {}
  try {
    // Kirim field password hanya bila diisi, agar tidak memicu aturan `required_with`
    const { current_password, password, password_confirmation, ...profil } = form
    profil.avatar = profil.avatar || null // string kosong -> null agar foto benar-benar dihapus
    await auth.updateProfile(password ? { ...profil, current_password, password, password_confirmation } : profil)
    form.current_password = form.password = form.password_confirmation = ''
    toast.success('Profil berhasil diperbarui.')
  } catch (error) {
    errors.value = validationErrors(error)
    toast.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Profil Saya" subtitle="Ubah data akun dan password Anda." />

    <form class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]" @submit.prevent="submit">
      <!-- ===== Ringkasan akun ===== -->
      <section class="card h-fit">
        <div class="card-body flex flex-col items-center text-center">
          <div class="relative">
            <UserAvatar :user="preview" size="size-24" text="text-2xl" />
            <button
              type="button"
              class="btn-icon absolute -right-1 -bottom-1 size-9 border-white"
              title="Ganti foto profil"
              aria-label="Ganti foto profil"
              @click="fileEl.click()"
            >
              <AppIcon :path="ICON_CAMERA" size="size-4" />
            </button>
          </div>
          <input ref="fileEl" type="file" accept="image/*" class="hidden" @change="pickFile" />

          <div class="mt-3 flex items-center gap-2">
            <button type="button" class="btn btn-secondary btn-sm" @click="fileEl.click()">Pilih foto</button>
            <button v-if="form.avatar" type="button" class="btn btn-ghost btn-sm text-red-600 hover:bg-red-50" @click="form.avatar = ''">
              <AppIcon :path="ICON_TRASH" size="size-3.5" /> Hapus
            </button>
          </div>
          <p v-if="errors.avatar" class="field-error">{{ errors.avatar }}</p>
          <p class="mt-1 text-xs text-slate-400">JPG/PNG, otomatis dipotong persegi.</p>

          <p class="mt-3 text-lg font-semibold text-slate-900">{{ auth.user?.name }}</p>
          <p class="text-sm text-slate-500">{{ auth.user?.email }}</p>
          <span class="chip mt-3">{{ auth.user?.role_label }}</span>
          <p v-if="auth.user?.poli" class="mt-2 text-xs text-slate-500">{{ auth.user.poli.nama }}</p>
          <p class="mt-4 text-xs text-slate-400">Role dan poli hanya dapat diubah oleh administrator.</p>
        </div>
      </section>

      <!-- ===== Form ===== -->
      <div class="space-y-5">
        <section class="card">
          <div class="card-header"><h2 class="card-title">Data akun</h2></div>
          <div class="card-body grid gap-4 sm:grid-cols-2">
            <div :class="isDokter ? '' : 'sm:col-span-2'">
              <label class="label" for="p-name">Nama lengkap</label>
              <input id="p-name" v-model="form.name" class="input" :class="{ 'input-error': errors.name }" required autocomplete="name" />
              <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
            </div>
            <div v-if="isDokter">
              <label class="label" for="p-sip">No. SIP</label>
              <input id="p-sip" v-model="form.sip" class="input" :class="{ 'input-error': errors.sip }" />
              <p v-if="errors.sip" class="field-error">{{ errors.sip }}</p>
            </div>
            <div class="sm:col-span-2">
              <label class="label" for="p-email">Email</label>
              <input id="p-email" v-model="form.email" type="email" class="input" :class="{ 'input-error': errors.email }" required autocomplete="email" />
              <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Ubah password</h2>
            <span class="text-xs text-slate-400">Kosongkan bila tidak ingin mengubah</span>
          </div>
          <div class="card-body grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="label" for="p-current">Password saat ini</label>
              <input id="p-current" v-model="form.current_password" type="password" class="input" :class="{ 'input-error': errors.current_password }" autocomplete="current-password" />
              <p v-if="errors.current_password" class="field-error">{{ errors.current_password }}</p>
            </div>
            <div>
              <label class="label" for="p-new">Password baru</label>
              <input id="p-new" v-model="form.password" type="password" class="input" :class="{ 'input-error': errors.password }" autocomplete="new-password" />
              <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
              <p v-else class="mt-1 text-xs text-slate-500">Minimal 8 karakter.</p>
            </div>
            <div>
              <label class="label" for="p-confirm">Ulangi password baru</label>
              <input id="p-confirm" v-model="form.password_confirmation" type="password" class="input" :class="{ 'input-error': errors.password_confirmation }" autocomplete="new-password" />
              <p v-if="errors.password_confirmation" class="field-error">{{ errors.password_confirmation }}</p>
            </div>
          </div>
        </section>

        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <AppSpinner v-if="saving" size="size-4" /> Simpan perubahan
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
