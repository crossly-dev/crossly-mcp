import { apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

export const returnsTools: ToolDef[] = [
  {
    name: 'list_returns',
    description:
      "List the seller's physical-return records. Each return tracks the inventory side of a return " +
      "(requested → in_transit → received → inspected → restocked OR damaged), parallel to refunds (which " +
      "track money). Use status='open' to see anything still in-flight, or status='closed' for terminal ones.",
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
        status: {
          type: 'string',
          description:
            "Filter: 'open' (any in-flight), 'closed' (terminal), or an exact status: " +
            "'requested' | 'in_transit' | 'received' | 'inspected' | 'restocked' | 'damaged' | 'resold' | 'cancelled'.",
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/returns', {
        page: args.page,
        limit: args.limit,
        status: args.status,
      }),
  },
  {
    name: 'get_return',
    description:
      'Fetch one return record by UUID. Use this before update_return so you can show the seller the ' +
      "current status, reason, and which order it's tied to.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Return UUID from list_returns.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/returns/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'create_return',
    description:
      'Open a return on an order. The order must belong to the authenticated seller. If another return on ' +
      'the same order is still in a non-terminal state, this rejects with 409 (open_return_exists). ' +
      'Refunds (money) are handled separately — call issue_refund if you also want to send money back. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order UUID.' },
        reason: { type: 'string', maxLength: 2000, description: 'Free-text reason from the buyer.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['orderId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/returns', body, idempotencyKey);
    },
  },
  {
    name: 'update_return',
    description:
      "Advance the return through its workflow: set status to 'in_transit' / 'received' / 'inspected' / " +
      "'restocked' / 'damaged' / 'resold' / 'cancelled'. Setting 'restocked' with restockedToInventoryItemId " +
      "increments that inventory item's quantityAvailable by 1. Timestamps for received/inspected/restocked " +
      'are stamped automatically on the first transition. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Return UUID.' },
        status: {
          type: 'string',
          enum: [
            'requested',
            'in_transit',
            'received',
            'inspected',
            'restocked',
            'damaged',
            'resold',
            'cancelled',
          ],
        },
        reason: { type: 'string', maxLength: 2000 },
        notes: { type: 'string', maxLength: 4000 },
        restockedToInventoryItemId: {
          type: 'string',
          description:
            'Inventory item to restock into. When set with status=restocked, quantityAvailable bumps by 1.',
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
      return apiPatch(`/v1/returns/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
];
