import { type RuntimeInstallSpec } from "@oh-my-pi/pi-utils";
import type * as Fastembed from "fastembed";
type FastembedModule = typeof Fastembed;
/** Runtime install inputs for the optional fastembed embedding stack. */
export interface FastembedRuntimeInstallPlan {
    /** Cache directory key; changes when runtime resolution policy changes. */
    versionKey: string;
    /** Dependency graph written to the runtime cache package manifest. */
    install: RuntimeInstallSpec;
}
/** Build the deterministic fastembed runtime install plan used by local embeddings. */
export declare function fastembedRuntimeInstallPlan(): FastembedRuntimeInstallPlan;
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
export declare function prepareWindowsFastembedRuntime({ fastembedEntry, fastembedPackageDir, arch, env, }: WindowsFastembedRuntimeOptions): Promise<WindowsFastembedRuntime>;
export declare function loadFastembed(): Promise<FastembedModule>;
export {};
