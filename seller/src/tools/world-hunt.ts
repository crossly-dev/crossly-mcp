import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Great Hunt in Crossly World: a seasonal hunt for three keys (Copper,
 * Jade, Crystal) across the world's places, each behind a riddle. A key is
 * picked up by WALKING to it in the world -- the server sees you there -- so
 * no tool takes one. The third opens the Gate in the Commons and puts you on
 * the Scoreboard. Prizes are pins; nothing here moves money.
 */
const EMPTY = { type: 'object', properties: {}, additionalProperties: false } as const;

export const worldHuntTools: ToolDef[] = [
  {
    name: 'get_my_great_hunt',
    description:
      'Your Great Hunt this season in Crossly World: the season (name, start, end, its title and how many earn it), whether you started, ' +
      'how many keys you hold (0-3, always Copper then Jade then Crystal), each key with its riddle once it is yours to read and when you ' +
      'picked it up, and your rank through the Gate if you cleared it. Keys are found by walking to them in the world.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/hunt', {}),
  },
  {
    name: 'get_great_hunt_scoreboard',
    description:
      'The Great Hunt Scoreboard (the monolith in the Commons): the first ten through the Gate this season in order, with rank, name, ' +
      'when, and whether they earned the title, plus how many have cleared it in all. A name shows only for somebody who chose to be ' +
      'seen by name in the world; everyone else is "A player". Between seasons it shows the last one.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/hunt/scoreboard', {}),
  },
  {
    name: 'start_great_hunt',
    description:
      'Start the Great Hunt this season by reading its first riddle (the Copper key\'s). Idempotent. Answers your hunt as get_my_great_hunt ' +
      'does. Fails with 409 when no season is running. Finding the keys is done in the world, not here.',
    inputSchema: EMPTY,
    handler: () => apiPost('/v1/world/hunt/start', {}),
  },
];
