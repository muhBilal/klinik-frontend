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
    - Lainnya: `.table`, `.tabs` + `.tab` + `.tab-active` (pil hitam), `.alert` + `.alert-warning/-danger`, `.rail-btn` + `.rail-btn-active` + `.rail-tip` (rail modul).
  - Status memakai `<StatusBadge>` (pil solid bertulisan putih) — jangan membuat badge warna sendiri.
  - Warna selain monokrom hanya untuk makna: merah = error/alergi/stok kurang, warna badge status.
- Tombol **selalu** dua class: `class="btn btn-primary"` (varian tidak menyertakan `.btn`).
- `.card` memakai `backdrop-filter` (membuat stacking context) → `.card:focus-within` dinaikkan `z-index` agar dropdown
  `AsyncSelect` tidak tertutup kartu berikutnya. Jangan beri `overflow-hidden` pada `.card` yang berisi dropdown.
- Angka uang/kuantitas di tabel: `text-right tabular-nums`, format dengan `rupiah()` / `angka()`.
- Layout (`AppLayout`): desktop = **rail modul** kiri (pil kaca mengambang di tengah vertikal, satu tombol ikon per modul,
  tooltip nama, modul aktif biru) + header berisi logo, **tab pil halaman modul terpilih** di tengah, pemilih cabang, pencarian,
  profil, keluar. Mobile (< `lg`) = rail disembunyikan, tab halaman modul di bawah header (bisa digeser), semua modul & halaman
  di drawer (tombol `aria-label="Menu"`). Jangan mengganti rail menjadi panel sidebar penuh (sudah dicoba & ditolak user).
  Detail: [07-navigasi-modul.md](07-navigasi-modul.md). Tabel dibungkus `overflow-x-auto`.
- Elemen yang tidak boleh ikut dicetak diberi `print:hidden`, namun cetak utama memakai `printElement()`.

## Komponen reusable (`src/components`)

| Komponen | Props / Event | Catatan |
|----------|---------------|---------|
| `AppModal` | `v-model`, `title`, `size` (`max-w-lg`), slot default + `#footer` | Teleport ke body, Esc & klik backdrop menutup. Tombol submit di footer pakai `form="id-form"`. |
| `AsyncSelect` | `endpoint`, `params`, `placeholder`, `@select`, slot `#default="{ item }"` | Autocomplete ke endpoint index (`q`, `per_page=10`), navigasi keyboard, input dikosongkan setelah pilih. |
| `AppPagination` | `meta`, `@change(page)` | Memakai meta dari `useList`. |
| `StatusBadge` | `status` | Map warna/label untuk semua status kunjungan/resep/tagihan + `aktif`/`nonaktif`. Tambah status baru di sini. |
| `PageHeader` | `title`, `subtitle`, slot aksi | |
| `MasterCrud` | `title`, `endpoint`, `columns`, `fields`, `defaults`, `searchable`, `itemLabel`, `invalidates`, `modalSize`, slot `#cell-{key}`, event `changed` | CRUD generik untuk master (endpoint paginated atau array). `fields[].type`: text/number/email/password/time/select/checkbox/**textarea** (tipe lain diteruskan ke `<input type>`); `options`, `required`, `full`, `show(form)`, `placeholder`, `rows`, `hint` (teks bantuan). Password kosong saat edit = tidak diubah. Checkbox baru default `true` kecuali diberi `defaults`. |
| `LampiranBerkas` | `pasienId`, `kunjunganId?`, `readonly` | Lampiran klinis terenkripsi: daftar (rme.lihat), unggah & hapus (berkas.kelola), "Lihat" meminta tautan bertanda tangan (tercatat audit) → pratinjau gambar di modal / PDF di tab baru. |
| `PasienFormModal` | `v-model`, `pasien` (null = baru), `@saved(pasien)` | Dipakai di list pasien, detail, dan pendaftaran. |
| `RekamMedisRingkas` | `kunjungan` | Ringkasan vital, SOAP, diagnosa, tindakan (+ ICD-9-CM, petugas, catatan), consent (klik = lihat), resep, tanda tangan, addendum. `rme_disembunyikan` → pesan 🔒 saja. |
| `SignaturePad` | `v-model` (PNG data URL), `label`, `disabled`, `invalid`; expose `hapus()` | Tanda tangan jari/stylus di tablet. |
| `rme/FaceChart` | `v-model` (titik), `v-model:terpilih`, `readonly`, `@tambah({x,y,area})` | Diagram wajah; titik relatif 0..1. |
| `rme/CatatanTindakanModal` | `v-model`, `kunjunganTindakanId`, `editable`, `@saved` | Catatan, face chart, parameter alat, BHP. |
| `rme/ConsentFormModal` / `rme/ConsentLihatModal` | `kunjungan`, `tindakan` / `uuid`, `bisaCabut` | Ambil consent (naskah backend + tanda tangan) / lihat, cetak, cabut. |
| `foto/FotoKlinisCard` | `pasien`, `kunjunganId?`, `tindakans`, `bisaAmbil`; expose `ambil(tindakan?)` | Persetujuan foto + kamera + galeri (F1-06). |
| `foto/GaleriFoto`, `foto/BandingFoto`, `foto/KameraFoto`, `foto/PersetujuanFotoPanel` | lihat `08-fitur-fase-1.md` | Galeri & before-after, kamera terpandu, consent foto. |
| `paket/PaketPasienCard` | `pasien`, `ringkas`; expose `muatUlang()`, `@changed` | Paket pasien: sisa per treatment (bar), riwayat pemakaian, jual, perpanjang/alihkan/refund sisa. `ringkas` = hanya paket aktif, tanpa aksi, tersembunyi bila kosong. |
| `paket/JualPaketModal` | `v-model`, `pasien?` (null = pilih pasien) | Pilih paket katalog → tagihan → `/kasir/{tagihan_id}`. |
| `gigi/OdontogramCard` | `pasien`, `kunjunganId?`, `editable`, `bisaTambahTindakan`, `@tambah-tindakan({gigi, permukaan})`; expose `muatUlang()` | Odontogram + panel gigi terpilih + perubahan kunjungan / riwayat (F1-07). |
| `gigi/OdontogramChart` | `kondisis`, `peta`, `terpilih`, `tampilSulung`, `@pilih({gigi, permukaan})` | Gambar SVG FDI; `g[data-gigi]`, `polygon[data-permukaan]`. |
| `gigi/PilihGigi` | `v-model:gigi`, `v-model:permukaan`, `tanpaPermukaan`, `disabled`, `invalid`, `idInput` | Select nomor gigi (grup kuadran) + tombol M/O/D/B/L. |
| `gigi/RencanaPerawatanCard` / `gigi/RencanaPerawatanModal` | `pasien`, `kunjungan?`, `bisaKerjakan`, `itemDipakai`, `gigiAwal`, `@kerjakan(item)` | Rencana perawatan gigi + persetujuan, revisi, batal, cetak estimasi / form susun rencana. |
| `rme/AddendumModal`, `rme/TemplateSoapModal` | `kunjunganId` / `poliId`, `tindakanIds`, `@terapkan({template, mode})` | Addendum RME; pilih template SOAP. |
| `ToastHost`, `AppIcon` | — / `path`, `size` | Ikon = path SVG heroicons outline. |
| `AppSpinner` | `size` (`size-4`) | Spinner warna `currentColor`; di tombol taruh sebelum teks. |
| `PageLoading` | `error`, `text`, `@retry` | Placeholder halaman detail (spinner / pesan error + coba lagi). |
| `TableSkeleton` | `cols`, `rows` (5) | Baris placeholder di dalam `<tbody>`. |
| `TopProgress` | — | Progress bar global, sudah dipasang di `App.vue`. |

## Hak akses di UI

- Tampilkan/sembunyikan dengan `auth.can('izin')` (satu atau beberapa izin, "salah satu"). Nama izin = enum `Izin` backend
  (daftar lengkap: `backend/AI-Context/modul/F0-01-rbac-peran-izin.md`).
- Jangan membandingkan `auth.user.role` — peran kustom bisa dibuat admin.
- Label peran dari API (`user.role_label`, `GET /perans`), bukan konstanta di frontend.
- Konten rekam medis (SOAP, diagnosa, lampiran) hanya untuk `can('rme.lihat')`; backend tidak mengirimnya ke peran lain.

## Logo produk

- **Sumber tunggal: `public/favicon.svg`** — huruf K bersudut biru (12 faset), latar transparan, digambar ulang sebagai vektor dari
  gambar logo yang diberikan user (1 Okt 2026). Ganti file ini untuk mengganti logo di mana pun.
- Pakai komponen **`<AppLogo class="size-11" />`** (`components/AppLogo.vue`, `<img>` ke favicon.svg) — jangan menyalin SVG ke template.
  Dipakai di header `AppLayout`, drawer mobile, dan `LoginView` (di panel biru diberi alas putih `bg-white rounded-2xl` agar kontras).
- Ikon turunan dibuat dari favicon.svg dengan **`npm run ikon`** (`scripts/buat-ikon.mjs`, Chrome headless lewat `playwright-core`;
  set `CHROME_PATH` bila Chrome tidak di lokasi default Windows): `favicon.ico` (16/32/48, juga disalin ke `backend/public/`),
  `icon-192.png`, `icon-512.png` (manifest), `apple-touch-icon.png` (180 px, latar putih). Jalankan ulang setiap logo berubah.
- `index.html` memuat favicon SVG + ICO, apple-touch-icon, `site.webmanifest` (nama "e-klinik", `theme_color` #0567B5).
- Logo = identitas **produk**. Kop dokumen cetak (struk, tiket, etiket, consent) tetap memakai identitas **klinik** dari pengaturan.

## Identitas klinik & cetak

- Nama klinik: `useKlinikStore().nama`; kontak/catatan kaki: `klinik.info` (dari `GET /info`, dimuat `AppLayout`/`LoginView`).
- Kop dokumen cetak = nama klinik + nama cabang dokumen (`tagihan.cabang`, `resep.cabang`, `tiket.cabang`); alamat & telepon
  cabang, fallback pengaturan klinik.
- Struk & tiket: `printElement('#struk', judul, { lebar: klinik.info?.cetak?.lebar_struk })`.

## Menambah halaman baru

1. Buat view di `src/views/<modul>/`.
2. Daftarkan route (lazy import) di `router/index.js` dengan `meta.izin` sesuai middleware `izin:` backend.
3. Tambah item menu di `lib/menu.js` di modul yang tepat (`izin` sama, ikon path SVG). Item otomatis muncul sebagai tab navbar
   saat modulnya dipilih, di drawer mobile, dan di pencarian Ctrl+K; `match` untuk prefix path tambahan yang ikut menandai
   item aktif (mis. `/pemeriksaan` → Antrian Poli). Modul baru = objek grup baru dengan `key`, `title`, `description`, `icon`.
4. Gunakan `useList` untuk list, `api` + `errorMessage/validationErrors` untuk form.
5. Aksi cepat di `CommandPalette.vue` (`ACTIONS`) memakai `izin` juga.
6. `npm run build`.

## Jebakan yang sudah diketahui

| Masalah | Solusi |
|---------|--------|
| `@apply btn` pada class kustom gagal di Tailwind 4 | Jangan `@apply` class buatan sendiri; kombinasikan class di template. |
| Global browser (`window`, `setTimeout`) tidak bisa dipanggil di template Vue | Buat fungsi di `<script setup>`. |
| Tanggal `YYYY-MM-DD` diparse sebagai UTC | Pakai `tanggal()` dari `lib/format.js` (sudah menangani) dan `hariIni()` untuk default filter. |
| Kolom `stok` obat | Hanya berubah lewat endpoint mutasi/serahkan; form edit obat tidak mengirim stok. |
| Cek akses di UI | `auth.can()` true untuk administrator (semua izin). Untuk "dokter yang tercatat di kunjungan" pakai `auth.user.tercatat_dokter`. |
| Data cabang lain | Detail transaksi cabang lain → 404 dari backend (kecuali `GET /kunjungans/{id}` read-only). Tautan dari riwayat pasien lintas cabang hanya ke `/kunjungan/:id`. |
| Ganti cabang | Selalu lewat `auth.setCabang()` + reload; jangan menulis `localStorage['eklinik_cabang']` langsung. |
| Tautan berkas | Berlaku ±5 menit & setiap permintaan tercatat audit — minta saat dibutuhkan, jangan dicache/di-prefetch. |
| `window.open` setelah `await` | Diblokir popup blocker; buka jendela kosong dulu lalu isi `location` (lihat `LampiranBerkas.buka`). |
| CORS error | Pastikan origin (mis. `http://localhost:5173`) ada di `FRONTEND_URL` backend. |
| Token di `localStorage` | Trade-off kesederhanaan vs risiko XSS. Jangan pernah render HTML dari data user (`v-html`). |
| `<option :value="null">` | Vue tidak menulis atribut `value`, jadi `select.value` DOM = teks opsinya. Cek pilihan lewat `v-model`/`selectedIndex`, bukan `select.value` (penting untuk skrip E2E). |
| Naskah consent / tanda tangan | Jangan merakit naskah di frontend — tampilkan `isi` dari `pratinjau` (backend me-render ulang & menyimpan snapshot). Detail consent (`/informed-consents/{uuid}`) tercatat audit tiap dibuka: minta saat modal dibuka, jangan prefetch. |
| Foto klinis dari `<input type=file>` | Selalu lewat `siapkanFoto()` (`lib/foto.js`) agar EXIF/GPS terbuang & thumbnail terbentuk; jangan unggah berkas mentah ke kategori `foto_klinis`. |
| Tautan foto & audit | Setiap tautan (termasuk thumbnail) tercatat audit — minta untuk foto yang tampil saja, jangan prefetch seluruh riwayat. |
| Pemeriksaan yang sudah ditandatangani | Jangan tampilkan form edit; koreksi lewat `AddendumModal`. Backend menolak semua perubahan. |
| Grid halaman (`grid lg:grid-cols-3`) melebar di mobile karena tabel | Tanpa `grid-cols-*` di mobile kolomnya `auto` → min-content tabel (riwayat, struk) melebarkan halaman. Tulis `grid grid-cols-1 gap-5 lg:grid-cols-…` (minmax(0,1fr)) + bungkus tabel `overflow-x-auto`. Ukur `scrollWidth` **setelah** transisi halaman selesai (±1,5 dtk). |
| Prettier | Repo **tidak** punya konfigurasi Prettier; `npx prettier --write` memakai default (titik koma, kutip ganda, 80 kolom) dan merusak gaya. Jangan dijalankan. |
| Konten lebar di dalam kolom grid (mis. SVG odontogram `min-w-[640px]`) | Item grid punya `min-width: auto` → seluruh halaman mobile ikut melebar. Bungkus dengan `overflow-x-auto [contain:inline-size]` (lihat `OdontogramCard`) agar hanya pembungkusnya yang bisa digeser. Cek `document.documentElement.scrollWidth` = lebar viewport di E2E. |
| Baris tindakan pemeriksaan | `:key="t._key"` (bukan `tindakan_id`): tindakan yang sama boleh beberapa baris (beda gigi). Tindakan per gigi selalu baris baru; yang lain tetap digabung (`jumlah++`). |
| Kode / warna kondisi gigi | Jangan disalin ke frontend — `referensiGigi()` (`lib/gigi.js`). Gambar odontogram hanya menerima `peta` dari situ. |
