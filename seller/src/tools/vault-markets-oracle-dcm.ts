import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets oracle publishing and the partner exchange's index futures and
 * options (api routes/v1/write/vault-markets-oracle-dcm.ts). Crossly publishes
 * its built-in indexes as a signed oracle feed and shows the partner
 * exchange's market read-only: it never lists, prices, matches or clears a
 * contract, never holds a position, and never reads its own feed back.
 */
export const vaultMarketsOracleDcmTools: ToolDef[] = [
  {
    name: 'get_vault_markets_oracle',
    description: 'Crossly as an oracle publisher: whether it is configured (open, missing env names), the network ("pyth" or "switchboard"), the ed25519 signer key, each published index feed with its latest attempt (status "published", "skipped" with a reason, or "failed"), and 24 hour counts. Only built-in indexes priced from A/B marks are published.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/oracle', {}),
  },
  {
    name: 'get_vault_markets_oracle_value',
    description: 'The latest published oracle value for a Crossly index: level, fixed-point price and confidence at the feed exponent, confidenceBps (basis points), stalenessSec, coverageBps, the exact signed message with its ed25519 signature (base64) and signer key, ageSec and fresh.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Index slug, from list_vault_markets_indexes (built-in indexes only).' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/vault-markets/oracle/${encodeURIComponent(slug)}`, {});
    },
  },
  {
    name: 'list_vault_markets_oracle_history',
    description: 'Recent oracle publish attempts for a Crossly index over 30 days, newest first: "published", "skipped" (with reasonText, for example too few items priced today or marks too old) or "failed" (with the error).',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Index slug.' },
        status: { type: 'string', enum: ['published', 'skipped', 'failed'], description: 'Only attempts with this outcome: "published", "skipped" or "failed".' },
        limit: { type: 'number', description: 'Most rows to return, 1 to 500 (default 100).' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, status, limit } = args as { slug: string; status?: string; limit?: number };
      return apiGet(`/v1/vault-markets/oracle/${encodeURIComponent(slug)}/history`, { status, limit });
    },
  },
  {
    name: 'get_vault_markets_dcm',
    description: 'The partner exchange (DCM) that lists and clears futures and options on Crossly indexes, whether it is configured (open, missing env names), and its contracts as last read: kind ("perp", "future" or "option"), the index each settles on, multiplier (dollars per index point), tick, expiry, strike. Read-only: Crossly is the index licensor and data provider, never the venue.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/dcm', {}),
  },
  {
    name: 'get_vault_markets_dcm_contract',
    description: 'One partner exchange contract: its spec, its funding prints newest first (rateBps per period; positive means longs pay shorts; the partner settles funding), annualisedBps over the last 21 prints, and the Crossly index level it settles on.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Contract symbol, from get_vault_markets_dcm.' },
      },
      required: ['symbol'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { symbol } = args as { symbol: string };
      return apiGet(`/v1/vault-markets/dcm/contracts/${encodeURIComponent(symbol)}`, {});
    },
  },
  {
    name: 'get_vault_markets_dcm_book',
    description: 'The partner exchange live order book for a contract (cached 5 seconds): bids and asks as price (index points) and size (contracts), markPrice, indexPrice, lastPrice, openInterest, volume24h, spreadBps and basisBps (mark over the Crossly index, basis points). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Contract symbol, from get_vault_markets_dcm.' },
      },
      required: ['symbol'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { symbol } = args as { symbol: string };
      return apiGet(`/v1/vault-markets/dcm/contracts/${encodeURIComponent(symbol)}/book`, {});
    },
  },
  {
    name: 'get_vault_markets_dcm_options_inputs',
    description: 'Options inputs for a Crossly index (indexes only, never a single item): realised volatility from weekly returns (volBps, raw and Geltner-desmoothed, basis points a year), the forward (the partner future mark, else the Crossly close), and Black-76 price, delta, gamma, vega (per vol point) and theta (per day) on a strike x expiry grid and for each option the partner lists. Model inputs, not quotes.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Index slug, from list_vault_markets_indexes.' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/vault-markets/dcm/options-inputs/${encodeURIComponent(slug)}`, {});
    },
  },
  {
    name: 'get_vault_markets_dcm_positions',
    description: 'The partner exchange account linked to your account (or to a firm sub-account) and its positions, read-only: symbol, side ("long" or "short"), contracts, entry and mark price (index points), unrealizedPnlCents, marginCents and notionalCents (cents of US dollars), liquidation price. Futures on category indexes count as portfolio-margin hedges for that account. linked is false until you link with link_vault_markets_dcm_account.',
    inputSchema: {
      type: 'object',
      properties: {
        subaccountId: { type: 'string', description: 'Firm sub-account id (uuid) you belong to; omit for your own account.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { subaccountId } = args as { subaccountId?: string };
      return apiGet('/v1/vault-markets/dcm/positions', { subaccountId });
    },
  },
  {
    name: 'link_vault_markets_dcm_account',
    description: 'Link your partner exchange account so Crossly can show its positions. The partner must confirm the one-time code it gave you; the code is never stored. Read-only: Crossly never trades on the account.',
    inputSchema: {
      type: 'object',
      properties: {
        accountRef: { type: 'string', description: 'Your account id at the partner exchange.' },
        code: { type: 'string', description: 'The one-time link code from your account page at the partner exchange.' },
        subaccountId: { type: 'string', description: 'Firm sub-account id (uuid) you manage, to link the partner account to it; omit for your own account.' },
      },
      required: ['accountRef', 'code'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { accountRef, code, subaccountId } = args as { accountRef: string; code: string; subaccountId?: string };
      return apiPost('/v1/vault-markets/dcm/link', { accountRef, code, subaccountId });
    },
  },
  {
    name: 'unlink_vault_markets_dcm_account',
    description: 'Unlink the partner exchange account from your account (or a firm sub-account you manage): Crossly stops reading its positions and its hedges leave portfolio margin.',
    inputSchema: {
      type: 'object',
      properties: {
        subaccountId: { type: 'string', description: 'Firm sub-account id (uuid) you manage; omit for your own account.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { subaccountId } = args as { subaccountId?: string };
      return apiPost('/v1/vault-markets/dcm/unlink', { subaccountId });
    },
  },
];
