import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Wishing Fountain in Crossly World: stand at the Commons fountain's rim
 * and toss a coin, one wish a day (UTC). A wish is made in the world -- the
 * server checks where your body is -- so no tool makes one. The coin is a
 * gesture: nothing is spent or won. Seven days of wishes earn the Wishmaker pin.
 */
export const worldWishesTools: ToolDef[] = [
  {
    name: 'get_world_wishes',
    description:
      'The Wishing Fountain in the Commons of Crossly World: today\'s date (UTC), how many wishes everyone has made today, and yours -- ' +
      'whether you made today\'s, how many days you have wished on (the Wishmaker pin comes at 7) and when tomorrow\'s wish opens. ' +
      'Wishes are made by tossing a coin at the fountain in the world, not here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/wishes', {}),
  },
];
