// Issue #3, end to end through the real hooks: the real hooks/register.ts, the real
// engine, bin/projects.ts and bin/memories.ts over a temp HOME (see knowledge-host.ts).
// Each host is one Claude Code session in one folder; hosts that share a HOME are one
// user's sessions in different clones of a repo, a worktree, or an unrelated repo.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ownerId, remoteOwnerId } from '../../hooks/owner'
import { engineCall, toolCall } from './helpers'
import { makeHost, until } from './knowledge-host'
import type { Host } from './knowledge-host'

setDefaultTimeout(60_000)
const hosts: Host[] = []
const open = async (...args: Parameters<typeof makeHost>) => {
  const host = await makeHost(...args)
  hosts.push(host)
  return host
}
afterEach(() => {
  // The first host owns the HOME; the others only share it.
  for (const host of hosts.splice(0).reverse()) host.dispose()
})

const cliOf = (host: Host) => join(host.root, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')
const perProject = { scope: 'per-project', extractionModel: 'off' }
const owners = (host: Host) => {
  const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
  try {
    return db.query('SELECT content, session_id AS owner FROM working_memory ORDER BY content').all() as { content: string; owner: string }[]
  } finally {
    db.close()
  }
}
const recalled = async (host: Host, query: string) => {
  const reply = await host.tool('memory_recall', { query })
  expect(reply.deny).toBeUndefined()
  return String(reply.result)
}
const registryHas = (host: Host, owner: string) => async () => {
  try {
    return (JSON.parse(readFileSync(join(host.root, 'projects.json'), 'utf8')) as { projects: Record<string, { remoteKey?: string }> }).projects[owner]?.remoteKey !== undefined
  } catch {
    return false
  }
}

describe('one memory per repo (issue #3)', () => {
  test('an existing project keeps its memories; a second clone, a worktree and a moved copy share them; another repo does not', async () => {
    const main = { root: '/dev/Client-App', remote: 'git@github.com:Acme/Client-App.git' }
    const legacy = ownerId('per-project', main.root)

    // Before issue #3: the project already holds a memory under its path id.
    const first = await open({ options: perProject, repo: main })
    await engineCall(cliOf(first), first.store, legacy, [toolCall(1, 'mnemopi_remember', { content: 'Client-App deploys go through the staging slot first', scope: 'channel', source: 'claude-code' })])

    // A session in that folder: same owner, its memory recalled, and the registry learns the remote's hash.
    await first.sessionStart()
    expect(await recalled(first, 'staging slot deploys')).toContain('staging slot')
    await until('the registry records the remote hash', registryHas(first, legacy))

    // Another clone (https, other case, other folder), a worktree and a moved copy: each a new session.
    for (const repo of [
      { root: '/elsewhere/client-app-copy', remote: 'https://github.com/acme/client-app' },
      { root: '/dev/wt/Client-App-feature-x', remote: 'git@github.com:Acme/Client-App.git' },
      { root: '/new-laptop-folder/Client-App', remote: 'ssh://git@github.com:22/acme/client-app.git' },
    ]) {
      const clone = await open({ options: perProject, repo, sharedWith: { home: first.home } })
      await clone.sessionStart()
      expect(await recalled(clone, 'staging slot deploys')).toContain('staging slot')
      const saved = await clone.tool('memory_remember', { kind: 'fact', content: `Client-App note saved from ${repo.root}` })
      expect(saved.deny).toBeUndefined()
    }
    // Every save landed under the project's one owner.
    for (const row of owners(first)) expect(row.owner).toBe(legacy)

    // An unrelated repo of the same user sees none of it.
    const other = await open({ options: perProject, repo: { root: '/dev/Other', remote: 'git@github.com:acme/other.git' }, sharedWith: { home: first.home } })
    await other.sessionStart()
    expect(await recalled(other, 'staging slot deploys')).not.toContain('staging slot')
    await other.tool('memory_remember', { kind: 'fact', content: 'Other repo uses pnpm workspaces' })
    expect(owners(first).find(row => row.content.includes('pnpm'))?.owner).toBe(remoteOwnerId('github.com/acme/other'))

    // No remote, org or user in the registry.
    const registry = readFileSync(join(first.root, 'projects.json'), 'utf8')
    expect(registry.toLowerCase()).not.toContain('acme')
    expect(registry).not.toContain('git@')
  })

  test('a repo without a remote keeps the path id, and scope global is unchanged', async () => {
    const local = await open({ options: perProject, repo: { root: '/dev/scratch', remote: null } })
    await local.sessionStart()
    await local.tool('memory_remember', { kind: 'fact', content: 'Scratch repo holds throwaway spikes' })
    expect(owners(local)[0]?.owner).toBe(ownerId('per-project', '/dev/scratch'))

    const global = await open({ options: { extractionModel: 'off' }, repo: { root: '/dev/Client-App', remote: 'git@github.com:Acme/Client-App.git' } })
    await global.sessionStart()
    await global.tool('memory_remember', { kind: 'fact', content: 'Global fact for every repo' })
    expect(owners(global).find(row => row.content.startsWith('Global'))?.owner).toBe('global')
    expect(global.ran('/bin/projects.ts').filter(run => run.argv[2] === 'resolve')).toEqual([])
  })
})
