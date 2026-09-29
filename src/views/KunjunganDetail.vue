<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import RekamMedisRingkas from '@/components/RekamMedisRingkas.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage } from '@/lib/api'
import { PENJAMIN, jenisKelamin, rupiah, tanggal, waktu } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const k = ref(null)

onMounted(async () => {
  try {
    k.value = (await api.get(`/kunjungans/${route.params.id}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
})
</script>

<template>
  <template v-if="k">
    <PageHeader :title="`Kunjungan ${k.no_registrasi}`" :subtitle="`${k.poli.nama} · ${tanggal(k.tanggal)}`">
      <button class="btn btn-secondary" @click="router.back()">Kembali</button>
    </PageHeader>

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="card self-start">
        <div class="card-header"><h2 class="card-title">Pasien</h2><StatusBadge :status="k.status" /></div>
        <dl class="card-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-slate-500">Nama</dt><dd class="font-medium">{{ k.pasien.nama }}</dd>
          <dt class="text-slate-500">No. RM</dt><dd class="font-mono">{{ k.pasien.no_rm }}</dd>
          <dt class="text-slate-500">JK / Umur</dt><dd>{{ jenisKelamin(k.pasien.jenis_kelamin) }} · {{ k.pasien.umur }}</dd>
          <dt class="text-slate-500">Penjamin</dt><dd>{{ PENJAMIN[k.penjamin] }} {{ k.no_penjamin ?? '' }}</dd>
          <dt class="text-slate-500">Dokter</dt><dd>{{ k.dokter?.name ?? '-' }}</dd>
          <dt class="text-slate-500">Keluhan</dt><dd>{{ k.keluhan ?? '-' }}</dd>
          <dt class="text-slate-500">Dipanggil</dt><dd>{{ waktu(k.dipanggil_at) }}</dd>
          <dt class="text-slate-500">Selesai</dt><dd>{{ waktu(k.selesai_at) }}</dd>
          <template v-if="k.tagihan">
            <dt class="text-slate-500">Tagihan</dt>
            <dd>{{ rupiah(k.tagihan.grand_total) }} <StatusBadge :status="k.tagihan.status" /></dd>
          </template>
        </dl>
      </div>
      <div class="card lg:col-span-2">
        <div class="card-header"><h2 class="card-title">Rekam Medis</h2></div>
        <div class="card-body"><RekamMedisRingkas :kunjungan="k" /></div>
      </div>
    </div>
  </template>
</template>
