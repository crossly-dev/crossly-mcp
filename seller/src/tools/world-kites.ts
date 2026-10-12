import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Kites on the Commons lawn of Crossly World: by day, out on the lawn, fly a
 * kite everyone in the plaza sees ride the wind -- five a
 * day (UTC). A kite is flown in the world -- the server checks where
 * your body is -- so no tool flies one. Nothing is spent or won. Kites
 * on five different days earn the Kite flyer pin.
 */
export const worldKitesTools: ToolDef[] = [
  {
    name: 'get_world_kites',
    description:
      'Kites on the Commons lawn of Crossly World: today\'s date (UTC), how many kites everyone has flown today, and yours -- ' +
      'how many you flew today (perDay a day) and on how many days you have flown one (the Kite flyer pin comes at 5). ' +
      'Kites are flown on the lawn in the world, not here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/kites', {}),
  },
];
