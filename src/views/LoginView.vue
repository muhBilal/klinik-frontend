<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage, validationErrors } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const errors = ref({})
const message = ref('')
const loading = ref(false)

const demoAkun = [
  ['admin', 'Admin'],
  ['pendaftaran', 'Pendaftaran'],
  ['perawat', 'Perawat'],
  ['dokter', 'Dokter'],
  ['apoteker', 'Apoteker'],
  ['kasir', 'Kasir'],
]

async function submit() {
  loading.value = true
  errors.value = {}
  message.value = ''
  try {
    await auth.login(form.email, form.password)
    router.replace(route.query.redirect || '/')
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length) message.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function isiDemo(role) {
  form.email = `${role}@eklinik.test`
  form.password = 'password'
}
</script>

<template>
  <div class="flex min-h-screen">
    <div class="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-800 p-12 text-white lg:flex">
      <div class="flex items-center gap-3">
        <div class="grid size-10 place-items-center rounded-lg bg-white/10">
          <svg class="size-6" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" /></svg>
        </div>
        <span class="text-lg font-semibold">E-Klinik</span>
      </div>
      <div>
        <h1 class="text-3xl leading-tight font-semibold">Pelayanan klinik yang tertata,<br />dari pendaftaran hingga kasir.</h1>
        <p class="mt-4 max-w-md text-brand-100/80">Antrian poli, rekam medis SOAP dengan ICD-10, resep elektronik, stok farmasi, dan pembayaran dalam satu sistem.</p>
      </div>
      <p class="text-sm text-brand-100/60">&copy; {{ new Date().getFullYear() }} E-Klinik</p>
      <div class="absolute -right-24 -bottom-24 size-96 rounded-full bg-brand-600/30" />
    </div>

    <div class="flex flex-1 items-center justify-center p-6">
      <div class="w-full max-w-sm">
        <h2 class="text-2xl font-semibold text-slate-800">Masuk</h2>
        <p class="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan administrator klinik.</p>

        <form class="mt-8 space-y-4" @submit.prevent="submit">
          <div v-if="message" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ message }}</div>
          <div>
            <label class="label" for="email">Email</label>
            <input id="email" v-model="form.email" type="email" class="input" :class="{ 'input-error': errors.email }" autocomplete="username" required autofocus />
            <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
          </div>
          <div>
            <label class="label" for="password">Password</label>
            <input id="password" v-model="form.password" type="password" class="input" :class="{ 'input-error': errors.password }" autocomplete="current-password" required />
            <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
          </div>
          <button type="submit" class="btn btn-primary w-full py-2.5" :disabled="loading">{{ loading ? 'Memproses...' : 'Masuk' }}</button>
        </form>

        <div class="mt-8 rounded-lg border border-dashed border-slate-300 p-4">
          <p class="text-xs font-medium text-slate-500">Akun demo (password: <code>password</code>)</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button v-for="[role, label] in demoAkun" :key="role" type="button" class="btn btn-secondary btn-sm" @click="isiDemo(role)">{{ label }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
