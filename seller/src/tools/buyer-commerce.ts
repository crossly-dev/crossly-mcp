import { apiDelete, apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Buyer offers and auctions, plus the account badge counts.
 *
 * Needs a BUYER token (`crossly_oat_…`, scoped `buyer:*`).
 *
 * ── ONE THING AN AGENT CANNOT DISCOVER BY TRYING ─────────────────────
 * `bid_on_auction` spends money. A winning bid is charged to a saved card
 * when the auction closes, with nobody present — so it is its own tool, needs
 * buyer:checkout:write AND the key switched on with a ceiling, and an
 * idempotency key is not optional in practice.
 *
 * Verbs that hit DIFFERENT HTTP methods dispatch through a function declared
 * above the array rather than inline, so the v1-parity scanner (which pairs
 * every verb and path inside one handler) cannot cross them.
 */

function answerOffer(args: Record<string, unknown>): Promise<unknown> {
  const { id, action, counterCents, idempotencyKey } = args as {
    id: string;
    action: 'accept' | 'decline' | 'counter' | 'withdraw';
    counterCents?: number;
    idempotencyKey?: string;
  };
  if (action === 'withdraw') return apiDelete(`/v1/buyer/offers/${encodeURIComponent(id)}`, idempotencyKey);
  const body = action === 'counter' ? { action, counterCents } : { action };
  return apiPost(`/v1/buyer/offers/${encodeURIComponent(id)}/respond`, body, idempotencyKey);
}

export const buyerCommerceTools: ToolDef[] = [
  {
    name: 'list_my_offers',
    description:
      'The offers this buyer has made, newest first (last 100). `awaitingBuyer: true` is a SELLER COUNTER waiting '
      + 'on the buyer — answer it with answer_my_offer. `redeemable: true` is an accepted price the buyer can pay '
      + 'for on Crossly. Amounts are integer cents. Requires buyer:offers:read.',
    inputSchema: {
      type: 'object',
      properties: {
        awaitingBuyer: {
          type: 'boolean',
          description: 'true returns only seller counters waiting on the buyer.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { awaitingBuyer } = args as { awaitingBuyer?: boolean };
      return apiGet('/v1/buyer/offers', awaitingBuyer === undefined ? {} : { awaitingBuyer: String(awaitingBuyer) });
    },
  },

  {
    name: 'answer_my_offer',
    description:
      'Answer a seller counteroffer, or withdraw an offer the seller has not answered. '
      + '`accept` charges NOTHING — it opens a 48-hour window for the buyer to pay on Crossly. '
      + '`counter` needs counterCents below the seller price and becomes a new offer waiting on the seller. '
      + '`withdraw` only works while the offer is still pending. Requires buyer:offers:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Offer id, from list_my_offers.' },
        action: {
          type: 'string',
          enum: ['accept', 'decline', 'counter', 'withdraw'],
          description:
            'accept/decline/counter answer a seller counter (awaitingBuyer: true); withdraw takes back '
            + 'an offer of yours the seller has not answered.',
        },
        counterCents: {
          type: 'integer',
          description: 'Required for counter: your price for the whole set in CENTS (integer) - 4500 is $45.00.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => answerOffer(args),
  },

  {
    name: 'list_my_auctions',
    description:
      'Auctions the buyer has bid in. `leading` says whether they currently hold the high bid; `paid: false` on a '
      + 'won auction means the automatic charge has not gone through (see manage_auction_bid action "pay"). '
      + 'Requires buyer:auctions:read.',
    inputSchema: {
      type: 'object',
      properties: {
        tab: {
          type: 'string',
          enum: ['bidding', 'won', 'lost'],
          description: 'bidding = still running (default); won = the buyer won; lost = ended, someone else won.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/buyer/auctions', args as Record<string, unknown>),
  },

  {
    name: 'get_auction_activity',
    description:
      'One auction from the buyer\'s side. view "me": their maximum bid, whether they lead, won, and must pay. '
      + 'view "bids": the bid history, highest first, other bidders anonymised. Requires buyer:auctions:read.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The auction listing slug.' },
        view: {
          type: 'string',
          enum: ['me', 'bids'],
          description: 'me = where the buyer stands; bids = the anonymised bid history.',
        },
      },
      required: ['slug', 'view'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, view } = args as { slug: string; view: 'me' | 'bids' };
      return view === 'bids'
        ? apiGet(`/v1/buyer/auctions/${encodeURIComponent(slug)}/bids`)
        : apiGet(`/v1/buyer/auctions/${encodeURIComponent(slug)}/me`);
    },
  },

  {
    name: 'bid_on_auction',
    description:
      'PLACE A BID. THIS SPENDS REAL MONEY IF IT WINS: the saved card is charged when the auction closes, with '
      + 'nobody present. Confirm the amount and the maximum with the buyer first. '
      + 'maxBidCents enables proxy bidding — Crossly bids for them up to it, so the MAXIMUM is what they may pay '
      + 'and what is checked against this key\'s spending ceilings. Requires buyer:checkout:write AND the key '
      + 'enabled via set_buyer_checkout_controls. `leading: false` in the answer means a standing proxy bid outbid '
      + 'them at once. Pass an idempotencyKey: a retried bid is a second bid.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The auction listing slug.' },
        amountCents: {
          type: 'integer',
          description: 'The bid now, in CENTS (integer) - 1500 is $15.00. Must clear the current bid by one increment.',
        },
        maxBidCents: {
          type: 'integer',
          description: 'Optional proxy ceiling in CENTS (integer). The most the buyer may end up paying.',
        },
        paymentMethodId: {
          type: 'string',
          description: 'A card the buyer already saved on Crossly. Omit for their default. Never card data.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['slug', 'amountCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, idempotencyKey, ...body } = args as Record<string, unknown> & { slug: string; idempotencyKey?: string };
      return apiPost(`/v1/buyer/auctions/${encodeURIComponent(slug)}/bids`, body, idempotencyKey);
    },
  },

  {
    name: 'manage_auction_bid',
    description:
      'After bidding. action "retract": withdraw the buyer\'s bids under eBay\'s rules (needs a reason; inside the '
      + 'last 12 hours only bids from the last hour can go). action "pay": for a WON auction whose automatic '
      + 'charge failed, returns a Stripe client secret the buyer confirms on their own device — this charges '
      + 'nothing by itself. Requires buyer:checkout:write.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The auction listing slug.' },
        action: {
          type: 'string',
          enum: ['retract', 'pay'],
          description: 'retract = withdraw bids; pay = get the payment secret for a won, unpaid auction.',
        },
        reason: {
          type: 'string',
          enum: ['typo', 'listing_changed', 'seller_unreachable'],
          description:
            'Required for retract. typo = wrong amount entered; listing_changed = description changed '
            + 'materially; seller_unreachable = the seller cannot be contacted.',
        },
      },
      required: ['slug', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, action, reason } = args as { slug: string; action: 'retract' | 'pay'; reason?: string };
      return action === 'retract'
        ? apiPost(`/v1/buyer/auctions/${encodeURIComponent(slug)}/retract`, { reason })
        : apiPost(`/v1/buyer/auctions/${encodeURIComponent(slug)}/pay`, undefined);
    },
  },

  {
    name: 'get_buyer_badges',
    description:
      'The counts behind the buyer\'s account badge: unread seller messages, seller counters waiting on them, '
      + 'accepted offers to pay for, and orders to review. Cheap; a good first call. Requires buyer:profile:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/badges'),
  },
];
