import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * NFTs across Crossly (api routes/v1/write/web3-world-live.ts): holders-only
 * Spaces and rooms, the NFT on your nameplate, a launch pinned on your live
 * show, following a launch creator.
 */
const GATE = {
  type: 'object',
  description: 'The collection whose holders may join: { chain, contract }. Omit (or send null) to open it to everyone again.',
  properties: {
    chain: { type: 'string', description: 'Chain of the collection, e.g. ethereum, base or solana.' },
    contract: { type: 'string', description: 'The collection contract (Solana: the collection address).' },
  },
} as const;
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;

export const web3WorldLiveTools: ToolDef[] = [
  {
    name: 'set_world_space_holder_gate',
    description: 'Make your Space holders-only: only holders of an NFT collection join it (others can look in but are not seen). Leave out gate to open it again.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'Your Space slug.' }, gate: GATE }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, gate } = args as { slug: string; gate?: unknown };
      return apiPut(`/v1/world/spaces/${encodeURIComponent(slug)}/holder-gate`, gate ?? null);
    },
  },
  {
    name: 'set_world_room_holder_gate',
    description: 'Make your room holders-only (its collection rooms follow). Leave out gate to open it again.',
    inputSchema: { type: 'object', properties: { id: ID('Room'), gate: GATE }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id, gate } = args as { id: string; gate?: unknown };
      return apiPut(`/v1/world/rooms/${encodeURIComponent(id)}/holder-gate`, gate ?? null);
    },
  },
  {
    name: 'get_world_nft_badge',
    description: 'The NFT you wear on your nameplate in the world, or null.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/avatar/nft-badge', {}),
  },
  {
    name: 'set_world_nft_badge',
    description: 'Wear an NFT you hold (in a verified, synced wallet) on your nameplate. Leave out every field to take it off.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', description: 'Chain of the NFT.' },
        contract: { type: 'string', description: 'Its contract (Solana: its collection).' },
        tokenId: { type: 'string', description: 'Its token id (Solana: its mint).' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const a = args as { chain?: string; contract?: string; tokenId?: string };
      return apiPut('/v1/world/avatar/nft-badge', a.chain && a.contract && a.tokenId ? a : null);
    },
  },
  {
    name: 'pin_launch_on_live_stream',
    description: 'Pin one of your live NFT launches on your live show; viewers mint it from the stream.',
    inputSchema: { type: 'object', properties: { id: ID('Live stream'), launchId: ID('Launch') }, required: ['id', 'launchId'], additionalProperties: false },
    handler: (args) => {
      const { id, launchId } = args as { id: string; launchId: string };
      return apiPost(`/v1/live-streams/${encodeURIComponent(id)}/pin-launch`, { launchId });
    },
  },
  {
    name: 'unpin_launch_on_live_stream',
    description: 'Unpin the launch from your live show.',
    inputSchema: { type: 'object', properties: { id: ID('Live stream') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/live-streams/${encodeURIComponent(id)}/pin-launch`);
    },
  },
  {
    name: 'follow_launch_creator',
    description: "Follow a launch's creator: their launches are announced to you, and again when each opens to mint.",
    inputSchema: { type: 'object', properties: { id: ID('Launch') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/web3/launches/${encodeURIComponent(id)}/follow-creator`, {});
    },
  },
  {
    name: 'unfollow_launch_creator',
    description: "Stop following a launch's creator.",
    inputSchema: { type: 'object', properties: { id: ID('Launch') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/web3/launches/${encodeURIComponent(id)}/follow-creator`);
    },
  },
];
