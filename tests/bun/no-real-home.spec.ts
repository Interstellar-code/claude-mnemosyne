import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dir)

describe('no spawned process inherits the real home', () => {
  test('every Bun.spawn/spawnSync env ends with isolatedEnv() or a temp HOME', () => {
    const offenders: string[] = []
    for (const name of readdirSync(DIR as string)) {
      if (!(name as string).endsWith('.ts')) continue
      if (name === 'no-real-home.spec.ts') continue
      const text = readFileSync(join(DIR as string, name), 'utf8')
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!/Bun\.(spawn|spawnSync)\s*\(/.test(line as string) && !/spawn\s*\(/.test(line as string)) continue
        // gather the env object roughly: find matching closing by scanning until a line containing stdin/stdout/stderr or })
        let block = line
        let j = i
        while (j + 1 < lines.length && !/\}\s*\)/.test(lines[j] as string)) { j++; block += '\n' + (lines[j] as string) }
        if (!/env\s*:/.test(block as string)) continue
        const ok = /isolatedEnv\(\)/.test(block as string) || /serverEnv\(/.test(block as string) || /HOME:\s*[^,]*tmpdir|tmpdir\(\)/.test(block as string) || /HOME:\s*home\b/.test(block as string) || /HOME:\s*tmpHome/.test(block as string)
        if (!ok) offenders.push(`${name as string}:${i + 1}`)
      }
    }
    expect(offenders).toEqual([])
  })
})