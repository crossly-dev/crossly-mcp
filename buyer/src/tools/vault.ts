import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets tools — "what is my vault worth", read only.
 *
 * For an agent holding the person's buyer token. Every tool is a GET: none
 * places an order, takes an Instant Exit, lends or sells. Selling happens on
 * Crossly with the person present; never tell someone you sold or listed
 * anything for them.
 *
 * How to report the numbers honestly:
 *   - Value AT THE MARKS and the SELL-NOW estimate are different answers.
 *     Report them separately; never present the mark value as cash in hand.
 *   - A mark of quality C is indicative (few recent trades): say so. Quality
 *     "none" means no market price; such units count at nothing.
 *   - Money is in cents of US dollars.
 */
export const vaultTools: ToolDef[] = [
  {
    name: 'get_my_vault_worth',
    description:
      "What the person's Crossly vault is worth right now. Returns valueCents (cents of US dollars, at the market prices; " +
      'marks come only from trades on the order book), split into marks.reliableCents (A/B marks) and marks.indicativeCents ' +
      '(C marks, few recent trades) with marks.unmarkedUnits (no price yet, counted at nothing); costCents and pnlCents; ' +
      "today (change against yesterday's close); and sellNow, a SEPARATE estimate of what the units free to sell would fetch " +
      "from the bids resting on the book now, down to each item's Instant Exit floor. Repeat the `note` fields; do not blend " +
      'the two numbers. Read only. Requires buyer:orders:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/vault-markets/worth'),
  },
  {
    name: 'list_my_vault_holdings',
    description:
      'Every unit the person holds in the Crossly vault, each at its market price in cents of US dollars with the mark quality ' +
      '("A" or "B" reliable, "C" indicative, "none" no price), cost, P&L and where it stands (stored, listed, lent, pledged, at ' +
      'the grader). meta.totals sums them; meta.onLoan lists units they lent out. Read only. Requires buyer:orders:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/vault-markets/holdings'),
  },
  {
    name: 'get_my_vault_history',
    description:
      "The person's Vault Markets value by day at the marks (oldest first, today live) in cents of US dollars, and today's " +
      "change against yesterday's close. Read only. Requires buyer:orders:read.",
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 1825, default: 90, description: 'How many days back to chart (1-1825). Default 90.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { days } = args as { days?: number };
      return apiGet('/v1/buyer/vault-markets/history', { days });
    },
  },
  {
    name: 'list_my_vault_watchlist',
    description:
      'The vault items (book keys) the person watches, each with its mark in cents of US dollars and the mark quality, the ' +
      '24 hour and 7 day change in basis points, and the last 30 daily marks. Read only. Requires buyer:orders:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/vault-markets/watchlist'),
  },
  {
    name: 'list_my_instant_exit_quotes',
    description:
      'Instant Exit quotes for everything the person holds in the vault, one per item: the best resting bid in cents of US ' +
      'dollars (their own bids left out), its share of the mark, the bid levels, units held and which unit ids are free to sell, ' +
      'and `reason` when an item cannot be sold instantly (paused, trades in call auctions, no bid, bid under the floor). A ' +
      'quote only: this tool sells nothing and nothing is reserved. Requires buyer:orders:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/vault-markets/instant-exit'),
  },
  {
    name: 'get_my_instant_exit_quote',
    description:
      'The Instant Exit quote for ONE vault unit the person holds: best resting bid in cents of US dollars, share of the mark, ' +
      'and whether it can be sold now (and why not). A quote only; sells nothing. Requires buyer:orders:read.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: { type: 'string', format: 'uuid', description: 'The vault unit id (the `id` from list_my_vault_holdings, or one of `sellableUnitIds`).' },
      },
      required: ['vaultItemId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId } = args as { vaultItemId: string };
      return apiGet(`/v1/buyer/vault-markets/instant-exit/${encodeURIComponent(vaultItemId)}`);
    },
  },
  {
    name: 'list_vault_indexes',
    description:
      "Crossly indexes over vault items (per category, per brand, curated, composite, segment, and the person's own), each with " +
      'its level now (base 1000 at inception) and change since the last daily close in basis points. Valued only from the order ' +
      "book's marks; `value` is null with a `notice` when an index has too few trades to publish. Requires buyer:catalog:read.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['category', 'brand', 'curated', 'custom', 'composite', 'segment'],
          description: 'Only one kind: "category", "brand", "curated", "custom" (their own), "composite" or "segment". Omit for all.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { kind } = args as { kind?: string };
      return apiGet('/v1/buyer/vault-markets/indexes', { kind });
    },
  },
  {
    name: 'get_vault_index',
    description:
      'One Crossly index with its published daily closes (oldest first) and its level now. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The index slug, from list_vault_indexes.' },
        days: { type: 'integer', minimum: 1, maximum: 1825, default: 365, description: 'How many days of closes (1-1825). Default 365.' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, days } = args as { slug: string; days?: number };
      return apiGet(`/v1/buyer/vault-markets/indexes/${encodeURIComponent(slug)}`, { days });
    },
  },
];
