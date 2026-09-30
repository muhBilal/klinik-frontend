<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LampiranBerkas from '@/components/LampiranBerkas.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import RekamMedisRingkas from '@/components/RekamMedisRingkas.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDetail } from '@/composables/useDetail'
import { PENJAMIN, jenisKelamin, rupiah, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { data: k, error, load } = useDetail(() => `/kunjungans/${route.params.id}`)

onMounted(load)
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
          <dt class="text-slate-500">No. RM</dt><dd class="tabular-nums">{{ k.pasien.no_rm }}</dd>
          <dt class="text-slate-500">JK / Umur</dt><dd>{{ jenisKelamin(k.pasien.jenis_kelamin) }} · {{ k.pasien.umur }}</dd>
          <dt class="text-slate-500">Cabang</dt><dd>{{ k.cabang?.nama ?? '-' }}</dd>
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
      <div v-if="auth.can('rme.lihat')" class="space-y-5 lg:col-span-2">
        <div class="card">
          <div class="card-header"><h2 class="card-title">Rekam Medis</h2></div>
          <div class="card-body"><RekamMedisRingkas :kunjungan="k" /></div>
        </div>
        <LampiranBerkas :pasien-id="k.pasien_id" :kunjungan-id="k.id" readonly />
      </div>
      <div v-else class="card self-start lg:col-span-2">
        <div class="card-body text-sm text-slate-500">Isi rekam medis hanya dapat dilihat tenaga medis (izin <code>rme.lihat</code>).</div>
      </div>
    </div>
  </template>
  <PageLoading v-else :error="error" text="Memuat rekam medis..." @retry="load" />
</template>
