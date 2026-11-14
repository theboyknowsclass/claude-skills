import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'model-files',
  component: 'Pane',
  requestId: 'model-files',
  props: {
    title: 'Model files',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const file = (name: string, mtimeMs: number) => ({ name, kind: 'file' as const, size: 10, mtimeMs, isLink: false })
const dir = (name: string) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })

for (const os of ['windows', 'mac'] as const) {
  test(`lists newest model files and opens them (${os})`, async ($, on) => {
    const isWin = os === 'windows'
    const root = isWin ? 'C:\\Users\\me\\3D Models' : '/Users/me/3D Models'
    const sep = isWin ? '\\' : '/'
    const runs: Array<{ argv: readonly string[]; env?: Record<string, string> }> = []

    on('command.register', () => ({ value: { command: 'model-files' } }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('clock.every', () => ({ value: undefined }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', (_, e) => ({
      value:
        e.name === 'OS' ? (isWin ? 'Windows_NT' : undefined)
        : e.name === 'USERPROFILE' ? 'C:\\Users\\me'
        : e.name === 'HOME' ? '/Users/me'
        : undefined,
    }))
    // On a Linux test host the engine reads a Windows path as relative, so match its end.
    on('fs.list', (_, e) => ({
      value:
        e.path.endsWith(root) ? [dir('Gridfinity'), file('notes.txt', 9), file('old.stl', 1)]
        : e.path.endsWith(root + sep + 'Gridfinity') ? [file('Bin - 3u.3mf', 5), file('Bin - 3u.stl', 4)]
        : [],
    }))
    on('process.run', (_, e) => {
      runs.push({ argv: e.argv, env: e.init?.env })
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.press({ key: 'refresh' })

      const newest = root + sep + 'Gridfinity' + sep + 'Bin - 3u.3mf'
      expect(await ui.find({ type: 'Text', text: /notes\.txt/ })).toBeUndefined()

      runs.length = 0
      await ui.press({ key: `open:${newest}` })
      await ui.press({ key: `dir:${newest}` })
      if (isWin) {
        expect(runs[0]?.argv[0]).toBe('powershell.exe')
        expect(runs[0]?.env?.MODEL_FILES_PATH).toBe(newest)
        expect(runs[1]?.argv.join(' ')).toContain('/select,')
      } else {
        expect(runs[0]?.argv).toEqual(['open', newest])
        expect(runs[1]?.argv).toEqual(['open', '-R', newest])
      }
      await ui.unmount()
    }
  })
}
