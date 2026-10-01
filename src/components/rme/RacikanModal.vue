<script setup>
/**
 * Susun / ubah resep racikan (PRD FR-01): nama, bentuk, isi (untuk etiket), banyaknya racikan, aturan pakai, dan komponen obat
 * per SATU racikan (jumlah dalam satuan stok, boleh desimal untuk obat fraksional). Harga final dihitung backend
 * (Σ komponen × harga + biaya racik dari pengaturan); di sini hanya estimasi komponen.
 */
import { computed, reactive, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import { angka, rupiah } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  racikan: { type: Object, default: null },
  errors: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['saved'])
const toast = useToastStore()

const BENTUK = { krim: 'Krim', salep: 'Salep', gel: 'Gel', losion: 'Losion', kapsul: 'Kapsul', puyer: 'Puyer', sirup: 'Sirup', lainnya: 'Lainnya' }
const SATUAN = ['g', 'ml', 'kapsul', 'bungkus', 'pot', 'botol']

const form = reactive({ nama_racikan: '', bentuk: 'krim', jumlah_racikan: '', satuan_racikan: 'g', jumlah: 1, aturan_pakai: 'Oleskan 2 x sehari', komponen: [] })

watch(open, (v) => {
  if (!v) return
  const r = props.racikan
  Object.assign(form, {
    nama_racikan: r?.nama_racikan ?? '',
    bentuk: r?.bentuk ?? 'krim',
    jumlah_racikan: r?.jumlah_racikan ?? '',
    satuan_racikan: r?.satuan_racikan ?? 'g',
    jumlah: r?.jumlah ?? 1,
    aturan_pakai: r?.aturan_pakai ?? 'Oleskan 2 x sehari',
    komponen: (r?.komponen ?? []).map((k) => ({ ...k })),
  })
})

const estimasi = computed(() => form.komponen.reduce((n, k) => n + Math.ceil((Number(k.jumlah) || 0) * k.harga), 0))

function tambahKomponen(o) {
  if (form.komponen.some((k) => k.obat_id === o.id)) return toast.info('Obat sudah menjadi komponen.')
  form.komponen.push({ obat_id: o.id, nama: o.nama, satuan: o.satuan, harga: o.harga, stok: o.stok, fraksional: o.fraksional, jumlah: o.fraksional ? 0.5 : 1 })
}

function simpan() {
  if (!form.nama_racikan.trim()) return toast.error('Isi nama racikan.')
  if (!form.komponen.length) return toast.error('Tambahkan minimal satu komponen obat.')
  emit('saved', {
    ...form,
    racikan: true,
    jumlah_racikan: form.jumlah_racikan === '' ? null : Number(form.jumlah_racikan),
    komponen: form.komponen.map((k) => ({ ...k, jumlah: Number(k.jumlah) })),
    harga: estimasi.value,
  })
  open.value = false
}
</script>

<template>
  <AppModal v-model="open" :title="racikan ? 'Ubah Racikan' : 'Resep Racikan'" size="max-w-2xl">
    <form id="form-racikan" class="space-y-4" @submit.prevent="simpan">
      <div class="grid gap-4 sm:grid-cols-6">
        <div class="sm:col-span-4">
          <label class="label" for="rk-nama">Nama racikan *</label>
          <input id="rk-nama" v-model="form.nama_racikan" class="input" maxlength="150" placeholder="mis. Krim malam melasma" required />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="rk-bentuk">Bentuk *</label>
          <select id="rk-bentuk" v-model="form.bentuk" class="input">
            <option v-for="(l, v) in BENTUK" :key="v" :value="v">{{ l }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="rk-isi">Isi per racikan</label>
          <div class="flex gap-2">
            <input id="rk-isi" v-model="form.jumlah_racikan" type="number" min="0" step="any" class="input" placeholder="30" />
            <select v-model="form.satuan_racikan" class="input w-28" aria-label="Satuan isi">
              <option v-for="s in SATUAN" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <div class="sm:col-span-1">
          <label class="label" for="rk-jumlah">Banyaknya *</label>
          <input id="rk-jumlah" v-model.number="form.jumlah" type="number" min="1" class="input" required />
        </div>
        <div class="sm:col-span-3">
          <label class="label" for="rk-aturan">Aturan pakai *</label>
          <input id="rk-aturan" v-model="form.aturan_pakai" class="input" maxlength="255" required />
        </div>
      </div>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-slate-800">Komponen per satu racikan</h3>
        <AsyncSelect endpoint="/obats" :params="{ aktif: 1 }" placeholder="Cari obat / bahan komponen..." @select="tambahKomponen">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">· {{ item.satuan }} · stok {{ angka(item.stok) }}</span></template>
        </AsyncSelect>
        <div v-if="form.komponen.length" class="overflow-x-auto rounded-xl border border-line bg-white/30">
          <table class="table">
            <thead><tr><th>Komponen</th><th class="w-32">Jumlah</th><th>Satuan</th><th class="text-right">Estimasi</th><th class="w-8" /></tr></thead>
            <tbody>
              <tr v-for="(k, i) in form.komponen" :key="k.obat_id">
                <td>
                  {{ k.nama }}
                  <p v-if="errors[`komponen.${i}.jumlah`] || errors[`komponen.${i}.obat_id`]" class="field-error">{{ errors[`komponen.${i}.jumlah`] || errors[`komponen.${i}.obat_id`] }}</p>
                </td>
                <td><input v-model="k.jumlah" type="number" min="0" step="any" class="input py-1" :aria-label="`Jumlah ${k.nama}`" required /></td>
                <td class="text-slate-600">{{ k.satuan }}</td>
                <td class="text-right tabular-nums text-slate-600">{{ rupiah(Math.ceil((Number(k.jumlah) || 0) * k.harga)) }}</td>
                <td><button type="button" class="text-slate-400 hover:text-rose-600" :aria-label="`Hapus ${k.nama}`" @click="form.komponen.splice(i, 1)">&times;</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-500">
          Estimasi komponen per racikan {{ rupiah(estimasi) }} × {{ form.jumlah }} — belum termasuk biaya racik. Stok komponen dipotong saat obat diserahkan farmasi.
        </p>
      </section>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button type="submit" form="form-racikan" class="btn btn-primary">{{ racikan ? 'Simpan perubahan' : 'Tambahkan ke resep' }}</button>
    </template>
  </AppModal>
</template>
