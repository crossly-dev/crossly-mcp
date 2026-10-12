import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World emotes, read-only. Emotes are PLAYED in a room over the
 * presence socket, where the server verifies and broadcasts them; these tools
 * read the record: unlocked emote packs (earned through quests, never bought),
 * the 8-slot emote wheel, and earned moment emotes (unbox / slab_flip /
 * handshake), each playable once.
 */
export const spatialEmotesTools: ToolDef[] = [
  {
    name: 'get_my_emotes',
    description:
      'Your Crossly World emotes: every emote pack (unlocked or not, with the quest that unlocks it), your 8-slot ' +
      'emote wheel as stored and as it shows (labels, locks, ready dots), and moments earned but not yet played.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/emotes', {}),
  },
  {
    name: 'list_my_moments',
    description:
      'Your moment emotes, newest first: unbox (a Crossly purchase delivered), slab_flip (a card graded through ' +
      'Crossly Grading), handshake (a trade-table shake settled). Each plays once in a room; playedAt is null until then.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many (default 50).' },
        ready: { type: 'boolean', description: 'true = only moments not yet played.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const a = args as { limit?: number; ready?: boolean };
      const query: Record<string, unknown> = {};
      if (a.limit != null) query.limit = a.limit;
      if (a.ready != null) query.ready = String(a.ready);
      return apiGet('/v1/spatial/moments', query);
    },
  },
];
