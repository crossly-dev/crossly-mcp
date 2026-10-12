import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The shopping agent on Vault Markets (api routes/v1/write/vault-markets-agent.ts):
 * price watches on a book key, and the limit orders the agent drafted.
 * A watch never trades. A draft places nothing; there is deliberately no
 * confirm tool: an order is placed only when the user asks for that exact
 * order, with place_vault_markets_pro_order and the draft's orderBody.
 * Reads need vault-markets:read, changes vault-markets:trade.
 */
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:near_mint:psa:10"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;

export const vaultMarketsAgentTools: ToolDef[] = [
  {
    name: 'list_vault_markets_agent_watches',
    description: 'Your price watches on Vault Markets book keys, live first. Each has the metric watched ("bid" best open bid, "ask" lowest open ask, "last" last trade, "mark" market price), its direction, the threshold and the last value seen (cents of US dollars), and its status ("live", "fired", "cancelled", "expired").',
    inputSchema: {
      type: 'object',
      properties: { live: { type: 'boolean', description: 'true = only live watches; false or left out = live first, then ended ones.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { live } = args as { live?: boolean };
      return apiGet('/v1/vault-markets/agent/watches', live ? { live: 'true' } : {});
    },
  },
  {
    name: 'create_vault_markets_agent_watch',
    description: 'Watch one book key and tell the user once when a number crosses a price, e.g. "tell me when the PSA 10 bid crosses $400". It fires on a crossing from the side the number was on when set, so a number already past the price waits for the next crossing. Never trades. At most 50 live watches, each for 90 days.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        metric: { type: 'string', enum: ['bid', 'ask', 'last', 'mark'], description: 'What to watch: "bid" the best open bid, "ask" the lowest open ask, "last" the last trade, "mark" the market price.' },
        direction: { type: 'string', enum: ['above', 'below'], description: 'Optional. "above" fires when the number rises to or past the price; "below" when it falls to or under it. Leave out for "crosses": whichever way it has to move.' },
        thresholdCents: { type: 'integer', minimum: 1, maximum: 100_000_000, description: 'The price, in cents of US dollars (the currency), a whole number.' },
      },
      required: ['bookKey', 'metric', 'thresholdCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, metric, direction, thresholdCents } = args as { bookKey: string; metric: string; direction?: string; thresholdCents: number };
      return apiPost('/v1/vault-markets/agent/watches', { bookKey, metric, ...(direction ? { direction } : {}), thresholdCents });
    },
  },
  {
    name: 'cancel_vault_markets_agent_watch',
    description: 'Cancel a live price watch. Returns the watch.',
    inputSchema: { type: 'object', properties: { id: ID('Watch') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/vault-markets/agent/watches/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'list_vault_markets_agent_drafts',
    description: 'Limit orders the shopping agent drafted for the user, newest first: item, side ("buy" or "sell"), units, limit and notional (cents of US dollars), the book when drafted, status ("drafted", "placing", "placed", "rejected", "cancelled", "expired") and the orderBody that would place it. A draft places nothing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/agent/drafts', {}),
  },
  {
    name: 'get_vault_markets_agent_draft',
    description: 'One drafted order with its orderBody. Only if the user explicitly confirms this exact order may it be placed, with place_vault_markets_pro_order and that orderBody.',
    inputSchema: { type: 'object', properties: { id: ID('Draft') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/agent/drafts/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'cancel_vault_markets_agent_draft',
    description: 'Throw a drafted order away (only while it is still a draft). Returns { ok, draft }.',
    inputSchema: { type: 'object', properties: { id: ID('Draft') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/agent/drafts/${encodeURIComponent(id)}/cancel`, {});
    },
  },
];
