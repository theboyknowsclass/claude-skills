import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ModelFile, Scan } from '../types'

const PANE = 'model-files'
const TITLE = 'Model files'
const RESCAN_MS = 20_000
const MAX_DEPTH = 8
const MAX_DIRS = 3000
const DEFAULT_EXTS = '3mf,stl,step,stp,obj,f3d,fcstd,scad,gcode,nc,dxf,svg'

// Change the tag when Scan's fields change: it declines what an older version stored.
const scan = atom({ plugin: 'model-files', key: 'scan' } as const, { files: [], scannedAt: 0 }, {
  shape: 'scan-1',
})

type Options = { folder?: string; extensions?: string; count?: number }

// The module's own settings and scan flags; they start over on a reload.
let opts: Options = {}
let exts = new Set<string>()
let count = 15
let isWindows: boolean | undefined
let root: string | undefined
let isScanning = false

function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}

async function detect($: EngineInterface) {
  if (isWindows === undefined) isWindows = (await $.env.get('OS')) === 'Windows_NT'
  if (root === undefined) {
    let folder = (opts.folder ?? '~/3D Models').trim()
    if (folder.startsWith('~')) {
      const home = isWindows ? await $.env.get('USERPROFILE') : await $.env.get('HOME')
      folder = (home ?? '') + folder.slice(1)
    }
    if (isWindows) folder = folder.replace(/\//g, '\\')
    root = folder.replace(/[\\/]+$/, '')
  }
  return { isWindows, root, sep: isWindows ? '\\' : '/' }
}

async function rescan($: EngineInterface) {
  if (isScanning) return
  isScanning = true
  try {
    const { root: base, sep } = await detect($)
    const found: ModelFile[] = []
    const queue: Array<{ dir: string; depth: number }> = [{ dir: base, depth: 0 }]
    let dirs = 0
    let note: string | undefined
    while (queue.length > 0) {
      const { dir, depth } = queue.shift()!
      if (++dirs > MAX_DIRS) {
        note = `Stopped after ${MAX_DIRS} folders.`
        break
      }
      let entries
      try {
        entries = await $.fs.list(dir)
      } catch (err) {
        if (dir === base) throw err
        continue
      }
      for (const ent of entries) {
        if (ent.name.startsWith('.')) continue
        const path = dir + sep + ent.name
        if (ent.kind === 'dir') {
          if (depth < MAX_DEPTH) queue.push({ dir: path, depth: depth + 1 })
        } else if (ent.kind === 'file') {
          const dot = ent.name.lastIndexOf('.')
          const ext = dot < 0 ? '' : ent.name.slice(dot + 1).toLowerCase()
          if (exts.has(ext)) found.push({ path, name: ent.name, dir, mtimeMs: ent.mtimeMs, size: ent.size })
        }
      }
    }
    found.sort((a, b) => b.mtimeMs - a.mtimeMs)
    const next: Scan = { files: found.slice(0, count), scannedAt: Date.now(), note }
    await update($, scan, () => next)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await update($, scan, s => ({ ...s, scannedAt: Date.now(), error: `Can't read ${root}: ${message}` }))
  } finally {
    isScanning = false
  }
}

async function openFile($: EngineInterface, path: string, reveal: boolean) {
  const { isWindows: win } = await detect($)
  try {
    if (win) {
      // The path goes in through an env var, so spaces and quotes need no escaping.
      const script = reveal
        ? "Start-Process explorer.exe -ArgumentList ('/select,\"' + $env:MODEL_FILES_PATH + '\"')"
        : 'Invoke-Item -LiteralPath $env:MODEL_FILES_PATH'
      const r = await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], {
        env: { MODEL_FILES_PATH: path },
      })
      if (r.exitCode !== 0) {
        const msg = r.stderr.trim().split('\n')[0] || `exit ${r.exitCode}`
        $.ui.toast(
          /association|no application/i.test(r.stderr)
            ? 'No default app for this file type. In Windows: right-click a file > Open with > Choose another app > Always.'
            : `Could not open: ${msg}`,
        )
      }
    } else {
      const r = await $.process.run(reveal ? ['open', '-R', path] : ['open', path])
      if (r.exitCode !== 0) $.ui.toast(`Could not open: ${r.stderr.trim().split('\n')[0] || `exit ${r.exitCode}`}`)
    }
  } catch (err) {
    $.ui.toast(`Could not open: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export const register: Register = (on, options) => {
  opts = (options ?? {}) as Options
  exts = new Set(
    (opts.extensions ?? DEFAULT_EXTS)
      .split(',')
      .map(x => x.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean),
  )
  count = Math.max(1, Math.min(100, Math.round(opts.count ?? 15)))
  isWindows = undefined
  root = undefined

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'model-files',
      description: 'Show your newest model files in a side panel',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    void rescan($)
    $.clock.every(RESCAN_MS, () => void rescan($))
    return started
  })

  on('command.run', { command: 'model-files' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    void rescan($)
    return { text: 'Model files panel opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, scan)
    const now = Date.now()
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 40) - 4) / 2))
    const shown = s.files.slice(0, room)
    const where = root ?? opts.folder ?? ''

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text dimColor>{where}</Text>
          <Text> </Text>
          <Button key="refresh" label="Refresh" onPress={() => void rescan($)} />
        </Box>
        {s.error !== undefined && <Text color="red">{s.error}</Text>}
        {s.scannedAt === 0 && <Text dimColor>Looking for files…</Text>}
        {s.scannedAt > 0 && s.error === undefined && shown.length === 0 && (
          <Text dimColor>No model files found yet.</Text>
        )}
        {shown.map(f => (
          <Box flexDirection="column" key={f.path}>
            <Box flexDirection="row">
              <Button key={`open:${f.path}`} label={f.name} onPress={() => void openFile($, f.path, false)} />
              <Text dimColor> {ago(f.mtimeMs, now)} </Text>
              <Button key={`dir:${f.path}`} label="Folder" onPress={() => void openFile($, f.path, true)} />
            </Box>
            <Text dimColor>  {f.dir.startsWith(where) ? f.dir.slice(where.length + 1) || '.' : f.dir}</Text>
          </Box>
        ))}
        {s.note !== undefined && <Text dimColor>{s.note}</Text>}
      </Box>
    )
  })
}
