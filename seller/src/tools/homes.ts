import { apiGet, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Homes in Crossly World: every account's own loft, showing what it owns
 * (inventory, portfolio holdings, graded slabs, furniture bought on Crossly
 * once delivered). Ownership is re-checked on every read, so sold things are
 * simply not in the answer. Building and the guestbook happen in
 * the world.
 */
export const homesTools: ToolDef[] = [
  {
    name: 'get_my_home',
    description:
      'Your Crossly World home: address (slug), privacy (open / friends / locked), theme, the room, every placed piece ' +
      '(props and displays, each display with the item it shows and its live listing slug when listed) and the guestbook. ' +
      'Made on first read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/homes/mine', {}),
  },
  {
    name: 'get_home',
    description:
      'A Crossly World home by its address, as you may see it: open homes to anybody, friends-only homes to mutual follows, ' +
      'locked homes to their owner only. Not found when you may not enter.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The home\'s address, e.g. dana-loft-3f9a1c.' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/homes/${encodeURIComponent(slug)}`, {});
    },
  },
  {
    name: 'list_home_builders',
    description:
      'The co-builders of your home: friends you let rearrange your Crossly World home (move, turn and take out your things, add free ' +
      'furniture; never your bought pieces). Each: userId, name, friends (false once the friendship ended).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/homes/mine/builders', {}),
  },
  {
    name: 'set_home_builders',
    description:
      'Replace the co-builders of your home with these user ids: friends (mutual follows) only, at most 4; an empty list clears them. ' +
      'Each new co-builder gets a world notice. Needs a token with world:write.',
    inputSchema: {
      type: 'object',
      properties: { userIds: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'User ids of friends.' } },
      required: ['userIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { userIds } = args as { userIds: string[] };
      return apiPut('/v1/world/home/builders', { userIds });
    },
  },
  {
    name: 'list_homes_of_the_week',
    description: 'Home of the week: open homes ranked by how many different people signed their guestbook in the last 7 days, with how many are inside now.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/homes/of-the-week', {}),
  },
];
