/**
 * Shared shape for every MCP tool definition in this server.
 *
 * `inputSchema` is a plain JSON Schema object the MCP runtime forwards
 * verbatim to the agent — keep it minimal and self-describing.
 * `handler` returns anything JSON-serializable; we wrap it as a text
 * content block at the call site.
 */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Common pagination block — reused so every list tool exposes it the same way. */
export const PAGINATION_PROPS = {
  page: {
    type: 'integer',
    minimum: 1,
    default: 1,
    description: '1-indexed page number. Increment to walk the next page of results.',
  },
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 25,
    description: 'Items per page (1-100). Default 25.',
  },
} as const;

/** Idempotency arg — mention this on every mutation. */
export const IDEMPOTENCY_PROP = {
  idempotencyKey: {
    type: 'string',
    description:
      'Optional unique key (e.g. a UUID or stable hash of the action). If the same key is replayed within 24h the server returns the original response instead of re-executing — pass one whenever you might retry on a transient error.',
  },
} as const;
