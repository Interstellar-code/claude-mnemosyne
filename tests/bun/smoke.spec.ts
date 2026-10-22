import { expect, test } from 'bun:test'

// The Bun test setup runs: Bun APIs and the import-free hook modules load here.
test('bun specs run with Bun APIs and the shared hook modules', async () => {
  const { ENGINE_BUILD } = await import('../../hooks/engine-build')
  const { cleanTags } = await import('../../hooks/tags')
  expect(typeof Bun.version).toBe('string')
  expect(ENGINE_BUILD).toMatch(/^18\.12\.3-mnemosyne\.\d+$/)
  expect(cleanTags([' A ', 'a'])).toEqual(['a'])
})
