<script setup>
/** Slip komisi milik sendiri dari rekap yang sudah disetujui (PRD KM-03), lintas cabang. */
import { nextTick, onMounted, ref } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import SlipKomisi from '@/components/komisi/SlipKomisi.vue'
import api, { errorMessage } from '@/lib/api'
import { rupiah, tanggal } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const periodes = ref([])
const memuat = ref(true)
const slip = ref(null)
const memuatSlip = ref(null)

async function muat() {
  memuat.value = true
  try {
    periodes.value = (await api.get('/komisi-saya')).data
    if (periodes.value.length) await buka(periodes.value[0])
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memuat.value = false
  }
}

async function buka(p) {
  memuatSlip.value = p.id
  try {
    slip.value = (await api.get('/komisi-saya', { params: { periode_id: p.id } })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memuatSlip.value = null
  }
}

async function cetak() {
  await nextTick()
  printElement('#slip-komisi', `Slip komisi ${slip.value.nama}`)
}

onMounted(muat)
</script>

<template>
  <PageHeader title="Komisi Saya" subtitle="Slip komisi & jasa medis dari rekap yang sudah disetujui manajemen">
    <button v-if="slip" class="btn btn-primary" @click="cetak">Cetak slip</button>
  </PageHeader>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_1fr]">
    <div class="card self-start">
      <div class="card-header"><h2 class="card-title">Periode</h2><AppSpinner v-if="memuat" class="text-slate-400" /></div>
      <ul class="divide-y divide-line">
        <li v-for="p in periodes" :key="p.id">
          <button type="button" class="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm hover:bg-white/50" :class="{ 'bg-white/60': slip?.id === p.id }" @click="buka(p)">
            <span>
              <span class="block font-medium">{{ p.nama }}</span>
              <span class="text-xs text-slate-500">{{ tanggal(p.mulai) }} – {{ tanggal(p.selesai) }} · {{ p.cabang?.nama }}</span>
            </span>
            <span class="tabular-nums font-semibold"><AppSpinner v-if="memuatSlip === p.id" size="size-3" />{{ rupiah(p.total_saya) }}</span>
          </button>
        </li>
        <li v-if="!memuat && !periodes.length" class="px-5 py-6 text-sm text-slate-400">Belum ada rekap komisi yang disetujui untuk Anda.</li>
      </ul>
    </div>
    <div class="card card-body">
      <SlipKomisi v-if="slip" :periode="slip" :petugas="slip.user" :barises="slip.barises" />
      <p v-else class="text-sm text-slate-400">Pilih periode untuk melihat slip.</p>
    </div>
  </div>
</template>
