# 04 — Konvensi & Jebakan

## Styling

- **Tema "soft glass" monokrom** (mengikuti referensi desain dari user): latar abu-abu perak (`<AppBackground>`),
  permukaan kaca buram netral, **aksen hitam** (tab aktif, tombol utama, pilihan terpilih), tombol pil & lingkaran,
  sudut sangat bulat (`rounded-3xl` panel, `rounded-2xl` input/tile), font **Outfit** (`@fontsource-variable/outfit`, self-hosted; dipilih karena mirip Gilroy di referensi dan mendukung
  angka tabular — font pengganti wajib lolos `tabular-nums` agar kolom rupiah/stok tetap rata).
- Tailwind CSS 4, konfigurasi di `src/style.css`:
  - `@theme`: `brand-50 … brand-900` = skala **grafit → hitam** (nama `brand` dipertahankan; `bg-brand-900` = hitam aksen),
    warna `line` (garis tipis: `border-line`, `divide-line`), `shadow-glass(-lg)`, `inset-shadow-glass`/`inset-shadow-dark`, `animate-pop`.
    Tambah shade/token baru di sini sebelum dipakai.
  - Class komponen di `@layer components`:
    - Permukaan: `.card` (+ `.card-header/-title/-body`), `.glass`, `.glass-strong` (modal/dropdown/toast), `.tile`, `.chip`, `.icon-circle`.
    - Tombol: `.btn` + `.btn-primary` (pil hitam) / `.btn-secondary` (pil putih) / `.btn-danger` / `.btn-ghost`, `.btn-sm`, `.btn-icon` (lingkaran).
    - Form: `.label`, `.input` (`type="search"` otomatis jadi pil + ikon kaca pembesar), `.input-error`, `.field-error`,
      `.choice` + `.choice-active` (pilihan radio berbentuk kartu).
    - Lainnya: `.table`, `.tabs` + `.tab` + `.tab-active` (pil hitam), `.alert` + `.alert-warning/-danger`, `.rail-btn` + `.rail-btn-active` + `.rail-tip`.
  - Status memakai `<StatusBadge>` (pil solid bertulisan putih) — jangan membuat badge warna sendiri.
  - Warna selain monokrom hanya untuk makna: merah = error/alergi/stok kurang, warna badge status.
- Tombol **selalu** dua class: `class="btn btn-primary"` (varian tidak menyertakan `.btn`).
- `.card` memakai `backdrop-filter` (membuat stacking context) → `.card:focus-within` dinaikkan `z-index` agar dropdown
  `AsyncSelect` tidak tertutup kartu berikutnya. Jangan beri `overflow-hidden` pada `.card` yang berisi dropdown.
- Angka uang/kuantitas di tabel: `text-right tabular-nums`, format dengan `rupiah()` / `angka()`.
- Layout (`AppLayout`): desktop = rail ikon kiri berisi **semua** halaman sesuai role (dipisah garis per grup, tooltip nama,
  item aktif hitam), diposisikan di **tengah vertikal** layar (`top-1/2 -translate-y-1/2`; tombol mengecil di layar pendek
  `max-height: 860px` agar tidak menabrak logo) + header berisi logo, tab pil (item dalam grup aktif) dan profil.
  Mobile (< `lg`) = rail disembunyikan, tab bisa digeser, menu lengkap di drawer (tombol `aria-label="Menu"`).
  Tabel dibungkus `overflow-x-auto`.
- Elemen yang tidak boleh ikut dicetak diberi `print:hidden`, namun cetak utama memakai `printElement()`.

## Komponen reusable (`src/components`)

| Komponen | Props / Event | Catatan |
|----------|---------------|---------|
| `AppModal` | `v-model`, `title`, `size` (`max-w-lg`), slot default + `#footer` | Teleport ke body, Esc & klik backdrop menutup. Tombol submit di footer pakai `form="id-form"`. |
| `AsyncSelect` | `endpoint`, `params`, `placeholder`, `@select`, slot `#default="{ item }"` | Autocomplete ke endpoint index (`q`, `per_page=10`), navigasi keyboard, input dikosongkan setelah pilih. |
| `AppPagination` | `meta`, `@change(page)` | Memakai meta dari `useList`. |
| `StatusBadge` | `status` | Map warna/label untuk semua status kunjungan/resep/tagihan + `aktif`/`nonaktif`. Tambah status baru di sini. |
| `PageHeader` | `title`, `subtitle`, slot aksi | |
| `MasterCrud` | `title`, `endpoint`, `columns`, `fields`, `defaults`, `searchable`, `itemLabel`, slot `#cell-{key}` | CRUD generik untuk master. `fields[].type`: text/number/email/password/select/checkbox; `options`, `required`, `full`, `show(form)`. Password kosong saat edit = tidak diubah. |
| `PasienFormModal` | `v-model`, `pasien` (null = baru), `@saved(pasien)` | Dipakai di list pasien, detail, dan pendaftaran. |
| `RekamMedisRingkas` | `kunjungan` | Ringkasan vital, SOAP, diagnosa, tindakan, resep. |
| `ToastHost`, `AppIcon` | — / `path`, `size` | Ikon = path SVG heroicons outline. |
| `AppSpinner` | `size` (`size-4`) | Spinner warna `currentColor`; di tombol taruh sebelum teks. |
| `PageLoading` | `error`, `text`, `@retry` | Placeholder halaman detail (spinner / pesan error + coba lagi). |
| `TableSkeleton` | `cols`, `rows` (5) | Baris placeholder di dalam `<tbody>`. |
| `TopProgress` | — | Progress bar global, sudah dipasang di `App.vue`. |

## Menambah halaman baru

1. Buat view di `src/views/<modul>/`.
2. Daftarkan route (lazy import) di `router/index.js` dengan `meta.roles` sesuai `role:` backend.
3. Tambah item menu di `lib/menu.js` (roles sama, ikon path SVG). Setiap item otomatis muncul di rail dan sebagai tab di header
   saat grupnya aktif; `match` untuk prefix path tambahan yang ikut menandai item aktif (mis. `/pemeriksaan` → Antrian Poli).
4. Gunakan `useList` untuk list, `api` + `errorMessage/validationErrors` untuk form.
5. `npm run build`.

## Jebakan yang sudah diketahui

| Masalah | Solusi |
|---------|--------|
| `@apply btn` pada class kustom gagal di Tailwind 4 | Jangan `@apply` class buatan sendiri; kombinasikan class di template. |
| Global browser (`window`, `setTimeout`) tidak bisa dipanggil di template Vue | Buat fungsi di `<script setup>`. |
| Tanggal `YYYY-MM-DD` diparse sebagai UTC | Pakai `tanggal()` dari `lib/format.js` (sudah menangani) dan `hariIni()` untuk default filter. |
| Kolom `stok` obat | Hanya berubah lewat endpoint mutasi/serahkan; form edit obat tidak mengirim stok. |
| Role check di UI | `hasRole('x')` bernilai true untuk admin — pakai `auth.user.role === 'x'` bila perilaku khusus role itu saja. |
| CORS error | Pastikan origin (mis. `http://localhost:5173`) ada di `FRONTEND_URL` backend. |
| Token di `localStorage` | Trade-off kesederhanaan vs risiko XSS. Jangan pernah render HTML dari data user (`v-html`). |
