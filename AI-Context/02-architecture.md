# 02 — Arsitektur

## Struktur folder

```
src/
├── main.js                 createApp + Pinia + Router + style.css
├── App.vue                 <RouterView> + <ToastHost>
├── style.css               Tailwind 4: @theme (warna brand), class komponen (.btn, .input, .card, .table, .tab)
├── router/index.js         Definisi route + guard auth & role
├── layouts/AppLayout.vue   Sidebar (menu per role), header mobile, <RouterView>
├── lib/
│   ├── api.js              Instance axios, interceptor token & 401, errorMessage(), validationErrors()
│   ├── format.js           rupiah, angka, tanggal, waktu, jam, hariIni, jenisKelamin, debounce, konstanta label (PENJAMIN, METODE_BAYAR, ROLES)
│   ├── menu.js             Konfigurasi menu sidebar (label, path, roles, path ikon SVG)
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
Menambah halaman = tambah route di `router/index.js` **dan** (bila perlu di sidebar) item di `lib/menu.js` dengan `roles` yang sama.

## Pola data

- List: `useList('/endpoint', { filter awal })` → panggil `load()` di `onMounted`, `search` untuk input teks (debounce 350 ms),
  `load(page)` dari `<AppPagination @change>`. Menangani respons paginated Laravel maupun array biasa.
- Detail: `ref(null)` + `api.get` di `onMounted`, render dengan `<template v-if="data">`.
- Form: `reactive({...})` + `errors = ref({})` + `saving = ref(false)`; kirim, lalu `errors.value = validationErrors(e)`.
- Tidak ada cache global data master; tiap halaman mengambil yang dibutuhkan.
