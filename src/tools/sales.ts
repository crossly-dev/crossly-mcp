import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

export const salesTools: ToolDef[] = [
  {
    name: 'list_sales',
    description:
      'List unique sale events across every connected marketplace (one row per item-sold, deduped against the ' +
      'idempotency key the sale-cascade uses). Each row has salePrice, platformFee, platform, detectedAt, and ' +
      'the inventory item that sold. Use this for revenue review, top-selling-platform analysis, or to find a ' +
      'specific sale by date. For aggregate KPIs (revenue, fees, count), prefer get_analytics_summary.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/sales', {
        page: args.page,
        limit: args.limit,
      }),
  },
  {
    name: 'sales_bulk_delete',
    description:
      'Bulk soft-delete sales rows by id. The cookie-sales poller dedupes on (platform, platformOrderId, userId) including ' +
      "soft-deleted rows, so we won't re-pull a sale the user explicitly removed on the next 5-min tick. Pass an " +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 500 },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ids'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/sales/bulk-delete', body, idempotencyKey);
    },
  },
];
