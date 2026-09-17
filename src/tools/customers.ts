import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const customersTools: ToolDef[] = [
  {
    name: 'list_customers',
    description:
      "Aggregated customer view — groups the seller's orders by lower(buyer_username) so the same buyer " +
      'on multiple platforms shows as one row. Returns normalizedHandle, platforms[], totalOrders, totalSpent, ' +
      'lastOrderAt, firstOrderAt. Sorted by totalOrders DESC then totalSpent DESC — repeat buyers first.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Case-insensitive substring match on buyer username. Omit to list everyone.',
        },
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/customers', {
        search: args.search,
        page: args.page,
        limit: args.limit,
      }),
  },
  {
    name: 'get_customer',
    description:
      'Fetch one buyer (by normalized handle) plus their recent 50 orders across all platforms. ' +
      'Use this to look up a repeat buyer before sending a message or to investigate a dispute history. ' +
      'Also returns `contact` — email, name, phone and the most recent shipping address, each resolved ' +
      'from the latest order that carried it. Fields are null when the marketplace does not share them ' +
      'with sellers, which is most of them; eBay is the one that reliably does.',
    inputSchema: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'Normalized (lowercase) buyer handle from list_customers.',
        },
      },
      required: ['handle'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/customers/${encodeURIComponent((args.handle as string).toLowerCase())}`),
  },
  {
    name: 'customers_bulk_delete',
    description:
      "Bulk-blocklist customer handles. Customers aren't a CRUD table — they aggregate from orders — so 'delete' means " +
      "'hide this handle from the customers view and stop future aggregation'. Existing orders rows are untouched. Pass " +
      'an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        handles: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 500 },
        ...IDEMPOTENCY_PROP,
      },
      required: ['handles'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/customers/bulk-delete', body, idempotencyKey);
    },
  },
  {
    name: 'customers_bulk_export',
    description:
      'Export aggregated customer rows for a list of handles as CSV. Returns the CSV text body — caller should treat as a string. ' +
      'Pass an idempotencyKey for cache-replay safety.',
    inputSchema: {
      type: 'object',
      properties: {
        handles: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2000 },
        ...IDEMPOTENCY_PROP,
      },
      required: ['handles'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/customers/bulk-export', body, idempotencyKey);
    },
  },
];
