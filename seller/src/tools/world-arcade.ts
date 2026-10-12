import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Arcade in Crossly World: an indoor hall of cabinets, one per game the
 * world already has (the first-party pieces, Price Guess practice, creators'
 * games from the Game Directory), and its High Score wall. Read-only: games
 * are played at their cabinets in the world, and nothing here moves money.
 */
const EMPTY = { type: 'object', properties: {}, additionalProperties: false } as const;

export const worldArcadeTools: ToolDef[] = [
  {
    name: 'get_world_arcade',
    description:
      'The Arcade in Crossly World: every cabinet (its slot and spot, whether it hosts an interactive piece, Price Guess practice, or ' +
      'stands empty; the game, title, one-line blurb, players, and for a creator game its Game Directory id and thumbnail) and the ' +
      'High Score wall (per game: Price Guess\'s all-time leaderboard, a piece\'s room record such as Light Chase\'s high score, or a ' +
      'creator game\'s best scores; up to five lines each, a name only for people who chose to be named). Games are played in the world.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/arcade', {}),
  },
];
