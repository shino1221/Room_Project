import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

async function localApi(server) {
  const { app } = await import(pathToFileURL(resolve('server/app.js')).href)
  server.middlewares.use('/api', (req,res,next) => {
    req.url = '/api' + req.url
    app(req,res,next)
  })
}
export default defineConfig({
  base:'./',
  plugins:[react(), { name:'local-api', configureServer:localApi, configurePreviewServer:localApi }],
})

