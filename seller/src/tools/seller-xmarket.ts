import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Seller side of the cross-marketplace features: card breaks, group buys, and
 * the returns Crossly buyers open under your return policy or try at home.
 *
 * Tools whose actions use DIFFERENT HTTP methods dispatch through functions
 * declared above the array, so the v1-parity scanner cannot cross them.
 */

const enc = encodeURIComponent;

function breaks(args: Record<string, unknown>): Promise<unknown> {
  const a = args as {
    action: 'list' | 'get' | 'create' | 'draw' | 'hits' | 'opened' | 'cancel'; id?: string; spotId?: string; hits?: string;
    listingSlug?: string; title?: string; format?: string; spots?: string[] | string; product?: string; idempotencyKey?: string;
  };
  if (a.action === 'list') return apiGet('/v1/breaks');
  if (a.action === 'create') {
    const body = { listingSlug: a.listingSlug, title: a.title, format: a.format, spots: a.spots, product: a.product };
    return apiPost('/v1/breaks', body, a.idempotencyKey);
  }
  if (!a.id) return Promise.reject(new Error('id is required for this action'));
  const id = enc(a.id);
  if (a.action === 'get') return apiGet(`/v1/breaks/${id}`);
  if (a.action === 'draw') return apiPost(`/v1/breaks/${id}/draw`, {});
  if (a.action === 'opened') return apiPost(`/v1/breaks/${id}/opened`, {});
  if (a.action === 'cancel') return apiPost(`/v1/breaks/${id}/cancel`, {});
  if (!a.spotId) return Promise.reject(new Error('spotId is required to record hits'));
  return apiPost(`/v1/breaks/${id}/spots/${enc(a.spotId)}/hits`, { hits: a.hits ?? '' });
}

function policyReturns(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: 'list' | 'received'; id?: string; orderId?: string; idempotencyKey?: string };
  if (a.action === 'list') return apiGet('/v1/policy-returns', { orderId: a.orderId });
  if (!a.id) return Promise.reject(new Error('id is required to mark a return received'));
  return apiPost(`/v1/policy-returns/${enc(a.id)}/received`, {}, a.idempotencyKey);
}

export const sellerXmarketTools: ToolDef[] = [
  {
    name: 'card_breaks_seller',
    description:
      'Run card breaks on your listings: list; get (board); create (listingSlug, title, format pick | random, spots = names or one per line; '
      + 'the seed is committed now and revealed at the draw); draw (a sold-out random break); hits (record what a spot pulled); opened; cancel '
      + '(only before any spot is paid for). listings:read / listings:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'create', 'draw', 'hits', 'opened', 'cancel'], description: 'list = your breaks; get = one board (id); create = start a break; draw = assign spots in a sold-out random break and reveal the seed (id); hits = record what a spot pulled (id, spotId, hits); opened = mark the product opened on stream (id); cancel = cancel before any spot is paid for (id).' },
        id: { type: 'string', description: 'The break id (every action except list and create).' },
        spotId: { type: 'string', description: 'hits: the spot id from the board.' },
        hits: { type: 'string', description: 'hits: what the spot pulled, free text up to 1000 characters.' },
        listingSlug: { type: 'string', description: 'create: the slug of your listing the break sells spots on.' },
        title: { type: 'string', description: 'create: the break title, 3-120 characters.' },
        format: { type: 'string', enum: ['pick', 'random'], description: 'create: pick = buyers choose their spot; random = spots are drawn from the committed seed once sold out.' },
        spots: { description: 'Array of spot names, or one per line.' },
        product: { type: 'string', description: 'create: the product being opened (e.g. "2024 Topps Chrome hobby box"), up to 300 characters.' },
        idempotencyKey: { type: 'string', description: 'create: sent as the Idempotency-Key header. Stable per intent so a retry cannot create two breaks.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => breaks(args),
  },
  {
    name: 'start_group_buy',
    description: 'Start a group buy on a listing with stock: tiers [{ minBuyers, priceCents }], a minimum, 1-6 days. Buyers hold at the listing price and pay the tier reached; below the minimum nobody pays. listings:write.',
    inputSchema: {
      type: 'object',
      properties: {
        listingSlug: { type: 'string', description: 'The slug of your listing (must have stock).' },
        tiers: { type: 'array', items: { type: 'object', properties: { minBuyers: { type: 'number', description: 'Buyers needed to reach this tier.' }, priceCents: { type: 'number', description: 'Price per buyer at this tier, integer CENTS (e.g. 1999 = $19.99).' } }, required: ['minBuyers', 'priceCents'] }, description: '1-5 price tiers [{ minBuyers, priceCents }]; priceCents is integer CENTS (e.g. 1999 = $19.99). Buyers pay the tier the group reaches.' },
        minBuyers: { type: 'number', description: 'Minimum buyers for the group buy to happen (at least 1); below it nobody pays.' },
        days: { type: 'number', minimum: 1, maximum: 6, description: 'How long the group buy runs, 1-6 days.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent so a retry cannot start two group buys.' },
      },
      required: ['listingSlug', 'tiers', 'minBuyers', 'days'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/group-buys', body, idempotencyKey);
    },
  },
  {
    name: 'buy_pickup_point_label',
    description: 'Buy the carrier label for a Crossly order the buyer collects from a UPS / FedEx pickup point (it normally buys itself at payment; use this after topping up the shipping wallet). Debits the wallet; 402 when short. orders:write.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The Crossly order id going to a pickup point.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent so a retry cannot buy two labels.' },
      },
      required: ['orderId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { orderId, idempotencyKey } = args as { orderId: string; idempotencyKey?: string };
      return apiPost(`/v1/orders/${enc(orderId)}/pickup-label`, {}, idempotencyKey);
    },
  },
  {
    name: 'policy_returns',
    description: 'Returns Crossly buyers opened under your return policy or try at home: list (optionally for one orderId); received (id) refunds the buyer less the restocking or try fee you keep. orders:read / orders:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'received'], description: 'list = returns opened against you (optionally one orderId); received = you got the item back, refund the buyer less your restocking / try fee (id).' },
        id: { type: 'string', description: 'received: the return id (from list).' },
        orderId: { type: 'string', description: 'list: only returns for this order id (uuid).' },
        idempotencyKey: { type: 'string', description: 'received: sent as the Idempotency-Key header. Stable per intent so a retry cannot refund twice.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => policyReturns(args),
  },
];
