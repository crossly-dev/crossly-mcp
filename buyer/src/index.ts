#!/usr/bin/env node
/**
 * @crossly/buyer-mcp — Model Context Protocol server for the Crossly BUYER API.
 *
 * Lets an AI agent act on a person's own shopping: what they bought, what is
 * in their cart, what they have saved, what cashback they are owed, and what
 * price they want to offer.
 *
 * ── THIS IS NOT THE SELLER SERVER ────────────────────────────────────
 * `@crossly/mcp` drives a seller's store — listings, crossposting, fulfilment.
 * This one drives a shopper's account. Different API, different principal,
 * different token. Run both in one host if you like; they read different env
 * vars precisely so that works.
 *
 * Transport: stdio. The host launches us, talks JSON-RPC over stdin/stdout,
 * tears us down at session end.
 *
 * Auth: a buyer OAuth token in CROSSLY_BUYER_TOKEN, carrying `buyer:*` scopes.
 * Scopes are enforced server-side — a token without `buyer:cashback:read`
 * simply cannot call `get_my_cashback`, and the tool says so.
 *
 * NOTHING HERE SPENDS MONEY. No tool completes a purchase and no endpoint sits
 * behind one. An agent must never tell a user it has bought something.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { requireToken } from './api.js';
import { ALL_TOOLS, TOOL_INDEX } from './registry.js';

async function main(): Promise<void> {
  // Fail fast with a useful message if the token is missing or the wrong kind.
  // This is what the host process's error popup shows, so be explicit.
  requireToken();

  const server = new Server(
    { name: '@crossly/buyer-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
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
            text:
              `Unknown tool: ${name}. Use tools/list to discover what is available. ` +
              'Note this is the BUYER server — store-management tools live in @crossly/mcp.',
          },
        ],
      };
    }

    try {
      const result = await tool.handler((args ?? {}) as Record<string, unknown>);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: msg }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Anything before the transport connects (e.g. a missing token) lands here.
  // eslint-disable-next-line no-console
  console.error(`[crossly-buyer-mcp] fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
