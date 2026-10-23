// MAP.3: the 3D map's logic, tested without a browser. ui/map-state.ts and
// ui/escape.ts are pure (no DOM, no three.js), so this runs them directly;
// ui/map.ts, the DOM side, is held by text gates on its label setters.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { plainLabel } from '../../ui/escape'
import {
  drawn,
  goTo,
  hasWebGL,
  initialState,
  inspector,
  levelAnnouncement,
  type MapState,
  type MemoryDetail,
  type MemoryNode,
  memoryNodeId,
  NO_TOOLTIP,
  needed,
  pathBar,
  type ProjectNode,
  projectNodeId,
  projectToggles,
  railList,
  receive,
  requestPath,
  reset,
  rotateButton,
  select,
  setColourBy,
  setMinRecalls,
  type TopicNode,
  toggleProject,
  toggleRotation,
  topicNodeId,
} from '../../ui/map-state'
import { ROOT } from './helpers'

const MARKUP = '<img src=x onerror=alert(1)>'

const PROJECTS: ProjectNode[] = [
  { id: 'project-hermes-1a', label: 'hermes', count: 65, recalls: 103, newest: '2026-10-20T10:00:00Z' },
  { id: 'project-mk-2b', label: 'matrixkoder', count: 60, recalls: 407, newest: '2026-10-22T10:00:00Z' },
  { id: 'global', label: 'Global', count: 4, recalls: 1, newest: '2026-09-01T10:00:00Z' },
]
const TOPICS: TopicNode[] = [
  { id: 'tag:routing', label: 'routing', count: 2, recalls: 9, newest: '2026-10-22T10:00:00Z', tag: 'routing', untagged: false },
  { id: 'tag:untagged', label: 'untagged', count: 1, recalls: 0, newest: null, tag: 'untagged', untagged: false },
  { id: 'untagged', label: 'Untagged', count: 3, recalls: 1, newest: '2026-10-01T10:00:00Z', tag: null, untagged: true },
]
const MEMORIES: MemoryNode[] = [
  { id: 'm1', label: 'Jev routes builds', tags: ['routing'], recall_count: 7, timestamp: '2026-10-22T10:00:00Z' },
  { id: 'm2', label: MARKUP, tags: ['routing', MARKUP], recall_count: 2, timestamp: '2026-10-02T10:00:00Z' },
]
const DETAIL: MemoryDetail = { id: 'm2', content: `${MARKUP}\nsecond line`, tags: ['routing', MARKUP], recall_count: 2, timestamp: '2026-10-02T10:00:00Z', owner: 'project-mk-2b' }

/** Answers every request the state needs from the fixtures, as the page's loop does; the requests made, in order. */
function load(state: MapState, asked: string[] = []): MapState {
  for (let request = needed(state), guard = 0; request !== null && guard < 10; request = needed(state), guard++) {
    asked.push(requestPath(request))
    const reply = request.kind === 'projects' ? PROJECTS : request.kind === 'topics' ? TOPICS : request.kind === 'memories' ? MEMORIES : DETAIL
    state = receive(state, request, reply)
  }
  return state
}

const start = (reducedMotion = false) => load(initialState({ reducedMotion }))
const ids = (state: MapState) => drawn(state).nodes.map(node => node.id)
const railIds = (state: MapState) => railList(state).groups.flatMap(group => group.items.map(item => item.id))
const MK = projectNodeId('project-mk-2b')
const ROUTING = topicNodeId('tag:routing')

describe('MAP.3.a1: drill-down, and the same call from a click or the rail', () => {
  test('All memories, then a project, then a topic, then a memory opens the inspector', () => {
    let state = start()
    expect(state.level).toBe('all')
    state = load(select(state, MK))
    expect([state.level, state.project]).toEqual(['project', 'project-mk-2b'])
    state = load(select(state, ROUTING))
    expect([state.level, state.topic]).toEqual(['topic', 'tag:routing'])
    state = load(select(state, memoryNodeId('m2')))
    expect([state.level, state.memory]).toEqual(['memory', 'm2'])
    expect(inspector(state).kind).toBe('Memory')
  })

  test('a rail item is pressed with the same select() and its id is the drawn node\'s id', () => {
    let byRail = start()
    let byClick = start()
    for (const step of [MK, ROUTING, memoryNodeId('m1')]) {
      const item = railList(byRail).groups[0]!.items.find(entry => entry.id === step)
      expect(item).toBeDefined()
      byRail = load(select(byRail, item!.id))
      const node = drawn(byClick).nodes.find(entry => entry.id === step)
      expect(node).toBeDefined()
      byClick = load(select(byClick, node!.id))
      expect(byRail).toEqual(byClick)
    }
  })

  test('an id the state does not hold, or a deeper kind too early, changes nothing', () => {
    const state = start()
    expect(select(state, ROUTING)).toBe(state)
    expect(select(state, memoryNodeId('m1'))).toBe(state)
    expect(select(state, projectNodeId('nobody'))).toBe(state)
    expect(select(state, 'junk')).toBe(state)
  })
})

describe('MAP.3.a2 and a3: the drawn set per level, and the rail list equal to it', () => {
  test('All = every shown project', () => {
    const state = start()
    expect(ids(state)).toEqual(PROJECTS.map(p => projectNodeId(p.id)))
    expect(drawn(state).links).toEqual([])
  })

  test('project = the focused project, its topics, and the other shown projects small aside', () => {
    const state = load(select(start(), MK))
    const nodes = drawn(state).nodes
    expect(nodes.filter(n => n.role === 'focus').map(n => n.id)).toEqual([MK])
    expect(nodes.filter(n => n.role === 'child').map(n => n.id)).toEqual(TOPICS.map(t => topicNodeId(t.id)))
    expect(nodes.filter(n => n.role === 'aside').map(n => n.id)).toEqual([projectNodeId('project-hermes-1a'), projectNodeId('global')])
    const focus = nodes.find(n => n.role === 'focus')!
    for (const aside of nodes.filter(n => n.role === 'aside')) expect(aside.radius).toBeLessThan(focus.radius)
    expect(focus).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(drawn(state).links.map(link => link.target)).toEqual(TOPICS.map(t => topicNodeId(t.id)))
  })

  test('topic = the focused project and topic, its memories, and the sibling topics aside, from the cached topics reply', () => {
    const asked: string[] = []
    let state = load(initialState({ reducedMotion: false }), asked)
    state = load(select(state, MK), asked)
    state = load(select(state, ROUTING), asked)
    const nodes = drawn(state).nodes
    expect(nodes.filter(n => n.role === 'focus').map(n => n.id)).toEqual([MK, ROUTING])
    expect(nodes.filter(n => n.role === 'child').map(n => n.id)).toEqual(['m:m1', 'm:m2'])
    expect(nodes.filter(n => n.role === 'aside').map(n => n.id)).toEqual([topicNodeId('tag:untagged'), topicNodeId('untagged')])
    // One request per level: siblings come from the topics reply already held.
    expect(asked).toEqual(['/api/map', '/api/map?project=project-mk-2b', '/api/map?project=project-mk-2b&tag=routing'])
  })

  test('memory = the topic level, with that memory marked', () => {
    const topic = load(select(load(select(start(), MK)), ROUTING))
    const memory = load(select(topic, 'm:m2'))
    expect(ids(memory)).toEqual(ids(topic))
    expect(drawn(memory).nodes.filter(n => n.selected).map(n => n.id)).toEqual(['m:m2'])
    expect(railList(memory).groups[0]!.items.filter(item => item.selected).map(item => item.id)).toEqual(['m:m2'])
  })

  test('the rail list holds exactly the drawn set: the children, then Other projects or Other topics, then In focus', () => {
    const all = start()
    const project = load(select(all, MK))
    const topic = load(select(project, ROUTING))
    const memory = load(select(topic, 'm:m1'))
    for (const state of [all, project, topic, memory]) expect(railIds(state).sort()).toEqual(ids(state).sort())
    expect(railList(all).groups.map(g => g.title)).toEqual(['Projects to open'])
    expect(railList(project).groups.map(g => g.title)).toEqual(['Topics in matrixkoder', 'Other projects', 'In focus'])
    expect(railList(topic).groups.map(g => g.title)).toEqual(['Memories in routing', 'Other topics', 'In focus'])
    expect(railList(project).heading).toBe('Topics in matrixkoder')
    // Stable: the same state gives the same order.
    expect(railIds(topic)).toEqual(railIds(load(select(load(select(start(), MK)), ROUTING))))
    expect(railIds(project)).toEqual([...TOPICS.map(t => topicNodeId(t.id)), projectNodeId('project-hermes-1a'), projectNodeId('global'), MK])
  })

  test('a memory-level In focus item goes back up: the topic to its memories, the project to its topics', () => {
    const memory = load(select(load(select(load(select(start(), MK)), ROUTING)), 'm:m1'))
    expect(select(memory, ROUTING).level).toBe('topic')
    expect(select(memory, MK).level).toBe('project')
    // Another project from the aside group switches to it.
    const project = load(select(start(), MK))
    expect(select(project, projectNodeId('global'))).toMatchObject({ level: 'project', project: 'global' })
  })
})

describe('MAP.3.a4: the path bar and Reset view', () => {
  test('All memories, then the project, then the topic; an earlier part goes back; Reset returns to All', () => {
    const topic = load(select(load(select(start(), MK)), ROUTING))
    expect(pathBar(start()).map(p => [p.label, p.current])).toEqual([['All memories', true]])
    expect(pathBar(topic).map(p => p.label)).toEqual(['All memories', 'matrixkoder', 'routing'])
    expect(pathBar(topic).map(p => p.current)).toEqual([false, false, true])
    const memory = load(select(topic, 'm:m1'))
    expect(pathBar(memory).map(p => p.label)).toEqual(['All memories', 'matrixkoder', 'routing'])
    expect(goTo(memory, 'topic')).toMatchObject({ level: 'topic', memory: null })
    expect(goTo(memory, 'project')).toMatchObject({ level: 'project', topic: null, memory: null })
    expect(goTo(memory, 'all')).toMatchObject({ level: 'all', project: null, topic: null, memory: null })
    expect(reset(memory)).toMatchObject({ level: 'all', project: null })
    // A deeper part than the current level is ignored.
    const project = load(select(start(), MK))
    expect(goTo(project, 'topic')).toBe(project)
    // Going back up uses the replies already held: nothing more is asked.
    expect(needed(goTo(memory, 'project'))).toBeNull()
  })
})

describe('MAP.3.a5: auto-rotate', () => {
  test('starts on, starts paused with reduced motion, and the pause action toggles it', () => {
    expect(start().rotating).toBe(true)
    expect(start(true).rotating).toBe(false)
    const paused = toggleRotation(start())
    expect(paused.rotating).toBe(false)
    expect(rotateButton(paused)).toEqual({ label: 'Auto-rotate', pressed: false })
    expect(toggleRotation(paused).rotating).toBe(true)
    // One fixed label; only aria-pressed changes (review r1 finding 8).
    expect(rotateButton(start())).toEqual({ label: 'Auto-rotate', pressed: true })
    // Reset view leaves rotation as it is.
    expect(reset(paused).rotating).toBe(false)
  })
})

describe('MAP.3.a6: colour-by, project toggles and min-recalls', () => {
  test('colour-by is project, recalls or age, and changes the colours drawn', () => {
    const state = start()
    const colours = (s: MapState) => drawn(s).nodes.map(n => n.colour)
    const byProject = colours(state)
    expect(byProject[2]).toBe('#A9B4B2')
    const byRecalls = colours(setColourBy(state, 'recalls'))
    const byAge = colours(setColourBy(state, 'age'))
    expect(byRecalls).not.toEqual(byProject)
    expect(byAge).not.toEqual(byRecalls)
    // Most recalled (matrixkoder) and newest (matrixkoder) get the top of the ramp; global the bottom.
    expect(byRecalls[1]).toBe('#F0773A')
    expect(byAge[1]).toBe('#F0773A')
    expect(byAge[2]).toBe('#3A4A4E')
    expect(setColourBy(state, 'nope' as never)).toBe(state)
  })

  test('a toggle hides or shows a project, carries its count, and hiding the focus goes back to All', () => {
    const state = start()
    expect(projectToggles(state).map(t => [t.label, t.count, t.shown])).toEqual([
      ['hermes', 65, true],
      ['matrixkoder', 60, true],
      ['Global', 4, true],
    ])
    const hidden = toggleProject(state, 'project-hermes-1a')
    expect(ids(hidden)).toEqual([MK, projectNodeId('global')])
    expect(railIds(hidden)).toEqual(ids(hidden))
    expect(projectToggles(hidden)[0]).toMatchObject({ count: 65, shown: false })
    expect(select(hidden, projectNodeId('project-hermes-1a'))).toBe(hidden)
    expect(ids(toggleProject(hidden, 'project-hermes-1a'))).toEqual(ids(state))
    const focused = load(select(state, MK))
    expect(toggleProject(focused, 'project-mk-2b').level).toBe('all')
    // A hidden project is not drawn aside either.
    expect(ids(load(select(hidden, MK)))).not.toContain(projectNodeId('project-hermes-1a'))
  })

  test('min-recalls asks every level again with min_recalls, and keeps the focus while it still has memories', () => {
    const topic = load(select(load(select(start(), MK)), ROUTING))
    const asked: string[] = []
    const raised = load(setMinRecalls(topic, 3), asked)
    expect(asked).toEqual(['/api/map?min_recalls=3', '/api/map?project=project-mk-2b&min_recalls=3', '/api/map?project=project-mk-2b&tag=routing&min_recalls=3'])
    expect([raised.level, raised.minRecalls]).toEqual(['topic', 3])
    // A focus the new reply no longer holds is left for the level above.
    const shrunk = receive(setMinRecalls(topic, 5), { kind: 'projects', minRecalls: 5 }, PROJECTS.filter(p => p.id !== 'project-mk-2b'))
    expect(shrunk.level).toBe('all')
    // Held to 0 - 20, and a stale reply (asked under another min-recalls) is dropped.
    expect(setMinRecalls(topic, 99).minRecalls).toBe(20)
    expect(setMinRecalls(topic, -4).minRecalls).toBe(0)
    const fresh = setMinRecalls(topic, 2)
    expect(receive(fresh, { kind: 'projects', minRecalls: 0 }, PROJECTS)).toBe(fresh)
    expect(requestPath({ kind: 'memories', project: 'p', topic: 'untagged', minRecalls: 0 })).toBe('/api/map?project=p&untagged=1')
    expect(requestPath({ kind: 'memories', project: "a'b", topic: 'tag:50% x', minRecalls: 1 })).toBe('/api/map?project=a%27b&tag=50%25+x&min_recalls=1')
  })
})

describe('MAP.3.a7: the inspector', () => {
  test('a memory\'s text, tags, recalls, saved date and Open in Memories', () => {
    const memory = load(select(load(select(load(select(start(), MK)), ROUTING)), 'm:m2'))
    const view = inspector(memory)
    expect(view.memory).toEqual({
      id: 'm2',
      text: `${MARKUP}\nsecond line`,
      tags: ['routing', MARKUP],
      recalls: 2,
      saved: '2026-10-02',
      loading: false,
      openInMemories: 'm2',
    })
    expect(view.stats).toEqual([
      { label: 'Recalls', value: '2' },
      { label: 'Saved', value: '2026-10-02' },
    ])
    expect(view.title).toBe(MARKUP)
    // Before the full memory arrives, its label stands in.
    const loading = select(load(select(load(select(start(), MK)), ROUTING)), 'm:m2')
    expect(inspector(loading).memory).toMatchObject({ text: MARKUP, loading: true, openInMemories: 'm2' })
    expect(needed(loading)).toEqual({ kind: 'memory', id: 'm2' })
    expect(requestPath({ kind: 'memory', id: 'a/b' })).toBe('/api/memories/a%2Fb')
    // A memory that is gone drops back to its topic.
    expect(receive(loading, { kind: 'memory', id: 'm2' }, null).level).toBe('topic')
  })

  test('the overview, a project and a topic', () => {
    expect(inspector(start())).toMatchObject({ kind: 'Overview', title: '129 memories', sub: '3 projects' })
    expect(inspector(start()).stats).toEqual([
      { label: 'Recalls, all time', value: '511' },
      { label: 'Biggest project', value: 'hermes' },
    ])
    const project = load(select(start(), MK))
    expect(inspector(project)).toMatchObject({ kind: 'Project', title: 'matrixkoder', sub: '3 topics' })
    expect(inspector(load(select(project, ROUTING)))).toMatchObject({ kind: 'Topic', title: 'routing', sub: 'matrixkoder' })
    expect(levelAnnouncement(project)).toBe('Project matrixkoder: 3 topics.')
    expect(levelAnnouncement(start())).toBe('All memories: 3 projects.')
  })
})

describe('MAP.3.a8: plainLabel', () => {
  test('markup comes back as the same characters, never escaped', () => {
    expect(plainLabel(MARKUP, 80)).toBe(MARKUP)
    expect(plainLabel('<script>alert(1)</script> & "x"', 80)).toBe('<script>alert(1)</script> & "x"')
  })

  test('cuts to max and removes control characters', () => {
    expect(plainLabel('abcdef', 4)).toBe('abc…')
    expect(Array.from(plainLabel('é'.repeat(100), 80))).toHaveLength(80)
    expect(plainLabel('a\u0000b\u0007c\u007fd\u009be', 80)).toBe('abcde')
    expect(plainLabel('one\ntwo\r\n\tthree', 80)).toBe('one two three')
    expect(plainLabel('\u202eevil\u202c txt', 80)).toBe('evil txt')
    // Review r1 finding 4: the Arabic letter mark goes; line and paragraph separators become spaces.
    expect(plainLabel('a\u061cb', 80)).toBe('ab')
    expect(plainLabel('one\u2028two\u2029three\u0085four', 80)).toBe('one two three four')
    expect(plainLabel('  pad  ', 80)).toBe('pad')
    // Every label the state gives is plain.
    const memory = load(select(load(select(load(select(start(), MK)), ROUTING)), 'm:m2'))
    expect(drawn(memory).nodes.find(n => n.id === 'm:m2')!.label).toBe(MARKUP)
  })
})

describe('MAP.3.a9: NO_TOOLTIP is the only label accessor ui/map.ts sets', () => {
  const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')

  test('NO_TOOLTIP returns an empty string', () => {
    expect(NO_TOOLTIP()).toBe('')
  })

  test('map.ts passes NO_TOOLTIP to nodeLabel and linkLabel and to no other label setter, and shows hover text with textContent', () => {
    expect(labelSetters(map)).toEqual(['nodeLabel(NO_TOOLTIP)', 'linkLabel(NO_TOOLTIP)'])
    expect(map).toMatch(/tip\.textContent\s*=/)
    expect(map).not.toMatch(/\binnerHTML\b|insertAdjacentHTML|outerHTML/)
  })

  test('the gate fails when a label setter takes anything else', () => {
    expect(labelSetters('g.nodeLabel(n => n.label).linkLabel(NO_TOOLTIP)')).toEqual(['nodeLabel(n => n.label)', 'linkLabel(NO_TOOLTIP)'])
    expect(labelSetters('g.nodeLabel("name")')).not.toEqual(['nodeLabel(NO_TOOLTIP)', 'linkLabel(NO_TOOLTIP)'])
  })
})

/** Every call of the library's label setters (nodeLabel, linkLabel), as written, argument included. */
function labelSetters(source: string): string[] {
  return [...source.matchAll(/\b((?:node|link)Label)\(((?:[^()]|\([^()]*\))*)\)/g)].map(match => `${match[1]}(${match[2]})`)
}

describe('MAP.3.a10: WebGL detection, and drilling with no renderer', () => {
  test('hasWebGL is false when getContext gives null or throws, true otherwise', () => {
    expect(hasWebGL(() => ({ getContext: () => null }))).toBe(false)
    expect(
      hasWebGL(() => ({
        getContext: () => {
          throw new Error('blocked')
        },
      })),
    ).toBe(false)
    expect(
      hasWebGL(() => {
        throw new Error('no canvas')
      }),
    ).toBe(false)
    const asked: string[] = []
    expect(hasWebGL(() => ({ getContext: (kind: string) => (asked.push(kind), {}) }))).toBe(true)
    expect(asked).toEqual(['webgl2'])
    // Review r1 finding 9: the probe's context is let go with WEBGL_lose_context.
    let lost = 0
    const context = { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext: () => lost++ } : null) }
    expect(hasWebGL(() => ({ getContext: () => context }))).toBe(true)
    expect(lost).toBe(1)
    // A context without the extension, or whose extension throws, still counts as WebGL.
    expect(hasWebGL(() => ({ getContext: () => ({ getExtension: () => null }) }))).toBe(true)
    expect(
      hasWebGL(() => ({
        getContext: () => ({
          getExtension: () => {
            throw new Error('x')
          },
        }),
      })),
    ).toBe(true)
  })

  test('with no renderer the rail list alone drills down and back up', () => {
    expect(hasWebGL(() => ({ getContext: () => null }))).toBe(false)
    let state = start()
    for (const pick of [MK, ROUTING, 'm:m2']) {
      const item = railList(state).groups[0]!.items.find(entry => entry.id === pick)!
      state = load(select(state, item.id))
    }
    expect([state.level, inspector(state).memory?.id]).toEqual(['memory', 'm2'])
    const back = railList(state).groups.find(g => g.title === 'In focus')!.items.find(item => item.id === MK)!
    expect(load(select(state, back.id)).level).toBe('project')
  })
})

describe('MAP.3.a11: the new page files are in the inert scan', () => {
  test('ui/map.ts, ui/map-state.ts and ui/escape.ts parse no HTML', () => {
    const sinks = /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\s*\.\s*write|\beval\s*\(|\bnew\s+Function\b/
    for (const file of ['map.ts', 'map-state.ts', 'escape.ts']) {
      const text = readFileSync(join(ROOT, 'ui', file), 'utf8')
      expect({ file, sink: sinks.test(text) }).toEqual({ file, sink: false })
    }
  })
})

describe('review r1 finding 3: a cut topic says so in the rail', () => {
  test('a memories reply with a total above its nodes gives the rail a "Showing n of total" note', () => {
    let state = load(select(load(select(start(), MK)), ROUTING))
    expect(railList(state).groups[0]!.note).toBeUndefined()
    state = setMinRecalls(state, 1)
    for (let request = needed(state); request !== null; request = needed(state)) {
      const reply = request.kind === 'projects' ? PROJECTS : request.kind === 'topics' ? TOPICS : { nodes: MEMORIES, total: 812 }
      state = receive(state, request, reply)
    }
    expect(state.level).toBe('topic')
    expect(railList(state).groups[0]!.note).toBe('Showing 2 of 812 memories (the most recent).')
    // A total below the nodes given is not believed: no note.
    let odd = setMinRecalls(state, 2)
    for (let request = needed(odd); request !== null; request = needed(odd)) {
      const reply = request.kind === 'projects' ? PROJECTS : request.kind === 'topics' ? TOPICS : { nodes: MEMORIES, total: 1 }
      odd = receive(odd, request, reply)
    }
    expect(odd.memories?.total).toBe(2)
    expect(railList(odd).groups[0]!.note).toBeUndefined()
  })
})
