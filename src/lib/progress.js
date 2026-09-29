import { reactive } from 'vue'

/**
 * Status progress bar global (tanpa library). Aktif selama ada request API atau navigasi halaman
 * (termasuk download chunk halaman lazy). Ditunda sebentar agar request cepat tidak membuat bar berkedip.
 */
export const progress = reactive({ visible: false, width: 0 })

const SHOW_DELAY = 150
let requests = 0
let navigating = false
let showTimer = null
let trickleTimer = null
let hideTimer = null

function show() {
  if (showTimer || progress.visible) return
  clearTimeout(hideTimer)
  showTimer = setTimeout(() => {
    showTimer = null
    progress.visible = true
    progress.width = 15
    trickleTimer = setInterval(() => (progress.width += (90 - progress.width) * 0.1), 200)
  }, SHOW_DELAY)
}

function hide() {
  clearTimeout(showTimer)
  showTimer = null
  clearInterval(trickleTimer)
  if (!progress.visible) return
  progress.width = 100
  hideTimer = setTimeout(() => {
    progress.visible = false
    progress.width = 0
  }, 250)
}

const update = () => (requests > 0 || navigating ? show() : hide())

export function requestStart() {
  requests++
  update()
}

export function requestDone() {
  requests = Math.max(0, requests - 1)
  update()
}

export function setNavigating(value) {
  navigating = value
  update()
}
