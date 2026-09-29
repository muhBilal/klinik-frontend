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
| `VITE_API_URL` | `http://localhost:8000/api` | base URL API, dibaca saat build. Untuk dev: origin frontend harus terdaftar di `FRONTEND_URL` backend (CORS). Di image Docker gabungan diisi `/api` (satu origin). |

## Docker / deploy

Repo ini **tidak punya file Docker sendiri**. Seluruh konfigurasi Docker ada di repo backend (`backend/docker/app/`):
`backend/docker-compose.yml` membuild frontend ini (`npm ci && npm run build` dengan `VITE_API_URL=/api`) lalu
menyajikan `dist/` dari Nginx di container yang sama dengan API, di http://localhost:8000.

Syarat: repo ini berada di folder `frontend/` sejajar dengan `backend/`:

```
e-klinik/
├── backend/    klinik-backend (docker-compose.yml di sini)
└── frontend/   repo ini
```

```bash
cd ../backend && docker compose up -d --build   # rebuild setiap ada perubahan frontend
```

Karena build produksi memakai `createWebHistory`, Nginx di image tersebut sudah melakukan SPA fallback
(`try_files $uri $uri/ /index.html`). Untuk development tetap pakai `npm run dev` (hot reload) dengan
backend dari `backend/docker-compose.dev.yml`.

## Akun demo

Password `password`: `admin@`, `pendaftaran@`, `perawat@`, `dokter@`, `apoteker@`, `kasir@` + `eklinik.test`.
Halaman login punya tombol pengisi akun demo.
