import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Commons chest in Crossly World: every 20 minutes (UTC) a chest stands
 * somewhere on the plaza and walking up to it opens it -- the server sees you
 * there -- so no tool opens one. The prize is a pin; nothing here moves money.
 */
export const worldChestsTools: ToolDef[] = [
  {
    name: 'get_commons_chest',
    description:
      'The Commons chest in Crossly World: this 20-minute window (UTC), where the chest stands on the plaza ([x, z] metres), when the ' +
      'next one comes, and yours -- whether you opened this one and how many windows you have opened one in (the Chest opener pin ' +
      'comes at 10). Chests are opened by walking up to them in the world, not here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/chests', {}),
  },
];
