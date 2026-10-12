import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World streets, street and stall decor, leases, neighbourhoods, room
 * attention, the room catalogue, and "I would buy this". Listing on the decor
 * market charges a COSM fee and stays on crossly.net.
 */
export const worldStreetTools: ToolDef[] = [
  {
    name: 'withdraw_world_street_request',
    description: "Withdraw a Crossly World street request you made that has not been founded yet.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The street request.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string } & Record<string, unknown>;
      return apiDelete(`/v1/spatial/streets/requests/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'set_world_street_admission',
    description: "Who may open a shop on a Crossly World street you own: open, apply or invite.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your street.' }, admission: { type: 'string', maxLength: 20, description: 'open, apply or invite.' } }, required: ['id', 'admission'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPatch(`/v1/spatial/streets/owned/${encodeURIComponent(id)}`, rest);
    },
  },
  {
    name: 'list_world_street_admissions',
    description: "Crossly World street applications and invitations: yours, and those waiting on streets you own.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/spatial/streets/admissions`, {}),
  },
  {
    name: 'apply_to_world_street',
    description: "Ask to open your shop on a Crossly World street whose owner reviews applications.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 3, maxLength: 40, description: 'The street slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/streets/${encodeURIComponent(slug)}/apply`, {});
    },
  },
  {
    name: 'invite_to_world_street',
    description: "Invite a shop (by its slug) to open on a Crossly World street you own.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 3, maxLength: 40, description: 'The street slug.' }, shopSlug: { type: 'string', minLength: 1, maxLength: 64, description: 'The shop to invite.' } }, required: ['slug', 'shopSlug'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/streets/${encodeURIComponent(slug)}/invite`, rest);
    },
  },
  {
    name: 'list_world_street_leases',
    description: "Plots on a Crossly World street offered for lease, with weekly rent in CENTS.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 3, maxLength: 40, description: 'The street slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiGet(`/v1/spatial/streets/${encodeURIComponent(slug)}/leases`, {});
    },
  },
  {
    name: 'get_world_street_decor',
    description: "The decor on a Crossly World street you may dress, and what you can place.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 3, maxLength: 40, description: 'The street slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string } & Record<string, unknown>;
      return apiGet(`/v1/spatial/streets/${encodeURIComponent(slug)}/decor`, {});
    },
  },
  {
    name: 'set_world_street_decor',
    description: "Dress a Crossly World street you own with decor you hold.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 3, maxLength: 40, description: 'The street slug.' }, decor: { type: 'object', additionalProperties: true, description: 'The street decor to set (keys to values you hold).' } }, required: ['slug', 'decor'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPut(`/v1/spatial/streets/${encodeURIComponent(slug)}/decor`, rest.decor);
    },
  },
  {
    name: 'withdraw_world_lease_offer',
    description: "Withdraw a Crossly World plot lease offer nobody has accepted yet.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'The lease offer.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/property/leases/${encodeURIComponent(id)}/withdraw`, {});
    },
  },
  {
    name: 'list_world_decoratable_streets',
    description: "Crossly World streets you may dress.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/decor/streets`, {}),
  },
  {
    name: 'list_world_stalls_to_dress',
    description: "Your Crossly World stall bookings, to dress their booths.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/decor/stalls`, {}),
  },
  {
    name: 'dress_world_stall_booth',
    description: "Dress the booth of a Crossly World stall you booked, with decor you hold.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your stall booking.' }, booth: { type: 'object', additionalProperties: true, description: 'The booth dressing (decor you hold).' } }, required: ['id', 'booth'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPut(`/v1/world/stalls/bookings/${encodeURIComponent(id)}/booth`, rest.booth);
    },
  },
  {
    name: 'retract_world_decor',
    description: "Take a placed Crossly World decor piece back into your inventory.",
    inputSchema: { type: 'object', properties: { space: { type: 'object', additionalProperties: true, description: 'Where it stands: { kind, id }.' }, key: { type: 'string', maxLength: 64, description: 'The decor key.' }, value: { type: 'string', maxLength: 128, description: 'The decor value.' } }, required: ['space', 'key', 'value'], additionalProperties: false },
    handler: (args) => {
      const { ...rest } = args as Record<string, unknown>;
      return apiPost(`/v1/world/decor/retract`, rest);
    },
  },
  {
    name: 'list_world_decor_market',
    description: "Crossly World decor copies other people are reselling, asks in COSM. Read only.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/decor/market`, {}),
  },
  {
    name: 'get_world_shop_neighbourhood',
    description: "Your Crossly World shop's neighbourhood, and whether and where it may move.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/spatial/shop/neighbourhood`, {}),
  },
  {
    name: 'move_world_shop',
    description: "Move your Crossly World shop to another neighbourhood.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', maxLength: 40, description: 'The neighbourhood to move to.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { ...rest } = args as Record<string, unknown>;
      return apiPost(`/v1/spatial/shop/neighbourhood`, rest);
    },
  },
  {
    name: 'get_world_room_attention',
    description: "What visitors looked at in one of your Crossly World rooms: viewers, looks, inspects and dwell per item.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room.' } }, required: ['sceneId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId } = args as { sceneId: string } & Record<string, unknown>;
      return apiGet(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/attention`, {});
    },
  },
  {
    name: 'list_world_spaces',
    description: "The Crossly World room catalogue: every space profile and the warehouse units.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/spatial/spaces`, {}),
  },
  {
    name: 'want_world_item',
    description: "Tell a Crossly World room owner you would buy one of their items. Moves no money.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 64, description: 'The room public slug.' }, itemId: { type: 'string', format: 'uuid', description: 'The item.' } }, required: ['slug', 'itemId'], additionalProperties: false },
    handler: (args) => {
      const { slug, itemId } = args as { slug: string; itemId: string } & Record<string, unknown>;
      return apiPost(`/v1/world/places/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}/want`, {});
    },
  },
];
