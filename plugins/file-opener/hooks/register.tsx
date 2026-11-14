import type { EngineInterface, Register, RenderInput } from 'claude-code'

// Any local file a reply names (a markdown link, a `code` path, a bare C:\ path)
// or a SendUserFile card sends gets a card of buttons under it: Open (the
// default app, or the Windows "Open with" picker when the type has none),
// Open with... (Windows) and Folder.

type Options = { extensions?: string }
type Found = { path: string; name: string }

const MAX_CANDIDATES = 20
const MAX_FILES = 8

// Settings and caches; they start over on a reload.
let exts: Set<string> | undefined // undefined: every extension
let isWindows: boolean | undefined
let cwd: string | undefined
const isFileCache = new Map<string, boolean>()

const HAS_EXT = /\.[A-Za-z0-9]{1,8}$/
const IS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/

function clean(raw: string): string | undefined {
  let p = raw.trim().replace(/^<(.*)>$/, '$1').replace(/^["']|["']$/g, '')
  if (p.startsWith('file:///')) p = p.slice(8)
  else if (/^[a-z][a-z0-9+.-]*:/i.test(p) && !/^[A-Za-z]:[\\/]/.test(p)) return undefined // http:, mailto:, ...
  if (p.startsWith('#') || p.includes('\n')) return undefined
  try {
    p = decodeURIComponent(p)
  } catch {
    // keep it as written
  }
  p = p.replace(/#.*$/, '').replace(/:\d+(?::\d+)?$/, '') // a #anchor or :line suffix
  return HAS_EXT.test(p) ? p : undefined
}

/** The file paths a block of markdown names, in order, each once. */
export function findPaths(text: string): string[] {
  const out: string[] = []
  const add = (raw: string) => {
    const p = clean(raw)
    if (p !== undefined && !out.includes(p) && out.length < MAX_CANDIDATES) out.push(p)
  }
  for (const m of text.matchAll(/\]\((<[^>\n]+>|[^)\s]+)\)/g)) add(m[1]!)
  for (const m of text.matchAll(/`([^`\n]+)`/g)) if (!/^\$|\(.*\)$/.test(m[1]!)) add(m[1]!)
  for (const m of text.matchAll(/(?<![\w`(<[\\/])([A-Za-z]:\\[^\s`*"'<>|()[\]]+)/g)) add(m[1]!.replace(/[.,;:]+$/, ''))
  return out
}

async function detect($: EngineInterface) {
  if (isWindows === undefined) isWindows = (await $.env.get('OS')) === 'Windows_NT'
  if (cwd === undefined) cwd = await $.session.cwd()
  return { isWindows, cwd }
}

async function resolveFiles($: EngineInterface, paths: readonly string[]): Promise<Found[]> {
  const { isWindows: win, cwd: base } = await detect($)
  const sep = win ? '\\' : '/'
  const found: Found[] = []
  for (const raw of paths) {
    let path = IS_ABSOLUTE.test(raw) ? raw : base.replace(/[\\/]+$/, '') + sep + raw.replace(/^\.[\\/]/, '')
    if (win) path = path.replace(/\//g, '\\')
    const name = path.slice(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1)
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
    if (exts !== undefined && !exts.has(ext)) continue
    if (found.some(f => f.path.toLowerCase() === path.toLowerCase())) continue
    let isFile = isFileCache.get(path)
    if (isFile === undefined) {
      isFile = await $.fs.stat(path).then(
        s => s.kind === 'file',
        () => false,
      )
      // Remember hits only; a miss may be a file about to be written.
      if (isFile) isFileCache.set(path, true)
    }
    if (isFile) found.push({ path, name })
    if (found.length >= MAX_FILES) break
  }
  return found
}

type Mode = 'open' | 'folder'

// The path goes in through an env var, so spaces and quotes need no escaping.
// Open uses the default app; with none associated, Windows' "Open with" picker.
const WIN_SCRIPTS: Record<Mode, string> = {
  open:
    '$p = $env:FILE_OPENER_PATH; try { Start-Process -FilePath $p -ErrorAction Stop } ' +
    "catch { Start-Process rundll32.exe -ArgumentList ('shell32.dll,OpenAs_RunDLL ' + $p) }",
  folder: "Start-Process explorer.exe -ArgumentList ('/select,\"' + $env:FILE_OPENER_PATH + '\"')",
}

async function openFile($: EngineInterface, path: string, mode: Mode) {
  const { isWindows: win } = await detect($)
  try {
    const r = win
      ? await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPTS[mode]], {
          env: { FILE_OPENER_PATH: path },
        })
      : await $.process.run(mode === 'folder' ? ['open', '-R', path] : ['open', path])
    if (r.exitCode !== 0) $.ui.toast(`Could not open: ${r.stderr.trim().split('\n')[0] || `exit ${r.exitCode}`}`)
  } catch (err) {
    $.ui.toast(`Could not open: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function card($: EngineInterface, e: RenderInput<'AssistantMessage' | 'ToolUse'>, files: Found[]) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const reveal = isWindows === true ? 'Show in Explorer' : 'Show in Finder'
  return (
    <Box flexDirection="column" rowGap={1}>
      {files.map(f => (
        <Box key={f.path} flexDirection="column" borderStyle="round" borderDimColor>
          <Text bold>{f.name}</Text>
          <Box flexDirection="row" columnGap={1}>
            <Button key={`open:${f.path}`} label="Open" onPress={() => void openFile($, f.path, 'open')} />
            <Button key={`dir:${f.path}`} label={reveal} onPress={() => void openFile($, f.path, 'folder')} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as Options
  const list = (opts.extensions ?? '')
    .split(',')
    .map(x => x.trim().toLowerCase().replace(/^\./, ''))
    .filter(x => x !== '' && x !== '*')
  exts = list.length > 0 ? new Set(list) : undefined
  isWindows = undefined
  cwd = undefined
  isFileCache.clear()

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = await next(e)
    if (e.props.isSummary) return row
    const files = await resolveFiles($, findPaths(e.props.text))
    if (files.length === 0) return row
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {row}
        {card($, e, files)}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const row = await next(e)
    if (e.props.tool !== 'SendUserFile' || e.props.isRunning || e.props.isErrored) return row
    const input = e.props.input as { files?: unknown } | undefined
    const paths = Array.isArray(input?.files) ? input.files.filter((p): p is string => typeof p === 'string') : []
    const files = await resolveFiles($, paths)
    if (files.length === 0) return row
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {row}
        {card($, e, files)}
      </Box>
    )
  })
}
