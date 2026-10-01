# 07 — Navigasi: Rail Modul + Navbar Halaman

Navigasi dua tingkat (sejak 30 Sep 2026). Rail kiri tetap bergaya lama (pil kaca mengambang di tengah vertikal, logo di header),
tetapi **satu tombol = satu modul**; navbar berisi **halaman milik modul yang dipilih**.

```
 [K] lefaklinik           Resep  [Obat & Stok]              Cari…  Admin (A) ⏻     ← header: logo · tab halaman modul · alat
 ╭──╮
 │⌂ │  Beranda
 │♙ │  Pendaftaran            <RouterView />
 │♡ │  Pelayanan
 │⚗●│  Farmasi   ← modul terpilih (tombol biru); nama modul muncul sebagai tooltip saat hover
 │▭ │  Keuangan
 │⛁ │  Master Data
 │▤ │  Rekam Medis
 │☰ │  Administrasi
 ╰──╯
```

Catatan: versi panel sidebar penuh (logo + daftar modul berlabel + tombol ringkas) sempat dibuat lalu **dibatalkan atas
permintaan user** — pertahankan rail mengambang ini, jangan digabung menjadi satu panel setinggi layar.

## Sumber data: `lib/menu.js`

- `MENU` = daftar **modul**: `{ key, title, description, icon, items: [...] }`. Item = halaman: `{ label, to, izin, match, icon,
  category, description, keywords }` (metadata item juga dipakai pencarian Ctrl+K).
- `visibleMenu(auth.can)` → `[{ key, label, description, icon, items }]`, item difilter izin; modul tanpa item yang boleh diakses
  tidak dikembalikan (mis. dokter hanya melihat Beranda, Pendaftaran (Data Pasien), Pelayanan).

| Modul (`key`) | Halaman |
|---------------|---------|
| Beranda (`beranda`) | Dashboard, Komisi Saya (petugas medis, PRD v2) |
| Pendaftaran (`pendaftaran`) | Data Pasien, Pendaftaran Kunjungan |
| Booking (`booking`) | Kalender Booking, Jadwal Praktik (PRD v2) |
| Pelayanan (`pelayanan`) | Antrian Poli (+ `/pemeriksaan/:id`) |
| Farmasi (`farmasi`) | Resep, Stok Batch (`inventori.kelola`, PRD v2), Obat & Stok |
| Keuangan (`keuangan`) | Kasir, Shift Kas (`kasir.shift`, PRD v2), Laporan (`laporan.keuangan`, PRD v2), Komisi (`komisi.kelola`/`laporan.keuangan`, PRD v2), Voucher & Promo (F1-08, `promo.kelola`) |
| Master Data (`master`) | Poli, Treatment, Paket Treatment (F1-08), Kategori Treatment, Ruang & Alat, Cabang |
| Rekam Medis (`rekam-medis`) | ICD-10, ICD-9-CM, Template SOAP, Protokol Foto (F1-06), Template Consent (F1-05; dipisah dari Master Data agar tab header tidak terlipat dua baris) |
| Administrasi (`administrasi`) | Pengguna, Peran & Izin, Pengaturan, Integrasi (PRD v2), Audit Log |

## Perilaku (`layouts/AppLayout.vue`)

- **Rail** (desktop, `fixed top-1/2 left-5 -translate-y-1/2`): tombol kembali (bila ada riwayat dalam aplikasi) di atas pil,
  lalu satu `.rail-btn` per modul (ikon modul, tooltip `.rail-tip` = nama modul, `.rail-btn-active` = modul terpilih).
- **Modul terpilih** = modul yang memuat halaman aktif (`item.to`/`match` = prefix path). Halaman di luar menu (`/profil`,
  `/kunjungan/:id`) tetap menampilkan **modul terakhir** di navbar agar tidak kosong.
- **Klik modul** → membuka halaman terakhir yang dibuka di modul itu (termasuk detail, mis. `/pasien/12`), atau halaman
  pertama modul. Disimpan di `sessionStorage` (`eklinik_modul`, `eklinik_modul_halaman`) per tab dan **dihapus saat logout /
  sesi berakhir** (`auth.clear()` & interceptor 401 memanggil `sessionStorage.clear()`) — perangkat bersama.
- **Header**: logo · tab halaman modul terpilih di tengah (`tab-active` + `aria-current="page"`) · pemilih cabang, pencarian,
  profil, keluar. Konten memakai `lg:pl-[6.5rem]` agar tidak tertutup rail.
- **Mobile** (< `lg`): rail tersembunyi; tab halaman modul di baris bawah header (geser horizontal); tombol Menu membuka drawer
  berisi semua modul (judul + ikon) beserta halamannya.
- Cetak: rail & header `print:hidden`.

## Class CSS (`style.css`)

`.rail`, `.rail-nav`, `.rail-btn`, `.rail-btn-active`, `.rail-tip` (tombol mengecil di layar pendek `max-height: 860px`).

## Menambah halaman / modul

- Halaman baru → item di modul yang tepat + route `meta.izin` yang sama (lihat [04-conventions.md](04-conventions.md)).
- Modul baru (mis. "Estetika", "Gigi" di Fase 1) → objek baru di `MENU` dengan `key` unik, `title`, `description` pendek,
  `icon` (path Heroicons outline). Urutan di `MENU` = urutan di rail. Jaga jumlah modul tetap sedikit (±7–9) agar rail muat di
  tengah layar.

## Verifikasi (30 Sep 2026)

Chrome headless: navbar berganti per modul, klik modul kembali ke halaman terakhirnya, `/profil` mempertahankan modul
terakhir, akun dokter hanya melihat modulnya, mobile (rail tersembunyi, tab & drawer), rail mengambang + tooltip.
`npm run build` lulus.
