# AI-Context — Frontend E-Klinik

Konteks untuk AI assistant (dan developer baru) yang akan bekerja di `frontend/`.

| File | Isi |
|------|-----|
| [01-overview.md](01-overview.md) | Stack, cara menjalankan, environment |
| [02-architecture.md](02-architecture.md) | Struktur folder, routing & guard role, state, HTTP client |
| [03-pages.md](03-pages.md) | Daftar halaman, role yang boleh, endpoint yang dipakai |
| [04-conventions.md](04-conventions.md) | Styling Tailwind, pola komponen, cara menambah halaman, jebakan |
| [05-api-contract.md](05-api-contract.md) | Bentuk data dari backend yang diandalkan UI |

## Ringkasan 30 detik

- **Vue 3 SPA** (Composition API, `<script setup>`, JavaScript — bukan TypeScript) dengan Vite 8, Vue Router 5, Pinia 4, Tailwind CSS 4, Axios.
- Berkomunikasi dengan backend Laravel terpisah (repo `klinik-backend`) lewat REST API + token Bearer.
- Menu & halaman dibatasi per role (admin melihat semua). Backend tetap sumber kebenaran hak akses.
- Bahasa UI: **Bahasa Indonesia**.

## Aturan emas

1. Setiap aturan bisnis ditegakkan di backend; frontend hanya membantu UX (disable tombol, pesan). Jangan pindahkan validasi penting ke frontend saja.
2. Semua request HTTP lewat `src/lib/api.js` (bukan `fetch`/axios baru).
3. Tampilkan error dengan `useToastStore().error(errorMessage(e))` dan error field dengan `validationErrors(e)`.
4. Jalankan `npm run build` untuk memastikan tidak ada error kompilasi sebelum selesai.
