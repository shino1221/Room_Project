import express from 'express'
import { pathToFileURL } from 'node:url'
import { districts, validListing } from '../src/model.js'
import { resolveAddress, getBuildings, loadDeals, getEnvironment } from './publicData.js'
import { getPrice } from './priceService.js'

try { process.loadEnvFile('.env.local') } catch (err) { if (err.code !== 'ENOENT') throw err }
export const app = express()
app.disable('x-powered-by')
app.use('/api', (req,res,next) => {
  if (process.env.FRONTEND_ORIGIN && req.get('origin') === process.env.FRONTEND_ORIGIN) {
    res.set('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN)
    res.set('Vary','Origin')
    res.set('Access-Control-Allow-Headers','Content-Type')
    res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  }
  res.set('Cache-Control','no-store')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json({ limit:'8kb' }))
const bad = (res,msg) => res.status(400).json({ error:msg })

app.post('/api/address', async (req,res) => {
  const { address } = req.body || {}
  if (typeof address !== 'string' || !address.trim() || address.length>150) return bad(res,'도로명주소나 지번을 확인하세요.')
  res.json(await resolveAddress(address.trim()))
})
app.post('/api/building', async (req,res) => {
  const { sigunguCd,bjdongCd,platGbCd,bun,ji } = req.body || {}
  if (!Object.values(districts).includes(sigunguCd) || !/^\d{5}$/.test(bjdongCd) || !/^[01]$/.test(platGbCd) || ![bun,ji].every(x => /^\d{4}$/.test(x))) return bad(res,'지번을 확인하세요.')
  res.json(await getBuildings({ sigunguCd,bjdongCd,platGbCd,bun,ji }))
})
app.post('/api/price', async (req,res) => {
  if (!req.body || !validListing(req.body)) return bad(res,'주택 유형과 계약 조건을 확인하세요.')
  res.json(await getPrice(req.body,loadDeals))
})
app.get('/api/environment', async (req,res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon)
  if (!(lat >= 36.5 && lat <= 37.1 && lon >= 126.9 && lon <= 127.5)) return bad(res,'천안시 좌표를 확인하세요.')
  res.json(await getEnvironment(lat,lon))
})
app.use('/api',(req,res) => res.status(404).json({ error:'조회 경로를 찾을 수 없습니다.' }))
app.use((err,req,res,next) => {
  if (res.headersSent) return next(err)
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return bad(res,'입력 형식을 확인하세요.')
  res.status(err.status || 502).json({ error:err.message || '자료를 조회할 수 없습니다.' })
})
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(Number(process.env.PORT) || 3001, () => console.log('안방 API 서버 실행 중'))
}

