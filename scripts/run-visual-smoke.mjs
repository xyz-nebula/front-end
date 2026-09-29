import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { createServer as createTcpServer } from 'node:net'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const HOST = '127.0.0.1'
const HARD_TIMEOUT_MS = 170_000
const PROCESS_EXIT_GRACE_MS = 2_000
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const playwrightCli = fileURLToPath(import.meta.resolve('@playwright/test/cli'))
const artifactsDir = fileURLToPath(new URL('../artifacts/visual-smoke/', import.meta.url))

function hasExited(childProcess) {
  return childProcess.exitCode !== null || childProcess.signalCode !== null
}

function waitForExit(childProcess) {
  if (hasExited(childProcess)) return Promise.resolve(childProcess.exitCode ?? 1)
  return new Promise((resolve, reject) => {
    childProcess.once('error', reject)
    childProcess.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
}

function waitForExitUntil(childProcess, timeoutMs) {
  if (hasExited(childProcess)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs)
    childProcess.once('exit', () => {
      clearTimeout(timeout)
      resolve(true)
    })
  })
}

async function terminateProcessTree(childProcess) {
  if (!childProcess?.pid || hasExited(childProcess)) return
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(childProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    await waitForExit(taskkill).catch(() => undefined)
  } else {
    try {
      process.kill(-childProcess.pid, 'SIGTERM')
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
    }
  }
  if (!(await waitForExitUntil(childProcess, PROCESS_EXIT_GRACE_MS))) childProcess.kill('SIGKILL')
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const socket = createTcpServer()
    socket.once('error', reject)
    socket.listen(0, HOST, () => {
      const address = socket.address()
      if (!address || typeof address === 'string') {
        socket.close()
        reject(new Error('Could not reserve a local TCP port'))
        return
      }
      socket.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function run() {
  let server
  let playwrightProcess
  let timedOut = false

  const hardTimeout = setTimeout(() => {
    timedOut = true
    console.error(`[visual:smoke] Превышен общий лимит ${HARD_TIMEOUT_MS / 1000} секунд.`)
    void terminateProcessTree(playwrightProcess)
  }, HARD_TIMEOUT_MS)

  try {
    await rm(artifactsDir, { recursive: true, force: true })
    await mkdir(artifactsDir, { recursive: true })

    process.env.API_PROXY_TARGET = ''
    process.env.VITE_SERVICE_MODE = 'mock'
    process.env.VITE_API_TIMEOUT_MS = '600'

    const port = await getAvailablePort()
    server = await createServer({
      root: projectRoot,
      configFile,
      logLevel: 'error',
      server: { host: HOST, port, strictPort: true },
    })
    await server.listen()

    const baseURL = `http://${HOST}:${port}`
    console.log(`[visual:smoke] Vite ready at ${baseURL}`)
    playwrightProcess = spawn(process.execPath, [
      playwrightCli,
      'test',
      'smoke.spec.ts',
      'product-tour.spec.ts',
      ...process.argv.slice(2),
    ], {
      cwd: projectRoot,
      detached: process.platform !== 'win32',
      env: { ...process.env, PW_BASE_URL: baseURL },
      stdio: 'inherit',
      windowsHide: true,
    })

    const exitCode = await waitForExit(playwrightProcess)
    return timedOut ? 124 : exitCode
  } catch (error) {
    console.error('[visual:smoke] Runner failed:', error)
    return timedOut ? 124 : 1
  } finally {
    clearTimeout(hardTimeout)
    await terminateProcessTree(playwrightProcess)
    await server?.close()
  }
}

process.exitCode = await run()
