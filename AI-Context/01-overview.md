# 01 — Overview

## Stack

| Paket | Versi | Kegunaan |
|-------|-------|----------|
| vue | ^3.5 | UI, Composition API |
| vue-router | ^5 | routing (API `createRouter`/`createWebHistory` sama dengan v4) |
| pinia | ^4 | state (`auth`, `toast`) — setup store |
| axios | ^1 | HTTP client |
| vite | ^8 | dev server & build (Node ≥ 20.19 / 22.12) |
| tailwindcss + @tailwindcss/vite | ^4 | styling, konfigurasi di CSS (`@theme`) — tidak ada `tailwind.config.js` |

Tidak ada linter/test runner terpasang. Verifikasi dengan `npm run build` dan uji manual di browser.

## Menjalankan

Backend harus sudah berjalan (lihat repo backend, `http://localhost:8000/api`).

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
npm run build      # output ke dist/
npm run preview
```

## Environment

| Key | Default | Catatan |
|-----|---------|---------|
| `VITE_API_URL` | `http://localhost:8000/api` | base URL API. Origin frontend harus terdaftar di `FRONTEND_URL` backend (CORS). |

## Deploy

Hasil `npm run build` adalah static files (`dist/`). Karena memakai `createWebHistory`, web server harus
mengarahkan semua path ke `index.html` (SPA fallback), mis. Nginx `try_files $uri /index.html;`.

## Akun demo

Password `password`: `admin@`, `pendaftaran@`, `perawat@`, `dokter@`, `apoteker@`, `kasir@` + `eklinik.test`.
Halaman login punya tombol pengisi akun demo.
