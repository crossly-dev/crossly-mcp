import { apiGet, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

const ID_PROP = {
  type: 'string',
  description: 'Crossly order UUID of a WHATNOT order (400 for any other platform).',
} as const;

const PACKAGE_PROPS = {
  weightOz: { type: 'number', description: 'Package weight in OUNCES.' },
  lengthIn: { type: 'number', description: 'Box length in inches (send all three or none).' },
  widthIn: { type: 'number', description: 'Box width in inches.' },
  heightIn: { type: 'number', description: 'Box height in inches.' },
} as const;

/**
 * Whatnot shipping: the buyer paid postage, so a Whatnot label is GENERATED
 * by Whatnot rather than bought. Mirrors /api/v1/orders/:id/whatnot/*.
 */
export const orderWhatnot: ToolDef[] = [
  {
    name: 'order_whatnot_shipment',
    description:
      "Read a Whatnot order's shipment: status, package (weightOz, dimensionsIn), labelUrl, trackingNumber, carrier, " +
      'canGenerateLabel. If Whatnot already has a label (e.g. the seller made it in Whatnot) it is recorded on the ' +
      'Crossly order as a side effect (recorded: true).',
    inputSchema: { type: 'object', properties: { id: ID_PROP }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      // A plain `${encodeURIComponent(id)}` — the v1-parity scanner reads the route from this template.
      const id = String((args as { id: string }).id);
      return apiGet(`/v1/orders/${encodeURIComponent(id)}/whatnot/shipment`);
    },
  },
  {
    name: 'order_whatnot_quote_package',
    description:
      'Quote what changing a Whatnot shipment package would cost the seller, in CENTS (costCents). Whatnot gives a ' +
      'free allowance of adjustments, then charges. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { id: ID_PROP, ...PACKAGE_PROPS },
      required: ['id', 'weightOz'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as Record<string, unknown> & { id: string };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/whatnot/package/quote`, body);
    },
  },
  {
    name: 'order_whatnot_update_package',
    description:
      'Save a Whatnot shipment package (weight + box). Refuses a change that costs money unless acceptCostCents >= the ' +
      'quoted cost — quote first with order_whatnot_quote_package.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID_PROP,
        ...PACKAGE_PROPS,
        acceptCostCents: { type: 'integer', description: 'CENTS the seller agreed Whatnot may charge. Default 0.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'weightOz'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/whatnot/package`, body, idempotencyKey);
    },
  },
  {
    name: 'order_whatnot_generate_label',
    description:
      'Generate the Whatnot shipping label (Whatnot pays base postage) and record it on the order: parcel + tracking, ' +
      'label link, status label_purchased. Waits up to ~45s. If Whatnot adds a surcharge it refuses unless ' +
      'acceptSurchargeCents covers it. Already-labelled shipments return the existing label.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID_PROP,
        acceptSurchargeCents: { type: 'integer', description: 'CENTS of surcharge the seller agreed to. Default 0.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPost(`/v1/orders/${encodeURIComponent(id)}/whatnot/label`, body, idempotencyKey);
    },
  },
  {
    name: 'order_whatnot_packing_slip',
    description: "A fresh link to Whatnot's own packing slip PDF for this order (signed ~1 week; fetch again rather than store).",
    inputSchema: { type: 'object', properties: { id: ID_PROP }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      // A plain `${encodeURIComponent(id)}` — the v1-parity scanner reads the route from this template.
      const id = String((args as { id: string }).id);
      return apiGet(`/v1/orders/${encodeURIComponent(id)}/whatnot/packing-slip`);
    },
  },
];
