import { apiGet } from '../../api.js';
import { PAGINATION_PROPS, ToolDef } from '../types.js';

/** Read-only order lookups: lists, one order, parcels, counts, evidence. */
export const orderReads: ToolDef[] = [
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
          description:
            'Exact match on the order\'s stored status string — one value, no partial match. Values the ' +
            'system writes: "needs_fulfillment" (the default the moment a sale lands — this is the ship ' +
            'queue), "label_purchased", "shipped", "in_transit", "delivered", "completed", "disputed", ' +
            '"refunded", "cancelled", "returned". Omit for every status.',
        },
        platform: {
          type: 'string',
          description:
            'Marketplace slug the order came from, e.g. "ebay", "poshmark", "mercari". One platform only, ' +
            'exact match. Omit for all marketplaces.',
        },
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
    name: 'order_print_label',
    description:
      "The order's shipping label as a print-ready PDF (binary, content-type:application/pdf): cropped to the label, " +
      "turned upright and fitted to the paper — whatever sheet the marketplace or carrier issued it on (e.g. Whatnot's " +
      'sideways label on Letter becomes a full 4x6). 404 when the order has no label yet.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "Crossly order UUID (OUR id, not the marketplace's)." },
        size: { type: 'string', enum: ['4x6', 'letter', 'a4', 'native'], description: 'Paper size. Default 4x6.' },
        flip: { type: 'boolean', description: 'Turn the label a half turn (if it comes out upside down).' },
        parcelId: { type: 'string', description: "A specific parcel's label (from the order's parcels); default the primary." },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const a = args as { id: string; size?: string; flip?: boolean; parcelId?: string };
      return apiGet(`/v1/orders/${encodeURIComponent(a.id)}/label/print`, {
        ...(a.size ? { size: a.size } : {}),
        ...(a.flip ? { flip: '1' } : {}),
        ...(a.parcelId ? { parcelId: a.parcelId } : {}),
      });
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
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. Must " +
            'be a real UUID (invalid_order_id otherwise) and owned by the caller.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/orders/${encodeURIComponent(args.id as string)}/packing-slip`),
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
        id: {
          type: 'string',
          description:
            "Crossly order UUID from list_orders — OUR id, not the marketplace's platformOrderId. The " +
            "carrier record is reached through the tracking number stored on that order.",
        },
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
