import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Drops and lines in Crossly World -- a limited release with a line outside
 * the shop door and a provably fair draw instead of a click race. The line
 * opens with a published sha256 commitment to a secret seed; at release the
 * seed and the draw order are revealed so anybody can recompute them; the
 * winners get a 15-minute checkout hold on crossly.net, and a lapsed hold
 * passes to the next entry in draw order.
 */
const ID = { type: 'string', description: 'Drop id.' } as const;
const WHEN = { type: 'string', description: 'ISO 8601 date-time with offset.' } as const;

export const dropsTools: ToolDef[] = [
  {
    name: 'get_drop',
    description:
      'One drop: listings, units, times, who may join, the sha256 seed commitment and how many are in line. After release ' +
      'also the revealed seed, the sorted entry ids and the draw order -- recompute with drawWinners(seed, dropId, entryIds, units).',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/drops/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'list_street_drops',
    description: 'Upcoming, open and just-released drops on a Crossly World street (e.g. main-street), one per shop, soonest first.',
    inputSchema: {
      type: 'object',
      properties: { street: { type: 'string', description: 'Street slug, e.g. main-street.' } },
      required: ['street'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { street } = args as { street: string };
      return apiGet(`/v1/streets/${encodeURIComponent(street)}/drops`, {});
    },
  },
  {
    name: 'list_my_drops',
    description: 'Your drops, latest release first, with entries, winners, claims, the waitlist and expired holds.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/drops/mine', {}),
  },
  {
    name: 'create_drop',
    description:
      'Set up a drop of your own live Crossly listings: units (how many can be won) is at most their combined stock. The line ' +
      'opens at opensLineAt (5 minutes to 72 hours before releaseAt). Until the drop closes those listings sell only to its winners.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 80, description: 'What the drop is called.' },
        listingIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10, description: 'Your live Crossly listing ids.' },
        units: { type: 'integer', minimum: 1, maximum: 500, description: 'How many can be won.' },
        opensLineAt: WHEN,
        releaseAt: WHEN,
        eligibility: { type: 'string', enum: ['signed_in', 'verified'], description: 'signed_in = anyone signed in; verified = buyers with a Crossly purchase.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['title', 'listingIds', 'units', 'opensLineAt', 'releaseAt'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/drops', body, idempotencyKey);
    },
  },
  {
    name: 'update_drop',
    description: 'Change a drop before its line opens: any of title, listingIds, units, opensLineAt, releaseAt, eligibility.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID,
        title: { type: 'string', maxLength: 80, description: 'What the drop is called.' },
        listingIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10, description: 'Your live Crossly listing ids.' },
        units: { type: 'integer', minimum: 1, maximum: 500, description: 'How many can be won.' },
        opensLineAt: WHEN,
        releaseAt: WHEN,
        eligibility: { type: 'string', enum: ['signed_in', 'verified'], description: 'Who may join.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as Record<string, unknown> & { id: string };
      return apiPatch(`/v1/drops/${encodeURIComponent(id)}`, body);
    },
  },
  {
    name: 'cancel_drop',
    description: 'Call a drop off before its line opens. Refused once the line is open.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/drops/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'join_drop',
    description: 'Join a drop\'s line while it is open, as a buyer: one entry per account, the same odds as joining in the world. Repeating it returns the same entry.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/buyer/drops/${encodeURIComponent(id)}/join`, {});
    },
  },
  {
    name: 'leave_drop',
    description: 'Leave a drop\'s line before the draw.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/buyer/drops/${encodeURIComponent(id)}/join`);
    },
  },
  {
    name: 'get_my_drop_entry',
    description: 'Your entry in a drop: in line or not, draw rank and outcome (won / waitlist / expired / claimed), and the crossly.net checkout path while your 15-minute hold is live.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/buyer/drops/${encodeURIComponent(id)}/me`, {});
    },
  },
];
