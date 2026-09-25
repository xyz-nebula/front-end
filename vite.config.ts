import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, isPreview, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://localhost:8080'
  const audioProxyTarget = env.AUDIO_PROXY_TARGET || 'http://localhost:8081'

  for (const [name, target] of [['API_PROXY_TARGET', apiProxyTarget], ['AUDIO_PROXY_TARGET', audioProxyTarget]]) {
    const url = new URL(target)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`${name} must be an absolute HTTP(S) URL.`)
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      ...(command === 'serve' && !isPreview && {
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
          '/audio': {
            target: audioProxyTarget,
            changeOrigin: true,
            ws: true,
            rewrite: (path) => path.replace(/^\/audio/, ''),
          },
        },
      }),
    },
  }
})
