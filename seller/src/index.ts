#!/usr/bin/env node
/**
 * @crosslister/mcp-server — Model Context Protocol server for Crossly.
 *
 * Exposes the Crossly public API (read.ts + write.ts) as MCP tools so an
 * AI agent (Claude Desktop, Cursor, Cline, etc.) can run a reseller's
 * multi-marketplace store: list new items, crosspost, edit prices,
 * submit tracking, reply to buyers, review KPIs, etc.
 *
 * Transport: stdio. The host launches us, talks JSON-RPC over stdin/stdout,
 * tears us down at session end. No long-lived process or HTTP listener.
 *
 * Auth: every tool call uses the seller's PAT (CROSSLY_PAT env var).
 * Scopes on the PAT are enforced server-side — a token without
 * `listings:write` simply can't call crosspost_listing.
 *
 * If you add a tool, add it to TOOL_DOMAINS below — the dispatcher maps
 * by tool.name automatically.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { requirePat } from './api.js';
import { ALL_TOOLS } from './registry.js';
import type { ToolDef } from './tools/types.js';

const TOOL_INDEX = new Map<string, ToolDef>(ALL_TOOLS.map((t) => [t.name, t]));

async function main(): Promise<void> {
  // Fail fast with a useful message if the user forgot the env var. This is
  // what the host-process error popup shows them, so be explicit.
  requirePat();

  const server = new Server(
    {
      name: '@crossly/mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = TOOL_INDEX.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Use the tools/list method to discover available tools.`,
          },
        ],
      };
    }

    try {
      const result = await tool.handler((args ?? {}) as Record<string, unknown>);
      const text =
        typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return {
        content: [{ type: 'text', text }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: msg }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport keeps the process alive until the client disconnects.
}

main().catch((err) => {
  // Anything from main() before the transport connects (e.g. missing PAT)
  // lands here — write to stderr so the host's log shows it, then exit non-zero.
  // eslint-disable-next-line no-console
  console.error(`[crossly-mcp] fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
