import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BadgeCheck, BarChart3, CircleHelp, House, MapPin, Moon, Search, ShieldCheck, TrainFront, X } from 'lucide-react'
import { api } from './api.js'
import Inspection from './Inspection.jsx'

const criteria = [
  { id:'price',title:'가격 경쟁력',icon:BarChart3,short:'같은 동의 유사 실거래와 비교',detail:'같은 법정동·주택 유형·계약 방식에서 면적이 ±20%인 거래를 비교합니다. 월세는 보증금도 ±20%로 맞춥니다. 최근 6개월에 거래가 5건 미만이면 12개월로 넓힙니다. ㎡당 가격이 거래 중앙값의 90%·95%·105%·110% 이하일 때 순서대로 100·80·60·40점, 110%를 넘으면 20점입니다.' },
  { id:'contract',title:'계약 위험 신호',icon:ShieldCheck,short:'건축물대장과 보증금 관련 서류 확인',detail:'임대 권한 불일치, 미해결 권리 문제, HUG 상담에서 확인한 보증금 회수 우려, 위반건축물 표기를 확인합니다. 각 신호는 25점입니다. 확인할 서류가 남아 있으면 합계를 보류합니다.' },
  { id:'access',title:'생활 접근성',icon:TrainFront,short:'전철역·정류장·생활시설까지의 거리',detail:'500m 안 전철역은 60점입니다. 전철역이 없으면 버스정류장 거리에 따라 40점(300m 이내), 20점(500m 이내)을 줍니다. 편의점·대형마트·병원·약국은 각각 500m 안에 있으면 10점입니다.' },
  { id:'night',title:'귀갓길 환경',icon:Moon,short:'생활방범 CCTV와 야간 현장 확인',detail:'생활방범 CCTV가 100m 이내이면 40점, 300m 이내이면 20점입니다. 야간 방문에서 어두운 구간이 없으면 30점, 시야가 가려지는 구간이 없으면 30점입니다.' },
]

export default function App() {
  const [address,setAddress] = useState('')
  const [lookup,setLookup] = useState(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const request = useRef(null), dialog = useRef(null), results = useRef(null)
  useEffect(() => () => request.current?.abort(),[])
  async function check(e) {
    e.preventDefault()
    const value = address.trim()
    if (!value) {
      setError('도로명주소 또는 지번을 입력하세요.')
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setLookup(null)
    try {
      setLookup(await api('address',{address:value},controller.signal))
      requestAnimationFrame(() => results.current?.focus({preventScroll:true}))
    } catch(err) {
      if (!controller.signal.aborted) setError(err.message)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return <>
    <header className="site-header" id="top"><div className="shell site-bar">
      <a className="brand" href="./"><span className="brand-mark"><House size={19}/></span>안방</a>
      <button className="criterion-link" onClick={() => dialog.current.showModal()}><CircleHelp size={17}/> 점검 기준</button>
    </div></header>
    <main>
      <section className={'hero'+(lookup ? ' compact':'')}><div className="shell hero-layout">
        <div className="hero-copy" hidden={Boolean(lookup)}>
          <span className="region-label"><MapPin size={15}/> 천안 전월세 점검</span>
          <h1>계약 전,<br/>주소부터 점검.</h1>
          <p>찾아둔 집의 주소를 입력하세요.<br className="desktop-break"/> 시세와 계약, 주변 환경을 한곳에서 살펴볼 수 있습니다.</p>
        </div>
        {!lookup && <div className="door-art" aria-hidden="true"><div className="wood-frame"><div className="door-leaf"><div className="door-window"/><i/></div></div><div className="door-shadow"/></div>}
        <div className="address-area">
          <form onSubmit={check} className="address-form">
            <label htmlFor="address">매물 주소</label>
            <div className={'address-input'+(error ? ' invalid':'')}>
              <MapPin size={21}/>
              <input id="address" type="search" autoComplete="off" maxLength={150} value={address} onChange={e => { setAddress(e.target.value); if (error) setError('') }} placeholder="예) 천안시 서북구 두정로 146" aria-describedby={error ? 'lookup-error':'address-hint'}/>
              <button className="primary" type="submit" disabled={loading}><Search size={17}/>{loading ? '주소 확인 중':'주소 점검'}</button>
            </div>
          </form>
          {error ? <p className="lookup-error" id="lookup-error" role="alert">{error}</p> : <p className="coverage" id="address-hint">두정동 · 성정동 · 쌍용동 · 안서동</p>}
        </div>
      </div></section>
      {lookup ? <section className="shell report-wrap" ref={results} tabIndex={-1} aria-label="주소 점검 결과">
        <Inspection key={lookup.name} lookup={lookup} criteria={criteria}/>
      </section> : <section className="shell overview" aria-labelledby="overview-title">
        <div className="section-heading">
          <div><h2 id="overview-title">무엇을 확인하나요?</h2><p>네 항목은 각각의 근거와 점수로 표시합니다.</p></div>
        </div>
        <div className="score-grid">
          {criteria.map(({id,title,icon:Icon,short}) => <article className="intro-card" key={id}><span className="tile-icon"><Icon size={21}/></span><h3>{title}</h3><p>{short}</p></article>)}
        </div>
      </section>}
    </main>
    <footer className="shell site-footer"><span><House size={14}/> 안방</span><span>천안 전월세 점검</span></footer>
    <dialog ref={dialog} className="criteria-dialog" aria-labelledby="criteria-title" onClick={e => { if (e.target===dialog.current) dialog.current.close() }}>
      <div className="dialog-inner">
        <div className="section-heading"><h2 id="criteria-title"><BadgeCheck size={22}/> 점검 기준</h2><button className="icon-button" aria-label="닫기" onClick={() => dialog.current.close()}><X size={20}/></button></div>
        {criteria.map(({id,title,detail}) => <section key={id}><h3>{title}</h3><p>{detail}</p></section>)}
        <a className="source-link" href="https://www.data.go.kr/" target="_blank" rel="noreferrer">공공데이터포털 <ArrowUpRight size={13}/></a>
      </div>
    </dialog>
  </>
}

