import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets in the world and the creator programme (api
 * routes/v1/write/vault-markets-world.ts): Market Open events in the
 * Crossly World Commons, the Vault Holders Lounge, verified creators vault
 * shelf rooms, and the creator programme (a creator code earns a capped share
 * of the fee Crossly keeps, paid by Crossly, never by the trader).
 * Round 7: vault-holder doors on your own rooms and Spaces, and Market Open
 * launch shows a verified creator co-hosts (and a creator answering an invite).
 */
export const vaultMarketsWorldTools: ToolDef[] = [
  {
    name: 'list_vault_markets_world_events',
    description: 'Market Open events in the Crossly World Commons: Vault Markets keys opening soon and those that opened in the last few hours. phase is "scheduled", "soon" (within the hour) or "live"; line is the board text; unitsOnShelf and dealersQuoting are counts; show is the launch live show when there is one. Live first, then soonest.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/world/market-open', {}),
  },
  {
    name: 'get_vault_markets_holders_lounge',
    description: 'The Vault Holders Lounge in Crossly World: the rule to join (minValueCents held at reliable marks, in cents of US dollars, or minUnits units in the vault), whether you may join now (allowed, by "value" or "units") and what you hold toward it. Anyone may look in; only holders are seen and can talk there. It has no perks and nothing to trade.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/world/lounge', {}),
  },
  {
    name: 'list_vault_markets_creator_rooms',
    description: 'Verified creators whose public vault shelf is a Crossly World room: title, the creator, worldHref (the room link) and the disclosure. A room shows each market share of the shelf, never amounts or unit counts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/world/creator-rooms', {}),
  },
  {
    name: 'get_vault_markets_creator_programme',
    description: 'The Vault Markets creator programme terms: shareBps (the creator share of the fee Crossly keeps on an attributed trader side, in basis points), perTradeCapCents and lifetimeCapCents (cents of US dollars), attributionDays, floorBps (the 2% net floor it is paid under), newTradersOnly, and the disclosure words a creator must use.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/creators/programme', {}),
  },
  {
    name: 'get_my_vault_markets_creator',
    description: 'The creator who brought you to Vault Markets, if one did: creator name, source ("link" or "code"), when it started and ends, live (still earning) and the disclosure. Your prices and fees are the same either way.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/creators/attribution', {}),
  },
  {
    name: 'use_vault_markets_creator_code',
    description: 'Use a creator code on Vault Markets: the creator then earns a capped share of the fee Crossly keeps on your trades for a limited window, paid by Crossly and never by you. Only for people new to Vault Markets, only once, and never your own code. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The creator code, as the creator shared it (up to 40 characters).' },
      },
      required: ['code'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { code } = args as { code: string };
      return apiPost('/v1/vault-markets/creators/attribution', { code });
    },
  },
  {
    name: 'get_vault_markets_creator_dashboard',
    description: 'For creators: whether you joined the Vault Markets creator programme, each of your codes with tradersAttributed and tradersEarning (counts only, never who), earnings accruedCents, paidCents and voidCents (cents of US dollars, paid as Crossly Bucks once each sale is final) and the latest shares.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/creators/dashboard', {}),
  },
  {
    name: 'get_my_vault_markets_creator_room',
    description: 'For creators: your vault shelf room in Crossly World (status "applied", "verified", "rejected" or "paused", with any operations note) and whether your public vault profile is on, which the room needs. Apply or edit it in the Crossly dashboard (Hub, Creator vault).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/creators/room', {}),
  },
  {
    name: 'get_vault_markets_place_vault_gate',
    description: 'The vault-holder door on a Crossly World room or Space: the rule (minValueCents held at reliable marks, in cents of US dollars, and/or minUnits, mode "any" or "all", optionally one product, bullion family or category), the rule in words, and whether you may join now with what you hold toward it. gate is null when the place has none. Anyone may look in; only holders are seen and can talk there.',
    inputSchema: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'The place presence slug: a room share slug, or "space-" followed by the Space slug.' },
      },
      required: ['place'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { place } = args as { place: string };
      return apiGet(`/v1/vault-markets/world/places/${encodeURIComponent(place)}/vault-gate`, {});
    },
  },
  {
    name: 'set_vault_markets_room_vault_gate',
    description: 'Put a vault-holder door on one of your own Crossly World rooms (its collection rooms follow), or remove it with clear. Visitors may still look in; only people holding enough in the Crossly vault are seen and can talk. Moves no money. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Your room id (a UUID).' },
        minValueCents: { type: ['integer', 'null'], description: 'Value a visitor must hold in the Crossly vault at reliable (A/B) marks, in cents of US dollars (100 to 100000000). Null or omitted for no value threshold.' },
        minUnits: { type: ['integer', 'null'], description: 'Units a visitor must hold in the vault (1 to 10000). Null or omitted for no unit threshold.' },
        mode: { type: 'string', enum: ['any', 'all'], description: 'How the two thresholds combine when both are set: "any" (either opens the door) or "all" (both are needed). Default "any".' },
        scope: {
          type: ['object', 'null'],
          description: 'Count only some holdings, or null for the whole vault.',
          properties: {
            kind: { type: 'string', enum: ['product', 'bullion', 'category'], description: 'What to count: "product" (one catalogue product, every size, condition and grade), "bullion" (one bullion key family) or "category" (one catalogue category).' },
            ref: { type: 'string', description: 'For "product" the catalogue product id, for "bullion" the family slug, for "category" the category slug.' },
          },
          required: ['kind', 'ref'],
          additionalProperties: false,
        },
        clear: { type: 'boolean', description: 'True to remove the door and open the place to everyone again (the other fields are then ignored).' },
      },
      required: ['roomId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { roomId, clear, ...gate } = args as { roomId: string; clear?: boolean; minValueCents?: number | null; minUnits?: number | null; mode?: string; scope?: unknown };
      return apiPut(`/v1/vault-markets/world/rooms/${encodeURIComponent(roomId)}/vault-gate`, clear ? null : gate);
    },
  },
  {
    name: 'set_vault_markets_space_vault_gate',
    description: 'Put a vault-holder door on a Crossly World Space you host, or remove it with clear. Visitors may still look in; only people holding enough in the Crossly vault are seen and can talk. Moves no money. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The Space slug (without the "space-" prefix).' },
        minValueCents: { type: ['integer', 'null'], description: 'Value a visitor must hold in the Crossly vault at reliable (A/B) marks, in cents of US dollars (100 to 100000000). Null or omitted for no value threshold.' },
        minUnits: { type: ['integer', 'null'], description: 'Units a visitor must hold in the vault (1 to 10000). Null or omitted for no unit threshold.' },
        mode: { type: 'string', enum: ['any', 'all'], description: 'How the two thresholds combine when both are set: "any" (either opens the door) or "all" (both are needed). Default "any".' },
        scope: {
          type: ['object', 'null'],
          description: 'Count only some holdings, or null for the whole vault.',
          properties: {
            kind: { type: 'string', enum: ['product', 'bullion', 'category'], description: 'What to count: "product" (one catalogue product, every size, condition and grade), "bullion" (one bullion key family) or "category" (one catalogue category).' },
            ref: { type: 'string', description: 'For "product" the catalogue product id, for "bullion" the family slug, for "category" the category slug.' },
          },
          required: ['kind', 'ref'],
          additionalProperties: false,
        },
        clear: { type: 'boolean', description: 'True to remove the door and open the place to everyone again (the other fields are then ignored).' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, clear, ...gate } = args as { slug: string; clear?: boolean; minValueCents?: number | null; minUnits?: number | null; mode?: string; scope?: unknown };
      return apiPut(`/v1/vault-markets/world/spaces/${encodeURIComponent(slug)}/vault-gate`, clear ? null : gate);
    },
  },
  {
    name: 'list_vault_markets_cohosted_shows',
    description: 'Market Open launch shows a verified creator co-hosts that are on now or opening soon: the key title, phase ("scheduled", "soon" or "live"), the live show, the creator, their room link (roomWorldHref) and, when the creator is in the creator programme, the disclosure that they may earn a share of the fee Crossly keeps. Never a prompt to trade.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/world/cohosts', {}),
  },
  {
    name: 'list_my_vault_markets_cohost_invites',
    description: 'For creators: your invites from Crossly to co-host a Market Open launch show, each with its status ("invited", "accepted", "declined" or "withdrawn"), the key, its live show, whether you are on the show (onShow) and the guidance for co-hosts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/creators/cohost-invites', {}),
  },
  {
    name: 'respond_vault_markets_cohost_invite',
    description: 'For creators: accept or decline an invite to co-host a Market Open launch show. Accepting needs your vault room verified, adds you to the live show as a co-host, and makes your room and the Commons say you co-host it (with the creator programme disclosure when it applies). Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        inviteId: { type: 'string', description: 'The invite id from list_my_vault_markets_cohost_invites.' },
        accept: { type: 'boolean', description: 'True to accept and co-host, false to decline.' },
      },
      required: ['inviteId', 'accept'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { inviteId, accept } = args as { inviteId: string; accept: boolean };
      return apiPost(`/v1/vault-markets/creators/cohost-invites/${encodeURIComponent(inviteId)}/respond`, { accept });
    },
  },
];
