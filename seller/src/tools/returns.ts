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
          description:
            'Next state in the physical-return workflow. OPEN (non-terminal, and each one blocks a second ' +
            "return being opened on the same order): 'requested' — the return has been agreed but nothing has " +
            "shipped back yet, which is where create_return always starts; 'in_transit' — the buyer has sent it " +
            "back; 'received' — the parcel arrived (stamps receivedAt); 'inspected' — you have assessed its " +
            "condition (stamps inspectedAt). CLOSED (terminal): 'restocked' — saleable and returned to stock " +
            '(stamps restockedAt, and with restockedToInventoryItemId adds the linked ORDER\'s quantity back to ' +
            "quantityAvailable, not a hard-coded 1); 'damaged' — came back unsaleable, written off; 'resold' — " +
            "disposed of outside normal stock rather than restocked; 'cancelled' — the return never happened " +
            '(buyer kept the item / claim withdrawn). Timestamps are stamped only on the FIRST transition into ' +
            'a state and re-sending the current status is a no-op. Omit to edit only reason/notes/restock target. ' +
            'Money is a separate axis — this never moves funds; use issue_refund for that.',
        },
        reason: {
          type: 'string',
          maxLength: 2000,
          description:
            'Why the item is coming back, in the buyer\'s or the seller\'s own words — free text up to 2000 ' +
            'characters, NOT an enum, and never interpreted by the server. Overwrites whatever create_return ' +
            'stored. Omit to leave the existing reason alone.',
        },
        notes: {
          type: 'string',
          maxLength: 4000,
          description:
            'Internal seller-only working notes on this return (inspection findings, packaging condition, ' +
            'whether to reship or write off). Free text up to 4000 characters, never shown to the buyer and ' +
            'never sent to the marketplace. Overwrites the previous notes rather than appending.',
        },
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
