import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

const CHAINS = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'solana'];

/**
 * Web3 — linked wallets and NFT inventory (docs/WEB3.md). Linking takes a
 * signature from the wallet itself: `create_wallet_challenge` returns the
 * message, the wallet's owner signs it, `verify_wallet` submits the signature.
 * An agent cannot link a wallet it does not hold the key for.
 */
export const web3Tools: ToolDef[] = [
  {
    name: 'list_wallets',
    description: 'List your verified, linked crypto wallets (EVM and Solana).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/wallets', {}),
  },
  {
    name: 'create_wallet_challenge',
    description:
      'Start linking a wallet. Returns { walletId, message }; the wallet owner must sign `message` (SIWE on EVM, signMessage on Solana) and pass the signature to verify_wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        family: {
          type: 'string',
          enum: ['evm', 'solana'],
          description: "'evm' for Ethereum, Base, Polygon, Arbitrum and Optimism (one address covers all five); 'solana' for Solana.",
        },
        address: { type: 'string', description: '0x… address for EVM, base58 public key for Solana.' },
        chainId: { type: 'integer', description: 'EVM only: chain to name in the SIWE message (default 1).' },
      },
      required: ['family', 'address'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/wallets/challenge', args),
  },
  {
    name: 'verify_wallet',
    description: "Finish linking a wallet with its signature over the challenge message (hex on EVM, base58 on Solana).",
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'The walletId returned by create_wallet_challenge.' },
        signature: {
          type: 'string',
          description: "The wallet's signature over the exact challenge message: 0x-prefixed hex from an EVM wallet, base58 from a Solana wallet.",
        },
      },
      required: ['walletId', 'signature'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/wallets/verify', args),
  },
  {
    name: 'sync_wallet_nfts',
    description: "Import a linked wallet's NFTs into your Crossly inventory. NFTs that have left the wallet are archived.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Wallet id from list_wallets.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/web3/wallets/${encodeURIComponent(id)}/sync`, {});
    },
  },
  {
    name: 'unlink_wallet',
    description: 'Unlink a wallet. Its NFTs stay in inventory but stop syncing.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Wallet id from list_wallets.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/web3/wallets/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'get_inventory_nft',
    description: 'For one inventory item: the NFT it is (chain, contract, token, wallet) and where it is listed right now — Crossly, OpenSea, Tensor, Magic Eden. nft is null when the item is not an NFT.',
    inputSchema: {
      type: 'object',
      properties: { itemId: { type: 'string', description: 'Inventory item UUID.' } },
      required: ['itemId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { itemId } = args as { itemId: string };
      return apiGet(`/v1/web3/inventory/${encodeURIComponent(itemId)}`, {});
    },
  },
  {
    name: 'list_nft_inventory',
    description: 'List the NFTs in your inventory (imported from linked wallets), optionally by chain or wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          enum: CHAINS,
          description: 'Only NFTs on this chain: ethereum, base, polygon, arbitrum, optimism (EVM) or solana. Omit for all.',
        },
        walletId: { type: 'string', description: 'Only NFTs from this linked wallet (id from list_wallets).' },
        page: { type: 'integer', minimum: 1, description: '1-based page number (default 1).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'NFTs per page, 1–200 (default 60).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/nfts', args as Record<string, unknown>),
  },
  {
    name: 'get_web3_phygital',
    description: "A token's phygital: the physical item the NFT can be redeemed for once, and whether it already has been.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: CHAINS, description: 'Chain the NFT is on.' },
        contract: { type: 'string', description: 'NFT contract address (0x…).' },
        tokenId: { type: 'string', description: 'Token id.' },
      },
      required: ['chain', 'contract', 'tokenId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, tokenId } = args as { chain: string; contract: string; tokenId: string };
      return apiGet(`/v1/web3/phygitals/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}`, {});
    },
  },
  {
    name: 'list_web3_phygitals',
    description: 'Phygitals you linked (each with its redemption and shipping address) and ones you redeemed.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/phygitals', {}),
  },
  {
    name: 'link_web3_phygital',
    description: 'Make an NFT you hold (in a linked wallet) redeemable, once, for one of your physical inventory items.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: CHAINS, description: 'Chain the NFT is on (EVM only).' },
        contract: { type: 'string', description: 'NFT contract address (0x…).' },
        tokenId: { type: 'string', description: 'Token id.' },
        inventoryItemId: { type: 'string', description: 'The physical inventory item UUID it redeems for.' },
        title: { type: 'string', description: 'What the holder gets, e.g. "Signed print, 18×24".' },
        description: { type: 'string', description: 'More detail (optional).' },
      },
      required: ['chain', 'contract', 'tokenId', 'inventoryItemId', 'title'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/phygitals', args),
  },
  {
    name: 'redeem_web3_phygital',
    description: 'Redeem a phygital you hold (checked on-chain) for its physical item, shipped to the address given. Once per phygital.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Phygital id from get_web3_phygital.' },
        shipTo: {
          type: 'object',
          description: 'Shipping address; country is ISO 3166 alpha-2 (e.g. US).',
          properties: {
            name: { type: 'string', description: 'Recipient name.' },
            line1: { type: 'string', description: 'Street address.' },
            line2: { type: 'string', description: 'Apartment, suite (optional).' },
            city: { type: 'string', description: 'City.' },
            region: { type: 'string', description: 'State or region (optional).' },
            postalCode: { type: 'string', description: 'Postal code.' },
            country: { type: 'string', description: 'Two-letter country code.' },
            phone: { type: 'string', description: 'Phone for the carrier (optional).' },
          },
          required: ['name', 'line1', 'city', 'postalCode', 'country'],
        },
      },
      required: ['id', 'shipTo'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, shipTo } = args as { id: string; shipTo: unknown };
      return apiPost(`/v1/web3/phygitals/${encodeURIComponent(id)}/redeem`, { shipTo });
    },
  },
  {
    name: 'ship_web3_phygital_redemption',
    description: 'Mark a phygital redemption shipped with its carrier and tracking number; the redeemer is notified.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Redemption id from list_web3_phygitals.' },
        carrier: { type: 'string', description: 'Carrier, e.g. USPS.' },
        trackingNumber: { type: 'string', description: 'Tracking number.' },
      },
      required: ['id', 'carrier', 'trackingNumber'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as { id: string; carrier: string; trackingNumber: string };
      return apiPost(`/v1/web3/phygitals/redemptions/${encodeURIComponent(id)}/ship`, body);
    },
  },
  {
    name: 'get_web3_portfolio',
    description:
      'Your NFTs with value (Crossly floor, else recent sales) and cost basis (what your linked wallet paid), sales from your wallets, and USD totals for value, cost, unrealised and realised profit.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/portfolio', {}),
  },
  {
    name: 'list_web3_purchases',
    description: "NFTs your linked wallets bought — on Crossly or any marketplace the chain feed saw — newest first, with price (wei of the chain's native currency, and USD on the day) and whether you still hold each.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/purchases', {}),
  },
  {
    name: 'get_web3_collector_perks',
    description: 'Your collector perks: how many different NFTs you bought through Crossly, your Collector pin tier, relist rewards paid (whole cents, currency USD), and each NFT you still hold with the Bought on Crossly mark and whether its relist reward is still to earn.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/collector', {}),
  },
  {
    name: 'export_web3_tax_csv',
    description: 'One calendar year of NFT disposals from your linked wallets as CSV text (acquired, sold, proceeds, cost basis, gain in coin and USD).',
    inputSchema: {
      type: 'object',
      properties: { year: { type: 'integer', minimum: 2015, maximum: 2100, description: 'Calendar year, e.g. 2026.' } },
      required: ['year'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/portfolio/tax', args as Record<string, unknown>),
  },
  {
    name: 'get_web3_watchlist',
    description: 'Your favourited NFTs, with the cheapest open Crossly listing and the last sale of each.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/watchlist', {}),
  },
  {
    name: 'toggle_web3_favorite',
    description: 'Favourite an NFT, or unfavourite it if it already is. Returns { favorited }.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: CHAINS, description: 'Chain the NFT is on.' },
        contract: { type: 'string', description: 'NFT contract address (0x…), or the Solana collection address.' },
        tokenId: { type: 'string', description: 'Token id (EVM) or mint address (Solana).' },
      },
      required: ['chain', 'contract', 'tokenId'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/favorites', args),
  },
  {
    name: 'list_web3_price_alerts',
    description: 'Your NFT price alerts, with the cheapest open Crossly listing each one covers now.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/alerts', {}),
  },
  {
    name: 'set_web3_price_alert',
    description:
      "Be notified when an NFT — or, without tokenId, anything in the collection — is listed on Crossly at or below a price in the chain's native coin. Setting it again moves the price.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: CHAINS, description: 'Chain the collection is on.' },
        contract: { type: 'string', description: 'NFT contract address (0x…).' },
        tokenId: { type: 'string', description: 'One token; omit for the whole collection.' },
        price: { type: 'string', description: "Decimal amount of the chain's native currency (ETH on Ethereum/Base, POL on Polygon), e.g. '0.05'; not wei and not USD." },
      },
      required: ['chain', 'contract', 'price'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/alerts', args),
  },
  {
    name: 'delete_web3_price_alert',
    description: 'Delete an NFT price alert.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Alert id from list_web3_price_alerts.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/web3/alerts/${encodeURIComponent(id)}`);
    },
  },
];
