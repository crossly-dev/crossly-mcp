import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets fees by role, quote requests (RFQ), midpoint blocks,
 * market-maker programmes and market-maker protection (api
 * routes/v1/write/vault-markets-mm.ts). Fees follow the role: the resting
 * order pays the maker rate, the order that fills against it pays the taker
 * rate; a buyer's fee is added ON TOP of the price and a seller's comes out
 * of the proceeds. Quote requests are anonymous; answers are firm for 60
 * seconds and taking one fills it as a block. Market-maker rebates are paid
 * only out of fees Crossly already took on that key that month. Every money
 * figure is integer cents of US dollars; rates are basis points (100 = 1%).
 * Never quote a price that did not come back from these tools.
 */
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const SIDE = { type: 'string', enum: ['buy', 'sell'], description: '"buy" or "sell", from your side of the trade.' } as const;
const QUANTITY = { type: 'integer', minimum: 1, description: 'Units (whole number, at least 1).' } as const;
const FUNDING = { type: 'string', enum: ['card', 'custodian'], description: 'How a buy is paid: "card" (a saved card; give stripePaymentMethodId) or "custodian" (your Vault Markets custodian account). Ignored for a sell.' } as const;
const PM = { type: 'string', description: 'Stripe payment method id (pm_...) of one of your saved cards, for funding "card".' } as const;
const NO_ARGS: ToolDef['inputSchema'] = { type: 'object', properties: {}, additionalProperties: false };
const KEY_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false };
const idArg = (what: string): ToolDef['inputSchema'] => ({
  type: 'object',
  properties: { id: { type: 'string', description: `${what} id (uuid).` } },
  required: ['id'],
  additionalProperties: false,
});

export const vaultMarketsMmTools: ToolDef[] = [
  /* Fees */
  {
    name: 'get_vault_markets_fee_schedule',
    description: 'The Vault Markets fee schedule by role: maker and taker rates in basis points for retail, 30-day volume, Registered LPs and DMMs, the volume threshold in cents of US dollars, the CBX discount, the referral share, and the 2% net floor Crossly always keeps.',
    inputSchema: NO_ARGS,
    handler: () => apiGet('/v1/vault-markets/fees/schedule'),
  },
  {
    name: 'quote_vault_markets_fee',
    description: 'Your fee for one order at a price, as maker (the order rests on the book) and as taker (it fills at once), with the programme that sets your rate and any Crossly One trim. paidOnTop=true means a buyer pays the fee on top of the price; a seller\'s fee comes out of the proceeds. All amounts are cents of US dollars.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        side: SIDE,
        priceCents: { type: 'integer', minimum: 1, description: 'The price per unit, in cents of US dollars (e.g. 12500 = $125.00).' },
        quantity: { type: 'integer', minimum: 1, default: 1, description: 'Units in the order (default 1).' },
      },
      required: ['bookKey', 'side', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/fees/quote', args as Record<string, unknown>),
  },

  /* Quote requests */
  {
    name: 'open_vault_markets_rfq',
    description: 'Ask for a firm quote on a block: dealers, the key\'s designated market maker and liquidity providers, and holders of the item are told, anonymously. Answers are firm for 60 seconds; your limit is never shown to them. Returns { id, expiresAt, invited }. Watch it with get_vault_markets_rfq and take an answer with accept_vault_markets_rfq.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        side: SIDE,
        quantity: QUANTITY,
        limitCents: { type: 'integer', minimum: 100, description: 'Optional worst price per unit, in cents of US dollars: the most you pay (buy) or the least you accept (sell). Answers outside it cannot be taken. Never shown to responders.' },
        ttlSeconds: { type: 'integer', minimum: 30, maximum: 600, description: 'How long the request stays open, in seconds (30-600, default 120).' },
        funding: FUNDING,
        stripePaymentMethodId: PM,
      },
      required: ['bookKey', 'side', 'quantity'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/rfq', args),
  },
  {
    name: 'list_vault_markets_rfqs',
    description: 'Your quote requests, newest first, with status (open, filling, filled, expired, cancelled, failed), your limit in cents of US dollars and any fail reason.',
    inputSchema: NO_ARGS,
    handler: () => apiGet('/v1/vault-markets/rfq'),
  },
  {
    name: 'list_vault_markets_rfq_inbox',
    description: 'Open quote requests you were sent (as a dealer, designated market maker, liquidity provider or holder), each with how you were invited and your live answer. Answer with respond_vault_markets_rfq.',
    inputSchema: NO_ARGS,
    handler: () => apiGet('/v1/vault-markets/rfq/inbox'),
  },
  {
    name: 'list_vault_markets_open_rfqs',
    description: 'Open quote requests on one book key (all-to-all: anyone with ID may answer). Anonymous: side, quantity and expiry only.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet('/v1/vault-markets/rfq/open', args as Record<string, unknown>),
  },
  {
    name: 'get_vault_markets_rfq',
    description: 'One quote request. The requester sees every answer (anonymous) with its price in cents of US dollars and firm-until time; a responder sees the request and their own answer.',
    inputSchema: idArg('Quote request'),
    handler: (args) => {
      const { id } = args as { id: string };
      const rid = encodeURIComponent(id);
      return apiGet(`/v1/vault-markets/rfq/${rid}`);
    },
  },
  {
    name: 'respond_vault_markets_rfq',
    description: 'Answer a quote request with a firm price for its full quantity, good for 60 seconds (a new answer replaces your old one). Selling needs the units free in your vault; buying pays from your Vault Markets custodian account. ID check needed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quote request id (uuid), from list_vault_markets_rfq_inbox or list_vault_markets_open_rfqs.' },
        priceCents: { type: 'integer', minimum: 100, description: 'Your firm price per unit, in cents of US dollars ($1 or more). Must be inside the key\'s LULD price band.' },
      },
      required: ['id', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, priceCents } = args as { id: string; priceCents: number };
      const rid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/rfq/${rid}/respond`, { priceCents });
    },
  },
  {
    name: 'accept_vault_markets_rfq',
    description: 'Take one live answer to your quote request: it fills as a block through the normal fill path (fees by role, self-trade prevention, halts, LULD band). Returns { filled, blockId, tradeIds, reason, rfq }. Only do this when the user explicitly asks to take that answer.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Your quote request id (uuid).' },
        responseId: { type: 'string', description: 'The answer to take (uuid), from get_vault_markets_rfq responses.' },
      },
      required: ['id', 'responseId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, responseId } = args as { id: string; responseId: string };
      const rid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/rfq/${rid}/accept`, { responseId });
    },
  },
  {
    name: 'cancel_vault_markets_rfq',
    description: 'Cancel your open quote request; any live answers expire.',
    inputSchema: idArg('Quote request'),
    handler: (args) => {
      const { id } = args as { id: string };
      const rid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/rfq/${rid}/cancel`, {});
    },
  },
  {
    name: 'withdraw_vault_markets_rfq_response',
    description: 'Withdraw your live answer to a quote request.',
    inputSchema: idArg('Your answer (response)'),
    handler: (args) => {
      const { id } = args as { id: string };
      const rid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/rfq/responses/${rid}/withdraw`, {});
    },
  },

  /* Midpoint blocks */
  {
    name: 'list_vault_markets_midpoints',
    description: 'Your midpoint block orders: side, quantity, minimum match, filled so far, limit in cents of US dollars, status (open, filled, cancelled, expired) and expiry.',
    inputSchema: NO_ARGS,
    handler: () => apiGet('/v1/vault-markets/midpoint'),
  },
  {
    name: 'place_vault_markets_midpoint',
    description: 'Place a hidden block order that trades only at the firm-book midpoint, against another midpoint order of at least your minimum size. Nothing shows on the book. A sell needs the units free in your vault.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        side: SIDE,
        quantity: QUANTITY,
        minQuantity: { type: 'integer', minimum: 1, description: 'The smallest block to match with (1 to quantity, default 1).' },
        limitCents: { type: 'integer', minimum: 100, description: 'Optional worst price per unit, in cents of US dollars: if the midpoint moves past it, the order waits.' },
        funding: FUNDING,
        stripePaymentMethodId: PM,
        hours: { type: 'integer', minimum: 1, maximum: 720, description: 'How long the order lasts, in hours (1-720, default 24).' },
      },
      required: ['bookKey', 'side', 'quantity'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/midpoint', args),
  },
  {
    name: 'cancel_vault_markets_midpoint',
    description: 'Cancel an open midpoint block order.',
    inputSchema: idArg('Midpoint order'),
    handler: (args) => {
      const { id } = args as { id: string };
      const mid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/midpoint/${mid}/cancel`, {});
    },
  },

  /* Market makers */
  {
    name: 'get_vault_markets_mm_programs',
    description: 'Your market-maker programmes (liquidity provider or designated market maker, per key), the last 30 days of obligations (two-sided coverage, calls joined, quote requests answered in time, met or not), rebates in cents of US dollars (paid only from fees Crossly already took on that key that month), and the rules.',
    inputSchema: NO_ARGS,
    handler: () => apiGet('/v1/vault-markets/mm'),
  },
  {
    name: 'join_vault_markets_lp',
    description: 'Join a key as a Registered Liquidity Provider (ID check needed; active at once). Meeting coverage earns the LP fee rates the next day.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiPost('/v1/vault-markets/mm/lp', args),
  },
  {
    name: 'apply_vault_markets_dmm',
    description: 'Apply to be the designated market maker on a tier B or C key (one per key; Crossly approves). Obligations: two-sided quote inside the spread cap most of the trading time, every opening and re-opening call, and answering 60% of quote requests within 60 s.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        displayName: { type: 'string', maxLength: 60, description: 'Optional name shown on the item\'s page as its market maker (1-60 characters).' },
        note: { type: 'string', maxLength: 1000, description: 'Optional note for Crossly\'s reviewers (up to 1000 characters).' },
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/mm/dmm', args),
  },
  {
    name: 'leave_vault_markets_mm_program',
    description: 'Leave a market-maker programme; its fee rate and benefits stop with it.',
    inputSchema: idArg('Programme (from get_vault_markets_mm_programs)'),
    handler: (args) => {
      const { id } = args as { id: string };
      const pid = encodeURIComponent(id);
      return apiPost(`/v1/vault-markets/mm/${pid}/leave`, {});
    },
  },
  {
    name: 'get_vault_markets_key_makers',
    description: 'A book key\'s designated market maker (by the name it chose, and whether it is meeting its obligations) and how many liquidity providers quote it.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet('/v1/vault-markets/mm/key', args as Record<string, unknown>),
  },
  {
    name: 'get_vault_markets_mmp',
    description: 'Your market-maker protection: the fill trigger (units or notional in cents of US dollars within a window of seconds), the freeze length, and whether you are frozen now.',
    inputSchema: NO_ARGS,
    handler: () => apiGet('/v1/vault-markets/mm/mmp'),
  },
  {
    name: 'set_vault_markets_mmp',
    description: 'Set market-maker protection: when maxUnits units or maxNotionalCents filled on your quotes within windowSeconds, every quote is pulled at once and quoting freezes for freezeSeconds. Turning it on needs at least one of maxUnits / maxNotionalCents.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Protection on (true) or off (false).' },
        windowSeconds: { type: 'integer', minimum: 1, maximum: 300, description: 'The window fills are counted over, in seconds (1-300, default 10).' },
        maxUnits: { type: ['integer', 'null'], minimum: 1, maximum: 10000, description: 'Units filled on your quotes inside the window that trip it (null = no unit trigger).' },
        maxNotionalCents: { type: ['integer', 'null'], minimum: 100, description: 'Value filled on your quotes inside the window that trips it, in cents of US dollars (null = no value trigger).' },
        freezeSeconds: { type: 'integer', minimum: 1, maximum: 3600, description: 'How long quoting stays frozen after a trip, in seconds (1-3600, default 60).' },
      },
      required: ['enabled'],
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/vault-markets/mm/mmp', args),
  },
  {
    name: 'reset_vault_markets_mmp',
    description: 'End a market-maker protection freeze early.',
    inputSchema: NO_ARGS,
    handler: () => apiPost('/v1/vault-markets/mm/mmp/reset', {}),
  },
  {
    name: 'mass_cancel_vault_markets_orders',
    description: 'Cancel every open Vault Markets order (optionally on one key, or only market-making quotes) and every resting leg in one statement: nothing fills between the first cancel and the last. Returns { orders, legs }. Only on the user\'s explicit ask.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { ...BOOK_KEY, description: `Optional: only this key. ${BOOK_KEY.description}` },
        quotesOnly: { type: 'boolean', description: 'true = cancel only market-making quotes; false or absent = every open order.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/mm/mass-cancel', args),
  },
];
