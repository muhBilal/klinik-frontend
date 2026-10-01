<script setup>
/**
 * Susun / ubah rencana perawatan gigi (PRD DG-02): item per gigi (+ permukaan) dikelompokkan per fase, estimasi biaya dari
 * harga cabang. Item yang sudah dikerjakan (selesai) terkunci. Backend menghitung ulang estimasi & menolak perubahan
 * rencana yang sudah disetujui (harus revisi).
 */
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import PilihGigi from '@/components/gigi/PilihGigi.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { rupiah } from '@/lib/format'
import { FASE_RENCANA, labelFase } from '@/lib/gigi'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  pasien: { type: Object, required: true },
  /** Rencana yang diubah; null = rencana baru */
  rencana: { type: Object, default: null },
  /** Kunjungan tempat rencana disusun (baru) — menentukan cabang & harga estimasi */
  kunjungan: { type: Object, default: null },
  /** Gigi awal untuk item pertama (dari gigi terpilih di odontogram) */
  gigiAwal: { type: Object, default: null },
})
const emit = defineEmits(['saved'])
const auth = useAuthStore()
const toast = useToastStore()

const form = reactive({ judul: '', catatan: '', items: [] })
const errors = ref({})
const saving = ref(false)
const cabangId = computed(() => props.rencana?.cabang_id ?? props.kunjungan?.cabang_id ?? auth.cabang?.id)

watch(open, (v) => {
  if (!v) return
  errors.value = {}
  const r = props.rencana
  form.judul = r?.judul ?? 'Rencana perawatan gigi'
  form.catatan = r?.catatan ?? ''
  form.items = (r?.items ?? []).map((i) => ({
    id: i.id, fase: i.fase, gigi: i.gigi, permukaan: i.permukaan ?? '', tindakan_id: i.tindakan_id, nama: i.tindakan?.nama,
    per_gigi: i.tindakan?.per_gigi, tarif: i.tarif, jumlah: i.jumlah, keterangan: i.keterangan ?? '', status: i.status,
  }))
})

function tambah(t) {
  const fase = form.items.at(-1)?.fase ?? 1
  form.items.push({
    fase, gigi: t.per_gigi ? props.gigiAwal?.gigi ?? null : null, permukaan: t.per_gigi ? props.gigiAwal?.permukaan ?? '' : '',
    tindakan_id: t.id, nama: t.nama, per_gigi: t.per_gigi, tarif: t.tarif_cabang, jumlah: 1, keterangan: '', status: 'rencana',
  })
}

const terkunci = (item) => item.status === 'selesai'

const perFase = computed(() => {
  const peta = new Map()
  for (const i of form.items) if (i.status !== 'batal') peta.set(i.fase, (peta.get(i.fase) ?? 0) + i.tarif * i.jumlah)
  return [...peta].sort(([a], [b]) => a - b)
})
const total = computed(() => perFase.value.reduce((s, [, n]) => s + n, 0))

function urutkan() {
  form.items.sort((a, b) => a.fase - b.fase)
}

async function simpan() {
  if (!form.items.length) return toast.error('Tambahkan minimal satu tindakan ke rencana.')
  urutkan()
  saving.value = true
  errors.value = {}
  const payload = {
    judul: form.judul,
    catatan: form.catatan || null,
    items: form.items.map(({ id, fase, gigi, permukaan, tindakan_id, jumlah, keterangan }) => ({
      id: id ?? null, fase, gigi: gigi || null, permukaan: gigi && permukaan ? permukaan : null, tindakan_id, jumlah, keterangan: keterangan || null,
    })),
  }
  try {
    const { data } = props.rencana
      ? await api.put(`/rencana-perawatans/${props.rencana.id}`, payload)
      : await api.post(`/pasiens/${props.pasien.id}/rencana-perawatans`, { ...payload, kunjungan_id: props.kunjungan?.id ?? null })
    toast.success('Rencana perawatan tersimpan.')
    emit('saved', data)
    open.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" :title="rencana ? 'Ubah Rencana Perawatan' : 'Rencana Perawatan Baru'" size="max-w-4xl">
    <form id="form-rencana" class="space-y-4" @submit.prevent="simpan">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="rp-judul">Judul *</label>
          <input id="rp-judul" v-model="form.judul" class="input" :class="{ 'input-error': errors.judul }" maxlength="150" required />
        </div>
        <div>
          <label class="label" for="rp-catatan">Catatan</label>
          <input id="rp-catatan" v-model="form.catatan" class="input" maxlength="2000" placeholder="Mis. prioritas keluhan, kondisi sistemik" />
        </div>
      </div>

      <div>
        <p class="label">Tambah tindakan</p>
        <AsyncSelect endpoint="/tindakans" :params="{ aktif: 1, cabang_id: cabangId }" placeholder="Cari treatment (tambal, PSA, crown, scaling...)" @select="tambah">
          <template #default="{ item }">
            {{ item.nama }} <span class="text-xs text-slate-500">· {{ rupiah(item.tarif_cabang) }}<template v-if="item.per_gigi"> · per gigi</template></span>
          </template>
        </AsyncSelect>
        <p v-if="errors.items" class="field-error">{{ errors.items }}</p>
      </div>

      <div v-if="form.items.length" class="space-y-2">
        <div v-for="(item, i) in form.items" :key="item.id ?? `baru-${i}`" class="rounded-2xl border border-line bg-white/40 p-3" :class="{ 'opacity-60': terkunci(item) }">
          <div class="flex flex-wrap items-start gap-2">
            <div class="w-28">
              <label class="sr-only" :for="`rp-fase-${i}`">Fase {{ item.nama }}</label>
              <select :id="`rp-fase-${i}`" v-model.number="item.fase" class="input py-1 text-sm" :disabled="terkunci(item)" :title="FASE_RENCANA[item.fase]">
                <option v-for="f in 9" :key="f" :value="f">Fase {{ f }}</option>
              </select>
            </div>
            <div class="min-w-40 flex-1">
              <p class="text-sm font-medium">{{ item.nama }} <span v-if="terkunci(item)" class="text-xs font-normal text-emerald-700">· sudah dikerjakan</span></p>
              <p v-if="errors[`items.${i}.tindakan_id`]" class="field-error">{{ errors[`items.${i}.tindakan_id`] }}</p>
              <input v-model="item.keterangan" class="input mt-1 py-1 text-xs" maxlength="255" placeholder="Keterangan (opsional)" :disabled="terkunci(item)" :aria-label="`Keterangan ${item.nama}`" />
            </div>
            <div>
              <PilihGigi v-model:gigi="item.gigi" v-model:permukaan="item.permukaan" :disabled="terkunci(item)" :invalid="!!errors[`items.${i}.gigi`]" />
              <p v-if="errors[`items.${i}.gigi`]" class="field-error">{{ errors[`items.${i}.gigi`] }}</p>
            </div>
            <div class="w-16">
              <label class="sr-only" :for="`rp-jumlah-${i}`">Jumlah {{ item.nama }}</label>
              <input :id="`rp-jumlah-${i}`" v-model.number="item.jumlah" type="number" min="1" max="100" class="input py-1 text-sm" :disabled="terkunci(item)" />
            </div>
            <p class="w-28 pt-1.5 text-right text-sm tabular-nums">{{ rupiah(item.tarif * item.jumlah) }}</p>
            <button v-if="!terkunci(item)" type="button" class="pt-1 text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${item.nama}`" @click="form.items.splice(i, 1)">&times;</button>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-slate-400">Belum ada item. Cari treatment di atas; nomor gigi diisi per item.</p>

      <div v-if="form.items.length" class="rounded-2xl bg-slate-900/5 px-4 py-3 text-sm">
        <div v-for="[fase, n] in perFase" :key="fase" class="flex justify-between gap-4">
          <span class="text-slate-600">{{ labelFase(fase) }}</span><span class="tabular-nums">{{ rupiah(n) }}</span>
        </div>
        <div class="mt-1 flex justify-between border-t border-line pt-1 font-semibold">
          <span>Estimasi total</span><span class="tabular-nums">{{ rupiah(total) }}</span>
        </div>
        <p class="mt-1 text-xs text-slate-500">Estimasi dari harga cabang saat ini; tagihan memakai harga saat tindakan dikerjakan.</p>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="open = false">Batal</button>
      <button form="form-rencana" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />Simpan rencana</button>
    </template>
  </AppModal>
</template>
