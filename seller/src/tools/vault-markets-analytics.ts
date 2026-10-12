import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets analytics (api routes/v1/write/vault-markets-analytics.ts):
 * indexes over book keys valued only from the order book's marks (base 1000
 * at inception), buying an index's basket as whole units, a watchlist,
 * compare, portfolio value by day, the grading arbitrage signal and vault
 * supply by day. An index is addressed by its slug (from
 * list_vault_markets_indexes). Moves are basis points (100 = 1%).
 */
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const SLUG = { type: 'string', description: 'The index slug (lowercase letters, digits and dashes) from list_vault_markets_indexes.' } as const;
const DAYS = (dflt: number, min = 1) => ({ type: 'integer', minimum: min, maximum: 1825, default: dflt, description: `How many days back (${min}-1825). Default ${dflt}.` }) as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;
const KEY_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false };
const SLUG_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { slug: SLUG }, required: ['slug'], additionalProperties: false };
const WEIGHTING = { type: 'string', enum: ['mark', 'equal'], description: '"mark" = each key weighted by its market price (the default on create); "equal" = every key weighted alike.' } as const;
const INDEX_PROPS = {
  name: { type: 'string', description: 'Index name (1-80 characters).' },
  description: { type: ['string', 'null'], description: 'Optional description (up to 280 characters); null clears it.' },
  weighting: WEIGHTING,
  isPublic: { type: 'boolean', description: 'true = others can see and follow it; false = only you (the default on create).' },
  keys: { type: 'array', items: BOOK_KEY, minItems: 1, maxItems: 50, description: 'The book keys in the index, 1 to 50.' },
} as const;

export const vaultMarketsAnalyticsTools: ToolDef[] = [
  {
    name: 'list_vault_markets_indexes',
    description: 'Indexes over book keys: per category, per top brand, the Crossly 50 and your own. Each with its level now (base 1000 at inception) and change since the last daily close.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['category', 'brand', 'curated', 'custom', 'composite', 'segment'],
          description: 'Optional filter: "category" = one per category; "brand" = one per top brand; "curated" = Crossly-picked such as the Crossly 50; "custom" = your own indexes.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { kind } = args as { kind?: string };
      return apiGet('/v1/vault-markets/indexes', { kind });
    },
  },
  {
    name: 'list_vault_markets_index_movers',
    description: 'The built-in indexes that moved most since their last daily close.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'How many indexes (1-50). Default 10.' } }, additionalProperties: false },
    handler: (args) => {
      const { limit } = args as { limit?: number };
      return apiGet('/v1/vault-markets/indexes/movers', { limit });
    },
  },
  {
    name: 'get_vault_markets_index',
    description: 'One index with its daily closes (oldest first) and its level now.',
    inputSchema: { type: 'object', properties: { slug: SLUG, days: DAYS(365) }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, days } = args as { slug: string; days?: number };
      return apiGet(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}`, { days });
    },
  },
  {
    name: 'list_vault_markets_index_constituents',
    description: "The book keys in an index with their weight, move since the last close and contribution to the index's move (basis points).",
    inputSchema: SLUG_ONLY,
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}/constituents`, {});
    },
  },
  {
    name: 'create_vault_markets_index',
    description: 'Make an index of your own: 1 to 50 book keys, weighted by mark or equally. Up to 10 per account. Returns the index with its slug.',
    inputSchema: { type: 'object', properties: INDEX_PROPS, required: ['name', 'keys'], additionalProperties: false },
    handler: (args) => {
      const { name, description, weighting, isPublic, keys } = args as { name: string; description?: string | null; weighting?: string; isPublic?: boolean; keys: string[] };
      return apiPost('/v1/vault-markets/indexes', { name, description, weighting, isPublic, keys });
    },
  },
  {
    name: 'update_vault_markets_index',
    description: 'Rename, re-weight, share or change the keys of an index of your own; its level carries on. Change at least one thing.',
    inputSchema: { type: 'object', properties: { slug: SLUG, ...INDEX_PROPS }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, name, description, weighting, isPublic, keys } = args as { slug: string; name?: string; description?: string | null; weighting?: string; isPublic?: boolean; keys?: string[] };
      return apiPatch(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}`, { name, description, weighting, isPublic, keys });
    },
  },
  {
    name: 'delete_vault_markets_index',
    description: 'Delete an index of your own. Returns { ok }.',
    inputSchema: SLUG_ONLY,
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiDelete(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}`);
    },
  },
  {
    name: 'buy_vault_markets_index_basket',
    description: "Buy an index's basket: one limit buy per key for 1-5 whole units each, at most maxBpsOverMark over each key's mark. Every unit is a real item that lands in your vault. Idempotent on clientBasketId; returns a result per key.",
    inputSchema: {
      type: 'object',
      properties: {
        slug: SLUG,
        unitsPerKey: { type: 'integer', minimum: 1, maximum: 5, default: 1, description: 'Whole units of each key to buy (1-5). Default 1.' },
        maxBpsOverMark: { type: 'integer', minimum: 0, maximum: 2000, default: 200, description: "Pay at most this many basis points over each key's mark (market price); 200 = 2% (the default), up to 2000 = 20%." },
        tif: { type: 'string', enum: ['ioc', 'gtc'], default: 'ioc', description: '"ioc" = buy what is offered now and cancel the rest (the default); "gtc" = leave unfilled buys resting until cancelled.' },
        funding: { type: 'string', enum: ['card', 'custodian'], description: 'How the buys are paid: "card" = a saved card (give stripePaymentMethodId); "custodian" = cash in your custodian account.' },
        stripePaymentMethodId: { type: 'string', description: 'The saved card (Stripe payment method id, "pm_...") that pays for a card-funded basket.' },
        clientBasketId: { type: 'string', description: 'Optional id of your own (letters, digits, _ and -; up to 40): buying again with it returns the first result instead of buying twice.' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, unitsPerKey, maxBpsOverMark, tif, funding, stripePaymentMethodId, clientBasketId } = args as {
        slug: string; unitsPerKey?: number; maxBpsOverMark?: number; tif?: string; funding?: string; stripePaymentMethodId?: string; clientBasketId?: string;
      };
      return apiPost(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}/buy`, { unitsPerKey, maxBpsOverMark, tif, funding, stripePaymentMethodId, clientBasketId });
    },
  },
  {
    name: 'list_vault_markets_watchlist',
    description: 'Your watched book keys with mark (in cents), 24 h and 7 d change, and the last 30 daily marks (sparkline).',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/watchlist', {}),
  },
  {
    name: 'watch_vault_markets_key',
    description: 'Add a book key to your watchlist. Returns { bookKey, watching }.',
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiPost('/v1/vault-markets/watchlist', { bookKey });
    },
  },
  {
    name: 'unwatch_vault_markets_key',
    description: 'Remove a book key from your watchlist. Returns { bookKey, watching }.',
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiDelete('/v1/vault-markets/watchlist', undefined, { bookKey });
    },
  },
  {
    name: 'compare_vault_markets',
    description: 'Up to 5 book keys and/or index slugs as daily series on the same days, each rebased to 100.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, description: 'Book keys (variantId:condition:gradeKey) and/or index slugs to compare, 1 to 5.' },
        days: DAYS(90, 2),
      },
      required: ['items'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { items, days } = args as { items: string[]; days?: number };
      return apiGet('/v1/vault-markets/compare', { items: items.join(','), days });
    },
  },
  {
    name: 'get_vault_markets_portfolio_history',
    description: "Your Vault Markets value by day at the marks (vault units, units on loan, positions; in cents) and today's return against yesterday's close.",
    inputSchema: { type: 'object', properties: { days: DAYS(90) }, additionalProperties: false },
    handler: (args) => {
      const { days } = args as { days?: number };
      return apiGet('/v1/vault-markets/portfolio/history', { days });
    },
  },
  {
    name: 'get_vault_markets_grading_signal',
    description: "For a raw (ungraded) book key: the marks of the same item's graded keys, the spread over raw, grading cost per grader (in cents), the margin tier grading lifts it to, your raw vault units it pays to grade, and where to act.",
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/grading-signal', { bookKey });
    },
  },
  {
    name: 'get_vault_markets_supply',
    description: "A book key's units in the vault and authentications passed, by day (oldest first, today live).",
    inputSchema: { type: 'object', properties: { bookKey: BOOK_KEY, days: DAYS(180) }, required: ['bookKey'], additionalProperties: false },
    handler: (args) => {
      const { bookKey, days } = args as { bookKey: string; days?: number };
      return apiGet('/v1/vault-markets/supply', { bookKey, days });
    },
  },
];
