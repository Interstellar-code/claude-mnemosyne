// The engine build this plugin expects: engine/package.json's version, which
// /mnemosyne-setup installs (engine/UPSTREAM.md, change 3). No imports, so the
// hooks, the proxy, scripts and Bun specs can all read it.
export const ENGINE_BUILD = '18.12.3-mnemosyne.11'

// /mnemosyne-setup's limit on bin/install-engine.ts, and the installer's own
// limits on its steps: the inner ones stay well below the outer one, so the
// installer always ends (and cleans up .next) before the host kills it.
export const SETUP_TIMEOUT_MS = 600_000
export const INSTALL_STEP_TIMEOUT_MS = 240_000
// The embeddings check downloads the ~63 MB model once on this run, so it is
// allowed far longer than a plain tools/list probe.
export const INSTALL_CHECK_TIMEOUT_MS = 300_000
