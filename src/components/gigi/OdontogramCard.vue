<script setup>
/**
 * Kartu Odontogram (PRD DG-01). Tiga mode:
 * - pemeriksaan (`kunjunganId` + `editable`): catat/akhiri/hapus kondisi selama pasien diperiksa, tambah tindakan per gigi;
 * - detail kunjungan (`kunjunganId`): status odontogram pada kunjungan itu + perubahannya (baca);
 * - detail pasien (tanpa `kunjunganId`): status terkini + pilihan melihat status pada kunjungan sebelumnya.
 * Kondisi hasil tindakan per gigi (mis. tambal → komposit) dibuat backend; ubah lewat tindakannya.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import OdontogramChart from '@/components/gigi/OdontogramChart.vue'
import api, { errorMessage } from '@/lib/api'
import { tanggal } from '@/lib/format'
import { PERMUKAAN, labelPermukaan, namaGigi, normalPermukaan, referensiGigi, sulung } from '@/lib/gigi'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasien: { type: Object, required: true },
  kunjunganId: { type: Number, default: null },
  /** Halaman pemeriksaan: boleh mencatat bila pasien sedang diperiksa (backend menentukan `bisa_diubah`). */
  editable: { type: Boolean, default: false },
  /** Tampilkan tombol "+ Tindakan untuk gigi ini" (dokter di pemeriksaan). */
  bisaTambahTindakan: { type: Boolean, default: false },
})
const emit = defineEmits(['tambah-tindakan', 'loaded'])
const auth = useAuthStore()
const toast = useToastStore()

const data = ref(null)
const peta = ref({})
const daftarKondisi = ref([])
const memuat = ref(false)
const menyimpan = ref(false)
const terpilih = ref(null)
const tampilSulung = ref(false)
const pilihanRiwayat = ref('')
const form = reactive({ kondisi: '', permukaan: [], keterangan: '' })

const bolehUbah = computed(() => props.editable && data.value?.bisa_diubah && auth.can('pemeriksaan.dokter', 'rme.tindakan'))
const kunjunganTampil = computed(() => props.kunjunganId ?? (pilihanRiwayat.value ? Number(pilihanRiwayat.value) : null))

async function muat() {
  memuat.value = true
  try {
    const [ref_, res] = await Promise.all([
      referensiGigi(),
      api.get(`/pasiens/${props.pasien.id}/odontogram`, { params: kunjunganTampil.value ? { kunjungan_id: kunjunganTampil.value } : {} }),
    ])
    peta.value = ref_.peta
    daftarKondisi.value = ref_.daftar
    setData(res.data)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memuat.value = false
  }
}

function setData(d) {
  data.value = d
  if (d.kondisis.some((k) => sulung(k.gigi))) tampilSulung.value = true
  emit('loaded', d)
}

defineExpose({ muatUlang: muat })

// ---- Gigi terpilih ----
const kondisiGigi = computed(() => (terpilih.value ? (data.value?.kondisis ?? []).filter((k) => k.gigi === terpilih.value.gigi) : []))
const opsiPermukaan = computed(() => daftarKondisi.value.filter((k) => k.cakupan === 'permukaan'))
const opsiGigi = computed(() => daftarKondisi.value.filter((k) => k.cakupan === 'gigi'))
const cakupanForm = computed(() => peta.value[form.kondisi]?.cakupan)

function pilih({ gigi, permukaan }) {
  terpilih.value = { gigi, permukaan }
  form.permukaan = permukaan ? [permukaan] : []
  form.keterangan = ''
  if (permukaan && cakupanForm.value !== 'permukaan') form.kondisi = 'car'
  if (!permukaan && cakupanForm.value === 'permukaan') form.kondisi = ''
}

function togglePermukaan(p) {
  form.permukaan = form.permukaan.includes(p) ? form.permukaan.filter((x) => x !== p) : [...form.permukaan, p]
}

const label = (k) => peta.value[k.kondisi]?.label ?? k.kondisi
const tempat = (k) => (k.permukaan ? labelPermukaan(k.gigi, k.permukaan) : 'Seluruh gigi')
const dariKunjunganIni = (k) => k.kunjungan_id === data.value?.kunjungan_id

async function kirim(promise, pesan) {
  menyimpan.value = true
  try {
    setData((await promise).data)
    if (pesan) toast.success(pesan)
    return true
  } catch (e) {
    toast.error(errorMessage(e))
    return false
  } finally {
    menyimpan.value = false
  }
}

async function catat() {
  if (!form.kondisi) return toast.error('Pilih kondisi gigi.')
  const permukaan = cakupanForm.value === 'permukaan' ? normalPermukaan(form.permukaan).split('') : []
  if (cakupanForm.value === 'permukaan' && !permukaan.length) return toast.error('Pilih minimal satu permukaan.')
  const ok = await kirim(
    api.post(`/kunjungans/${props.kunjunganId}/odontogram`, { gigi: terpilih.value.gigi, kondisi: form.kondisi, permukaan, keterangan: form.keterangan || null }),
    `${peta.value[form.kondisi]?.label} dicatat pada gigi ${terpilih.value.gigi}.`,
  )
  if (ok) form.keterangan = ''
}

const hapus = (k) => kirim(api.delete(`/kunjungans/${props.kunjunganId}/odontogram/${k.id}`), 'Catatan dihapus.')
const akhiri = (k) => confirm(`Akhiri "${label(k)}" pada gigi ${k.gigi}? Kondisi tidak berlaku lagi mulai kunjungan ini.`) && kirim(api.post(`/kunjungans/${props.kunjunganId}/odontogram/${k.id}/akhiri`), 'Kondisi diakhiri.')
const pulihkan = (k) => kirim(api.post(`/kunjungans/${props.kunjunganId}/odontogram/${k.id}/pulihkan`), 'Kondisi dipulihkan.')

function tambahTindakan() {
  emit('tambah-tindakan', { gigi: terpilih.value.gigi, permukaan: normalPermukaan(form.permukaan) })
}

// ---- Ringkasan & legenda ----
const legenda = computed(() => [...new Set((data.value?.kondisis ?? []).map((k) => k.kondisi))].map((kode) => peta.value[kode]).filter(Boolean))

/** "16: Karies (M, O) · Perawatan saluran akar" per gigi, urut nomor. */
const ringkasan = computed(() => {
  const per = new Map()
  for (const k of data.value?.kondisis ?? []) {
    const g = per.get(k.gigi) ?? new Map()
    const kunci = label(k)
    g.set(kunci, [...(g.get(kunci) ?? []), k.permukaan].filter(Boolean))
    per.set(k.gigi, g)
  }
  return [...per].sort(([a], [b]) => a - b).map(([gigi, g]) => ({
    gigi,
    teks: [...g].map(([nama, p]) => (p.length ? `${nama} (${normalPermukaan(p).split('').join(', ')})` : nama)).join(' · '),
  }))
})

const perubahan = computed(() => data.value?.perubahan)
const tergeser = (k) => perubahan.value?.diakhiri.some((d) => d.id === k.id)

watch(() => [props.pasien.id, props.kunjunganId], muat)
watch(pilihanRiwayat, muat)
onMounted(muat)
</script>

<template>
  <div class="card">
    <div class="card-header flex-wrap gap-2">
      <h2 class="card-title">Odontogram</h2>
      <div class="ml-auto flex flex-wrap items-center gap-3 text-xs">
        <AppSpinner v-if="memuat" class="text-slate-400" />
        <label class="flex items-center gap-1.5 text-slate-600"><input v-model="tampilSulung" type="checkbox" class="accent-brand-900" /> Gigi sulung</label>
        <select v-if="!kunjunganId && data?.kunjungans?.length" v-model="pilihanRiwayat" class="input w-auto py-1 text-xs" aria-label="Lihat status odontogram pada kunjungan">
          <option value="">Status terkini</option>
          <option v-for="k in data.kunjungans" :key="k.id" :value="String(k.id)">Pada {{ tanggal(k.tanggal) }} · {{ k.poli?.nama }}</option>
        </select>
      </div>
    </div>
    <div class="card-body space-y-4">
      <p v-if="kunjunganId && data && !bolehUbah && editable" class="text-xs text-slate-500">
        Odontogram bisa diisi setelah pasien dipanggil dan selama pemeriksaan belum ditutup.
      </p>
      <!-- contain:inline-size: lebar minimum gambar (640px) tidak melebarkan kolom grid induk; di layar sempit cukup digeser -->
      <div class="overflow-x-auto rounded-2xl border border-line bg-white/50 p-2 [contain:inline-size]">
        <OdontogramChart :kondisis="data?.kondisis ?? []" :peta="peta" :terpilih="terpilih" :tampil-sulung="tampilSulung" @pilih="pilih" />
      </div>

      <div v-if="legenda.length" class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
        <span v-for="l in legenda" :key="l.kode" class="flex items-center gap-1">
          <span class="size-3 rounded-sm" :style="{ background: l.warna }" /><b class="font-semibold">{{ l.kode }}</b> {{ l.label }}
        </span>
      </div>
      <p v-else-if="data" class="text-xs text-slate-400">Belum ada kondisi tercatat — seluruh gigi dianggap sehat (sou).</p>

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Gigi terpilih -->
        <section class="rounded-2xl border border-line bg-white/40 p-3">
          <template v-if="terpilih">
            <h3 class="text-sm font-semibold">Gigi {{ terpilih.gigi }} <span class="font-normal text-slate-500">· {{ namaGigi(terpilih.gigi) }}</span></h3>
            <ul class="mt-2 space-y-1.5 text-sm">
              <li v-for="k in kondisiGigi" :key="k.id" class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="size-2.5 shrink-0 rounded-sm" :style="{ background: peta[k.kondisi]?.warna }" />
                <span class="font-medium">{{ label(k) }}</span>
                <span class="text-xs text-slate-500">{{ tempat(k) }}</span>
                <span class="text-xs text-slate-400">· {{ dariKunjunganIni(k) ? 'kunjungan ini' : tanggal(k.kunjungan?.tanggal) }}</span>
                <span v-if="k.kunjungan_tindakan" class="text-xs text-slate-400">· hasil {{ k.kunjungan_tindakan.tindakan?.nama }}</span>
                <span v-if="k.keterangan" class="w-full pl-4 text-xs text-slate-500">{{ k.keterangan }}</span>
                <template v-if="bolehUbah && !k.kunjungan_tindakan_id">
                  <button v-if="dariKunjunganIni(k)" type="button" class="ml-auto text-xs text-rose-600 hover:underline" :disabled="menyimpan" @click="hapus(k)">Hapus</button>
                  <button v-else type="button" class="ml-auto text-xs text-slate-500 hover:text-slate-900 hover:underline" :disabled="menyimpan" @click="akhiri(k)">Akhiri</button>
                </template>
              </li>
              <li v-if="!kondisiGigi.length" class="text-xs text-slate-400">Tidak ada kondisi tercatat (sehat).</li>
            </ul>

            <form v-if="bolehUbah" class="mt-3 space-y-2 border-t border-line pt-3" @submit.prevent="catat">
              <label class="label" for="odo-kondisi">Catat kondisi</label>
              <select id="odo-kondisi" v-model="form.kondisi" class="input py-1.5 text-sm">
                <option value="">— Pilih kondisi —</option>
                <optgroup label="Per permukaan">
                  <option v-for="k in opsiPermukaan" :key="k.kode" :value="k.kode">{{ k.kode }} · {{ k.label }}</option>
                </optgroup>
                <optgroup label="Seluruh gigi">
                  <option v-for="k in opsiGigi" :key="k.kode" :value="k.kode">{{ k.kode }} · {{ k.label }}</option>
                </optgroup>
              </select>
              <div v-if="cakupanForm === 'permukaan'" class="flex flex-wrap gap-1.5" role="group" aria-label="Permukaan">
                <button
                  v-for="p in PERMUKAAN"
                  :key="p"
                  type="button"
                  :class="form.permukaan.includes(p) ? 'bg-brand-900 text-white' : 'bg-white/70 text-slate-600 hover:bg-white'"
                  class="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-line"
                  :aria-pressed="form.permukaan.includes(p)"
                  :title="labelPermukaan(terpilih.gigi, p)"
                  @click="togglePermukaan(p)"
                >
                  {{ p }} <span class="font-normal">{{ labelPermukaan(terpilih.gigi, p) }}</span>
                </button>
              </div>
              <input v-model="form.keterangan" class="input py-1.5 text-sm" maxlength="255" placeholder="Keterangan (opsional), mis. karies sekunder" />
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-primary btn-sm" :disabled="menyimpan"><AppSpinner v-if="menyimpan" size="size-3" />Catat</button>
                <button v-if="bisaTambahTindakan" type="button" class="btn btn-secondary btn-sm" @click="tambahTindakan">+ Tindakan untuk gigi ini</button>
              </div>
            </form>
          </template>
          <p v-else class="text-sm text-slate-500">Klik gigi (nomor) atau salah satu permukaannya untuk melihat{{ bolehUbah ? ' dan mencatat' : '' }} kondisinya.</p>
        </section>

        <!-- Perubahan di kunjungan ini, atau ringkasan semua kondisi -->
        <section v-if="perubahan" class="rounded-2xl border border-line bg-white/40 p-3 text-sm">
          <h3 class="text-sm font-semibold">Perubahan di kunjungan ini</h3>
          <ul class="mt-2 space-y-1">
            <li v-for="k in perubahan.dicatat" :key="`c${k.id}`" class="flex flex-wrap items-center gap-x-2">
              <span class="text-emerald-700">+</span><b class="tabular-nums">{{ k.gigi }}</b> {{ label(k) }}
              <span class="text-xs text-slate-500">{{ k.permukaan ? labelPermukaan(k.gigi, k.permukaan) : '' }}</span>
              <span v-if="k.kunjungan_tindakan" class="text-xs text-slate-400">· hasil {{ k.kunjungan_tindakan.tindakan?.nama }}</span>
              <span v-if="tergeser(k)" class="text-xs text-slate-400">· tergeser</span>
            </li>
            <li v-for="k in perubahan.diakhiri.filter((d) => !dariKunjunganIni(d))" :key="`a${k.id}`" class="flex flex-wrap items-center gap-x-2 text-slate-500">
              <span class="text-rose-600">−</span><b class="tabular-nums">{{ k.gigi }}</b> <s>{{ label(k) }}</s>
              <span class="text-xs">{{ k.permukaan ? labelPermukaan(k.gigi, k.permukaan) : '' }} · {{ k.berakhir_karena_id ? 'diganti' : 'diakhiri' }}</span>
              <button v-if="bolehUbah && !k.berakhir_karena_id" type="button" class="ml-auto text-xs hover:text-slate-900 hover:underline" :disabled="menyimpan" @click="pulihkan(k)">Pulihkan</button>
            </li>
            <li v-if="!perubahan.dicatat.length && !perubahan.diakhiri.length" class="text-xs text-slate-400">Belum ada perubahan.</li>
          </ul>
        </section>
        <section v-else-if="data" class="rounded-2xl border border-line bg-white/40 p-3 text-sm">
          <h3 class="text-sm font-semibold">Kondisi tercatat</h3>
          <ul class="mt-2 space-y-1">
            <li v-for="r in ringkasan" :key="r.gigi"><b class="tabular-nums">{{ r.gigi }}</b> {{ r.teks }}</li>
            <li v-if="!ringkasan.length" class="text-xs text-slate-400">Belum ada.</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
