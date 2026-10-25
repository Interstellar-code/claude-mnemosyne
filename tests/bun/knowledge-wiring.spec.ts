// KNOWX R2: the register-level specs. The hooks are the real hooks/register.ts;
// bin/memories.ts and the engine are the real ones over a temp HOME; only the
// model call is a stand-in (see knowledge-host.ts).
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { GOOD_REPLY, makeHost, until } from './knowledge-host'
import type { Host } from './knowledge-host'

setDefaultTimeout(30_000)
const hosts: Host[] = []
const open = async (...args: Parameters<typeof makeHost>) => {
  const host = await makeHost(...args)
  hosts.push(host)
  return host
}
afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose()
})

describe('finding 1: pending files through the real bin/memories.ts', () => {
  test('a memory_remember writes a 0600 pending file while the model call is open, removes it after the store, and logs an extract line', async () => {
    let release!: (answer: { isAnswered: true; text: string }) => void
    const host = await open({ model: () => new Promise(resolve => (release = resolve)) })
    const saved = await host.tool('memory_remember', { kind: 'fact', content: 'We deploy on Fridays' })
    expect(saved.result).toContain('memory_id')
    const id = JSON.parse(saved.result!).memory_id as string
    await until('the model call', () => host.model.length > 0)
    // The call is open: the pending file exists, named by the id, mode 0600, holding id/owner/sha.
    expect(host.pending()).toEqual([`${id}.json`])
    expect(host.mode(`${host.pendingDir}/${id}.json`)).toBe('600')
    expect(host.pendingEntry(id)).toMatchObject({ id, owner: 'global' })
    release({ isAnswered: true, text: GOOD_REPLY })
    const line = await until('the extract line', () => host.extractLines()[0])
    expect(line).toMatchObject({ action: 'extract', ok: true, count: 1, ids: [id] })
    expect(host.pending()).toEqual([])
  })
})
