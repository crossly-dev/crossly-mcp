import { apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/** Multi-select bar operations — every one takes a list of OUR order UUIDs. */
export const orderBulk: ToolDef[] = [
  {
    name: 'orders_bulk_delete',
    description:
      'Bulk soft- or hard-delete orders by id. Default behaviour sets deleted_at = now() so the cookie-sales poller will not ' +
      're-create them on its next tick; pass hardDelete=true to remove rows outright (rare — reserved for legitimate test data). ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 500,
          description:
            "Crossly order UUIDs from list_orders — OUR ids, not the marketplaces' platformOrderIds. " +
            '1-500 per call (the server rejects more). Ids the caller does not own are ignored; the ' +
            'response reports how many rows were actually affected.',
        },
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
        orderIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Crossly order UUIDs from list_orders (OUR ids, not platformOrderIds), 1-500 per call. ' +
            'Already-closed orders are skipped by the shared bulk-mark-shipped guard rather than flipped.',
        },
        trackingNumber: {
          type: 'string',
          description:
            'Optional shared tracking number stamped on EVERY selected row, max 100 chars. Only ' +
            'meaningful when the whole selection really shipped in one parcel — otherwise leave it out ' +
            'and use submit_tracking per order.',
        },
        carrier: {
          type: 'string',
          description: 'Optional shared carrier slug ("usps", "ups", "fedex", "dhl"), max 40 chars, stamped on every selected row.',
        },
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
        orderIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Crossly order UUIDs from list_orders (OUR ids, not platformOrderIds), 1-500 per call.',
        },
        reason: {
          type: 'string',
          minLength: 1,
          maxLength: 1000,
          description:
            'Why these orders are disputed — free text, 1-1000 chars, stored as disputeReason on every ' +
            'selected row. Not a marketplace reason code, and never sent to the marketplace.',
        },
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
        orderIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Crossly order UUIDs from list_orders (OUR ids, not platformOrderIds), 1-500 per call. ' +
            'Orders the caller does not own, and soft-deleted ones, are silently left out of the CSV. ' +
            'The money columns come off the linked sale row and are DOLLARS as decimal strings — Sale ' +
            'Price "45.99" is $45.99, likewise Platform Fee and Label Cost. Nothing in this CSV is cents.',
        },
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
  {
    name: 'orders_bulk_packing_slips',
    description:
      'Generate one bulk PDF containing packing slips for every order in the selection (one slip per page). Pass an ' +
      'idempotencyKey for cache-replay safety.',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Crossly order UUIDs from list_orders (OUR ids, not platformOrderIds). 1-50 per call — this ' +
            'endpoint caps at 50, lower than the other bulk order tools, so split a bigger selection.',
        },
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
];
