<script setup>
/**
 * Ambil foto klinis terpandu per protokol (PRD FT-01): kamera di dalam aplikasi (getUserMedia) sehingga foto tidak masuk
 * galeri perangkat (FT-03), panduan bingkai & petunjuk per posisi, pratinjau → simpan & lanjut ke posisi berikutnya.
 * Tanpa kamera (desktop / halaman bukan HTTPS) tersedia unggah berkas; gambar tetap diproses ulang (EXIF dibuang).
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { siapkanFoto, unggahFoto } from '@/lib/foto'
import { TAHAP_FOTO } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  pasienId: { type: Number, required: true },
  kunjunganId: { type: Number, default: null },
  /** Tindakan kunjungan yang bisa dikaitkan: [{ id, nama, protokol_foto_id }] */
  tindakans: { type: Array, default: () => [] },
  /** id tindakan kunjungan yang dipilih saat modal dibuka */
  tindakanId: { type: Number, default: null },
})
const emit = defineEmits(['uploaded'])
const toast = useToastStore()

const protokols = ref([])
const protokolId = ref('')
const tindakanDipilih = ref('')
const tahap = ref('sebelum')
const langkah = ref(0)
const selesaiPosisi = ref({})

const video = ref(null)
const inputFile = ref(null)
let stream = null
const kameraSiap = ref(false)
const kameraError = ref('')
const menghadap = ref('environment')
const pratinjau = ref(null)
const memproses = ref(false)
const mengunggah = ref(false)
const pesanConsent = ref('')

const protokol = computed(() => protokols.value.find((p) => p.id === Number(protokolId.value)) ?? null)
const posisiList = computed(() => protokol.value?.posisi ?? [{ kode: null, label: 'Foto bebas', petunjuk: 'Foto tanpa protokol posisi' }])
const posisi = computed(() => posisiList.value[langkah.value] ?? posisiList.value[0])
/** Posisi yang sudah difoto dihitung per tahap (sebelum & sesudah memotret posisi yang sama). */
const kunciPosisi = (p) => `${tahap.value}:${p.kode ?? '_'}`
const sudah = (p) => !!selesaiPosisi.value[kunciPosisi(p)]
const jumlahSelesai = computed(() => posisiList.value.filter(sudah).length)

watch(open, async (buka) => {
  if (!buka) return tutupKamera()
  pratinjau.value = null
  pesanConsent.value = ''
  selesaiPosisi.value = {}
  langkah.value = 0
  tindakanDipilih.value = props.tindakanId ?? ''
  try {
    protokols.value = await cachedGet('/protokol-fotos', { aktif: 1 })
  } catch (e) {
    toast.error(errorMessage(e))
  }
  const dariTindakan = props.tindakans.find((t) => t.id === props.tindakanId)?.protokol_foto_id
  protokolId.value = dariTindakan ?? protokols.value[0]?.id ?? ''
  await nextTick()
  bukaKamera()
})

watch(protokolId, () => {
  langkah.value = 0
  lepasPratinjau()
})

// Ganti tahap: mulai dari posisi pertama yang belum difoto di tahap itu
watch(tahap, () => {
  lepasPratinjau()
  langkah.value = Math.max(0, posisiList.value.findIndex((p) => !sudah(p)))
})

watch(tindakanDipilih, (id) => {
  const dariTindakan = props.tindakans.find((t) => t.id === Number(id))?.protokol_foto_id
  if (dariTindakan) protokolId.value = dariTindakan
})

async function bukaKamera() {
  tutupKamera()
  kameraError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    kameraError.value = 'Kamera tidak tersedia di browser ini (butuh HTTPS atau localhost). Gunakan unggah berkas.'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: menghadap.value, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    })
    if (!video.value) return tutupKamera()
    video.value.srcObject = stream
    await video.value.play()
    kameraSiap.value = true
  } catch (e) {
    kameraError.value = e?.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di browser atau gunakan unggah berkas.' : 'Kamera tidak dapat dibuka. Gunakan unggah berkas.'
  }
}

function tutupKamera() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  kameraSiap.value = false
}

function gantiKamera() {
  menghadap.value = menghadap.value === 'environment' ? 'user' : 'environment'
  bukaKamera()
}

function lepasPratinjau() {
  if (pratinjau.value) URL.revokeObjectURL(pratinjau.value.url)
  pratinjau.value = null
}

async function proses(sumber) {
  memproses.value = true
  try {
    const hasil = await siapkanFoto(sumber)
    lepasPratinjau()
    pratinjau.value = { hasil, url: URL.createObjectURL(hasil.foto) }
  } catch (e) {
    toast.error(e.message ?? 'Gagal memproses foto.')
  } finally {
    memproses.value = false
  }
}

const jepret = () => video.value && proses(video.value)

function pilihFile(e) {
  const file = e.target.files?.[0]
  if (file) proses(file)
  e.target.value = ''
}

async function simpan() {
  if (!pratinjau.value || mengunggah.value) return
  // Konteks dikunci sebelum upload: hasilnya harus menandai posisi & tahap yang difoto, bukan yang sedang tampil saat selesai.
  const ini = { pratinjau: pratinjau.value, kunci: kunciPosisi(posisi.value), tahap: tahap.value, langkah: langkah.value }
  mengunggah.value = true
  pesanConsent.value = ''
  try {
    const berkas = await unggahFoto({
      pasienId: props.pasienId,
      kunjunganId: props.kunjunganId,
      kunjunganTindakanId: tindakanDipilih.value || null,
      protokolId: protokol.value?.id,
      posisi: posisi.value.kode,
      tahap: ini.tahap,
      hasil: ini.pratinjau.hasil,
      namaFile: `${posisi.value.kode ?? 'foto'}-${ini.tahap}`,
    })
    selesaiPosisi.value = { ...selesaiPosisi.value, [ini.kunci]: true }
    emit('uploaded', berkas)
    if (pratinjau.value !== ini.pratinjau) return
    lepasPratinjau()
    // Lanjut ke posisi berikutnya yang belum diambil
    const berikut = posisiList.value.findIndex((p, i) => i > ini.langkah && !sudah(p))
    if (berikut >= 0) langkah.value = berikut
    else if (posisiList.value.every(sudah)) toast.success(`Semua posisi tahap ${TAHAP_FOTO[tahap.value].toLowerCase()} sudah difoto.`)
  } catch (e) {
    const err = validationErrors(e)
    if (err.consent_foto) pesanConsent.value = err.consent_foto
    toast.error(errorMessage(e))
  } finally {
    mengunggah.value = false
  }
}

onBeforeUnmount(() => {
  tutupKamera()
  lepasPratinjau()
})
</script>

<template>
  <AppModal v-model="open" title="Ambil Foto Klinis" size="max-w-4xl">
    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div>
          <label class="label" for="kamera-protokol">Protokol</label>
          <select id="kamera-protokol" v-model="protokolId" class="input" :disabled="mengunggah">
            <option value="">Tanpa protokol</option>
            <option v-for="p in protokols" :key="p.id" :value="p.id">{{ p.nama }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="kamera-tindakan">Tindakan terkait</label>
          <select id="kamera-tindakan" v-model="tindakanDipilih" class="input" :disabled="!tindakans.length || mengunggah">
            <option value="">— Tidak dikaitkan —</option>
            <option v-for="t in tindakans" :key="t.id" :value="t.id">{{ t.nama }}</option>
          </select>
        </div>
        <fieldset>
          <legend class="label">Tahap</legend>
          <div class="tabs w-fit">
            <button v-for="(label, val) in TAHAP_FOTO" :key="val" type="button" :class="{ 'tab-active': tahap === val }" class="tab" :disabled="mengunggah" @click="tahap = val">{{ label }}</button>
          </div>
        </fieldset>
      </div>

      <!-- Langkah posisi -->
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="(p, i) in posisiList"
          :key="p.kode ?? i"
          type="button"
          :class="i === langkah ? 'bg-brand-900 text-white' : sudah(p) ? 'bg-emerald-600/15 text-emerald-800' : 'bg-slate-900/5 text-slate-600'"
          class="rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60"
          :disabled="mengunggah"
          @click="langkah = i; lepasPratinjau()"
        >
          <span v-if="sudah(p)">✓ </span>{{ i + 1 }}. {{ p.label }}
        </button>
        <span v-if="protokol" class="self-center text-xs text-slate-500">{{ jumlahSelesai }}/{{ posisiList.length }} posisi</span>
      </div>

      <p v-if="pesanConsent" class="alert alert-danger">{{ pesanConsent }} Tanda tangani persetujuan foto di kartu Foto Klinis terlebih dahulu.</p>

      <!-- Jendela kamera / pratinjau -->
      <div class="relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-950">
        <!-- Video tetap terpasang saat pratinjau (v-show) agar stream kamera tidak kehilangan elemennya -->
        <video v-show="!pratinjau" ref="video" class="absolute inset-0 size-full object-contain" playsinline muted />
        <img v-if="pratinjau" :src="pratinjau.url" alt="Pratinjau foto" class="absolute inset-0 size-full object-contain" draggable="false" />
        <template v-else>
          <!-- Panduan bingkai: garis sepertiga + oval wajah agar komposisi sama antar kunjungan -->
          <svg v-if="kameraSiap" class="pointer-events-none absolute inset-0 size-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
            <g stroke="white" stroke-opacity="0.35" stroke-width="0.8">
              <line x1="133" y1="0" x2="133" y2="300" /><line x1="267" y1="0" x2="267" y2="300" />
              <line x1="0" y1="100" x2="400" y2="100" /><line x1="0" y1="200" x2="400" y2="200" />
            </g>
            <ellipse cx="200" cy="145" rx="72" ry="100" fill="none" stroke="white" stroke-opacity="0.7" stroke-width="1.5" stroke-dasharray="6 5" />
          </svg>
          <div v-if="!kameraSiap" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-300">
            <template v-if="kameraError">
              <p>{{ kameraError }}</p>
            </template>
            <template v-else><AppSpinner />Membuka kamera...</template>
          </div>
        </template>
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-5 pt-8 pb-3 text-white">
          <p class="text-sm font-semibold">{{ posisi.label }} <span class="font-normal opacity-80">· {{ TAHAP_FOTO[tahap] }}</span></p>
          <p v-if="posisi.petunjuk" class="text-xs opacity-80">{{ posisi.petunjuk }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <template v-if="pratinjau">
          <button type="button" class="btn btn-secondary" :disabled="mengunggah" @click="lepasPratinjau">Ulangi</button>
          <button type="button" class="btn btn-primary" :disabled="mengunggah" @click="simpan">
            <AppSpinner v-if="mengunggah" />{{ mengunggah ? 'Menyimpan...' : 'Simpan & lanjut' }}
          </button>
        </template>
        <template v-else>
          <button v-if="kameraSiap" type="button" class="btn btn-ghost btn-sm" @click="gantiKamera">Ganti kamera</button>
          <button
            v-if="kameraSiap"
            type="button"
            class="flex size-16 items-center justify-center rounded-full bg-white ring-4 ring-slate-900/80 transition active:scale-95 disabled:opacity-50"
            :disabled="memproses"
            aria-label="Ambil foto"
            @click="jepret"
          >
            <AppSpinner v-if="memproses" class="text-slate-900" /><span v-else class="size-12 rounded-full bg-slate-900" />
          </button>
          <button type="button" class="btn btn-secondary btn-sm" @click="inputFile?.click()">Unggah berkas</button>
          <input ref="inputFile" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" class="hidden" @change="pilihFile" />
        </template>
      </div>
      <p class="text-center text-xs text-slate-400">
        Foto langsung disimpan terenkripsi di server (tidak masuk galeri perangkat). Metadata lokasi/perangkat dibuang sebelum diunggah.
      </p>
    </div>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Selesai</button>
    </template>
  </AppModal>
</template>
