import { apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/** Per-order actions that reach out to the marketplace: cancel, message, tracking, refund. */
export const orderActions: ToolDef[] = [
  {
    name: 'cancel_order',
    description:
      'Cancel an order on its marketplace (eBay, Etsy, Shopify, OfferUp, Poshmark, Mercari). ' +
      'DESTRUCTIVE and usually irreversible — confirm with the user first, and call check_cancel_eligibility ' +
      'to pick a valid reason. ' +
      'IMPORTANT: a 200 does NOT mean the marketplace cancelled anything. The Crossly order is always flipped ' +
      'to cancelled; read `platformCancel` to see what actually happened — "sent" (marketplace confirmed), ' +
      '"queued" (async job), "failed" (marketplace refused; `error` has its message verbatim), "unsupported" ' +
      '(no wire — tell the user to cancel on the marketplace themselves), "no_platform_order_id", or ' +
      '"already_cancelled". Report that outcome to the user rather than a blanket success.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order UUID from list_orders.' },
        reason: {
          type: 'string',
          description:
            'Marketplace reason code, e.g. eBay OUT_OF_STOCK_OR_CANNOT_FULFILL / BUYER_ASKED_CANCEL / ' +
            'ADDRESS_ISSUES. Take it from check_cancel_eligibility rather than guessing.',
        },
        idempotencyKey: { type: 'string', description: 'Optional; prevents a double cancel on retry.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown>;
      return apiPost(`/v1/orders/${encodeURIComponent(id as string)}/cancel`, body, idempotencyKey as string | undefined);
    },
  },
  {
    name: 'message_buyer',
    description:
      "Send a message to an order's buyer on the marketplace. eBay only — every other platform can only reply " +
      'inside a thread the buyer started, so use the inbox tools there. The message is also saved to the Crossly ' +
      "inbox on the same thread the buyer's reply will land on. Fails with buyer_username_pending if the buyer " +
      "handle hasn't arrived yet (it lands moments after the sale).",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order UUID from list_orders.' },
        body: { type: 'string', description: 'Message text, max 2000 chars.' },
        subject: { type: 'string', description: 'Optional subject; defaults to the order id.' },
        idempotencyKey: { type: 'string', description: 'Optional; prevents a duplicate send on retry.' },
      },
      required: ['id', 'body'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown>;
      return apiPost(`/v1/orders/${encodeURIComponent(id as string)}/message`, body, idempotencyKey as string | undefined);
    },
  },
  {
    name: 'submit_tracking',
    description:
      'Mark an order shipped by submitting a tracking number + carrier to the originating marketplace. ' +
      'Dispatches an async platform job (eBay Fulfillment API for eBay, extension job for cookie platforms, etc.). ' +
      'Carrier must be a slug the platform recognises ("usps", "ups", "fedex", "dhl"). ' +
      'ALWAYS pass an idempotencyKey on retries — duplicate submissions can confuse buyers.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. " +
            'The route looks the platform order id up itself before dispatching.',
        },
        trackingNumber: { type: 'string', description: 'Carrier tracking number exactly as the carrier issued it.' },
        carrier: {
          type: 'string',
          description: 'Carrier slug, e.g. "usps", "ups", "fedex", "dhl". The dispatcher maps to per-platform codes.',
        },
        labelCost: {
          type: 'number',
          description:
            'Optional. What the seller paid for this postage, in dollars (e.g. 4.85) — for a label bought outside ' +
            'Crossly. Recorded on the parcel and counted against the sale’s net profit.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'trackingNumber', 'carrier'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/tracking`, body, idempotencyKey);
    },
  },
  {
    name: 'issue_refund',
    description:
      'Refund an order via the originating marketplace\'s API. Full refund if amount is omitted; partial otherwise. ' +
      'Some platforms require a reason string. Returns the platform\'s refund response (or a refund_failed error). ' +
      'IRREVERSIBLE on most platforms — confirm with the user before calling. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId.",
        },
        amount: {
          type: 'number',
          description:
            'Partial refund amount in DOLLARS, not cents — 12.5 means $12.50, matching the decimal ' +
            'dollars the linked sale row stores (order money lives on `sales`). Must be > 0 and is ' +
            'written back as the refunded amount. Omit for a FULL refund.',
          exclusiveMinimum: 0,
        },
        reason: {
          type: 'string',
          maxLength: 500,
          description:
            'Free-text reason, max 500 chars. Some platforms require one (eBay) and map it onto their own ' +
            'reason enum; it is also stored on the order as refundReason.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/refund`, body, idempotencyKey);
    },
  },
  {
    name: 'order_link_listing',
    description:
      "Link an UNMATCHED sale to one of the seller's listings. An unmatched sale is an order whose listing is an " +
      "auto-created external-sale stub (the listing's platform row carries unmatchedSale) — the marketplace sold an " +
      "id Crossly did not hold, e.g. a Whatnot show selling a copy of the seller's listing. This re-points the sale + " +
      'order to the chosen listing, marks it sold quantity-aware (stock moves like a detected sale), archives the ' +
      'stub, and DELISTS the item from every other marketplace once no unit is left. Confirm the listing with the ' +
      'user first: it is the seller saying "this sale was that item". 409 when the order is already linked.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Crossly order UUID (from list_orders), not the marketplace order id.' },
        listingId: { type: 'string', description: "Crossly listing UUID of the seller's real listing that sold." },
        platformListingId: {
          type: 'string',
          description:
            "Optional: which of that listing's platform rows (its UUID) on the order's marketplace takes the sale, " +
            'when it has several. Omitted: the most recent one; when it has none the stub row moves under it.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'listingId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/link-listing`, body, idempotencyKey);
    },
  },
];
