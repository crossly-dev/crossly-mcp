import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World parties: start one, invite friends, lead, a shared wishlist
 * with votes, and the party chat.
 */
export const worldPartyTools: ToolDef[] = [
  {
    name: 'start_world_party',
    description: "Start a Crossly World party with you as leader.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiPost(`/v1/world/parties`, {}),
  },
  {
    name: 'invite_to_world_party',
    description: "Invite a friend to your Crossly World party.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, userId: { type: 'string', format: 'uuid', description: 'The friend to invite.' } }, required: ['id', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/invite`, rest);
    },
  },
  {
    name: 'accept_world_party_invite',
    description: "Accept a Crossly World party invite.",
    inputSchema: { type: 'object', properties: { inviteId: { type: 'string', format: 'uuid', description: 'The invite.' } }, required: ['inviteId'], additionalProperties: false },
    handler: (args) => {
      const { inviteId } = args as { inviteId: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/invites/${encodeURIComponent(inviteId)}/accept`, {});
    },
  },
  {
    name: 'decline_world_party_invite',
    description: "Decline a Crossly World party invite.",
    inputSchema: { type: 'object', properties: { inviteId: { type: 'string', format: 'uuid', description: 'The invite.' } }, required: ['inviteId'], additionalProperties: false },
    handler: (args) => {
      const { inviteId } = args as { inviteId: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/invites/${encodeURIComponent(inviteId)}/decline`, {});
    },
  },
  {
    name: 'leave_world_party',
    description: "Leave your Crossly World party.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/leave`, {});
    },
  },
  {
    name: 'kick_from_world_party',
    description: "As leader, remove a member from your Crossly World party.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, userId: { type: 'string', format: 'uuid', description: 'The member.' } }, required: ['id', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/kick`, rest);
    },
  },
  {
    name: 'pass_world_party_lead',
    description: "As leader, pass the lead of your Crossly World party to a member.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, userId: { type: 'string', format: 'uuid', description: 'The new leader.' } }, required: ['id', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/leader`, rest);
    },
  },
  {
    name: 'add_to_world_party_wishlist',
    description: "Add a listing (id or shop slug) to your Crossly World party wishlist.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, listingId: { type: 'string', format: 'uuid', description: 'A listing id.' }, slug: { type: 'string', maxLength: 200, description: 'Or its shop slug.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/wishlist`, rest);
    },
  },
  {
    name: 'remove_from_world_party_wishlist',
    description: "Take a listing you added off your Crossly World party wishlist.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, listingId: { type: 'string', format: 'uuid', description: 'The listing.' } }, required: ['id', 'listingId'], additionalProperties: false },
    handler: (args) => {
      const { id, listingId } = args as { id: string; listingId: string } & Record<string, unknown>;
      return apiDelete(`/v1/world/parties/${encodeURIComponent(id)}/wishlist/${encodeURIComponent(listingId)}`);
    },
  },
  {
    name: 'vote_on_world_party_wish',
    description: "Thumb a Crossly World party wishlist listing up or down (null clears).",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, listingId: { type: 'string', format: 'uuid', description: 'The listing.' }, vote: { type: ['string', 'null'], enum: ['up', 'down', null], description: 'up, down, or null to clear.' } }, required: ['id', 'listingId', 'vote'], additionalProperties: false },
    handler: (args) => {
      const { id, listingId, ...rest } = args as { id: string; listingId: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/wishlist/${encodeURIComponent(listingId)}/vote`, rest);
    },
  },
  {
    name: 'get_world_party_chat',
    description: "Your Crossly World party chat: the recent lines.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string } & Record<string, unknown>;
      return apiGet(`/v1/world/parties/${encodeURIComponent(id)}/chat`, {});
    },
  },
  {
    name: 'say_in_world_party',
    description: "Say something in your Crossly World party chat.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid', description: 'Your party.' }, text: { type: 'string', minLength: 1, maxLength: 2000, description: 'What to say.' } }, required: ['id', 'text'], additionalProperties: false },
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/parties/${encodeURIComponent(id)}/chat`, rest);
    },
  },
];
