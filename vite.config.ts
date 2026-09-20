import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, isPreview, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_')
  const apiProxyTarget = env.API_PROXY_TARGET
  const needsApiProxy = command === 'serve' && !isPreview

  if (needsApiProxy && !apiProxyTarget) {
    throw new Error(
      'API_PROXY_TARGET is required. Copy .env.example to .env and set the backend URL.',
    )
  }

  if (apiProxyTarget) {
    const protocol = new URL(apiProxyTarget).protocol
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error('API_PROXY_TARGET must be an absolute HTTP(S) URL.')
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
      ...(apiProxyTarget && {
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            secure: true,
          },
        },
      }),
    },
  }
})
