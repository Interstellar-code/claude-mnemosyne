// A fake of the solar scene's interface (contract C13, MAPX.11): it records every call the page makes and lets a spec
// fire the scene's callbacks (onHover, onPick, onLevel) back, so the page shell is tested without WebGL.
import type { MapEvent } from '../../ui/map-live'
import type { SolarSceneApi, SolarSceneOptions, SolarView, SolarViewName } from '../../ui/map-state'
import type { SolarGalaxy, Target } from '../../ui/solar-layout'

export type SceneCall =
  | { call: 'setData'; galaxy: SolarGalaxy }
  | { call: 'setView'; view: SolarView }
  | { call: 'flyTo'; target: Target }
  | { call: 'showView'; name: SolarViewName }
  | { call: 'zoom'; factor: number }
  | { call: 'event'; event: MapEvent }
  | { call: 'dispose' }

export type FakeScene = SolarSceneApi & {
  calls: SceneCall[]
  options: SolarSceneOptions
  /** The calls of one kind, in order. */
  of: <K extends SceneCall['call']>(call: K) => Extract<SceneCall, { call: K }>[]
  /** The scene lands on a level (what a flight or a click does in the real one). */
  level: (level: Target) => void
  hover: (tip: string[] | null, x?: number, y?: number) => void
  pick: (target: Target) => void
}

/** A factory for `SolarHost.createScene` that remembers every scene it makes. */
export function fakeSceneFactory() {
  const scenes: FakeScene[] = []
  const createScene = (options: SolarSceneOptions): FakeScene => {
    const calls: SceneCall[] = []
    const scene: FakeScene = {
      calls,
      options,
      setData: galaxy => void calls.push({ call: 'setData', galaxy }),
      setView: view => void calls.push({ call: 'setView', view }),
      flyTo: target => void calls.push({ call: 'flyTo', target }),
      showView: name => void calls.push({ call: 'showView', name }),
      zoom: factor => void calls.push({ call: 'zoom', factor }),
      event: event => void calls.push({ call: 'event', event }),
      dispose: () => void calls.push({ call: 'dispose' }),
      of: call => calls.filter(entry => entry.call === call) as never,
      level: level => options.onLevel(level),
      hover: (tip, x = 400, y = 300) => options.onHover(tip, x, y),
      pick: target => options.onPick(target),
    }
    scenes.push(scene)
    return scene
  }
  return { createScene, scenes, last: () => scenes.at(-1)! }
}
