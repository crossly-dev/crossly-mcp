/**
 * The buyer tool registry — every Buyer API endpoint, in one array.
 *
 * ── WHY IT IS ITS OWN MODULE ─────────────────────────────────────────
 * `index.ts` is the MCP server's ENTRY POINT: it calls `main()` at the bottom,
 * so importing anything from it starts a server on stdio. `@crossly/buyer-cli`
 * generates its whole command tree from this list, and a CLI that spawned an
 * MCP server merely by asking "what commands exist?" would be a genuinely
 * confusing bug.
 *
 * One definition, two surfaces, no second list to keep in step.
 */
import { buyerTools } from './tools/buyer.js';
import { vaultTools } from './tools/vault.js';
import type { ToolDef } from './tools/types.js';

export type { ToolDef } from './tools/types.js';

export const ALL_TOOLS: ToolDef[] = [...buyerTools, ...vaultTools];

/** Lookup by name, for dispatchers on both frontends. */
export const TOOL_INDEX: Map<string, ToolDef> = new Map(ALL_TOOLS.map((t) => [t.name, t]));
