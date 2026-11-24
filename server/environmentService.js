import { readFileSync } from 'node:fs'

const cctvFile = new URL('../asset/CCTV정보_충남천안시.csv', import.meta.url)

function csvRows(csv) {
  const rows = [[]]
  // 인용부호 안의 쉼표와 줄바꿈은 필드 값으로 읽는다.
  for (const [, separator, quoted, plain] of (',' + csv).matchAll(/(,|\r\n?|\n)(?:"((?:[^"]|"")*)"|([^",\r\n]*))/g)) {
    if (separator !== ',') rows.push([])
    rows.at(-1).push((quoted?.replaceAll('""', '"') ?? plain).trim())
  }
  return rows
}

function loadCctv() {
  try {
    const bytes = readFileSync(cctvFile)
    // 원본은 CP949이며 UTF-8로 저장한 교체 파일도 읽는다.
    let csv
    try { csv = new TextDecoder('utf-8', { fatal:true }).decode(bytes) }
    catch { csv = new TextDecoder('euc-kr').decode(bytes) }

    const [header, ...rows] = csvRows(csv)
    const [purposeColumn, latColumn, lonColumn, dateColumn] =
      ['설치목적구분', 'WGS84위도', 'WGS84경도', '데이터기준일자'].map(name => header.indexOf(name))
    if ([purposeColumn, latColumn, lonColumn, dateColumn].includes(-1)) throw new Error('필수 열이 없습니다.')

    const locations = new Map()
    let latestDate = ''
    for (const row of rows) {
      if (row[purposeColumn] !== '생활방범') continue

      const lat = Number(row[latColumn])
      const lon = Number(row[lonColumn])
      if (!(lat >= 36.5 && lat <= 37.1 && lon >= 126.9 && lon <= 127.5)) continue

      const date = /^\d{4}-\d{2}-\d{2}$/.test(row[dateColumn]) ? row[dateColumn] : ''
      const key = `${lat},${lon}`
      const existing = locations.get(key)
      if (!existing || date > existing.date) locations.set(key, { lat, lon, date })
      if (date > latestDate) latestDate = date
    }
    if (!locations.size) throw new Error('생활방범 CCTV 좌표가 없습니다.')

    return { points:[...locations.values()], date:latestDate, source:'천안시 생활방범 CCTV' }
  } catch (error) {
    console.warn('천안시 CCTV 자료를 읽을 수 없습니다.', error.message)
    return null
  }
}

const dataset = loadCctv()

export function distance(lat, lon, y, x) {
  const rad = Math.PI / 180
  const h = Math.sin((y-lat)*rad/2)**2 + Math.cos(lat*rad)*Math.cos(y*rad)*Math.sin((x-lon)*rad/2)**2
  return 6371000 * 2 * Math.asin(Math.sqrt(h))
}

export function nearbyCctv(lat, lon) {
  if (!dataset) return null

  const points = []
  for (const point of dataset.points) {
    const meters = distance(lat,lon,point.lat,point.lon)
    if (meters <= 300) points.push({ ...point, distance:meters })
  }
  points.sort((a,b) => a.distance-b.distance)
  return { points, date:dataset.date, source:dataset.source }
}

export function accessibility(groups, stops, reference = {}) {
  const dailyCodes = ['CS2','MT1','HP8','PM9']
  const sources = code => groups[code]?.items ?? reference[code] ?? []
  const nearest = (stops.items ?? reference.BUS)?.[0]?.distance ?? Infinity
  const transport = sources('SW8').length ? 60 : nearest <= 300 ? 40 : nearest <= 500 ? 20 : 0
  const daily = dailyCodes.filter(code => sources(code).length).length * 10
  const officialTransit = groups.SW8?.items?.length || (groups.SW8?.items && stops.items)
  const complete = officialTransit && dailyCodes.every(code => groups[code]?.items)
  // 공개 지도에서 확인된 지점은 점수의 하한 근거로만 쓴다.
  return { score:complete ? transport+daily : null, observed:transport+daily, transport,daily }
}

