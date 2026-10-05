<script setup>
/**
 * Logo Vertiqo (jaringan simpul + panah naik + centang oranye, latar transparan). Sumber tunggal: `public/favicon.svg` —
 * ganti file itu untuk mengganti logo di seluruh aplikasi (favicon, header, login, drawer). Ikon PNG/ICO dibuat dari file
 * yang sama (lihat `frontend/AI-Context/04-conventions.md` bagian Logo).
 */
defineProps({
  /** Teks alternatif; kosong = dekoratif (nama klinik/produk sudah tertulis di sebelahnya). */
  alt: { type: String, default: '' },
})

const src = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<template>
  <img :src="src" :alt="alt" :aria-hidden="alt ? undefined : 'true'" class="select-none" draggable="false" />
</template>
