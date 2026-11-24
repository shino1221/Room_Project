import { regionOf } from '../src/model.js'

export function recentMonths(count, now = new Date()) {
  const [year, month] = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(now).split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, month - i - 1, 1)).toISOString().slice(0, 7).replace('-', ''))
}

export function filterDeals(input, deals) {
  const inRange = (a, b) => a >= Number(b) * 0.8 - 1e-8 && a <= Number(b) * 1.2 + 1e-8
  return deals.filter(d => {
    if (d.dong !== input.dong || !inRange(d.area, input.area) || d.area <= 0) return false
    if (input.contract === '전세') return d.rent === 0 && d.deposit > 0
    return d.rent > 0 && inRange(d.deposit, input.deposit)
  })
}

export function priceScore(input, rows) {
  if (rows.length < 5) return { score: null }
  const key = input.contract === '월세' ? 'rent' : 'deposit'
  const units = rows.map(d => d[key] / d.area).sort((a,b) => a-b)
  const mid = Math.floor(units.length / 2)
  const median = units.length % 2 ? units[mid] : (units[mid - 1] + units[mid]) / 2
  const unit = Number(input[key]) / Number(input.area)
  const ratio = unit / median
  const score = [0.90, 0.95, 1.05, 1.10].reduce((points, limit) => points + (ratio <= limit + 1e-10 ? 20 : 0), 20)
  return { score, unit, median, ratio }
}

export async function getPrice(input, load) {
  const months = recentMonths(12)
  const rows = []
  let used = 0
  // 시군구·주택 유형별 월 자료를 공유하고, 최근 6개월 표본이 부족할 때만 더 읽는다.
  while (used < 12) {
    for (let i = used; i < used + 6; i += 3) {
      const batch = await Promise.all(months.slice(i,i + 3).map(m => load(regionOf(input), input.home, m)))
      rows.push(...filterDeals(input, batch.flat()))
    }
    used += 6
    if (rows.length >= 5) break
  }
  rows.sort((a,b) => b.date.localeCompare(a.date))
  return { ...priceScore(input, rows), rows, count: rows.length, months: used, from: months[used-1], to: months[0], checked: new Date().toISOString() }
}

