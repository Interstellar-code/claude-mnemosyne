export declare const DEFAULT_PLUGIN_DIR: string;
export type PluginConfig = Record<string, unknown>;
export type MemoryDict = Record<string, unknown>;
export declare class MnemopiPlugin {
    static readonly abstractBase = true;
    name: string;
    version: string;
    enabled: boolean;
    protected initialized: boolean;
    readonly config: PluginConfig;
    constructor(config?: PluginConfig);
    initialize(): void;
    shutdown(): void;
    onRemember(_memory: MemoryDict): void;
    onRecall(_memory: MemoryDict): void;
    onConsolidate(_summary: MemoryDict): void;
    onInvalidate(_memoryId: string): void;
    toDict(): Record<string, unknown>;
}
export declare class LoggingPlugin extends MnemopiPlugin {
    name: string;
    version: string;
    private readonly memoryLog;
    private readonly maxEntries;
    constructor(config?: PluginConfig);
    private append;
    onRemember(memory: MemoryDict): void;
    onRecall(memory: MemoryDict): void;
    onConsolidate(summary: MemoryDict): void;
    onInvalidate(memoryId: string): void;
    getLog(): MemoryDict[];
    clearLog(): void;
}
export declare class MetricsPlugin extends MnemopiPlugin {
    name: string;
    version: string;
    private readonly counters;
    private readonly timings;
    private readonly maxTimingSamples;
    constructor(config?: PluginConfig);
    onRemember(_memory: MemoryDict): void;
    onRecall(_memory: MemoryDict): void;
    onConsolidate(_summary: MemoryDict): void;
    onInvalidate(_memoryId: string): void;
    recordTiming(event: string, durationMs: number): void;
    getCounters(): Record<string, number>;
    getTimings(event: string): number[];
    getAverageTiming(event: string): number | null;
    reset(): void;
    getSummary(): Record<string, unknown>;
}
export type FilterRule = (item: MemoryDict) => boolean;
export declare class FilterPlugin extends MnemopiPlugin {
    name: string;
    version: string;
    private readonly rules;
    private readonly blocked;
    private readonly maxBlocked;
    constructor(config?: PluginConfig);
    addRule(rule: FilterRule): void;
    removeRule(rule: FilterRule): void;
    clearRules(): void;
    onRemember(memory: MemoryDict): void;
    onRecall(memory: MemoryDict): void;
    onConsolidate(summary: MemoryDict): void;
    onInvalidate(_memoryId: string): void;
    private passes;
    private block;
    getBlocked(): MemoryDict[];
    isBlocked(memoryId: string): boolean;
}
export declare class CompressionPlugin extends MnemopiPlugin {
    name: string;
    version: string;
    enabled: boolean;
    private readonly threshold;
    constructor(config?: PluginConfig);
    compressLines(lines: string[]): string[];
    onRemember(_memory: MemoryDict): void;
    onRecall(_memory: MemoryDict): void;
    onConsolidate(_summary: MemoryDict): void;
    onInvalidate(_memoryId: string): void;
}
export type PluginConstructor<T extends MnemopiPlugin = MnemopiPlugin> = new (config?: PluginConfig) => T;
export declare class PluginManager {
    private readonly pluginDir;
    private readonly registry;
    private readonly instances;
    constructor(pluginDir?: string);
    registerPlugin(name: string, pluginClass: PluginConstructor): void;
    loadPlugin(name: string, config?: PluginConfig): MnemopiPlugin;
    unloadPlugin(name: string): void;
    listPlugins(): Array<Record<string, unknown>>;
    getPlugin(name: string): MnemopiPlugin | null;
    isLoaded(name: string): boolean;
    isRegistered(name: string): boolean;
    loadAll(configs?: Record<string, PluginConfig>): MnemopiPlugin[];
    unloadAll(): void;
    discoverPlugins(): string[];
    notifyRemember(memory: MemoryDict): void;
    notifyRecall(memory: MemoryDict): void;
    notifyConsolidate(summary: MemoryDict): void;
    notifyInvalidate(memoryId: string): void;
}
export declare class ValueError extends Error {
    name: string;
}
export declare function getManager(): PluginManager;
export declare function resetManager(): void;
