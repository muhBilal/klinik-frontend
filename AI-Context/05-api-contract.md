# 05 — Kontrak API yang Dipakai UI

Referensi lengkap endpoint ada di repo backend: `AI-Context/05-api-reference.md`. File ini merangkum
bentuk data yang **diandalkan** komponen frontend — bila backend mengubahnya, UI harus ikut disesuaikan.

## Umum
- List paginated Laravel: `{ data: [], current_page, last_page, from, to, total }` → dinormalisasi `useList`.
- Array biasa: `GET /polis`, `GET /dokters`, `GET /pasiens/{id}/riwayat`.
- Error 422: `{ message, errors: { field: ['pesan'] } }`. Key array memakai dot notation (`resep.0.obat_id`).
- Uang = integer rupiah. Tanggal `YYYY-MM-DD`; timestamp ISO UTC (`created_at`, `dibayar_at`, ...).

## User (`/login`, `/me`)
```js
{ id, name, email, role: 'dokter', role_label: 'Dokter', poli_id, poli: { id, kode, nama } | null, sip, is_active }
```

## Kunjungan (detail, `GET /kunjungans/{id}` dan respons pemeriksaan)
```js
{
  id, no_registrasi, tanggal, no_antrian, penjamin, no_penjamin, keluhan, status, dipanggil_at, selesai_at, pasien_id,
  pasien: { id, no_rm, nama, jenis_kelamin, tanggal_lahir, umur, alergi, golongan_darah, no_bpjs, ... },
  poli: { id, kode, nama, tarif_konsultasi },
  dokter: { id, name, sip } | null,
  pemeriksaan: { tekanan_darah, nadi, suhu, respirasi, berat_badan, tinggi_badan, subjektif, objektif, asesmen, plan,
                 diagnosas: [{ id, icd10_id, jenis, icd10: { kode, nama } }] } | null,
  tindakans: [{ id, tindakan_id, jumlah, tarif, tindakan: { nama } }],
  resep: { id, no_resep, status, catatan, items: [{ obat_id, jumlah, aturan_pakai, harga, obat: { nama, satuan, stok } }] } | null,
  tagihan: { id, no_tagihan, total, grand_total, status } | null
}
```
Detail memuat `pasien` subset (no_rm, nama, jenis_kelamin, tanggal_lahir/umur, golongan_darah, alergi), `tagihan` tanpa `items`
(hanya id, no_tagihan, total, grand_total, status). List kunjungan hanya memuat `pasien` (id, no_rm, nama, jenis_kelamin),
`poli` (id, kode, nama), `dokter` (id, name); `umur` bernilai null di list.

Parameter ringan: `?simple=1` pada endpoint list (tanpa `total`), `GET /pasiens/{id}?ringkas=1` (tanpa kunjungans),
`GET /pasiens/{id}/riwayat?kecuali={kunjungan_id}`, `GET /polis?aktif=1` (hanya id, kode, nama).
Respons `POST /reseps/{id}/serahkan` dan `POST /tagihans/{id}/bayar` berbentuk sama dengan GET detail-nya.

## Resep list
`{ id, no_resep, status, created_at, items_count, dokter, kunjungan: { pasien, poli, tagihan: { status } | null } }`

## Tagihan detail
`{ no_tagihan, total, diskon, grand_total, status, metode_bayar, dibayar, kembalian, dibayar_at, kasir, items: [{ kategori, deskripsi, jumlah, harga, subtotal }], kunjungan: { tanggal, penjamin, pasien, poli, dokter } }`

## Obat
`{ id, kode, nama, satuan, harga, stok, stok_minimum, is_active }`; mutasi: `{ jenis, jumlah (bertanda), stok_akhir, referensi, keterangan, created_at, user }`.

## Dashboard
```js
{ tanggal, kunjungan: { total, per_status: { menunggu, diperiksa, menunggu_pembayaran, selesai, batal },
  per_poli: [{ id, nama, kunjungans_count }] }, pasien_total, pasien_baru_hari_ini, resep_menunggu,
  tagihan_belum_bayar, pendapatan_hari_ini /* null bila bukan kasir/admin */, obat_stok_menipis: [{ id, nama, satuan, stok }] }
```

## Nilai enum yang dipakai UI
- Status kunjungan: `menunggu`, `diperiksa`, `menunggu_pembayaran`, `selesai`, `batal`
- Status resep: `menunggu`, `diserahkan`, `batal` · Status tagihan: `belum_bayar`, `lunas`, `batal`
- Penjamin: `umum`, `bpjs`, `asuransi` · Metode bayar: `tunai`, `debit`, `qris`, `transfer`, `penjamin`
- Role: `admin`, `pendaftaran`, `perawat`, `dokter`, `apoteker`, `kasir`
