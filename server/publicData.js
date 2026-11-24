import { XMLParser } from 'fast-xml-parser'
import { accessibility, distance, nearbyCctv } from './environmentService.js'
import { fromPostOffice, buildAddress, supportedCode, nearbyReference } from './addressData.js'

const xml = new XMLParser({ parseTagValue:false, trimValues:true })
const monthCache = new Map()
const categories = ['SW8','CS2','MT1','HP8','PM9','SC4']
const list = value => value ? (Array.isArray(value) ? value : [value]) : []

async function request(url, headers) {
  let response
  try {
    response = await fetch(url, { headers, signal:AbortSignal.timeout(9500) })
  } catch {
    throw new Error('제공처에 연결하지 못했습니다. 잠시 후 다시 조회하세요.')
  }
  if ([401,403].includes(response.status)) throw new Error('제공처에서 인증 또는 이용 권한을 확인하지 못했습니다.')
  if (!response.ok) throw new Error('제공처 응답 오류 (' + response.status + ')')
  return response.text()
}

async function publicRows(service, params, key, size = 500) {
  if (!key) throw new Error('서버에 공공데이터 인증키가 설정되지 않았습니다.')
  const url = new URL('https://apis.data.go.kr/1613000/' + service)
  const rows = []
  // 데이터포털 키는 인코딩 형식과 일반 형식 모두 한 번만 인코딩한다.
  url.search = new URLSearchParams({ ...params, serviceKey:decodeURIComponent(key), numOfRows:size })
  for (let page=1; ; page++) {
    url.searchParams.set('pageNo',page)
    const raw = (await request(url)).trim()
    let payload
    try { payload = raw.startsWith('{') ? JSON.parse(raw) : xml.parse(raw) }
    catch { throw new Error('공공데이터 응답을 읽을 수 없습니다.') }
    const result = payload.response
    const code = String(result?.header?.resultCode ?? payload.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode ?? '')
    if (['03','3'].includes(code)) return rows
    if (!/^0+$/.test(code) || !result?.body) throw new Error('공공데이터 조회에 실패했습니다. 서비스 승인 상태를 확인하세요.' + (/^\d{1,3}$/.test(code) ? ' (' + code + ')' : ''))
    const items = list(result.body.items?.item)
    const total = Number(result.body.totalCount)
    rows.push(...items)
    if (!Number.isFinite(total) || total < 0) throw new Error('제공처의 전체 건수를 확인할 수 없습니다.')
    if (rows.length >= total) return rows
    if (!items.length || page >= 50) throw new Error('제공처 자료의 일부만 수신했습니다.')
  }
}

async function kakao(path, params) {
  if (!process.env.KAKAO_REST_KEY) throw new Error('서버에 카카오 REST 키가 설정되지 않았습니다.')
  const url = new URL('https://dapi.kakao.com/v2/local/' + path + '.json')
  url.search = new URLSearchParams(params)
  const data = JSON.parse(await request(url,{ Authorization:'KakaoAK ' + process.env.KAKAO_REST_KEY }))
  if (!Array.isArray(data.documents)) throw new Error('카카오 응답을 읽을 수 없습니다.')
  return data.documents
}

export async function resolveAddress(address) {
  const local = fromPostOffice(address)
  if (local?.ambiguous) {
    throw Object.assign(new Error('같은 주소가 여러 곳에 있습니다. 서북구 또는 동남구를 포함해 입력하세요.'),{ status:422 })
  }
  if (local?.coords) return local

  try {
    const docs = await kakao('search/address',{ query:local?.name || address,analyze_type:'exact' })
    const matches = docs.filter(d => {
      const a = d.address
      return a && supportedCode(a.b_code) && a.main_address_no && ['ROAD_ADDR','REGION_ADDR'].includes(d.address_type)
    })
    if (matches.length !== 1) {
      if (local) return local
      if (docs.length && !matches.length) throw Object.assign(new Error('천안 두정동·성정동·쌍용동·안서동의 주소를 입력하세요.'),{ status:422 })
      throw Object.assign(new Error('주소 한 곳을 찾을 수 없습니다. 도로명과 건물번호 또는 동과 지번을 확인하세요.'),{ status:422 })
    }
    const d=matches[0], a=d.address
    const lot=(a.mountain_yn === 'Y' ? '산' : '') + a.main_address_no + (a.sub_address_no ? '-'+a.sub_address_no : '')
    const road=d.road_address && [d.road_address.road_name,d.road_address.main_building_no+(d.road_address.sub_building_no ? '-'+d.road_address.sub_building_no:'')].join(' ')
    const result=buildAddress(a.b_code,lot,road)
    if (local && JSON.stringify(local.parcel)!==JSON.stringify(result.parcel)) return local
    const lat=Number(d.y),lon=Number(d.x)
    const coords=lat>=36.5 && lat<=37.1 && lon>=126.9 && lon<=127.5 ? {lat,lon,source:'카카오 주소 검색'} : null
    return local ? { ...local,coords } : { ...result,coords,source:'카카오 주소 검색' }
  } catch (err) {
    if (local) return local
    if (err.status) throw err
    throw Object.assign(new Error('등록된 시범 지역 주소를 찾지 못했습니다. 천안시의 구와 건물번호 또는 지번을 확인하세요. 카카오 주소 조회도 현재 연결되지 않았습니다.'),{ status:422 })
  }
}

const safeResult = async operation => {
  try { return { items:await operation() } }
  catch (err) { return { error:err.message } }
}

export async function getBuildings(parcel) {
  const titles = await publicRows('BldRgstHubService/getBrTitleInfo',{ ...parcel,_type:'json' },process.env.BUILDING_KEY,10)
  return { items:titles.map((t,i) => ({
    id:String(t.mgmBldrgstPk || i), name:[t.bldNm,t.dongNm].filter(Boolean).join(' ') || t.platPlc || '건물 ' + (i+1),
    purpose:t.mainPurpsCdNm, approved:t.useAprDay,
  })), checked:new Date().toISOString() }
}

async function readDeals(region, home, month) {
  const sources = { '단독·다가구':['SHRent',process.env.RENT_KEY],'연립·다세대':['RHRent',process.env.ROW_RENT_KEY],아파트:['AptRent',process.env.APT_RENT_KEY] }
  const [type,key] = sources[home]
  const rows = await publicRows('RTMSDataSvc' + type + '/getRTMSDataSvc' + type,{ LAWD_CD:region, DEAL_YMD:month },
    key)
  const num = s => s == null || String(s).trim() === '' ? NaN : Number(String(s).replaceAll(',',''))
  return rows.map(r => ({
    dong:r.umdNm?.trim(), area:num(r.excluUseAr ?? r.totalFloorAr), deposit:num(r.deposit), rent:num(r.monthlyRent),
    date:[r.dealYear, String(r.dealMonth).padStart(2,'0'),String(r.dealDay).padStart(2,'0')].join('-'),
  })).filter(r => [r.area,r.deposit,r.rent].every(Number.isFinite))
}

export async function loadDeals(region, home, month) {
  const id = [region,home,month].join('/')
  const cached = monthCache.get(id)
  if (cached && cached.until > Date.now()) return cached.data
  const data = readDeals(region,home,month)
  monthCache.set(id,{ data,until:Date.now()+3600000 })
  try { return await data } catch (e) { monthCache.delete(id); throw e }
}

export async function getEnvironment(lat, lon) {
  const places = Promise.all(categories.map(async code => {
    const result = await safeResult(async () => {
      const docs = await kakao('search/category',{ category_group_code:code, x:lon, y:lat, radius:500, sort:'distance', size:15 })
      return docs.map(d => ({ name:d.place_name, distance:Number(d.distance), lat:Number(d.y), lon:Number(d.x), url:d.place_url }))
    })
    return [code,result]
  }))
  const stopRequest = safeResult(async () => {
    const rows = await publicRows('BusSttnInfoInqireService/getCrdntPrxmtSttnList',{ gpsLati:lat, gpsLong:lon, _type:'json' },process.env.TAGO_KEY)
    return rows.map(r => ({ name:r.nodenm, lat:Number(r.gpslati), lon:Number(r.gpslong), distance:distance(lat,lon,Number(r.gpslati),Number(r.gpslong)) }))
      .filter(r => r.distance <= 500).sort((a,b) => a.distance-b.distance)
  })
  const [entries,stops] = await Promise.all([places,stopRequest])
  const groups = Object.fromEntries(entries)
  const reference = nearbyReference(lat,lon)
  return { groups,stops,reference,cctv:nearbyCctv(lat,lon),access:accessibility(groups,stops,reference),checked:new Date().toISOString() }
}

