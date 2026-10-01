<script setup>
/**
 * Form booking baru / reschedule (PRD BK-01, BK-02, BK-08).
 * Alur: pasien → treatment → petugas & tanggal → ruang/alat wajib → pilih slot kosong dari backend.
 * Panjang slot dihitung backend dari durasi + buffer treatment; klien hanya mengirim `mulai_at`.
 * Props `preset` ({ petugas_id, tanggal, jam, pasien }) mengisi awal form baru (klik kalender, detail pasien).
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet, getPolisAktif } from '@/lib/cache'
import { hariIni, isoTanggal, jenisKelamin } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  appointment: { type: Object, default: null },
  preset: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['saved'])
const toast = useToastStore()

const petugas = ref([])
const polis = ref([])
const sumberDayas = ref([])
const errors = ref({})
const saving = ref(false)

const form = reactive({
  pasien: null,
  tindakans: [],
  petugas_id: '',
  poli_id: '',
  tanggal: hariIni(),
  jam: '',
  pilihanRuang: {}, // key kebutuhan → sumber_daya_id
  tambahan_ids: [], // ruang/alat opsional di luar kebutuhan
  catatan: '',
})

const kebutuhan = ref([])
const kebutuhanLoading = ref(false)
const slot = ref(null) // { durasi_menit, jam_kerja, slot }
const slotLoading = ref(false)

const keyKebutuhan = (k) => `${k.tindakan_id}:${k.tipe}`
const sumberDayaIds = computed(() => [...new Set([...Object.values(form.pilihanRuang).filter(Boolean), ...form.tambahan_ids])])
const totalMenit = computed(() => form.tindakans.reduce((n, t) => n + (t.durasi_menit ?? 0) + (t.buffer_menit ?? 0), 0))
const opsiTambahan = computed(() => sumberDayas.value.filter((sd) => sd.is_active && !Object.values(form.pilihanRuang).includes(sd.id)))

async function muatReferensi() {
  const [p, pl, sd] = await Promise.all([cachedGet('/petugas'), getPolisAktif(), cachedGet('/sumber-dayas', { status: 'aktif', per_page: 100 })])
  petugas.value = p
  polis.value = pl
  sumberDayas.value = sd.data
}

watch(open, async (v) => {
  if (!v) return
  errors.value = {}
  slot.value = null
  kebutuhan.value = []
  try {
    await muatReferensi()
  } catch (e) {
    toast.error(errorMessage(e))
  }
  const a = props.appointment
  const mulai = a ? new Date(a.mulai_at) : null
  Object.assign(form, {
    pasien: a?.pasien ?? props.preset.pasien ?? null,
    tindakans: (a?.tindakans ?? []).map((t) => ({ id: t.tindakan_id, kode: t.tindakan?.kode, nama: t.tindakan?.nama, durasi_menit: t.durasi_menit, buffer_menit: t.buffer_menit })),
    petugas_id: a?.petugas_id ?? props.preset.petugas_id ?? '',
    poli_id: a?.poli_id ?? '',
    tanggal: mulai ? isoTanggal(mulai) : props.preset.tanggal ?? hariIni(),
    jam: mulai ? `${String(mulai.getHours()).padStart(2, '0')}:${String(mulai.getMinutes()).padStart(2, '0')}` : props.preset.jam ?? '',
    pilihanRuang: {},
    tambahan_ids: (a?.sumber_dayas ?? []).map((sd) => sd.id),
    catatan: a?.catatan ?? '',
  })
  if (!form.poli_id && form.petugas_id) form.poli_id = petugas.value.find((p) => p.id === Number(form.petugas_id))?.poli_id ?? ''
  await muatKebutuhan()
  muatSlot()
})

function tambahTindakan(t) {
  if (form.tindakans.some((x) => x.id === t.id)) return toast.info('Treatment sudah dipilih.')
  form.tindakans.push({ id: t.id, kode: t.kode, nama: t.nama, durasi_menit: t.durasi_menit, buffer_menit: t.buffer_menit })
  muatKebutuhan().then(muatSlot)
}

function hapusTindakan(i) {
  form.tindakans.splice(i, 1)
  muatKebutuhan().then(muatSlot)
}

/** Ruang/alat wajib dari katalog treatment. Pilihan lama (reschedule) dan pilihan tunggal diisi otomatis. */
async function muatKebutuhan() {
  if (!form.tindakans.length) {
    kebutuhan.value = []
    form.pilihanRuang = {}
    return
  }
  kebutuhanLoading.value = true
  try {
    const { data } = await api.get('/appointments-kebutuhan', { params: { tindakan_ids: form.tindakans.map((t) => t.id) }, silent: true })
    kebutuhan.value = data
    const pilihan = {}
    for (const k of data) {
      const ids = k.pilihan.map((p) => p.id)
      const lama = form.pilihanRuang[keyKebutuhan(k)] ?? form.tambahan_ids.find((id) => ids.includes(id))
      pilihan[keyKebutuhan(k)] = ids.includes(lama) ? lama : ids.length === 1 ? ids[0] : ''
    }
    form.pilihanRuang = pilihan
    // Ruang/alat yang sudah terpakai sebagai pilihan kebutuhan tidak dihitung dua kali sebagai tambahan
    form.tambahan_ids = form.tambahan_ids.filter((id) => !Object.values(pilihan).includes(id))
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    kebutuhanLoading.value = false
  }
}

let urutSlot = 0
async function muatSlot() {
  if (!form.petugas_id || !form.tindakans.length || !form.tanggal) {
    slot.value = null
    return
  }
  const urut = ++urutSlot
  slotLoading.value = true
  try {
    const { data } = await api.get('/appointments-slot', {
      params: {
        petugas_id: form.petugas_id,
        tanggal: form.tanggal,
        tindakan_ids: form.tindakans.map((t) => t.id),
        sumber_daya_ids: sumberDayaIds.value,
        kecuali_id: props.appointment?.id,
      },
      silent: true,
    })
    if (urut === urutSlot) slot.value = data
  } catch (e) {
    if (urut === urutSlot) slot.value = null
    toast.error(errorMessage(e))
  } finally {
    if (urut === urutSlot) slotLoading.value = false
  }
}

watch(() => form.petugas_id, (id) => {
  const p = petugas.value.find((x) => x.id === Number(id))
  if (p?.poli_id) form.poli_id = p.poli_id
})
watch(() => [form.petugas_id, form.tanggal, sumberDayaIds.value.join(',')], () => muatSlot())

const jamSlot = (s) => s.mulai.slice(11, 16)
const slotTerpilih = computed(() => slot.value?.slot?.some((s) => jamSlot(s) === form.jam))

async function simpan() {
  if (!form.pasien) return toast.error('Pilih pasien terlebih dahulu.')
  if (!form.jam) return toast.error('Pilih jam mulai.')
  saving.value = true
  errors.value = {}
  const payload = {
    pasien_id: form.pasien.id,
    poli_id: form.poli_id || null,
    petugas_id: form.petugas_id || null,
    mulai_at: `${form.tanggal} ${form.jam}:00`,
    tindakan_ids: form.tindakans.map((t) => t.id),
    sumber_daya_ids: sumberDayaIds.value,
    catatan: form.catatan || null,
  }
  try {
    const { data } = props.appointment
      ? await api.put(`/appointments/${props.appointment.id}`, payload)
      : await api.post('/appointments', payload)
    toast.success(props.appointment ? 'Booking diperbarui.' : `Booking ${data.no_booking} dibuat.`)
    open.value = false
    emit('saved', data)
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" :title="appointment ? `Ubah Booking ${appointment.no_booking}` : 'Booking Baru'" size="max-w-3xl">
    <form id="form-booking" class="space-y-5" @submit.prevent="simpan">
      <!-- Pasien -->
      <div>
        <label class="label">Pasien *</label>
        <div v-if="form.pasien" class="flex items-start justify-between gap-3 rounded-xl border border-brand-300/50 bg-brand-500/10 p-3 text-sm">
          <div>
            <p class="font-semibold">{{ form.pasien.nama }}</p>
            <p class="text-slate-600">RM {{ form.pasien.no_rm }}<template v-if="form.pasien.no_hp"> · {{ form.pasien.no_hp }}</template></p>
          </div>
          <button v-if="!appointment" type="button" class="btn btn-ghost btn-sm" @click="form.pasien = null">Ganti</button>
        </div>
        <AsyncSelect v-else endpoint="/pasiens" placeholder="Cari nama / No. RM / NIK / HP..." @select="(p) => (form.pasien = p)">
          <template #default="{ item }">
            <p class="font-medium">{{ item.nama }} <span class="tabular-nums text-xs text-slate-500">· {{ item.no_rm }}</span></p>
            <p class="text-xs text-slate-500">{{ jenisKelamin(item.jenis_kelamin) }}, {{ item.umur }} · {{ item.no_hp ?? '-' }}</p>
          </template>
        </AsyncSelect>
        <p v-if="errors.pasien_id" class="field-error">{{ errors.pasien_id }}</p>
      </div>

      <!-- Treatment -->
      <div>
        <label class="label">Treatment *</label>
        <AsyncSelect endpoint="/tindakans" :params="{ aktif: 1 }" placeholder="Cari treatment..." @select="tambahTindakan">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.durasi_menit }}{{ item.buffer_menit ? `+${item.buffer_menit}` : '' }} mnt</span></template>
        </AsyncSelect>
        <div v-if="form.tindakans.length" class="mt-2 flex flex-wrap gap-2">
          <span v-for="(t, i) in form.tindakans" :key="t.id" class="chip">
            {{ t.nama }} <span class="text-xs text-slate-500">{{ t.durasi_menit }}{{ t.buffer_menit ? `+${t.buffer_menit}` : '' }} mnt</span>
            <button type="button" class="ml-1 text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${t.nama}`" @click="hapusTindakan(i)">&times;</button>
          </span>
          <span class="self-center text-xs text-slate-500">Total slot <b class="text-slate-700">{{ totalMenit }} menit</b></span>
        </div>
        <p v-if="errors.tindakan_ids" class="field-error">{{ errors.tindakan_ids }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="label" for="bk-petugas">Dokter / terapis</label>
          <select id="bk-petugas" v-model="form.petugas_id" class="input" :class="{ 'input-error': errors.petugas_id }">
            <option value="">— Belum ditentukan —</option>
            <option v-for="p in petugas" :key="p.id" :value="p.id">{{ p.name }}{{ p.peran ? ` · ${p.peran}` : '' }}</option>
          </select>
          <p v-if="errors.petugas_id" class="field-error">{{ errors.petugas_id }}</p>
        </div>
        <div>
          <label class="label" for="bk-poli">Poli</label>
          <select id="bk-poli" v-model="form.poli_id" class="input" :class="{ 'input-error': errors.poli_id }">
            <option value="">— Pilih saat check-in —</option>
            <option v-for="p in polis" :key="p.id" :value="p.id">{{ p.nama }}</option>
          </select>
          <p v-if="errors.poli_id" class="field-error">{{ errors.poli_id }}</p>
        </div>
        <div>
          <label class="label" for="bk-tanggal">Tanggal *</label>
          <input id="bk-tanggal" v-model="form.tanggal" type="date" class="input" required />
        </div>
      </div>

      <!-- Ruang & alat (BK-08) -->
      <div v-if="kebutuhan.length || sumberDayas.length" class="space-y-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-800">Ruang & alat</h3>
          <AppSpinner v-if="kebutuhanLoading" size="size-3" class="text-slate-400" />
        </div>
        <div v-for="k in kebutuhan" :key="`${k.tindakan_id}:${k.tipe}`">
          <p class="mb-1 text-xs text-slate-600">{{ k.tindakan }} butuh <b>{{ k.tipe_label.toLowerCase() }}</b> *</p>
          <div v-if="k.pilihan.length" class="flex flex-wrap gap-2">
            <label v-for="p in k.pilihan" :key="p.id" class="choice cursor-pointer px-3 py-1.5 text-sm" :class="{ 'choice-active': form.pilihanRuang[`${k.tindakan_id}:${k.tipe}`] === p.id }">
              <input v-model="form.pilihanRuang[`${k.tindakan_id}:${k.tipe}`]" type="radio" class="sr-only" :value="p.id" />{{ p.nama }}
            </label>
          </div>
          <p v-else class="text-xs text-rose-600">Tidak ada {{ k.tipe_label.toLowerCase() }} aktif yang cocok di cabang ini.</p>
        </div>
        <div v-if="opsiTambahan.length">
          <p class="mb-1 text-xs text-slate-600">{{ kebutuhan.length ? 'Ruang/alat lain (opsional)' : 'Pesan ruang/alat (opsional)' }}</p>
          <div class="flex flex-wrap gap-2">
            <label v-for="sd in opsiTambahan" :key="sd.id" class="choice cursor-pointer px-3 py-1.5 text-sm" :class="{ 'choice-active': form.tambahan_ids.includes(sd.id) }">
              <input v-model="form.tambahan_ids" type="checkbox" class="sr-only" :value="sd.id" />
              <span class="text-xs text-slate-400">{{ sd.tipe === 'alat' ? 'Alat' : 'Ruang' }}</span> {{ sd.nama }}
            </label>
          </div>
        </div>
        <p v-if="errors.sumber_daya_ids" class="field-error">{{ errors.sumber_daya_ids }}</p>
      </div>

      <!-- Slot -->
      <div>
        <div class="mb-1 flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-800">Jam mulai *</h3>
          <AppSpinner v-if="slotLoading" size="size-3" class="text-slate-400" />
        </div>
        <template v-if="form.petugas_id && form.tindakans.length">
          <p v-if="slot && !slot.jam_kerja.length" class="text-xs text-rose-600">Petugas tidak punya jadwal praktik (atau sedang cuti) pada tanggal ini.</p>
          <p v-else-if="slot && !slot.slot.length" class="text-xs text-rose-600">Tidak ada slot kosong {{ slot.durasi_menit }} menit pada tanggal ini.</p>
          <template v-else-if="slot">
            <p class="mb-2 text-xs text-slate-500">
              Jam praktik: {{ slot.jam_kerja.map((r) => `${r.mulai.slice(11, 16)}–${r.selesai.slice(11, 16)}`).join(', ') }}
            </p>
            <div class="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              <button
                v-for="s in slot.slot"
                :key="s.mulai"
                type="button"
                class="choice px-2.5 py-1 text-sm tabular-nums"
                :class="{ 'choice-active': form.jam === jamSlot(s) }"
                @click="form.jam = jamSlot(s)"
              >
                {{ jamSlot(s) }}
              </button>
            </div>
          </template>
          <p v-if="form.jam && slot?.slot?.length && !slotTerpilih" class="mt-2 text-xs text-amber-700">Jam {{ form.jam }} di luar slot kosong — kemungkinan bentrok dan ditolak.</p>
        </template>
        <div v-else class="flex items-center gap-3">
          <input v-model="form.jam" type="time" step="900" class="input w-36" aria-label="Jam mulai" />
          <p class="text-xs text-slate-500">Pilih petugas & treatment untuk melihat slot kosong.</p>
        </div>
        <p v-if="errors.mulai_at" class="field-error">{{ errors.mulai_at }}</p>
      </div>

      <div>
        <label class="label" for="bk-catatan">Catatan</label>
        <textarea id="bk-catatan" v-model="form.catatan" rows="2" class="input" placeholder="mis. keluhan, permintaan khusus — menjadi keluhan saat check-in" />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-booking" class="btn btn-primary" :disabled="saving">
        <AppSpinner v-if="saving" />{{ appointment ? 'Simpan perubahan' : 'Buat booking' }}
      </button>
    </template>
  </AppModal>
</template>
