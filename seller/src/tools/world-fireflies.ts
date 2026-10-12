import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Fireflies on the Commons lawn in Crossly World: after dark, walk up to a lit
 * one and catch it, each firefly once a day and a jar of ten a day (UTC). A
 * catch is made in the world -- the server checks where your body is -- so no
 * tool makes one. Nothing is spent or won. Thirty catches earn the Firefly
 * Catcher pin.
 */
export const worldFirefliesTools: ToolDef[] = [
  {
    name: 'get_world_fireflies',
    description:
      'Fireflies on the Commons lawn in Crossly World: today\'s date (UTC), how many fireflies everyone has caught today, and yours -- ' +
      'how many you caught today (the jar holds perDay), and all your catches (the Firefly Catcher pin comes at 30). ' +
      'Fireflies are caught by walking up to a lit one in the world after dark, not here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/fireflies', {}),
  },
];
