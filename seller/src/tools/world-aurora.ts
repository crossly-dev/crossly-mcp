import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Sales Aurora over the Commons in Crossly World: every real sale on
 * Crossly in the last 30 days, aggregate only. Read-only.
 */
export const worldAuroraTools: ToolDef[] = [
  {
    name: 'get_world_aurora',
    description:
      'The Sales Aurora in Crossly World: every real sale on Crossly in the last 30 days as ribbons in the Commons night sky. ' +
      'Returns the total, a count per colour family (cards, coins, jewellery, electronics, media, fashion, toys, other) and the newest ' +
      'sales (family, age in hours, fresh = sold in the last ten minutes). Aggregate only: no item, price, seller or platform.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/aurora', {}),
  },
];
