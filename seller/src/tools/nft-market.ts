import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * The Crossly NFT marketplace — resell Crossly cosmetics on-platform. The buy
 * settles on-chain (client + lib/solana); these tools cover listing, cancelling,
 * and the ops/observer confirm paths that route the fee to the production pot.
 */
export const nftMarketTools: ToolDef[] = [
  {
    name: 'list_nft_listings',
    description: 'Browse open on-platform NFT listings (Crossly cosmetics up for resale in CBX/SOL).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/nft-market/listings', {}),
  },
  {
    name: 'create_nft_listing',
    description: 'List an NFT you own for resale on the Crossly marketplace.',
    inputSchema: {
      type: 'object',
      properties: {
        ownershipId: { type: 'string', description: 'The cosmetic-ownership UUID you hold.' },
        priceCents: {
          type: 'integer',
          minimum: 1,
          maximum: 1_000_000_000,
          description:
            'Your asking price in US CENTS (integer, 1–1,000,000,000 — $0.01 to $10,000,000.00). 250000 means $2,500.00, ' +
            'not $250,000. The buy settles on-chain; Crossly takes a 2.5% marketplace fee on top of the design\'s ' +
            'on-chain royalty.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ownershipId', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/nft-market/listings', body, idempotencyKey);
    },
  },
  {
    name: 'cancel_nft_listing',
    description: 'Cancel one of your open NFT listings.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Listing UUID. Must be an open listing you created.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/nft-market/listings/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'confirm_nft_sale',
    description: 'OPS ONLY (admin PAT): record a finalized on-Crossly NFT sale — verifies the royalty landed and funds the production pot.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Listing UUID.' },
        buyerUserId: { type: 'string', description: 'UUID of the Crossly user who bought it — the new owner of record.' },
        txSig: {
          type: 'string',
          description: 'Solana transaction signature of the settled sale (4–120 chars). This is the proof the royalty landed.',
        },
      },
      required: ['id', 'buyerUserId', 'txSig'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, buyerUserId, txSig } = args as { id: string; buyerUserId: string; txSig: string };
      return apiPost(`/v1/nft-market/listings/${encodeURIComponent(id)}/confirm-sale`, { buyerUserId, txSig });
    },
  },
  {
    name: 'record_external_nft_resale',
    description: 'OPS ONLY (admin PAT): record a Crossly NFT resold on ANY marketplace — maps the mint to its design and funds the pot.',
    inputSchema: {
      type: 'object',
      properties: {
        mintAddress: {
          type: 'string',
          description: 'Solana mint address (32–64 chars) of the Crossly NFT that resold — this is what maps the token back to its design.',
        },
        grossSaleCents: {
          type: 'integer',
          minimum: 1,
          description:
            'Gross sale price observed on-chain, in US CENTS (integer, 1 or more). 250000 means $2,500.00. Crossly\'s ' +
            'royalty share of this figure is what funds the design\'s production pot.',
        },
        txSig: { type: 'string', description: 'Solana transaction signature of the resale (4–120 chars).' },
      },
      required: ['mintAddress', 'grossSaleCents', 'txSig'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/nft-market/external-resale', args as Record<string, unknown>),
  },
];
