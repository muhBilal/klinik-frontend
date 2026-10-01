<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AppLogo from '@/components/AppLogo.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import { errorMessage, validationErrors } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'

const auth = useAuthStore()
const klinik = useKlinikStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const errors = ref({})
const message = ref(route.query.sesi === 'habis' ? 'Sesi Anda telah berakhir. Silakan masuk kembali.' : '')
const loading = ref(false)
// Langkah kedua login untuk akun ber-2FA
const tantangan = ref('')
const kode = ref('')

// Tile modul di panel hero (ikon heroicons outline)
const fitur = [
  { label: 'Antrian poli', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
  { label: 'Rekam medis', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
  { label: 'Farmasi', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5' },
  { label: 'Kasir', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
]

const demoAkun = [
  ['admin', 'Admin'],
  ['pendaftaran', 'Pendaftaran'],
  ['perawat', 'Perawat'],
  ['dokter', 'Dokter Estetika'],
  ['dokter.kulit', 'Dokter Kulit'],
  ['dokter.gigi', 'Dokter Gigi'],
  ['apoteker', 'Apoteker'],
  ['kasir', 'Kasir'],
  ['terapis', 'Terapis'],
  ['manajer', 'Manajer'],
]

async function submit() {
  loading.value = true
  errors.value = {}
  message.value = ''
  try {
    if (tantangan.value) {
      await auth.login2fa(tantangan.value, kode.value)
    } else {
      const hasil = await auth.login(form.email, form.password)
      if (hasil.tantangan) {
        tantangan.value = hasil.tantangan
        return
      }
    }
    router.replace(route.query.redirect || '/')
  } catch (e) {
    errors.value = validationErrors(e)
    // Tantangan kedaluwarsa / terlalu banyak salah -> ulangi dari email & password
    if (errors.value.tantangan) {
      batal2fa()
      message.value = errors.value.tantangan
    } else if (!Object.keys(errors.value).length) {
      message.value = errorMessage(e)
    }
  } finally {
    loading.value = false
  }
}

function batal2fa() {
  tantangan.value = ''
  kode.value = ''
}

onMounted(() => klinik.muat())

function isiDemo(role) {
  form.email = `${role}@eklinik.test`
  form.password = 'password'
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4 sm:p-8">
    <div class="glass grid w-full max-w-5xl motion-safe:animate-pop overflow-hidden rounded-[2rem] lg:grid-cols-[1.1fr_1fr]">
      <!-- Panel hero -->
      <div class="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-sky-500 via-sky-600 to-blue-700 p-10 text-white lg:flex">
        <div class="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border border-white/20 bg-white/10" />
        <div class="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full border border-white/10 bg-white/5" />
        <div class="pointer-events-none absolute right-12 bottom-28 size-24 rotate-12 rounded-3xl border border-white/25 bg-white/10 shadow-xl backdrop-blur-md" />

        <div class="relative flex items-center gap-3">
          <!-- Logo biru di atas latar biru: diberi alas putih agar kontras -->
          <div class="grid size-12 place-items-center rounded-2xl bg-white shadow-lg shadow-blue-900/30">
            <AppLogo class="size-8" />
          </div>
          <div>
            <p class="text-lg leading-tight font-bold">{{ klinik.nama }}</p>
            <p class="text-xs text-white/70">Sistem Informasi Klinik</p>
          </div>
        </div>

        <div class="relative">
          <h1 class="text-3xl leading-tight font-bold">Pelayanan klinik yang tertata,<br />dari pendaftaran hingga kasir.</h1>
          <p class="mt-4 max-w-md text-white/80">Antrian poli, rekam medis SOAP dengan ICD-10, resep elektronik, stok farmasi, dan pembayaran dalam satu sistem.</p>
          <div class="mt-8 grid max-w-sm grid-cols-2 gap-3">
            <div
              v-for="(f, i) in fitur"
              :key="f.label"
              :class="i === 0 ? 'bg-white text-slate-900 shadow-xl shadow-black/40' : 'border border-white/15 bg-white/10 text-white backdrop-blur'"
              class="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium"
            >
              <AppIcon :path="f.icon" size="size-4.5" />{{ f.label }}
            </div>
          </div>
        </div>

        <p class="relative text-sm text-white/60">&copy; {{ new Date().getFullYear() }} {{ klinik.nama }}</p>
      </div>

      <!-- Form -->
      <div class="p-8 sm:p-12">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <AppLogo class="size-10" />
          <p class="text-lg font-bold text-slate-800">{{ klinik.nama }}</p>
        </div>

        <h2 class="text-2xl font-bold tracking-tight text-slate-800">Selamat datang</h2>
        <p class="mt-1 text-sm text-slate-500">Masuk dengan akun yang diberikan administrator klinik.</p>

        <form class="mt-8 space-y-4" @submit.prevent="submit">
          <div v-if="message" class="alert alert-danger py-2">{{ message }}</div>
          <template v-if="!tantangan">
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
          </template>
          <div v-else>
            <p class="mb-3 text-sm text-slate-600">Masukkan kode 6 digit dari aplikasi authenticator, atau salah satu kode pemulihan.</p>
            <label class="label" for="kode">Kode verifikasi</label>
            <input
              id="kode"
              v-model="kode"
              class="input text-center font-mono text-lg tracking-[0.3em]"
              :class="{ 'input-error': errors.kode }"
              autocomplete="one-time-code"
              maxlength="20"
              required
              autofocus
            />
            <p v-if="errors.kode" class="field-error">{{ errors.kode }}</p>
            <button type="button" class="mt-2 text-xs font-medium text-slate-500 hover:underline" @click="batal2fa">Kembali ke email & password</button>
          </div>
          <button type="submit" class="btn btn-primary w-full py-2.5" :disabled="loading">
            <AppSpinner v-if="loading" />{{ loading ? 'Memproses...' : tantangan ? 'Verifikasi' : 'Masuk' }}
          </button>
        </form>

        <div class="mt-8 rounded-2xl border border-white/70 bg-white/40 p-4">
          <p class="text-xs font-medium text-slate-500">Akun demo (password: <code class="rounded bg-slate-900/5 px-1">password</code>)</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button v-for="[role, label] in demoAkun" :key="role" type="button" class="btn btn-secondary btn-sm" @click="isiDemo(role)">{{ label }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
