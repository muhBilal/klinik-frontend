# 02 — Arsitektur

## Struktur folder

```
src/
├── main.js                 createApp + Pinia + Router + style.css
├── App.vue                 <RouterView> + <ToastHost>
├── style.css               Tailwind 4: @theme (tema kaca monokrom, aksen hitam), class komponen (.card, .btn, .input, .table, .tab, .rail-btn, ...)
├── router/index.js         Definisi route + guard auth & role
├── layouts/AppLayout.vue   Rail MODUL kiri (pil mengambang, 1 tombol per modul), header = logo + tab halaman modul terpilih +
│                           pemilih cabang, pencarian, profil → /profil (lihat 07-navigasi-modul.md),
│                           drawer mobile, akhiri sesi idle (useIdle), memuat info klinik, <RouterView>
├── lib/
│   ├── api.js              Instance axios, header token & X-Cabang-Id, interceptor 401 (→ /login?sesi=habis) & 403 wajib_2fa (→ /profil),
│   │                       errorMessage(), validationErrors()
│   ├── format.js           rupiah, angka, tanggal, waktu, jam, hariIni, jenisKelamin, debounce, ukuranBerkas, konstanta label
│   │                       (PENJAMIN, METODE_BAYAR, KATEGORI_BERKAS, ...). Label peran TIDAK di sini — dari API (`role_label`, /perans)
│   ├── menu.js             Konfigurasi menu: MODUL (key, title, description, icon) → item halaman (label, to, izin, icon, match)
│   ├── foto.js             Foto klinis: proses gambar di browser (resize, thumbnail, EXIF dibuang), unggah, tautan massal (F1-06)
│   ├── gigi.js             Notasi FDI (BARIS_GIGI, label permukaan, normalPermukaan, formatGigi, namaGigi, FASE_RENCANA) +
│   │                       referensiGigi() — kode/label/warna kondisi dari GET /odontogram/referensi (F1-07)
│   └── print.js            printElement(selector, title, { lebar }) — cetak elemen di jendela baru, lebar kertas struk opsional
├── stores/
│   ├── auth.js             token, user, can(...izin), cabangAktif/cabangs/cabang/lintasCabang, setCabang(), perlu2fa,
│   │                       login() (→ { tantangan } bila 2FA), login2fa(), fetchMe(), logout(), clear()
│   ├── klinik.js           info publik GET /info: nama klinik, kontak, catatan kaki & lebar struk — muat() / muat(true)
│   └── toast.js            success(), error(), info()
├── composables/useList.js  State list: items, meta, loading, filters, load(page), reload(), search() (debounce)
├── components/             Komponen reusable (lihat 04-conventions.md); AppLogo = logo produk (public/favicon.svg);
│                           subfolder per domain: rme/ (F1-05), foto/ (F1-06), gigi/ (F1-07), paket/ (F1-08)
└── views/                  Halaman per modul (lihat 03-pages.md)
```

## Autentikasi

1. `LoginView` → `auth.login(email, password)` → `POST /login`:
   - tanpa 2FA → token disimpan di `localStorage['eklinik_token']`;
   - akun ber-2FA → `{ tantangan }`, form beralih ke input kode → `auth.login2fa(tantangan, kode)` → token.
2. `api.js` menambahkan `Authorization: Bearer <token>` dan `X-Cabang-Id` (bila ada cabang aktif) di setiap request.
3. Respons 401 (selain `/login*`) → token dihapus, redirect `/login?sesi=habis` (token idle/kedaluwarsa/dicabut).
   Respons 403 `{ kode: 'wajib_2fa' }` → `/profil`.
4. `router.beforeEach`:
   - route `meta.guest` (login) → kalau sudah login, ke dashboard.
   - belum login → `/login?redirect=...`.
   - `auth.user` kosong (refresh halaman) → `auth.fetchMe()`.
   - `auth.perlu2fa` (peran wajib 2FA, belum aktif) → semua halaman selain `/profil` dialihkan ke `/profil`.
   - `meta.izin` → `auth.can(...izin)` (salah satu); gagal → toast error + ke dashboard.
5. `AppLayout` mengakhiri sesi setelah `user.sesi.idle_timeout_menit` tanpa interaksi (`useIdle`) — backend juga menolak token idle.

`can()` meniru middleware `izin:` backend: izin efektif ada di `user.izin` (administrator = semua izin). Untuk perilaku
"hanya tenaga yang bukan dokter" pakai `auth.can('pemeriksaan.vital') && !auth.can('pemeriksaan.dokter')`; untuk "dokter yang
tercatat di kunjungan" (bukan admin) pakai `auth.user.tercatat_dokter`.

## Cabang aktif

- `auth.cabangAktif` (string id, `''` = semua cabang) disimpan di `localStorage['eklinik_cabang']` dan dikirim sebagai header
  `X-Cabang-Id`. Setelah `/me`, nilai divalidasi terhadap `user.cabangs`; staf terikat cabang selalu `user.cabang_id`.
- Pemilih cabang di header hanya untuk user lintas cabang dengan > 1 cabang. Mengganti cabang → `setCabang()` (membuang cache
  referensi) lalu `window.location.reload()` agar semua halaman memuat data cabang baru.
- Detail lengkap: `backend/AI-Context/modul/F0-02-multi-cabang.md`.

## Routing

Semua halaman kecuali login adalah child dari `AppLayout` dan di-lazy-load (`() => import(...)`).
Menambah halaman = tambah route di `router/index.js` **dan** (bila perlu di navigasi) item di `lib/menu.js` dengan `roles` yang sama.

## Pola data

- List: `useList('/endpoint', { filter awal })` → panggil `load()` di `onMounted`, `search` untuk input teks (debounce 350 ms),
  `load(page)` dari `<AppPagination @change>`. Menangani respons paginated Laravel maupun array biasa.
- Detail: `useDetail(() => url)` → `{ data, loading, error, load }`; render `<template v-if="data">` lalu
  `<PageLoading v-else :error="error" @retry="load" />`. Setelah aksi (serahkan, bayar, simpan) pakai data dari respons,
  jangan GET ulang bila bentuknya sama.
- Loading: progress bar global otomatis untuk setiap request `api` & navigasi (`lib/progress.js`, `<TopProgress>`);
  `{ silent: true }` di config axios untuk request latar belakang. Tabel: `<TableSkeleton>` saat `loading && !items.length`,
  wrapper tabel `opacity-60` saat memuat ulang. Tombol aksi: `<AppSpinner>` + `:disabled`.
- `useList` membatalkan request sebelumnya (AbortController) dan saat komponen unmount; `load(page, { silent: true })`
  untuk auto-refresh. Error `isCanceled(e)` diabaikan.
- Form: `reactive({...})` + `errors = ref({})` + `saving = ref(false)`; kirim, lalu `errors.value = validationErrors(e)`.
- Cache ringan hanya untuk data referensi (`lib/cache.js`: `getPolisAktif()`, `getDokters()`, `cachedGet()` — dipakai juga untuk
  `/perans`, `/cabangs`; TTL 5 menit, in-memory). `MasterCrud` membuang cache endpoint-nya setelah simpan/hapus (`invalidates`
  untuk prefix tambahan, mis. user → `/dokters`). Ganti cabang membuang semua cache. Data transaksi (kunjungan, resep, tagihan)
  tidak di-cache.
