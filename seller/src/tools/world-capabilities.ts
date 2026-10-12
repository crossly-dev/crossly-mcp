import { apiDelete, apiGet, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * NFT capabilities in Crossly World (docs/NFT-CAPABILITIES.md, spec
 * crossly.nft-capabilities/1): what a collection's tokens can DO in the world,
 * declared once per collection. Reads need inventory:read; declaring needs
 * world:create. Nothing here moves money.
 */
const CHAIN_ARG = { type: 'string', enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'solana'], description: 'The chain the collection is on.' } as const;
const CONTRACT_ARG = { type: 'string', pattern: '^[0-9A-Za-z]{20,64}$', description: 'The collection: an EVM contract address (0x...) or a Solana collection address.' } as const;

export const worldCapabilityTools: ToolDef[] = [
  {
    name: 'get_my_world_capabilities',
    description: 'What your held NFTs unlock in Crossly World: each token with the capabilities its collection declared (wear, display, emote, gate, game pass, ...).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/capabilities', {}),
  },
  {
    name: 'get_world_capability_catalogue',
    description: 'The NFT capability kinds Crossly World supports: what each does, whether only the collection creator may declare it, whether it is reviewed, and which clients honour it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/capabilities/catalogue', {}),
  },
  {
    name: 'get_collection_world_capabilities',
    description: "A collection's live capability declaration: what its tokens can do in Crossly World.",
    inputSchema: { type: 'object', properties: { chain: CHAIN_ARG, contract: CONTRACT_ARG }, required: ['chain', 'contract'], additionalProperties: false },
    handler: (args) => {
      const a = args as { chain: string; contract: string };
      return apiGet(`/v1/world/collections/${encodeURIComponent(a.chain)}/${encodeURIComponent(a.contract)}/capabilities`, {});
    },
  },
  {
    name: 'list_my_world_capability_declarations',
    description: 'Your NFT capability declarations in every review state (pending, live, rejected with the reviewer note).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/capabilities/declarations', {}),
  },
  {
    name: 'declare_collection_world_capabilities',
    description: "Declare what a collection's tokens can do in Crossly World. Pass the whole declaration (spec crossly.nft-capabilities/1). As its creator (launched on Crossly or claimed) any kind; as a holder, cosmetic kinds only. Replaces your previous declaration; it waits for review if it names an uploaded asset or an always-reviewed kind. Call get_world_capability_catalogue first for the kinds and their params.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_ARG,
        contract: CONTRACT_ARG,
        declaration: {
          type: 'object',
          description: '{ spec: "crossly.nft-capabilities/1", collection: { chain, address }, name?, capabilities: [{ kind, match: { all: true } | { tokenIds: [...] } | { trait: { key, value } }, params }] }',
        },
      },
      required: ['chain', 'contract', 'declaration'],
      additionalProperties: false,
    },
    handler: (args) => {
      const a = args as { chain: string; contract: string; declaration: Record<string, unknown> };
      return apiPut(`/v1/world/collections/${encodeURIComponent(a.chain)}/${encodeURIComponent(a.contract)}/capabilities`, a.declaration);
    },
  },
  {
    name: 'set_listing_holders_only',
    description: 'Reserve one of your listings for holders of a collection you declared a holders_only perk for, or release it. Checkout refuses anybody else.',
    inputSchema: { type: 'object', properties: { listingId: { type: 'string', format: 'uuid', description: 'Your listing.' }, enabled: { type: 'boolean', description: 'true = holders only.' } }, required: ['listingId', 'enabled'], additionalProperties: false },
    handler: (args) => {
      const a = args as { listingId: string; enabled: boolean };
      return apiPut(`/v1/world/listings/${encodeURIComponent(a.listingId)}/holders-only`, { enabled: a.enabled });
    },
  },
  {
    name: 'get_my_nft_wear',
    description: 'What you wear from your NFTs and COSM copies: your pick per avatar slot and what the room sees.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/capabilities/wear', {}),
  },
  {
    name: 'set_my_nft_wear',
    description: 'Wear a held token on an avatar slot (head, body, legs, feet, back) -- refId from get_my_world_capabilities -- or pass refId null to take it off. Its collection must declare a wear capability for that slot.',
    inputSchema: { type: 'object', properties: { slot: { type: 'string', enum: ['head', 'body', 'legs', 'feet', 'back'], description: 'Where on the avatar it is worn: head, body (torso), legs, feet or back.' }, refId: { type: ['string', 'null'], description: 'The holding to wear, or null.' } }, required: ['slot', 'refId'], additionalProperties: false },
    handler: (args) => apiPut('/v1/world/capabilities/wear', args as Record<string, unknown>),
  },
  {
    name: 'list_my_cosm_designs_in_world',
    description: 'Your COSM designs in the world: popularity toward the free chain unlock a popular limited design earns, whether each is on chain, and your opt-out. Declare what a design does with chain "cosm" and the design id as the contract.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/cosm/designs', {}),
  },
  {
    name: 'set_cosm_design_auto_chain_unlock',
    description: 'Opt one of your COSM designs in or out of the free chain unlock it earns when popular (on by default).',
    inputSchema: { type: 'object', properties: { cosmeticId: { type: 'string', format: 'uuid', description: 'Your design.' }, enabled: { type: 'boolean', description: 'true = unlock automatically when popular.' } }, required: ['cosmeticId', 'enabled'], additionalProperties: false },
    handler: (args) => {
      const a = args as { cosmeticId: string; enabled: boolean };
      return apiPut(`/v1/world/cosm/designs/${encodeURIComponent(a.cosmeticId)}/chain-auto-unlock`, { enabled: a.enabled });
    },
  },
  {
    name: 'withdraw_collection_world_capabilities',
    description: 'Withdraw your NFT capability declaration for a collection.',
    inputSchema: { type: 'object', properties: { chain: CHAIN_ARG, contract: CONTRACT_ARG }, required: ['chain', 'contract'], additionalProperties: false },
    handler: (args) => {
      const a = args as { chain: string; contract: string };
      return apiDelete(`/v1/world/collections/${encodeURIComponent(a.chain)}/${encodeURIComponent(a.contract)}/capabilities`);
    },
  },
];
