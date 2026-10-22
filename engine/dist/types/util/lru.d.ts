export declare class LruCache<K, V> {
    #private;
    readonly maxSize: number;
    constructor(maxSize: number);
    get size(): number;
    has(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V): this;
    delete(key: K): boolean;
    clear(): void;
    entries(): IterableIterator<[K, V]>;
}
