import type { Register } from 'claude-code'

// Probe mod: one line per event, to the transcript and (if REPORT_URL is set)
// to REPORT_URL. Never logs or sends a token, cookie, credential or handle.

const clip = (s: string, n = 120) => s.replace(/\s+/g, ' ').slice(0, n)

let sid = '?'

async function emit($: any, event: string, detail: string) {
  if (sid === '?') {
    try { sid = await $.session.id() } catch { /* keep '?' */ }
  }
  const line = `[state-probe] event=${event} ts=${new Date().toISOString()} session=${sid} detail=${clip(detail)}`
  $.ui.log(line)
  let url: string | undefined
  try { url = await $.env.get('REPORT_URL') } catch { url = undefined }
  if (!url || url.includes('<')) return
  try {
    const r = await $.http.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, sid, detail: clip(detail), ts: Date.now() }),
    })
    if (!r.ok) $.ui.log(`[state-probe] fetch status=${r.status}`)
  } catch (err) {
    $.ui.log(`[state-probe] fetch error=${clip(String(err), 200)}`)
  }
}

async function where($: any) {
  const out: string[] = []
  const tryCall = async (name: string, f: () => Promise<unknown>, fmt: (v: any) => string) => {
    try { out.push(`${name}=${fmt(await f())}`) } catch (err) { out.push(`${name}=threw:${clip(String(err), 80)}`) }
  }
  await tryCall('id', () => $.session.id(), v => String(v))
  await tryCall('surface', () => $.session.surface(), v => String(v))
  await tryCall('surfaces', () => $.session.surfaces(), v => JSON.stringify(v))
  await tryCall('cwd', () => $.session.cwd(), v => String(v))
  // identity: record only deny vs kind, never org/email
  await tryCall('identity', () => $.session.identity(),
    v => v && typeof v === 'object' && 'deny' in v ? `deny(${clip(String(v.deny), 60)})` : `kind=${v?.kind}`)
  // authorize: record only whether a handle came back, never the value
  await tryCall('authorize', () => $.session.authorize(),
    v => v && typeof v === 'object' && 'handle' in v ? 'handle=yes' : v === null ? 'null' : 'deny-or-other')
  // project/thread ids: presence only for env names, values never logged
  await tryCall('env.REPORT_URL', () => $.env.get('REPORT_URL'), v => (v === undefined ? 'unset' : 'set'))
  await tryCall('env.CLAUDE_CODE_PROJECTS_SESSION', () => $.env.get('CLAUDE_CODE_PROJECTS_SESSION'), v => (v === undefined ? 'unset' : 'set'))
  await tryCall('env.CLAUDE_CODE_REMOTE_SESSION_ID', () => $.env.get('CLAUDE_CODE_REMOTE_SESSION_ID'), v => (v === undefined ? 'unset' : 'set'))
  await tryCall('env.CLAUDE_CODE_ENTRYPOINT', () => $.env.get('CLAUDE_CODE_ENTRYPOINT'), v => (v === undefined ? 'unset' : 'set'))
  return out.join(' ')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await emit($, 'session.start', `surface=${e.surface} interactive=${e.isInteractive} cwd=${e.cwd}`)
    await emit($, 'whereami', await where($))
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await emit($, 'session.end', `reason=${e.reason}`)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await emit($, 'turn.start', `turnId=${e.turnId} agent=${e.agentId ?? 'main'} chars=${e.text.length}`)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await emit($, 'turn.complete', `ms=${e.durationMs} aborted=${e.isAborted}`)
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    await emit($, 'tool.check', `tool=${e.tool} decision=${r.decision}`)
    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const q = e.questions?.map(x => x.question).join(' | ') ?? ''
    await emit($, 'tool.call', `tool=AskUserQuestion question=${q}`)
    return next(e)
  }).catch(($, e, next) => next(e))
}
