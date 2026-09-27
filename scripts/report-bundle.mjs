import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../', import.meta.url))
const distPath = fileURLToPath(new URL('../dist/', import.meta.url))
const budgetPath = new URL('./performance-budgets.json', import.meta.url)
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return nested.flat()
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function sum(files, field) {
  return files.reduce((total, file) => total + file[field], 0)
}

const files = await Promise.all((await listFiles(distPath)).map(async (path) => {
  const contents = await readFile(path)
  return {
    path: relative(root, path).replaceAll('\\', '/'),
    extension: extname(path).toLowerCase(),
    bytes: contents.byteLength,
    gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
  }
}))

const javascript = files.filter((file) => file.extension === '.js')
const css = files.filter((file) => file.extension === '.css')
const images = files.filter((file) => imageExtensions.has(file.extension))
const largestJavaScriptChunkBytes = Math.max(0, ...javascript.map((file) => file.bytes))
const measurements = {
  totalBytes: sum(files, 'bytes'),
  imageBytes: sum(images, 'bytes'),
  javascriptBytes: sum(javascript, 'bytes'),
  cssBytes: sum(css, 'bytes'),
  largestJavaScriptChunkBytes,
}
const budgets = JSON.parse(await readFile(budgetPath, 'utf8'))

console.table({
  total: { raw: formatBytes(measurements.totalBytes), gzip: formatBytes(sum(files, 'gzipBytes')) },
  images: { raw: formatBytes(measurements.imageBytes), gzip: formatBytes(sum(images, 'gzipBytes')) },
  javascript: { raw: formatBytes(measurements.javascriptBytes), gzip: formatBytes(sum(javascript, 'gzipBytes')) },
  css: { raw: formatBytes(measurements.cssBytes), gzip: formatBytes(sum(css, 'gzipBytes')) },
  'largest JS chunk': { raw: formatBytes(largestJavaScriptChunkBytes), gzip: '—' },
})

const failures = Object.entries(budgets)
  .filter(([key, limit]) => measurements[key] > limit)
  .map(([key, limit]) => `${key}: ${formatBytes(measurements[key])} > ${formatBytes(limit)}`)

if (failures.length > 0) {
  console.error(`Bundle budgets exceeded:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log('Bundle budgets passed.')
}
