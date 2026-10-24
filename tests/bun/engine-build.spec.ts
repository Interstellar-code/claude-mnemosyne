// ENG.5: one build number, in engine/package.json and in hooks/engine-build.ts.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENGINE_BUILD } from '../../hooks/engine-build'
import { ROOT } from './helpers'

test('ENGINE_BUILD is engine/package.json version', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'engine', 'package.json'), 'utf8'))
  expect(ENGINE_BUILD).toBe(pkg.version)
})

test('the build is the upstream base version plus a mnemosyne suffix, and the four @oh-my-pi deps stay pinned', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'engine', 'package.json'), 'utf8'))
  expect(ENGINE_BUILD).toMatch(/^18\.12\.3-mnemosyne\.\d+$/)
  // EMB.2.a1: fastembed is a real dependency (not only a peer), with ORT overridden.
  expect(pkg.dependencies).toEqual({
    '@oh-my-pi/pi-ai': '18.12.3',
    '@oh-my-pi/pi-catalog': '18.12.3',
    '@oh-my-pi/pi-natives': '18.12.3',
    '@oh-my-pi/pi-utils': '18.12.3',
    fastembed: '3.0.0',
  })
  expect(pkg.overrides).toEqual({ 'onnxruntime-node': '1.26.0', '@anush008/tokenizers': '0.6.0' })
})

test('hooks/engine-build.ts and hooks/tags.ts import nothing', () => {
  for (const file of ['engine-build.ts', 'tags.ts']) {
    const text = readFileSync(join(ROOT, 'hooks', file), 'utf8')
    expect(text).not.toMatch(/^\s*import|^\s*export.*\sfrom\s|require\(/m)
  }
})

test('the installer\'s own timeouts stay well below the host\'s limit on setup (review r1 MED 3)', async () => {
  const { INSTALL_CHECK_TIMEOUT_MS, INSTALL_STEP_TIMEOUT_MS, SETUP_TIMEOUT_MS } = await import('../../hooks/engine-build')
  expect(INSTALL_STEP_TIMEOUT_MS + INSTALL_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(SETUP_TIMEOUT_MS - 30_000)
  const installer = readFileSync(join(ROOT, 'bin', 'install-engine.ts'), 'utf8')
  // The install step's timeout is proved behaviourally in install-engine.spec.ts
  // (installStep's runner call), so this reads only the check's call shape.
  expect(installer).toContain('INSTALL_CHECK_TIMEOUT_MS,')
  expect(installer).not.toMatch(/\d{3}_000/)
  expect(readFileSync(join(ROOT, 'hooks', 'register.ts'), 'utf8')).toContain('timeoutMs: SETUP_TIMEOUT_MS')
})
