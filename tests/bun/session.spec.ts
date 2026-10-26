// SESSION: the summary of the last session (SESSION.1), the first-prompt block (SESSION.2) and the unused-expiry sweep
// (SESSION.4), over the real engine, the real bin/memories.ts and bin/import.ts, and the real hooks/register.ts, on a
// temp HOME with its own store (knowledge-host.ts). Nothing here touches the real ~/.claude/mnemosyne: every folder is
// under the temp HOME, `--store` and `--root` always name it, and the model is a stand-in.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { engineCall, isolatedEnv, ROOT, toolCall } from './helpers'
import { makeHost, until } from './knowledge-host'
import type { Host, ModelAnswer } from './knowledge-host'

setDefaultTimeout(90_000)
const hosts: Host[] = []
const open = async (...args: Parameters<typeof makeHost>) => {
  const host = await makeHost(...args)
  hosts.push(host)
  return host
}
afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose()
})

const MEMORIES = join(ROOT, 'bin', 'memories.ts')
const cliOf = (host: Host) => join(host.root, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')
const DAY = 86_400_000
// Background work that starts the engine two or three times (a dry run, a backup, the sweep): generous, since the machine may be busy.
const SLOW = 40_000

type Done = { exitCode: number; stdout: string; stderr: string }
async function memories(args: readonly string[], stdin?: string): Promise<Done> {
  const child = Bun.spawn([process.execPath, MEMORIES, ...args], {
    env: { ...(process.env as Record<string, string>), ...isolatedEnv('memories') },
    stdin: stdin === undefined ? 'ignore' : new Blob([stdin]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { exitCode, stdout, stderr }
}
/** `--store <host store>` first, then the command. */
const onStore = (host: Host, ...args: string[]) => memories(['--store', host.store, ...args])

type Row = { id: string; content: string; memory_type: string; source: string; trust_tier: string | null; scope: string | null; session_id: string; valid_until: string | null; superseded_by: string | null; metadata_json: string | null; created_at: string | null; last_recalled: string | null; importance: number }
function db<T>(host: Host, work: (db: Database) => T, readonly = true): T {
  const handle = new Database(join(host.store, 'mnemopi.db'), readonly ? { readonly: true } : { readwrite: true })
  handle.run('PRAGMA busy_timeout = 10000')
  try {
    return work(handle)
  } finally {
    handle.close()
  }
}
const rowOf = (host: Host, id: string) => db(host, handle => handle.query('SELECT * FROM working_memory WHERE id = ?').get(id) as Row)
const countRows = (host: Host) => db(host, handle => (handle.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n)
const trailOf = (host: Host, id: string) => db(host, handle => handle.query('SELECT memory_id, validator, action, new_content, note FROM memory_validations WHERE memory_id = ? ORDER BY validated_at').all(id) as { memory_id: string; validator: string; action: string; new_content: string | null; note: string | null }[])

/** A kind of memory saved the way Claude saves it (owner global), by its text. */
async function save(host: Host, content: string, kind: string, extra: Record<string, unknown> = {}) {
  const saved = await host.tool('memory_remember', { content, kind, ...extra })
  expect(saved.deny).toBeUndefined()
  return JSON.parse(saved.result!).memory_id as string
}
/** A row for another owner, saved straight through the engine. */
async function saveAs(host: Host, owner: string, content: string, fields: Record<string, unknown>) {
  const replies = await engineCall(cliOf(host), host.store, owner, [toolCall(1, 'mnemopi_remember', { content, scope: 'global', ...fields })])
  return JSON.parse(replies.get(1).result.content[0].text).memory_id as string
}
/** Makes rows look `days` old and never recalled, with no expiry of their own. */
function age(host: Host, ids: readonly string[], days: number) {
  const old = new Date(Date.now() - days * DAY).toISOString()
  db(host, handle => handle.run(`UPDATE working_memory SET created_at = ?, timestamp = ?, valid_until = NULL, last_recalled = NULL WHERE id IN (${ids.map(() => '?').join(',')})`, [old, old, ...ids]), false)
}
const backups = (host: Host) => (existsSync(join(host.root, 'backups')) ? readdirSync(join(host.root, 'backups')).filter(name => name.endsWith('.db')) : [])
const expireArgs = (host: Host, ...more: string[]) => ['--store', host.store, 'expire', '--root', host.root, ...more]

// A store with one old row of each sort the sweep must tell apart.
async function seedSweep(host: Host) {
  const ids = {
    context: await save(host, 'The staging cluster is rebuilt every Friday evening by the platform team.', 'context'),
    error: await save(host, 'The flaky login test fails when the clock is set past midnight in CI.', 'error'),
    event: await save(host, 'We held the incident review for the March outage with the whole team.', 'event'),
    artifact: await save(host, 'The architecture notes live in the wiki under Platform > Overview.', 'artifact'),
    pinned: await save(host, 'The migration window for the billing database is the second weekend of June.', 'context'),
    fact: await save(host, 'The release branch is cut from main on the first Monday of the month.', 'fact'),
    preference: await save(host, 'Rohit prefers short replies without a closing summary paragraph.', 'preference'),
    instruction: await save(host, 'Always run the full test suite before tagging a release build.', 'instruction'),
    decision: await save(host, 'We chose SQLite over Postgres because the store must stay one local file.', 'decision'),
    fresh: await save(host, 'The new onboarding checklist was added to the repo this week by the team.', 'context'),
    retired: await save(host, 'The old deploy script was replaced by the pipeline in the spring.', 'context'),
    expiring: await save(host, 'The sprint board is reset at the start of every second Tuesday.', 'context'),
  }
  await host.tool('memory_update', { memory_id: ids.pinned, pinned: true })
  const oldIds = [ids.context, ids.error, ids.event, ids.artifact, ids.pinned, ids.fact, ids.preference, ids.instruction, ids.decision, ids.retired, ids.expiring]
  age(host, oldIds, 120)
  // a retired row (it has a replacement) and one with an expiry of its own, both old
  db(host, handle => {
    handle.run('UPDATE working_memory SET superseded_by = ? WHERE id = ?', [ids.fresh, ids.retired])
    handle.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [new Date(Date.now() + 5 * DAY).toISOString(), ids.expiring])
  }, false)
  return ids
}
const SWEPT = ['context', 'error', 'event', 'artifact'] as const

describe('SESSION.4: bin/memories.ts expire is a dry run Rohit can read', () => {
  test('it lists the old, unpinned rows of the four kinds with id, kind, last used and the first 80 characters, and changes nothing', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    const before = countRows(host)
    const done = await memories(expireArgs(host, '--days', '90', '--owner', 'global'))
    expect(done.exitCode).toBe(0)
    expect(done.stdout).toContain('Dry run: nothing was changed.')
    for (const kind of SWEPT) expect(done.stdout).toContain(ids[kind])
    for (const kept of ['pinned', 'fact', 'preference', 'instruction', 'decision', 'fresh', 'retired', 'expiring'] as const) expect(done.stdout).not.toContain(ids[kept])
    expect(done.stdout).toContain('The staging cluster is rebuilt every Friday evening by the platform team.'.slice(0, 80))
    expect(done.stdout).toContain('--apply')
    // nothing changed: same rows, no expiry set, no backup made, no audit row
    expect(countRows(host)).toBe(before)
    for (const kind of SWEPT) {
      expect(rowOf(host, ids[kind]).valid_until).toBeNull()
      expect(trailOf(host, ids[kind])).toEqual([])
    }
    expect(backups(host)).toEqual([])
  })

  test('--json gives the candidates as data', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    const done = await memories(expireArgs(host, '--days', '90', '--owner', 'global', '--json'))
    const report = JSON.parse(done.stdout) as { dryRun: boolean; count: number; days: number; rows: { id: string; kind: string; last_used: string; preview: string }[] }
    expect(report.dryRun).toBe(true)
    expect(report.days).toBe(90)
    expect(report.rows.map(row => row.id).sort()).toEqual(SWEPT.map(kind => ids[kind]).sort())
    expect(report.rows.find(row => row.id === ids.error)).toMatchObject({ kind: 'error' })
    // no memory text in the data form: a program (the hook's sweep) never receives a preview
    for (const row of report.rows) expect(Object.keys(row).sort()).toEqual(['id', 'kind', 'last_used'])
    expect(done.stdout).not.toContain('staging cluster')
  })

  test('a row used less than the days ago is not a candidate; --days moves the line', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    const strict = JSON.parse((await memories(expireArgs(host, '--days', '200', '--owner', 'global', '--json'))).stdout) as { count: number }
    expect(strict.count).toBe(0)
    const loose = JSON.parse((await memories(expireArgs(host, '--days', '30', '--owner', 'global', '--json'))).stdout) as { rows: { id: string }[] }
    expect(loose.rows.map(row => row.id)).not.toContain(ids.fresh)
    expect(loose.rows).toHaveLength(4)
  })

  test('only the owner\'s own rows: another owner\'s old note is not listed, and is listed for its owner', async () => {
    const host = await open()
    const mine = await save(host, 'The staging cluster is rebuilt every Friday evening by the platform team.', 'context')
    const theirs = await saveAs(host, 'project-other-1', 'The other project rotates its test database every Sunday night.', { memory_type: 'context', source: 'claude-code' })
    age(host, [mine, theirs], 120)
    const global = JSON.parse((await memories(expireArgs(host, '--owner', 'global', '--json'))).stdout) as { rows: { id: string }[] }
    expect(global.rows.map(row => row.id)).toEqual([mine])
    const other = JSON.parse((await memories(expireArgs(host, '--owner', 'project-other-1', '--json'))).stdout) as { rows: { id: string }[] }
    expect(other.rows.map(row => row.id)).toEqual([theirs])
  })

  test('--limit caps the list', async () => {
    const host = await open()
    await seedSweep(host)
    const done = JSON.parse((await memories(expireArgs(host, '--owner', 'global', '--limit', '2', '--json'))).stdout) as { count: number; limit: number }
    expect(done).toMatchObject({ count: 2, limit: 2 })
    expect((await memories(expireArgs(host, '--limit', '0'))).exitCode).not.toBe(0)
    expect((await memories(expireArgs(host, '--limit', '201'))).exitCode).not.toBe(0)
  })

  test('days under 30, 0 and nonsense are refused before the engine is asked, and nothing changes', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    for (const days of ['7', '29', '0', '-5', 'abc', '45.5']) {
      for (const apply of [false, true]) {
        const done = await memories(expireArgs(host, '--days', days, '--owner', 'global', ...(apply ? ['--apply'] : [])))
        expect(done.exitCode).not.toBe(0)
        expect(done.stderr.length).toBeGreaterThan(0)
      }
    }
    for (const kind of SWEPT) expect(rowOf(host, ids[kind]).valid_until).toBeNull()
    expect(backups(host)).toEqual([])
  })

  test('an unknown option is refused', async () => {
    const host = await open()
    expect((await memories(expireArgs(host, '--kinds', 'fact'))).exitCode).not.toBe(0)
    expect((await memories(expireArgs(host, '--force'))).exitCode).not.toBe(0)
  })

  test('no store yet is a clean "nothing to expire"', async () => {
    const host = await open()
    const done = await memories(['--store', join(host.home, 'empty-store'), 'expire', '--root', host.root, '--json'])
    expect(done.exitCode).toBe(0)
    expect(JSON.parse(done.stdout)).toMatchObject({ count: 0, rows: [] })
  })
})

describe('SESSION.4: bin/memories.ts expire --apply only ever expires, after a backup', () => {
  test('it backs up first, expires the four kinds that are old and unpinned, and touches nothing else; nothing is deleted', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    const before = countRows(host)
    const snapshot = Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, rowOf(host, id)]))
    const done = await memories(expireArgs(host, '--days', '90', '--owner', 'global', '--apply'))
    expect(done.exitCode).toBe(0)
    expect(done.stdout).toContain(`Expired 4 memories of owner global`)
    expect(backups(host)).toHaveLength(1)
    expect(done.stdout).toContain(join(host.root, 'backups'))
    // nothing deleted
    expect(countRows(host)).toBe(before)
    // the four are expired: an end date in the past-or-now, nothing else about the row changed
    for (const kind of SWEPT) {
      const after = rowOf(host, ids[kind])
      expect(after.valid_until).not.toBeNull()
      expect(Date.parse(after.valid_until!)).toBeLessThanOrEqual(Date.now() + 1000)
      expect({ ...after, valid_until: null }).toEqual({ ...snapshot[kind]!, valid_until: null })
    }
    // every other row is exactly as it was
    for (const kept of ['pinned', 'fact', 'preference', 'instruction', 'decision', 'fresh', 'retired', 'expiring'] as const) expect(rowOf(host, ids[kept])).toEqual(snapshot[kept]!)
    // the audit trail: one 'expire' row each, named expire-sweep, with no memory text
    for (const kind of SWEPT) {
      expect(trailOf(host, ids[kind])).toEqual([{ memory_id: ids[kind], validator: 'expire-sweep', action: 'expire', new_content: null, note: null }])
    }
    // and the backup holds the rows as they were
    const copy = new Database(join(host.root, 'backups', backups(host)[0]!), { readonly: true })
    try {
      expect((copy.query('SELECT valid_until FROM working_memory WHERE id = ?').get(ids.context) as { valid_until: string | null }).valid_until).toBeNull()
      expect((copy.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n).toBe(before)
    } finally {
      copy.close()
    }
  })

  test('an expired row comes back with update restore', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    await memories(expireArgs(host, '--owner', 'global', '--apply'))
    expect(rowOf(host, ids.context).valid_until).not.toBeNull()
    const restored = await engineCall(cliOf(host), host.store, 'global', [toolCall(1, 'mnemopi_update', { memory_id: ids.context, restore: true, validator: 'dashboard' })])
    expect(JSON.parse(restored.get(1).result.content[0].text).status).toBe('restored')
    expect(rowOf(host, ids.context).valid_until).toBeNull()
  })

  test('a second run finds nothing left and makes no second backup', async () => {
    const host = await open()
    await seedSweep(host)
    await memories(expireArgs(host, '--owner', 'global', '--apply'))
    expect(backups(host)).toHaveLength(1)
    const again = await memories(expireArgs(host, '--owner', 'global', '--apply'))
    expect(again.exitCode).toBe(0)
    expect(again.stdout).toContain('Nothing to expire')
    expect(backups(host)).toHaveLength(1)
  })

  test('with nothing to expire no backup is made at all (a daily no-op must not push older backups out)', async () => {
    const host = await open()
    await save(host, 'The release branch is cut from main on the first Monday of the month.', 'fact')
    const done = await memories(expireArgs(host, '--owner', 'global', '--apply'))
    expect(done.exitCode).toBe(0)
    expect(backups(host)).toEqual([])
  })

  test('a failed backup stops the sweep before any change', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    // the backups folder cannot be made: a plain file sits where it should be
    writeFileSync(join(host.root, 'backups'), 'not a folder')
    const done = await memories(expireArgs(host, '--owner', 'global', '--apply'))
    expect(done.exitCode).not.toBe(0)
    expect(done.stderr).toContain('the backup before the sweep failed')
    expect(done.stderr).toContain('nothing was expired')
    for (const kind of SWEPT) {
      expect(rowOf(host, ids[kind]).valid_until).toBeNull()
      expect(trailOf(host, ids[kind])).toEqual([])
    }
  })

  test('pinned means never: even at the lowest days a pinned context note is not touched', async () => {
    const host = await open()
    const ids = await seedSweep(host)
    await memories(expireArgs(host, '--days', '30', '--owner', 'global', '--apply'))
    expect(rowOf(host, ids.pinned).valid_until).toBeNull()
    expect(JSON.parse(rowOf(host, ids.pinned).metadata_json!).pinned).toBe(true)
  })
})

describe('SESSION.4: the daily marker', () => {
  test('sweep-claim says due once, then not due for 24 hours; the marker is 0600', async () => {
    const host = await open()
    mkdirSync(host.root, { recursive: true })
    const first = JSON.parse((await memories(['sweep-claim', host.root])).stdout)
    expect(first).toEqual({ due: true })
    const marker = join(host.root, 'expire-sweep.json')
    expect((statSync(marker).mode & 0o777).toString(8)).toBe('600')
    expect(JSON.parse((await memories(['sweep-claim', host.root])).stdout)).toEqual({ due: false })
    // 23 hours on: still not due; 25 hours on: due again
    writeFileSync(marker, `${JSON.stringify({ at: new Date(Date.now() - 23 * 3_600_000).toISOString() })}\n`)
    expect(JSON.parse((await memories(['sweep-claim', host.root])).stdout)).toEqual({ due: false })
    writeFileSync(marker, `${JSON.stringify({ at: new Date(Date.now() - 25 * 3_600_000).toISOString() })}\n`)
    expect(JSON.parse((await memories(['sweep-claim', host.root])).stdout)).toEqual({ due: true })
    // a marker nobody can read is a due sweep, not a stuck one
    writeFileSync(marker, 'garbage')
    expect(JSON.parse((await memories(['sweep-claim', host.root])).stdout)).toEqual({ due: true })
  })

  test('sweep-claim refuses --store and a bad folder argument', async () => {
    const host = await open()
    expect((await memories(['--store', host.store, 'sweep-claim', host.root])).exitCode).not.toBe(0)
    expect((await memories(['sweep-claim'])).exitCode).not.toBe(0)
    expect((await memories(['sweep-claim', '--x'])).exitCode).not.toBe(0)
  })
})

describe('SESSION.4: the hook sweeps once a day, from session start and from a first prompt', () => {
  async function sweptHost(options: Record<string, unknown> = {}) {
    const host = await open({ options })
    const ids = await seedSweep(host)
    return { host, ids }
  }
  const expired = (host: Host, ids: Record<string, string>) => SWEPT.filter(kind => rowOf(host, ids[kind]!).valid_until !== null)

  test('session start sweeps in the background: backup, expiry of the four, one activity line of ids and counts', async () => {
    const { host, ids } = await sweptHost()
    await host.sessionStart()
    await until('the sweep', () => expired(host, ids).length === 4 && host.activity().some(line => line.action === 'expire'), SLOW)
    expect(backups(host)).toHaveLength(1)
    const line = host.activity().find(entry => entry.action === 'expire')!
    expect(line).toMatchObject({ origin: 'session', owner: 'global', ok: true, count: 4 })
    expect([...line.ids].sort()).toEqual(SWEPT.map(kind => ids[kind]!).sort())
    // ids and counts, never a memory's text
    expect(JSON.stringify(line)).not.toContain('staging cluster')
    expect(JSON.stringify(line)).not.toContain('flaky login')
    for (const kind of SWEPT) expect(trailOf(host, ids[kind]!)[0]).toMatchObject({ validator: 'expire-sweep', action: 'expire' })
    // a pin and the other kinds are untouched
    expect(rowOf(host, ids.pinned!).valid_until).toBeNull()
    expect(rowOf(host, ids.fact!).valid_until).toBeNull()
  })

  test('a second trigger inside 24 hours runs nothing', async () => {
    const { host, ids } = await sweptHost()
    await host.sessionStart()
    await until('the sweep', () => expired(host, ids).length === 4, SLOW)
    await until('the marker', () => existsSync(join(host.root, 'expire-sweep.json')), SLOW)
    const runs = host.memoriesRuns().filter(run => run.argv.includes('expire')).length
    expect(runs).toBe(1)
    // new old rows appear; a new first prompt and its reply, and another session start, do not sweep them
    const extra = await save(host, 'The nightly report job writes into the shared drive every night.', 'context')
    age(host, [extra], 200)
    await host.sessionStart()
    host.setSession('later')
    await host.prompt('Please plan a trip to Lisbon. Is it sunny there?')
    await host.turn()
    await Bun.sleep(1500)
    expect(host.memoriesRuns().filter(run => run.argv.includes('expire'))).toHaveLength(1)
    expect(rowOf(host, extra).valid_until).toBeNull()
    expect(backups(host)).toHaveLength(1)
    // a day and an hour later the marker is old: the next trigger sweeps the new row
    writeFileSync(join(host.root, 'expire-sweep.json'), `${JSON.stringify({ at: new Date(Date.now() - 25 * 3_600_000).toISOString() })}\n`)
    host.setSession('later2')
    await host.prompt('Please plan a trip to Porto. Is it sunny there?')
    await host.turn()
    await until('the next sweep', () => rowOf(host, extra).valid_until !== null, SLOW)
    expect(backups(host)).toHaveLength(2)
  })

  test('the first prompt and its reply trigger a sweep even with no session start (a /clear process)', async () => {
    const { host, ids } = await sweptHost()
    host.setSession('after-clear')
    await host.prompt('What was I doing? Please recall the context.')
    await Bun.sleep(300)
    expect(expired(host, ids)).toEqual([])
    await host.turn()
    await until('the sweep', () => expired(host, ids).length === 4, SLOW)
    expect(backups(host)).toHaveLength(1)
  })

  test('expireUnusedDays 0 turns the sweep off', async () => {
    const { host, ids } = await sweptHost({ expireUnusedDays: 0 })
    await host.sessionStart()
    host.setSession('later')
    await host.prompt('Another first prompt. Nothing to sweep, please.')
    await host.turn()
    await Bun.sleep(1500)
    expect(expired(host, ids)).toEqual([])
    expect(host.memoriesRuns().filter(run => run.argv.includes('expire') || run.argv.includes('sweep-claim'))).toHaveLength(0)
    expect(existsSync(join(host.root, 'expire-sweep.json'))).toBe(false)
  })

  test('a refused value (1-29) runs no sweep', async () => {
    const { host, ids } = await sweptHost({ expireUnusedDays: 10 })
    await host.sessionStart()
    await Bun.sleep(1500)
    expect(expired(host, ids)).toEqual([])
    expect(host.memoriesRuns().filter(run => run.argv.includes('expire'))).toHaveLength(0)
    expect(backups(host)).toEqual([])
  })

  test('the days of the option are the line: 150 days leaves 120-day-old rows alone', async () => {
    const { host, ids } = await sweptHost({ expireUnusedDays: 150 })
    await host.sessionStart()
    await until('the claim', () => host.memoriesRuns().some(run => run.argv.includes('expire')))
    await Bun.sleep(500)
    expect(expired(host, ids)).toEqual([])
    expect(backups(host)).toEqual([])
  })

  test('a failed backup stops the hook\'s sweep too: no row is touched and a failed line says why', async () => {
    const { host, ids } = await sweptHost()
    writeFileSync(join(host.root, 'backups'), 'not a folder')
    await host.sessionStart()
    await until('the failed line', () => host.activity().some(line => line.action === 'expire'), SLOW)
    const line = host.activity().find(entry => entry.action === 'expire')!
    expect(line).toMatchObject({ origin: 'session', ok: false })
    expect(line.error).toContain('the backup before the sweep failed')
    expect(expired(host, ids)).toEqual([])
  })

  test('an engine that is not installed sweeps nothing and starts nothing', async () => {
    const host = await open({ engineBuild: '0.0.1' })
    await host.sessionStart()
    await Bun.sleep(500)
    expect(host.memoriesRuns().filter(run => run.argv.includes('expire') || run.argv.includes('sweep-claim'))).toHaveLength(0)
  })
})

describe('SESSION.1: session-pending markers', () => {
  const entry = (id: string) => ({ sessionId: id, owner: 'global', transcript: `/home/u/.claude/projects/-work/${id}.jsonl` })

  test('write, list (newest first) and remove; the folder is 0700 and each file 0600', async () => {
    const host = await open()
    mkdirSync(host.root, { recursive: true })
    for (const id of ['first', 'second', 'third']) {
      expect((await memories(['session-pending', 'write', host.root], JSON.stringify(entry(id)))).exitCode).toBe(0)
      await Bun.sleep(15)
    }
    const folder = join(host.root, 'session-pending')
    expect((statSync(folder).mode & 0o777).toString(8)).toBe('700')
    expect((statSync(join(folder, 'first.json')).mode & 0o777).toString(8)).toBe('600')
    const listed = JSON.parse((await memories(['session-pending', 'list', host.root])).stdout) as { sessionId: string }[]
    expect(listed.map(item => item.sessionId)).toEqual(['third', 'second', 'first'])
    // the file holds the three fields and nothing else
    expect(Object.keys(JSON.parse(readFileSync(join(folder, 'first.json'), 'utf8'))).sort()).toEqual(['owner', 'sessionId', 'transcript'])
    expect((await memories(['session-pending', 'remove', host.root, 'second'])).exitCode).toBe(0)
    expect(readdirSync(folder).sort()).toEqual(['first.json', 'third.json'])
  })

  test('a marker with an unsafe id or owner, or extra arguments, is refused; a foreign file in the folder is not listed', async () => {
    const host = await open()
    mkdirSync(join(host.root, 'session-pending'), { recursive: true })
    for (const bad of [{ ...entry('x'), sessionId: '../x' }, { ...entry('x'), owner: 'a/b' }, { sessionId: 'x', owner: 'global' }, 'nope']) {
      const done = await memories(['session-pending', 'write', host.root], typeof bad === 'string' ? bad : JSON.stringify(bad))
      expect(done.exitCode).not.toBe(0)
    }
    expect((await memories(['session-pending', 'write', host.root, 'extra'], JSON.stringify(entry('ok1')))).exitCode).not.toBe(0)
    expect((await memories(['session-pending', 'remove', host.root, '../x'])).exitCode).not.toBe(0)
    expect((await memories(['--store', host.store, 'session-pending', 'list', host.root])).exitCode).not.toBe(0)
    writeFileSync(join(host.root, 'session-pending', 'torn.json'), '{"sessionId":')
    writeFileSync(join(host.root, 'session-pending', 'mismatch.json'), JSON.stringify(entry('other')))
    expect(JSON.parse((await memories(['session-pending', 'list', host.root])).stdout)).toEqual([])
  })
})

describe('SESSION.2: bin/memories.ts first-prompt and summarised read the store and write nothing', () => {
  // A summary row exactly as the summary run saves it.
  const summary = (host: Host, owner: string, text: string, session: string, fields: Record<string, unknown> = {}) =>
    saveAs(host, owner, text, { memory_type: 'event', source: 'import:session', trust_tier: 'IMPORTED', veracity: 'imported', metadata: { session }, valid_until: new Date(Date.now() + 30 * DAY).toISOString(), ...fields })

  test('the newest live summary of the owner, then the pinned rows the owner can see, most important first', async () => {
    const host = await open()
    await summary(host, 'global', 'The older session reworked the importer and left the docs open.', 'old-a')
    await Bun.sleep(15)
    const newest = await summary(host, 'global', 'The latest session fixed the sweep and left the Windows path open.', 'old-b')
    const low = await save(host, 'The low importance pin about the staging cluster rebuild schedule.', 'fact', { importance: 0.3 })
    const high = await save(host, 'The high importance pin about never pushing to the main branch.', 'instruction', { importance: 0.9 })
    const plain = await save(host, 'An ordinary memory that nobody pinned, about the release cadence.', 'fact')
    await host.tool('memory_update', { memory_id: low, pinned: true })
    await host.tool('memory_update', { memory_id: high, pinned: true })
    const done = await onStore(host, 'first-prompt', 'global', '5')
    expect(done.exitCode).toBe(0)
    const read = JSON.parse(done.stdout) as { summary: { id: string; owner: string; content: string } | null; pinned: { id: string; owner: string }[] }
    expect(read.summary).toMatchObject({ id: newest, owner: 'global', content: 'The latest session fixed the sweep and left the Windows path open.' })
    expect(read.pinned.map(row => row.id)).toEqual([high, low])
    expect(read.pinned.map(row => row.id)).not.toContain(plain)
  })

  test('a retired, expired or other owner\'s summary is not shown; pins that are retired, expired or private to another owner are not shown, a global pin of another owner is', async () => {
    const host = await open()
    const retired = await summary(host, 'global', 'A retired summary of a session about the importer work.', 's-retired')
    const expiredSummary = await summary(host, 'global', 'An expired summary of a session about the sweep work.', 's-expired', { valid_until: new Date(Date.now() - DAY).toISOString() })
    const foreign = await summary(host, 'project-other-1', 'Another project\'s summary of its own session work.', 's-foreign')
    const noSession = await saveAs(host, 'global', 'An event note that is not a summary run result at all, by hand.', { memory_type: 'event', source: 'claude-code' })
    db(host, handle => handle.run('UPDATE working_memory SET superseded_by = ? WHERE id = ?', [foreign, retired]), false)
    const none = JSON.parse((await onStore(host, 'first-prompt', 'global', '5')).stdout) as { summary: unknown }
    expect(none.summary).toBeNull()
    expect([expiredSummary, noSession]).toHaveLength(2)

    const pinnedLive = await save(host, 'A live pin about the deploy order of the services in production.', 'instruction')
    const pinnedRetired = await save(host, 'A retired pin about an old deploy order that no longer applies.', 'instruction')
    const pinnedExpired = await save(host, 'An expired pin about the freeze that ended last month for the team.', 'context')
    const privateElsewhere = await saveAs(host, 'project-other-1', 'A pin private to another project about its own board.', { memory_type: 'fact', scope: 'channel' })
    const globalElsewhere = await saveAs(host, 'project-other-1', 'A pin another project shared globally about the code style.', { memory_type: 'preference', scope: 'global' })
    for (const id of [pinnedLive, pinnedRetired, pinnedExpired]) await host.tool('memory_update', { memory_id: id, pinned: true })
    db(host, handle => {
      handle.run("UPDATE working_memory SET metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.pinned', json('true')) WHERE id IN (?, ?)", [privateElsewhere, globalElsewhere])
      handle.run('UPDATE working_memory SET superseded_by = ? WHERE id = ?', [pinnedLive, pinnedRetired])
      handle.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [new Date(Date.now() - DAY).toISOString(), pinnedExpired])
    }, false)
    const read = JSON.parse((await onStore(host, 'first-prompt', 'global', '5')).stdout) as { pinned: { id: string }[] }
    expect(read.pinned.map(row => row.id).sort()).toEqual([pinnedLive, globalElsewhere].sort())
  })

  test('the pin count is capped at 5 and follows the argument; 0 reads none', async () => {
    const host = await open()
    for (let i = 0; i < 7; i++) {
      const id = await save(host, `Pinned memory number ${i} about how the team does its weekly planning.`, 'fact')
      await host.tool('memory_update', { memory_id: id, pinned: true })
    }
    const count = async (arg: string) => (JSON.parse((await onStore(host, 'first-prompt', 'global', arg)).stdout) as { pinned: unknown[] }).pinned.length
    expect(await count('99')).toBe(5)
    expect(await count('2')).toBe(2)
    expect(await count('0')).toBe(0)
    expect((await onStore(host, 'first-prompt', 'global', '-1')).exitCode).not.toBe(0)
    expect((await onStore(host, 'first-prompt', '../x', '2')).exitCode).not.toBe(0)
    expect((await memories(['first-prompt', 'global'])).exitCode).not.toBe(0)
  })

  test('it writes nothing: the file is untouched by the read', async () => {
    const host = await open()
    const id = await save(host, 'A pinned fact about the way releases are tagged by the team.', 'fact')
    await host.tool('memory_update', { memory_id: id, pinned: true })
    const before = rowOf(host, id)
    await onStore(host, 'first-prompt', 'global', '5')
    await onStore(host, 'summarised', 'a', 'b')
    expect(rowOf(host, id)).toEqual(before)
  })

  test('summarised names the sessions that have a summary row, retired or expired ones too', async () => {
    const host = await open()
    await summary(host, 'global', 'A live summary of a session about the importer.', 'live-1')
    const old = await summary(host, 'global', 'An expired summary of a session about the sweep.', 'expired-1', { valid_until: new Date(Date.now() - DAY).toISOString() })
    await save(host, 'An ordinary fact that happens to mention nothing about sessions.', 'fact')
    expect(old).toBeTruthy()
    const done = JSON.parse((await onStore(host, 'summarised', 'live-1', 'expired-1', 'never-1')).stdout) as { done: string[] }
    expect(done.done.sort()).toEqual(['expired-1', 'live-1'])
    expect((await onStore(host, 'summarised', '../x')).exitCode).not.toBe(0)
  })
})

// ---- the whole path, through the real hooks ----

const TRANSCRIPT_SECRET = 'AKIAABCDEFGHIJKLMNOP'
function transcriptLines(turns: number) {
  const lines: string[] = []
  for (let i = 0; i < turns; i++) {
    lines.push(JSON.stringify({ type: 'user', message: { role: 'user', content: `Please fix the sweep, turn ${i}. The key is ${TRANSCRIPT_SECRET}.` } }))
    lines.push(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: `Fixed the sweep, turn ${i}.` }, { type: 'tool_use', id: 't', name: 'Bash', input: {} }] } }))
  }
  return `${lines.join('\n')}\n`
}
const SUMMARY = 'We reworked the unused-expiry sweep and left the Windows path for later.'
const answer = (text: string): ModelAnswer => ({ isAnswered: true, text })
const summaryRows = (host: Host) => db(host, handle => handle.query("SELECT * FROM working_memory WHERE memory_type = 'event' AND source = 'import:session'").all() as Row[])
const projectFolder = (host: Host) => join(host.home, '.claude', 'projects', '-work-My-Repo')
function writeTranscript(host: Host, id: string, turns = 4) {
  mkdirSync(projectFolder(host), { recursive: true })
  writeFileSync(join(projectFolder(host), `${id}.jsonl`), transcriptLines(turns))
}

describe('SESSION.1 and SESSION.2: the summary of the last session and the first-prompt block, end to end', () => {
  test('a /clear: session.end leaves a marker (no text); the next first prompt shows nothing yet; after its reply the summary is made, saved and the marker goes; the following first prompt shows it', async () => {
    const host = await open({ options: { sessionSummary: 'on' }, model: () => answer(SUMMARY) })
    writeTranscript(host, 'old-1')
    await host.sessionEnd('old-1', 'clear')
    const marker = join(host.root, 'session-pending', 'old-1.json')
    expect(JSON.parse(readFileSync(marker, 'utf8'))).toEqual({ sessionId: 'old-1', owner: 'global', transcript: join(projectFolder(host), 'old-1.jsonl') })
    expect((statSync(marker).mode & 0o777).toString(8)).toBe('600')
    // a marker is written without a model call or an engine run
    expect(host.model).toHaveLength(0)

    host.setSession('new-2')
    const first = await host.prompt('How do I run the build? Then deploy it.')
    // nothing to show yet: the summary is not made until the reply is over
    expect((first as { context?: string[] }).context?.some(text => text.includes('Last session')) ?? false).toBe(false)
    expect(host.model).toHaveLength(0)
    await host.turn()
    await until('the summary', () => summaryRows(host).length === 1 && !existsSync(marker), SLOW)
    const [saved] = summaryRows(host)
    expect(saved).toMatchObject({ content: SUMMARY, memory_type: 'event', source: 'import:session', trust_tier: 'IMPORTED', scope: 'global', session_id: 'global' })
    expect(JSON.parse(saved!.metadata_json!)).toEqual({ session: 'old-1' })
    const days = (Date.parse(saved!.valid_until!) - Date.now()) / DAY
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
    // one Haiku call, over the redacted conversation only: the secret in the transcript never left
    expect(host.model).toHaveLength(1)
    expect(host.model[0]!.request.model).toBe('haiku')
    expect(host.model[0]!.request.prompt).toContain('Please fix the sweep')
    expect(host.model[0]!.request.prompt).not.toContain(TRANSCRIPT_SECRET)
    expect(host.model[0]!.request.prompt).not.toContain('tool_use')
    // the activity line: ids and counts, no text
    const line = await until('the activity line', () => host.activity().find(entry => entry.action === 'remember' && entry.origin === 'session'), SLOW)
    expect(line).toMatchObject({ ids: [saved!.id], count: 1, ok: true })
    expect(JSON.stringify(line)).not.toContain('Windows path')

    // the next session's first prompt shows it, ahead of the recall, and calls no model
    host.setSession('new-3')
    const second = (await host.prompt('Where did we stop? Please continue the sweep work.')) as { context?: string[] }
    expect(second.context![0]).toContain(`- Last session [${saved!.id} owner=global] ${SUMMARY}`)
    expect(host.model).toHaveLength(1)
  })

  test('a session already summarised is not summarised again: its marker is dropped and the model is not called', async () => {
    const host = await open({ options: { sessionSummary: 'on' }, model: () => answer(SUMMARY) })
    writeTranscript(host, 'old-1')
    await host.sessionEnd('old-1')
    host.setSession('new-2')
    await host.prompt('First prompt of the second session, please help.')
    await host.turn()
    await until('the summary', () => summaryRows(host).length === 1, SLOW)
    await host.sessionEnd('old-1')
    expect(existsSync(join(host.root, 'session-pending', 'old-1.json'))).toBe(true)
    host.setSession('new-4')
    await host.prompt('First prompt of the fourth session, please help.')
    await host.turn()
    await until('the marker to go', () => !existsSync(join(host.root, 'session-pending', 'old-1.json')), SLOW)
    expect(host.model).toHaveLength(1)
    expect(summaryRows(host)).toHaveLength(1)
  })

  test('a lost call leaves the marker; the next first prompt finishes it', async () => {
    let calls = 0
    const host = await open({
      options: { sessionSummary: 'on' },
      model: () => (calls++ === 0 ? { isAnswered: false, reason: 'api-error', status: 500, error: 'server error' } : answer(SUMMARY)),
    })
    writeTranscript(host, 'old-1')
    await host.sessionEnd('old-1')
    host.setSession('new-2')
    await host.prompt('First prompt of the second session, please help.')
    await host.turn()
    await until('the first call', () => host.model.length === 1, SLOW)
    await Bun.sleep(500)
    expect(summaryRows(host)).toHaveLength(0)
    expect(existsSync(join(host.root, 'session-pending', 'old-1.json'))).toBe(true)
    host.setSession('new-3')
    await host.prompt('First prompt of the third session, please help.')
    await host.turn()
    await until('the summary', () => summaryRows(host).length === 1, SLOW)
    await until('the marker to go', () => !existsSync(join(host.root, 'session-pending', 'old-1.json')), SLOW)
  })

  test('a session with no transcript is dropped without a model call', async () => {
    const host = await open({ options: { sessionSummary: 'on' }, model: () => answer(SUMMARY) })
    await host.sessionEnd('ghost-1')
    host.setSession('new-2')
    await host.prompt('First prompt of the second session, please help.')
    await host.turn()
    await until('the marker to go', () => !existsSync(join(host.root, 'session-pending', 'ghost-1.json')), SLOW)
    expect(host.model).toHaveLength(0)
  })

  test('with the option off (the default) session.end leaves nothing and no summary is made', async () => {
    const host = await open({ model: () => answer(SUMMARY) })
    writeTranscript(host, 'old-1')
    await host.sessionEnd('old-1', 'clear')
    expect(existsSync(join(host.root, 'session-pending'))).toBe(false)
    host.setSession('new-2')
    await host.prompt('First prompt of the second session, please help.')
    await host.turn()
    await Bun.sleep(500)
    expect(host.model).toHaveLength(0)
    expect(summaryRows(host)).toHaveLength(0)
  })

  test('the first prompt: pinned memories and the summary go in ahead of the recall, a pin the recall finds is shown once, later prompts add nothing', async () => {
    const host = await open()
    const pinned = await save(host, 'Rohit prefers short replies without a closing summary paragraph.', 'preference')
    await host.tool('memory_update', { memory_id: pinned, pinned: true })
    await saveAs(host, 'global', SUMMARY, { memory_type: 'event', source: 'import:session', metadata: { session: 'old-1' }, valid_until: new Date(Date.now() + 30 * DAY).toISOString() })
    host.setSession('fresh-1')
    const first = (await host.prompt('Do you remember the short replies preference?')) as { context?: string[] }
    const context = first.context!
    expect(context[0]).toContain('Mnemosyne: what we were doing last time, and pinned memories:')
    expect(context[0]).toContain(`- Last session [`)
    expect(context[0]).toContain(`- Pinned [${pinned} owner=global] Rohit prefers short replies`)
    // the recall found the same pinned row; it is listed once, in the block
    expect(context.join('\n').split(pinned).length - 1).toBe(1)
    const later = (await host.prompt('and another thing about the replies preference')) as { context?: string[] }
    expect(later.context).toBeUndefined()
  })

  test('no summary and no pin adds nothing', async () => {
    const host = await open()
    await save(host, 'The release branch is cut from main on the first Monday of the month.', 'fact')
    const out = (await host.prompt('When is the release branch cut from main?')) as { context?: string[] }
    expect((out.context ?? []).some(text => text.includes('Mnemosyne: what we were doing last time'))).toBe(false)
  })

  test('the first-prompt recall switch off shows no block', async () => {
    const host = await open()
    mkdirSync(host.root, { recursive: true })
    writeFileSync(join(host.root, 'config.json'), JSON.stringify({ version: 1, recall: { firstPrompt: false } }))
    const id = await save(host, 'A pinned fact about the way releases are tagged by the team.', 'fact')
    await host.tool('memory_update', { memory_id: id, pinned: true })
    const out = (await host.prompt('How are releases tagged?')) as { context?: string[] }
    expect(out.context).toBeUndefined()
    expect(host.memoriesRuns().filter(run => run.argv.includes('first-prompt'))).toHaveLength(0)
  })

  test('the first prompt does not wait on the model or a summary: the block is one store read, and the summary call starts only after the reply', async () => {
    let gate: () => void = () => undefined
    const held = new Promise<void>(resolve => (gate = resolve))
    const host = await open({ options: { sessionSummary: 'on' }, model: async () => (await held, answer(SUMMARY)) })
    writeTranscript(host, 'old-1')
    await host.sessionEnd('old-1', 'clear')
    host.setSession('new-2')
    const started = Date.now()
    await host.prompt('First prompt while a summary is still owed, please help.')
    expect(Date.now() - started).toBeLessThan(8_000)
    expect(host.model).toHaveLength(0)
    await host.turn()
    await until('the model call to start', () => host.model.length === 1, SLOW)
    gate()
    await until('the summary', () => summaryRows(host).length === 1, SLOW)
  })
})
