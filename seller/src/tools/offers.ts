import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Offers on the seller's OWN Crossly marketplace listings.
 *
 * Not the same thing as `respond_to_offer` in the inbox tools, which acts on
 * an offer attached to a conversation on an external marketplace. Crossly
 * offers are standalone rows and a buyer can build one covering several
 * listings at once, which a conversation-scoped single-listing shape cannot
 * represent.
 */
export const offersTools: ToolDef[] = [
  {
    name: 'list_crossly_offers',
    description:
      "List buyer offers on the seller's own Crossly marketplace listings, newest first. " +
      'Each offer may cover SEVERAL listings — a buyer-built bundle — in which case `isBundle` is true and ' +
      '`items` holds every listing it covers. `amountCents` is the price offered for the WHOLE set, and ' +
      '`listedTotalCents` is what those items were asking when the offer was made, so the two are directly ' +
      'comparable. Filter with `status` to triage (e.g. "pending" for what needs a decision, "accepted" for ' +
      'what is awaiting payment). An accepted offer with `consumedAt` set has already been paid for.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn'],
          description: 'Filter to one status. Omit for all.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: 'Max offers to return. Default 50.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/offers', { status: args.status, limit: args.limit }),
  },
  {
    name: 'respond_to_crossly_offer',
    description:
      'Accept, decline, or counter a PENDING offer on a Crossly marketplace listing. ' +
      '`action="accept"` grants the buyer a one-time right to buy every item the offer covers at the agreed ' +
      'price — it does not itself take payment; the buyer still has to complete checkout. ' +
      '`action="counter"` requires `counterCents` and opens a new offer over the SAME set of items. ' +
      '`action="decline"` closes it. Only pending, unexpired offers can be responded to. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Offer UUID (from list_crossly_offers).' },
        action: {
          type: 'string',
          enum: ['accept', 'decline', 'counter'],
          description: 'What to do with the offer.',
        },
        counterCents: {
          type: 'integer',
          minimum: 1,
          description:
            'Required when action="counter". Your asking price in cents for the whole set of items.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, action, counterCents } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
        action: 'accept' | 'decline' | 'counter';
        counterCents?: number;
      };
      // Only send counterCents on a counter — the route's union schema rejects
      // it on accept/decline rather than ignoring it.
      const body = action === 'counter' ? { action, counterCents } : { action };
      return apiPost(`/v1/offers/${encodeURIComponent(id)}/respond`, body, idempotencyKey);
    },
  },
];
