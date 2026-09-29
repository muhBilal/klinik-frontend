# 02 — Arsitektur

## Struktur folder

```
src/
├── main.js                 createApp + Pinia + Router + style.css
├── App.vue                 <RouterView> + <ToastHost>
├── style.css               Tailwind 4: @theme (tema kaca monokrom, aksen hitam), class komponen (.card, .btn, .input, .table, .tab, .rail-btn, ...)
├── router/index.js         Definisi route + guard auth & role
├── layouts/AppLayout.vue   Rail ikon semua menu di tengah vertikal (desktop), header (logo, tab pil grup aktif, profil), drawer mobile, <RouterView>
├── lib/
│   ├── api.js              Instance axios, interceptor token & 401, errorMessage(), validationErrors()
│   ├── format.js           rupiah, angka, tanggal, waktu, jam, hariIni, jenisKelamin, debounce, konstanta label (PENJAMIN, METODE_BAYAR, ROLES)
│   ├── menu.js             Konfigurasi menu: grup → item (ikon rail + tab header); label, path, roles, ikon SVG, match
│   └── print.js            printElement(selector, title) — cetak elemen di jendela baru
├── stores/
│   ├── auth.js             token, user, isLoggedIn, hasRole(), login(), fetchMe(), logout(), clear()
│   └── toast.js            success(), error(), info()
├── composables/useList.js  State list: items, meta, loading, filters, load(page), reload(), search() (debounce)
├── components/             Komponen reusable (lihat 04-conventions.md)
└── views/                  Halaman per modul (lihat 03-pages.md)
```

## Autentikasi

1. `LoginView` → `auth.login(email, password)` → `POST /login` → token disimpan di `localStorage['eklinik_token']`.
2. `api.js` menambahkan `Authorization: Bearer <token>` di setiap request.
3. Respons 401 (selain `/login`) → token dihapus, redirect `/login`.
4. `router.beforeEach`:
   - route `meta.guest` (login) → kalau sudah login, ke dashboard.
   - belum login → `/login?redirect=...`.
   - `auth.user` kosong (refresh halaman) → `auth.fetchMe()`.
   - `meta.roles` → `auth.hasRole(...roles)`; gagal → toast error + ke dashboard.

`hasRole` meniru backend: **admin selalu lolos**. Untuk UI yang khusus role tertentu *tanpa* admin, bandingkan langsung
`auth.user?.role === 'perawat'` (contoh: `PemeriksaanView`, `AntrianView`).

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
- Cache ringan hanya untuk data referensi (`lib/cache.js`: `getPolisAktif()`, `getDokters()`, `cachedGet()`, TTL 5 menit,
  in-memory). `MasterCrud` membuang cache endpoint-nya setelah simpan/hapus (`invalidates` untuk prefix tambahan,
  mis. user → `/dokters`). Data transaksi (kunjungan, resep, tagihan) tidak di-cache.
