import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets liquidity (api routes/v1/write/vault-markets-liquidity.ts):
 * Instant Exit (sell a vault unit now into the best bid), the offers inbox on
 * what you hold, recurring whole-unit buys, linked orders (brackets, OCO
 * pairs, trailing stops, position take-profit / stop-loss), liquidation
 * prices, borrow-rate history and the dealer program (standing bids and
 * Instant Exit bands). Reads need vault-markets:read, anything that places or
 * cancels vault-markets:trade. Dealer approval is ops-only and not a tool.
 */
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const CENTS = (what: string) => ({ type: 'integer', minimum: 100, maximum: 100_000_000, description: `${what}, in cents of US dollars (the currency), a whole number.` }) as const;
const NULL_CENTS = (what: string) => ({ type: ['integer', 'null'], minimum: 100, maximum: 100_000_000, description: `${what}, in cents of US dollars (the currency), a whole number; null clears it.` }) as const;
const QTY = (what: string) => ({ type: 'integer', minimum: 1, maximum: 50, description: `${what}, in units (1-50).` }) as const;
const FUNDING = {
  type: 'string',
  enum: ['card', 'custodian'],
  description: 'How a buy is paid: "card" = a saved card (give stripePaymentMethodId); "custodian" = cash in your custodian account. Ignored for sells.',
} as const;
const CARD = { type: 'string', description: 'The saved card (Stripe payment method id, "pm_...") that pays for a card-funded buy.' } as const;
const CLIENT_ID = { type: 'string', description: 'Optional id of your own (1-64 characters); placing again with it returns the first order instead of a second one.' } as const;
const SIDE = { type: 'string', enum: ['buy', 'sell'], description: '"buy" = buy units into your vault; "sell" = sell units you hold in the vault.' } as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;
const KEY_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false };
const ID_ONLY = (what: string): ToolDef['inputSchema'] => ({ type: 'object', properties: { id: ID(what) }, required: ['id'], additionalProperties: false });
const LIMIT = { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'How many runs to return (1-500). Default 100.' } as const;

/** One pro order, as place_vault_markets_pro_order takes it (used by brackets and OCO). */
const ORDER_PROPS = {
  bookKey: BOOK_KEY,
  side: SIDE,
  type: {
    type: 'string',
    enum: ['limit', 'market', 'stop', 'stop_limit'],
    default: 'limit',
    description: 'Order type: "limit" = at limitCents or better (the default); "market" = at the best price now, price-protected, never rests; "stop" = becomes a market order once the price reaches stopCents; "stop_limit" = becomes a limit order at limitCents once the price reaches stopCents.',
  },
  tif: {
    type: 'string',
    enum: ['gtc', 'gtd', 'ioc', 'fok'],
    default: 'gtc',
    description: 'Time in force: "gtc" = good till cancelled (the default); "gtd" = good till expiresAt; "ioc" = immediate or cancel (fill what you can now, cancel the rest); "fok" = fill or kill (the whole quantity now or nothing).',
  },
  quantity: QTY('How many units'),
  limitCents: CENTS('Limit price (needed for limit and stop_limit)'),
  stopCents: CENTS('Trigger price (needed for stop and stop_limit)'),
  postOnly: { type: 'boolean', description: 'true = only rest on the book as a maker; refused if it would trade at once.' },
  displayQuantity: QTY('Iceberg: units shown on the book at a time'),
  expiresAt: { type: 'string', description: 'When a "gtd" order expires, as an ISO 8601 time.' },
  funding: FUNDING,
  stripePaymentMethodId: CARD,
  clientOrderId: CLIENT_ID,
} as const;
const ORDER = (what: string) => ({ type: 'object', description: what, properties: ORDER_PROPS, required: ['bookKey', 'side', 'quantity'], additionalProperties: false }) as const;
type OrderArgs = Record<string, unknown>;

const RECURRING_PROPS = {
  maxPriceCents: NULL_CENTS('The most to pay per unit'),
  capBpsOverMark: { type: ['integer', 'null'], minimum: 0, maximum: 5000, description: 'The most to pay as basis points over the mark (market price); 100 = 1%. null clears it.' },
  funding: FUNDING,
  stripePaymentMethodId: { type: ['string', 'null'], description: 'The saved card (Stripe payment method id, "pm_...") that pays each run when funding is "card".' },
  backupPaymentMethodId: { type: ['string', 'null'], description: 'A second saved card ("pm_...") tried when the first is declined.' },
  autoLend: { type: 'boolean', description: 'true = turn lending on for every unit bought.' },
} as const;
const EVERY = { type: 'string', enum: ['weekly', 'biweekly', 'monthly'], description: '"weekly" = every 7 days; "biweekly" = every 14 days; "monthly" = the same day each month.' } as const;

export const vaultMarketsLiquidityTools: ToolDef[] = [
  {
    name: 'get_vault_markets_instant_exit_quote',
    description: "The Instant Exit quote for one vault unit you hold: the best resting bid on its book key (dealers' included), its share of the mark, the bid depth, and whether it can be taken now. Prices in cents.",
    inputSchema: { type: 'object', properties: { vaultItemId: ID('Vault unit') }, required: ['vaultItemId'], additionalProperties: false },
    handler: (args) => {
      const { vaultItemId } = args as { vaultItemId: string };
      return apiGet('/v1/vault-markets/instant-exit', { vaultItemId });
    },
  },
  {
    name: 'list_vault_markets_instant_exit_holdings',
    description: 'Instant Exit quotes for everything you hold in the vault, one per book key, with units held and which are free to sell.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/instant-exit/holdings', {}),
  },
  {
    name: 'instant_exit_vault_markets_unit',
    description: 'Sell a vault unit now at the quoted price: a sell immediate-or-cancel order through the pro market. Refused, with the new quote, if the best bid fell below priceCents. Crossly never buys or funds it.',
    inputSchema: {
      type: 'object',
      properties: { vaultItemId: ID('Vault unit to sell'), priceCents: CENTS('The quoted price from get_vault_markets_instant_exit_quote'), clientOrderId: CLIENT_ID },
      required: ['vaultItemId', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, priceCents, clientOrderId } = args as { vaultItemId: string; priceCents: number; clientOrderId?: string };
      return apiPost('/v1/vault-markets/instant-exit', { vaultItemId, priceCents, clientOrderId });
    },
  },
  {
    name: 'list_vault_markets_instant_exit_history',
    description: 'Your Instant Exits, newest first: quoted price, mark (in cents) and whether it filled.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/instant-exit/history', {}),
  },
  {
    name: 'list_vault_markets_offers',
    description: 'The offers inbox: for each book key you hold, the best bid from someone else (in cents), units at it, the top bid levels, the mark and your alert.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/offers', {}),
  },
  {
    name: 'set_vault_markets_offer_alert',
    description: 'Set (or clear with null) the bid price that should always notify you on a book key you hold, and mute or unmute offer notices on it.',
    inputSchema: {
      type: 'object',
      properties: { bookKey: BOOK_KEY, alertCents: NULL_CENTS('Notify me of any bid at or above this'), muted: { type: 'boolean', description: 'true = mute offer notices on this key; false = unmute.' } },
      required: ['bookKey', 'alertCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, alertCents, muted } = args as { bookKey: string; alertCents: number | null; muted?: boolean };
      return apiPut('/v1/vault-markets/offers/alert', { bookKey, alertCents, muted });
    },
  },
  {
    name: 'list_vault_markets_recurring_buys',
    description: 'Your recurring buys: book key, schedule, price cap (in cents and/or basis points over the mark), payment, auto-lend and next run.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/recurring', {}),
  },
  {
    name: 'create_vault_markets_recurring_buy',
    description: 'Start a recurring buy: one whole unit of a book key every week, two weeks or month, at no more than maxPriceCents and/or the mark plus capBpsOverMark (set at least one). Paid by card (with an optional backup) or custodian cash.',
    inputSchema: {
      type: 'object',
      properties: { bookKey: BOOK_KEY, every: EVERY, ...RECURRING_PROPS, startAt: { type: 'string', description: 'Optional time of the first run, ISO 8601. Default: now.' } },
      required: ['bookKey', 'every'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, every, maxPriceCents, capBpsOverMark, funding, stripePaymentMethodId, backupPaymentMethodId, autoLend, startAt } = args as {
        bookKey: string; every: string; maxPriceCents?: number | null; capBpsOverMark?: number | null; funding?: string;
        stripePaymentMethodId?: string | null; backupPaymentMethodId?: string | null; autoLend?: boolean; startAt?: string;
      };
      return apiPost('/v1/vault-markets/recurring', { bookKey, every, maxPriceCents, capBpsOverMark, funding, stripePaymentMethodId, backupPaymentMethodId, autoLend, startAt });
    },
  },
  {
    name: 'update_vault_markets_recurring_buy',
    description: "Change a recurring buy's schedule, caps, cards or auto-lend, or pause (active false) / resume (active true) it.",
    inputSchema: {
      type: 'object',
      properties: { id: ID('Recurring buy'), every: EVERY, ...RECURRING_PROPS, active: { type: 'boolean', description: 'false = pause; true = resume.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, every, maxPriceCents, capBpsOverMark, funding, stripePaymentMethodId, backupPaymentMethodId, autoLend, active } = args as {
        id: string; every?: string; maxPriceCents?: number | null; capBpsOverMark?: number | null; funding?: string;
        stripePaymentMethodId?: string | null; backupPaymentMethodId?: string | null; autoLend?: boolean; active?: boolean;
      };
      return apiPatch(`/v1/vault-markets/recurring/${encodeURIComponent(id)}`, { every, maxPriceCents, capBpsOverMark, funding, stripePaymentMethodId, backupPaymentMethodId, autoLend, active });
    },
  },
  {
    name: 'cancel_vault_markets_recurring_buy',
    description: 'Stop a recurring buy for good; its history stays.',
    inputSchema: ID_ONLY('Recurring buy'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/vault-markets/recurring/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'list_vault_markets_recurring_runs',
    description: "One recurring buy's runs: filled, skipped (with the reason, e.g. the price was over the cap) or failed.",
    inputSchema: { type: 'object', properties: { id: ID('Recurring buy'), limit: LIMIT }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id, limit } = args as { id: string; limit?: number };
      return apiGet(`/v1/vault-markets/recurring/${encodeURIComponent(id)}/runs`, { limit });
    },
  },
  {
    name: 'list_all_vault_markets_recurring_runs',
    description: 'Every run of all your recurring buys, newest first.',
    inputSchema: { type: 'object', properties: { limit: LIMIT }, additionalProperties: false },
    handler: (args) => {
      const { limit } = args as { limit?: number };
      return apiGet('/v1/vault-markets/recurring-runs', { limit });
    },
  },
  {
    name: 'place_vault_markets_bracket_order',
    description: 'Place an order with a take-profit and/or stop-loss attached (set at least one). The exits arm as a one-cancels-the-other pair for whatever the entry fills. Returns the link and its orders.',
    inputSchema: {
      type: 'object',
      properties: { ...ORDER_PROPS, takeProfitCents: CENTS('Take-profit: close at this price'), stopLossCents: CENTS('Stop-loss: close once the price reaches this') },
      required: ['bookKey', 'side', 'quantity'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, side, type, tif, quantity, limitCents, stopCents, postOnly, displayQuantity, expiresAt, funding, stripePaymentMethodId, clientOrderId, takeProfitCents, stopLossCents } = args as {
        bookKey: string; side: string; type?: string; tif?: string; quantity: number; limitCents?: number; stopCents?: number; postOnly?: boolean; displayQuantity?: number;
        expiresAt?: string; funding?: string; stripePaymentMethodId?: string; clientOrderId?: string; takeProfitCents?: number; stopLossCents?: number;
      };
      return apiPost('/v1/vault-markets/pro/brackets', { bookKey, side, type, tif, quantity, limitCents, stopCents, postOnly, displayQuantity, expiresAt, funding, stripePaymentMethodId, clientOrderId, takeProfitCents, stopLossCents });
    },
  },
  {
    name: 'place_vault_markets_oco_orders',
    description: 'Place two orders on one book key, one cancels the other: when one fills or its stop triggers, the other is cancelled (a partial fill shrinks it).',
    inputSchema: { type: 'object', properties: { a: ORDER('The first order.'), b: ORDER('The second order.') }, required: ['a', 'b'], additionalProperties: false },
    handler: (args) => {
      const { a, b } = args as { a: OrderArgs; b: OrderArgs };
      return apiPost('/v1/vault-markets/pro/oco', { a, b });
    },
  },
  {
    name: 'place_vault_markets_trailing_stop',
    description: 'Place a trailing stop: its stop follows the best price since it was placed, trailBps or trailCents behind (under the high for a sell, over the low for a buy). Set exactly one of trailBps and trailCents.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        side: SIDE,
        quantity: QTY('How many units'),
        trailBps: { type: 'integer', minimum: 10, maximum: 5000, description: 'Trail distance in basis points of the price (100 = 1%).' },
        trailCents: CENTS('Trail distance'),
        funding: FUNDING,
        stripePaymentMethodId: CARD,
        clientOrderId: CLIENT_ID,
      },
      required: ['bookKey', 'side', 'quantity'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, side, quantity, trailBps, trailCents, funding, stripePaymentMethodId, clientOrderId } = args as {
        bookKey: string; side: string; quantity: number; trailBps?: number; trailCents?: number; funding?: string; stripePaymentMethodId?: string; clientOrderId?: string;
      };
      return apiPost('/v1/vault-markets/pro/trailing-stops', { bookKey, side, quantity, trailBps, trailCents, funding, stripePaymentMethodId, clientOrderId });
    },
  },
  {
    name: 'list_vault_markets_linked_orders',
    description: 'Your linked orders (brackets, OCO pairs, trailing stops, position exits).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['live', 'done'], default: 'live', description: '"live" = still working (the default); "done" = finished or cancelled.' },
        kind: {
          type: 'string',
          enum: ['bracket', 'oco', 'trailing', 'position_exit'],
          description: 'Optional filter: "bracket" = entry with take-profit/stop-loss; "oco" = one-cancels-the-other pair; "trailing" = trailing stop; "position_exit" = a position\'s take-profit/stop-loss.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { status, kind } = args as { status?: string; kind?: string };
      return apiGet('/v1/vault-markets/pro/links', { status, kind });
    },
  },
  {
    name: 'cancel_vault_markets_linked_order',
    description: "Cancel a linked order: its open child orders come off; a bracket's entry stays.",
    inputSchema: ID_ONLY('Linked order'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/pro/links/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'get_vault_markets_position_exits',
    description: "A position's take-profit / stop-loss (in cents), if set.",
    inputSchema: ID_ONLY('Position'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/positions/${encodeURIComponent(id)}/exits`, {});
    },
  },
  {
    name: 'set_vault_markets_position_exits',
    description: "Set a position's take-profit / stop-loss: a long is closed, a short covered, when the last trade reaches one. Both null clears them.",
    inputSchema: {
      type: 'object',
      properties: { id: ID('Position'), takeProfitCents: NULL_CENTS('Take-profit price'), stopLossCents: NULL_CENTS('Stop-loss price') },
      required: ['id', 'takeProfitCents', 'stopLossCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, takeProfitCents, stopLossCents } = args as { id: string; takeProfitCents: number | null; stopLossCents: number | null };
      return apiPut(`/v1/vault-markets/positions/${encodeURIComponent(id)}/exits`, { takeProfitCents, stopLossCents });
    },
  },
  {
    name: 'list_vault_markets_positions_risk',
    description: 'For each live position: tier, health, margin state, the mark (in cents) at which it is called and at which it is liquidated, and the distance to it.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/positions-risk', {}),
  },
  {
    name: 'get_vault_markets_position_risk',
    description: "One position's call and liquidation marks, in cents.",
    inputSchema: ID_ONLY('Position'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/positions/${encodeURIComponent(id)}/risk`, {});
    },
  },
  {
    name: 'get_vault_markets_rates',
    description: 'Daily borrow APR (lent units) and pool APR on a book key, with the pool as a whole, oldest first. Rates in basis points.',
    inputSchema: {
      type: 'object',
      properties: { bookKey: BOOK_KEY, days: { type: 'integer', minimum: 1, maximum: 730, default: 90, description: 'How many days back (1-730). Default 90.' } },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, days } = args as { bookKey: string; days?: number };
      return apiGet('/v1/vault-markets/rates', { bookKey, days });
    },
  },
  {
    name: 'get_vault_markets_dealer',
    description: 'Your dealer status (applied, approved, revoked) and your Instant Exit bands.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/dealer', {}),
  },
  {
    name: 'apply_vault_markets_dealer',
    description: 'Apply to be a dealer (ID check first). Ops review it; approved dealers get raised limits and their bids show as dealer bids.',
    inputSchema: {
      type: 'object',
      properties: {
        businessName: { type: 'string', description: 'Optional business name (up to 120 characters).' },
        note: { type: 'string', description: 'Optional note for the reviewers (up to 1000 characters).' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { businessName, note } = args as { businessName?: string; note?: string };
      return apiPost('/v1/vault-markets/dealer/apply', { businessName, note });
    },
  },
  {
    name: 'list_vault_markets_dealer_bids',
    description: 'Your standing dealer bids.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'all'], default: 'open', description: '"open" = still resting (the default); "all" = including filled, cancelled and expired.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { status } = args as { status?: string };
      return apiGet('/v1/vault-markets/dealer/bids', { status });
    },
  },
  {
    name: 'place_vault_markets_dealer_bid',
    description: 'Place a standing dealer bid: a resting limit buy flagged as a dealer bid. Approved dealers only. Returns the order.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        tif: { type: 'string', enum: ['gtc', 'gtd'], default: 'gtc', description: '"gtc" = good till cancelled (the default); "gtd" = good till expiresAt.' },
        quantity: QTY('How many units'),
        limitCents: CENTS('The bid price'),
        expiresAt: { type: 'string', description: 'When a "gtd" bid expires, as an ISO 8601 time.' },
        displayQuantity: QTY('Iceberg: units shown on the book at a time'),
        funding: FUNDING,
        stripePaymentMethodId: CARD,
        clientOrderId: CLIENT_ID,
      },
      required: ['bookKey', 'quantity', 'limitCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, tif, quantity, limitCents, expiresAt, displayQuantity, funding, stripePaymentMethodId, clientOrderId } = args as {
        bookKey: string; tif?: string; quantity: number; limitCents: number; expiresAt?: string; displayQuantity?: number; funding?: string; stripePaymentMethodId?: string; clientOrderId?: string;
      };
      return apiPost('/v1/vault-markets/dealer/bids', { bookKey, tif, quantity, limitCents, expiresAt, displayQuantity, funding, stripePaymentMethodId, clientOrderId });
    },
  },
  {
    name: 'list_vault_markets_dealer_bands',
    description: 'Your Instant Exit bands and whether each is being kept now.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/dealer/bands', {}),
  },
  {
    name: 'set_vault_markets_dealer_band',
    description: 'Commit to an Instant Exit band on a book key: a standing bid for units kept at bandBps of the mark, never above maxPriceCents, re-quoted as the mark moves.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        bandBps: { type: 'integer', minimum: 5000, maximum: 10000, description: 'Where to keep the bid, in basis points of the mark (market price): 9000 = 90% of the mark.' },
        units: QTY('Units the band bids for'),
        maxPriceCents: CENTS('Never bid above this'),
        funding: FUNDING,
        stripePaymentMethodId: CARD,
        active: { type: 'boolean', description: 'false = keep the band but stop quoting it; true = quote it.' },
      },
      required: ['bookKey', 'bandBps', 'units', 'maxPriceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, bandBps, units, maxPriceCents, funding, stripePaymentMethodId, active } = args as {
        bookKey: string; bandBps: number; units: number; maxPriceCents: number; funding?: string; stripePaymentMethodId?: string; active?: boolean;
      };
      return apiPut('/v1/vault-markets/dealer/bands', { bookKey, bandBps, units, maxPriceCents, funding, stripePaymentMethodId, active });
    },
  },
  {
    name: 'stop_vault_markets_dealer_band',
    description: 'Stop the Instant Exit band on a book key; its standing bid comes off.',
    inputSchema: KEY_ONLY,
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiDelete('/v1/vault-markets/dealer/bands', undefined, { bookKey });
    },
  },
];
