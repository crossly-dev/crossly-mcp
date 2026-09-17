import { apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

export const ordersTools: ToolDef[] = [
  {
    name: 'list_orders',
    description:
      'List the seller\'s orders across all marketplaces. Use to find what\'s pending shipment, what shipped, ' +
      'or to look up a buyer. Filter by status="pending"|"shipped"|"delivered"|"refunded"|"cancelled" and/or ' +
      'platform. Returns rows with buyer info, shipping address (when available), and tracking state.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
        status: {
          type: 'string',
          description: 'Filter by fulfillment status. Most-asked filter is "pending".',
        },
        platform: { type: 'string', description: 'Restrict to one marketplace.' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/orders', {
        page: args.page,
        limit: args.limit,
        status: args.status,
        platform: args.platform,
      }),
  },
  {
    name: 'get_order',
    description:
      'Fetch one order by UUID — full buyer details, line items, shipping address, fees, and tracking. ' +
      'Always call this before submit_tracking or issue_refund so you can show the user what they\'re acting on.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order UUID from list_orders.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/orders/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'get_order_shipments',
    description:
      'List the PARCELS an order shipped in. An order is not always one box: eBay allows a second ' +
      'label, Poshmark sells up to ten additional ones, and a bundle can need two. get_order returns ' +
      'only the PRIMARY parcel, so call this whenever the question involves tracking, label cost, or ' +
      '"did this ship in more than one package". Each parcel reports carrier, service, tracking ' +
      'number, label cost and SOURCE — crossly (we bought it), platform (the marketplace issued it), ' +
      'email (lifted from a label email), or manual (the seller typed it in). Use ' +
      'totalLabelCostCents for cost of sale: the order\'s own label cost covers the primary parcel ' +
      'only, so a two-parcel order understates by a whole label. Voided parcels are included with ' +
      'voidedAt set — they were paid for and refunded.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order UUID from list_orders.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/orders/${encodeURIComponent(args.id as string)}/shipments`),
  },
  {
    name: 'check_cancel_eligibility',
    description:
      'Ask the marketplace whether an order can still be cancelled and WHICH reason codes it will accept. ' +
      'Read-only — cancels nothing. ALWAYS call this before cancel_order: the accepted reasons vary per order ' +
      '(an unpaid eBay order offers ORDER_UNPAID, a paid one does not), and a reason the marketplace does not ' +
      'accept is rejected outright. Returns eligible, eligibleCancelReason[], failureReason[], and source ' +
      '("ebay" = asked the marketplace live; "capability-map" = we only know whether a wire exists).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Order UUID from list_orders.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/orders/${encodeURIComponent(args.id as string)}/cancel-eligibility`),
  },
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
        id: { type: 'string', description: 'Order UUID.' },
        trackingNumber: { type: 'string', description: 'Carrier tracking number.' },
        carrier: {
          type: 'string',
          description: 'Carrier slug, e.g. "usps", "ups", "fedex", "dhl". The dispatcher maps to per-platform codes.',
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
        id: { type: 'string', description: 'Order UUID.' },
        amount: {
          type: 'number',
          description: 'Refund amount in the order\'s currency. Omit for a full refund.',
          exclusiveMinimum: 0,
        },
        reason: {
          type: 'string',
          maxLength: 500,
          description: 'Free-text reason (some platforms require this — e.g. eBay).',
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

  // ── Bulk order operations ─────────────────────────────────────────────
  {
    name: 'orders_bulk_delete',
    description:
      'Bulk soft- or hard-delete orders by id. Default behaviour sets deleted_at = now() so the cookie-sales poller will not ' +
      're-create them on its next tick; pass hardDelete=true to remove rows outright (rare — reserved for legitimate test data). ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 500 },
        hardDelete: { type: 'boolean', default: false, description: 'true = DELETE row; false = soft delete (default).' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['orderIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/orders/bulk-delete', body, idempotencyKey);
    },
  },
  {
    name: 'orders_bulk_mark_shipped',
    description:
      'Bulk-flip a selection of orders to status=shipped. Does NOT call any platform API — use submit_tracking per order for ' +
      'platform-side shipping. Optionally stamps tracking/carrier on each row. Fires order.shipped automation triggers and ' +
      'pushes a WebSocket update. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: { type: 'array', items: { type: 'string' } },
        trackingNumber: { type: 'string', description: 'Optional shared tracking number to stamp on every row.' },
        carrier: { type: 'string', description: 'Optional shared carrier slug.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['orderIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/orders/bulk-mark-shipped', body, idempotencyKey);
    },
  },
  {
    name: 'orders_bulk_mark_disputed',
    description:
      'Bulk flag orders as disputed with a shared reason. Sets isDisputed=true, status=disputed, and stores the reason. Does ' +
      'NOT open a case on the marketplace — use the platform UI for that. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string', minLength: 1, maxLength: 1000 },
        ...IDEMPOTENCY_PROP,
      },
      required: ['orderIds', 'reason'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/orders/bulk-mark-disputed', body, idempotencyKey);
    },
  },
  {
    name: 'orders_bulk_export',
    description:
      'Export a selection of orders as CSV. Returns the CSV text body — caller should treat it as a string. Useful for ' +
      'accounting handoffs. Read-only (no idempotency needed but accepted for forward-compat).',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: { type: 'array', items: { type: 'string' } },
        ...IDEMPOTENCY_PROP,
      },
      required: ['orderIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/orders/bulk-export', body, idempotencyKey);
    },
  },

  // ── Single-order verb endpoints ───────────────────────────────────────
  {
    name: 'order_update',
    description:
      'PATCH a single order — set status/notes/trackingNumber. Transitions to shipped/delivered/cancelled/returned/refunded ' +
      'fire the matching webhook and automation triggers. Submitting trackingNumber also dispatches platform-side ' +
      'submit-tracking when a platformOrderId is present. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        notes: { type: 'string' },
        trackingNumber: { type: 'string' },
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
        id: { type: 'string' },
        reason: { type: 'string' },
        platformCaseId: { type: 'string' },
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
        id: { type: 'string' },
        weightOz: { type: 'number' },
        lengthIn: { type: 'number' },
        widthIn: { type: 'number' },
        heightIn: { type: 'number' },
        presetId: { type: 'string', description: 'Optional packagePresets row id to source dimensions from.' },
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
        id: { type: 'string' },
        rateId: { type: 'string' },
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
        id: { type: 'string' },
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
    name: 'order_packing_slip',
    description:
      'Single-order packing slip as PDF (binary response — surfaced as a content-type:application/pdf body). Useful for ' +
      'shipping workflows when the seller wants to include a slip in the box.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/orders/${encodeURIComponent(args.id as string)}/packing-slip`),
  },
  {
    name: 'orders_bulk_packing_slips',
    description:
      'Generate one bulk PDF containing packing slips for every order in the selection (one slip per page). Pass an ' +
      'idempotencyKey for cache-replay safety.',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: { type: 'array', items: { type: 'string' } },
        ...IDEMPOTENCY_PROP,
      },
      required: ['orderIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/orders/bulk-packing-slips', body, idempotencyKey);
    },
  },
  {
    name: 'orders_counts',
    description:
      'Tab badge counts by status (pending / needs_fulfillment / shipped / delivered / disputed / etc.) + an "all" rollup. ' +
      'Useful for showing the seller their fulfillment queue size before pulling rows.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/orders/counts'),
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
        platform: { type: 'string' },
        days: { type: ['integer', 'null'] },
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
  {
    name: 'get_proof_of_delivery',
    description:
      "Get proof-of-delivery evidence for an order, for when a buyer claims it never arrived. " +
      "Built from the CARRIER's own record, not from our order status: the delivery scan with its date and " +
      "location, the full chain of scans, and a signature where the service captured one. " +
      "Read the `gaps` array before advising the seller to file - it lists exactly why this document is weak " +
      "(not yet delivered, no scan history captured, no signature). " +
      "`postalCodeMatches` is TRI-STATE: true means the carrier delivered to the same postal code as the " +
      "order's address (the strongest single fact available), false means it delivered somewhere else, and " +
      "null means one side was missing - never report null as a mismatch. " +
      "Nothing in the response is inferred; a missing field is reported as missing.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order UUID.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/orders/${encodeURIComponent(id)}/proof-of-delivery`, { format: 'json' });
    },
  },
];
