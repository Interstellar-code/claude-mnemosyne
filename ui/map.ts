// The Map tab: the 3D memory map on 3d-force-graph (plan MAP.4; DESIGN.md,
// "The 3D memory map"). The look follows design/Main.dc.html.
//
// ui/map-state.ts holds every rule (levels, what is drawn and where, the rail
// list, the inspector); this file draws its output and sends each click and
// key back to it. The library, ui/vendor/map-lib.js, is loaded with import()
// the first time the Map tab opens, so the other tabs request nothing under
// /vendor/. Without WebGL, or when the graph cannot be made, the map area
// shows a plain message and the rail list still drills down.
//
// No HTML is ever made from data: the library's own HTML tooltip is off (the
// label accessors are NO_TOOLTIP), hover text goes into an app-owned element
// with textContent, 3D labels are drawn on a canvas by SpriteText, and every
// element here is built with createElement and textContent.
import type { ForceGraph3DInstance, GraphNode } from './vendor/map-lib.js'
import { plainLabel } from './escape'
import {
  COLOUR_BY,
  COLOUR_BY_NAMES,
  drawn,
  goTo,
  hasWebGL,
  initialState,
  inspector,
  levelAnnouncement,
  type MapRequest,
  type MapState,
  NO_TOOLTIP,
  needed,
  pathBar,
  projectToggles,
  railList,
  receive,
  requestKey,
  requestPath,
  reset,
  rotateButton,
  select,
  setColourBy,
  setMinRecalls,
  toggleProject,
  toggleRotation,
} from './map-state'

type MapLib = typeof import('./vendor/map-lib.js')

/** What the page gives the map: its /api call, a way to open a memory in the Memories view, and the status line. */
export type MapHost = {
  api: (path: string) => Promise<Response>
  openMemory: (id: string) => void
  status: (text: string, kind?: 'ok' | 'error' | 'plain') => void
}

// The library's one URL: same origin, served from ui/vendor/ by ui/server.ts.
const LIB_URL = '/vendor/map-lib.js'
const ROTATE_SPEED = 0.6
const FLY_MS = 900

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`#${id} is missing from index.html`)
  return element as T
}

// A dot of a computed colour (from map-state's palette and ramps, never from data), set through the CSSOM.
function dot(colour: string, className = 'map-dot') {
  const span = el('span', undefined, className)
  span.setAttribute('aria-hidden', 'true')
  span.style.backgroundColor = colour
  return span
}

const levelOf = (state: MapState) => `${state.level}\u0000${state.project ?? ''}\u0000${state.topic ?? ''}\u0000${state.memory ?? ''}`

export type MapView = { visible: (shown: boolean) => void }

/** Builds the Map tab once; the page calls visible() on every tab change. */
export function createMap(host: MapHost): MapView {
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  let state = initialState({ reducedMotion })
  let graph: ForceGraph3DInstance | null = null
  let lib: MapLib | null = null
  let shown = true
  let lastLevel = ''
  let arrived = false
  let drawnKey = ''

  const canvasBox = byId('map-canvas')
  const stage = byId('map-stage')
  const message = byId('map-message')
  const tip = byId('map-tip')
  const heading = byId('map-list-heading')
  const live = byId('map-live')
  const rotate = byId<HTMLButtonElement>('map-rotate')
  const slider = byId<HTMLInputElement>('map-min')
  const sliderValue = byId('map-min-value')

  function say(text: string) {
    message.textContent = text
    message.hidden = false
    canvasBox.hidden = true
  }

  // ---- State changes ----

  function dispatch(next: MapState) {
    if (next === state) return
    state = next
    render()
    void sync()
  }

  // Fetches what the state still needs, one level at a time; a reply the state no longer needs is dropped by receive().
  let syncing = false
  let again = false
  async function sync() {
    if (syncing) {
      again = true
      return
    }
    syncing = true
    try {
      for (let request = needed(state); request !== null; request = needed(state)) {
        const reply = await load(request)
        const before = requestKey(needed(state))
        state = receive(state, request, reply)
        render()
        // A reply that could not be taken in, with the state unchanged, would ask again forever.
        if (requestKey(needed(state)) === before && before === requestKey(request)) break
      }
    } catch (err) {
      host.status(`Could not load the map: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      syncing = false
      if (again) {
        again = false
        void sync()
      }
    }
  }

  async function load(request: MapRequest): Promise<unknown> {
    const response = await host.api(requestPath(request))
    if (request.kind === 'memory' && response.status === 404) return null
    const body = (await response.json().catch(() => ({}))) as { nodes?: unknown; error?: string }
    if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
    // A topic's memories come with their total (the server cuts a long topic); the other levels are lists.
    return request.kind === 'memory' || request.kind === 'memories' ? body : (body.nodes ?? [])
  }

  // ---- Drawing ----

  function render() {
    renderPath()
    renderRail()
    renderInspector()
    renderControls()
    renderGraph()
    const level = levelOf(state)
    if (level !== lastLevel) {
      // After a level change, focus moves to the list's heading at once; the
      // announcement and the camera wait until the level's reply is in, so
      // they name and frame what is really there.
      if (lastLevel !== '') heading.focus()
      lastLevel = level
      arrived = false
    }
    if (!arrived && needed(state) === null) {
      arrived = true
      live.textContent = levelAnnouncement(state)
      flyTo()
    }
  }

  function renderPath() {
    const nav = byId('map-path')
    // A rebuild replaces the crumbs: the one that had focus (by its level) keeps it.
    const active = document.activeElement
    const focusedLevel = active instanceof HTMLElement && nav.contains(active) ? active.dataset.level : undefined
    nav.replaceChildren(
      ...pathBar(state).map((part, i) => {
        const span = el('span', undefined, 'crumb')
        if (i > 0) {
          const sep = el('span', '›', 'crumb-sep')
          sep.setAttribute('aria-hidden', 'true')
          span.append(sep)
        }
        const button = el('button', part.label, part.current ? 'crumb-btn is-current' : 'crumb-btn')
        button.type = 'button'
        button.dataset.level = part.level
        if (part.current) button.setAttribute('aria-current', 'page')
        button.addEventListener('click', () => dispatch(goTo(state, part.level)))
        span.append(button)
        return span
      }),
    )
    if (focusedLevel !== undefined) {
      // The crumb gone (the path got shorter): focus its nearest earlier part.
      const buttons = [...nav.querySelectorAll<HTMLButtonElement>('button[data-level]')]
      ;(buttons.find(button => button.dataset.level === focusedLevel) ?? buttons.at(-1))?.focus()
    }
  }

  function renderRail() {
    for (const button of byId('map-colour').querySelectorAll<HTMLButtonElement>('button[data-colour]')) {
      button.setAttribute('aria-pressed', String(button.dataset.colour === state.colourBy))
    }
    const toggles = byId('map-toggles')
    const projects = projectToggles(state)
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusedProject = focused?.dataset.project
    const focusedNode = focused?.dataset.node
    toggles.replaceChildren(
      ...(projects.length === 0
        ? [el('span', state.projects === null ? 'Loading…' : 'No projects.', 'rail-note')]
        : projects.map(project => {
            const label = el('label', undefined, 'toggle')
            const box = el('input')
            box.type = 'checkbox'
            box.dataset.project = project.id
            box.checked = project.shown
            box.addEventListener('change', () => dispatch(toggleProject(state, project.id)))
            label.append(box, dot(project.colour), el('span', project.label, 'toggle-name'), el('span', String(project.count), 'mono muted'))
            label.title = project.id
            return label
          })),
    )
    const rail = railList(state)
    heading.textContent = rail.heading
    const list = byId('map-list')
    const parts: HTMLElement[] = []
    rail.groups.forEach((group, i) => {
      if (i > 0) parts.push(el('h3', group.title, 'rail-sub'))
      const ul = el('ul', undefined, 'rail-items')
      if (group.items.length === 0) ul.append(el('li', state.projects === null || needed(state) !== null ? 'Loading…' : 'Nothing to show.', 'rail-note'))
      for (const item of group.items) {
        const li = el('li')
        const button = el('button', undefined, item.selected ? 'rail-item is-selected' : 'rail-item')
        button.type = 'button'
        button.dataset.node = item.id
        if (item.selected) button.setAttribute('aria-current', 'true')
        button.append(dot(item.colour), el('span', item.label, 'rail-name'), el('span', String(item.count), 'mono muted'))
        button.addEventListener('click', () => dispatch(select(state, item.id)))
        li.append(button)
        ul.append(li)
      }
      parts.push(ul)
      if (group.note) parts.push(el('p', group.note, 'rail-note'))
    })
    list.replaceChildren(...parts)
    // A redraw replaces the rail's controls: the one that had focus keeps it (a keyboard user stays where they were).
    if (focusedProject !== undefined) toggles.querySelector<HTMLElement>(`input[data-project="${CSS.escape(focusedProject)}"]`)?.focus()
    if (focusedNode !== undefined) list.querySelector<HTMLElement>(`button[data-node="${CSS.escape(focusedNode)}"]`)?.focus()
  }

  function renderInspector() {
    const box = byId('map-inspector')
    const view = inspector(state)
    const head = el('div', undefined, 'insp-head')
    const sub = el('span', undefined, 'insp-sub')
    sub.append(dot(view.colour, 'map-dot big'), el('span', view.sub))
    head.append(el('span', view.kind, 'insp-kind'), el('h2', view.title, 'insp-title'), sub)
    const parts: HTMLElement[] = [head]
    if (view.memory) {
      const memory = view.memory
      parts.push(el('p', memory.text, memory.loading ? 'insp-text muted' : 'insp-text'))
      const tags = el('div', undefined, 'tag-list')
      for (const tag of memory.tags) tags.append(el('span', plainLabel(tag, 40), 'tag'))
      if (memory.tags.length === 0) tags.append(el('span', 'No tags yet.', 'muted small'))
      parts.push(tags)
      const open = el('button', 'Open in Memories', 'btn insp-open')
      open.type = 'button'
      open.addEventListener('click', () => host.openMemory(memory.openInMemories))
      parts.push(open)
    }
    const stats = el('dl', undefined, 'insp-stats')
    for (const stat of view.stats) {
      const item = el('div')
      item.append(el('dt', stat.label), el('dd', stat.value))
      stats.append(item)
    }
    parts.push(stats)
    if (view.hint) parts.push(el('p', view.hint, 'insp-hint'))
    box.replaceChildren(...parts)
  }

  function renderControls() {
    const button = rotateButton(state)
    rotate.textContent = button.label
    rotate.setAttribute('aria-pressed', String(button.pressed))
    if (document.activeElement !== slider) slider.value = String(state.minRecalls)
    sliderValue.textContent = slider.value
    if (graph !== null) graph.controls().autoRotate = state.rotating && shown
  }

  function renderGraph() {
    if (graph === null || lib === null) return
    const { nodes, links } = drawn(state)
    const key = JSON.stringify([nodes, links])
    if (key === drawnKey) return
    drawnKey = key
    const SpriteText = lib.SpriteText
    // A fresh accessor each time, so the library makes every node's label again.
    graph.nodeThreeObject((node: GraphNode) => {
      const caption = typeof node.caption === 'string' ? node.caption : ''
      if (caption === '') return null
      const sprite = new SpriteText(caption, Math.max(6, Number(node.radius) * 0.45), '#F2F4F3')
      sprite.backgroundColor = 'rgba(8, 11, 12, 0.6)'
      sprite.padding = 2
      sprite.borderRadius = 3
      sprite.fontWeight = '600'
      sprite.position.set(0, -(Number(node.radius) + 7), 0)
      return sprite
    })
    graph.graphData({
      // Each node is held where map-state puts it (fx, fy, fz): the layout is the drill level's, not the forces'.
      nodes: nodes.map(node => ({ ...node, fx: node.x, fy: node.y, fz: node.z })),
      links: links.map(link => ({ ...link })),
    })
  }

  // The camera faces the new level from far enough to see all of it.
  function flyTo() {
    if (graph === null) return
    // Framed on the focus and its children; the nodes aside sit toward the edges.
    const { nodes } = drawn(state)
    const extent = Math.max(60, ...nodes.filter(node => node.role !== 'aside').map(node => Math.hypot(node.x, node.y, node.z) + node.radius))
    const distance = extent * 2.3 + 60
    graph.cameraPosition({ x: 0, y: distance * 0.35, z: distance }, { x: 0, y: 0, z: 0 }, reducedMotion ? 0 : FLY_MS)
  }

  // ---- Wiring ----

  const colourGroup = byId('map-colour')
  colourGroup.replaceChildren(
    ...COLOUR_BY.map(mode => {
      const button = el('button', COLOUR_BY_NAMES[mode], 'seg-btn')
      button.type = 'button'
      button.dataset.colour = mode
      button.addEventListener('click', () => dispatch(setColourBy(state, mode)))
      return button
    }),
  )
  rotate.addEventListener('click', () => dispatch(toggleRotation(state)))
  byId('map-reset').addEventListener('click', () => {
    dispatch(reset(state))
    flyTo()
  })
  let sliderTimer: ReturnType<typeof setTimeout> | 0 = 0
  slider.addEventListener('input', () => {
    sliderValue.textContent = slider.value
    if (sliderTimer) clearTimeout(sliderTimer)
    sliderTimer = setTimeout(() => dispatch(setMinRecalls(state, Number(slider.value))), 250)
  })

  // Hover text: the node's plain label, in an element of ours, by textContent.
  let pointer = { x: 0, y: 0 }
  stage.addEventListener('pointermove', event => {
    const box = stage.getBoundingClientRect()
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top }
    if (!tip.hidden) placeTip()
  })
  function placeTip() {
    tip.style.left = `${Math.round(pointer.x + 14)}px`
    tip.style.top = `${Math.round(pointer.y + 14)}px`
  }

  async function start() {
    if (!hasWebGL(() => document.createElement('canvas'))) {
      say('This map needs WebGL, which this browser has turned off or does not offer. The list on the left drills down the same way.')
      return
    }
    try {
      lib = (await import(LIB_URL)) as MapLib
    } catch (err) {
      say(`The map library could not load (${err instanceof Error ? err.message : String(err)}). The list on the left drills down the same way.`)
      return
    }
    try {
      graph = new lib.ForceGraph3D(canvasBox, { controlType: 'orbit' })
    } catch (err) {
      graph = null
      say(`The 3D map could not start (${err instanceof Error ? err.message : String(err)}). The list on the left drills down the same way.`)
      return
    }
    graph
      .forceEngine('d3')
      .nodeLabel(NO_TOOLTIP)
      .linkLabel(NO_TOOLTIP)
      .showNavInfo(false)
      .backgroundColor('rgba(0, 0, 0, 0)')
      .nodeRelSize(1)
      .nodeVal((node: GraphNode) => Number(node.radius) ** 3)
      .nodeColor((node: GraphNode) => String(node.colour))
      .nodeOpacity(0.92)
      .nodeResolution(24)
      .nodeThreeObjectExtend(true)
      .linkColor(link => String(link.colour))
      .linkOpacity(0.35)
      .linkWidth(0)
      .enableNodeDrag(false)
      .cooldownTicks(0)
      .onNodeClick((node: GraphNode) => dispatch(select(state, String(node.id))))
      .onNodeHover((node: GraphNode | null) => {
        tip.textContent = node === null ? '' : plainLabel(String(node.label ?? ''), 80)
        tip.hidden = node === null
        if (node !== null) placeTip()
      })
    const controls = graph.controls()
    controls.autoRotateSpeed = ROTATE_SPEED
    // The tab may have been left while the library loaded: a hidden map does not animate.
    if (!shown) graph.pauseAnimation()
    const fit = () => {
      if (graph === null) return
      const box = stage.getBoundingClientRect()
      graph.width(Math.max(1, Math.floor(box.width))).height(Math.max(1, Math.floor(box.height)))
    }
    fit()
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(stage)
    drawnKey = ''
    renderGraph()
    renderControls()
    flyTo()
  }

  render()
  void sync()
  void start()

  return {
    visible(next: boolean) {
      shown = next
      if (graph === null) return
      if (next) graph.resumeAnimation()
      else graph.pauseAnimation()
      graph.controls().autoRotate = state.rotating && shown
    },
  }
}
