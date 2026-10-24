import { createRequire } from "node:module";
import * as path from "node:path";
import { resolveRuntimeModule } from "@oh-my-pi/pi-utils";
import type * as Fastembed from "fastembed";
import packageManifest from "../../package.json" with { type: "json" };

type FastembedModule = typeof Fastembed;

/**
 * `fastembed` is installed as a regular dependency of this package (see
 * `package.json`, which overrides `onnxruntime-node` to a version whose exit
 * crash ORT #24579 is fixed). It is loaded from that install only.
 *
 * There is deliberately no on-demand `bun install` fallback: a plugin never
 * installs packages or downloads a model behind the user's back. When the
 * direct import cannot resolve or its native loader fails, this module throws
 * an error naming the reason; `embeddings.ts` then treats local embeddings as
 * off (full-text recall) rather than reaching the network.
 */
const FASTEMBED_SPEC = packageManifest.peerDependencies.fastembed;

let fastembedLoad: Promise<FastembedModule> | null = null;

/** Inputs for selecting the Windows DLL directory paired with a fastembed installation. */
export interface WindowsFastembedRuntimeOptions {
	/** Resolved fastembed package entry whose dependency graph owns the ORT binding. */
	fastembedEntry: string;
	/** Directory containing fastembed's manifest and nested dependency graph. */
	fastembedPackageDir: string;
	/** Native architecture to select; defaults to the current process architecture. */
	arch?: string;
	/** Environment receiving the DLL search path; defaults to the subprocess environment. */
	env?: NodeJS.ProcessEnv;
}

/** The ORT module and DLL directory selected from fastembed's own dependency graph. */
export interface WindowsFastembedRuntime {
	/** Resolved entry for fastembed's own ONNX Runtime dependency. */
	ortEntry: string;
	/** Package directory containing the selected ORT manifest and native assets. */
	ortPackageDir: string;
	/** Directory prepended to `PATH` so Windows finds the paired native DLL. */
	dllDir: string;
}

/**
 * Prepend the ORT DLL directory paired with fastembed before Bun loads its
 * native binding. Compiled Windows binaries extract `.node` files to a
 * temporary directory, so the default DLL search can otherwise select an
 * unrelated `onnxruntime.dll` from the inherited system path.
 */
export async function prepareWindowsFastembedRuntime({
	fastembedEntry,
	fastembedPackageDir,
	arch = process.arch,
	env = process.env,
}: WindowsFastembedRuntimeOptions): Promise<WindowsFastembedRuntime> {
	const nestedNodeModules = path.join(fastembedPackageDir, "node_modules");
	const rootNodeModules = path.dirname(fastembedPackageDir);
	const nestedOrtEntry = resolveRuntimeModule(nestedNodeModules, "onnxruntime-node");
	const ortEntry = nestedOrtEntry ?? resolveRuntimeModule(rootNodeModules, "onnxruntime-node");
	const ortPackageDir = path.join(nestedOrtEntry ? nestedNodeModules : rootNodeModules, "onnxruntime-node");
	if (!ortEntry) {
		throw new Error(`Cannot find module onnxruntime-node beside ${fastembedEntry}`);
	}
	const dllGlob = new Bun.Glob(`bin/napi-*/win32/${arch}/onnxruntime.dll`);
	let dllDir: string | undefined;
	for await (const dll of dllGlob.scan({ cwd: ortPackageDir, absolute: true, onlyFiles: true })) {
		dllDir = path.dirname(dll);
		break;
	}
	if (!dllDir) {
		throw new Error(`Cannot find module onnxruntime-node Windows DLL for ${arch} beside ${ortEntry}`);
	}

	const currentPath = env.PATH;
	const normalizedDllDir = path.resolve(dllDir).toLowerCase();
	const alreadyPresent = currentPath
		?.split(path.delimiter)
		.some(entry => path.resolve(entry).toLowerCase() === normalizedDllDir);
	if (!alreadyPresent) env.PATH = currentPath ? `${dllDir}${path.delimiter}${currentPath}` : dllDir;
	return { ortEntry, ortPackageDir, dllDir };
}

export function loadFastembed(): Promise<FastembedModule> {
	fastembedLoad ??= loadFastembedOnce().catch(error => {
		fastembedLoad = null;
		throw error;
	});
	return fastembedLoad;
}

async function loadFastembedOnce(): Promise<FastembedModule> {
	const requireDirect = createRequire(import.meta.url);
	const manifestPath = requireDirect.resolve("fastembed/package.json");
	const manifest: { version?: unknown } = requireDirect(manifestPath);
	if (manifest.version !== FASTEMBED_SPEC) {
		throw new Error(`Cannot find package fastembed@${FASTEMBED_SPEC}; resolved ${String(manifest.version)}`);
	}
	return loadResolvedFastembed(requireDirect.resolve("fastembed"), path.dirname(manifestPath));
}

async function loadResolvedFastembed(entry: string, fastembedPackageDir: string): Promise<FastembedModule> {
	const requireFastembed = createRequire(entry);
	if (process.platform === "win32") {
		const { ortEntry } = await prepareWindowsFastembedRuntime({ fastembedEntry: entry, fastembedPackageDir });
		requireFastembed(ortEntry);
	}
	const loaded: FastembedModule = requireFastembed(entry);
	return loaded;
}
