import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dir)

// Spawns that start nothing which reads HOME, so they need no env: property.
// Keyed by file:line; update the line if the file above it changes.
const ALLOW = new Set([
  'guard-audit.spec.ts:22', // bin/guard-audit.ts only reads the files it is given
  'ui-server.spec.ts:475', // `mkfifo`, a filesystem call
])

/** `src` with comments and the inside of string/template literals blanked (same length, same newlines). */
function mask(src: string): string {
  const out = src.split('')
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  const skipString = (i: number): number => {
    const q = src[i]
    let j = i + 1
    while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1
    return j + 1
  }
  const skipExpr = (start: number): number => {
    let depth = 1
    let j = start
    while (j < src.length && depth > 0) {
      const c = src[j]
      if (c === "'" || c === '"') j = skipString(j)
      else if (c === '`') j = skipTemplate(j)
      else {
        if (c === '{') depth++
        else if (c === '}') depth--
        j++
      }
    }
    return j
  }
  const skipTemplate = (i: number): number => {
    let j = i + 1
    while (j < src.length) {
      const c = src[j]
      if (c === '\\') j += 2
      else if (c === '`') return j + 1
      else if (c === '$' && src[j + 1] === '{') j = skipExpr(j + 2)
      else j++
    }
    return j
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i)
      const to = end === -1 ? src.length : end
      blank(i, to)
      i = to
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const to = end === -1 ? src.length : end + 2
      blank(i, to)
      i = to
    } else if (c === "'" || c === '"') {
      const end = skipString(i)
      blank(i + 1, end - 1)
      i = end
    } else if (c === '`') {
      const end = skipTemplate(i)
      blank(i + 1, end - 1)
      i = end
    } else i++
  }
  return out.join('')
}

const CLOSER: Record<string, string> = { '(': ')', '{': '}', '[': ']' }

/** Index of the bracket that closes the one at `open` (text already masked), or -1. */
function matchClose(text: string, open: number): number {
  const stack: string[] = []
  for (let j = open; j < text.length; j++) {
    const c = text[j] as string
    if (CLOSER[c]) stack.push(CLOSER[c] as string)
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return -1
      if (stack.length === 0) return j
    }
  }
  return -1
}

/** True when `literal` spreads an isolated env and no `process.env` spread comes after the last one. */
function isolatedLast(literal: string, isoVars: string[]): boolean {
  const iso = [/\.\.\.\s*isolatedEnv\s*\(/g, ...isoVars.map(v => new RegExp(`\\.\\.\\.\\s*${v}\\b`, 'g'))]
  const last = (re: RegExp) => {
    let at = -1
    for (const m of literal.matchAll(re)) at = m.index as number
    return at
  }
  const isoAt = Math.max(...iso.map(last))
  const procAt = last(/\.\.\.\s*\(?\s*process\.env\b/g)
  return isoAt !== -1 && isoAt > procAt
}

/** The `file:line` of each spawn in `text` whose env would not end in a temp HOME. */
export function realHomeOffenders(name: string, text: string): string[] {
  const code = mask(text)
  const isoVars = [...code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*isolatedEnv\s*\(/g)].map(m => m[1] as string)
  const offenders: string[] = []
  for (const m of code.matchAll(/(?<![\w$.])(?:Bun\.)?(?:spawnSync|spawn)\s*\(/g)) {
    const start = m.index as number
    if (/function\s+$/.test(code.slice(Math.max(0, start - 12), start))) continue
    const line = code.slice(0, start).split('\n').length
    const key = `${name}:${line}`
    if (ALLOW.has(key)) continue
    const open = start + m[0].length - 1
    const args = code.slice(open, matchClose(code, open) + 1)
    const envAt = args.search(/(?<![\w$.])env\s*:/)
    if (envAt === -1) {
      offenders.push(key)
      continue
    }
    let v = envAt + args.slice(envAt).indexOf(':') + 1
    while (/\s/.test(args[v] as string)) v++
    if (args[v] === '{') {
      if (!isolatedLast(args.slice(v, matchClose(args, v) + 1), isoVars)) offenders.push(key)
      continue
    }
    // Not a literal: `isolatedEnv(...)`, a variable holding it, or a helper in this file whose body is checked.
    const head = /^[\w$]+/.exec(args.slice(v))?.[0] ?? ''
    if (head === 'isolatedEnv' || isoVars.includes(head)) continue
    const def = head === '' ? null : new RegExp(`(?:const|let|var|function)\\s+${head.replace(/\$/g, '\\$')}\\b`).exec(code)
    if (!def) {
      offenders.push(key)
      continue
    }
    const rest = code.slice(def.index)
    const end = rest.search(/\n(?:[})]|[ \t]*\n)/)
    if (!isolatedLast(end === -1 ? rest : rest.slice(0, end + 2), isoVars)) offenders.push(key)
  }
  return offenders
}

describe('no spawned process inherits the real home', () => {
  test('the checker tells wrong order and missing env from the correct order', () => {
    const wrongOrder = `await Bun.spawn(['x'], { env: { ...isolatedEnv(), ...process.env }, stdout: 'pipe' })`
    const noEnv = `await Bun.spawn(['x'], { stdout: 'pipe', stderr: 'pipe' })`
    const correct = `await Bun.spawn(['x'], { env: { ...(process.env as Record<string, string>), ...isolatedEnv(), A: '1' }, stdout: 'pipe' })`
    expect(realHomeOffenders('snippet.ts', wrongOrder)).toEqual(['snippet.ts:1'])
    expect(realHomeOffenders('snippet.ts', noEnv)).toEqual(['snippet.ts:1'])
    expect(realHomeOffenders('snippet.ts', correct)).toEqual([])
  })

  test('the checker follows variables, helpers and multi-line spawns, and ignores strings', () => {
    const viaVar = `const iso = isolatedEnv()\nBun.spawnSync(['x'], { env: { ...process.env, ...iso } })`
    const viaVarWrong = `const iso = isolatedEnv()\nBun.spawnSync(['x'], { env: { ...iso, ...process.env } })`
    const helperOk = `const e = () => ({\n  ...process.env,\n  ...isolatedEnv(),\n})\nBun.spawn(['x'], { env: e() })`
    const helperWrong = `const e = () => ({\n  ...isolatedEnv(),\n  ...process.env,\n})\nBun.spawn(['x'], { env: e() })`
    const rawEnv = `Bun.spawn(['x'], { env: process.env })`
    const multiLine = `Bun.spawn(\n  ['x'],\n  {\n    env: {\n      ...process.env,\n      ...isolatedEnv(),\n    },\n  },\n)`
    const inString = "Bun.spawn(['x'], { env: { ...process.env, ...isolatedEnv() } }) // spawn( with no env\nconst s = `Bun.spawn(['y'])`"
    expect(realHomeOffenders('s.ts', viaVar)).toEqual([])
    expect(realHomeOffenders('s.ts', viaVarWrong)).toEqual(['s.ts:2'])
    expect(realHomeOffenders('s.ts', helperOk)).toEqual([])
    expect(realHomeOffenders('s.ts', helperWrong)).toEqual(['s.ts:5'])
    expect(realHomeOffenders('s.ts', rawEnv)).toEqual(['s.ts:1'])
    expect(realHomeOffenders('s.ts', multiLine)).toEqual([])
    expect(realHomeOffenders('s.ts', inString)).toEqual([])
  })

  test('every spawn in tests/bun puts isolatedEnv() after process.env', () => {
    const offenders: string[] = []
    let spawns = 0
    for (const name of readdirSync(DIR as string)) {
      if (!(name as string).endsWith('.ts') || name === 'no-real-home.spec.ts') continue
      const text = readFileSync(join(DIR as string, name), 'utf8')
      spawns += (mask(text).match(/(?<![\w$.])(?:Bun\.)?(?:spawnSync|spawn)\s*\(/g) ?? []).length
      offenders.push(...realHomeOffenders(name as string, text))
    }
    expect(spawns).toBeGreaterThan(10)
    expect(offenders).toEqual([])
  })
})
