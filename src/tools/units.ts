import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Per-unit identity. Every description here spends a sentence on WHEN an
 * identifier was recorded, because that is the only thing that decides what it
 * proves — and an agent that records serials only once a dispute opens has
 * built a log, not evidence.
 */
export const unitsTools: ToolDef[] = [
  {
    name: 'list_inventory_units',
    description:
      'List the individually identified units of an inventory item (serials, IMEIs, licence keys). Each identifier ' +
      'carries a `strength`: `strong` = recorded before the item sold, `good` = recorded at packing, `weak` = first ' +
      'recorded only after it shipped. Strength is derived from the recording time relative to the sale, never from ' +
      'the value itself. An empty list means nothing was recorded, not that the item has no units.',
    inputSchema: {
      type: 'object',
      properties: {
        inventoryItemId: { type: 'string' },
      },
      required: ['inventoryItemId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/inventory/${encodeURIComponent(args.inventoryItemId as string)}/units`),
  },
  {
    name: 'list_order_units',
    description:
      'List the identified units that physically shipped on an order — the read to make when a buyer disputes or ' +
      'returns something. Compare the serial on the returned item against this list. An empty list means no identity ' +
      'was recorded for that order, which is NOT evidence that the right unit came back.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
      },
      required: ['orderId'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/orders/${encodeURIComponent(args.orderId as string)}/units`),
  },
  {
    name: 'record_unit_identifier',
    description:
      'Record a serial / IMEI / licence key against an inventory item, creating the unit if no unitId is given. ' +
      'Record at INTAKE, before the item sells: an identifier that predates the sale cannot have been chosen to fit a ' +
      'specific dispute, and that is the entire reason the record is worth anything. `source` is a hint stored ' +
      "alongside the value — the server re-derives strength from the timestamp, so declaring 'intake' late does not " +
      'upgrade it. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        inventoryItemId: { type: 'string' },
        value: { type: 'string', maxLength: 120 },
        namespace: {
          type: 'string',
          enum: ['serial', 'imei', 'licence_key', 'gtin', 'custom'],
          default: 'serial',
        },
        source: {
          type: 'string',
          enum: ['intake', 'packing', 'import', 'manual', 'dispute'],
          default: 'intake',
        },
        unitId: { type: 'string', description: 'Attach to an existing unit rather than creating one.' },
        notes: { type: 'string', maxLength: 500 },
        ...IDEMPOTENCY_PROP,
      },
      required: ['inventoryItemId', 'value'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { inventoryItemId, idempotencyKey, ...body } = args as Record<string, unknown> & {
        inventoryItemId: string;
        idempotencyKey?: string;
      };
      return apiPost(
        `/v1/inventory/${encodeURIComponent(inventoryItemId)}/units/identifiers`,
        body,
        idempotencyKey,
      );
    },
  },
  {
    name: 'lookup_unit_by_identifier',
    description:
      '"Have I ever seen this serial?" — resolve an identifier to a unit and the order it shipped on. Use when ' +
      'something arrives back with no paperwork: a hit on a DIFFERENT order usually means a mixed-up return rather ' +
      'than fraud. Scoped to the caller, so it cannot be used to probe another account.',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'string', maxLength: 120 },
        namespace: {
          type: 'string',
          enum: ['serial', 'imei', 'licence_key', 'gtin', 'custom'],
          default: 'serial',
        },
      },
      required: ['value'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/inventory/units/lookup', args),
  },
];
