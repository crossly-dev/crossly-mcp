import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * You in Crossly World: unblock, cancel / claim / release job shifts, answer
 * price checks, lift a ban from your place, named or anonymous, fit-value
 * sharing, and reads (showable, friends here, your trades). Posting a shift
 * is not here: it commits pay at settle.
 */
const UUID = (d: string) => ({ type: 'string', format: 'uuid', description: d }) as const;
const SLUG = { type: 'string', minLength: 1, maxLength: 80, description: 'Your place: a boutique or home public slug.' } as const;
const EMPTY = { type: 'object', properties: {}, additionalProperties: false } as const;

export const worldAccountTools: ToolDef[] = [
  {
    name: 'unblock_world_user',
    description: 'Unblock somebody in Crossly World, by the block id from list_world_blocks.',
    inputSchema: { type: 'object', properties: { id: UUID('The block id.') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/world/blocks/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'cancel_world_job_shift',
    description: 'Cancel a Crossly World job shift you posted that nobody has worked yet.',
    inputSchema: { type: 'object', properties: { id: UUID('The shift.') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/world/jobs/shifts/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'claim_world_job_shift',
    description: 'Claim an open Crossly World job shift. You work it by being in the place while it runs.',
    inputSchema: { type: 'object', properties: { id: UUID('The shift.') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/jobs/shifts/${encodeURIComponent(id)}/claim`, {});
    },
  },
  {
    name: 'release_world_job_shift',
    description: 'Give a Crossly World job shift you claimed back to the board.',
    inputSchema: { type: 'object', properties: { id: UUID('The shift.') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/jobs/shifts/${encodeURIComponent(id)}/release`, {});
    },
  },
  {
    name: 'answer_world_price_check',
    description: 'Answer a Crossly World price check with your estimate of the item value. Moves no money; the asker may accept it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: UUID('The price check.'),
        valueCents: { type: 'integer', minimum: 0, description: 'Your estimate in CENTS.' },
        note: { type: ['string', 'null'], maxLength: 400, description: 'Why, optional.' },
      },
      required: ['id', 'valueCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, valueCents, note } = args as { id: string; valueCents: number; note?: string | null };
      return apiPost(`/v1/world/jobs/appraisals/${encodeURIComponent(id)}/answers`, { valueCents, note });
    },
  },
  {
    name: 'list_world_place_bans',
    description: 'Who is banned from a Crossly World place you own (your boutique or home).',
    inputSchema: { type: 'object', properties: { slug: SLUG }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/bans`, {});
    },
  },
  {
    name: 'unban_from_world_place',
    description: 'Lift a ban from a Crossly World place you own; they can walk in again right away.',
    inputSchema: { type: 'object', properties: { slug: SLUG, userId: UUID('The banned user.') }, required: ['slug', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { slug, userId } = args as { slug: string; userId: string };
      return apiDelete(`/v1/world/places/${encodeURIComponent(slug)}/bans/${encodeURIComponent(userId)}`);
    },
  },
  {
    name: 'get_world_identity',
    description: 'Whether others see your name in Crossly World (named) or not (anonymous); null if you never chose.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/avatar/identity', {}),
  },
  {
    name: 'set_world_identity',
    description: 'Choose named or anonymous in Crossly World. Rooms you are already in keep the old answer until you rejoin.',
    inputSchema: { type: 'object', properties: { choice: { type: 'string', enum: ['named', 'anonymous'], description: 'named or anonymous.' } }, required: ['choice'], additionalProperties: false },
    handler: (args) => apiPut('/v1/world/avatar/identity', args as Record<string, unknown>),
  },
  {
    name: 'get_world_look',
    description: 'Your Crossly World look on the account: the handle you chose (null if anonymous) and your appearance; null if you never made one.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/avatar/look', {}),
  },
  {
    name: 'set_world_look',
    description: 'Save your Crossly World look to the account so every device starts from it. look null stays anonymous.',
    inputSchema: { type: 'object', properties: { look: { type: ['object', 'null'], properties: { tone: { type: 'integer' }, role: { type: 'integer' } }, description: 'The handle: indexes into the tone and role lists, or null to stay anonymous.' }, appearance: { type: 'object', description: 'skin, hair, hairColour, eyes, build, brows, mouth, shape keys.' } }, required: ['look', 'appearance'], additionalProperties: false },
    handler: (args) => apiPut('/v1/world/avatar/look', args as Record<string, unknown>),
  },
  {
    name: 'share_world_fit_value',
    description: 'Whether people in a Crossly World room can see what your outfit is worth.',
    inputSchema: { type: 'object', properties: { share: { type: 'boolean', description: 'true to show it.' } }, required: ['share'], additionalProperties: false },
    handler: (args) => apiPut('/v1/world/fit-value/share', args as Record<string, unknown>),
  },
  {
    name: 'list_world_showable_items',
    description: 'The things you own that a Crossly World show-off emote can hold up.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/emotes/showable', {}),
  },
  {
    name: 'list_world_friends_here',
    description: 'Your friends in Crossly World right now, and where (when they share it).',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/friends/here', {}),
  },
  {
    name: 'list_my_world_trades',
    description: 'Your Crossly World trades and each item progress through the authentication gate.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/trades/mine', {}),
  },
];
