// MAPX.5: the solar-system scene (ui/solar.ts) on the vendored three.js, with a stub
// renderer and composer, a fake canvas and a fake clock (tests/bun/solar-fakes.ts). No WebGL,
// no DOM, no real wait: frames are run by the fake clock. The galaxy is the C11 fixture.
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fixture from './fixtures/galaxy-c11.json'
import { FakeCanvas, FakeClock, FakeComposer, FakeRenderer, installFakeDom } from './solar-fakes'
import type { FakeContext2d } from './solar-fakes'
import { buildBodies, searchResults, STYLES } from '../../ui/solar-layout'
import { ROOT } from './helpers'

// The vendored bundle reads window at load time, and ui/solar.ts is DOM code (checked by
// ui/tsconfig.json): both are loaded after the fake DOM is in place, by a path tsc does not follow.
const dom = installFakeDom()
const three = (await import(join(ROOT, 'ui', 'vendor', 'map-lib.js'))) as Record<string, any>
const solar = (await import(join(ROOT, 'ui', 'solar.ts'))) as Record<string, any>
const { BLOOM, CLEAR_COLOUR, createSolarScene, memoryLook, SCENE_METHODS } = solar
afterAll(() => dom.restore())

const MATRIX = 'project-matrixkoder-1a2b3c'
const HERMES = 'project-hermes-switchui-4d5e6f'
const MNEMOSYNE = 'project-claude-mnemosyne-0d1e2f'
const COWORK = 'project-cowork-6d7e8f'
const SCRATCH = 'project-scratch-5a6b7c'
const DAY = 86_400_000

const galaxy = (): any => structuredClone(fixture)

// ---- The rig: one scene on a fake canvas, with its logs ----

class MatrixComposer extends FakeComposer {
  // A real composer renders, which updates the world matrices the raycaster reads.
  override render(): void {
    super.render()
    ;(this.scene as any).updateMatrixWorld()
    ;(this.camera as any).updateMatrixWorld()
  }
}

type Tip = string[] | null
function rig(options: { reduced?: boolean; data?: any; withData?: boolean; view?: Record<string, unknown> } = {}) {
  dom.setReducedMotion(options.reduced ?? true)
  const canvas = new FakeCanvas(dom.document)
  const clock = new FakeClock()
  const hovers: { tip: Tip; x: number; y: number }[] = []
  const picks: any[] = []
  const levels: any[] = []
  let renderer!: FakeRenderer
  let composer!: MatrixComposer
  const scene = createSolarScene({
    canvas,
    three,
    clock,
    createRenderer: (c: any) => (renderer = new FakeRenderer(c)),
    createComposer: (r: any, s: any, c: any) => (composer = new MatrixComposer(r, s, c)),
    onHover: (tip: Tip, x: number, y: number) => hovers.push({ tip, x, y }),
    onPick: (target: any) => picks.push(target),
    onLevel: (level: any) => levels.push(level),
  })
  if (options.view) scene.setView(options.view)
  if (options.withData !== false) scene.setData(options.data ?? galaxy())
  clock.tick()
  const camera = composer.camera as any
  const sceneRoot = composer.scene as any

  const all = (pred: (o: any) => boolean): any[] => {
    const out: any[] = []
    sceneRoot.traverse((o: any) => {
      if (pred(o)) out.push(o)
    })
    return out
  }
  const worldPos = (o: any) => {
    const v = new three.Vector3()
    o.getWorldPosition(v)
    return v
  }
  const rigApi = {
    canvas,
    clock,
    hovers,
    picks,
    levels,
    scene,
    camera,
    sceneRoot,
    get renderer() {
      return renderer
    },
    get composer() {
      return composer
    },
    all,
    worldPos,
    /** The group that holds comets, beams, pulses and satellites. */
    fx: () => sceneRoot.children[1],
    planet: (owner: string) => all(o => o.userData?.kind === 'planet' && o.userData.id === owner)[0],
    run: (seconds: number) => clock.run(seconds),
    /** Where a world position falls on the 800 x 600 canvas. */
    screen(o: any) {
      const v = worldPos(o).project(camera)
      return { x: ((v.x + 1) / 2) * 800, y: ((1 - v.y) / 2) * 600 }
    },
    /** Moves the pointer to a canvas point and gives the tooltip it raised, or null. */
    hover(x: number, y: number): Tip {
      const before = hovers.length
      canvas.emit('pointermove', { clientX: x, clientY: y })
      return hovers.length > before ? (hovers[hovers.length - 1] as { tip: Tip }).tip : null
    },
    click(x: number, y: number) {
      canvas.emit('pointerdown', { clientX: x, clientY: y })
      canvas.emit('click', { clientX: x, clientY: y })
    },
    /** Sweeps the pointer over a window of the canvas; gives the first point whose tooltip passes `want`. */
    locate(want: (tip: string[]) => boolean, box = { x0: 0, y0: 0, x1: 800, y1: 600 }, step = 8) {
      for (let y = box.y0; y < box.y1; y += step) {
        for (let x = box.x0; x < box.x1; x += step) {
          const tip = rigApi.hover(x, y)
          if (tip && want(tip)) return { x, y, tip }
        }
      }
      return null
    },
    /** Every kind of tooltip the sweep finds, by what its title says. */
    kinds(box?: { x0: number; y0: number; x1: number; y1: number }, step = 10) {
      const seen = new Map<string, string[]>()
      const b = box ?? { x0: 0, y0: 0, x1: 800, y1: 600 }
      for (let y = b.y0; y < b.y1; y += step) {
        for (let x = b.x0; x < b.x1; x += step) {
          const tip = rigApi.hover(x, y)
          if (tip) {
            const kind = kindOf(tip)
            if (!seen.has(kind)) seen.set(kind, tip)
          }
        }
      }
      rigApi.hover(-5, -5)
      return seen
    },
    lastLevel: () => levels[levels.length - 1],
    dist: (a: any, b: any) => a.distanceTo(b),
  }
  return rigApi
}

/** What a tooltip is, from its title and last line. */
function kindOf(tip: string[]): string {
  const [title = '', second = ''] = tip
  if (title.startsWith('Memory store')) return 'sun'
  if (title.endsWith('(writer nodule)')) return 'nodule'
  if (title.startsWith('Tag: ')) return tip.length === 3 && tip[2] === 'click: light its memories' ? 'surface-tag' : 'craft-tag'
  if (title.startsWith('Global memory')) return 'sun-belt'
  if (title.startsWith('Outer belt · ')) return 'outer-belt'
  if (title.startsWith('Black hole')) return 'black-hole'
  if (title.startsWith('Knowledge')) return 'satellite'
  if (title.includes(' moon of ')) return 'moon'
  if (/ · memory \d+ of \d+$/.test(title)) return 'swarm-memory'
  if (title.endsWith(' memory') && tip.length === 3) return 'ring-memory'
  if (tip[tip.length - 1] === 'click to fly in') return 'planet'
  return `other:${title}:${second}`
}

const visibleChain = (o: any): boolean => {
  for (let n = o; n; n = n.parent) if (!n.visible) return false
  return true
}
const angleOf = (v: any): number => Math.atan2(v.z, v.x)

// ---- C13: the interface ----

describe('MAPX.5 the C13 interface', () => {
  test('createSolarScene returns exactly the seven methods of C13', () => {
    const r = rig({ withData: false })
    expect(Object.keys(r.scene).sort()).toEqual([...SCENE_METHODS].sort())
    expect([...SCENE_METHODS].sort()).toEqual(['dispose', 'event', 'flyTo', 'setData', 'setView', 'showView', 'zoom'])
    for (const name of SCENE_METHODS) expect(typeof r.scene[name]).toBe('function')
    r.scene.dispose()
  })

  test('the renderer and composer are injected; the approved clear colour and bloom are set', () => {
    const r = rig()
    expect(r.renderer.clearColor).toBe(0x010205)
    expect(CLEAR_COLOUR).toBe(0x010205)
    expect(r.composer.bloom).toEqual({ strength: 0.375, radius: 0.3, threshold: 0.6 })
    expect(BLOOM).toEqual({ strength: 0.375, radius: 0.3, threshold: 0.6 })
    expect(r.renderer.size).toEqual([800, 600])
    expect(r.composer.renders).toBeGreaterThan(0)
    r.scene.dispose()
  })

  test('a renderer that cannot be made throws and leaves no listener behind', () => {
    const canvas = new FakeCanvas(dom.document)
    expect(() =>
      createSolarScene({ canvas, three, clock: new FakeClock(), createRenderer: () => { throw new Error('no context') } }),
    ).toThrow(/WebGL is not available: no context/)
    expect(canvas.listenerCount()).toBe(0)
  })

  test('setView before setData is kept, and an empty galaxy draws without error', () => {
    const r = rig({ withData: false, view: { arrange: 'size', colour: 'recalls', query: 'zz' } })
    r.run(1)
    r.scene.setData({ projects: [], memories: [], writers: [], globalLive: 0 })
    r.run(1)
    expect(r.planet(MATRIX)).toBeUndefined()
    r.scene.dispose()
  })
})

// ---- hover, click, flights ----

describe('MAPX.5 hover', () => {
  test('every hover kind: sun, nodule, planet, ring dot, sun belt, outer belt and black hole from afar', () => {
    const r = rig()
    // The ring dots, belts and holes are small: look for each over the whole canvas.
    const seen = r.kinds(undefined, 6)
    for (const kind of ['sun', 'planet', 'ring-memory', 'sun-belt', 'black-hole']) expect([...seen.keys()]).toContain(kind)
    r.scene.dispose()
  })

  test('the nodule and the outer belt have their tooltips', () => {
    const r = rig()
    // The sun is still (reduced motion): look at it from the views until a nodule faces the camera.
    let found: { tip: string[] } | null = null
    for (const view of ['reset', 'top', 'side', 'below']) {
      r.scene.showView(view as 'top')
      for (const source of ['claude-code', 'imported']) {
        const nodule = r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith(`${source} `))[0]
        const spot = r.screen(nodule)
        found = r.locate(t => kindOf(t) === 'nodule', { x0: spot.x - 10, y0: spot.y - 10, x1: spot.x + 10, y1: spot.y + 10 }, 2)
        if (found) break
      }
      if (found) break
    }
    expect(found).not.toBeNull()
    expect((found as any).tip[1]).toMatch(/^wrote \d+ memories$/)
    r.scene.showView('reset')
    const claude = r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith('claude-code'))[0]
    expect(claude.userData.tip).toEqual(['claude-code (writer nodule)', 'wrote 121 memories', '100 of them backfilled: drawn a little fainter'])
    const imported = r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith('imported'))[0]
    expect(imported.userData.tip[2]).toBe('all written under its own name')

    // Outer belt: the fixture holds three memories that are not live. Hover each dot where it is drawn.
    const belt = r.all(o => o.userData?.kind === 'points' && o.userData.items.length === 3 && o.userData.items[0].tip[0].startsWith('Outer belt'))[0]
    expect(belt.userData.items.map((i: any) => i.tip[0])).toEqual(['Outer belt · a retired memory', 'Outer belt · an expired memory', 'Outer belt · a lapsed memory'])
    expect(belt.userData.items[0].tip[3]).toBe('Restore in Review sends it back to its planet')
    expect(belt.userData.items[1].tip[1]).toMatch(/^expired by the sweep: unused 90 days, 2026-10-16$/)
    expect(belt.userData.items[2].tip[1]).toBe('its own expiry date passed: 2026-10-23')
    expect(belt.userData.items[0].tip[2]).toMatch(/^from hermes-switchui · /)
    const seen = new Set<string>()
    for (let i = 0; i < 3; i++) {
      const a = belt.geometry.attributes.position
      const v = new three.Vector3(a.getX(i), a.getY(i), a.getZ(i))
      belt.localToWorld(v)
      v.project(r.camera)
      const tip = r.hover(((v.x + 1) / 2) * 800, ((1 - v.y) / 2) * 600)
      if (tip && kindOf(tip) === 'outer-belt') seen.add(tip[0] as string)
    }
    expect(seen.size).toBeGreaterThan(0)
    r.scene.dispose()
  })

  test('at Planet level: land, moons, memories, a craft tag light', () => {
    const r = rig()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.run(0.2)
    const P = r.planet(MATRIX)
    const c = r.screen(P)
    const box = { x0: Math.max(0, c.x - 330), y0: 0, x1: Math.min(800, c.x + 330), y1: 600 }
    const seen = r.kinds(box, 6)
    for (const kind of ['planet', 'surface-tag', 'moon', 'swarm-memory']) expect([...seen.keys()]).toContain(kind)
    const tag = seen.get('surface-tag') as string[]
    expect(tag[1]).toMatch(/^used \d+ times here( · also on \d+ other planets?| · only on this planet)$/)

    r.scene.flyTo({ level: 'planet', owner: COWORK })
    r.run(0.2)
    const station = r.planet(COWORK)
    const s = r.screen(station)
    const lit = r.kinds({ x0: Math.max(0, s.x - 250), y0: Math.max(0, s.y - 200), x1: Math.min(800, s.x + 250), y1: Math.min(600, s.y + 200) }, 4)
    expect([...lit.keys()]).toContain('craft-tag')
    expect((lit.get('craft-tag') as string[])[2]).toBe('a lit panel on the station')
    r.scene.dispose()
  })

  test('the planet tooltip names the orbit, counts, black holes, and says when the orbit is shared', () => {
    const r = rig()
    const at = r.screen(r.planet(MATRIX))
    const found = r.locate(t => kindOf(t) === 'planet', { x0: at.x - 25, y0: at.y - 25, x1: at.x + 25, y1: at.y + 25 }, 3)
    expect(found).not.toBeNull()
    const tip = (found as any).tip as string[]
    expect(tip[0]).toBe('matrixkoder')
    expect(tip[1]).toMatch(/^Jupiter-like gas giant|Saturn-like gas giant/)
    expect(tip[1]).toContain('repo on github.com')
    expect(tip[1]).toMatch(/one orbit every \d+ min$/)
    expect(tip[2]).toBe('48 memories · 27 tags · 5 kinds')
    expect(tip[4]).toBe('top tags: workflow-rules, planning, user-preferences')
    expect(tip[5]).toBe('similar memories: from hermes-switchui (3), to claude-mnemosyne (2)')
    expect(tip[6]).toBe('click to fly in')
    // 11 bodies, 10 rings: the two quietest share the outer ring, and only they say so.
    const owners = [...new Set(r.all(o => o.userData?.kind === 'planet').map((o: any) => o.userData.id as string))]
    expect(owners).toHaveLength(11)
    const sharing: string[] = []
    for (const owner of owners) {
      const spot = r.screen(r.planet(owner))
      // Another planet can sit in front along the line of sight: take the tooltip that is this planet's.
      const name = /^project-(.+)-[0-9a-z]+$/.exec(owner)?.[1] as string
      const hit = r.locate(t => kindOf(t) === 'planet' && (t[0] === name || t[0]?.startsWith(`${name} `) === true), { x0: spot.x - 20, y0: spot.y - 20, x1: spot.x + 20, y1: spot.y + 20 }, 2)
      expect(hit).not.toBeNull()
      if ((hit as any).tip[1].endsWith('(shared orbit)')) sharing.push(owner)
    }
    expect(sharing.sort()).toEqual([SCRATCH, 'project-downloads-1b2c3d'].sort())
    r.scene.dispose()
  })

  test('hovering slows the orbits to 15%', () => {
    const lead = (r: ReturnType<typeof rig>) => angleOf(r.worldPos(r.planet(MATRIX)))
    const free = rig({ reduced: false })
    const a0 = lead(free)
    free.run(4)
    const freeMove = Math.abs(lead(free) - a0)
    const held = rig({ reduced: false })
    const sun = held.screen(held.all(o => o.userData?.kind === 'sun')[0])
    expect(held.locate(t => kindOf(t) === 'sun' || kindOf(t) === 'nodule', { x0: sun.x - 6, y0: sun.y - 6, x1: sun.x + 6, y1: sun.y + 6 }, 2)).not.toBeNull()
    const b0 = lead(held)
    held.run(4)
    const heldMove = Math.abs(lead(held) - b0)
    expect(freeMove).toBeGreaterThan(0.03)
    expect(heldMove / freeMove).toBeGreaterThan(0.12)
    expect(heldMove / freeMove).toBeLessThan(0.18)
    free.scene.dispose()
    held.scene.dispose()
  })

  test('a drag does not raise a tooltip, and leaving the canvas hides it', () => {
    const r = rig()
    const at = r.screen(r.planet(MATRIX))
    const found = r.locate(t => kindOf(t) === 'planet', { x0: at.x - 25, y0: at.y - 25, x1: at.x + 25, y1: at.y + 25 }, 3) as any
    r.canvas.emit('pointerleave')
    expect(r.hovers[r.hovers.length - 1]?.tip).toBeNull()
    r.canvas.emit('pointerdown', { clientX: found.x, clientY: found.y })
    const n = r.hovers.length
    r.canvas.emit('pointermove', { clientX: found.x + 30, clientY: found.y })
    expect(r.hovers.length).toBe(n)
    r.scene.dispose()
  })
})

describe('MAPX.5 clicks and flights', () => {
  test('a planet click picks it, flies to it and reports the level', () => {
    const r = rig()
    const at = r.screen(r.planet(MATRIX))
    const found = r.locate(t => kindOf(t) === 'planet', { x0: at.x - 25, y0: at.y - 25, x1: at.x + 25, y1: at.y + 25 }, 3) as any
    r.click(found.x, found.y)
    expect(r.picks).toEqual([{ level: 'planet', owner: MATRIX }])
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: MATRIX })
    const c = r.worldPos(r.planet(MATRIX))
    const R = 7 + Math.sqrt(48) * 2.5
    expect(r.camera.position.distanceTo(c)).toBeCloseTo(R * 1.4 * 6.5 + 30, 0)
    r.scene.dispose()
  })

  test('a moon click and a memory click go one level deeper each', () => {
    const r = rig()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.run(0.2)
    const c = r.screen(r.planet(MATRIX))
    const box = { x0: Math.max(0, c.x - 330), y0: 0, x1: Math.min(800, c.x + 330), y1: 600 }
    const moon = r.locate(t => kindOf(t) === 'moon' && t[0]?.includes(' moon of matrixkoder') === true, box, 4) as any
    expect(moon).not.toBeNull()
    r.picks.length = 0
    r.click(moon.x, moon.y)
    expect(r.picks).toHaveLength(1)
    expect(r.picks[0].level).toBe('moon')
    expect(r.picks[0].owner).toBe(MATRIX)
    const kind = r.picks[0].kind
    expect(moon.tip[0]).toContain(' moon of matrixkoder')
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind })

    // At Moon level the swarm spreads into a ring; click a dot that is a listed memory.
    r.run(2)
    const dot = r.locate(t => kindOf(t) === 'swarm-memory' && !t[1]?.startsWith('an older memory'), undefined, 4) as any
    expect(dot).not.toBeNull()
    r.click(dot.x, dot.y)
    const last = r.picks[r.picks.length - 1]
    expect(last.level).toBe('memory')
    expect(last.owner).toBe(MATRIX)
    expect(last.kind).toBe(kind)
    expect(typeof last.id).toBe('string')
    expect(r.lastLevel()).toEqual(last)
    r.scene.dispose()
  })

  test('a memory with no listed text (past the newest 2000) opens nothing', () => {
    const r = rig()
    r.scene.flyTo({ level: 'moon', owner: MATRIX, kind: 'instruction' })
    r.run(2)
    const anonymous = r.locate(t => kindOf(t) === 'swarm-memory' && t[1]?.startsWith('an older memory') === true, undefined, 4) as any
    expect(anonymous).not.toBeNull()
    r.picks.length = 0
    r.click(anonymous.x, anonymous.y)
    expect(r.picks).toEqual([])
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind: 'instruction' })
    r.scene.dispose()
  })

  test('a black hole flies to its partner planet', () => {
    const r = rig()
    const hole = r.locate(t => kindOf(t) === 'black-hole') as any
    expect(hole).not.toBeNull()
    const partner = /click to fly to (.+)$/.exec(hole.tip[3])?.[1]
    r.click(hole.x, hole.y)
    expect(r.picks).toHaveLength(1)
    expect(r.picks[0].level).toBe('planet')
    expect(partner).toBeDefined()
    const label = { [MATRIX]: 'matrixkoder', [HERMES]: 'hermes-switchui', [MNEMOSYNE]: 'claude-mnemosyne' }[r.picks[0].owner as string]
    expect(label).toBe(partner as string)
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: r.picks[0].owner })
    r.scene.dispose()
  })

  test('the sun and a nodule fly home; a click while a flight runs is ignored', () => {
    const r = rig({ reduced: false })
    r.scene.flyTo({ level: 'planet', owner: HERMES })
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: HERMES })
    r.run(0.3)
    const before = r.picks.length
    r.click(400, 300)
    expect(r.picks.length).toBe(before)
    r.run(2)
    const sun = r.all(o => o.userData?.kind === 'sun')[0]
    const spot = r.screen(sun)
    const found = r.locate(t => kindOf(t) === 'sun' || kindOf(t) === 'nodule', { x0: spot.x - 20, y0: spot.y - 20, x1: spot.x + 20, y1: spot.y + 20 }, 3)
    if (found) {
      r.click(found.x, found.y)
      expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    } else {
      r.scene.flyTo({ level: 'galaxy' })
      expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    }
    r.scene.dispose()
  })

  test('flyTo takes every level, and a target that is not there is ignored', () => {
    const r = rig()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: MATRIX })
    r.scene.flyTo({ level: 'moon', owner: MATRIX, kind: 'decision' })
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind: 'decision' })
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'decision', id: 'mem-002' })
    expect(r.lastLevel()).toEqual({ level: 'memory', owner: MATRIX, kind: 'decision', id: 'mem-002' })
    const count = r.levels.length
    r.scene.flyTo({ level: 'planet', owner: 'project-nowhere-000000' })
    r.scene.flyTo({ level: 'moon', owner: MATRIX, kind: 'no-such-kind' })
    expect(r.levels.length).toBe(count)
    // An id the list does not hold falls back to its moon; a kind with no moon, to the planet.
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'decision', id: 'mem-ghost' })
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind: 'decision' })
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'unknown', id: 'mem-ghost' })
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: MATRIX })
    r.scene.flyTo({ level: 'galaxy' })
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    r.scene.dispose()
  })

  test('with motion a flight takes 1.4 s and ends on the target; views and zoom move the camera', () => {
    const r = rig({ reduced: false })
    const start = r.camera.position.clone()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    expect(r.camera.position.distanceTo(start)).toBe(0)
    r.run(0.7)
    const mid = r.camera.position.distanceTo(start)
    expect(mid).toBeGreaterThan(10)
    expect(r.camera.fov).toBeGreaterThan(50)
    r.run(2)
    expect(r.camera.fov).toBe(50)
    const end = r.camera.position.clone()
    expect(end.distanceTo(start)).toBeGreaterThan(mid)
    // Zoom: a factor on the distance to the target.
    const target = r.worldPos(r.planet(MATRIX))
    const d0 = end.distanceTo(target)
    r.scene.zoom(0.5)
    expect(r.camera.position.distanceTo(target)).toBeCloseTo(d0 * 0.5, 0)
    r.scene.zoom(0)
    r.scene.zoom(-1)
    expect(r.camera.position.distanceTo(target)).toBeCloseTo(d0 * 0.5, 0)
    r.scene.dispose()
  })

  test('showView: Top, Below, Side and Reset', () => {
    const r = rig()
    const home = r.camera.position.clone()
    r.scene.showView('top')
    expect(r.camera.position.y).toBeGreaterThan(home.y)
    expect(Math.abs(r.camera.position.z)).toBeLessThan(1)
    r.scene.showView('below')
    expect(r.camera.position.y).toBeLessThan(0)
    r.scene.showView('side')
    expect(Math.abs(r.camera.position.y)).toBeLessThan(40)
    expect(r.camera.position.z).toBeGreaterThan(home.z)
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.scene.showView('reset')
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    expect(r.camera.position.distanceTo(home)).toBeLessThan(1)
    r.scene.dispose()
  })
})

// ---- Find and the filter ----

describe('MAPX.5 Find and the show/hide filter', () => {
  test('a query dims every body that does not match; clearing restores them', () => {
    const r = rig()
    const opacity = (owner: string) => r.planet(owner).material.opacity
    expect(opacity(MATRIX)).toBe(1)
    r.scene.setView({ query: 'hermes' })
    expect(opacity(HERMES)).toBe(1)
    expect(opacity(MATRIX)).toBe(0.15)
    const craft = r.planet(COWORK)
    expect(craft.material.opacity).toBe(0.15)
    r.scene.setView({ query: '' })
    expect(opacity(MATRIX)).toBe(1)
    expect(craft.material.opacity).toBe(1)
    // One letter is not a search.
    r.scene.setView({ query: 'h' })
    expect(opacity(MATRIX)).toBe(1)
    r.scene.dispose()
  })

  test('Find results fly there on Enter: the first result opens', () => {
    const r = rig()
    const bodies = buildBodies(galaxy(), Date.now())
    const planetHit = searchResults(bodies, 'matrix').results[0]
    expect(planetHit?.target).toEqual({ level: 'planet', owner: MATRIX })
    r.scene.setView({ query: 'matrix' })
    r.scene.flyTo((planetHit as any).target)
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: MATRIX })
    const moonHit = searchResults(bodies, 'instruction').results.find(x => x.type === 'Moon' && (x.target as any).owner === MATRIX)
    expect(moonHit?.target).toMatchObject({ level: 'moon', owner: MATRIX, kind: 'instruction' })
    r.scene.flyTo((moonHit as any).target)
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind: 'instruction' })
    const tagHit = searchResults(bodies, 'workflow').results.find(x => x.type === 'Tag')
    r.scene.flyTo((tagHit as any).target)
    expect(r.lastLevel().level).toBe('planet')
    r.scene.dispose()
  })

  test('hiding a body hides its label, orbit line and black holes without moving the camera', () => {
    const r = rig()
    const P = r.planet(HERMES)
    const orbitLine = P.parent.parent.parent.children[0]
    const holes = () => r.all(o => o.userData?.kind === 'hole' && visibleChain(o)).length
    const before = r.camera.position.clone()
    const sprites = () => r.all(o => o.isSprite && visibleChain(o)).length
    expect(holes()).toBe(12)
    expect(visibleChain(P)).toBe(true)
    const spriteCount = sprites()
    r.scene.setView({ hidden: { [HERMES]: true } })
    r.run(0.1)
    expect(visibleChain(P)).toBe(false)
    expect(orbitLine.visible).toBe(false)
    // hermes is on two of the three links: only matrixkoder <-> mnemosyne stays (two holes, each a core and a catcher).
    expect(holes()).toBe(4)
    expect(sprites()).toBeLessThan(spriteCount)
    expect(r.camera.position.distanceTo(before)).toBe(0)
    // Other bodies stay.
    expect(visibleChain(r.planet(MATRIX))).toBe(true)
    // Show all brings everything back.
    r.scene.setView({ hidden: {} })
    r.run(0.1)
    expect(visibleChain(P)).toBe(true)
    expect(orbitLine.visible).toBe(true)
    expect(holes()).toBe(12)
    expect(sprites()).toBe(spriteCount)
    r.scene.dispose()
  })

  test('hiding the body you are inside flies home', () => {
    const r = rig()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.scene.setView({ hidden: { [MATRIX]: true } })
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    r.scene.dispose()
  })

  test('Arrange moves planets to new rings and keeps their angle; Colour recolours the dots', () => {
    const r = rig({ reduced: false })
    const dist = (owner: string) => r.worldPos(r.planet(owner)).length()
    const hermesBefore = dist(HERMES)
    const matrixAngle = angleOf(r.worldPos(r.planet(MATRIX)))
    const canvases = dom.document.canvases.length
    r.scene.setView({ arrange: 'size' })
    r.run(0.25)
    expect(Math.abs(angleOf(r.worldPos(r.planet(MATRIX))) - matrixAngle)).toBeLessThan(0.05)
    // The labels are redrawn for the new metric.
    expect(dom.document.canvases.length).toBeGreaterThanOrEqual(canvases + 11)
    r.run(5)
    // Size puts hermes-switchui (62 memories) on the first ring.
    expect(dist(HERMES)).toBeLessThan(hermesBefore)
    expect(dist(HERMES)).toBeLessThan(dist(MATRIX))

    const dotsOf = r.all(o => o.userData?.ringOf === MNEMOSYNE)[0]
    const colour = dotsOf.geometry.attributes.color
    const before = [colour.getX(0), colour.getY(0), colour.getZ(0)]
    r.scene.setView({ colour: 'age' })
    const after = [colour.getX(0), colour.getY(0), colour.getZ(0)]
    expect(after).not.toEqual(before)
    r.scene.dispose()
  })

  test('auto-rotate turns the camera at Galaxy level only, and is off by default', () => {
    const turn = (rotate: boolean, reduced = false) => {
      const r = rig({ reduced, view: { rotate } })
      const a0 = angleOf(r.camera.position)
      r.run(3)
      const moved = Math.abs(angleOf(r.camera.position) - a0)
      r.scene.dispose()
      return moved
    }
    expect(turn(false)).toBeLessThan(0.001)
    expect(turn(true)).toBeGreaterThan(0.01)
    expect(turn(true, true)).toBeLessThan(0.001)
  })
})

// ---- live events ----

describe('MAPX.5 live events', () => {
  const ev = (kind: string, extra: Record<string, unknown> = {}) => ({ kind, ids: [], client: 'claude-code', t: '2026-10-25T10:00:00.000Z', owner: MATRIX, ...extra })
  const hex = (o: any) => o.material.color.getHexString()
  const nodulePos = (r: ReturnType<typeof rig>, source: string) => r.worldPos(r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith(`${source} `))[0])

  test('a recall is a gold comet from the planet towards the caller\'s nodule', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('recall'))
    expect(r.fx().children).toHaveLength(14)
    r.clock.tick()
    const head = r.fx().children[0]
    expect(hex(r.fx().children[1])).toBe('f0e442')
    const planet = r.worldPos(r.planet(MATRIX))
    const nodule = nodulePos(r, 'claude-code')
    const here = head.position
    expect(here.distanceTo(planet)).toBeLessThan(here.distanceTo(nodule))
    r.run(2.2)
    expect(r.fx().children).toHaveLength(0)
    r.scene.dispose()
  })

  test('a save is a blue comet from the writer\'s nodule to the planet', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('save', { ids: ['m-new'] }))
    expect(r.fx().children).toHaveLength(14)
    r.clock.tick()
    expect(hex(r.fx().children[1])).toBe('56b4e9')
    const head = r.fx().children[0].position
    const planet = r.worldPos(r.planet(MATRIX))
    const nodule = nodulePos(r, 'claude-code')
    expect(head.distanceTo(nodule)).toBeLessThan(head.distanceTo(planet))
    r.run(2.2)
    expect(r.fx().children).toHaveLength(0)
    r.scene.dispose()
  })

  test('an update is a green beam from the nodule to the planet', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('update', { ids: ['mem-001'] }))
    const beam = r.fx().children.find((o: any) => o.isLine)
    expect(beam).toBeDefined()
    expect(hex(beam)).toBe('3ddc97')
    r.run(0.5)
    expect(beam.material.opacity).toBeGreaterThan(0.5)
    const a = beam.geometry.attributes.position.array
    const planet = r.worldPos(r.planet(MATRIX))
    const nodule = nodulePos(r, 'claude-code')
    expect(Math.hypot(a[0] - nodule.x, a[1] - nodule.y, a[2] - nodule.z)).toBeLessThan(4)
    expect(Math.hypot(a[3] - planet.x, a[4] - planet.y, a[5] - planet.z)).toBeLessThan(4)
    r.run(1.5)
    expect(r.fx().children).toHaveLength(0)
    r.scene.dispose()
  })

  test('a forget is a red laser and the memory fades', () => {
    const r = rig({ reduced: false })
    const swarm = r.all(o => o.userData?.kind === 'points' && o.userData.items.some((i: any) => i.id === 'mem-001' && i.tip[0].includes(' of ')))[0]
    const at = swarm.userData.items.findIndex((i: any) => i.id === 'mem-001')
    const col = swarm.geometry.attributes.color
    const before = [col.getX(at), col.getY(at), col.getZ(at)]
    r.scene.event(ev('forget', { ids: ['mem-001'] }))
    const beam = r.fx().children.find((o: any) => o.isLine)
    expect(hex(beam)).toBe('ff4d4d')
    r.run(2)
    expect(r.fx().children).toHaveLength(0)
    const after = [col.getX(at), col.getY(at), col.getZ(at)]
    for (let k = 0; k < 3; k++) expect(after[k] as number).toBeCloseTo((before[k] as number) * 0.1, 4)
    // Another dot of the same swarm is untouched.
    const other = at === 0 ? 1 : 0
    expect(col.getX(other)).toBeGreaterThan(after[0] as number)
    r.scene.dispose()
  })

  test('an event from a client with no nodule starts at the sun\'s centre', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('save', { client: 'ghost-client' }))
    r.clock.tick()
    expect(r.fx().children[0].position.length()).toBeLessThan(6)
    r.run(2.2)
    r.scene.event(ev('save', { client: 'claude-code' }))
    r.clock.tick()
    expect(r.fx().children[0].position.length()).toBeGreaterThan(20)
    r.scene.dispose()
  })

  test('mcp:<client> finds the nodule of an outside client; the exact source wins', () => {
    const data = galaxy()
    data.writers.push({ source: 'mcp:cursor', count: 1, inferred: 0 })
    const r = rig({ reduced: false, data })
    r.scene.event(ev('save', { client: 'cursor' }))
    r.clock.tick()
    const nodule = nodulePos(r, 'mcp:cursor')
    expect(r.fx().children[0].position.distanceTo(nodule)).toBeLessThan(6)
    r.scene.dispose()
  })

  test('an event with owner global, or no owner, is a pulse on the sun and the nodule', () => {
    for (const owner of ['global', undefined, 'project-unknown-000000']) {
      const r = rig({ reduced: false })
      r.scene.event(ev('recall', owner === undefined ? { owner: undefined } : { owner }))
      expect(r.fx().children).toHaveLength(2)
      expect(r.fx().children.some((o: any) => o.isLine)).toBe(false)
      r.run(0.5)
      const [sun, nod] = r.fx().children
      expect(sun.material.opacity).toBeGreaterThan(0)
      expect(sun.position.length()).toBe(0)
      expect(nod.position.distanceTo(nodulePos(r, 'claude-code'))).toBeLessThan(1)
      r.run(1)
      expect(r.fx().children).toHaveLength(0)
      r.scene.dispose()
    }
  })

  test('the dashboard\'s own recall (Find) draws nothing; its other events draw', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('recall', { client: 'dashboard' }))
    r.scene.event(ev('recall', { client: 'dashboard', owner: 'global' }))
    expect(r.fx().children).toHaveLength(0)
    r.scene.event(ev('forget', { client: 'dashboard', ids: ['mem-002'] }))
    expect(r.fx().children.length).toBeGreaterThan(0)
    r.run(2)
    r.scene.dispose()
  })

  test('demo events from Simulate draw like any other', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('recall', { client: 'demo', demo: true }))
    expect(r.fx().children).toHaveLength(14)
    r.scene.dispose()
  })

  test('a hidden body shows no events; many events are capped', () => {
    const r = rig({ reduced: false, view: { hidden: { [MATRIX]: true } } })
    r.scene.event(ev('save'))
    expect(r.fx().children).toHaveLength(0)
    r.scene.setView({ hidden: {} })
    for (let i = 0; i < 100; i++) r.scene.event(ev('update'))
    expect(r.fx().children.length).toBeLessThanOrEqual(80)
    r.run(3)
    expect(r.fx().children).toHaveLength(0)
    r.scene.dispose()
  })

  test('with reduced motion a comet is a still glow at its end', () => {
    const r = rig({ reduced: true })
    r.scene.event(ev('save'))
    r.clock.tick()
    const planet = r.worldPos(r.planet(MATRIX))
    for (const sprite of r.fx().children) expect(sprite.position.distanceTo(planet)).toBeLessThan(1)
    r.scene.dispose()
  })

  test('the writer\'s nodule flares on a write', () => {
    const r = rig({ reduced: false })
    const nodule = r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith('claude-code'))[0]
    expect(nodule.scale.x).toBe(1)
    r.scene.event(ev('save'))
    r.clock.tick()
    expect(nodule.scale.x).toBeGreaterThan(1.5)
    r.run(1.5)
    expect(nodule.scale.x).toBe(1)
    r.scene.dispose()
  })
})

// ---- satellites, data refresh, beyond the mockup ----

describe('MAPX.5 satellites, data and extras', () => {
  test('satellites orbit an opened memory, one per knowledge item, and have tooltips', () => {
    const data = galaxy()
    data.knowledge = [
      { id: 'k1', kind: 'fact', text: 'the build uses bun', memory: 'mem-001' },
      { id: 'k2', kind: 'preference', text: 'tabs never spaces', memory: 'mem-001' },
      { id: 'k3', kind: 'fact', text: 'belongs to another memory', memory: 'mem-002' },
    ]
    const r = rig({ data })
    expect(r.all(o => o.userData?.kind === 'satellite')).toHaveLength(0)
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'instruction', id: 'mem-001' })
    r.run(2)
    const sats = r.all(o => o.userData?.kind === 'satellite')
    expect(sats).toHaveLength(2)
    expect(sats.map((s: any) => s.userData.tip[0]).sort()).toEqual(['Knowledge · fact', 'Knowledge · preference'])
    const at = r.screen(sats[0])
    const tip = r.hover(at.x, at.y)
    expect(tip && kindOf(tip)).toBe('satellite')
    expect(tip?.[1]).toMatch(/the build uses bun|tabs never spaces/)
    // Leaving the memory clears them.
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.run(0.5)
    expect(r.all(o => o.userData?.kind === 'satellite')).toHaveLength(0)
    // A memory with no knowledge items has none.
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'decision', id: 'mem-002' })
    r.run(0.5)
    expect(r.all(o => o.userData?.kind === 'satellite')).toHaveLength(1)
    r.scene.dispose()
  })

  test('the pinned halo shows once pins exist; asteroid size and brightness follow the memory', () => {
    const pinned = (r: ReturnType<typeof rig>) => r.all(o => o.userData?.kind === 'halo')
    const r = rig()
    // mem-001 is pinned: the matrixkoder ring and its instruction swarm each carry a halo.
    expect(pinned(r).length).toBeGreaterThanOrEqual(2)
    const ring = r.all(o => o.userData?.ringOf === MATRIX)[0]
    expect(ring.userData.halo.geometry.index.count).toBe(1)
    expect(ring.geometry.attributes.aSize.count).toBe(48)
    r.scene.dispose()
    const none = galaxy()
    for (const m of none.memories) m.pinned = false
    const r2 = rig({ data: none })
    expect(pinned(r2)).toHaveLength(0)
    r2.scene.dispose()

    const now = Date.parse('2026-10-25T12:00:00Z')
    const base = { recalls: 0, importance: 0.5, pinned: false, sourceInferred: false, validUntil: null }
    expect(memoryLook(null, now)).toEqual({ size: 1, brightness: 0.85, pinned: false, fading: false })
    expect(memoryLook({ ...base, importance: 1 }, now).size).toBeGreaterThan(memoryLook({ ...base, importance: 0 }, now).size)
    expect(memoryLook({ ...base, recalls: 20 }, now).brightness).toBeGreaterThan(memoryLook({ ...base, recalls: 0 }, now).brightness)
    expect(memoryLook({ ...base, sourceInferred: true }, now).brightness).toBeLessThan(memoryLook(base, now).brightness)
    const soon = memoryLook({ ...base, validUntil: new Date(now + 3 * DAY).toISOString() }, now)
    expect(soon.fading).toBe(true)
    expect(soon.brightness).toBeLessThan(memoryLook(base, now).brightness)
    expect(memoryLook({ ...base, validUntil: new Date(now + 30 * DAY).toISOString() }, now).fading).toBe(false)
    expect(memoryLook({ ...base, validUntil: new Date(now - DAY).toISOString() }, now).fading).toBe(false)
    expect(memoryLook({ ...base, pinned: true }, now).pinned).toBe(true)
  })

  test('the no remote and kind unknown marks show on their planets only', () => {
    const marks = (r: ReturnType<typeof rig>) => r.all(o => o.userData?.kind === 'mark')
    const plain = rig()
    // The fixture: every repo has a remote and every project has a record.
    expect(marks(plain)).toHaveLength(0)
    plain.scene.dispose()
    const data = galaxy()
    data.projects.find((p: any) => p.owner === MATRIX).remoteHost = null
    const noRemote = rig({ data })
    expect(marks(noRemote)).toHaveLength(1)
    noRemote.scene.dispose()
    data.projects.find((p: any) => p.owner === HERMES).projectKind = 'unknown'
    const r = rig({ data })
    expect(marks(r)).toHaveLength(2)
    expect(r.all(o => o.userData?.kind === 'mark').every(o => visibleChain(o))).toBe(true)
    r.scene.dispose()
  })

  test('setData again keeps positions and level; a level whose body is gone falls back', () => {
    const r = rig({ reduced: false })
    r.run(3)
    const at = r.worldPos(r.planet(MATRIX)).clone()
    const same = galaxy()
    same.projects.find((p: any) => p.owner === MATRIX).activity30 += 1
    r.scene.setData(same)
    r.clock.tick()
    expect(r.worldPos(r.planet(MATRIX)).distanceTo(at)).toBeLessThan(3)
    r.scene.flyTo({ level: 'planet', owner: SCRATCH })
    expect(r.lastLevel()).toEqual({ level: 'planet', owner: SCRATCH })
    const without = galaxy()
    without.projects = without.projects.filter((p: any) => p.owner !== SCRATCH)
    r.scene.setData(without)
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    expect(r.planet(SCRATCH)).toBeUndefined()
    // An opened memory keeps its satellites over a refresh; one that is gone drops back to its moon.
    const withKnowledge = galaxy()
    withKnowledge.knowledge = [{ id: 'k1', kind: 'fact', text: 'kept', memory: 'mem-001' }]
    r.scene.setData(withKnowledge)
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'instruction', id: 'mem-001' })
    r.run(0.5)
    expect(r.all(o => o.userData?.kind === 'satellite')).toHaveLength(1)
    r.scene.setData(withKnowledge)
    r.run(0.5)
    expect(r.lastLevel()).toEqual({ level: 'memory', owner: MATRIX, kind: 'instruction', id: 'mem-001' })
    expect(r.all(o => o.userData?.kind === 'satellite')).toHaveLength(1)
    // The opened memory or moon that is gone takes the camera home (the R5 fixes below test the camera).
    const lost = galaxy()
    lost.memories = lost.memories.filter((m: any) => m.id !== 'mem-001')
    r.scene.setData(lost)
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    r.scene.flyTo({ level: 'moon', owner: MATRIX, kind: 'fact' })
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind: 'fact' })
    const noFact = galaxy()
    const matrix = noFact.projects.find((p: any) => p.owner === MATRIX)
    matrix.kinds = matrix.kinds.filter((k: any) => k.kind !== 'fact')
    r.scene.setData(noFact)
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    r.scene.dispose()
  })

  test('the planet looks come from the layout: gas giants have bands, a station has parts, a ship has parts', () => {
    const r = rig()
    expect(r.all(o => o.userData?.kind === 'planet' && o.userData.id === COWORK).length).toBeGreaterThan(3)
    expect(r.all(o => o.userData?.kind === 'planet' && o.userData.id === SCRATCH).length).toBeGreaterThan(3)
    expect(r.all(o => o.userData?.kind === 'planet' && o.userData.id === HERMES)).toHaveLength(1)
    r.scene.dispose()
  })
})

// ---- fixes from the separate review of the port ----

describe('MAPX.5 review follow-ups', () => {
  test('onLevel fires only when the level changes', () => {
    const r = rig()
    r.scene.flyTo({ level: 'galaxy' })
    r.scene.showView('reset')
    expect(r.levels).toHaveLength(0)
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    expect(r.levels).toEqual([{ level: 'planet', owner: MATRIX }])
    r.scene.dispose()
  })

  test('reduced motion switching on in mid-flight leaves the controls on and the lens at 50', () => {
    const r = rig({ reduced: false })
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.run(0.5)
    expect(r.camera.fov).toBeGreaterThan(50)
    dom.setReducedMotion(true)
    r.scene.showView('top')
    expect(r.camera.fov).toBe(50)
    r.run(1)
    // The controls answer the wheel again (they would ignore it while disabled).
    const before = r.camera.position.distanceTo(r.worldPos(r.planet(MATRIX)))
    r.canvas.emit('wheel', { deltaY: -400 })
    r.run(0.5)
    expect(Math.abs(r.camera.position.distanceTo(r.worldPos(r.planet(MATRIX))) - before)).toBeGreaterThan(1)
    r.scene.dispose()
  })

  test('a planet that vanishes from fresh data takes the camera home', () => {
    const r = rig()
    r.scene.flyTo({ level: 'planet', owner: SCRATCH })
    const away = r.camera.position.clone()
    const without = galaxy()
    without.projects = without.projects.filter((p: any) => p.owner !== SCRATCH)
    r.scene.setData(without)
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    expect(r.camera.position.distanceTo(away)).toBeGreaterThan(50)
    r.scene.dispose()
  })

  test('a constructor that fails after the renderer exists frees it', () => {
    const canvas = new FakeCanvas(dom.document)
    const renderer = new FakeRenderer(canvas)
    expect(() =>
      createSolarScene({ canvas, three, clock: new FakeClock(), createRenderer: () => renderer, createComposer: () => { throw new Error('no composer') } }),
    ).toThrow('no composer')
    expect(renderer.disposed).toBe(true)
    expect(renderer.contextLost).toBe(true)
  })

  test('Colour dots by Recalls and Age follow the memory, not a stand-in', () => {
    const data = galaxy()
    const mem = (id: string) => data.memories.find((m: any) => m.id === id)
    mem('mem-002').recalls = 0
    mem('mem-001').recalls = 40
    mem('mem-001').sourceInferred = false
    mem('mem-002').sourceInferred = false
    const r = rig({ data, view: { colour: 'recalls' } })
    const colourOf = (id: string) => {
      const swarm = r.all(o => o.userData?.kind === 'points' && o.userData.items.some((i: any) => i.id === id && i.tip[0].includes(' of ')))[0]
      const at = swarm.userData.items.findIndex((i: any) => i.id === id)
      const c = swarm.geometry.attributes.color
      return [c.getX(at), c.getY(at), c.getZ(at)]
    }
    // Same brightness factor is not assumed: compare the hue lightness ordering through the red channel.
    expect(colourOf('mem-001')[0]).toBeGreaterThan(colourOf('mem-002')[0] as number)
    r.scene.setView({ colour: 'age' })
    mem('mem-001').created = new Date(Date.now() - 400 * DAY).toISOString()
    mem('mem-002').created = new Date().toISOString()
    r.scene.setData(data)
    expect(colourOf('mem-001')).not.toEqual(colourOf('mem-002'))
    r.scene.dispose()
  })

  test('Find dims the pinned halo with its planet, and refreshes keep the moons where they were', () => {
    const r = rig({ reduced: false })
    const halo = r.all(o => o.userData?.kind === 'halo')[0]
    expect(halo.material.opacity).toBe(0.6)
    r.scene.setView({ query: 'hermes' })
    expect(halo.material.opacity).toBe(0.1)
    r.scene.setView({ query: '' })
    expect(halo.material.opacity).toBe(0.6)
    r.run(5)
    const moon = () => r.all(o => o.userData?.kind === 'moon' && o.userData.planet === MATRIX && o.userData.id === 'instruction')[0]
    const turn = moon().parent.rotation.y
    r.scene.setData(galaxy())
    expect(moon().parent.rotation.y).toBeCloseTo(turn, 6)
    r.scene.dispose()
  })
})

// ---- motion, reduced motion, dispose ----

describe('MAPX.5 motion and dispose', () => {
  test('reduced motion stops orbits, pulses and flights', () => {
    const r = rig({ reduced: true })
    const at = r.worldPos(r.planet(MATRIX)).clone()
    r.run(10)
    expect(r.worldPos(r.planet(MATRIX)).distanceTo(at)).toBeLessThan(0.01)
    const before = r.camera.position.clone()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    expect(r.camera.position.distanceTo(before)).toBeGreaterThan(10)
    // No black-hole pulse is ever shown.
    for (let i = 0; i < 40; i++) {
      r.run(1)
      expect(r.all(o => o.userData?.kind === 'pulse' && o.visible)).toHaveLength(0)
    }
    r.scene.dispose()
  })

  test('one pulse of energy runs along each black-hole line every 30 seconds', () => {
    const r = rig({ reduced: false })
    const shown = () => r.all(o => o.userData?.kind === 'pulse' && o.visible)
    expect(r.all(o => o.userData?.kind === 'pulse')).toHaveLength(24)
    expect(shown()).toHaveLength(0)
    r.run(5)
    // The first line's pulse (eight lights) is under way.
    expect(shown()).toHaveLength(8)
    const head = shown()[0].position.clone()
    r.run(1)
    expect(shown()[0].position.distanceTo(head)).toBeGreaterThan(5)
    // Between the first pulse (ends at 11 s) and the second (starts at 12 s) nothing runs.
    r.run(5.3)
    expect(shown()).toHaveLength(0)
    r.run(2)
    expect(shown()).toHaveLength(8)
    r.scene.dispose()
  })

  test('the system setting is followed live', () => {
    const r = rig({ reduced: false })
    const at = r.worldPos(r.planet(MATRIX)).clone()
    dom.setReducedMotion(true)
    r.run(5)
    expect(r.worldPos(r.planet(MATRIX)).distanceTo(at)).toBeLessThan(0.01)
    r.scene.dispose()
  })

  test('35 seconds of simulated frames, with events, hovers, flights and view changes, without an error', () => {
    const r = rig({ reduced: false })
    const kinds = ['recall', 'save', 'update', 'forget']
    let pulses = 0
    for (let s = 0; s < 70; s++) {
      r.scene.event({ kind: kinds[s % 4], ids: ['mem-001'], client: s % 5 === 0 ? 'ghost' : 'claude-code', t: '', owner: s % 7 === 0 ? 'global' : [MATRIX, HERMES, COWORK, SCRATCH][s % 4] })
      r.hover(100 + ((s * 37) % 600), 100 + ((s * 53) % 400))
      if (s === 10) r.scene.flyTo({ level: 'planet', owner: HERMES })
      if (s === 25) r.scene.flyTo({ level: 'moon', owner: HERMES, kind: 'error' })
      if (s === 40) r.scene.flyTo({ level: 'galaxy' })
      if (s === 50) r.scene.setView({ arrange: 'recalls', colour: 'recalls', query: 'matrix' })
      if (s === 55) r.scene.setView({ hidden: { [COWORK]: true } })
      r.run(0.5)
      pulses += r.all(o => o.userData?.kind === 'pulse' && o.visible).length
    }
    expect(r.clock.frames).toBeGreaterThanOrEqual(35 / 0.016)
    expect(r.clock.now).toBeGreaterThanOrEqual(35_000)
    // One pulse of energy runs along each black-hole line every 30 s: seen at least once in 35 s.
    expect(pulses).toBeGreaterThan(0)
    r.scene.dispose()
  })

  test('dispose frees textures, geometries and materials, drops its listeners and loses the context', () => {
    const baseline = dom.document.listenerCount()
    const r = rig()
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.scene.event({ kind: 'save', ids: [], client: 'claude-code', t: '', owner: MATRIX })
    r.run(0.3)
    const freed = new Set<unknown>()
    const wanted = new Set<any>()
    const watch = (resource: any) => {
      if (!resource || wanted.has(resource) || typeof resource.dispose !== 'function') return
      wanted.add(resource)
      const original = resource.dispose.bind(resource)
      resource.dispose = () => {
        freed.add(resource)
        original()
      }
    }
    r.sceneRoot.traverse((o: any) => {
      watch(o.geometry)
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        watch(m)
        watch(m.map)
      }
    })
    expect(wanted.size).toBeGreaterThan(100)
    expect(r.canvas.listenerCount()).toBeGreaterThan(4)
    r.scene.dispose()
    const missed = [...wanted].filter(resource => !freed.has(resource))
    expect(missed).toHaveLength(0)
    expect(r.renderer.contextLost).toBe(true)
    expect(r.renderer.disposed).toBe(true)
    expect(r.composer.disposed).toBe(true)
    expect(r.canvas.listenerCount()).toBe(0)
    expect(dom.document.listenerCount()).toBe(baseline)
    expect(r.clock.pending()).toBe(false)
    // Dispose twice, and use after dispose, do nothing.
    r.scene.dispose()
    r.scene.setData(galaxy())
    r.scene.setView({ arrange: 'size' })
    r.scene.flyTo({ level: 'galaxy' })
    r.scene.event({ kind: 'save', ids: [], client: 'x', t: '' })
    r.scene.zoom(2)
    r.scene.showView('top')
    r.canvas.emit('click', { clientX: 10, clientY: 10 })
  })
})

// ---- review R5 fixes (round 2) ----

describe('MAPX.5 review R5 fixes', () => {
  const ev = (kind: string, extra: Record<string, unknown> = {}) => ({ kind, ids: [], client: 'claude-code', t: '2026-10-25T10:00:00.000Z', owner: MATRIX, ...extra })
  /** The colour a memory's dot has in its moon's swarm. */
  const dotColour = (r: ReturnType<typeof rig>, id: string): number[] => {
    const swarm = r.all(o => o.userData?.kind === 'points' && o.userData.items.some((i: any) => i.id === id && i.tip[0].includes(' of ')))[0]
    const at = swarm.userData.items.findIndex((i: any) => i.id === id)
    const c = swarm.geometry.attributes.color
    return [c.getX(at), c.getY(at), c.getZ(at)]
  }
  const ratio = (a: number[], b: number[]): number => Math.max(...a) / Math.max(...b)
  const quiet = (data: any, ids: string[]): void => {
    for (const m of data.memories) {
      if (!ids.includes(m.id)) continue
      m.source = 'claude-code'
      m.sourceInferred = false
      m.validUntil = null
      m.recalls = 0
    }
  }
  /** The camera's place once the Galaxy is framed: a fresh scene on the same data, never flown. */
  const homeOf = (data: any): any => {
    const ref = rig({ reduced: true, data })
    const home = ref.camera.position.clone()
    ref.scene.dispose()
    return home
  }

  // F1
  test('F1 dot brightness: 0.7 with no recalls, 1.0 (the mockup\'s own) from 20 recalls', () => {
    const now = Date.now()
    const base = { recalls: 0, importance: 0.5, pinned: false, sourceInferred: false, validUntil: null }
    expect(memoryLook(base, now).brightness).toBeCloseTo(0.7, 6)
    expect(memoryLook({ ...base, recalls: 20 }, now).brightness).toBeCloseTo(1, 6)
    expect(memoryLook({ ...base, recalls: 500 }, now).brightness).toBe(1)
    expect(memoryLook(null, now).brightness).toBeCloseTo(0.85, 6)
    // In the scene: the most recalled dot is the writer's own colour, untouched; a never recalled one is 0.7 of it.
    const data = galaxy()
    quiet(data, ['mem-001', 'mem-002'])
    data.memories.find((m: any) => m.id === 'mem-001').recalls = 20
    const r = rig({ data })
    const writer = r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith('claude-code'))[0].material.color
    const top = dotColour(r, 'mem-001')
    expect(top[0]).toBeCloseTo(writer.r, 5)
    expect(top[1]).toBeCloseTo(writer.g, 5)
    expect(top[2]).toBeCloseTo(writer.b, 5)
    expect(ratio(dotColour(r, 'mem-002'), top)).toBeCloseTo(0.7, 4)
    r.scene.dispose()
  })

  // F3
  test('F3 flying to a hidden owner shows it first and reports the level (planet, moon and memory)', () => {
    const r = rig({ reduced: true, view: { hidden: { [MATRIX]: true } } })
    expect(visibleChain(r.planet(MATRIX))).toBe(false)
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.clock.tick()
    expect(r.levels).toEqual([{ level: 'planet', owner: MATRIX }])
    expect(visibleChain(r.planet(MATRIX))).toBe(true)
    r.scene.flyTo({ level: 'galaxy' })
    r.scene.setView({ hidden: { [MATRIX]: true } })
    r.clock.tick()
    expect(visibleChain(r.planet(MATRIX))).toBe(false)
    r.scene.flyTo({ level: 'moon', owner: MATRIX, kind: 'decision' })
    r.clock.tick()
    expect(r.lastLevel()).toEqual({ level: 'moon', owner: MATRIX, kind: 'decision' })
    expect(visibleChain(r.planet(MATRIX))).toBe(true)
    r.scene.flyTo({ level: 'galaxy' })
    r.scene.setView({ hidden: { [MATRIX]: true } })
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'decision', id: 'mem-002' })
    r.clock.tick()
    expect(r.lastLevel()).toEqual({ level: 'memory', owner: MATRIX, kind: 'decision', id: 'mem-002' })
    expect(visibleChain(r.planet(MATRIX))).toBe(true)
    r.scene.dispose()
  })

  test('F3 a flyTo before the first setData is kept (the last one wins) and applied once data arrives', () => {
    // Where the camera lands when the same flight is asked for after the data.
    const twin = rig({ reduced: true })
    twin.scene.flyTo({ level: 'planet', owner: HERMES })
    const arrival = twin.camera.position.clone()
    twin.scene.dispose()

    const r = rig({ withData: false, reduced: true })
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.scene.flyTo({ level: 'planet', owner: HERMES })
    expect(r.levels).toEqual([])
    r.scene.setData(galaxy())
    expect(r.levels).toEqual([{ level: 'planet', owner: HERMES }])
    expect(r.camera.position.distanceTo(arrival)).toBeLessThan(1)
    // It is applied once: a second setData does not fly there again.
    r.scene.setData(galaxy())
    expect(r.levels).toHaveLength(1)
    r.scene.dispose()
  })

  // F4
  test('F4 reduced motion: satellites hold still, and move when motion is allowed', () => {
    const data = galaxy()
    data.knowledge = [
      { id: 'k1', kind: 'fact', text: 'a', memory: 'mem-001' },
      { id: 'k2', kind: 'fact', text: 'b', memory: 'mem-001' },
      { id: 'k3', kind: 'fact', text: 'c', memory: 'mem-001' },
    ]
    const drift = (reduced: boolean): number => {
      const r = rig({ data, reduced })
      r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'instruction', id: 'mem-001' })
      r.run(5)
      const sats = r.all(o => o.userData?.kind === 'satellite')
      expect(sats).toHaveLength(3)
      const before = sats.map((s: any) => s.position.clone())
      r.run(1.5)
      const moved = Math.max(...sats.map((s: any, i: number) => s.position.distanceTo(before[i])))
      r.scene.dispose()
      return moved
    }
    expect(drift(true)).toBeLessThan(0.001)
    expect(drift(false)).toBeGreaterThan(1)
  })

  test('F4 reduced motion: a beam and a pulse are drawn at a steady strength, not faded in and out', () => {
    const strengths = (reduced: boolean): { beam: number[]; pulse: number[] } => {
      const r = rig({ reduced })
      r.scene.event(ev('update'))
      const beam = r.fx().children.find((o: any) => o.isLine)
      const beamSeen: number[] = []
      for (let i = 0; i < 3; i++) {
        r.run(0.25)
        beamSeen.push(beam.material.opacity)
      }
      r.run(1)
      r.scene.event(ev('save', { owner: 'global' }))
      const glow = r.fx().children[0]
      const pulseSeen: number[] = []
      for (let i = 0; i < 3; i++) {
        r.run(0.25)
        pulseSeen.push(glow.material.opacity)
      }
      r.scene.dispose()
      return { beam: beamSeen, pulse: pulseSeen }
    }
    const still = strengths(true)
    expect(new Set(still.beam).size).toBe(1)
    expect(still.beam[0]).toBeGreaterThan(0.5)
    expect(new Set(still.pulse).size).toBe(1)
    expect(still.pulse[0]).toBeGreaterThan(0.1)
    const moving = strengths(false)
    expect(new Set(moving.beam).size).toBeGreaterThan(1)
    expect(new Set(moving.pulse).size).toBeGreaterThan(1)
  })

  test('F4 reduced motion: the writer nodule does not flare and the black-hole line does not breathe', () => {
    const r = rig({ reduced: true })
    const nodule = r.all(o => o.userData?.kind === 'nodule' && o.userData.tip[0].startsWith('claude-code'))[0]
    r.scene.event(ev('save'))
    r.clock.tick()
    expect(nodule.scale.x).toBe(1)
    const line = r.all(o => o.isLine && o.material.blending === three.AdditiveBlending && o.geometry.attributes.position.count === 61)[0]
    const seen = new Set<number>()
    for (let i = 0; i < 6; i++) {
      r.run(2)
      seen.add(line.material.opacity)
    }
    expect(seen.size).toBe(1)
    r.scene.dispose()
  })

  test('F4 switching reduced motion on ends a running flight at once, with the controls on and the lens at 50', () => {
    const twin = rig({ reduced: false })
    twin.scene.flyTo({ level: 'planet', owner: MATRIX })
    twin.run(2)
    const arrival = twin.camera.position.clone()
    twin.scene.dispose()

    const r = rig({ reduced: false })
    r.scene.flyTo({ level: 'planet', owner: MATRIX })
    r.run(0.5)
    expect(r.camera.fov).toBeGreaterThan(50)
    expect(r.camera.position.distanceTo(arrival)).toBeGreaterThan(5)
    dom.setReducedMotion(true)
    // No frame has run since: the flight is over already.
    expect(r.camera.position.distanceTo(arrival)).toBeLessThan(0.01)
    expect(r.camera.fov).toBe(50)
    r.run(0.1)
    expect(r.camera.position.distanceTo(arrival)).toBeLessThan(0.01)
    r.scene.dispose()
  })

  test('F4 the reduced-motion listener is removed on dispose (and added once)', () => {
    const baseline = dom.mediaListenerCount()
    const r = rig()
    expect(dom.mediaListenerCount()).toBe(baseline + 1)
    r.scene.dispose()
    expect(dom.mediaListenerCount()).toBe(baseline)
  })

  // F5
  test('F5 setData that removes the open moon flies the camera home and reports the Galaxy', () => {
    const without = galaxy()
    const matrix = without.projects.find((p: any) => p.owner === MATRIX)
    matrix.kinds = matrix.kinds.filter((k: any) => k.kind !== 'fact')
    const home = homeOf(without)
    const r = rig({ reduced: false })
    r.scene.flyTo({ level: 'moon', owner: MATRIX, kind: 'fact' })
    r.run(2)
    expect(r.camera.position.distanceTo(home)).toBeGreaterThan(100)
    r.scene.setData(without)
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    // It flies (not a jump): still away at the start, home when the 1.4 s are over.
    r.clock.tick()
    expect(r.camera.position.distanceTo(home)).toBeGreaterThan(50)
    r.run(2)
    expect(r.camera.position.distanceTo(home)).toBeLessThan(1)
    r.scene.dispose()
  })

  test('F5 setData that removes the open memory goes home too; under reduced motion the camera jumps', () => {
    const lost = galaxy()
    lost.memories = lost.memories.filter((m: any) => m.id !== 'mem-001')
    const home = homeOf(lost)
    const r = rig({ reduced: true })
    r.scene.flyTo({ level: 'memory', owner: MATRIX, kind: 'instruction', id: 'mem-001' })
    expect(r.camera.position.distanceTo(home)).toBeGreaterThan(100)
    r.scene.setData(lost)
    expect(r.lastLevel()).toEqual({ level: 'galaxy' })
    expect(r.camera.position.distanceTo(home)).toBeLessThan(1)
    r.scene.dispose()
  })

  test('F5 setData and dispose hide the tooltip, so the orbits leave the 15% slow-down', () => {
    const lead = (r: ReturnType<typeof rig>) => angleOf(r.worldPos(r.planet(MATRIX)))
    const free = rig({ reduced: false })
    const f0 = lead(free)
    free.run(4)
    const freeMove = Math.abs(lead(free) - f0)
    free.scene.dispose()

    const held = rig({ reduced: false })
    const sun = held.screen(held.all(o => o.userData?.kind === 'sun')[0])
    const found = held.locate(t => kindOf(t) === 'sun' || kindOf(t) === 'nodule', { x0: sun.x - 6, y0: sun.y - 6, x1: sun.x + 6, y1: sun.y + 6 }, 2)
    expect(found).not.toBeNull()
    expect(held.hovers[held.hovers.length - 1]?.tip).not.toBeNull()
    held.scene.setData(galaxy())
    expect(held.hovers[held.hovers.length - 1]?.tip).toBeNull()
    held.clock.tick()
    const h0 = lead(held)
    held.run(4)
    expect(Math.abs(lead(held) - h0) / freeMove).toBeGreaterThan(0.9)

    const again = held.locate(t => kindOf(t) === 'sun' || kindOf(t) === 'nodule', { x0: sun.x - 6, y0: sun.y - 6, x1: sun.x + 6, y1: sun.y + 6 }, 2)
    expect(again).not.toBeNull()
    held.scene.dispose()
    expect(held.hovers[held.hovers.length - 1]?.tip).toBeNull()
  })

  // F6
  test('F6 a frame that throws stops the loop and is reported once, not every frame', () => {
    const canvas = new FakeCanvas(dom.document)
    const clock = new FakeClock()
    let renders = 0
    const logged: unknown[][] = []
    const original = console.error
    console.error = (...args: unknown[]) => {
      logged.push(args)
    }
    try {
      const scene = createSolarScene({
        canvas,
        three,
        clock,
        createRenderer: (c: any) => new FakeRenderer(c),
        createComposer: (r: any, s: any, c: any) => {
          const composer = new FakeComposer(r, s, c)
          composer.render = () => {
            renders++
            if (renders === 3) throw new Error('boom')
          }
          return composer
        },
      })
      scene.setData(galaxy())
      clock.run(1)
      expect(renders).toBe(3)
      expect(logged).toHaveLength(1)
      expect(String(logged[0]?.[1])).toContain('boom')
      expect(clock.pending()).toBe(false)
      clock.run(1)
      expect(renders).toBe(3)
      expect(logged).toHaveLength(1)
      scene.dispose()
    } finally {
      console.error = original
    }
  })

  test('F6 a constructor that fails late frees everything made so far', () => {
    class FlakyCanvas extends FakeCanvas {
      override addEventListener(type: string, fn: any, opts?: unknown): void {
        if (type === 'click') throw new Error('no click')
        super.addEventListener(type, fn, opts)
      }
    }
    const canvas = new FlakyCanvas(dom.document)
    const baseline = dom.mediaListenerCount()
    const renderer = new FakeRenderer(canvas)
    let composer!: FakeComposer
    let root: any
    const disposed = new Set<unknown>()
    const original = three.CanvasTexture.prototype.dispose
    three.CanvasTexture.prototype.dispose = function (this: unknown, ...args: unknown[]) {
      disposed.add(this)
      return original.apply(this, args)
    }
    try {
      expect(() =>
        createSolarScene({
          canvas,
          three,
          clock: new FakeClock(),
          createRenderer: () => renderer,
          createComposer: (r: any, s: any, c: any) => {
            root = s
            return (composer = new FakeComposer(r, s, c))
          },
        }),
      ).toThrow('no click')
    } finally {
      three.CanvasTexture.prototype.dispose = original
    }
    expect(canvas.listenerCount()).toBe(0)
    expect(dom.mediaListenerCount()).toBe(baseline)
    expect(composer.disposed).toBe(true)
    expect(renderer.disposed).toBe(true)
    expect(renderer.contextLost).toBe(true)
    // The world, the effects and the sky are out of the scene; only its two lights (no resources) are left.
    expect(root.children.every((child: any) => child.isLight)).toBe(true)
    expect(disposed.size).toBeGreaterThanOrEqual(2)
  })

  // F7
  test('F7 an event already flying to a body that gets hidden stops drawing', () => {
    const r = rig({ reduced: false })
    r.scene.event(ev('save'))
    r.run(0.4)
    expect(r.fx().children.length).toBeGreaterThan(0)
    r.scene.setView({ hidden: { [MATRIX]: true } })
    r.clock.tick()
    expect(r.fx().children).toHaveLength(0)
    r.scene.dispose()
  })

  test('F7 a forget\'s dimming survives the next setData while the reply still lists the memory live', () => {
    const data = galaxy()
    quiet(data, ['mem-001'])
    const r = rig({ reduced: false, data })
    const bright = dotColour(r, 'mem-001')
    r.scene.event(ev('forget', { ids: ['mem-001'] }))
    r.run(2)
    expect(ratio(dotColour(r, 'mem-001'), bright)).toBeCloseTo(0.1, 4)
    // The same (stale) reply again: still dim. Forgetting it twice does not dim it twice.
    r.scene.setData(structuredClone(data))
    expect(ratio(dotColour(r, 'mem-001'), bright)).toBeCloseTo(0.1, 4)
    r.scene.event(ev('forget', { ids: ['mem-001'] }))
    r.run(2)
    expect(ratio(dotColour(r, 'mem-001'), bright)).toBeCloseTo(0.1, 4)
    // A reply that no longer lists it live lets the dimming go; if it is live again later, it is bright.
    const gone = structuredClone(data)
    gone.memories.find((m: any) => m.id === 'mem-001').state = 'retired'
    r.scene.setData(gone)
    r.scene.setData(structuredClone(data))
    expect(ratio(dotColour(r, 'mem-001'), bright)).toBeCloseTo(1, 4)
    r.scene.dispose()
  })

  // F9
  test('F9 the polar ice cap is painted on an idle project\'s planet and on no other', () => {
    const data = galaxy()
    const old = new Date(Date.now() - 90 * DAY).toISOString()
    const fresh = new Date().toISOString()
    for (const p of data.projects) p.lastActive = p.owner === HERMES || p.owner === MNEMOSYNE ? old : fresh
    const r = rig({ data })
    const bodies = buildBodies(data, Date.now())
    const capped = (owner: string): boolean => {
      const mesh = r.planet(owner)
      const ctx = mesh.material.map.image.getContext('2d') as FakeContext2d
      return ctx.rectFills.includes('rgba(244,248,255,0.85)')
    }
    let withCap = 0
    let without = 0
    for (const b of bodies) {
      if (b.craft !== null) continue
      const own = STYLES[b.style as keyof typeof STYLES]
      const expected = b.iceCap && !(own.kind === 'rock' && own.extra === 'cap')
      expect(capped(b.owner)).toBe(expected)
      if (expected) withCap++
      else without++
    }
    expect(withCap).toBeGreaterThan(0)
    expect(without).toBeGreaterThan(0)
    r.scene.dispose()
  })

  test('F9 a memory in its last 7 days is dimmed to 0.45, and one an inferred writer wrote to 0.75', () => {
    const data = galaxy()
    quiet(data, ['mem-002'])
    const mem = () => data.memories.find((m: any) => m.id === 'mem-002')
    const r = rig({ data })
    const plain = dotColour(r, 'mem-002')

    mem().validUntil = new Date(Date.now() + 3 * DAY).toISOString()
    r.scene.setData(data)
    expect(ratio(dotColour(r, 'mem-002'), plain)).toBeCloseTo(0.45, 4)

    mem().validUntil = new Date(Date.now() + 30 * DAY).toISOString()
    r.scene.setData(data)
    expect(ratio(dotColour(r, 'mem-002'), plain)).toBeCloseTo(1, 4)

    mem().validUntil = null
    mem().sourceInferred = true
    r.scene.setData(data)
    expect(ratio(dotColour(r, 'mem-002'), plain)).toBeCloseTo(0.75, 4)
    r.scene.dispose()
  })

  test('F9 the per-dot size patch matches the vendored three.js points shader', () => {
    const lib = readFileSync(join(ROOT, 'ui', 'vendor', 'map-lib.js'), 'utf8')
    const start = lib.indexOf('uniform float size;\nuniform float scale;')
    expect(start).toBeGreaterThan(-1)
    const vertex = lib.slice(start, lib.indexOf('`', start))
    // The two strings the patch looks for each occur once in the vendored points vertex shader.
    expect(vertex.split('uniform float size;').length - 1).toBe(1)
    expect(vertex.split('gl_PointSize = size;').length - 1).toBe(1)
    const r = rig()
    const dots = r.all(o => o.userData?.kind === 'points' && o.geometry.attributes.aSize)[0]
    const shader = { vertexShader: vertex }
    dots.material.onBeforeCompile(shader)
    expect(shader.vertexShader).not.toBe(vertex)
    expect(shader.vertexShader).toContain('uniform float size;\nattribute float aSize;')
    expect(shader.vertexShader).toContain('gl_PointSize = size * aSize;')
    expect(shader.vertexShader).not.toContain('gl_PointSize = size;')
    r.scene.dispose()
  })
})
