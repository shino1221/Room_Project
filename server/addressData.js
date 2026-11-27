import { readFileSync } from 'node:fs'
import { distance } from './environmentService.js'

const read = file => JSON.parse(readFileSync(new URL('./data/'+file,import.meta.url),'utf8'))
const addresses = read('addresses.json')
const osm = read('osm-reference.json')
const byAddress = new Map()
const osmByRoad = new Map()
const districts = { '4413310400':'두정동','4413310200':'성정동','4413310700':'쌍용동','4413111700':'쌍용동','4413111900':'안서동' }
const wardOf = code => code.startsWith('44133') ? '서북구' : '동남구'
const keyOf = text => text.normalize('NFC').replace(/\s+/g,'').replace(/번지$/,'')

for (const entry of addresses.rows) {
  const [road,code,lot] = entry
  for (const key of new Set([keyOf(road),keyOf(districts[code]+' '+lot)])) {
    const rows = byAddress.get(key) || []
    rows.push(entry)
    byAddress.set(key,rows)
  }
}
for (const row of osm.addresses) {
  const road = keyOf(row[0])
  const group = osmByRoad.get(road) || []
  group.push(row)
  osmByRoad.set(road,group)
}

export function fromPostOffice(input) {
  const text = input.normalize('NFC').trim()
  const ward = text.match(/(?:^|\s|천안시)(서북구|동남구)(?=\s|[가-힣])/)?.[1]
  const dong = text.match(/\(([가-힣0-9]+(?:동|읍|면))(?:[\s,)]|$)/)?.[1]
  const short = text.replace(/\s*\([^)]*\)\s*$/,'')
      .replace(/^(?:충청남도|충남)\s*/,'').replace(/^천안시?\s*/,'')
      .replace(/^(?:서북구|동남구)\s*/,'').trim()
  const rows = (byAddress.get(keyOf(short)) || [])
      .filter(([,code]) => (!ward || wardOf(code)===ward) && (!dong || districts[code]===dong))
  if (!rows.length) return null
  const parcels = new Set(rows.map(([,code,lot]) => code+' '+lot))
  if (parcels.size > 1) return { ambiguous:true }
  const [road,code,lot] = rows[0]
  const roadAddress = rows.every(row => row[0]===road) ? road : ''
  const roadPoints = (osmByRoad.get(keyOf(roadAddress)) || []).filter(([,gu,dong]) => (!gu || gu===wardOf(code)) && (!dong || dong===districts[code]))
  const [, , , lat,lon] = roadPoints[0] || []
  const nearby = roadPoints.every(([, , , y,x]) => distance(lat,lon,y,x) <= 80)
  const coords = lat && lon && nearby ? { lat,lon,source:'OpenStreetMap' } : null
  return { ...buildAddress(code,lot,roadAddress),coords,source:addresses.source,sourceDate:addresses.date }
}

export function buildAddress(code,lot,road,dongName) {
  const dong = dongName || districts[code] || ''
  const [bun,ji='0'] = lot.replace(/^산\s*/,'').split('-')
  const prefix = '충남 천안시 '+wardOf(code)+' '
  const jibunPart = [dong, lot].filter(Boolean).join(' ')
  return {
    name:prefix+(road || jibunPart), jibun:prefix+jibunPart, dong, region:code.slice(0,5),
    parcel:{ sigunguCd:code.slice(0,5),bjdongCd:code.slice(5),platGbCd:lot.startsWith('산') ? '1':'0',bun:bun.padStart(4,'0'),ji:ji.padStart(4,'0') },
  }
}

export function supportedCode(code) {
  return typeof code === 'string' && (code.startsWith('44131') || code.startsWith('44133'))
}

export function nearbyReference(lat,lon) {
  const [minLat,maxLat,minLon,maxLon] = osm.bounds
  if (lat<minLat || lat>maxLat || lon<minLon || lon>maxLon) return {}
  const groups = {}
  for (const [kind,name,y,x] of osm.places) {
    const meters = distance(lat,lon,y,x)
    if (meters > 500) continue
        ;(groups[kind] ||= []).push({name,distance:meters})
  }
  for (const group of Object.values(groups)) group.sort((a,b) => a.distance-b.distance)
  return groups
}
