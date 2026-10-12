import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World parties, read-only. A party is up to 8 friends moving through
 * the world together (same room copy, a private party channel, a shared
 * wishlist with thumbs up/down). Parties are formed and used inside the world;
 * these tools read the record. The party never pays: each member checks out
 * on their own.
 */
export const spatialPartyTools: ToolDef[] = [
  {
    name: 'get_my_party',
    description:
      'Your Crossly World party: null when you are in none, else its id, leader and up to 8 members, each with the ' +
      'place (and copy) they are in right now or null, plus the invites it has out; and the invites waiting for you.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/party', {}),
  },
  {
    name: 'list_party_wishlist',
    description:
      'Your party\'s shared wishlist, newest first: each listing (title, price in cents, image, shop slug while live), ' +
      'who added it, and every member\'s thumb up or down with the totals. Empty when you are in no party.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/party/wishlist', {}),
  },
];
