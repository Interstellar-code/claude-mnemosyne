// Bun test preload (bunfig.toml): `bun test` never fires process 'exit', so the temp
// homes isolatedEnv() and engineCall() make, and the engine specs' testHome(), are removed here, once the whole run ends.
import { afterAll } from 'bun:test'
import { cleanupTestHome } from '../../engine/test/helpers'
import { cleanupIsolated } from './helpers'

// A full run leaves over a thousand homes to remove, which takes longer than the 5 s hook default.
afterAll(cleanupIsolated, 120_000)
afterAll(cleanupTestHome)
