import { apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets dealer curve pools, sudoswap-style (api
 * routes/v1/write/vault-markets-curve-pools.ts). An approved dealer (ID
 * checked) runs a bonding curve on one book key from their own vault units
 * and their own custodian cash. Linear: each unit the pool sells moves spot up
 * by delta cents and each unit it buys moves it down by delta. Exponential:
 * delta is basis points and spot multiplies or divides by (1 + delta/10000).
 * The pool asks up(spot) plus its fee and bids spot less its fee, one unit a
 * level. Crossly is only the venue: every leg is an ordinary resting order
 * paying the ordinary maker fee. Every money figure is integer cents of US
 * dollars. Never quote a price that did not come back from these tools.
 */
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const POOL_ID = { type: 'string', description: 'Curve pool id (uuid), from list_vault_markets_curve_pools.' } as const;
const KIND = { type: 'string', enum: ['linear', 'exponential'], description: '"linear" (delta is cents a step) or "exponential" (delta is basis points a step, 10 to 5000).' } as const;
const SPOT = { type: 'integer', minimum: 100, description: 'Spot price in cents of US dollars ($1 or more). The pool bids spot less the fee and asks one step up plus the fee.' } as const;
const DELTA = { type: 'integer', minimum: 1, description: 'The step: cents of US dollars for "linear" (smaller than spot), basis points for "exponential" (100 = 1%).' } as const;
const FEE = { type: 'integer', minimum: 0, maximum: 2000, description: 'Your own fee on each side in basis points (100 = 1%, at most 2000). Default 0.' } as const;
const DEPTH = { type: 'integer', minimum: 1, maximum: 5, description: 'Single-unit levels shown on each side (1 to 5). Default 1.' } as const;
const UNITS = { type: 'integer', minimum: 0, description: 'Units of the item the pool may sell. You must hold that many free (stored, not listed, lent or liened) in your vault.' } as const;
const CASH = { type: 'integer', minimum: 0, description: 'Buy budget in cents of US dollars, from your Vault Markets custodian account (must hold at least this). 0 = sell only.' } as const;
const FLOOR = { type: ['integer', 'null'], minimum: 1, description: 'Never bid below this, in cents of US dollars; null for no floor.' } as const;
const CEILING = { type: ['integer', 'null'], minimum: 1, description: 'Never ask above this, in cents of US dollars; null for no ceiling.' } as const;
const RECYCLE = { type: 'boolean', description: 'Proceeds recycling: true puts the proceeds of each sale back into the buy budget, but only after the custodian confirms the cash is in your account; false (default) pays sales out the ordinary way.' } as const;
const SETTINGS = { kind: KIND, spotCents: SPOT, delta: DELTA, feeBps: FEE, depth: DEPTH, units: UNITS, cashCents: CASH, minPriceCents: FLOOR, maxPriceCents: CEILING };

export const vaultMarketsCurvePoolsTools: ToolDef[] = [
  {
    name: 'list_vault_markets_curve_pools',
    description: 'Your dealer curve pools: curve, spot, units, buy budget, totals bought and sold, the ladder each shows, its live legs, and its state (quoting, one_sided, idle, paused, closed) with the reason. All money in cents of US dollars.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'all'], description: '"open" (default: active and paused pools) or "all" (closed ones too).' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/dealer/pools', args as Record<string, unknown>),
  },
  {
    name: 'preview_vault_markets_curve_pool',
    description: 'The bids and asks a set of curve settings would show, with why each side stops (no_units, no_cash, floor, ceiling, curve_end). Places nothing; no account needed.',
    inputSchema: { type: 'object', properties: SETTINGS, required: ['kind', 'spotCents', 'delta'], additionalProperties: false },
    handler: (args) => apiPost('/v1/vault-markets/dealer/pools/preview', args),
  },
  {
    name: 'create_vault_markets_curve_pool',
    description: 'Open a curve pool on a key (approved dealers only, ID checked; one open pool per key). Its single-unit bids and asks go on the book at once and move along the curve as they fill. It is your money and your inventory risk; a buy budget needs your custodian account. Ask the user to confirm the settings first.',
    inputSchema: { type: 'object', properties: { bookKey: BOOK_KEY, ...SETTINGS, recycleProceeds: RECYCLE }, required: ['bookKey', 'kind', 'spotCents', 'delta'], additionalProperties: false },
    handler: (args) => apiPost('/v1/vault-markets/dealer/pools', args),
  },
  {
    name: 'get_vault_markets_curve_pool',
    description: 'One of your curve pools, with its ladder and live legs. Money in cents of US dollars.',
    inputSchema: { type: 'object', properties: { id: POOL_ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      const pid = encodeURIComponent(id);
      return apiGet(`/v1/vault-markets/dealer/pools/${pid}`);
    },
  },
  {
    name: 'update_vault_markets_curve_pool',
    description: 'Change a curve pool: spot, step, fee, levels, units, buy budget, floor, ceiling, or pause / resume it. The ladder is re-quoted at once. Ask the user to confirm first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: POOL_ID,
        spotCents: SPOT,
        delta: DELTA,
        feeBps: FEE,
        depth: DEPTH,
        units: UNITS,
        cashCents: CASH,
        minPriceCents: FLOOR,
        maxPriceCents: CEILING,
        status: { type: 'string', enum: ['active', 'paused'], description: '"paused" takes every leg off the book; "active" puts the ladder back (refused while Crossly operations hold it paused).' },
        recycleProceeds: RECYCLE,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as { id: string } & Record<string, unknown>;
      const pid = encodeURIComponent(id);
      return apiPatch(`/v1/vault-markets/dealer/pools/${pid}`, body);
    },
  },
  {
    name: 'close_vault_markets_curve_pool',
    description: 'Close a curve pool: its legs come off the book; what filled stays filled. Ask the user to confirm first.',
    inputSchema: { type: 'object', properties: { id: POOL_ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      const pid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/dealer/pools/${pid}/close`, {});
    },
  },
  {
    name: 'list_vault_markets_curve_pool_fills',
    description: 'A curve pool fills, newest first: side ("bid" = the pool bought, "ask" = it sold), price in cents of US dollars, and spot after.',
    inputSchema: {
      type: 'object',
      properties: { id: POOL_ID, limit: { type: 'integer', minimum: 1, maximum: 500, description: 'How many fills (default 100).' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, limit } = args as { id: string; limit?: number };
      const pid = encodeURIComponent(id);
      return apiGet(`/v1/vault-markets/dealer/pools/${pid}/fills`, limit ? { limit } : undefined);
    },
  },
];
