/**
 * Data klinis pasien (PS-03): pencocokan alergi untuk peringatan resep. Alergi yang bertaut master obat dicocokkan lewat id;
 * selain itu nama obat yang memuat nama zat alergi obat/lainnya (mis. alergi "Amoxicillin" ↔ "Amoxicillin 500 mg").
 *
 * @param {{ id: number, nama: string }} obat
 * @param {Array<{ kategori: string, zat: string, obat_id: number|null }>} alergis
 */
export function alergiObat(obat, alergis) {
  if (!obat || !alergis?.length) return null
  const nama = (obat.nama ?? '').toLowerCase()
  return (
    alergis.find(
      (a) => (a.obat_id && a.obat_id === obat.id) || (['obat', 'lainnya'].includes(a.kategori) && a.zat && nama.includes(a.zat.trim().toLowerCase())),
    ) ?? null
  )
}
