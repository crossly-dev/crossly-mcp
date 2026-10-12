import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets pro (api routes/v1/write/vault-markets-pro.ts): the order book
 * on vault items. Orders of every type and time in force, the order event log
 * (a drop copy you can replay), two-sided market-maker quotes kept alive by
 * heartbeat, and market data. Reads need vault-markets:read, placing and
 * cancelling vault-markets:trade. A pre-trade refusal is a 400 whose
 * error.details.code is "order_rejected" (the message says why); a halted key
 * answers 409 with error.details.code "halted".
 *
 * The live market stream is not a tool: a tool returns once and the stream
 * stays open. get_vault_markets_pro_snapshot is its first event, on demand.
 */
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const OPT_BOOK_KEY = { type: 'string', description: 'Optional book key (variantId:condition:gradeKey) to limit this to one market; leave it out for every market.' } as const;
const CENTS = (what: string) => ({ type: 'integer', minimum: 100, maximum: 100_000_000, description: `${what}, in cents of US dollars (the currency), a whole number.` }) as const;
const QTY = (what: string) => ({ type: 'integer', minimum: 1, maximum: 50, description: `${what}, in units (1-50).` }) as const;
const FUNDING = {
  type: 'string',
  enum: ['card', 'custodian'],
  description: 'How a buy is paid: "card" = a saved card (give stripePaymentMethodId); "custodian" = cash in your custodian account. Ignored for sells.',
} as const;
const CARD = { type: 'string', description: 'The saved card (Stripe payment method id, "pm_...") that pays for a card-funded buy.' } as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;
const KEY_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false };
const QUOTE_SIDE = (side: string) => ({
  type: 'object',
  description: `Optional ${side} side of the quote.`,
  properties: { priceCents: CENTS(`The ${side} price`), quantity: QTY(`Units on the ${side}`) },
  required: ['priceCents', 'quantity'],
  additionalProperties: false,
}) as const;

export const vaultMarketsProTools: ToolDef[] = [
  {
    name: 'get_vault_markets_pro_snapshot',
    description: "A book key's depth (20 price levels a side), last 50 trades, 24 h stats, mark (market price, in cents) and any trading halt, in one call.",
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/pro/snapshot', { bookKey });
    },
  },
  {
    name: 'get_vault_markets_pro_depth',
    description: 'The depth ladder of a book key: price levels (in cents) and units per side, best first, with the spread. Asks show how many units are authenticated vault stock (instant settlement).',
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/pro/depth', { bookKey });
    },
  },
  {
    name: 'list_vault_markets_pro_trades',
    description: 'The tape: the latest trades on a book key, newest first, with price in cents and which side made and which took.',
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/pro/tape', { bookKey });
    },
  },
  {
    name: 'get_vault_markets_pro_stats',
    description: 'The last 24 h on a book key: open, high, low and last price, notional (all in cents), volume in units and change in basis points.',
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/pro/stats', { bookKey });
    },
  },
  {
    name: 'get_vault_markets_pro_candles',
    description: 'Price candles from the trades on a book key: each has t (start, epoch ms), o/h/l/c (open, high, low, close, in cents) and v (units traded).',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        interval: {
          type: 'string',
          enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
          default: '1h',
          description: 'Candle width: "1m" = 1 minute, "5m" = 5 minutes, "15m" = 15 minutes, "1h" = 1 hour (the default), "4h" = 4 hours, "1d" = 1 day.',
        },
        from: { type: 'integer', minimum: 0, description: 'Optional start time, epoch milliseconds. Default: the last 300 intervals.' },
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, interval, from } = args as { bookKey: string; interval?: string; from?: number };
      return apiGet('/v1/vault-markets/pro/candles', { bookKey, interval, from });
    },
  },
  {
    name: 'place_vault_markets_pro_order',
    description: 'Place an order on a vault book key. Buys settle instantly from vault stock; sells use your own vault units of that key. Idempotent on clientOrderId. Returns the order (status pending_trigger, working, partially_filled, filled, cancelled, expired or rejected).',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        side: { type: 'string', enum: ['buy', 'sell'], description: '"buy" = buy units into your vault; "sell" = sell units you hold in the vault.' },
        type: {
          type: 'string',
          enum: ['limit', 'market', 'stop', 'stop_limit'],
          default: 'limit',
          description: 'Order type: "limit" = at limitCents or better (the default); "market" = at the best price now, price-protected and never rests (immediate-or-cancel); "stop" = becomes a market order once the price reaches stopCents; "stop_limit" = becomes a limit order at limitCents once the price reaches stopCents.',
        },
        tif: {
          type: 'string',
          enum: ['gtc', 'gtd', 'ioc', 'fok'],
          default: 'gtc',
          description: 'Time in force: "gtc" = good till cancelled (the default); "gtd" = good till expiresAt; "ioc" = immediate or cancel, fill what you can now and cancel the rest; "fok" = fill or kill, the whole quantity now or nothing.',
        },
        quantity: QTY('How many units'),
        limitCents: CENTS('Limit price (needed for limit and stop_limit)'),
        stopCents: CENTS('Trigger price (needed for stop and stop_limit)'),
        postOnly: { type: 'boolean', description: 'true = only rest on the book as a maker; the order is refused if it would trade at once.' },
        displayQuantity: QTY('Iceberg: units shown on the book at a time, the rest hidden'),
        expiresAt: { type: 'string', description: 'When a "gtd" order expires, as an ISO 8601 time.' },
        algo: {
          type: 'string',
          enum: ['twap', 'vwap'],
          description: 'Optional: work the order over a window instead of at once. "twap" = evenly over time; "vwap" = following the usual trading volume by hour of day. Set algoEndsAt too.',
        },
        algoEndsAt: { type: 'string', description: 'When the algo window ends, as an ISO 8601 time.' },
        funding: FUNDING,
        stripePaymentMethodId: CARD,
        clientOrderId: { type: 'string', description: 'Optional id of your own (1-64 characters); placing again with it returns the first order instead of a second one.' },
        subaccountId: { type: 'string', description: 'Optional firm sub-account id (uuid) from list_vault_markets_accounts to trade for; your role, the entity verification, the sub-account limits and any firm halt are checked, and a buy pays from that sub-account custodian account and lands in it. Leave out to trade for your own account.' },
      },
      required: ['bookKey', 'side', 'quantity'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, side, type, tif, quantity, limitCents, stopCents, postOnly, displayQuantity, expiresAt, algo, algoEndsAt, funding, stripePaymentMethodId, clientOrderId, subaccountId } = args as {
        bookKey: string; side: string; type?: string; tif?: string; quantity: number; limitCents?: number; stopCents?: number; postOnly?: boolean; displayQuantity?: number;
        expiresAt?: string; algo?: string; algoEndsAt?: string; funding?: string; stripePaymentMethodId?: string; clientOrderId?: string; subaccountId?: string;
      };
      return apiPost('/v1/vault-markets/pro/orders', { bookKey, side, type, tif, quantity, limitCents, stopCents, postOnly, displayQuantity, expiresAt, algo, algoEndsAt, funding, stripePaymentMethodId, clientOrderId, subaccountId });
    },
  },
  {
    name: 'list_vault_markets_pro_orders',
    description: 'Your pro-market orders, newest first, with fills and average fill price in cents.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'done'],
          default: 'open',
          description: '"open" = waiting for a trigger, working or partly filled (the default); "done" = filled, cancelled, expired or rejected.',
        },
        bookKey: OPT_BOOK_KEY,
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'How many orders to return (1-500). Default 100.' },
        subaccountId: { type: 'string', description: 'Optional firm sub-account id (uuid): only orders booked to it. Leave out for all of yours.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { status, bookKey, limit, subaccountId } = args as { status?: string; bookKey?: string; limit?: number; subaccountId?: string };
      return apiGet('/v1/vault-markets/pro/orders', { status, bookKey, limit, subaccountId });
    },
  },
  {
    name: 'get_vault_markets_pro_order',
    description: 'One pro-market order with its full event log (new, leg, fill, replaced, cancelled, expired, done).',
    inputSchema: { type: 'object', properties: { id: ID('Order') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/pro/orders/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'cancel_vault_markets_pro_order',
    description: 'Cancel a pro-market order; whatever already filled stays filled. Returns the order.',
    inputSchema: { type: 'object', properties: { id: ID('Order') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/pro/orders/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'replace_vault_markets_pro_order',
    description: "Amend an open order's price, stop or quantity (cancel-replace: it re-queues at its new price). Give at least one. Returns the order.",
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('Order'),
        limitCents: CENTS('New limit price'),
        stopCents: CENTS('New trigger price'),
        quantity: QTY('New total quantity'),
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, limitCents, stopCents, quantity } = args as { id: string; limitCents?: number; stopCents?: number; quantity?: number };
      return apiPost(`/v1/vault-markets/pro/orders/${encodeURIComponent(id)}/replace`, { limitCents, stopCents, quantity });
    },
  },
  {
    name: 'cancel_all_vault_markets_pro_orders',
    description: 'Cancel every open pro-market order, or every one on a book key. Returns { cancelled } (how many).',
    inputSchema: { type: 'object', properties: { bookKey: OPT_BOOK_KEY }, additionalProperties: false },
    handler: (args) => {
      const { bookKey } = args as { bookKey?: string };
      return apiPost('/v1/vault-markets/pro/orders/cancel-all', bookKey ? { bookKey } : {});
    },
  },
  {
    name: 'list_vault_markets_pro_order_events',
    description: 'Your order event log after a sequence number (new, leg, fill, replaced, cancelled, expired, done): a drop copy you can replay. Pass the last seq you saw as after.',
    inputSchema: {
      type: 'object',
      properties: {
        after: { type: 'integer', minimum: 0, default: 0, description: 'Return events with a sequence number above this. Default 0 (from the start).' },
        limit: { type: 'integer', minimum: 1, maximum: 1000, default: 500, description: 'How many events to return (1-1000). Default 500.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { after, limit } = args as { after?: number; limit?: number };
      return apiGet('/v1/vault-markets/pro/events', { after, limit });
    },
  },
  {
    name: 'set_vault_markets_pro_quote',
    description: 'Market makers: set a two-sided post-only quote on a book key, replacing your last one there. With cancelOnDisconnect (the default) call heartbeat_vault_markets_pro_quotes at least every 30 s or the quote is pulled. Returns { bookKey, bid: { orderId, error }, ask: { orderId, error } }.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        bid: QUOTE_SIDE('bid (buy)'),
        ask: QUOTE_SIDE('ask (sell)'),
        cancelOnDisconnect: { type: 'boolean', default: true, description: 'true (the default) = pull the quote when heartbeats stop for 30 s; false = leave it until you pull it.' },
        funding: FUNDING,
        stripePaymentMethodId: CARD,
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, bid, ask, cancelOnDisconnect, funding, stripePaymentMethodId } = args as {
        bookKey: string; bid?: { priceCents: number; quantity: number }; ask?: { priceCents: number; quantity: number };
        cancelOnDisconnect?: boolean; funding?: string; stripePaymentMethodId?: string;
      };
      return apiPost('/v1/vault-markets/pro/quotes', { bookKey, bid, ask, cancelOnDisconnect, funding, stripePaymentMethodId });
    },
  },
  {
    name: 'list_vault_markets_pro_quotes',
    description: 'Your live market-maker quotes.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/pro/quotes', {}),
  },
  {
    name: 'pull_vault_markets_pro_quotes',
    description: 'Pull your quote on a book key, or every quote you have. Returns { pulled } (how many).',
    inputSchema: { type: 'object', properties: { bookKey: OPT_BOOK_KEY }, additionalProperties: false },
    handler: (args) => {
      const { bookKey } = args as { bookKey?: string };
      return apiDelete('/v1/vault-markets/pro/quotes', undefined, bookKey ? { bookKey } : undefined);
    },
  },
  {
    name: 'heartbeat_vault_markets_pro_quotes',
    description: 'Keep your cancel-on-disconnect quotes alive; call at least every 30 s. Returns { quotes, at }.',
    inputSchema: NONE,
    handler: () => apiPost('/v1/vault-markets/pro/quotes/heartbeat', {}),
  },
  {
    name: 'list_vault_markets_pro_rewards',
    description: 'Your daily market-maker liquidity rewards, paid in CBX.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/pro/rewards', {}),
  },
];
