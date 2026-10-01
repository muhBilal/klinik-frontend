<script setup>
/**
 * Galeri foto klinis pasien (PRD FT-02, RM-04): dikelompokkan per kunjungan, filter protokol/posisi/tahap,
 * pilih dua foto untuk dibandingkan, atau "bandingkan dengan awal" (foto pertama posisi yang sama).
 * Thumbnail diminta hanya untuk foto yang sedang tampil (setiap tautan tercatat di audit log).
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import BandingFoto from '@/components/foto/BandingFoto.vue'
import api, { errorMessage } from '@/lib/api'
import { labelPosisi, tautanFoto } from '@/lib/foto'
import { TAHAP_FOTO, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasienId: { type: Number, required: true },
  /** Diisi = default menampilkan foto kunjungan ini (bisa beralih ke semua kunjungan untuk perbandingan). */
  kunjunganId: { type: Number, default: null },
  /** Naikkan nilainya untuk memuat ulang (mis. setelah foto baru diunggah). */
  muatUlang: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
})
const auth = useAuthStore()
const toast = useToastStore()

const fotos = ref([])
const thumbs = ref({})
const loading = ref(false)
const lingkup = ref(props.kunjunganId ? 'kunjungan' : 'semua')
const filter = reactive({ protokol: '', posisi: '', tahap: '' })
const dipilih = ref([])
const bandingOpen = ref(false)
const bandingFotos = ref([])
const lihat = ref(null)
const menghapus = ref(false)

const bisaHapus = computed(() => !props.readonly && auth.can('berkas.kelola'))
const protokolOpsi = computed(() => [...new Map(fotos.value.filter((f) => f.protokol).map((f) => [f.protokol.id, f.protokol])).values()])
const posisiOpsi = computed(() => {
  const p = protokolOpsi.value.find((x) => x.id === Number(filter.protokol))
  return p?.posisi ?? []
})

const tampil = computed(() =>
  fotos.value.filter(
    (f) =>
      (lingkup.value === 'semua' || f.kunjungan_id === props.kunjunganId) &&
      (!filter.protokol || f.protokol_foto_id === Number(filter.protokol)) &&
      (!filter.posisi || f.posisi === filter.posisi) &&
      (!filter.tahap || f.tahap === filter.tahap),
  ),
)

/** [{ kunci, judul, fotos }] terbaru dulu; foto dalam grup mengikuti urutan posisi protokol. */
const grup = computed(() => {
  const map = new Map()
  for (const f of tampil.value) {
    const kunci = f.kunjungan_id ?? `tanpa-${f.uuid}`
    if (!map.has(kunci)) {
      map.set(kunci, {
        kunci,
        tanggal: f.kunjungan?.tanggal ?? f.diambil_at ?? f.created_at,
        judul: f.kunjungan ? `${tanggal(f.kunjungan.tanggal)} · ${f.kunjungan.poli?.nama ?? ''}` : `Tanpa kunjungan · ${tanggal(f.created_at)}`,
        fotos: [],
      })
    }
    map.get(kunci).fotos.push(f)
  }
  const urutan = (f) => f.protokol?.posisi?.findIndex((p) => p.kode === f.posisi) ?? 99
  return [...map.values()]
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .map((g) => ({ ...g, fotos: g.fotos.sort((a, b) => urutan(a) - urutan(b) || new Date(a.created_at) - new Date(b.created_at)) }))
})

async function muat() {
  loading.value = true
  try {
    fotos.value = (await api.get('/berkas', { params: { pasien_id: props.pasienId, kategori: 'foto_klinis' }, silent: true })).data
    dipilih.value = dipilih.value.filter((u) => fotos.value.some((f) => f.uuid === u))
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

// Thumbnail untuk foto yang tampil & belum punya tautan
watch(tampil, async (daftar) => {
  const perlu = daftar.filter((f) => f.ada_thumbnail && !thumbs.value[f.uuid]).map((f) => f.uuid)
  if (!perlu.length) return
  try {
    thumbs.value = { ...thumbs.value, ...(await tautanFoto(perlu, { pratinjau: true })) }
  } catch (e) {
    toast.error(errorMessage(e))
  }
})

watch(() => [props.pasienId, props.muatUlang], muat, { immediate: true })
watch(() => filter.protokol, () => (filter.posisi = ''))

function toggle(f) {
  if (dipilih.value.includes(f.uuid)) dipilih.value = dipilih.value.filter((u) => u !== f.uuid)
  else if (dipilih.value.length < 2) dipilih.value = [...dipilih.value, f.uuid]
  else toast.info('Pilih paling banyak dua foto untuk dibandingkan.')
}

function banding(daftar) {
  bandingFotos.value = daftar
  bandingOpen.value = true
}

const bandingDipilih = () => banding(fotos.value.filter((f) => dipilih.value.includes(f.uuid)))

/** Foto pertama pasien dengan protokol & posisi yang sama dari kunjungan lain (baseline "sebelum"). */
function fotoAwal(f) {
  if (!f.protokol_foto_id || !f.posisi) return null
  const waktuF = new Date(f.diambil_at ?? f.created_at)
  return (
    fotos.value
      .filter((x) => x.uuid !== f.uuid && x.protokol_foto_id === f.protokol_foto_id && x.posisi === f.posisi && x.kunjungan_id !== f.kunjungan_id && new Date(x.diambil_at ?? x.created_at) < waktuF)
      .sort((a, b) => new Date(a.diambil_at ?? a.created_at) - new Date(b.diambil_at ?? b.created_at))[0] ?? null
  )
}

async function buka(f) {
  lihat.value = { foto: f, url: null }
  try {
    const url = await tautanFoto([f.uuid])
    if (lihat.value?.foto.uuid === f.uuid) lihat.value = { foto: f, url: url[f.uuid] }
  } catch (e) {
    toast.error(errorMessage(e))
    lihat.value = null
  }
}

async function hapus() {
  const f = lihat.value?.foto
  if (!f || !confirm('Hapus foto dari galeri? Foto tetap disimpan untuk retensi rekam medis.')) return
  menghapus.value = true
  try {
    await api.delete(`/berkas/${f.uuid}`)
    fotos.value = fotos.value.filter((x) => x.uuid !== f.uuid)
    lihat.value = null
    toast.success('Foto dihapus dari galeri.')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    menghapus.value = false
  }
}

defineExpose({ muat })
</script>

<template>
  <!-- @container: jumlah kolom mengikuti lebar kartu (sempit di kolom samping pemeriksaan, lebar di detail pasien) -->
  <div class="@container space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div v-if="kunjunganId" class="tabs w-fit">
        <button type="button" :class="{ 'tab-active': lingkup === 'kunjungan' }" class="tab" @click="lingkup = 'kunjungan'">Kunjungan ini</button>
        <button type="button" :class="{ 'tab-active': lingkup === 'semua' }" class="tab" @click="lingkup = 'semua'">Semua kunjungan</button>
      </div>
      <select v-if="protokolOpsi.length" v-model="filter.protokol" class="filter" aria-label="Filter protokol">
        <option value="">Semua protokol</option>
        <option v-for="p in protokolOpsi" :key="p.id" :value="p.id">{{ p.nama }}</option>
      </select>
      <select v-if="posisiOpsi.length" v-model="filter.posisi" class="filter" aria-label="Filter posisi">
        <option value="">Semua posisi</option>
        <option v-for="p in posisiOpsi" :key="p.kode" :value="p.kode">{{ p.label }}</option>
      </select>
      <select v-model="filter.tahap" class="filter" aria-label="Filter tahap">
        <option value="">Semua tahap</option>
        <option v-for="(label, val) in TAHAP_FOTO" :key="val" :value="val">{{ label }}</option>
      </select>
      <AppSpinner v-if="loading" class="text-slate-400" />
      <button v-if="dipilih.length === 2" type="button" class="btn btn-primary btn-sm ml-auto" @click="bandingDipilih">Bandingkan 2 foto</button>
      <span v-else-if="dipilih.length" class="ml-auto text-xs text-slate-500">Pilih 1 foto lagi untuk dibandingkan</span>
    </div>

    <p v-if="!loading && !grup.length" class="rounded-2xl border border-dashed border-line py-6 text-center text-sm text-slate-400">
      {{ lingkup === 'kunjungan' ? 'Belum ada foto di kunjungan ini.' : 'Belum ada foto klinis.' }}
    </p>

    <section v-for="g in grup" :key="g.kunci" class="space-y-2">
      <p v-if="lingkup === 'semua'" class="text-xs font-semibold text-slate-500">{{ g.judul }}</p>
      <div class="grid grid-cols-3 gap-2 @sm:grid-cols-4 @2xl:grid-cols-6 @5xl:grid-cols-8">
        <div
          v-for="f in g.fotos"
          :key="f.uuid"
          :class="dipilih.includes(f.uuid) ? 'ring-2 ring-brand-900' : 'ring-1 ring-line'"
          class="group relative overflow-hidden rounded-2xl bg-slate-900/5"
        >
          <button type="button" class="block aspect-square w-full" :aria-label="`Lihat ${labelPosisi(f)}`" @click="buka(f)">
            <img v-if="thumbs[f.uuid]" :src="thumbs[f.uuid]" :alt="labelPosisi(f)" class="size-full object-cover" draggable="false" @contextmenu.prevent />
            <span v-else class="flex size-full items-center justify-center text-xs text-slate-400">{{ f.ada_thumbnail ? '...' : 'Foto' }}</span>
          </button>
          <label class="absolute top-1.5 left-1.5 flex size-6 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow" :title="dipilih.includes(f.uuid) ? 'Batal pilih' : 'Pilih untuk dibandingkan'">
            <input type="checkbox" class="accent-brand-600" :checked="dipilih.includes(f.uuid)" :aria-label="`Pilih ${labelPosisi(f)} untuk dibandingkan`" @change="toggle(f)" />
          </label>
          <span v-if="f.tahap" class="absolute top-1.5 right-1.5 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white">{{ TAHAP_FOTO[f.tahap] }}</span>
          <div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-slate-950/75 to-transparent px-2 pt-5 pb-1.5">
            <span class="truncate text-[11px] font-medium text-white">{{ labelPosisi(f) }}</span>
            <button
              v-if="fotoAwal(f)"
              type="button"
              class="shrink-0 rounded-full bg-white/90 px-1.5 text-[10px] font-semibold text-slate-800"
              title="Bandingkan dengan foto pertama posisi yang sama"
              @click="banding([fotoAwal(f), f])"
            >
              ⇆ awal
            </button>
          </div>
        </div>
      </div>
    </section>

    <BandingFoto v-model="bandingOpen" :fotos="bandingFotos" />

    <AppModal :model-value="!!lihat" :title="lihat ? `${labelPosisi(lihat.foto)}${lihat.foto.tahap ? ` · ${TAHAP_FOTO[lihat.foto.tahap]}` : ''}` : ''" size="max-w-3xl" @update:model-value="lihat = null">
      <template v-if="lihat">
        <div class="flex min-h-64 items-center justify-center rounded-2xl bg-slate-950">
          <img v-if="lihat.url" :src="lihat.url" :alt="labelPosisi(lihat.foto)" class="max-h-[70vh] select-none" draggable="false" @contextmenu.prevent />
          <AppSpinner v-else class="text-slate-300" />
        </div>
        <p class="mt-3 text-center text-xs text-slate-500">
          {{ lihat.foto.protokol?.nama ?? 'Tanpa protokol' }} · diambil {{ waktu(lihat.foto.diambil_at ?? lihat.foto.created_at) }} · {{ lihat.foto.pengunggah?.name ?? '-' }}
          <template v-if="lihat.foto.keterangan"> · {{ lihat.foto.keterangan }}</template>
        </p>
      </template>
      <template v-if="bisaHapus" #footer>
        <button class="btn btn-ghost text-rose-600" :disabled="menghapus" @click="hapus"><AppSpinner v-if="menghapus" />Hapus dari galeri</button>
        <button class="btn btn-secondary" @click="lihat = null">Tutup</button>
      </template>
    </AppModal>
  </div>
</template>
