import { apiPatch, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/** Single-order verbs: patch, dispute, rates/labels, history import. */
export const orderFulfillment: ToolDef[] = [
  {
    name: 'order_update',
    description:
      // Advertised "cancelled/returned" for a long time. Neither is in
      // OrderStatusEnum (routes/orders.ts) — the route 400s on both — so an
      // agent reading this description would pick a value it had just been
      // told was supported and get a validation error it could not explain.
      // The list below is that enum, verbatim.
      'PATCH a single order — set status/notes/trackingNumber. Transitions to shipped/delivered/completed/disputed/refunded ' +
      'fire the matching webhook and automation triggers. Submitting trackingNumber also dispatches platform-side ' +
      'submit-tracking when a platformOrderId is present. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. Must " +
            'be a real UUID or the call fails with invalid_order_id; a soft-deleted order reads as 404.',
        },
        status: {
          type: 'string',
          // Mirrors OrderStatusEnum. Stated as an enum as well as in prose so
          // a wrong value is impossible to construct, not merely documented.
          enum: [
            'needs_fulfillment',
            'label_purchased',
            'shipped',
            'in_transit',
            'delivered',
            'completed',
            'disputed',
            'refunded',
          ],
          description:
            'New fulfillment status. This endpoint accepts exactly: "needs_fulfillment" (in the ship ' +
            'queue — the state a new sale lands in), "label_purchased" (label bought, parcel not handed ' +
            'over yet), "shipped" (stamps shippedAt, moves the item out of Reserved, and tells the ' +
            'marketplace when the order has a platformOrderId), "in_transit", "delivered" (stamps ' +
            'deliveredAt), "completed" (closed out), "disputed", "refunded" (also stamps the linked sale ' +
            'row so it stops counting as revenue). Any other value is rejected. Omit to leave status alone.',
        },
        notes: {
          type: 'string',
          description:
            "Internal seller note, max 2000 chars. REPLACES the existing note — it is not appended. " +
            'Private: never shown to the buyer or sent to the marketplace.',
        },
        trackingNumber: {
          type: 'string',
          description:
            'Carrier tracking number, max 100 chars. Supplying it IMPLIES status=shipped even if status ' +
            'is omitted, and dispatches a platform-side submit-tracking job when the order has a ' +
            'platformOrderId.',
        },
        labelCost: {
          type: 'number',
          description:
            'What the seller paid for postage they bought themselves, in dollars. With trackingNumber it is ' +
            'that parcel’s cost; alone, it sets the cost on the order’s existing tracking. Counted against ' +
            'the sale’s net profit.',
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
      return apiPatch(`/v1/orders/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'order_dispute',
    description:
      'Flag a single order as disputed with a reason and optional platformCaseId. Sets isDisputed=true, status=disputed, ' +
      'and pushes an ORDER_STATUS_UPDATE. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. " +
            'Must be a real UUID or the call fails with invalid_order_id.',
        },
        reason: {
          type: 'string',
          description:
            'Why the order is disputed — free text, 1-1000 chars (e.g. "buyer opened an item-not-as-' +
            'described case"). Stored on the order and fires the order.disputed trigger.',
        },
        platformCaseId: {
          type: 'string',
          description:
            "The MARKETPLACE's own case/claim identifier (eBay case id, PayPal dispute id, Etsy case " +
            'number), max 200 chars — a different id space from both the Crossly order UUID and ' +
            'platformOrderId. Omit when the dispute was not raised through a platform case.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'reason'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/dispute`, body, idempotencyKey);
    },
  },
  {
    name: 'order_rates',
    description:
      'EasyPost rate quote for an order. Provide weightOz and (length/width/height in inches), or a presetId. The seller\'s ' +
      'default ship-from address is used. Returns an array of available rates with carrier/service/price. Pass an ' +
      'idempotencyKey on retries (rate fetches are cheap but rate-limited).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. The " +
            "buyer's address on that order is the ship-to.",
        },
        weightOz: {
          type: 'number',
          description:
            'Total packed weight in OUNCES — not pounds, not grams. Greater than 0 and at most 1120 ' +
            '(~70 lb). Required: every quoted rate is priced off it.',
        },
        lengthIn: {
          type: 'number',
          description:
            'Parcel length in INCHES, greater than 0 and at most 108. Omit all three dimensions and ' +
            'Crossly auto-picks the parcel it thinks the item ships in (smallest saved box that fits, ' +
            "else the item's own dimensions).",
        },
        widthIn: {
          type: 'number',
          description: 'Parcel width in INCHES, greater than 0 and at most 108. See lengthIn for the omit-all behaviour.',
        },
        heightIn: {
          type: 'number',
          description: 'Parcel height in INCHES, greater than 0 and at most 108. See lengthIn for the omit-all behaviour.',
        },
        presetId: {
          type: 'string',
          description:
            "UUID of one of the seller's saved package presets to source dimensions from. Must belong " +
            'to this seller or the call 404s with preset_not_found. Any dimension passed explicitly ' +
            'wins over the preset; the preset only fills the blanks.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'weightOz'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/rates`, body, idempotencyKey);
    },
  },
  {
    name: 'order_label',
    description:
      'Purchase a shipping label via EasyPost using a rateId returned by order_rates. CHARGES the seller — confirm before ' +
      'calling. Once the label is bought we automatically push the tracking number to the originating platform. Pass an ' +
      'idempotencyKey to make retries safe.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. Must " +
            'be the SAME order the rate was quoted for.',
        },
        rateId: {
          type: 'string',
          description:
            'The `id` of the chosen entry in the order_rates response (the carrier\'s rate object id, ' +
            'e.g. "rate_..."), NOT a carrier or service name. Buying it charges the seller\'s prepaid ' +
            "shipping wallet the rate's price in DOLLARS plus a 5% markup; too small a balance comes " +
            'back as an error carrying requiredCents and balanceCents, which are CENTS.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'rateId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/label`, body, idempotencyKey);
    },
  },
  {
    name: 'order_pull_platform_label',
    description:
      'Fetch a pre-paid label from cookie-platforms that ship one with the order (Poshmark, Mercari). Stores the URL on the ' +
      'order row + pushes an ORDER_STATUS_UPDATE. Refuses with 400/platform_does_not_provide_label for platforms without ' +
      'pre-paid labels — use order_rates + order_label instead.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. The " +
            'order must already carry a platformOrderId (400 missing_platform_order_id otherwise), ' +
            'since that is what the marketplace is asked for the label with.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/pull-platform-label`, {}, idempotencyKey);
    },
  },
  {
    name: 'import_order_history',
    description:
      "Manually (re-)pull a connected platform's order history for a day-window. Independent of the " +
      'one-time post-connect backfill (set_history_import_window) — safe to call repeatedly, since ' +
      'sale detection dedupes on (platform, platformOrderId, userId): re-importing an already-known ' +
      'order is a no-op, only genuinely new or previously-out-of-window ones land. days: null = All ' +
      'time (no limit), a positive integer = days back. No zero/"None" — this call always means "go ' +
      'get me something". Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description:
            'Marketplace slug to re-pull, e.g. "ebay", "etsy", "poshmark", "mercari" — one per call, and ' +
            'it must be a platform this seller has actually connected.',
        },
        days: {
          type: ['integer', 'null'],
          description:
            'How far back to reach, in DAYS: a positive integer up to 3650 (10 years), or null for all ' +
            'time. Required and has no zero/"none" — this call always means "go get me something". ' +
            'Anything already known dedupes on (platform, platformOrderId, userId), so a repeat is a no-op.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform', 'days'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/orders/import', body, idempotencyKey);
    },
  },
];
