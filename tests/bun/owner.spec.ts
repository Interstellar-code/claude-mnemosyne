import { describe, expect, test } from 'bun:test'
import { GLOBAL_OWNER, ownerId, slashes } from '../../hooks/owner'

// Expected ids computed with the formula as it stood in hooks/register.ts at
// 8dfb382 (before SA.1 moved it): every stored owner id depends on them.
describe('ownerId (SA.1)', () => {
  test('global unless the scope is per-project', () => {
    expect(GLOBAL_OWNER).toBe('global')
    expect(ownerId('global', '/Users/a/dev/my-repo')).toBe('global')
    expect(ownerId(undefined, '/Users/a/dev/my-repo')).toBe('global')
  })

  test('a plain path, with or without a trailing slash', () => {
    expect(ownerId('per-project', '/Users/a/dev/my-repo')).toBe('project-my-repo-c4jtfk')
    expect(ownerId('per-project', '/Users/a/dev/my-repo/')).toBe('project-my-repo-c4jtfk')
  })

  test('/ is named root', () => {
    expect(ownerId('per-project', '/')).toBe('project-root-45h')
  })

  test('non-ASCII runs fold to - in the name and still hash', () => {
    expect(ownerId('per-project', '/Users/a/dev/naïve 日本語')).toBe('project-na-ve--iq4hx1')
  })

  test('an astral character hashes by code point, not by UTF-16 unit', () => {
    const path = '/Users/a/dev/emoji-😀'
    expect(ownerId('per-project', path)).toBe('project-emoji--2kjcmd')
    let perUnit = 5381
    for (let i = 0; i < path.length; i++) perUnit = ((perUnit * 33) ^ path.charCodeAt(i)) >>> 0
    expect(ownerId('per-project', path).endsWith(`-${perUnit.toString(36)}`)).toBe(false)
  })

  test('a backslash path hashes as its forward-slash form', () => {
    expect(ownerId('per-project', 'C:\\Users\\a\\dev\\my-repo')).toBe('project-my-repo-1lcxm6x')
    expect(ownerId('per-project', 'C:/Users/a/dev/my-repo')).toBe('project-my-repo-1lcxm6x')
  })

  test('slashes turns backslashes forward and drops trailing slashes', () => {
    expect(slashes('C:\\a\\b\\\\')).toBe('C:/a/b')
    expect(slashes('/a/b//')).toBe('/a/b')
  })
})
