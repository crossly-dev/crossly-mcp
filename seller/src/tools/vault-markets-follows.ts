import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets: collectors to follow (api routes/v1/write/vault-markets-follows.ts).
 * Private by default: every sharing switch is off until the user turns it on
 * and needs their public vault profile. The follow feed names markets, never
 * prices. Leaderboards are opt-in and ranked by risk-adjusted return from the
 * book's A/B marks (percent and risk only, no dollars, no volume).
 * Copy-watch only ALERTS the user to a collector's new resting bids and
 * asks; no tool here places, copies or mirrors an order. Returns, volatility
 * and drawdowns are basis points; prices are cents of US dollars.
 */
const HANDLE = { type: 'string', description: "The collector's Crossly handle, with or without the @." } as const;
const KINDS = {
  type: 'array',
  items: { type: 'string', enum: ['buy', 'deposit', 'sale', 'hall_loan'] },
  description: 'Which posts to include: "buy" = bought on the book, "deposit" = sent a unit in to the vault, "sale" = sold on the book, "hall_loan" = lent a unit to the Hall of Grails. Omit for all.',
} as const;
const BEFORE = { type: 'string', description: 'ISO time: only items before it (pass the last item "at" to page).' } as const;
const FEED_LIMIT = { type: 'integer', minimum: 1, maximum: 50, default: 30, description: 'How many (1-50). Default 30.' } as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;

const kindsQuery = (k: unknown) => (Array.isArray(k) && k.length > 0 ? k.join(',') : undefined);

export const vaultMarketsFollowsTools: ToolDef[] = [
  {
    name: 'get_vault_sharing',
    description: 'The user sharing switches for collectors to follow: public vault profile, new buys, units sent in, sales, Hall loans, bids and asks for copy-watchers, and the leaderboards. Each is off until turned on, with when it went on.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/follows/sharing'),
  },
  {
    name: 'update_vault_sharing',
    description: 'Turn the user sharing switches on or off. A switch shows only what happens after it goes on, and every switch but isPublic needs the public vault profile. Only change what the user asked for.',
    inputSchema: {
      type: 'object',
      properties: {
        isPublic: { type: 'boolean', description: 'true = the public vault profile is on (needs a handle).' },
        showBuys: { type: 'boolean', description: 'true = followers see the markets the user buys (never prices).' },
        deposits: { type: 'boolean', description: 'true = followers see units the user sends in to the vault (never values).' },
        sales: { type: 'boolean', description: 'true = followers see the markets the user sells on the book (never prices).' },
        hallLoans: { type: 'boolean', description: 'true = followers see units the user lends to the Hall of Grails under their name.' },
        orders: { type: 'boolean', description: 'true = copy-watchers get alerts of the user new resting bids and asks, WITH the limit price.' },
        leaderboard: { type: 'boolean', description: 'true = the user appears on the return leaderboards (percent and risk only); false also removes them at once.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/vault-markets/follows/sharing', args),
  },
  {
    name: 'list_vault_following',
    description: 'The collectors the user follows who have a public vault: what each shares and whether the user copy-watches them.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/follows/following'),
  },
  {
    name: 'get_vault_follow_feed',
    description: 'Public vault activity of the collectors the user follows (buys, units sent in, sales, Hall loans), newest first, with each market mark and a link to buy that market normally. Never a price of their activity.',
    inputSchema: { type: 'object', properties: { kinds: KINDS, before: BEFORE, limit: FEED_LIMIT }, additionalProperties: false },
    handler: (args) => {
      const { kinds, before, limit } = args as { kinds?: string[]; before?: string; limit?: number };
      return apiGet('/v1/vault-markets/follows/feed', { kinds: kindsQuery(kinds), before, limit });
    },
  },
  {
    name: 'get_vault_collector_activity',
    description: 'One collector public vault activity, newest first. Not found when their vault is not public.',
    inputSchema: { type: 'object', properties: { handle: HANDLE, kinds: KINDS, before: BEFORE, limit: FEED_LIMIT }, required: ['handle'], additionalProperties: false },
    handler: (args) => {
      const { handle, kinds, before, limit } = args as { handle: string; kinds?: string[]; before?: string; limit?: number };
      return apiGet(`/v1/vault-markets/follows/profiles/${encodeURIComponent(handle)}/activity`, { kinds: kindsQuery(kinds), before, limit });
    },
  },
  {
    name: 'get_vault_leaderboard',
    description: 'An opt-in return leaderboard ranked by risk-adjusted return (annualised return over annualised volatility, floored) from the order book A/B marks, with return, volatility and worst drawdown in basis points, the categories with boards, and where the user stands. No dollars, no volume, no prizes.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['30d', '90d', '365d'], description: '"30d" = last 30 days, "90d" = last 90 days, "365d" = last year. Default "90d".' },
        category: { type: 'string', description: 'A catalogue category slug (lowercase letters, digits, dashes) from the board categories, or "all". Default "all".' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { period, category } = args as { period?: string; category?: string };
      return apiGet('/v1/vault-markets/follows/leaderboards', { period, category });
    },
  },
  {
    name: 'list_vault_copy_watches',
    description: 'The collectors the user copy-watches and whether each still shares bids and asks.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/follows/copy-watch'),
  },
  {
    name: 'start_vault_copy_watch',
    description: 'Copy-watch a collector who shares bids and asks: the user gets an alert when they rest a new one. It only alerts; it never places an order for the user.',
    inputSchema: { type: 'object', properties: { handle: HANDLE }, required: ['handle'], additionalProperties: false },
    handler: (args) => {
      const { handle } = args as { handle: string };
      return apiPut(`/v1/vault-markets/follows/copy-watch/${encodeURIComponent(handle)}`, {});
    },
  },
  {
    name: 'stop_vault_copy_watch',
    description: 'Stop copy-watching a collector.',
    inputSchema: { type: 'object', properties: { handle: HANDLE }, required: ['handle'], additionalProperties: false },
    handler: (args) => {
      const { handle } = args as { handle: string };
      return apiDelete(`/v1/vault-markets/follows/copy-watch/${encodeURIComponent(handle)}`);
    },
  },
  {
    name: 'list_vault_copy_watch_alerts',
    description: 'The user copy-watch alerts, newest first: who, bid or ask, quantity, limit price in cents of US dollars, market, and whether the order still rests. Acting on one is a normal order the user places themselves.',
    inputSchema: {
      type: 'object',
      properties: {
        before: BEFORE,
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50, description: 'How many (1-100). Default 50.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { before, limit } = args as { before?: string; limit?: number };
      return apiGet('/v1/vault-markets/follows/copy-watch/alerts', { before, limit });
    },
  },
  {
    name: 'mark_vault_copy_watch_alerts_read',
    description: 'Mark every copy-watch alert read.',
    inputSchema: NONE,
    handler: () => apiPost('/v1/vault-markets/follows/copy-watch/alerts/read', {}),
  },
];
