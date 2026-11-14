import { expect, test } from 'claude-code/testing'

const ok = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
const fileStat = { kind: 'file' as const, size: 10, mtimeMs: 1, isLink: false }

for (const os of ['windows', 'mac'] as const) {
  test(`buttons under files named in a reply and in SendUserFile (${os})`, async ($, on) => {
    const isWin = os === 'windows'
    const cwd = isWin ? 'D:\\3D Models' : '/Users/me/3D Models'
    const sep = isWin ? '\\' : '/'
    const bin = cwd + sep + 'Gridfinity' + sep + 'Bin 3u.3mf'
    const abs = isWin ? 'D:\\Exports\\part.stl' : '/Users/me/Exports/part.stl'
    const exists = new Set([bin, abs])
    const runs: Array<{ argv: readonly string[]; env?: Record<string, string> }> = []

    on('env.get', (_, e) => ({ value: e.name === 'OS' && isWin ? 'Windows_NT' : undefined }))
    on('session.cwd', () => ({ value: cwd }))
    // On a Linux test host the engine may read a Windows path as relative, so match its end.
    on('fs.stat', (_, e) => {
      const bare = (p: string) => p.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
      if ([...exists].some(p => bare(e.path).endsWith(bare(p)))) return { value: fileStat }
      throw Object.assign(new Error(`ENOENT: ${e.path}`), { code: 'ENOENT' })
    })
    on('process.run', (_, e) => {
      runs.push({ argv: e.argv, env: e.init?.env })
      return { value: ok }
    })

    const text = [
      'Exported [Bin 3u.3mf](Gridfinity/Bin%203u.3mf) and',
      isWin ? 'D:\\Exports\\part.stl.' : '`/Users/me/Exports/part.stl`',
      'See [docs](https://example.com/x.pdf) and `missing.step`.',
    ].join(' ')

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'file-opener',
        surface,
        component: 'AssistantMessage',
        requestId: `m-${surface}`,
        props: { text, isFirstOfReply: true },
      })
      expect(await ui.find({ key: `open:${bin}` })).toBeDefined()
      expect(await ui.find({ key: `open:${abs}` })).toBeDefined()
      expect(await ui.find({ type: 'Button', text: /missing|x\.pdf/ })).toBeUndefined()

      runs.length = 0
      await ui.press({ key: `open:${bin}` })
      await ui.press({ key: `dir:${bin}` })
      expect(await ui.find({ type: 'Text', text: 'Bin 3u.3mf' })).toBeDefined()
      expect(await ui.find({ type: 'Button', text: isWin ? 'Show in Explorer' : 'Show in Finder' })).toBeDefined()
      if (isWin) {
        expect(runs[0]?.argv[0]).toBe('powershell.exe')
        expect(runs[0]?.env?.FILE_OPENER_PATH).toBe(bin)
        expect(runs[0]?.argv.join(' ')).toContain('OpenAs_RunDLL')
        expect(runs[1]?.argv.join(' ')).toContain('/select,')
      } else {
        expect(runs[0]?.argv).toEqual(['open', bin])
        expect(runs[1]?.argv).toEqual(['open', '-R', bin])
      }
      await ui.unmount()

      const card = await $.ui.mount({
        plugin: 'file-opener',
        surface,
        component: 'ToolUse',
        requestId: `t-${surface}`,
        props: {
          tool_use_id: `t-${surface}`,
          tool: 'SendUserFile',
          input: { files: [abs], status: 'normal' },
          isRunning: false,
          isErrored: false,
          isInterrupted: false,
        },
      })
      expect(await card.find({ key: `open:${abs}` })).toBeDefined()
      await card.unmount()
    }
  })
}

test('a reply with no files is left alone', async ($, on) => {
  on('env.get', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: '/tmp' }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  const ui = await $.ui.mount({
    plugin: 'file-opener',
    surface: 'desktop',
    component: 'AssistantMessage',
    requestId: 'm',
    props: { text: 'Call `$.ui.open()` or see https://example.com/a.stl', isFirstOfReply: true },
  })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('bare paths and plain links with spaces (windows)', async ($, on) => {
  const own = 'D:\\3D Models\\Dividers\\Hook Divider\\hook-divider-v61.3mf'
  const mid = 'D:\\3D Models\\x.3mf'
  const bin = 'D:\\3D Models\\Bin 2u.stl'
  const lid = 'D:\\3D Models\\Lid v2.step'
  const longer = 'D:\\Out\\v1.3mf backup.3mf'
  const shorter = 'D:\\Out\\v1.3mf'
  const linked = 'D:\\3D Models\\Linked part.3mf'
  const exists = new Set([own, mid, bin, lid, longer, shorter, linked])

  on('env.get', (_, e) => ({ value: e.name === 'OS' ? 'Windows_NT' : undefined }))
  on('session.cwd', () => ({ value: 'D:\\work' }))
  // On a Linux test host the engine may read a Windows path as relative, so match its end.
  on('fs.stat', (_, e) => {
    const bare = (p: string) => p.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
    if ([...exists].some(p => bare(e.path).endsWith(bare(p)))) return { value: fileStat }
    throw Object.assign(new Error(`ENOENT: ${e.path}`), { code: 'ENOENT' })
  })

  const cases: Array<{ name: string; text: string; want: string[]; notWant?: string[] }> = [
    { name: 'own line', text: `Done:\n${own}\nEnjoy.`, want: [own] },
    { name: 'mid-sentence with a full stop', text: `Saved to ${mid}. Open it in the slicer.`, want: [mid] },
    { name: 'two paths, trailing comma', text: `${bin}, and ${lid} are ready`, want: [bin, lid] },
    { name: 'longest that exists wins', text: `Copied ${longer} for you`, want: [longer], notWant: [shorter] },
    { name: 'plain markdown link', text: `See [the part](${linked}) here`, want: [linked] },
    { name: 'missing file', text: 'Saved to D:\\3D Models\\gone.3mf, done.', want: [] },
  ]

  for (const c of cases) {
    const ui = await $.ui.mount({
      plugin: 'file-opener',
      surface: 'desktop',
      component: 'AssistantMessage',
      requestId: `m-${c.name}`,
      props: { text: c.text, isFirstOfReply: true },
    })
    for (const p of c.want) expect(await ui.find({ key: `open:${p}` })).toBeDefined()
    for (const p of c.notWant ?? []) expect(await ui.find({ key: `open:${p}` })).toBeUndefined()
    if (c.want.length === 0) expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }
})
