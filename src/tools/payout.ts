import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Shared parameter shape for every payout tool.
 *
 * `weightOz` is called out in its description because omitting it does not
 * produce a slightly-worse answer — it produces one that does not deduct
 * shipping at all, which on a seller-buys-the-label platform is materially
 * optimistic. An agent reasoning about price needs to know that.
 */
const PAYOUT_PROPS = {
  weightOz: {
    type: 'number',
    description:
      'Total packed weight in ounces. WITHOUT this, shipping is NOT deducted on '
      + 'platforms where the seller buys their own label, so netCents will be optimistic. '
      + 'Check shippingSource in the response.',
  },
  shippingCents: {
    type: 'number',
    description: 'A known shipping cost in cents. Overrides every estimate.',
  },
  shippingPaidBy: {
    type: 'string',
    enum: ['buyer', 'seller'],
    description:
      "Who pays shipping. Use 'seller' for free shipping — that moves the cost onto "
      + 'the seller even on platforms where the buyer would normally pay at checkout.',
  },
} as const;

export const payoutTools: ToolDef[] = [
  {
    name: 'estimate_payout',
    description:
      'What a sale NETS on one platform after fees and shipping — the number that actually '
      + 'matters, as opposed to the list price. Returns grossCents, feeCents, shippingCents, '
      + 'netCents, takeHomePct, and an `assumptions` array. ALWAYS surface the assumptions when '
      + 'a decision rests on the figure: they say when shipping was excluded, when a fee model '
      + 'is missing, or when a per-item fee cap was not applied.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: 'Platform id, e.g. "ebay", "poshmark".' },
        priceCents: { type: 'integer', minimum: 0 , description: 'The sale price in CENTS as an integer, so 4599 means $45.99. NOT dollars — sending 45.99 here is off by a factor of 100.' },
        ...PAYOUT_PROPS,
      },
      required: ['platform', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/payout/estimate', args as Record<string, unknown>),
  },
  {
    name: 'compare_payout',
    description:
      'Rank platforms by what the same price NETS on each, highest first. Answers "where should '
      + 'I sell this" — and the answer is often not the platform with the biggest audience, '
      + 'because a 20% commission and a deducted prepaid label can cost more than a smaller '
      + 'audience does. Omit `platforms` to compare only the marketplaces the seller is actually '
      + 'connected to; listing one they cannot publish to is advice they cannot take.',
    inputSchema: {
      type: 'object',
      properties: {
        priceCents: { type: 'integer', minimum: 0 , description: 'The sale price in CENTS as an integer, so 4599 means $45.99. NOT dollars — sending 45.99 here is off by a factor of 100.' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional override. Defaults to the seller\'s connected platforms.',
        },
        ...PAYOUT_PROPS,
      },
      required: ['priceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { platforms, ...rest } = args as Record<string, unknown> & { platforms?: string[] };
      return apiGet('/v1/payout/compare', {
        ...rest,
        ...(Array.isArray(platforms) ? { platforms: platforms.join(',') } : {}),
      });
    },
  },
  {
    name: 'gross_price_for_target_net',
    description:
      'The LIST price needed to clear a target net on one platform — the inverse of '
      + 'estimate_payout. Use this to turn a payout floor into a price: "never net less than $40" '
      + 'is a different list price on every platform, so a single gross floor means four '
      + 'different promises. Returns the lowest qualifying grossCents plus the full estimate at '
      + 'that price.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        netCents: { type: 'integer', minimum: 0, description: 'The target take-home, in cents.' },
        ...PAYOUT_PROPS,
      },
      required: ['platform', 'netCents'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/payout/gross-for-net', args as Record<string, unknown>),
  },
];
