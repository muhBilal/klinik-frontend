/**
 * Cetak satu elemen (tiket antrian, struk, etiket obat) di jendela terpisah
 * dengan stylesheet aplikasi, sehingga layout/sidebar tidak ikut tercetak.
 * `lebar` (mis. '80mm', dari pengaturan cetak.lebar_struk) = lebar kertas printer thermal.
 */
export function printElement(selector, title = 'Cetak', { lebar } = {}) {
  const el = document.querySelector(selector)
  if (!el) return

  const win = window.open('', '_blank', 'width=720,height=900')
  if (!win) return

  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => node.outerHTML).join('')

  const kertas = lebar ? `<style>@page{size:${lebar} auto;margin:3mm}body{width:${lebar};padding:0!important}</style>` : ''

  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${title}</title>${styles}${kertas}</head><body style="background:#fff;padding:24px">${el.outerHTML}</body></html>`)
  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
    win.close()
  }
}
