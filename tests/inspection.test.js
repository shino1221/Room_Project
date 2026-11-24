import test from 'node:test'
import assert from 'node:assert/strict'
import { fromPostOffice, nearbyReference } from '../server/addressData.js'
import { accessibility, nearbyCctv } from '../server/environmentService.js'
import { getPrice, priceScore } from '../server/priceService.js'
import { cctvScore, riskScore, safetyScore } from '../src/model.js'

test('도로명과 지번은 같은 건축물대장 주소로 연결된다', () => {
  const road = fromPostOffice('충남 천안시 서북구 두정로 146 (두정동)')
  const lot = fromPostOffice('두정동698번지')
  assert.equal(road.name,lot.name)
  assert.deepEqual(road.parcel,{ sigunguCd:'44133',bjdongCd:'10400',platGbCd:'0',bun:'0698',ji:'0000' })
  assert.equal(fromPostOffice('천안시 동남구 두정로 146'),null)
  assert.equal(fromPostOffice('서울 반포대로 58'),null)
})

test('주소는 확인되고 좌표가 없는 경우 거리를 계산하지 않는다', () => {
  assert.equal(fromPostOffice('안서동 115').coords,null)
})

test('공개 지도 지점은 확인된 배점만 제공한다', () => {
  const { coords } = fromPostOffice('두정로 146')
  const reference = nearbyReference(coords.lat,coords.lon)
  const result = accessibility({}, {}, reference)
  assert.equal(result.score,null)
  assert.equal(result.observed,60)
})

test('시설 조회 결과 0건은 조회 실패와 구분한다', () => {
  const groups=Object.fromEntries(['SW8','CS2','MT1','HP8','PM9'].map(code=>[code,{items:[]}]))
  assert.equal(accessibility(groups,{items:[]}).score,0)
  assert.equal(accessibility(groups,{error:'미확인'}).score,null)
  groups.SW8.items=[{name:'역',distance:400}]
  assert.equal(accessibility(groups,{error:'미확인'}).score,60)
})

test('CCTV 배점은 별도로 계산하고 야간 기록을 입력하면 합산한다', () => {
  const { coords } = fromPostOffice('두정로 146')
  const cameras = nearbyCctv(coords.lat,coords.lon)
  assert.equal(cctvScore(cameras),40)
  assert.equal(safetyScore(cameras,{}),null)
  assert.equal(safetyScore(cameras,{route:'귀갓길',time:'2026-11-24T21:00',dark:'no',blocked:'yes'}),70)
})

test('확인된 계약 위험은 점수를 보류한 상태에서도 표시한다', () => {
  const risk = { owner:{value:'yes'},rights:{value:'no'},hug:{value:'no'} }
  assert.equal(riskScore(risk).flags.length,1)
  assert.equal(riskScore(risk).score,null)
  assert.equal(riskScore({ ...risk,violation:{value:'no'} }).score,25)
})

test('유사 거래 5건을 확보할 때 가격 점수를 계산한다', async () => {
  const x = { dong:'두정동',home:'단독·다가구',contract:'월세',area:25,deposit:500,rent:45 }
  const row = { dong:'두정동',area:25,deposit:500,rent:50,date:'2026-11-14' }
  let n=0
  const result=await getPrice(x,async () => ++n<=4 || n===7 ? [row] : [])
  assert.equal(result.months,12)
  assert.equal(result.count,5)
  assert.equal(result.score,100)
  assert.equal(priceScore(x,Array(4).fill(row)).score,null)
})

