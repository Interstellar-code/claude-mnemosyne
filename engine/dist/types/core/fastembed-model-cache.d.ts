/**
 * Whether `FlagEmbedding.init` can load `model` from `cacheDir` without a
 * download. fastembed caches each file under `<cacheDir>/<repo with / → _>/`
 * and fetches only the files that are missing, so a model is cached exactly
 * when every file is present. Unknown models report false. The agent's embed
 * client uses this to decide whether an init shows download activity.
 */
export declare function isFastembedModelCached(model: string, cacheDir: string): Promise<boolean>;
