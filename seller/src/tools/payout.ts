import { apiGet, apiPost } from '../api.js';
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
        platform: {
          type: 'string',
          description:
            'Platform id to solve the price for, e.g. "ebay", "poshmark" — exactly one. Required: the ' +
            'answer is a different gross price on every marketplace.',
        },
        netCents: { type: 'integer', minimum: 0, description: 'The target take-home in CENTS as an integer, so 4000 means $40.00. NOT dollars — sending 40 here asks for a 40-cent payout.' },
        ...PAYOUT_PROPS,
      },
      required: ['platform', 'netCents'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/payout/gross-for-net', args as Record<string, unknown>),
  },
  {
    name: 'get_payout_account',
    description:
      "The seller's Stripe payout account on Crossly: status, country, service agreement and the "
      + 'currency they are paid out in. status is not_started (with defaultCountry), pending, active, '
      + 'restricted or payouts_unavailable. ONLY active means buyers can check out their Crossly '
      + 'listings; payouts_unavailable means Stripe offers Crossly no way to pay sellers in that '
      + 'country yet (anywhere outside the US, Canada, the UK, the EEA and Switzerland) — say so plainly '
      + 'rather than suggesting they finish onboarding. Read the message field to the seller when present.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/payout/connect'),
  },
  {
    name: 'start_payout_onboarding',
    description:
      "Start or resume the seller's Stripe payout-account onboarding and get back a Stripe-hosted "
      + 'URL. Nothing is set up until the SELLER opens that link and completes it — hand them the URL, '
      + 'never open or fill it yourself. country (ISO alpha-2) defaults to their storefront ship-from '
      + 'country, then US, and CANNOT be changed once the account exists (409 '
      + 'connect_country_mismatch). 422 connect_country_unsupported where Stripe cannot onboard. '
      + 'Check payoutsSupported in the response: false means the account can exist but cannot be paid yet.',
    inputSchema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
          description: "ISO 3166-1 alpha-2 country of the seller's bank account, e.g. GB. Omit to use the default.",
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/payout/connect/onboard', args as Record<string, unknown>),
  },
];
