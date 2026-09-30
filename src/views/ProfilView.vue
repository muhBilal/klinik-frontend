<script setup>
import QRCode from 'qrcode'
import { computed, reactive, ref } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()

const aktif2fa = computed(() => !!auth.user?.two_factor?.aktif)

// ---- Ganti password ----
const pwd = reactive({ password_lama: '', password: '', password_confirmation: '' })
const pwdErrors = ref({})
const pwdSaving = ref(false)

async function gantiPassword() {
  pwdSaving.value = true
  pwdErrors.value = {}
  try {
    const { data } = await api.put('/me/password', pwd)
    Object.assign(pwd, { password_lama: '', password: '', password_confirmation: '' })
    toast.success(data.message)
  } catch (e) {
    pwdErrors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    pwdSaving.value = false
  }
}

// ---- 2FA ----
const setup = ref(null) // { secret, qr }
const kode = ref('')
const kodePemulihan = ref([])
const proses = ref(false)
const tfErrors = ref({})
const konfirmasi = reactive({ aksi: '', password: '' })

const secretTampil = computed(() => setup.value?.secret.match(/.{1,4}/g).join(' ') ?? '')

async function mulai() {
  proses.value = true
  try {
    const { data } = await api.post('/me/2fa')
    setup.value = { secret: data.secret, qr: await QRCode.toDataURL(data.otpauth_url, { width: 220, margin: 1 }) }
    kode.value = ''
    tfErrors.value = {}
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    proses.value = false
  }
}

async function aktifkan() {
  proses.value = true
  tfErrors.value = {}
  try {
    const { data } = await api.post('/me/2fa/konfirmasi', { kode: kode.value })
    kodePemulihan.value = data.kode_pemulihan
    setup.value = null
    await auth.fetchMe()
    toast.success('Autentikasi dua langkah aktif.')
  } catch (e) {
    tfErrors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    proses.value = false
  }
}

async function jalankanKonfirmasi() {
  proses.value = true
  tfErrors.value = {}
  try {
    if (konfirmasi.aksi === 'kode-baru') {
      const { data } = await api.post('/me/2fa/kode-pemulihan', { password: konfirmasi.password })
      kodePemulihan.value = data.kode_pemulihan
      toast.success('Kode pemulihan baru dibuat. Kode lama tidak berlaku lagi.')
    } else {
      await api.delete('/me/2fa', { data: { password: konfirmasi.password } })
      kodePemulihan.value = []
      await auth.fetchMe()
      toast.success('Autentikasi dua langkah dinonaktifkan.')
    }
    Object.assign(konfirmasi, { aksi: '', password: '' })
  } catch (e) {
    tfErrors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    proses.value = false
  }
}

async function salinKode() {
  try {
    await navigator.clipboard.writeText(kodePemulihan.value.join('\n'))
    toast.success('Kode pemulihan disalin.')
  } catch {
    toast.error('Gagal menyalin. Catat kode secara manual.')
  }
}
</script>

<template>
  <PageHeader title="Profil & Keamanan" subtitle="Akun Anda, password, dan autentikasi dua langkah (2FA)" />

  <div v-if="auth.perlu2fa" class="alert alert-warning mb-5">
    Peran <b>{{ auth.user.role_label }}</b> wajib memakai autentikasi dua langkah. Aktifkan 2FA di bawah ini untuk melanjutkan memakai aplikasi.
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="space-y-5">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Akun</h2></div>
        <dl class="card-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-slate-500">Nama</dt><dd class="font-medium">{{ auth.user?.name }}</dd>
          <dt class="text-slate-500">Email</dt><dd>{{ auth.user?.email }}</dd>
          <dt class="text-slate-500">Peran</dt><dd>{{ auth.user?.role_label }}</dd>
          <dt class="text-slate-500">Cabang</dt><dd>{{ auth.user?.cabang?.nama ?? 'Semua cabang' }}</dd>
          <template v-if="auth.user?.poli"><dt class="text-slate-500">Poli</dt><dd>{{ auth.user.poli.nama }}</dd></template>
          <template v-if="auth.user?.sip"><dt class="text-slate-500">No. SIP</dt><dd>{{ auth.user.sip }}</dd></template>
        </dl>
      </div>

      <form class="card" @submit.prevent="gantiPassword">
        <div class="card-header"><h2 class="card-title">Ganti Password</h2></div>
        <div class="card-body space-y-4">
          <div>
            <label class="label" for="pwd-lama">Password saat ini</label>
            <input id="pwd-lama" v-model="pwd.password_lama" type="password" class="input" :class="{ 'input-error': pwdErrors.password_lama }" autocomplete="current-password" required />
            <p v-if="pwdErrors.password_lama" class="field-error">{{ pwdErrors.password_lama }}</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="pwd-baru">Password baru</label>
              <input id="pwd-baru" v-model="pwd.password" type="password" minlength="8" class="input" :class="{ 'input-error': pwdErrors.password }" autocomplete="new-password" required />
              <p v-if="pwdErrors.password" class="field-error">{{ pwdErrors.password }}</p>
            </div>
            <div>
              <label class="label" for="pwd-ulang">Ulangi password baru</label>
              <input id="pwd-ulang" v-model="pwd.password_confirmation" type="password" class="input" autocomplete="new-password" required />
            </div>
          </div>
          <p class="text-xs text-slate-400">Setelah diganti, sesi login di perangkat lain otomatis diakhiri.</p>
          <button type="submit" class="btn btn-primary" :disabled="pwdSaving"><AppSpinner v-if="pwdSaving" />Simpan password</button>
        </div>
      </form>
    </div>

    <div class="card self-start">
      <div class="card-header">
        <h2 class="card-title">Autentikasi Dua Langkah (2FA)</h2>
        <span :class="aktif2fa ? 'bg-emerald-600' : 'bg-slate-500'" class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white">{{ aktif2fa ? 'Aktif' : 'Nonaktif' }}</span>
      </div>
      <div class="card-body space-y-4 text-sm">
        <p class="text-slate-600">
          Selain password, login memerlukan kode 6 digit dari aplikasi authenticator (Google Authenticator, Microsoft Authenticator, Authy).
          Disarankan untuk admin dan dokter.
        </p>

        <!-- Kode pemulihan: ditampilkan sekali -->
        <div v-if="kodePemulihan.length" class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p class="font-semibold text-amber-900">Simpan kode pemulihan ini sekarang</p>
          <p class="mt-1 text-xs text-amber-800">Setiap kode hanya bisa dipakai sekali bila ponsel hilang. Kode tidak akan ditampilkan lagi.</p>
          <ul class="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm tabular-nums">
            <li v-for="k in kodePemulihan" :key="k" class="rounded-lg bg-white px-2 py-1 text-center">{{ k }}</li>
          </ul>
          <div class="mt-3 flex gap-2">
            <button class="btn btn-secondary btn-sm" @click="salinKode">Salin</button>
            <button class="btn btn-ghost btn-sm" @click="kodePemulihan = []">Sudah saya simpan</button>
          </div>
        </div>

        <template v-if="!aktif2fa">
          <button v-if="!setup" class="btn btn-primary" :disabled="proses" @click="mulai"><AppSpinner v-if="proses" />Aktifkan 2FA</button>

          <form v-else class="space-y-4" @submit.prevent="aktifkan">
            <ol class="list-decimal space-y-1 pl-5 text-slate-600">
              <li>Pindai QR code dengan aplikasi authenticator, atau masukkan kunci secara manual.</li>
              <li>Masukkan kode 6 digit yang muncul di aplikasi.</li>
            </ol>
            <div class="flex flex-wrap items-center gap-4">
              <img :src="setup.qr" alt="QR code 2FA" class="size-44 rounded-2xl bg-white p-2 shadow-sm" />
              <div>
                <p class="text-xs text-slate-500">Kunci manual</p>
                <p class="font-mono text-sm tracking-wider break-all select-all">{{ secretTampil }}</p>
              </div>
            </div>
            <div>
              <label class="label" for="kode-2fa">Kode verifikasi</label>
              <input
                id="kode-2fa"
                v-model="kode"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                class="input max-w-40 text-center font-mono text-lg tracking-[0.3em]"
                :class="{ 'input-error': tfErrors.kode }"
                required
              />
              <p v-if="tfErrors.kode" class="field-error">{{ tfErrors.kode }}</p>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn btn-primary" :disabled="proses || kode.length < 6"><AppSpinner v-if="proses" />Verifikasi & aktifkan</button>
              <button type="button" class="btn btn-secondary" @click="setup = null">Batal</button>
            </div>
          </form>
        </template>

        <template v-else>
          <div v-if="!konfirmasi.aksi" class="flex flex-wrap gap-2">
            <button class="btn btn-secondary" @click="konfirmasi.aksi = 'kode-baru'">Buat kode pemulihan baru</button>
            <button class="btn btn-ghost text-rose-600" @click="konfirmasi.aksi = 'nonaktif'">Nonaktifkan 2FA</button>
          </div>
          <form v-else class="space-y-3" @submit.prevent="jalankanKonfirmasi">
            <p v-if="konfirmasi.aksi === 'nonaktif' && auth.user?.two_factor?.wajib" class="alert alert-warning py-2">
              Peran Anda wajib 2FA: setelah dinonaktifkan, aplikasi tidak bisa dipakai sampai 2FA diaktifkan kembali.
            </p>
            <div>
              <label class="label" for="pwd-konfirmasi">Masukkan password untuk {{ konfirmasi.aksi === 'nonaktif' ? 'menonaktifkan 2FA' : 'membuat kode baru' }}</label>
              <input id="pwd-konfirmasi" v-model="konfirmasi.password" type="password" class="input" :class="{ 'input-error': tfErrors.password }" autocomplete="current-password" required />
              <p v-if="tfErrors.password" class="field-error">{{ tfErrors.password }}</p>
            </div>
            <div class="flex gap-2">
              <button type="submit" :class="konfirmasi.aksi === 'nonaktif' ? 'btn-danger' : 'btn-primary'" class="btn" :disabled="proses"><AppSpinner v-if="proses" />Lanjutkan</button>
              <button type="button" class="btn btn-secondary" @click="Object.assign(konfirmasi, { aksi: '', password: '' })">Batal</button>
            </div>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
