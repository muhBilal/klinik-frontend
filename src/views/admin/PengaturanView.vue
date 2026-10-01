<script setup>
import { onMounted, ref } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const klinik = useKlinikStore()

/** Bentuk sama dengan GET /pengaturan: { klinik: {...}, struk: {...}, cetak: {...}, penomoran: {...}, keamanan: {...} } */
const form = ref(null)
const perans = ref([])
const loadError = ref('')
const errors = ref({})
const saving = ref(false)

async function load() {
  loadError.value = ''
  try {
    ;[form.value, perans.value] = await Promise.all([api.get('/pengaturan').then((r) => r.data), cachedGet('/perans')])
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    form.value = (await api.put('/pengaturan', form.value)).data
    klinik.muat(true)
    toast.success('Pengaturan tersimpan.')
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

const err = (key) => errors.value[key] ?? Object.entries(errors.value).find(([k]) => k.startsWith(`${key}.`))?.[1]

onMounted(load)
</script>

<template>
  <PageHeader title="Pengaturan Klinik" subtitle="Identitas klinik, kop struk, penomoran dokumen, dan keamanan sesi. Setiap perubahan tercatat di audit log.">
    <button v-if="form" type="submit" form="form-pengaturan" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
  </PageHeader>

  <form v-if="form" id="form-pengaturan" class="grid gap-5 lg:grid-cols-2" @submit.prevent="simpan">
    <div class="card">
      <div class="card-header"><h2 class="card-title">Identitas Klinik</h2></div>
      <div class="card-body grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="p-nama">Nama klinik *</label>
          <input id="p-nama" v-model="form.klinik.nama" class="input" :class="{ 'input-error': err('klinik.nama') }" required maxlength="100" />
          <p v-if="err('klinik.nama')" class="field-error">{{ err('klinik.nama') }}</p>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="p-alamat">Alamat</label>
          <input id="p-alamat" v-model="form.klinik.alamat" class="input" maxlength="255" />
        </div>
        <div>
          <label class="label" for="p-telp">Telepon</label>
          <input id="p-telp" v-model="form.klinik.telepon" class="input" maxlength="30" />
        </div>
        <div>
          <label class="label" for="p-email">Email</label>
          <input id="p-email" v-model="form.klinik.email" type="email" class="input" :class="{ 'input-error': err('klinik.email') }" />
          <p v-if="err('klinik.email')" class="field-error">{{ err('klinik.email') }}</p>
        </div>
        <div>
          <label class="label" for="p-npwp">NPWP</label>
          <input id="p-npwp" v-model="form.klinik.npwp" class="input" maxlength="30" />
        </div>
        <p class="text-xs text-slate-400 sm:col-span-2">Alamat & telepon per cabang diatur di Master Cabang; struk memakai data cabang bila terisi.</p>
      </div>
    </div>

    <div class="space-y-5">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Struk & Cetak</h2></div>
        <div class="card-body grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label" for="p-kaki">Catatan kaki struk</label>
            <input id="p-kaki" v-model="form.struk.catatan_kaki" class="input" maxlength="255" />
          </div>
          <div>
            <label class="label" for="p-lebar">Lebar kertas struk</label>
            <select id="p-lebar" v-model="form.cetak.lebar_struk" class="input">
              <option value="58mm">58 mm (printer thermal kecil)</option>
              <option value="80mm">80 mm</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Penomoran Dokumen</h2></div>
        <div class="card-body grid gap-4 sm:grid-cols-3">
          <div v-for="[key, label] in [['prefix_registrasi', 'Registrasi'], ['prefix_resep', 'Resep'], ['prefix_tagihan', 'Tagihan']]" :key="key">
            <label class="label" :for="`p-${key}`">Prefix {{ label }}</label>
            <input
              :id="`p-${key}`"
              v-model="form.penomoran[key]"
              class="input font-mono uppercase"
              :class="{ 'input-error': err(`penomoran.${key}`) }"
              maxlength="5"
              @input="form.penomoran[key] = form.penomoran[key].toUpperCase()"
            />
            <p v-if="err(`penomoran.${key}`)" class="field-error">{{ err(`penomoran.${key}`) }}</p>
          </div>
          <p class="text-xs text-slate-400 sm:col-span-3">Format: PREFIX + tanggal + nomor urut, mis. {{ form.penomoran.prefix_registrasi }}202609300001. Mengganti prefix tidak mereset nomor urut hari ini.</p>
        </div>
      </div>
    </div>

    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Rekam Medis</h2></div>
      <div class="card-body">
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.rme.wajib_informed_consent" type="checkbox" class="mt-0.5 accent-brand-600" />
          <span>
            Wajib informed consent sebelum pemeriksaan ditutup
            <span class="block text-xs text-slate-400">Berlaku untuk treatment yang diberi template consent di Katalog Treatment. Matikan hanya bila consent masih diambil di kertas.</span>
          </span>
        </label>
      </div>
    </div>

    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Foto Klinis</h2></div>
      <div class="card-body space-y-4">
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.foto.wajib_consent" type="checkbox" class="mt-0.5 accent-brand-600" />
          <span>
            Wajib persetujuan foto pasien sebelum foto klinis diambil
            <span class="block text-xs text-slate-400">UU PDP: foto wajah termasuk data pribadi spesifik. Matikan hanya bila persetujuan masih diambil di kertas.</span>
          </span>
        </label>
        <div>
          <label class="label" for="p-naskah-foto">Naskah persetujuan foto</label>
          <textarea id="p-naskah-foto" v-model="form.foto.naskah_consent" rows="10" class="input" :class="{ 'input-error': err('foto.naskah_consent') }" maxlength="10000" />
          <p v-if="err('foto.naskah_consent')" class="field-error">{{ err('foto.naskah_consent') }}</p>
          <p v-else class="mt-1 text-xs text-slate-400">Placeholder: {nama_pasien} {no_rm} {klinik} {tanggal} {tingkat} {pilihan} (daftar tingkat dengan tanda [x]). Persetujuan yang sudah ditandatangani tidak ikut berubah.</p>
        </div>
      </div>
    </div>

    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Keamanan</h2></div>
      <div class="card-body grid gap-5 sm:grid-cols-[16rem_1fr]">
        <div>
          <label class="label" for="p-idle">Akhiri sesi bila tidak aktif (menit)</label>
          <input id="p-idle" v-model.number="form.keamanan.idle_timeout_menit" type="number" min="5" max="480" class="input" :class="{ 'input-error': err('keamanan.idle_timeout_menit') }" />
          <p v-if="err('keamanan.idle_timeout_menit')" class="field-error">{{ err('keamanan.idle_timeout_menit') }}</p>
          <p v-else class="mt-1 text-xs text-slate-400">PRD: 15 menit untuk perangkat bersama.</p>
        </div>
        <div>
          <p class="label">Peran yang wajib memakai 2FA</p>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <label v-for="p in perans" :key="p.kode" class="flex items-center gap-2 text-sm">
              <input v-model="form.keamanan.wajib_2fa" type="checkbox" :value="p.kode" class="accent-brand-600" /> {{ p.nama }}
            </label>
          </div>
          <p v-if="err('keamanan.wajib_2fa')" class="field-error">{{ err('keamanan.wajib_2fa') }}</p>
          <p v-else class="mt-2 text-xs text-slate-400">Pengguna dengan peran tercentang harus mengaktifkan 2FA di halaman Profil sebelum bisa memakai fitur lain.</p>
        </div>
      </div>
    </div>
  </form>
  <PageLoading v-else :error="loadError" text="Memuat pengaturan..." @retry="load" />
</template>
