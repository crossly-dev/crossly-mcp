import { apiPost } from '../api.js';
import { ToolDef } from './types.js';

const ids = { type: 'array', items: { type: 'string' }, maxItems: 400 } as const;

/**
 * Grail glints in Crossly World: which ids are things the caller already wants.
 * Read-only (a POST for the long id lists).
 */
export const worldGrailsTools: ToolDef[] = [
  {
    name: 'match_world_grails',
    description:
      'Grail glints in Crossly World: given ids on show (listingIds, inventoryIds, skuIds -- catalogue market SKUs), returns the ones the caller ' +
      'already wants: an open bid, a watched or wishlisted listing (or one selling the same SKU), a market watch, or a card their deck is missing. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        listingIds: { ...ids, description: 'Listing ids (listings.id) on show, e.g. a Main Street window or a stall counter.' },
        inventoryIds: { ...ids, description: 'Inventory piece ids on show, e.g. the items on a shop room\x27s shelves.' },
        skuIds: { ...ids, description: 'Catalogue market SKU ids on show, e.g. the Hall of Grails exhibits.' },
      },
      additionalProperties: false,
    },
    handler: (args: Record<string, unknown>) => apiPost('/v1/world/grails/match', {
      listingIds: Array.isArray(args.listingIds) ? args.listingIds : undefined,
      inventoryIds: Array.isArray(args.inventoryIds) ? args.inventoryIds : undefined,
      skuIds: Array.isArray(args.skuIds) ? args.skuIds : undefined,
    }),
  },
];
