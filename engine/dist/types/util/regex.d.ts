export declare const FACT_MATCH_STOPWORDS: Set<string>;
export declare const RECALL_SYNONYMS: Readonly<Record<string, readonly string[]>>;
export declare function isCjkChar(ch: string): boolean;
export declare function hasCjk(text: string): boolean;
export declare const containsSpacelessCjk: typeof hasCjk;
/**
 * Weak match between two forms of one word, in either direction: the longer token is the shorter
 * one plus an inflectional or common derivational ending (`facts`/`fact`, `deploy`/`deployment`,
 * `caching`/`cache`, `stories`/`story`). The shorter token needs at least four characters. Any
 * other extension or fragment never matches, so `1password`, `password` and `passport` do not
 * find `pass`, and `redis` does not find `redistribution`. This is deliberately not a stemmer.
 */
export declare function matchesWordForm(left: string, right: string): boolean;
export declare function recallTokens(text: string): string[];
export declare function expandedQueryTokens(tokens: readonly string[]): string[];
export declare function minimumRecallRelevance(queryTokens: readonly string[]): number;
export declare function cjkFtsTerms(text: string): string[];
export declare function ftsQueryTerms(query: string): string[];
