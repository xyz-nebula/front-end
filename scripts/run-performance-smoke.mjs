import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { preview } from 'vite'

const host = '127.0.0.1'
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const budgets = JSON.parse(await readFile(new URL('./performance-runtime-budget.json', import.meta.url), 'utf8'))
const forbiddenLandingAssets = /(?:ArenaPage|ResultPage|hiring|sending-to-negotiations|trustee-of-property)/i

let server
let browser

try {
  server = await preview({
    root: projectRoot,
    configFile,
    logLevel: 'error',
    preview: { host, port: 0, strictPort: false },
  })
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Vite preview did not expose a TCP port.')

  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.addInitScript(() => {
    globalThis.__arenaLatestLcp = 0
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const latest = entries.at(-1)
      if (latest) globalThis.__arenaLatestLcp = latest.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })

  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    connectionType: 'cellular4g',
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  const baseUrl = `http://${host}:${address.port}`
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.arena-scene__image').waitFor({ state: 'visible' })
  await page.waitForTimeout(1_000)

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const entries = [navigation, ...resources].filter(Boolean)
    return {
      lcpMs: Math.round(globalThis.__arenaLatestLcp ?? 0),
      transferBytes: entries.reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0),
      assets: resources.map((entry) => new URL(entry.name).pathname),
    }
  })

  const unexpected = metrics.assets.filter((asset) => forbiddenLandingAssets.test(asset))
  const failures = []
  if (metrics.lcpMs <= 0) failures.push('Landing LCP was not recorded.')
  if (metrics.lcpMs > budgets.landingLcpMs) failures.push(`Landing LCP ${metrics.lcpMs} ms exceeds ${budgets.landingLcpMs} ms.`)
  if (metrics.transferBytes > budgets.landingTransferBytes) failures.push(`Landing transfer ${metrics.transferBytes} bytes exceeds ${budgets.landingTransferBytes} bytes.`)
  if (unexpected.length > 0) failures.push(`Landing loaded route-private assets: ${unexpected.join(', ')}`)

  console.log(JSON.stringify({
    profile: 'mobile 390x844, 1.6 Mbps down, 150 ms RTT, 4x CPU slowdown',
    lcpMs: metrics.lcpMs,
    transferBytes: metrics.transferBytes,
    requests: metrics.assets.length + 1,
  }, null, 2))

  if (failures.length > 0) throw new Error(failures.join('\n'))
  console.log('Landing performance smoke passed.')
} finally {
  await browser?.close()
  await server?.close()
}
