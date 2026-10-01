<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AppLogo from '@/components/AppLogo.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import IlustrasiKlinik from '@/components/login/IlustrasiKlinik.vue'
import PolaLatarKlinik from '@/components/login/PolaLatarKlinik.vue'
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
const lihatPassword = ref(false)
// Langkah kedua login untuk akun ber-2FA
const tantangan = ref('')
const kode = ref('')

// Ikon heroicons outline
const ikon = {
  email:
    'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  kunci:
    'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  mata: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  mataTutup:
    'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88',
  kembali: 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
}
// Tanda kutip pembuka (penutup = diputar 180°)
const KUTIP = 'M3 12.5C3 8.4 5.5 5.4 9.3 4.5l.8 2C8 7.3 6.9 8.9 6.8 10.8H10V19H3v-6.5zm11 0c0-4.1 2.5-7.1 6.3-8l.8 2c-2.1.8-3.2 2.4-3.3 4.3H21V19h-7v-6.5z'

/** Kolom pil putih tanpa garis (gaya referensi desain); garis merah tetap muncul saat ada error. */
const kolom = (error) => ['input rounded-full py-3', error ? 'input-error' : 'border-transparent focus:border-brand-400 dark:bg-slate-800/70']

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
  <!-- Latar gelap senada brand + pola garis gedung samar; warna mengikuti tema (--color-brand-*) -->
  <div
    class="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[color-mix(in_oklab,var(--color-brand-950)_50%,#04070d)] p-4 sm:p-8 dark:bg-[color-mix(in_oklab,var(--color-brand-950)_22%,#020617)]"
  >
    <PolaLatarKlinik class="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 w-full text-white/[0.07] sm:h-80" />

    <div
      class="grid w-full max-w-[68rem] overflow-hidden rounded-[2rem] shadow-2xl ring-1 shadow-black/40 ring-white/10 motion-safe:animate-pop lg:min-h-[40rem] lg:grid-cols-2"
    >
      <!-- Panel form -->
      <section class="flex flex-col bg-[color-mix(in_oklab,var(--color-brand-100)_45%,#eeede8)] px-6 py-7 sm:px-12 sm:py-9 dark:bg-slate-900">
        <div class="flex items-center gap-2.5">
          <AppLogo class="size-9" />
          <p class="text-[17px] font-bold tracking-tight text-slate-800 dark:text-white">{{ klinik.nama }}</p>
        </div>

        <div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 class="text-center text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">{{ tantangan ? 'Verifikasi Dua Langkah' : 'Masuk' }}</h1>
          <p class="mt-1.5 text-center text-sm text-slate-500 dark:text-slate-400">
            {{
              tantangan
                ? 'Masukkan kode 6 digit dari aplikasi authenticator, atau salah satu kode pemulihan.'
                : 'Selamat datang kembali! Masuk dengan akun yang diberikan administrator klinik.'
            }}
          </p>

          <form class="mt-8 space-y-5" @submit.prevent="submit">
            <div v-if="message" class="alert alert-danger py-2">{{ message }}</div>
            <template v-if="!tantangan">
              <div>
                <label class="label text-[13px] text-slate-700 dark:text-slate-300" for="email">Email <span class="text-brand-700 dark:text-brand-400">*</span></label>
                <div class="relative">
                  <AppIcon :path="ikon.email" size="size-4.5" class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    v-model="form.email"
                    type="email"
                    :class="kolom(errors.email)"
                    class="pl-11"
                    placeholder="nama@klinik.com"
                    autocomplete="username"
                    required
                    autofocus
                  />
                </div>
                <p v-if="errors.email" class="field-error pl-4">{{ errors.email }}</p>
              </div>
              <div>
                <label class="label text-[13px] text-slate-700 dark:text-slate-300" for="password">Password <span class="text-brand-700 dark:text-brand-400">*</span></label>
                <div class="relative">
                  <AppIcon :path="ikon.kunci" size="size-4.5" class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    v-model="form.password"
                    :type="lihatPassword ? 'text' : 'password'"
                    :class="kolom(errors.password)"
                    class="pr-12 pl-11"
                    placeholder="Masukkan password"
                    autocomplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    class="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:hover:bg-white/10 dark:hover:text-slate-200"
                    :aria-label="lihatPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                    :aria-pressed="lihatPassword"
                    @click="lihatPassword = !lihatPassword"
                  >
                    <AppIcon :path="lihatPassword ? ikon.mataTutup : ikon.mata" size="size-4.5" />
                  </button>
                </div>
                <p v-if="errors.password" class="field-error pl-4">{{ errors.password }}</p>
              </div>
            </template>
            <div v-else>
              <label class="label text-[13px] text-slate-700 dark:text-slate-300" for="kode">Kode verifikasi</label>
              <input
                id="kode"
                v-model="kode"
                :class="kolom(errors.kode)"
                class="text-center font-mono text-lg tracking-[0.3em]"
                autocomplete="one-time-code"
                maxlength="20"
                required
                autofocus
              />
              <p v-if="errors.kode" class="field-error pl-4">{{ errors.kode }}</p>
            </div>
            <button type="submit" class="btn btn-primary w-full py-3 text-[15px]" :disabled="loading">
              <AppSpinner v-if="loading" />{{ loading ? 'Memproses...' : tantangan ? 'Verifikasi' : 'Masuk' }}
            </button>
            <button
              v-if="tantangan"
              type="button"
              class="mx-auto flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-brand-900 hover:underline dark:text-slate-400 dark:hover:text-brand-300"
              @click="batal2fa"
            >
              <AppIcon :path="ikon.kembali" size="size-3.5" />Kembali ke email & password
            </button>
          </form>

          <div v-if="!tantangan" class="mt-9">
            <div class="flex items-center gap-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              <span class="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />Akun demo<span class="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
            </div>
            <p class="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Password semua akun: <code class="rounded bg-slate-900/5 px-1 dark:bg-white/10">password</code>
            </p>
            <div class="mt-3 flex flex-wrap justify-center gap-1.5">
              <button v-for="[role, label] in demoAkun" :key="role" type="button" class="btn btn-secondary btn-sm border-transparent" @click="isiDemo(role)">{{ label }}</button>
            </div>
          </div>
        </div>

        <p class="text-center text-xs text-slate-400 dark:text-slate-500">&copy; {{ new Date().getFullYear() }} Lefateach</p>
      </section>

      <!-- Panel kutipan + ilustrasi klinik -->
      <!-- Ilustrasi ikut alur flex (bukan absolute) agar tidak pernah menimpa kutipan saat kartu memendek (langkah 2FA) -->
      <aside class="hidden flex-col overflow-hidden bg-[color-mix(in_oklab,var(--color-brand-50)_45%,#fbfbf8)] lg:flex dark:bg-slate-800/60">
        <div class="px-14 pt-16 pb-8 xl:px-16">
          <svg class="size-7 text-orange-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="KUTIP" /></svg>
          <blockquote class="mt-4 max-w-md text-xl leading-snug font-semibold text-slate-800 xl:text-[22px] dark:text-slate-100">
            Pendaftaran, rekam medis, farmasi, hingga kasir tertata dalam satu sistem, sehingga tim klinik bisa lebih fokus melayani pasien.
          </blockquote>
          <div class="flex max-w-md justify-end">
            <svg class="mt-2 size-7 rotate-180 text-orange-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="KUTIP" /></svg>
          </div>
          <div class="mt-5 flex items-center gap-3">
            <div class="grid size-11 place-items-center rounded-full bg-white shadow-xs ring-1 ring-slate-900/5 dark:bg-slate-700 dark:ring-white/10">
              <AppLogo class="size-6" />
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ klinik.nama }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Sistem Informasi Klinik</p>
            </div>
          </div>
        </div>
        <IlustrasiKlinik class="pointer-events-none mt-auto block w-full" />
      </aside>
    </div>
  </div>
</template>
