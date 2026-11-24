import { useEffect, useState } from 'react'
import { ArrowUpRight, Building2, CircleCheck, ClipboardCheck, MapPin, TriangleAlert } from 'lucide-react'
import { api } from './api.js'
import { amount, cctvScore, dateLabel, formatNumber, homes, riskItems, riskScore, safetyScore } from './model.js'

const namedPlaces = { SW8:'전철역',BUS:'버스정류장',CS2:'편의점',MT1:'대형마트',HP8:'병원',PM9:'약국',SC4:'학교' }
const approvalDate = value => String(value || '').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1.$2.$3') || '미확인'

function useResult(path, body) {
  const [result,setResult] = useState(null)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    api(path,body,controller.signal).then(value => {
      if (!controller.signal.aborted) setResult({ path,body,value })
    }).catch(err => {
      if (!controller.signal.aborted) setResult({ path,body,error:err.message })
    })
    return () => controller.abort()
  },[path,body])
  return result?.path===path && result.body===body ? result : {}
}

function Panel({ id,title,children,meta }) {
  return <section className="result-panel" id={id}>
    <div className="section-heading panel-heading"><h3>{title}</h3>{meta && <small>{meta}</small>}</div>
    {children}
  </section>
}

function Price({ submitted, submit, result, lookup }) {
  const [contract,setContract] = useState('월세')
  const report = result.value
  function run(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    submit({ ...data,rent:contract==='전세' ? 0 : data.rent,dong:lookup.dong,region:lookup.region })
  }
  return <Panel id="price" title="가격 경쟁력" meta="국토교통부 실거래가">
    <p className="panel-copy">매물에 나온 계약 조건을 입력하면 같은 동의 유사 거래와 비교합니다.</p>
    <form className="conditions" onSubmit={run}>
      <div className="field-grid">
        <label>계약 유형<select name="contract" value={contract} onChange={e => setContract(e.target.value)}><option>월세</option><option>전세</option></select></label>
        <label>주택 유형<select name="home">{homes.map(home => <option key={home}>{home}</option>)}</select></label>
        <label>전용면적 (㎡)<input type="number" name="area" min="0.01" step="any" required placeholder="예) 25"/></label>
        <label>보증금 (만 원)<input type="number" name="deposit" min={contract==='전세' ? '0.01':'0'} step="any" required placeholder="예) 500"/></label>
        {contract==='월세' && <label>월세 (만 원)<input type="number" name="rent" min="0.01" step="any" required placeholder="예) 45"/></label>}
      </div>
      <button className="secondary" type="submit">가격 점수 계산</button>
    </form>
    {submitted && <p className={result.error ? 'notice error':'notice'} role="status">
      {result.error || (!report ? '유사 실거래를 조회하고 있습니다.'
        : report.score==null ? '최근 '+report.months+'개월 유사 거래 '+report.count+'건 · 5건부터 점수를 계산합니다.'
        : '유사 거래 '+report.count+'건 · '+submitted.contract+' ㎡당 중앙값 '+amount(report.median)+' · 이 집은 중앙값의 '+formatNumber(report.ratio*100)+'%')}
    </p>}
    {report?.rows.length>0 && <details className="detail"><summary>비교한 실거래 보기</summary><div className="table-wrap"><table>
      <thead><tr><th>계약일</th><th>전용면적</th><th>보증금</th><th>월세</th></tr></thead>
      <tbody>{report.rows.slice(0,15).map((row,i) => <tr key={i}><td>{row.date}</td><td>{row.area}㎡</td><td>{amount(row.deposit)}</td><td>{amount(row.rent)}</td></tr>)}</tbody>
    </table></div>{report.count>15 && <small>최근 거래 15건 표시</small>}</details>}
  </Panel>
}

function Contract({ building,records,setRecords,risk }) {
  const [buildingId,setBuildingId] = useState('')
  const rows = building.value?.items || []
  const selected = rows.find(b => b.id===buildingId) || (rows.length===1 ? rows[0] : null)
  return <Panel id="contract" title="건물·계약 점검" meta="건축HUB · 정부24 · HUG">
    <div className="evidence"><h4><Building2 size={16}/> 건축물대장</h4>
      {!building.value ? <p role="status">{building.error || '건물 정보를 조회하고 있습니다.'}</p>
        : !rows.length ? <p>해당 지번에서 조회된 대장 자료가 없습니다.</p> : <>
          {rows.length>1 && <label>확인할 건물<select value={buildingId} onChange={e => { setBuildingId(e.target.value); setRecords(({violation:_violation,...rest}) => rest) }}>
            <option value="">건물을 선택하세요</option>{rows.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>}
          {selected && <><dl><div><dt>건물 주용도</dt><dd>{selected.purpose || '미확인'}</dd></div><div><dt>사용승인일</dt><dd>{approvalDate(selected.approved)}</dd></div></dl>
          <small>호실 용도와 위반 표기는 대장 원문에서 확인하세요.</small></>}
        </>}
    </div>
    <p className="panel-copy">서류에서 확인한 결과를 선택하세요. 위험 신호마다 25점이며 높을수록 주의가 필요합니다.</p>
    {risk.flags.length>0 && <p className="notice error" role="status"><TriangleAlert size={16}/> 확인된 신호 · {risk.flags.map(([,name]) => name).join(', ')}</p>}
    <div className="checks">
      {riskItems.map(([id,name,description]) => <label key={id}>
        <span><strong>{name}</strong><small>{description}</small></span>
        <select aria-label={name} value={records[id]?.value || ''} onChange={e => setRecords({ ...records,[id]:{ value:e.target.value } })}>
          <option value="">미확인</option><option value="no">위험 신호 없음</option><option value="yes">위험 신호 발견</option>
        </select>
      </label>)}
    </div>
    <div className="links">
      <a href="https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098" target="_blank" rel="noreferrer">건축물대장 원문 <ArrowUpRight size={13}/></a>
      <a href="https://www.iros.go.kr/" target="_blank" rel="noreferrer">인터넷등기소 <ArrowUpRight size={13}/></a>
      <a href="https://www.khug.or.kr/" target="_blank" rel="noreferrer">HUG <ArrowUpRight size={13}/></a>
    </div>
  </Panel>
}

function Access({ env,coords }) {
  return <Panel id="access" title="생활 접근성" meta="직선거리 500m 기준">
    {!env.value ? <p className="notice" role="status">{env.error || (coords ? '주변 시설을 조회하고 있습니다.':'이 주소의 좌표 자료가 없어 주변 거리를 확인할 수 없습니다.')}</p> : <>
      {env.value.access.score==null && <p className="panel-copy">일부 자료를 받지 못했습니다. 공개 지도에서 확인되는 시설도 함께 표시합니다.</p>}
      <dl className="place-rows">
        {Object.entries(namedPlaces).map(([kind,name]) => {
          const live = kind==='BUS' ? env.value.stops : env.value.groups[kind]
          const first = (live.items ?? env.value.reference[kind])?.[0]
          return <div key={kind}><dt>{name}</dt><dd>{first ? <>{first.name}<small>{Math.round(first.distance)}m · {live.items ? kind==='BUS' ? 'TAGO':'카카오':'OpenStreetMap'}</small></>
            : live.items ? '500m 안에 조회된 시설 없음':'자료 미확인'}</dd></div>
        })}
      </dl>
      <small>거리 기준 · {coords.source}</small>
    </>}
  </Panel>
}

function Night({ env,coords,night,setNight }) {
  const cctv = env.value?.cctv
  const nearest = cctv?.points[0]
  const date = nearest?.date || cctv?.date
  const cctvStatus = env.value ? 'CCTV 자료를 읽을 수 없습니다.' : coords
    ? 'CCTV 거리를 확인하고 있습니다.' : '주소 좌표를 확인할 수 없어 CCTV 거리를 보류합니다.'
  const change = e => setNight({ ...night,[e.target.name]:e.target.value })
  return <Panel id="night" title="귀갓길 환경" meta="CCTV · 야간 방문">
    {cctv ? <p className="notice">{nearest ? '가장 가까운 생활방범 CCTV 약 '+Math.round(nearest.distance)+'m':'자료상 300m 이내 생활방범 CCTV 0곳'} <span className="inline-point">{cctvScore(cctv)}/40점</span><small>{cctv.source}{date && ' · '+date+' 기준'}</small></p>
      : <p className="notice">{env.error || cctvStatus}</p>}
    <p className="panel-copy">밤에 직접 걸어본 경로와 현장 상태를 입력하면 귀갓길 점수를 계산합니다.</p>
    <div className="field-grid night-form">
      <label>걸어본 경로<input name="route" type="text" maxLength={120} placeholder="예) 두정역에서 건물까지" value={night.route || ''} onChange={change}/></label>
      <label>방문 시각<input name="time" type="datetime-local" value={night.time || ''} onChange={change}/></label>
      {[['dark','어두운 구간'],['blocked','시야가 가려진 구간']].map(([id,label]) => <label key={id}>{label}
        <select name={id} value={night[id] || ''} onChange={change}><option value="">미확인</option><option value="no">없음</option><option value="yes">있음</option></select>
      </label>)}
    </div>
  </Panel>
}

export default function Inspection({ lookup,criteria }) {
  const [submitted,submit] = useState(null)
  const [records,setRecords] = useState({})
  const [night,setNight] = useState({})
  const { coords } = lookup
  const building = useResult('building',lookup.parcel)
  const env = useResult(coords ? 'environment?lat='+coords.lat+'&lon='+coords.lon : null)
  const price = useResult(submitted ? 'price':null,submitted)
  const risk = riskScore(records)
  const nearby = env.value
  const scores = [price.value?.score,risk.score,nearby?.access.score,safetyScore(nearby?.cctv,night)]
  const details = [
    price.value ? '유사 거래 '+price.value.count+'건' : price.error ? '실거래 조회 실패' : submitted ? '실거래 조회 중' : '계약 조건 입력 필요',
    risk.remaining ? risk.flags.length+'개 발견 · '+risk.remaining+'개 미확인' : risk.flags.length+'개 발견 · 높을수록 주의',
    nearby && nearby.access.score==null ? '일부 시설 자료 미확인'
      : nearby?.access.score!=null ? '교통 '+nearby.access.transport+'점 · 생활시설 '+nearby.access.daily+'점'
      : env.error ? '주변 자료 조회 실패' : coords ? '주변 시설 확인 중' : '좌표 자료 미확인',
    nearby?.cctv && scores[3]==null ? 'CCTV 배점 · 야간 확인 필요'
      : scores[3]!=null ? 'CCTV와 야간 방문 기록 반영'
      : env.error || nearby ? 'CCTV 조회 실패' : coords ? 'CCTV 확인 중' : '좌표 자료 미확인',
  ]
  const partial = [null,null,nearby?.access.observed ? nearby.access.observed+'점 확인' : null,
    nearby?.cctv ? cctvScore(nearby.cctv)+'/40점' : null]
  return <>
    <div className="result-address">
      <div>
        <span className="status-label"><CircleCheck size={15}/> 주소 확인</span>
        <h2>{lookup.name}</h2>
        {lookup.jibun!==lookup.name && <p><MapPin size={15}/>{lookup.jibun}</p>}
      </div>
      <small>{lookup.source}{lookup.sourceDate && <><br/>{dateLabel(lookup.sourceDate)} 기준</>}</small>
    </div>
    <div className="section-heading score-heading"><h2>항목별 점검 결과</h2><small>100점 기준</small></div>
    <div className="score-grid" aria-label="점검 점수">
      {criteria.map(({id,title,icon:Icon},i) => <a href={'#'+id} className="score-card" key={id}>
        <span className="tile-icon"><Icon size={19}/></span><span>{title}</span>
        <strong className={scores[i]==null && !partial[i] ? 'pending':''}>{scores[i]==null ? partial[i] || '점수 보류' : scores[i]+'점'}</strong>
        <small>{details[i]}</small><ArrowUpRight size={15} className="score-arrow"/>
      </a>)}
    </div>
    <div className="report-panels">
      <Price submitted={submitted} submit={submit} result={price} lookup={lookup}/>
      <Contract building={building} records={records} setRecords={setRecords} risk={risk}/>
      <Access env={env} coords={coords}/>
      <Night env={env} coords={coords} night={night} setNight={setNight}/>
    </div>
    <div className="attribution"><ClipboardCheck size={14}/> 조회 자료 및 입력한 확인 결과 기준 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 기여자</a></div>
  </>
}

