#!/usr/bin/env bun
import { BeamMemory } from "./core/beam/index.js";
export interface CliIo {
    write(data: string): void;
}
export interface CliContext {
    readonly dataDir?: string;
    readonly dbPath?: string;
    readonly memory?: BeamMemory;
    readonly createMemory?: () => BeamMemory;
    readonly stdout?: CliIo;
    readonly stderr?: CliIo;
}
export declare class CliError extends Error {
    readonly exitCode: number;
    constructor(message: string, exitCode?: number);
}
type CommandHandler = (args: readonly string[], context?: CliContext) => number | Promise<number>;
export declare function withMemory<T>(context: CliContext | undefined, fn: (memory: BeamMemory) => T | Promise<T>): Promise<T>;
export declare function memoryStats(memory: BeamMemory, dataDir?: string): Record<string, unknown>;
export declare const cmdExport: CommandHandler;
export declare const cmdImport: CommandHandler;
export declare const cmdMcp: CommandHandler;
export declare const cmdRemember: CommandHandler;
export declare const cmdRecall: CommandHandler;
export declare const cmdUpdate: CommandHandler;
export declare const cmdDelete: CommandHandler;
export declare const cmdStats: CommandHandler;
export declare const cmdSleep: CommandHandler;
export declare const cmdScratchpad: CommandHandler;
export declare const cmdBank: CommandHandler;
export declare const cmdDiagnose: CommandHandler;
export declare const COMMANDS: Readonly<Record<string, CommandHandler>>;
export declare function printHelp(context?: CliContext): void;
export declare function runCli(args?: readonly string[], context?: CliContext): Promise<number>;
export {};
