import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Launch creator tools and Solana collection / trait offers (api
 * routes/v1/write/web3-launch-tools.ts). Transactions come back for your own
 * wallet to sign.
 */
const ID = { type: 'string', description: 'Launch id (uuid).' } as const;
const SOL = (what: string) => ({ type: 'string', description: `${what} (a Solana address).` }) as const;
const LAMPORTS = (what: string) => ({ type: 'string', description: `${what}, in lamports (the Solana native currency's smallest unit) as a whole-number string.` }) as const;
const BLOCKHASH = { type: 'string', description: 'A recent Solana blockhash from your RPC (getLatestBlockhash).' } as const;

export const web3LaunchToolsTools: ToolDef[] = [
  {
    name: 'get_web3_launch_tools',
    description: "A launch's creator tools: allowlist size and root (and whether the contract has it yet), uploaded art and whether it is revealed, supply minted.",
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/web3/launches/${encodeURIComponent(id)}/tools`, {});
    },
  },
  {
    name: 'set_web3_launch_allowlist',
    description: 'Replace the wallets allowed in the early phase (up to 10,000). On a live EVM launch the answer carries rootTx, the setAllowlistRoot transaction for the owner wallet to send.',
    inputSchema: {
      type: 'object',
      properties: { id: ID, addresses: { type: 'array', items: { type: 'string' }, description: 'Wallet addresses on the launch chain (0x... on EVM, base58 on Solana).' } },
      required: ['id', 'addresses'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, addresses } = args as { id: string; addresses: string[] };
      return apiPut(`/v1/web3/launches/${encodeURIComponent(id)}/allowlist`, { addresses });
    },
  },
  {
    name: 'get_web3_launch_allowlist_root_tx',
    description: "The setAllowlistRoot transaction for the allowlist Crossly holds, for a live EVM launch: { chain, from, to, data }.",
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/web3/launches/${encodeURIComponent(id)}/allowlist/root-tx`, {});
    },
  },
  {
    name: 'add_web3_launch_art',
    description: 'Append per-token art before the reveal, up to the supply. Until the reveal every token shows the launch placeholder.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID,
        items: {
          type: 'array',
          description: 'Art in order, one per token.',
          items: {
            type: 'object',
            properties: {
              imageUrl: { type: 'string', description: 'Image URL (upload it in the dashboard to put it on our CDN).' },
              name: { type: 'string', description: 'Token name shown after the reveal.' },
              attributes: { type: 'array', description: 'Traits: { trait_type, value }.', items: { type: 'object' } },
            },
            required: ['imageUrl'],
          },
        },
      },
      required: ['id', 'items'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, items } = args as { id: string; items: unknown[] };
      return apiPost(`/v1/web3/launches/${encodeURIComponent(id)}/art`, { items });
    },
  },
  {
    name: 'reveal_web3_launch',
    description: "Reveal a launch's art: one random offset maps every token to its asset for good (nobody can aim a rare one at a chosen token).",
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/web3/launches/${encodeURIComponent(id)}/reveal`, {});
    },
  },
  {
    name: 'plan_web3_launch_airdrop',
    description: 'Plan an airdrop of free NFTs (one each, up to 500) to a list and/or the holders of a collection. Returns the transactions for the owner wallet; no payment moves.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID,
        addresses: { type: 'array', items: { type: 'string' }, description: 'Recipient wallets on the launch chain.' },
        holdersOf: { type: 'string', description: 'A collection on the launch chain whose holders each get one.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as { id: string; addresses?: string[]; holdersOf?: string };
      return apiPost(`/v1/web3/launches/${encodeURIComponent(id)}/airdrop`, body);
    },
  },
  {
    name: 'list_web3_solana_tensor_bids',
    description: "A Solana collection's Tensor bids (collection-wide and by trait), best first. Needs your Tensor key in Settings.",
    inputSchema: { type: 'object', properties: { collection: SOL('The collection') }, required: ['collection'], additionalProperties: false },
    handler: (args) => {
      const { collection } = args as { collection: string };
      return apiGet(`/v1/web3/solana/collections/${encodeURIComponent(collection)}/tensor-bids`, {});
    },
  },
  {
    name: 'place_web3_solana_tensor_bid',
    description: 'Build a Tensor bid on any NFT of a Solana collection (or only ones with a trait) for your Solana wallet to sign.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: SOL('The collection'),
        bidder: SOL('Your verified wallet'),
        priceLamports: LAMPORTS('Price per NFT'),
        quantity: { type: 'integer', minimum: 1, maximum: 50, description: 'How many NFTs the bid can fill.' },
        blockhash: BLOCKHASH,
        trait: { type: 'object', description: 'Only NFTs with this trait: { type, value }.' },
        mint: SOL('Any NFT of the collection, to find it on Tensor'),
      },
      required: ['collection', 'bidder', 'priceLamports', 'quantity', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/solana/tensor-bids/place-tx', args),
  },
  {
    name: 'accept_web3_solana_tensor_bid',
    description: 'Build the transaction that sells one of your Solana NFTs into a Tensor bid, never below minLamports.',
    inputSchema: {
      type: 'object',
      properties: { bid: SOL('The bid'), mint: SOL('Your NFT'), seller: SOL('Your verified wallet holding it'), minLamports: LAMPORTS('The lowest price you accept'), blockhash: BLOCKHASH },
      required: ['bid', 'mint', 'seller', 'minLamports', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/solana/tensor-bids/accept-tx', args),
  },
  {
    name: 'cancel_web3_solana_tensor_bid',
    description: 'Build the transaction that cancels your Tensor bid.',
    inputSchema: {
      type: 'object',
      properties: { bid: SOL('The bid'), bidder: SOL('Your wallet that placed it'), blockhash: BLOCKHASH },
      required: ['bid', 'bidder', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/solana/tensor-bids/cancel-tx', args),
  },
];
