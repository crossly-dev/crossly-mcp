import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Launchpad, holder perks and the creator dashboard (api routes/v1/write/
 * web3-launchpad.ts). Deploying is signed by the creator's own wallet: the
 * deploy-tx tool hands back the transaction, confirm_web3_launch_deploy
 * accepts it once sent.
 */
const ID = { type: 'string', description: 'Launch id (uuid).' } as const;
const EVM_CHAINS = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'];
const CHAIN = { type: 'string', enum: EVM_CHAINS, description: 'EVM chain: ethereum, base, polygon, arbitrum or optimism (claims are EVM only).' } as const;
const LAUNCH_CHAIN = { type: 'string', enum: [...EVM_CHAINS, 'solana'], description: 'ethereum, base, polygon, arbitrum or optimism (your own contract), or solana (your own Metaplex Core collection, minted into by Crossly).' } as const;
const TX = { type: 'string', description: 'The 0x transaction hash (EVM) or signature (Solana) your wallet returned.' } as const;

export const web3LaunchpadTools: ToolDef[] = [
  {
    name: 'list_web3_launches',
    description: 'Your launchpad collections (drafts and live), newest first, with minted count and phase.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/launches', {}),
  },
  {
    name: 'create_web3_launch',
    description:
      "Draft a launchpad collection minted from your own contract (Solana: your own Core collection). Price is wei (lamports on Solana) of the chain's native currency per token. Crossly takes 5% of every mint, inside the mint transaction. Times are ISO-8601; a holder phase (holderStart + holderGate) lets holders of another collection mint first.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: LAUNCH_CHAIN,
        ownerAddress: { type: 'string', description: 'One of your verified wallets on that chain; it deploys and owns the collection.' },
        name: { type: 'string', description: 'Collection name (up to 80 characters).' },
        symbol: { type: 'string', description: '1-10 letters or digits.' },
        description: { type: 'string', description: 'What the collection is (up to 2000 characters).' },
        imageUrl: { type: 'string', description: 'Artwork URL (upload it in the dashboard to put it on our CDN).' },
        maxSupply: { type: 'integer', minimum: 1, maximum: 100000, description: 'How many tokens can ever be minted.' },
        priceWei: { type: 'string', description: "Mint price per token in wei of the chain's native currency." },
        holderStart: { type: 'string', description: 'ISO-8601 start of the holder phase (needs holderGate); omit for no holder phase.' },
        publicStart: { type: 'string', description: 'ISO-8601 time anyone can mint.' },
        endTime: { type: 'string', description: 'ISO-8601 time minting ends; omit to mint until sold out.' },
        holderGate: { type: 'string', description: 'Collection whose holders may mint in the holder phase.' },
        maxPerWallet: { type: 'integer', minimum: 0, description: 'Most tokens one wallet may mint; 0 = no limit.' },
        royaltyBps: { type: 'integer', minimum: 0, maximum: 1000, description: 'Creator royalty on resales in basis points (500 = 5%), paid to the owner wallet.' },
      },
      required: ['chain', 'ownerAddress', 'name', 'symbol', 'maxSupply', 'priceWei', 'publicStart'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/launches', args),
  },
  {
    name: 'get_web3_launch_deploy_tx',
    description: "The contract-creation transaction for a draft ({ chain, from, data }). Send it from the owner wallet, then call confirm_web3_launch_deploy.",
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/web3/launches/${encodeURIComponent(id)}/deploy-tx`, {});
    },
  },
  {
    name: 'confirm_web3_launch_deploy',
    description: "Confirm a sent deploy: the contract must be Crossly's launch contract with the draft's settings; the launch then goes live.",
    inputSchema: { type: 'object', properties: { id: ID, txHash: TX }, required: ['id', 'txHash'], additionalProperties: false },
    handler: (args) => {
      const { id, txHash } = args as { id: string; txHash: string };
      return apiPost(`/v1/web3/launches/${encodeURIComponent(id)}/confirm-deploy`, { txHash });
    },
  },
  {
    name: 'delete_web3_launch_draft',
    description: 'Delete a launch draft that never went live.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/web3/launches/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'list_web3_holder_perks',
    description: 'Your holder perks: percent off your Crossly shop for holders of an NFT collection.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/holder-perks', {}),
  },
  {
    name: 'set_web3_holder_perk',
    description: 'Give holders of an NFT collection a percent off your Crossly shop (100-5000 bps, taken off your own price at checkout). One perk per collection; setting it again changes it.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', description: 'Chain of the collection, e.g. ethereum, base or solana.' },
        contract: { type: 'string', description: 'Collection contract (Solana: the collection mint).' },
        percentOffBps: { type: 'integer', minimum: 100, maximum: 5000, description: 'Discount in basis points, 100 (1%) to 5000 (50%).' },
        active: { type: 'boolean', description: 'Whether the perk applies now (default true).' },
      },
      required: ['chain', 'contract', 'percentOffBps'],
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/web3/holder-perks', args),
  },
  {
    name: 'delete_web3_holder_perk',
    description: 'Remove a holder perk.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Holder perk id (uuid).' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/web3/holder-perks/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'list_web3_creator_collections',
    description: 'Collections you are the creator of: your launches, and contracts you claimed by owning them.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/creator/collections', {}),
  },
  {
    name: 'claim_web3_collection',
    description: "Claim an EVM collection as its creator: its owner() must be one of your verified wallets.",
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN, contract: { type: 'string', description: 'The collection contract address (0x…).' } },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/creator/claims', args),
  },
  {
    name: 'get_web3_creator_dashboard',
    description:
      "A collection's creator dashboard: sales by marketplace and day, estimated royalties, holders, and for a launch the mint revenue and what is waiting to be withdrawn. Amounts are wei of the chain's native currency.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', description: 'Chain of the collection, e.g. ethereum or base.' },
        contract: { type: 'string', description: 'The collection contract address.' },
      },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract } = args as { chain: string; contract: string };
      return apiGet(`/v1/web3/creator/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}`, {});
    },
  },
];
