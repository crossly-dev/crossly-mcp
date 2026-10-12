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
        vendor: {
          type: ['string', 'null'],
          maxLength: 120,
          description:
            "Who the goods were bought FROM, as printed on the receipt (max 120 chars) — e.g. 'Goodwill Outlet 12th " +
            "St' or 'Liquidation.com'. Free text: this is the only supplier identifier the ledger carries, there is " +
            'no supplier table or supplier id to reference, so spell a repeat source the same way every time if you ' +
            'want the entries to group. Pass null when the receipt has no legible vendor.',
        },
        dateIso: { type: ['string', 'null'], description: 'ISO 8601 date string, or null if not parsed.' },
        items: {
          type: 'array',
          description:
            'The purchased line items on this receipt — one entry per thing in the lot, and the cost basis half of ' +
            'the record. Required, but may be an empty array for a receipt whose lines could not be parsed; the ' +
            'response echoes { ok, count } where count is this array\'s length. All money here is integer CENTS.',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                maxLength: 200,
                description:
                  "The line's text as printed on the receipt, max 200 chars (e.g. 'MENS DENIM JACKET XL'). Stored " +
                  'verbatim and never matched against inventory — nothing links a line to an inventory item.',
              },
              priceCents: {
                type: 'integer',
                minimum: 0,
                description:
                  'What was paid for this line, in integer CENTS (495 means $4.95) — never dollars. Must be >= 0. ' +
                  'The server coerces a numeric string but will not rescale a dollar figure, so 4.95 is stored as 4 ' +
                  'cents, a 100x understatement of the cost basis.',
              },
            },
            required: ['description', 'priceCents'],
            additionalProperties: false,
          },
        },
        sourceImageUrl: {
          type: ['string', 'null'],
          format: 'uri',
          description:
            'Absolute URL of the receipt photo this entry was parsed from (must parse as a URL — the server rejects ' +
            'a bare filename). Kept so a COGS or tax figure can be traced back to the paper it came from. Pass null ' +
            'when no image was stored.',
        },
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
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          description:
            'Look-back window in days over buyer observations, 1-365. Default 60 — long enough that a slow-moving ' +
            'category still registers. A shorter window reports only what is being hunted right now.',
        },
        minLookers: {
          type: 'integer',
          minimum: 1,
          description:
            'Minimum number of DISTINCT shoppers who looked for the item inside the window before it is reported ' +
            '(>= 1, default 2) — distinct people, not total page views, so one person checking the same barcode all ' +
            'afternoon never reads as demand. Raise it to see only what several buyers independently wanted.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description:
            'Max rows to return, 1-100. Default 25. One row per matched barcode (GTIN), with in_stock preferred over ' +
            'sold_before when the seller has both for the same item.',
        },
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
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          description:
            'Look-back window in days over Scout observations, 1-365. Default 30. Widen it for seasonal or ' +
            'slow-turning categories; narrow it to see what is being searched for this month.',
        },
        minLooks: {
          type: 'integer',
          minimum: 1,
          description:
            'Minimum TOTAL looks (every observation, not distinct shoppers) an item needs in the window before it is ' +
            'reported (>= 1, default 3) — one person checking one obscure barcode is not a market. An item is only ' +
            'listed at all if at least one of those looks was a miss.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description:
            'Max rows to return, 1-200. Default 50. Rows are ranked by MISSES first (times a buyer looked and ' +
            'Crossly had nothing) then by total looks, so a small limit still returns the most actionable gaps.',
        },
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
