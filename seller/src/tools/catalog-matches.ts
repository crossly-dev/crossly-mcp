import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Catalog matching: linking the seller's inventory items to Crossly catalog
 * products so sold comps and market pricing apply. A suggestion binds NOTHING
 * — only confirm_catalog_match does. Never confirm on the seller's behalf
 * without asking them: a wrong link prices their item against a different
 * product's sales.
 */
export const catalogMatchesTools: ToolDef[] = [
  {
    name: 'list_catalog_matches',
    description:
      "List pending catalog-match suggestions across the seller's inventory: items that look like a Crossly " +
      'catalog product (by photo, title and brand, or by an identifier that matched several products). Each has ' +
      'the item, the catalog product (name, photo), a score and the reasons. Show these to the seller and let ' +
      'THEM decide; confirm_catalog_match links one, dismiss_catalog_match rejects it.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max suggestions to return (1-100). Default 25.' },
        before: {
          type: 'string',
          description: 'Keyset cursor: the createdAt (ISO 8601) of the last suggestion already seen, to page older ones.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/catalog-matches', {
        ...(args.limit ? { limit: args.limit } : {}),
        ...(args.before ? { before: args.before } : {}),
      }),
  },
  {
    name: 'get_item_catalog_matches',
    description:
      "One inventory item's catalog link: the confirmed catalog product (if linked) and any pending suggestions.",
    inputSchema: {
      type: 'object',
      properties: { inventoryItemId: { type: 'string', description: 'Inventory item UUID.' } },
      required: ['inventoryItemId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/inventory/${encodeURIComponent(args.inventoryItemId as string)}/catalog-matches`),
  },
  {
    name: 'refresh_item_catalog_matches',
    description:
      'Run catalog matching for one inventory item now. A UPC / style code / catalogue number that resolves to ' +
      'exactly one product links the item automatically; otherwise likely products come back as suggestions for ' +
      'the seller to confirm. Returns the item\'s link and suggestions afterwards.',
    inputSchema: {
      type: 'object',
      properties: {
        inventoryItemId: { type: 'string', description: 'Inventory item UUID.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['inventoryItemId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/inventory/${encodeURIComponent(args.inventoryItemId as string)}/catalog-matches/refresh`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'confirm_catalog_match',
    description:
      'Confirm a catalog-match suggestion the SELLER has agreed is the same product. Links the item to the ' +
      'catalog product (sets its market_sku_id), after which sold comps and market pricing use that product. ' +
      'Only call this after the seller says yes — do not confirm on your own judgement.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Suggestion UUID (from list_catalog_matches or get_item_catalog_matches).' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/catalog-matches/${encodeURIComponent(args.id as string)}/confirm`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'dismiss_catalog_match',
    description:
      'Dismiss a catalog-match suggestion (not the same product). That product is never suggested for the item again.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Suggestion UUID (from list_catalog_matches or get_item_catalog_matches).' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/catalog-matches/${encodeURIComponent(args.id as string)}/dismiss`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
];
