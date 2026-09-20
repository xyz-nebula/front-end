import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { createServer as createTcpServer } from 'node:net'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const HOST = '127.0.0.1'
const SHUTDOWN_TIMEOUT_MS = 190_000
const HARD_TIMEOUT_MS = 210_000
const PROCESS_EXIT_GRACE_MS = 2_000
const PROCESS_TREE_SETTLE_MS = 500
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const playwrightCli = fileURLToPath(import.meta.resolve('@playwright/test/cli'))
const artifactsDir = fileURLToPath(new URL('../artifacts/visual-smoke/', import.meta.url))

function hasExited(childProcess) {
  return childProcess.exitCode !== null || childProcess.signalCode !== null
}

function waitForExit(childProcess) {
  if (hasExited(childProcess)) {
    return Promise.resolve(childProcess.exitCode ?? (childProcess.signalCode ? 1 : 0))
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      childProcess.off('error', onError)
      childProcess.off('exit', onExit)
    }
    const onError = (error) => {
      cleanup()
      reject(error)
    }
    const onExit = (code, signal) => {
      cleanup()
      resolve(code ?? (signal ? 1 : 0))
    }

    childProcess.once('error', onError)
    childProcess.once('exit', onExit)
  })
}

function waitForExitUntil(childProcess, timeoutMs) {
  if (hasExited(childProcess)) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timeout)
      childProcess.off('error', onExit)
      childProcess.off('exit', onExit)
    }
    const onExit = () => {
      cleanup()
      resolve(true)
    }
    const timeout = setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeoutMs)

    childProcess.once('error', onExit)
    childProcess.once('exit', onExit)
  })
}

function signalPosixProcessGroup(childProcess, signal) {
  if (!childProcess.pid || hasExited(childProcess)) {
    return
  }

  try {
    process.kill(-childProcess.pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error
    }
  }
}

async function runTaskkill(childProcess) {
  if (!childProcess.pid || hasExited(childProcess)) {
    return 0
  }

  const taskkillProcess = spawn(
    'taskkill.exe',
    ['/PID', String(childProcess.pid), '/T', '/F'],
    {
      stdio: 'ignore',
      windowsHide: true,
    },
  )

  return waitForExit(taskkillProcess)
}

async function terminateProcessTree(childProcess) {
  if (!childProcess?.pid || hasExited(childProcess)) {
    return
  }

  if (process.platform === 'win32') {
    const taskkillExitCode = await runTaskkill(childProcess)
    if (!(await waitForExitUntil(childProcess, PROCESS_EXIT_GRACE_MS))) {
      childProcess.kill('SIGKILL')
    }
    if (!(await waitForExitUntil(childProcess, PROCESS_EXIT_GRACE_MS))) {
      throw new Error(`Playwright process tree did not exit; taskkill code: ${taskkillExitCode}`)
    }
    await new Promise((resolve) => setTimeout(resolve, PROCESS_TREE_SETTLE_MS))
  } else {
    signalPosixProcessGroup(childProcess, 'SIGTERM')
    if (!(await waitForExitUntil(childProcess, PROCESS_EXIT_GRACE_MS))) {
      signalPosixProcessGroup(childProcess, 'SIGKILL')
    }
    if (!(await waitForExitUntil(childProcess, PROCESS_EXIT_GRACE_MS))) {
      throw new Error('Playwright process tree did not exit after termination')
    }
  }
}

function forceTerminateProcessTree(childProcess) {
  if (!childProcess?.pid || hasExited(childProcess)) {
    return
  }

  try {
    if (process.platform === 'win32') {
      const taskkillProcess = spawn(
        'taskkill.exe',
        ['/PID', String(childProcess.pid), '/T', '/F'],
        {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        },
      )
      taskkillProcess.once('error', (error) => {
        console.error('[visual:smoke] Failed to start final taskkill:', error)
      })
      taskkillProcess.unref()
      childProcess.kill('SIGKILL')
    } else {
      signalPosixProcessGroup(childProcess, 'SIGKILL')
    }
  } catch (error) {
    console.error('[visual:smoke] Failed to force-close Playwright process tree:', error)
  }
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

      const { port } = address
      socket.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function run() {
  let server
  let playwrightProcess
  let exitCode
  let shutdownTimeout

  const shutdownSignal = new Promise((resolve) => {
    shutdownTimeout = setTimeout(() => resolve('timeout'), SHUTDOWN_TIMEOUT_MS)
  })

  const hardTimeout = setTimeout(() => {
    console.error(`[visual:smoke] Превышен общий лимит ${HARD_TIMEOUT_MS / 1000} секунд.`)
    forceTerminateProcessTree(playwrightProcess)
    process.exit(124)
  }, HARD_TIMEOUT_MS)

  try {
    await rm(artifactsDir, { recursive: true, force: true })
    await mkdir(artifactsDir, { recursive: true })

    process.env.API_PROXY_TARGET ??= 'http://127.0.0.1:9'
    process.env.VITE_API_TIMEOUT_MS ??= '600'

    const port = await getAvailablePort()
    server = await createServer({
      root: projectRoot,
      configFile,
      logLevel: 'error',
      server: {
        host: HOST,
        port,
        strictPort: true,
      },
    })
    await server.listen()

    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error('Vite did not expose a TCP port')
    }

    const baseURL = `http://${HOST}:${address.port}`
    console.log(`[visual:smoke] Vite ready at ${baseURL}`)

    playwrightProcess = spawn(
      process.execPath,
      [playwrightCli, 'test', ...process.argv.slice(2)],
      {
        cwd: projectRoot,
        detached: process.platform !== 'win32',
        env: {
          ...process.env,
          PW_BASE_URL: baseURL,
        },
        stdio: 'inherit',
      },
    )

    const playwrightExit = waitForExit(playwrightProcess)
    const outcome = await Promise.race([playwrightExit, shutdownSignal])

    if (outcome === 'timeout') {
      console.error(
        `[visual:smoke] Превышен лимит ${SHUTDOWN_TIMEOUT_MS / 1000} секунд, завершаю Playwright.`,
      )
      exitCode = 124
      await terminateProcessTree(playwrightProcess)
      await playwrightExit.catch(() => undefined)
    } else {
      exitCode = outcome
    }
  } catch (error) {
    console.error('[visual:smoke] Runner failed:', error)
    exitCode ??= 1
  } finally {
    try {
      await server?.close()
    } catch (error) {
      console.error('[visual:smoke] Failed to close Vite:', error)
      if (exitCode !== 124) {
        exitCode = 1
      }
    }
    clearTimeout(shutdownTimeout)
    if (!playwrightProcess?.pid || hasExited(playwrightProcess)) {
      clearTimeout(hardTimeout)
    }
  }

  return exitCode
}

process.exitCode = await run()
