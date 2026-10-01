/**
 * Buat ikon turunan dari logo `public/favicon.svg` (sumber tunggal logo aplikasi):
 * - public/favicon.ico (16, 32, 48 px; PNG di dalam ICO) — juga disalin ke ../backend/public/favicon.ico
 * - public/icon-192.png, public/icon-512.png (latar transparan, untuk site.webmanifest)
 * - public/apple-touch-icon.png (180 px, latar putih — iOS mengisi area transparan dengan hitam)
 *
 * Jalankan setelah mengganti logo: `npm run ikon`. Memakai Chrome/Chromium headless lewat playwright-core:
 * set `CHROME_PATH` ke chrome.exe/chromium, atau pasang browser Playwright (`npx playwright install chromium`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publik = resolve(frontend, 'public')
const backendPublik = resolve(frontend, '../backend/public')
const svg = readFileSync(resolve(publik, 'favicon.svg'))

const CHROME_WINDOWS = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const executablePath = process.env.CHROME_PATH ?? (existsSync(CHROME_WINDOWS) ? CHROME_WINDOWS : undefined)
const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ deviceScaleFactor: 1 })

async function render(ukuran, { latar = 'transparent', padding = 0 } = {}) {
  const isi = ukuran - padding * 2
  await page.setViewportSize({ width: ukuran, height: ukuran })
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${latar}">
    <div style="width:${ukuran}px;height:${ukuran}px;display:grid;place-items:center">
      <img src="data:image/svg+xml;base64,${svg.toString('base64')}" style="width:${isi}px;height:${isi}px"></div></body></html>`)
  await page.waitForFunction(() => document.images[0].complete)
  return page.screenshot({ omitBackground: latar === 'transparent', clip: { x: 0, y: 0, width: ukuran, height: ukuran } })
}

/** ICO berisi PNG (didukung browser modern & Windows Vista+). */
function ico(gambar) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(gambar.length, 4)
  let offset = 6 + gambar.length * 16
  const entri = gambar.map(({ ukuran, data }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(ukuran >= 256 ? 0 : ukuran, 0)
    e.writeUInt8(ukuran >= 256 ? 0 : ukuran, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entri, ...gambar.map((g) => g.data)])
}

try {
  const kecil = []
  for (const ukuran of [16, 32, 48]) kecil.push({ ukuran, data: await render(ukuran) })
  const berkasIco = ico(kecil)
  writeFileSync(resolve(publik, 'favicon.ico'), berkasIco)
  if (existsSync(backendPublik)) writeFileSync(resolve(backendPublik, 'favicon.ico'), berkasIco)
  writeFileSync(resolve(publik, 'icon-192.png'), await render(192, { padding: 16 }))
  writeFileSync(resolve(publik, 'icon-512.png'), await render(512, { padding: 40 }))
  writeFileSync(resolve(publik, 'apple-touch-icon.png'), await render(180, { latar: '#ffffff', padding: 24 }))
  console.log('Ikon dibuat: favicon.ico (16/32/48), icon-192.png, icon-512.png, apple-touch-icon.png')
} finally {
  await browser.close()
}
