/**
 * Algolia Search Engine untuk Menu, Modul, Aksi Cepat & Navigasi E-Klinik.
 * Menyediakan Algolia-style fuzzy matching, typo tolerance (Damerau-Levenshtein),
 * multi-token search, ranking relevance, text highlighting, dan recent searches history.
 */

const STORAGE_KEY = 'eklinik_algolia_recent_searches'
const MAX_RECENTS = 5

/**
 * Normalisasi string: lowercase, hilangkan tanda aksen/diakritik, trim.
 */
export function normalizeText(str) {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Hitung jarak edit Damerau-Levenshtein (mendukung typo transposisi karakter).
 */
export function damerauLevenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const d = []
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i]
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost) // transposition
      }
    }
  }
  return d[a.length][b.length]
}

/**
 * Menghitung skor kemiripan antara token pencarian dengan sebuah kata/teks target.
 */
function matchWord(token, word) {
  if (!token || !word) return 0
  if (token === word) return 150
  if (word.startsWith(token)) return 100 + Math.round((token.length / word.length) * 20)
  if (word.includes(token)) return 65

  // Typo tolerance ala Algolia:
  // Panjang 1-3: tanpa typo
  // Panjang 4-6: toleransi 1 typo
  // Panjang >= 7: toleransi 2 typo
  const tLen = token.length
  if (tLen >= 4) {
    const dist = damerauLevenshtein(token, word.slice(0, Math.min(word.length, tLen + 1)))
    if (dist <= 1) {
      return 50 - dist * 10
    }
    if (tLen >= 7 && dist <= 2) {
      return 35 - dist * 10
    }
  }
  return 0
}

/**
 * Menghitung skor relevansi item terhadap seluruh query tokens.
 * Algolia semantics: semua token query harus cocok di salah satu atribut.
 */
export function scoreItem(item, tokens) {
  if (!tokens || !tokens.length) return 1

  const labelNorm = normalizeText(item.label)
  const labelWords = labelNorm.split(/[\s&/.,_-]+/).filter(Boolean)
  const categoryNorm = normalizeText(item.category || item.group || '')
  const descNorm = normalizeText(item.description || item.hint || '')
  const keywordsNorm = (item.keywords || []).map(normalizeText)

  let totalScore = 0

  for (const token of tokens) {
    let tokenBestScore = 0

    // 1. Cek Exact atau Prefix pada Label keseluruhan
    if (labelNorm === token) {
      tokenBestScore = Math.max(tokenBestScore, 200)
    } else if (labelNorm.startsWith(token)) {
      tokenBestScore = Math.max(tokenBestScore, 140)
    }

    // 2. Cek setiap kata di Label
    for (const w of labelWords) {
      const s = matchWord(token, w)
      if (s > 0) {
        tokenBestScore = Math.max(tokenBestScore, s * 1.3)
      }
    }

    // 3. Cek Kata Kunci (Keywords & Synonyms)
    for (const kw of keywordsNorm) {
      if (kw === token) {
        tokenBestScore = Math.max(tokenBestScore, 120)
      } else if (kw.startsWith(token)) {
        tokenBestScore = Math.max(tokenBestScore, 90)
      } else if (kw.includes(token)) {
        tokenBestScore = Math.max(tokenBestScore, 60)
      } else if (token.length >= 4) {
        const kwWords = kw.split(/[\s&/.,_-]+/).filter(Boolean)
        for (const kwWord of kwWords) {
          const s = matchWord(token, kwWord)
          if (s > 0) tokenBestScore = Math.max(tokenBestScore, s)
        }
      }
    }

    // 4. Cek Kategori / Modul
    if (categoryNorm) {
      if (categoryNorm === token) {
        tokenBestScore = Math.max(tokenBestScore, 95)
      } else if (categoryNorm.startsWith(token)) {
        tokenBestScore = Math.max(tokenBestScore, 75)
      } else if (categoryNorm.includes(token)) {
        tokenBestScore = Math.max(tokenBestScore, 50)
      }
    }

    // 5. Cek Deskripsi
    if (descNorm && descNorm.includes(token)) {
      tokenBestScore = Math.max(tokenBestScore, 40)
    }

    // Jika ada satu token yang sama sekali tidak cocok, gugurkan item (AND search)
    if (tokenBestScore === 0) {
      return 0
    }

    totalScore += tokenBestScore
  }

  return totalScore
}

/**
 * Filter dan urutkan list berdasarkan algoritma relevansi Algolia.
 */
export function algoliaRank(list, query) {
  const normQuery = normalizeText(query)
  if (!normQuery) return list

  const tokens = normQuery.split(/\s+/).filter(Boolean)
  if (!tokens.length) return list

  return list
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

/**
 * Pecah teks menjadi segmen { text, isMatch } untuk highlight pencarian Algolia
 * tanpa menggunakan v-html (aman dari XSS).
 */
export function highlightSegments(text, query) {
  if (!text) return []
  const normQuery = normalizeText(query)
  if (!normQuery) return [{ text, isMatch: false }]

  const tokens = normQuery.split(/\s+/).filter(Boolean)
  if (!tokens.length) return [{ text, isMatch: false }]

  const lower = normalizeText(text)
  const mask = new Array(text.length).fill(false)

  for (const token of tokens) {
    if (!token) continue
    let pos = 0
    while ((pos = lower.indexOf(token, pos)) !== -1) {
      for (let i = pos; i < pos + token.length && i < mask.length; i++) {
        mask[i] = true
      }
      pos += token.length
    }
  }

  // Gabungkan karakter berdasarkan mask
  const segments = []
  for (let i = 0; i < text.length; i++) {
    const isHit = mask[i]
    if (segments.length && segments[segments.length - 1].isMatch === isHit) {
      segments[segments.length - 1].text += text[i]
    } else {
      segments.push({ text: text[i], isMatch: isHit })
    }
  }

  return segments
}

/* ================== Recent Searches Storage ================== */

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

export function saveRecentSearch(item) {
  if (!item || !item.id) return
  try {
    const list = getRecentSearches()
    const filtered = list.filter((r) => r.id !== item.id)
    // Simpan data esensial saja
    const cleanItem = {
      id: item.id,
      label: item.label,
      category: item.category || item.group || 'Menu',
      description: item.description || item.hint || '',
      to: item.to,
      action: item.action,
      kind: item.kind,
      icon: item.icon,
    }
    const updated = [cleanItem, ...filtered].slice(0, MAX_RECENTS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage quota errors
  }
}

export function removeRecentSearch(id) {
  try {
    const list = getRecentSearches()
    const updated = list.filter((r) => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}
