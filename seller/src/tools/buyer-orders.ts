import { apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * After purchase — what a buyer can do with an order, the resolution center,
 * feedback, the order-history export and reporting a seller.
 *
 * Needs a BUYER token (`crossly_oat_…`, scoped `buyer:*`). Nothing here spends
 * money; cancelling REFUNDS. The descriptions say which call to make FIRST
 * (get_order_options) because the refusals — "the seller already bought a
 * label", "too early to report it missing" — are rules an agent cannot guess.
 */

const RATING = (what: string) => ({ type: 'integer', minimum: 1, maximum: 5, description: `${what}, 1-5 stars.` });

export const buyerOrderTools: ToolDef[] = [
  {
    name: 'get_order_options',
    description:
      'What the buyer can do with one order RIGHT NOW: canCancel, canMarkReceived, canLeaveFeedback, and '
      + '`inr` — whether an item-not-received case can be opened, and if not, why (`inr.reason`) and when it '
      + 'opens (`inr.opensAt`). Call this before act_on_order. Requires buyer:orders:read.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Order (purchase) id, from the buyer\'s order list.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/buyer/orders/${encodeURIComponent(id)}/eligibility`);
    },
  },

  {
    name: 'act_on_order',
    description:
      'Act on an order. "cancel": before the seller buys a label or ships — refunds in full. "received": confirm '
      + 'it arrived; opens feedback, does NOT release the seller\'s money sooner. "not_received": open an '
      + 'item-not-received case — only after the delivery window (a 409 carries details.opensAt), one case per '
      + 'order ever, `body` required. Check get_order_options first. Requires buyer:orders:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order (purchase) id.' },
        action: {
          type: 'string',
          enum: ['cancel', 'received', 'not_received'],
          description: 'cancel = cancel before ship; received = confirm delivery; not_received = open an INR case.',
        },
        body: { type: 'string', description: 'For not_received: what happened, 8-2000 characters, shown to the seller.' },
        photoUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'For not_received: up to 6 evidence image URLs.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, action, body, photoUrls, idempotencyKey } = args as {
        id: string;
        action: 'cancel' | 'received' | 'not_received';
        body?: string;
        photoUrls?: string[];
        idempotencyKey?: string;
      };
      const oid = encodeURIComponent(id);
      if (action === 'cancel') return apiPost(`/v1/buyer/orders/${oid}/cancel`, undefined, idempotencyKey);
      if (action === 'received') return apiPost(`/v1/buyer/orders/${oid}/received`, undefined);
      return apiPost(`/v1/buyer/orders/${oid}/inr`, { body, ...(photoUrls ? { photoUrls } : {}) }, idempotencyKey);
    },
  },

  {
    name: 'export_my_orders',
    description:
      'The buyer\'s order history as CSV TEXT in `data.csv` (up to 5,000 orders) — the same file the shop '
      + 'downloads. Money columns are DOLLARS, as a spreadsheet expects. Requires buyer:orders:read.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'First day to include, YYYY-MM-DD.' },
        to: { type: 'string', description: 'Last day to include, YYYY-MM-DD (inclusive).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/buyer/orders/export', args as Record<string, unknown>),
  },

  {
    name: 'tip_seller',
    description:
      "Tip the seller on one of the buyer's shipped orders, charged to a saved card. $1–$500 (amountCents 100–50000), "
      + "one tip per order, counted against the key's spending controls. Requires buyer:checkout:write.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The purchase id.' },
        amountCents: { type: 'number', description: 'The tip, integer CENTS (e.g. 500 = $5.00), 100-50000 ($1-$500).' },
        message: { type: 'string', description: 'Optional thank-you, up to 280 characters.' },
        idempotencyKey: { type: 'string', description: 'Stable per intent so a retry cannot tip twice.' },
      },
      required: ['id', 'amountCents', 'idempotencyKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPost(`/v1/buyer/orders/${encodeURIComponent(id)}/tip`, body, idempotencyKey);
    },
  },

  {
    name: 'report_seller',
    description:
      'Report a seller to Crossly\'s trust team. A second report while the first is under review updates it '
      + 'rather than filing another. Requires buyer:orders:write.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'The seller\'s shop handle.' },
        reason: {
          type: 'string',
          enum: ['scam', 'off_platform', 'not_shipped', 'counterfeit', 'harassment', 'fee_avoidance', 'other'],
          description:
            'scam; off_platform = asked to pay or talk outside Crossly; not_shipped; counterfeit; harassment; '
            + 'fee_avoidance = tried to dodge Crossly fees; other.',
        },
        details: { type: 'string', description: 'Anything that helps the review, up to 2000 characters.' },
        purchaseId: { type: 'string', description: 'The buyer\'s order from this seller, if the report is about one.' },
      },
      required: ['username', 'reason'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { username, ...body } = args as Record<string, unknown> & { username: string };
      return apiPost(`/v1/buyer/sellers/${encodeURIComponent(username)}/report`, body);
    },
  },

  {
    name: 'get_my_cases',
    description:
      'The resolution center. Without `id`: every case the buyer opened (returns, not received, problems) — '
      + '`yourTurn: true` means it is waiting on them. With `id`: one case with its message thread and the return '
      + 'parcel. Requires buyer:orders:read.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'One case id. Omit to list.' },
        status: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'When listing: open (default) = still being worked; closed = resolved or withdrawn; all.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, status } = args as { id?: string; status?: string };
      return id
        ? apiGet(`/v1/buyer/cases/${encodeURIComponent(id)}`)
        : apiGet('/v1/buyer/cases', status ? { status } : {});
    },
  },

  {
    name: 'act_on_case',
    description:
      'Work a case. "accept_offer"/"reject_offer": answer the seller\'s partial-refund offer (accepting refunds '
      + 'it and closes the case). "counter": propose your own refund, amountCents, at most what was paid. '
      + '"message": post on the thread (`body`). "escalate": ask Crossly to step in. "withdraw": close it with no '
      + 'refund — cannot be reopened. Requires buyer:orders:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Case id, from get_my_cases.' },
        action: {
          type: 'string',
          enum: ['accept_offer', 'reject_offer', 'counter', 'message', 'escalate', 'withdraw'],
          description: 'What to do on the case; see the tool description for each.',
        },
        amountCents: {
          type: 'integer',
          description: 'For counter: the refund asked for, in CENTS (integer) - 1200 is $12.00.',
        },
        note: { type: 'string', description: 'For counter: optional note to the seller.' },
        body: { type: 'string', description: 'For message: the message text.' },
        attachmentUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'For message: up to 6 image URLs.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const a = args as Record<string, unknown> & { id: string; action: string; idempotencyKey?: string };
      const cid = encodeURIComponent(a.id);
      if (a.action === 'accept_offer' || a.action === 'reject_offer') {
        return apiPost(`/v1/buyer/cases/${cid}/respond`, { decision: a.action === 'accept_offer' ? 'accept' : 'reject' }, a.idempotencyKey);
      }
      if (a.action === 'counter') return apiPost(`/v1/buyer/cases/${cid}/counter`, { amountCents: a.amountCents, note: a.note });
      if (a.action === 'message') return apiPost(`/v1/buyer/cases/${cid}/messages`, { body: a.body, attachmentUrls: a.attachmentUrls });
      if (a.action === 'escalate') return apiPost(`/v1/buyer/cases/${cid}/escalate`, undefined);
      return apiPost(`/v1/buyer/cases/${cid}/withdraw`, undefined);
    },
  },

  {
    name: 'get_my_feedback',
    description:
      'view "pending": orders from the last 60 days that are on their way or arrived and still need feedback — '
      + 'feed these to leave_feedback. view "left": feedback the buyer has left, with the ids revise_feedback '
      + 'takes. Requires buyer:orders:read.',
    inputSchema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['pending', 'left'],
          description: 'pending = still owed; left = already given.',
        },
      },
      required: ['view'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { view } = args as { view: 'pending' | 'left' };
      return view === 'pending' ? apiGet('/v1/buyer/feedback/pending') : apiGet('/v1/buyer/feedback');
    },
  },

  {
    name: 'leave_feedback',
    description:
      'Leave feedback on up to 25 orders at once, each with optional detailed seller ratings (1-5). Each entry '
      + 'succeeds or fails on its own — read data[].ok; a moderated comment comes back review_blocked. Write it in '
      + 'the buyer\'s words; feedback is public and attributed to them. Requires buyer:feedback:write.',
    inputSchema: {
      type: 'object',
      properties: {
        reviews: {
          type: 'array',
          minItems: 1,
          maxItems: 25,
          description: 'One entry per order, from get_my_feedback view "pending".',
          items: {
            type: 'object',
            properties: {
              purchaseId: { type: 'string', description: 'The order.' },
              rating: RATING('Overall'),
              body: { type: 'string', description: 'Optional public comment, up to 2000 characters.' },
              ratingAsDescribed: RATING('Item as described'),
              ratingCommunication: RATING('Communication'),
              ratingShipSpeed: RATING('Shipping speed'),
              ratingShipCost: RATING('Shipping cost, as a 1–5 star rating (not a currency amount)'),
            },
            required: ['purchaseId', 'rating'],
            additionalProperties: false,
          },
        },
      },
      required: ['reviews'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/feedback', args as Record<string, unknown>),
  },

  {
    name: 'revise_feedback',
    description:
      'Revise feedback the buyer left, within 60 days. Replaces the stars and comment; detailed ratings that are '
      + 'omitted stay as they were. Requires buyer:feedback:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Feedback id, from get_my_feedback view "left".' },
        rating: RATING('Overall'),
        body: { type: 'string', description: 'The new public comment. Omit to clear it.' },
        ratingAsDescribed: RATING('Item as described'),
        ratingCommunication: RATING('Communication'),
        ratingShipSpeed: RATING('Shipping speed'),
        ratingShipCost: RATING('Shipping cost, as a 1–5 star rating (not a currency amount)'),
      },
      required: ['id', 'rating'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as Record<string, unknown> & { id: string };
      return apiPatch(`/v1/buyer/feedback/${encodeURIComponent(id)}`, body);
    },
  },
];
