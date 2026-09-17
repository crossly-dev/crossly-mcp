import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const sourcingTools: ToolDef[] = [
  {
    name: 'list_sourcing_receipts',
    description:
      "List parsed sourcing receipts in this user's ledger (newest first, capped at 200 entries). Each row carries " +
      "{ vendor, dateIso, items: [{ description, priceCents }], sourceImageUrl, loggedAt }. Used by COGS/tax flows " +
      "to reconcile inventory cost basis against vendor purchases.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/sourcing/receipts'),
  },
  {
    name: 'log_sourcing_receipt',
    description:
      "Append a parsed receipt to the sourcing ledger. Typically called after AI receipt extraction (see ai_extract_receipt). " +
      "Vendor, dateIso, and sourceImageUrl may be null; items is required (even if empty). The ledger is capped at " +
      "200 entries — the oldest fall off the end. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        vendor: { type: ['string', 'null'], maxLength: 120 },
        dateIso: { type: ['string', 'null'], description: 'ISO 8601 date string, or null if not parsed.' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', maxLength: 200 },
              priceCents: { type: 'integer', minimum: 0 },
            },
            required: ['description', 'priceCents'],
            additionalProperties: false,
          },
        },
        sourceImageUrl: { type: ['string', 'null'], format: 'uri' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['vendor', 'dateIso', 'items', 'sourceImageUrl'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/sourcing/receipts', body, idempotencyKey);
    },
  },
  {
    name: 'get_my_demand_matches',
    description:
      'Unmet buyer demand for items THIS seller is holding or has sold before. ' +
      "relation='in_stock' means it is in their inventory right now — money already on " +
      "the shelf. relation='sold_before' means they have sold one, so they know where to " +
      'get another. Prefer this over get_unmet_demand when advising one seller. ' +
      'Requires analytics:read.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 365 },
        minLookers: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const q = new URLSearchParams();
      for (const key of ['days', 'minLookers', 'limit'] as const) {
        if (args[key] != null) q.set(key, String(args[key]));
      }
      const query = q.toString();
      return apiGet(`/v1/sourcing/demand/mine${query ? `?${query}` : ''}`);
    },
  },
  {
    name: 'get_unmet_demand',
    description:
      'Items buyers looked for on OTHER sites that Crossly did not have, ranked by how ' +
      'often we came up empty. Use this to answer "what should I go source". ' +
      'medianPageCents is what the retailers were charging. Aggregate and anonymous — ' +
      'there is no per-buyer view. Requires analytics:read.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 365 },
        minLooks: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const q = new URLSearchParams();
      for (const key of ['days', 'minLooks', 'limit'] as const) {
        if (args[key] != null) q.set(key, String(args[key]));
      }
      const query = q.toString();
      return apiGet(`/v1/sourcing/demand${query ? `?${query}` : ''}`);
    },
  },
];
