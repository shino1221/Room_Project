export const districts = { 두정동: '44133', 성정동: '44133', 쌍용동: '44133', 안서동: '44131' }
export const regionOf = x => x.dong === '쌍용동' && x.region === '44131' ? '44131' : districts[x.dong]
export const homes = ['단독·다가구', '연립·다세대', '아파트']
export const riskItems = [
  ['owner', '임대 권한 불일치', '등기사항증명서의 소유자와 계약 상대방, 대리 계약이면 위임 서류를 대조한다.'],
  ['rights', '미해결 권리 문제', '등기사항증명서에서 압류·신탁 등 해소 여부를 확인한다.'],
  ['hug', '보증금 회수 우려', 'HUG 진단 또는 상담에서 받은 결과를 기록한다.'],
  ['violation', '위반건축물 표기', '정부24에서 해당 건축물대장 원문을 열어 위반 표기를 확인한다.'],
]

export function riskScore(records = {}) {
  const checked = riskItems.filter(([id]) => ['yes', 'no'].includes(records[id]?.value))
  const flags = checked.filter(([id]) => records[id].value === 'yes')
  return { score: checked.length === 4 ? flags.length * 25 : null, flags, remaining: 4 - checked.length }
}

export function cctvScore(cctv) {
  const nearest = cctv.points[0]?.distance ?? Infinity
  return nearest <= 100 ? 40 : nearest <= 300 ? 20 : 0
}

export function safetyScore(cctv, night = {}) {
  if (!cctv || !night.route?.trim() || !night.time || !['yes', 'no'].includes(night.dark) || !['yes', 'no'].includes(night.blocked)) return null
  return cctvScore(cctv) + (night.dark === 'no' ? 30 : 0) + (night.blocked === 'no' ? 30 : 0)
}

export function validListing(x) {
  const number = (v, min) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= min
  return Object.hasOwn(districts, x.dong) && homes.includes(x.home) && ['전세','월세'].includes(x.contract)
    && number(x.area, 0.01) && number(x.deposit, x.contract === '전세' ? 0.01 : 0)
    && (x.contract === '전세' || number(x.rent, 0.01))
}

export const formatNumber = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
export const amount = value => formatNumber(value) + '만 원'
export const dateLabel = s => s ? new Date(s).toLocaleDateString('ko-KR') : '미확인'
