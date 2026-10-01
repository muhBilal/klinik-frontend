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
| `AsyncSelect` | `endpoint`, `params`, `placeholder`, `@select`, slot `#default="{ item }"` | Autocomplete ke endpoint index (`q`, `per_page=10`), navigasi keyboard, input dikosongkan setelah pilih. Enter tidak pernah mengirim form induk. |
| `AppPagination` | `meta`, `@change(page)` | Memakai meta dari `useList`. |
| `StatusBadge` | `status` | Map warna/label untuk semua status kunjungan/resep/tagihan + `aktif`/`nonaktif`. Tambah status baru di sini. |
| `PageHeader` | `title`, `subtitle`, slot aksi | |
| `MasterCrud` | `title`, `endpoint`, `columns`, `fields`, `defaults`, `searchable`, `itemLabel`, `invalidates`, `modalSize`, slot `#cell-{key}`, event `changed` | CRUD generik untuk master (endpoint paginated atau array). `fields[].type`: text/number/email/password/time/select/checkbox/**textarea** (tipe lain diteruskan ke `<input type>`); `options`, `required`, `full`, `show(form)`, `placeholder`, `rows`, `hint` (teks bantuan). Password kosong saat edit = tidak diubah. Checkbox baru default `true` kecuali diberi `defaults`. |
| `LampiranBerkas` | `pasienId`, `kunjunganId?`, `readonly` | Lampiran klinis terenkripsi: daftar (rme.lihat), unggah & hapus (berkas.kelola), "Lihat" meminta tautan bertanda tangan (tercatat audit) → pratinjau gambar di modal / PDF di tab baru. |
| `PasienFormModal` | `v-model`, `pasien` (null = baru), `@saved(pasien)` | Dipakai di list pasien, detail, dan pendaftaran. |
| `RekamMedisRingkas` | `kunjungan` | Ringkasan vital, SOAP, diagnosa, tindakan (+ ICD-9-CM, petugas, catatan), consent (klik = lihat), resep, tanda tangan, addendum. `rme_disembunyikan` → pesan akses terbatas saja. |
| `SignaturePad` | `v-model` (PNG data URL), `label`, `disabled`, `invalid`; expose `hapus()` | Tanda tangan jari/stylus di tablet. |
| `rme/FaceChart` | `v-model` (titik), `v-model:terpilih`, `readonly`, `@tambah({x,y,area})` | Diagram wajah; titik relatif 0..1. |
| `rme/CatatanTindakanModal` | `v-model`, `kunjunganTindakanId`, `editable`, `@saved` | Catatan, face chart, parameter alat, BHP. |
| `rme/ConsentFormModal` / `rme/ConsentLihatModal` | `kunjungan`, `tindakan` / `uuid`, `bisaCabut` | Ambil consent (naskah backend + tanda tangan) / lihat, cetak, cabut. |
| `foto/FotoKlinisCard` | `pasien`, `kunjunganId?`, `tindakans`, `bisaAmbil`; expose `ambil(tindakan?)` | Persetujuan foto + kamera + galeri (F1-06). |
| `foto/GaleriFoto`, `foto/BandingFoto`, `foto/KameraFoto`, `foto/PersetujuanFotoPanel` | lihat `08-fitur-fase-1.md` | Galeri & before-after, kamera terpandu, consent foto. |
| `klinis/PeringatanKlinis` | `klinis`, `alergis`, `jenisKelamin`, `tanggalLahir`, slot aksi | Chip alergi (merah), hamil/menyusui + tanggal, Fitzpatrick, riwayat obat & penyakit (F1-10). `[data-peringatan-klinis]`. |
| `klinis/DataKlinisModal` / `klinis/DataKlinisCard` | `v-model`, `pasien`, `klinis`, `alergis`, `@saved({klinis, alergis})` / `pasien` | Ubah data klinis (alergi per baris grid + tautan obat) / kartu di detail pasien. |
| `pdp/PersetujuanDataPanel` | `pasien`, `ringkas`, `@changed({pemrosesan, marketing})` | Persetujuan UU PDP: status, formulir (pemrosesan + opt-in terpisah, tanda tangan), cabut per jenis, riwayat, lihat/cetak. `[data-persetujuan-data]`. |
| `laporan/PeriodeFilter` | `v-model:mulai`, `v-model:selesai` (`YYYY-MM-DD`), `@change` | Tanggal dari–sampai + pintasan Hari ini / 7 hari / Bulan ini / Bulan lalu (F1-11). |
| `komisi/SlipKomisi` | `periode`, `petugas`, `barises` | Slip komisi (kop klinik, baris, subtotal per peran, tanda tangan); `#slip-komisi` untuk `printElement`. |
| `rme/RacikanModal` | `v-model`, `racikan` (null = baru); `@saved(racikan)` | Resep racikan (FR-01): nama, bentuk, isi, banyaknya, komponen per racikan. |
| `ImporMasterButton` | `jenis` (icd10/icd9cm/obat); `@selesai` | Impor CSV master + modal hasil (AD-10). Di `MasterCrud` lewat slot `#aksi="{ reload }"`. |
| `KopDokumen` / `KakiDokumen` | `cabang` | Kop & kaki dokumen cetak dari pengaturan `dokumen.*` (AD-04). |
| `booking/BookingFormModal` | `v-model`, `appointment` (null = baru), `preset` ({ pasien, petugas_id, tanggal, jam }), `@saved(appointment)` | Booking baru/reschedule: treatment, petugas, ruang/alat wajib (BK-08), slot kosong dari `/appointments-slot`. |
| `paket/PaketPasienCard` | `pasien`, `ringkas`; expose `muatUlang()`, `@changed` | Paket pasien: sisa per treatment (bar), riwayat pemakaian, jual, perpanjang/alihkan/refund sisa. `ringkas` = hanya paket aktif, tanpa aksi, tersembunyi bila kosong. |
| `paket/JualPaketModal` | `v-model`, `pasien?` (null = pilih pasien) | Pilih paket katalog → tagihan → `/kasir/{tagihan_id}`. |
| `gigi/OdontogramCard` | `pasien`, `kunjunganId?`, `editable`, `bisaTambahTindakan`, `@tambah-tindakan({gigi, permukaan})`; expose `muatUlang()` | Odontogram + panel gigi terpilih + perubahan kunjungan / riwayat (F1-07). |
| `gigi/OdontogramChart` | `kondisis`, `peta`, `terpilih`, `tampilSulung`, `@pilih({gigi, permukaan})` | Gambar SVG FDI; `g[data-gigi]`, `polygon[data-permukaan]`. |
| `gigi/PilihGigi` | `v-model:gigi`, `v-model:permukaan`, `tanpaPermukaan`, `disabled`, `invalid`, `idInput` | Select nomor gigi (grup kuadran) + tombol M/O/D/B/L. |
| `gigi/RencanaPerawatanCard` / `gigi/RencanaPerawatanModal` | `pasien`, `kunjungan?`, `bisaKerjakan`, `itemDipakai`, `gigiAwal`, `@kerjakan(item)` | Rencana perawatan gigi + persetujuan, revisi, batal, cetak estimasi / form susun rencana. |
| `rme/AddendumModal`, `rme/TemplateSoapModal` | `kunjunganId` / `poliId`, `tindakanIds`, `@terapkan({template, mode})` | Addendum RME; pilih template SOAP. |
| `ToastHost`, `AppIcon` | — / `path`, `size` | Ikon = path SVG heroicons outline; path umum di `IKON` (`lib/format.js`). **Jangan pakai emoji** (gembok, tanda seru, centang, bintang) sebagai ikon — cukup teks + warna, atau AppIcon + teks `sr-only`. |
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
  Dipakai di header `AppLayout`, drawer mobile, dan `LoginView` (pojok kiri atas panel form + lingkaran putih "avatar" di bawah kutipan).
- Ikon turunan dibuat dari favicon.svg dengan **`npm run ikon`** (`scripts/buat-ikon.mjs`, Chrome headless lewat `playwright-core`;
  set `CHROME_PATH` bila Chrome tidak di lokasi default Windows): `favicon.ico` (16/32/48, juga disalin ke `backend/public/`),
  `icon-192.png`, `icon-512.png` (manifest), `apple-touch-icon.png` (180 px, latar putih). Jalankan ulang setiap logo berubah.
- `index.html` memuat favicon SVG + ICO, apple-touch-icon, `site.webmanifest` (nama "lefaklinik", `theme_color` #0567B5), `<title>` "Lefaklinik".
- **Nama produk: lefaklinik** (sejak 1 Okt 2026, sebelumnya e-klinik). **Header desktop hanya logo K** (wordmark di header sengaja
  dikomentari oleh user di `AppLayout.vue` — jangan dikembalikan tanpa diminta); drawer mobile: logo + wordmark `<b>lefa</b>` tebal +
  `klinik` tipis, ditulis huruf kecil; di kalimat/judul ditulis "Lefaklinik". Nama teknis tetap `eklinik` (folder, database, container,
  `config/eklinik.php`, email demo `@eklinik.test`, kunci `localStorage`) — jangan diganti tanpa migrasi data.
- Logo = identitas **produk**. Kop dokumen cetak (struk, tiket, etiket, consent) tetap memakai identitas **klinik** dari pengaturan.

## Halaman login (`LoginView`)

- Tata letak mengikuti referensi desain dari user (2 Okt 2026; contoh aslinya aplikasi hotel, diadaptasi ke klinik): latar gelap senada
  brand + pola garis gedung samar, kartu `rounded-[2rem]` dua kolom — **kiri** panel form (logo + nama klinik, judul "Masuk" di tengah,
  input pil putih tanpa garis dengan ikon, tombol mata tampil/sembunyi password, tombol utama pil penuh, pemisah "Akun demo" + tombol
  akun demo), **kanan** (≥ `lg`) kutipan bertanda kutip oranye + logo & nama klinik + ilustrasi klinik di bawah. Mobile = panel form saja.
- **Fungsi tetap**: email + password, langkah kode 2FA, pesan `?sesi=habis`, akun demo. **Tanpa SSO, tanpa daftar akun, tanpa lupa
  password** — elemen itu di referensi sengaja tidak dibawa. Akun demo disembunyikan saat langkah 2FA.
- Aset (`components/login/`, SVG inline agar ikut tema & mode gelap):
  - `IlustrasiKlinik` — line-art gedung klinik bertanda silang + panel detak jantung, dua menara, apotek (tenda & papan kapsul),
    pepohonan. Garis = `color-mix(brand-950, slate)`, isian biru = `brand-100`, pastel persik/kuning/mint tetap; varian `dark:` per isian.
    Bagian bawah & kanan sengaja terpotong (menempel di sudut panel). Diletakkan dalam alur flex (`mt-auto`), bukan `absolute`,
    agar tidak menimpa kutipan saat kartu memendek (langkah 2FA).
  - `PolaLatarKlinik` — deret garis gedung tanpa isian (`currentColor`, `preserveAspectRatio="xMidYMax slice"`), dipakai
    `text-white/[0.07]` di bawah latar.
- Warna panel & latar dari `color-mix(in oklab, var(--color-brand-*) …)` (kelas arbitrer Tailwind) sehingga ikut rona tema.

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
| Path route & penanda menu aktif | Item menu aktif bila path **diawali** `to` → `/komisi` juga menandai `/komisi-saya`. Beri path yang tidak saling berawalan (`/komisi`, `/slip-komisi`). |
| Tabel berisi input/select di modal | Di 390 px kolom menciut sampai select/input tak terbaca (lihat harga per cabang). Untuk baris berisi kontrol, pakai grid yang turun baris di layar sempit (contoh: komisi di `TindakanView`). |
| Data klinis pasien | Jangan tampilkan alergi/hamil dari objek pasien identitas (kolom `alergi` sudah tidak ada). Pakai `pasien.klinis`/`pasien.alergis` dari detail kunjungan ber-RME, `/pasiens/{id}/klinis`, atau `kunjungan.pasien` di resep; peringatan obat lewat `alergiObat()` (`lib/klinis.js`). |
| Muat ulang data karena filter (di luar `useList`) | Permintaan bisa selesai tidak berurutan → data filter lama menimpa yang baru. Simpan nomor urut permintaan dan hanya pakai respons terakhir (lihat `muat()` di `LaporanPenjualanView`); `useList` sudah membatalkan permintaan lama. |
| Prettier | Repo **tidak** punya konfigurasi Prettier; `npx prettier --write` memakai default (titik koma, kutip ganda, 80 kolom) dan merusak gaya. Jangan dijalankan. |
| Konten lebar di dalam kolom grid (mis. SVG odontogram `min-w-[640px]`) | Item grid punya `min-width: auto` → seluruh halaman mobile ikut melebar. Bungkus dengan `overflow-x-auto [contain:inline-size]` (lihat `OdontogramCard`) agar hanya pembungkusnya yang bisa digeser. Cek `document.documentElement.scrollWidth` = lebar viewport di E2E. |
| Baris tindakan pemeriksaan | `:key="t._key"` (bukan `tindakan_id`): tindakan yang sama boleh beberapa baris (beda gigi). Tindakan per gigi selalu baris baru; yang lain tetap digabung (`jumlah++`). |
| Kode / warna kondisi gigi | Jangan disalin ke frontend — `referensiGigi()` (`lib/gigi.js`). Gambar odontogram hanya menerima `peta` dari situ. |
