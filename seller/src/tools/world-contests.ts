import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Skill contests on Crossly World games: entry free, sponsored or paid (paid
 * only where the operator allows it, adults only), prizes by place. The
 * outcome is decided by the game's server-side scores.
 */
const ID_ARG = { type: 'string', format: 'uuid', description: 'The contest.' } as const;

export const worldContestTools: ToolDef[] = [
  {
    name: 'list_world_contests',
    description: 'Open skill contests on Crossly World games, soonest ending first, with entry mode and prizes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/contests', {}),
  },
  {
    name: 'get_my_world_contests',
    description: 'Your contest entries (best score, attempts, payment state) and prizes (granted, or owed until their gate opens).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/contests/mine', {}),
  },
  {
    name: 'get_world_contest_standings',
    description: 'The standings of a contest now: best score first, ties to whoever got there first.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/contests/${encodeURIComponent(id)}/standings`, {});
    },
  },
  {
    name: 'create_world_contest',
    description: 'Set up a skill contest on a game placed in your place. Pass the whole config: title, game (instance id), entry { mode: free|sponsored|paid, feeCents? }, prizes [{ from, to, kind: cbx|cosm|cosm_design|item|pin, amount, ref? }], funder (crossly_events|creator|sponsor|entry_fees), sponsorName?, startsAt, endsAt, attempts, maxEntrants?, minAge?.',
    inputSchema: { type: 'object', properties: { contest: { type: 'object', description: 'The contest config.' } }, required: ['contest'], additionalProperties: false },
    handler: (args) => apiPost('/v1/world/contests', (args as { contest: Record<string, unknown> }).contest),
  },
  {
    name: 'join_world_contest',
    description: 'Enter a contest. Free and sponsored contests take you in at once; a paid one answers a client secret to pay the entry fee.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/contests/${encodeURIComponent(id)}/join`, {});
    },
  },
  {
    name: 'settle_world_contest_payment',
    description: 'Settle the fee of a paid contest entry by reading it back from Stripe (safe to repeat).',
    inputSchema: { type: 'object', properties: { entryId: { type: 'string', format: 'uuid', description: 'The entry.' } }, required: ['entryId'], additionalProperties: false },
    handler: (args) => {
      const { entryId } = args as { entryId: string };
      return apiPost(`/v1/world/contests/entries/${encodeURIComponent(entryId)}/settle-payment`, {});
    },
  },
];
