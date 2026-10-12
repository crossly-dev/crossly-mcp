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
        inventoryItemId: {
          type: 'string',
          description:
            'UUID of the inventory ITEM — the quantity-tracked stock row (`inventory_items.id`), NOT a unit id. ' +
            'An item is "3 x PS5 slim"; a unit is one specific console with its own serial. Returns every unit ' +
            'recorded under that item. Must belong to the calling account, otherwise 404.',
        },
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
        orderId: {
          type: 'string',
          description:
            "UUID of the Crossly order (`orders.id`) — not the marketplace's own order number and not a sale id. " +
            'Returns the units that were attributed to this order at ship time (FIFO over available units unless ' +
            'specific ones were picked). Must belong to the calling account, otherwise 404.',
        },
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
        inventoryItemId: {
          type: 'string',
          description:
            'UUID of the inventory ITEM this piece of stock belongs to (`inventory_items.id`) — the quantity-tracked ' +
            'row, not a unit id. When no `unitId` is given the unit is created lazily under this item. Must belong ' +
            'to the calling account, otherwise 404.',
        },
        value: {
          type: 'string',
          maxLength: 120,
          description:
            'The identifier exactly as read off the physical item, 1-120 characters. Stored verbatim (trimmed) and ' +
            'also normalised for matching — uppercased with every non-alphanumeric stripped — so "SN-1234 5678" and ' +
            '"sn12345678" are the same unit. Must be at least 4 characters AFTER normalisation or the server rejects ' +
            'it with 400. Re-posting a value this account already has attaches to that existing unit instead of ' +
            'minting a second one, and the FIRST recording keeps its timestamp (a repeat never overwrites it).',
        },
        namespace: {
          type: 'string',
          enum: ['serial', 'imei', 'licence_key', 'gtin', 'custom'],
          default: 'serial',
          description:
            'What kind of identifier `value` is; defaults to `serial`. `serial` = a manufacturer serial number. ' +
            '`imei` = a phone/tablet IMEI. `licence_key` = a software or product key. `gtin` = the UPC/EAN barcode, ' +
            'which identifies the MODEL rather than one copy, so it cannot tell two units apart — use it for lookup ' +
            'convenience, not as return evidence. `custom` = your own numbering scheme; an escape hatch, not a ' +
            'default. Uniqueness is per (unit, namespace, normalised value), so the same digits filed under two ' +
            'namespaces are two separate identifiers and will not match each other on lookup.',
        },
        source: {
          type: 'string',
          enum: ['intake', 'packing', 'import', 'manual', 'dispute'],
          default: 'intake',
          description:
            'Where the identifier was collected; defaults to `intake`. This is a declaration stored alongside the ' +
            'value — the readable `strength` grade comes from it WEIGHED AGAINST the recording timestamp and the ' +
            'sale date, so a late record cannot buy pre-sale provenance. `intake` = scanned when the item entered ' +
            'stock, before any sale existed. `packing` = scanned while packing the outgoing order. `import` = loaded ' +
            'in bulk from a spreadsheet or warehouse system. `manual` = typed in ad hoc afterwards. `dispute` = ' +
            'first written down while answering a buyer claim, the weakest thing you can record.',
        },
        unitId: {
          type: 'string',
          description:
            'UUID of an EXISTING unit (`inventory_units.id` — one physical piece of stock, as returned by ' +
            'list_inventory_units) to hang this identifier on, instead of creating a unit. Use it to record a ' +
            'second identifier for the same object, e.g. an IMEI on a phone that already has a serial. Omit for ' +
            'the normal case.',
        },
        notes: {
          type: 'string',
          maxLength: 500,
          description:
            'Free-text note about this physical unit (condition quirks, box contents, where it is shelved), max 500 ' +
            'characters. Written only when this call CREATES the unit — it is ignored when `unitId` is passed or ' +
            'when the value resolves to a unit that already exists, so it cannot be used to amend an existing unit.',
        },
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
        value: {
          type: 'string',
          maxLength: 120,
          description:
            'The identifier to look up, 1-120 characters, as read off the item in hand. Compared after the same ' +
            'normalisation used when recording (uppercase, non-alphanumerics stripped), so hyphens, spaces and case ' +
            'do not matter; the match is exact after that, never fuzzy. Under 4 normalised characters the call ' +
            "succeeds with `{ found: false, reason: 'too_short' }` rather than erroring. A miss means this account " +
            'has never recorded that identifier — it is not proof the unit is counterfeit.',
        },
        namespace: {
          type: 'string',
          enum: ['serial', 'imei', 'licence_key', 'gtin', 'custom'],
          default: 'serial',
          description:
            'Which identifier space to search; defaults to `serial`. Must be the same namespace the value was ' +
            'recorded under — the lookup keys on (namespace, normalised value), so an IMEI filed as `imei` will not ' +
            'be found by searching `serial`. `serial` = manufacturer serial, `imei` = phone/tablet IMEI, ' +
            '`licence_key` = software/product key, `gtin` = UPC/EAN (identifies the model, so it can match several ' +
            'units), `custom` = your own scheme.',
        },
      },
      required: ['value'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/inventory/units/lookup', args),
  },
];
