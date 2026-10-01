<script setup>
/**
 * Ilustrasi garis kompleks klinik (gedung klinik bertanda silang, menara, apotek, pepohonan) untuk panel kanan
 * halaman login. Gaya line-art berisi pastel; warna garis & isian biru mengikuti tema brand (`--color-brand-*`),
 * pastel lain tetap. Dirancang menempel di sudut kanan bawah panel (bagian bawah & kanan sengaja terpotong).
 */
// Isian bidang (kelas Tailwind; dark: = mode gelap)
const isi = {
  putih: 'fill-white dark:fill-slate-800',
  biru: 'fill-brand-100 dark:fill-brand-900/30',
  silang: 'fill-brand-400 dark:fill-brand-500',
  persik: 'fill-[#f7d8ce] dark:fill-[#4a302c]',
  mentega: 'fill-[#f6e6bd] dark:fill-[#433a22]',
  mint: 'fill-[#d2eadf] dark:fill-[#1d3a31]',
}

const rentang = (dari, sampai, langkah) => Array.from({ length: Math.floor((sampai - dari) / langkah) + 1 }, (_, i) => dari + i * langkah)

// Jendela menara kiri & gedung klinik (kolom x × baris y)
const jendelaMenara = rentang(136, 316, 30).flatMap((y) => [80, 106, 132].map((x) => ({ x, y })))
const jendelaKlinik = [214, 260, 306].flatMap((y) => [188, 222, 332, 366].map((x) => ({ x, y })))
// Arsir diagonal sisi samping menara
const arsirKiri = rentang(160, 350, 20)
const arsirKanan = rentang(108, 350, 18)
// Lekuk bawah tenda apotek
const tenda = `M492 290${' a7 7 0 0 0 14 0'.repeat(8)}`
</script>

<template>
  <svg
    viewBox="0 0 560 360"
    fill="none"
    stroke="currentColor"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="text-[color-mix(in_oklab,var(--color-brand-950)_40%,#1e293b)] dark:text-slate-500"
    aria-hidden="true"
  >
    <!-- Gedung samar paling kiri -->
    <g opacity="0.5">
      <rect x="-6" y="230" width="60" height="140" :class="isi.biru" />
      <line v-for="y in [264, 290, 316, 342, 368]" :key="y" x1="2" :y1="y" x2="30" :y2="y - 18" stroke-width="3" />
    </g>

    <!-- Menara kanan (kuning, jendela garis putus) -->
    <polygon points="466,66 490,82 490,370 466,370" :class="isi.putih" />
    <line v-for="y in arsirKanan" :key="`ka${y}`" x1="470" :y1="y" x2="486" :y2="y - 10" stroke-width="3" />
    <rect x="404" y="66" width="62" height="304" :class="isi.mentega" />
    <rect x="398" y="56" width="74" height="10" rx="3" :class="isi.putih" />
    <line v-for="x in [420, 435, 450]" :key="`tp${x}`" :x1="x" :x2="x" y1="84" y2="350" stroke-width="3" stroke-dasharray="12 9" />

    <!-- Menara kiri (putih, sisi samping biru berarsir) -->
    <polygon points="36,138 66,118 66,370 36,370" :class="isi.biru" />
    <line v-for="y in arsirKiri" :key="`ki${y}`" x1="40" :y1="y" x2="62" :y2="y - 14" stroke-width="3" />
    <rect x="66" y="118" width="96" height="252" :class="isi.putih" />
    <rect x="60" y="106" width="108" height="12" rx="3" :class="isi.biru" />
    <rect v-for="j in jendelaMenara" :key="`jm${j.x}-${j.y}`" :x="j.x" :y="j.y" width="18" height="16" rx="3" stroke-width="3" :class="isi.biru" />

    <!-- Gedung klinik utama -->
    <rect x="172" y="196" width="236" height="174" :class="isi.putih" />
    <rect x="164" y="182" width="252" height="14" rx="3" :class="isi.biru" />
    <!-- Papan tanda silang di atap -->
    <line x1="276" y1="170" x2="276" y2="182" />
    <line x1="304" y1="170" x2="304" y2="182" />
    <rect x="254" y="112" width="72" height="58" rx="10" :class="isi.putih" />
    <path d="M283 122h14v12h12v14h-12v12h-14v-12h-12v-14h12z" :class="isi.silang" />
    <!-- Jendela -->
    <g v-for="j in jendelaKlinik" :key="`jk${j.x}-${j.y}`">
      <rect :x="j.x" :y="j.y" width="26" height="30" rx="3" :class="isi.biru" />
      <line :x1="j.x + 13" :x2="j.x + 13" :y1="j.y" :y2="j.y + 30" stroke-width="3" />
    </g>
    <!-- Panel detak jantung di atas pintu -->
    <rect x="256" y="214" width="68" height="36" rx="8" :class="isi.mint" />
    <polyline points="264,232 277,232 283,222 291,243 297,227 302,232 316,232" stroke-width="3" />
    <!-- Kanopi & pintu kaca -->
    <rect x="262" y="280" width="56" height="90" :class="isi.biru" />
    <line x1="290" y1="280" x2="290" y2="370" stroke-width="3" />
    <line x1="283" y1="320" x2="283" y2="334" stroke-width="3" />
    <line x1="297" y1="320" x2="297" y2="334" stroke-width="3" />
    <rect x="246" y="268" width="88" height="12" rx="3" :class="isi.mint" />

    <!-- Apotek (kanan, persik) dengan tenda & papan kapsul -->
    <rect x="498" y="244" width="90" height="126" :class="isi.persik" />
    <rect x="492" y="232" width="102" height="12" rx="3" :class="isi.putih" />
    <g transform="rotate(-30 532 260)">
      <rect x="514" y="253" width="36" height="14" rx="7" :class="isi.putih" />
      <path d="M532 253h-11a7 7 0 0 0 0 14h11z" stroke-width="3" :class="isi.silang" />
    </g>
    <path :d="`${tenda}V276H492z`" :class="isi.putih" />
    <line v-for="x in [506, 520, 534, 548]" :key="`td${x}`" :x1="x" :x2="x" y1="276" y2="290" stroke-width="3" />
    <rect x="512" y="310" width="30" height="60" :class="isi.putih" />
    <rect x="552" y="312" width="30" height="26" rx="3" :class="isi.putih" />

    <!-- Pepohonan & semak -->
    <circle cx="112" cy="322" r="22" :class="isi.putih" />
    <path d="M112 370v-42m0 14-10-10m10 4 9-9" stroke-width="3" />
    <circle cx="150" cy="300" r="30" :class="isi.mint" />
    <path d="M150 370v-64m0 24-14-14m14 2 12-12" />
    <circle cx="462" cy="314" r="26" :class="isi.mint" />
    <path d="M462 370v-50m0 22-12-12m12 2 10-10" />
    <path d="M222 370a15 15 0 0 1 30 0" :class="isi.mint" />
    <path d="M328 370a15 15 0 0 1 30 0" :class="isi.mint" />

    <!-- Kilau tanda tambah -->
    <path d="M214 84v20m-10-10h20M372 120v14m-7-7h14M130 60v12m-6-6h12" stroke-width="3" />
  </svg>
</template>
