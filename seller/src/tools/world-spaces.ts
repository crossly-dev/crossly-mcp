import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World Spaces: seller-hosted clubs with a venue, members and events.
 * Nothing here takes money.
 */
export const worldSpaceTools: ToolDef[] = [
  {
    name: 'list_world_spaces_directory',
    description: "The Crossly World Spaces directory: seller-hosted clubs with a venue, members and events.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/spaces`, {}),
  },
  {
    name: 'list_world_spaces_whats_on',
    description: "Live and upcoming events across Crossly World Spaces.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/spaces/whats-on`, {}),
  },
  {
    name: 'list_my_world_spaces',
    description: "Crossly World Spaces you belong to.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/spaces/mine`, {}),
  },
  {
    name: 'can_host_world_space',
    description: "Whether you may open a Crossly World Space: sellers only, at most two.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/spaces/can-host`, {}),
  },
  {
    name: 'get_world_space',
    description: "One Crossly World Space: layout, host, events and your place in it.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiGet(`/v1/world/spaces/${encodeURIComponent(slug)}`, {});
    },
  },
  {
    name: 'open_world_space',
    description: "Open a Crossly World Space (sellers only, at most two).",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', maxLength: 48, description: 'Its url slug.' }, name: { type: 'string', maxLength: 60, description: 'Its name.' }, venue: { type: 'string', description: 'The venue kind.' }, membership: { type: 'string', description: 'open, request or invite, optional.' }, about: { type: 'string', maxLength: 500, description: 'About it, optional.' } }, required: ['slug', 'name', 'venue'], additionalProperties: false },
    handler: (args) => {
      const { ...rest } = args as Record<string, unknown>;
      return apiPost(`/v1/world/spaces`, rest);
    },
  },
  {
    name: 'update_world_space',
    description: "As host, change a Crossly World Space name, about or membership.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, name: { type: 'string', maxLength: 60, description: 'New name.' }, about: { type: 'string', maxLength: 500, description: 'New about.' }, membership: { type: 'string', description: 'open, request or invite.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPatch(`/v1/world/spaces/${encodeURIComponent(slug)}`, rest);
    },
  },
  {
    name: 'close_world_space',
    description: "As host, close a Crossly World Space.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiDelete(`/v1/world/spaces/${encodeURIComponent(slug)}`);
    },
  },
  {
    name: 'join_world_space',
    description: "Join a Crossly World Space, or ask to when it is request-only.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/join`, {});
    },
  },
  {
    name: 'leave_world_space',
    description: "Leave a Crossly World Space.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/leave`, {});
    },
  },
  {
    name: 'list_world_space_requests',
    description: "As host or co-host, who asked to join a Crossly World Space.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiGet(`/v1/world/spaces/${encodeURIComponent(slug)}/requests`, {});
    },
  },
  {
    name: 'answer_world_space_request',
    description: "As host or co-host, accept or turn down a request to join a Crossly World Space.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, userId: { type: 'string', format: 'uuid', description: 'Who asked.' }, accept: { type: 'boolean', description: 'true to let them in.' } }, required: ['slug', 'userId', 'accept'], additionalProperties: false },
    handler: (args) => {
      const { slug, userId, ...rest } = args as { slug: string; userId: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/requests/${encodeURIComponent(userId)}`, rest);
    },
  },
  {
    name: 'invite_to_world_space',
    description: "Invite somebody to a Crossly World Space.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, userId: { type: 'string', format: 'uuid', description: 'Who to invite.' } }, required: ['slug', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/invite`, rest);
    },
  },
  {
    name: 'set_world_space_role',
    description: "As host, make a Crossly World Space member a co-host, or back to a member.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, userId: { type: 'string', format: 'uuid', description: 'The member.' }, role: { type: 'string', enum: ['cohost', 'member'], description: 'cohost or member.' } }, required: ['slug', 'userId', 'role'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/role`, rest);
    },
  },
  {
    name: 'add_world_space_event',
    description: "As host or co-host, put an event on in a Crossly World Space.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, title: { type: 'string', maxLength: 80, description: 'The event title.' }, kind: { type: 'string', description: 'The event kind.' }, about: { type: 'string', maxLength: 500, description: 'About it, optional.' }, startsAt: { type: 'string', description: 'ISO start with offset.' }, endsAt: { type: 'string', description: 'ISO end with offset.' }, clubOnly: { type: 'boolean', description: 'For your loyalty club members only: off the public board, members RSVP.' } }, required: ['slug', 'title', 'kind', 'startsAt', 'endsAt'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/events`, rest);
    },
  },
  {
    name: 'cancel_world_space_event',
    description: "As host or co-host, cancel a Crossly World Space event.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, id: { type: 'string', format: 'uuid', description: 'The event.' } }, required: ['slug', 'id'], additionalProperties: false },
    handler: (args) => {
      const { slug, id } = args as { slug: string; id: string } & Record<string, unknown>;
      return apiDelete(`/v1/world/spaces/${encodeURIComponent(slug)}/events/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'rsvp_world_space_event',
    description: "Say whether you are going to a Crossly World Space event.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 48, description: 'The Space slug.' }, id: { type: 'string', format: 'uuid', description: 'The event.' }, going: { type: 'boolean', description: 'true if you are going.' } }, required: ['slug', 'id', 'going'], additionalProperties: false },
    handler: (args) => {
      const { slug, id, ...rest } = args as { slug: string; id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/spaces/${encodeURIComponent(slug)}/events/${encodeURIComponent(id)}/rsvp`, rest);
    },
  },
];
