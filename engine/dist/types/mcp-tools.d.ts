import { BeamMemory } from "./core/beam/index.js";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type ToolArguments = Record<string, unknown>;
export type ToolResult = Record<string, unknown>;
export interface ToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: Record<string, unknown>;
        readonly required?: readonly string[];
    };
}
export declare const REMEMBER_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly content: {
            readonly type: "string";
            readonly description: "The memory content to store.";
        };
        readonly importance: {
            readonly type: "number";
            readonly description: "Importance score from 0.0 to 1.0.";
            readonly default: 0.5;
        };
        readonly source: {
            readonly type: "string";
            readonly description: "Source tag for this memory.";
            readonly default: "user";
        };
        readonly scope: {
            readonly type: "string";
            readonly description: "Memory scope: session, global, channel, or a custom scope.";
            readonly default: "session";
        };
        readonly valid_until: {
            readonly type: "string";
            readonly description: "Optional expiry date or timestamp.";
        };
        readonly extract_entities: {
            readonly type: "boolean";
            readonly description: "Extract named entities for fuzzy recall.";
            readonly default: false;
        };
        readonly extract: {
            readonly type: "boolean";
            readonly description: "Extract structured facts from content.";
            readonly default: false;
        };
        readonly metadata: {
            readonly type: "object";
            readonly description: "Optional key-value metadata.";
            readonly default: {};
        };
        readonly veracity: {
            readonly type: "string";
            readonly description: "Confidence label for the memory.";
            readonly default: "unknown";
        };
        readonly author_id: {
            readonly type: "string";
            readonly description: "Author identifier for this MCP call.";
        };
        readonly author_type: {
            readonly type: "string";
            readonly description: "Author type: human, agent, or system.";
        };
        readonly channel_id: {
            readonly type: "string";
            readonly description: "Channel or group this memory belongs to.";
        };
        readonly bank: {
            readonly type: "string";
            readonly description: "Memory bank to store in.";
            readonly default: "default";
        };
    };
    readonly required: readonly ["content"];
};
export declare const RECALL_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly query: {
            readonly type: "string";
            readonly description: "Natural-language search query.";
        };
        readonly limit: {
            readonly type: "integer";
            readonly description: "Maximum results to return.";
            readonly default: 5;
        };
        readonly top_k: {
            readonly type: "integer";
            readonly description: "Maximum results to return.";
            readonly default: 5;
        };
        readonly bank: {
            readonly type: "string";
            readonly description: "Memory bank to search.";
            readonly default: "default";
        };
        readonly temporal_weight: {
            readonly type: "number";
            readonly description: "Temporal boost weight. 0.0 disables recency boost.";
            readonly default: 0;
        };
        readonly query_time: {
            readonly type: "string";
            readonly description: "ISO timestamp to treat as now for temporal scoring.";
        };
        readonly temporal_halflife: {
            readonly type: "number";
            readonly description: "Temporal decay half-life in hours.";
            readonly default: 24;
        };
        readonly vec_weight: {
            readonly type: "number";
            readonly description: "Vector similarity weight.";
        };
        readonly fts_weight: {
            readonly type: "number";
            readonly description: "Full-text search weight.";
        };
        readonly importance_weight: {
            readonly type: "number";
            readonly description: "Importance score weight.";
        };
        readonly author_id: {
            readonly type: "string";
            readonly description: "Filter by author identifier.";
        };
        readonly author_type: {
            readonly type: "string";
            readonly description: "Filter by author type.";
        };
        readonly channel_id: {
            readonly type: "string";
            readonly description: "Filter by channel/group.";
        };
    };
    readonly required: readonly ["query"];
};
export declare const SHARED_REMEMBER_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly content: {
            readonly type: "string";
            readonly description: "Surface memory content to store.";
        };
        readonly kind: {
            readonly type: "string";
            readonly description: "meta | preference | correction | identity";
            readonly default: "meta";
        };
        readonly importance: {
            readonly type: "number";
            readonly description: "Importance score from 0.0 to 1.0.";
            readonly default: 0.8;
        };
        readonly veracity: {
            readonly type: "string";
            readonly description: "Confidence label.";
            readonly default: "unknown";
        };
        readonly metadata: {
            readonly type: "object";
            readonly description: "Optional metadata object.";
            readonly default: {};
        };
    };
    readonly required: readonly ["content"];
};
export declare const SHARED_RECALL_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly query: {
            readonly type: "string";
            readonly description: "Surface memory query.";
        };
        readonly limit: {
            readonly type: "integer";
            readonly default: 5;
        };
    };
    readonly required: readonly ["query"];
};
export declare const SHARED_FORGET_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly memory_id: {
            readonly type: "string";
            readonly description: "Memory ID to delete.";
        };
    };
    readonly required: readonly ["memory_id"];
};
export declare const SLEEP_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly dry_run: {
            readonly type: "boolean";
            readonly description: "Preview consolidation without writes.";
            readonly default: false;
        };
        readonly all_sessions: {
            readonly type: "boolean";
            readonly description: "Consolidate all eligible sessions.";
            readonly default: false;
        };
        readonly bank: {
            readonly type: "string";
            readonly description: "Memory bank to consolidate.";
            readonly default: "default";
        };
    };
};
export declare const INVALIDATE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly memory_id: {
            readonly type: "string";
            readonly description: "ID of memory to invalidate.";
        };
        readonly replacement_id: {
            readonly type: "string";
            readonly description: "Optional replacement memory ID.";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["memory_id"];
};
export declare const VALIDATE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly memory_id: {
            readonly type: "string";
            readonly description: "ID of memory to validate.";
        };
        readonly action: {
            readonly type: "string";
            readonly enum: readonly ["attest", "update", "invalidate", "delete"];
        };
        readonly validator: {
            readonly type: "string";
            readonly description: "Agent identifier performing validation.";
        };
        readonly new_content: {
            readonly type: "string";
            readonly description: "New content for action=update.";
        };
        readonly note: {
            readonly type: "string";
            readonly description: "Optional reason or evidence.";
        };
        readonly bank: {
            readonly type: "string";
            readonly enum: readonly ["private", "surface"];
            readonly default: "private";
        };
    };
    readonly required: readonly ["memory_id", "action"];
};
export declare const GET_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly memory_id: {
            readonly type: "string";
            readonly description: "The memory ID to retrieve.";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["memory_id"];
};
export declare const TRIPLE_ADD_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly subject: {
            readonly type: "string";
        };
        readonly predicate: {
            readonly type: "string";
        };
        readonly object: {
            readonly type: "string";
        };
        readonly valid_from: {
            readonly type: "string";
            readonly description: "ISO date.";
        };
        readonly source: {
            readonly type: "string";
            readonly default: "conversation";
        };
        readonly confidence: {
            readonly type: "number";
            readonly default: 1;
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["subject", "predicate", "object"];
};
export declare const TRIPLE_QUERY_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly subject: {
            readonly type: "string";
        };
        readonly predicate: {
            readonly type: "string";
        };
        readonly object: {
            readonly type: "string";
        };
        readonly as_of: {
            readonly type: "string";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
};
export declare const SCRATCHPAD_WRITE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly content: {
            readonly type: "string";
            readonly description: "Content to write to scratchpad.";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["content"];
};
export declare const SCRATCHPAD_READ_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
};
export declare const SCRATCHPAD_CLEAR_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
};
export declare const EXPORT_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly output_path: {
            readonly type: "string";
            readonly description: "File path to write the export JSON.";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["output_path"];
};
export declare const UPDATE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly memory_id: {
            readonly type: "string";
            readonly description: "ID of the memory to update.";
        };
        readonly content: {
            readonly type: "string";
            readonly description: "New content for the memory.";
        };
        readonly importance: {
            readonly type: "number";
            readonly description: "New importance score.";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["memory_id", "content"];
};
export declare const FORGET_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly memory_id: {
            readonly type: "string";
            readonly description: "ID of the memory to delete.";
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["memory_id"];
};
export declare const IMPORT_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly input_path: {
            readonly type: "string";
            readonly description: "File path to read the export JSON from.";
        };
        readonly force: {
            readonly type: "boolean";
            readonly description: "Overwrite existing records instead of skipping.";
            readonly default: false;
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["input_path"];
};
export declare const GRAPH_QUERY_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly seed_memory_id: {
            readonly type: "string";
        };
        readonly max_hops: {
            readonly type: "integer";
            readonly default: 2;
        };
        readonly edge_type: {
            readonly type: "string";
        };
        readonly min_weight: {
            readonly type: "number";
            readonly default: 0;
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["seed_memory_id"];
};
export declare const GRAPH_LINK_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly source_id: {
            readonly type: "string";
        };
        readonly target_id: {
            readonly type: "string";
        };
        readonly relationship: {
            readonly type: "string";
        };
        readonly weight: {
            readonly type: "number";
            readonly default: 0.5;
        };
        readonly bank: {
            readonly type: "string";
            readonly default: "default";
        };
    };
    readonly required: readonly ["source_id", "target_id", "relationship"];
};
export declare const TOOLS: readonly ToolDefinition[];
export declare function withBeam<T>(args: ToolArguments, fn: (beam: BeamMemory, bank: string) => T | Promise<T>): Promise<T>;
export declare function handleToolCall(name: string, args?: ToolArguments): Promise<ToolResult>;
export declare function getToolDefinitions(): readonly ToolDefinition[];
