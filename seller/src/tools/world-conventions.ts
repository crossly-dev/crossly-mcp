import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World conventions: host one in your room, apply or be invited for
 * a table, accept, leave. Sellers are named by shop handle; a table fee is
 * settled off-platform and only recorded here.
 */
const EMPTY = { type: 'object', properties: {}, additionalProperties: false } as const;

export const worldConventionTools: ToolDef[] = [
  {
    name: 'create_world_convention',
    description: 'Host a Crossly World convention in one of your rooms: title, ISO start and end, tables, and how sellers get one (invite, free, fee in cents, or revenue share in basis points).',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', format: 'uuid', description: 'Your room that hosts it.' },
        title: { type: 'string', minLength: 2, maxLength: 120, description: 'Its name.' },
        startsAt: { type: 'string', description: 'ISO start time.' },
        endsAt: { type: 'string', description: 'ISO end time.' },
        entryModel: { type: 'string', enum: ['invite', 'free', 'fee', 'revenue_share'], description: 'How sellers get a table.' },
        entryFeeCents: { type: 'integer', minimum: 0, description: 'The table fee in CENTS, for entryModel fee.' },
        revenueShareBps: { type: 'integer', minimum: 0, description: 'The share, for entryModel revenue_share.' },
        tableCount: { type: 'integer', minimum: 1, maximum: 500, description: 'How many tables.' },
      },
      required: ['sceneId', 'title', 'startsAt', 'endsAt', 'entryModel'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/world/conventions', args as Record<string, unknown>),
  },
  {
    name: 'set_world_convention_status',
    description: 'Open, start, end or cancel a Crossly World convention you host.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'The convention.' },
        status: { type: 'string', enum: ['open', 'live', 'ended', 'cancelled'], description: 'The new status.' },
      },
      required: ['id', 'status'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, status } = args as { id: string; status: string };
      return apiPut(`/v1/world/conventions/${encodeURIComponent(id)}/status`, { status });
    },
  },
  {
    name: 'list_world_conventions',
    description: 'Crossly World conventions open to sellers now or soon, and how to get a table.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/conventions', {}),
  },
  {
    name: 'list_my_world_conventions',
    description: 'Crossly World conventions you host or exhibit at.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/conventions/mine', {}),
  },
  {
    name: 'get_world_convention',
    description: 'One Crossly World convention.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/conventions/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'list_world_convention_exhibitors',
    description: 'The roster of a convention you host: who applied, was invited or is coming, by shop handle.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/conventions/${encodeURIComponent(id)}/exhibitors`, {});
    },
  },
  {
    name: 'apply_to_world_convention',
    description: 'Ask for a table at a Crossly World convention.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/conventions/${encodeURIComponent(id)}/apply`, {});
    },
  },
  {
    name: 'invite_to_world_convention',
    description: 'Invite a seller by shop handle to a convention you host.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' }, username: { type: 'string', maxLength: 64, description: 'A seller shop handle.' } }, required: ['id', 'username'], additionalProperties: false },
    handler: (args) => {
      const { id, username } = args as { id: string; username: string };
      return apiPost(`/v1/world/conventions/${encodeURIComponent(id)}/invite`, { username });
    },
  },
  {
    name: 'accept_world_convention',
    description: 'As host, accept a seller application by shop handle.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' }, username: { type: 'string', maxLength: 64, description: 'A seller shop handle.' } }, required: ['id', 'username'], additionalProperties: false },
    handler: (args) => {
      const { id, username } = args as { id: string; username: string };
      return apiPost(`/v1/world/conventions/${encodeURIComponent(id)}/accept`, { username });
    },
  },
  {
    name: 'leave_world_convention',
    description: 'Withdraw your table at a Crossly World convention.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/conventions/${encodeURIComponent(id)}/withdraw`, {});
    },
  },
  {
    name: 'mark_world_convention_paid',
    description: 'As host, record that a seller (shop handle) paid their table fee off-platform. Moves no money.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The convention.' }, username: { type: 'string', maxLength: 64, description: 'A seller shop handle.' } }, required: ['id', 'username'], additionalProperties: false },
    handler: (args) => {
      const { id, username } = args as { id: string; username: string };
      return apiPost(`/v1/world/conventions/${encodeURIComponent(id)}/paid`, { username });
    },
  },
];
