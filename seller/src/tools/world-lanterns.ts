import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Sky lanterns in the Commons of Crossly World: at the lantern stand by the
 * walk-in, release a paper lantern everyone in the plaza sees rise -- three a
 * day (UTC). A lantern is released in the world -- the server checks where
 * your body is -- so no tool releases one. Nothing is spent or won. Lanterns
 * on five different days earn the Lantern lighter pin.
 */
export const worldLanternsTools: ToolDef[] = [
  {
    name: 'get_world_lanterns',
    description:
      'Sky lanterns in the Commons of Crossly World: today\'s date (UTC), how many lanterns everyone has released today, and yours -- ' +
      'how many you released today (perDay a day) and on how many days you have released one (the Lantern lighter pin comes at 5). ' +
      'Lanterns are released at the stand in the world, not here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/lanterns', {}),
  },
];
