const base = (import.meta.env.VITE_API_BASE || '').replace(/\/$/,'')
export async function api(path,body,signal) {
  const options = body ? { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) } : {}
  let response
  try { response = await fetch(base+'/api/'+path,{...options,signal}) }
  catch (err) {
    if (err.name==='AbortError') throw err
    throw new Error('점검 서버에 연결하지 못했습니다.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || '점검 결과를 받지 못했습니다.')
  return data
}

