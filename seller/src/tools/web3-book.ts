import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

const CHAIN_PROP = {
  type: 'string',
  enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
  description: 'Chain: ethereum, base, polygon, arbitrum or optimism (the Crossly book is EVM-only for now).',
};
const CONTRACT_PROP = { type: 'string', description: 'NFT contract address (0x…).' };
const HASH_PROP = { type: 'string', description: 'Seaport order hash (0x + 64 hex) from a listing or offer.' };

/**
 * The Crossly NFT book (Seaport 1.6, docs/WEB3.md). Orders are signed by the
 * maker's wallet, never by Crossly; these tools browse the book and move
 * already-signed orders through it.
 */
export const web3BookTools: ToolDef[] = [
  {
    name: 'list_web3_listings',
    description: "Browse open NFT listings in the Crossly book (cheapest per token). Prices are wei of the chain's native coin.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: CONTRACT_PROP,
        sort: {
          type: 'string',
          enum: ['recent', 'price_asc', 'price_desc'],
          description: "'recent' (default) newest first, 'price_asc' cheapest first, 'price_desc' dearest first.",
        },
        page: { type: 'integer', minimum: 1, description: '1-based page (default 1).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Listings per page, 1–200 (default 48).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/listings', args as Record<string, unknown>),
  },
  {
    name: 'get_web3_browse',
    description: "The Web3 directory's categories (PFPs, art, gaming, memberships, virtual worlds, domain names) and chains, with how many collections each holds.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/browse', {}),
  },
  {
    name: 'browse_web3_collections',
    description: 'Browse NFT collections by chain, category and name. Sort hot (Crossly sales, listings and favourites, then the curated order), new, volume, floor or name.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        category: { type: 'string', enum: ['pfps', 'art', 'gaming', 'memberships', 'virtual-worlds', 'domains'], description: 'Collection category.' },
        q: { type: 'string', description: 'Collection name contains.' },
        sort: { type: 'string', enum: ['hot', 'new', 'volume', 'floor', 'name'], description: 'Order (default hot).' },
        listed: { type: 'boolean', description: 'Only collections with something for sale on Crossly.' },
        limit: { type: 'integer', minimum: 1, maximum: 60, description: 'Collections per page (default 24).' },
        offset: { type: 'integer', minimum: 0, description: 'Skip this many (paging).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/browse/collections', args as Record<string, unknown>),
  },
  {
    name: 'list_hot_web3_tokens',
    description: 'Hot NFTs: what is for sale on Crossly first, then tokens from the hottest collections. Optional chain and category.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        category: { type: 'string', enum: ['pfps', 'art', 'gaming', 'memberships', 'virtual-worlds', 'domains'], description: 'Collection category.' },
        limit: { type: 'integer', minimum: 1, maximum: 48, description: 'How many tokens (default 12).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/browse/tokens', args as Record<string, unknown>),
  },
  {
    name: 'list_web3_collections',
    description: 'Collections ranked by 30-day volume on Crossly, with floor price and listed count.',
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many collections (default 20).' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/collections', args as Record<string, unknown>),
  },
  {
    name: 'list_web3_sales',
    description: 'The latest NFT sales across the Crossly directory — read from the chain (Seaport: OpenSea, Magic Eden, Crossly; Blur) — newest first, with collection and token image. Page with before (ISO time of the last sale seen).',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'solana'], description: 'Only this chain.' },
        category: { type: 'string', enum: ['pfps', 'art', 'gaming', 'memberships', 'virtual-worlds', 'domains'], description: 'Collection category.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many sales (default 50).' },
        before: { type: 'string', description: 'ISO time: only sales before it.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/sales', args as Record<string, unknown>),
  },
  {
    name: 'list_web3_rankings',
    description: "NFT collections ranked by sales volume over 24h, 7d or 30d, with sale count, change against the window before and the Crossly floor. One coin per ranking: no chain = the ETH chains together; polygon or solana rank on their own.",
    inputSchema: {
      type: 'object',
      properties: {
        window: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Window (default 24h).' },
        chain: { type: 'string', enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'solana'], description: 'Only this chain.' },
        category: { type: 'string', enum: ['pfps', 'art', 'gaming', 'memberships', 'virtual-worlds', 'domains'], description: 'Collection category.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many collections (default 50).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/rankings', args as Record<string, unknown>),
  },
  {
    name: 'get_web3_featured',
    description: "The featured NFT collections on Crossly's NFT home — the ones Crossly chose (with any campaign headline), or the hottest when none are chosen.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/featured', {}),
  },
  {
    name: 'list_web3_collection_items',
    description:
      "A collection's NFTs with trait filters (trait: ['Fur:Brown', 'Eyes:Bored'] — OR within a type, AND across types), search by name or token id (q), and sort by id, rarity or Crossly price. Covers the whole collection once it is indexed; otherwise one provider page (follow pageKey).",
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: { type: 'string', description: 'The collection contract (EVM 0x address) or Solana collection mint.' },
        trait: { type: 'array', items: { type: 'string' }, description: 'Trait filters as Type:Value.' },
        q: { type: 'string', description: 'Name or token id.' },
        sort: {
          type: 'string',
          enum: ['id', 'rarity', 'price'],
          description: 'id = token id ascending (default); rarity = rarest first (rank 1); price = cheapest Crossly listing first, unlisted after.',
        },
        listed: { type: 'boolean', description: 'Only items for sale on Crossly.' },
        offset: { type: 'integer', minimum: 0, description: 'Skip this many results (use nextOffset from the previous page).' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Items per page (default 48).' },
        pageKey: { type: 'string', description: 'Provider paging while the collection is not indexed yet.' },
      },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, ...query } = args as { chain: string; contract: string } & Record<string, unknown>;
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/items`, query);
    },
  },
  {
    name: 'get_web3_collection_traits',
    description: 'Every trait type and value in an NFT collection, with how many tokens carry each — the filter list and the basis of rarity.',
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: { type: 'string', description: 'The collection contract or Solana collection mint.' } },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract } = args as { chain: string; contract: string };
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/traits`, {});
    },
  },
  {
    name: 'resolve_web3_collection',
    description: "Look up an NFT collection's chain and contract from its Crossly URL slug, e.g. chain 'eth' and slug 'boredapeyachtclub'.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', description: 'Chain as in the URL: eth, base, polygon, arb, op, sol (or the full name).' },
        slug: { type: 'string', description: 'The collection slug from the URL.' },
      },
      required: ['chain', 'slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, slug } = args as { chain: string; slug: string };
      return apiGet(`/v1/web3/resolve/${encodeURIComponent(chain)}/${encodeURIComponent(slug)}`, {});
    },
  },
  {
    name: 'get_web3_collection_insights',
    description: "A collection's on-chain insights: holder count, how many tokens carry each trait value (rarity), the most recent transfers and mints, and a 30-day activity series.",
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: { type: 'string', description: 'The collection contract (EVM 0x address).' } },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract } = args as { chain: string; contract: string };
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/insights`, {});
    },
  },
  {
    name: 'get_web3_collection',
    description: 'One collection: name, image, description and Crossly stats (floor, listed, volume, best collection offer).',
    inputSchema: { type: 'object', properties: { chain: CHAIN_PROP, contract: CONTRACT_PROP }, required: ['chain', 'contract'], additionalProperties: false },
    handler: (args) => {
      const { chain, contract } = args as { chain: string; contract: string };
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}`, {});
    },
  },
  {
    name: 'get_web3_token',
    description: 'One NFT: metadata, traits, current owner, open listings and offers, and its activity.',
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: CONTRACT_PROP, tokenId: { type: 'string', description: 'Token id (decimal).' } },
      required: ['chain', 'contract', 'tokenId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, tokenId } = args as { chain: string; contract: string; tokenId: string };
      return apiGet(`/v1/web3/tokens/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}`, {});
    },
  },
  {
    name: 'list_web3_activity',
    description: 'Listings, offers, sales and cancels in the Crossly book, newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: CONTRACT_PROP,
        tokenId: { type: 'string', description: 'Only this token (decimal id).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many events (default 50).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/activity', args as Record<string, unknown>),
  },
  {
    name: 'list_my_web3_orders',
    description: 'Your listings and offers in the Crossly book, any status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/orders', {}),
  },
  {
    name: 'submit_web3_order',
    description:
      'Place a Seaport 1.6 order your wallet has ALREADY signed (listing, offer or collection offer). It must use the OpenSea conduit, pay the 1% Crossly fee, and the maker must be one of your linked wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        components: {
          type: 'object',
          description:
            'Seaport OrderComponents: offerer, zone, offer, consideration, orderType, startTime, endTime, zoneHash, salt, conduitKey, counter — numbers as decimal strings.',
        },
        signature: { type: 'string', description: "The maker wallet's EIP-712 signature (plain or Seaport bulk), 0x-prefixed hex." },
        criteria: {
          type: 'object',
          description:
            'Trait offers only: { traitType, value, tokenIds } — the token ids (from get_web3_trait_tokens) whose Seaport criteria root the order signed.',
        },
      },
      required: ['chain', 'components', 'signature'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/orders', args),
  },
  {
    name: 'cancel_web3_order',
    description:
      'Take one of your orders out of the Crossly book (off-chain). A Seaport cancel transaction also works and is picked up by confirm_web3_transaction.',
    inputSchema: { type: 'object', properties: { chain: CHAIN_PROP, orderHash: HASH_PROP }, required: ['chain', 'orderHash'], additionalProperties: false },
    handler: (args) => {
      const { chain, orderHash } = args as { chain: string; orderHash: string };
      return apiPost(`/v1/web3/orders/${encodeURIComponent(chain)}/${encodeURIComponent(orderHash)}/cancel`, {});
    },
  },
  {
    name: 'get_web3_order_fulfillment',
    description: "The signed order to pass to Seaport's fulfillOrder, after Crossly re-checks it can still fill.",
    inputSchema: { type: 'object', properties: { chain: CHAIN_PROP, orderHash: HASH_PROP }, required: ['chain', 'orderHash'], additionalProperties: false },
    handler: (args) => {
      const { chain, orderHash } = args as { chain: string; orderHash: string };
      return apiGet(`/v1/web3/orders/${encodeURIComponent(chain)}/${encodeURIComponent(orderHash)}/fulfillment`, {});
    },
  },
  {
    name: 'get_web3_sweep_fulfillments',
    description: "Signed orders for sweeping several Crossly listings in one Seaport fulfillAvailableOrders transaction; listings that can no longer fill come back in 'skipped' with a reason.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        orderHashes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50, description: 'Listing order hashes to sweep (up to 50).' },
      },
      required: ['chain', 'orderHashes'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/orders/fulfillment-batch', args),
  },
  {
    name: 'get_web3_trait_tokens',
    description: 'Token ids in a collection that carry one trait — the set a trait offer commits to with a Seaport criteria root.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: CONTRACT_PROP,
        type: { type: 'string', description: "Trait type, e.g. 'Background'." },
        value: { type: 'string', description: "Trait value, e.g. 'Blue'." },
      },
      required: ['chain', 'contract', 'type', 'value'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, ...q } = args as { chain: string; contract: string; type: string; value: string };
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/trait-tokens`, q);
    },
  },
  {
    name: 'get_web3_profile',
    description: "Any wallet's public profile: NFTs it holds (first page per chain), its open Crossly listings, and its activity.",
    inputSchema: {
      type: 'object',
      properties: { address: { type: 'string', description: 'EVM 0x address or Solana base58 address.' } },
      required: ['address'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { address } = args as { address: string };
      return apiGet(`/v1/web3/profiles/${encodeURIComponent(address)}`, {});
    },
  },
  {
    name: 'search_web3_collections',
    description: 'Find NFT collections by contract address (checked on every EVM chain) or by name.',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'A 0x contract address or part of a collection name.' } },
      required: ['q'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/search', args as Record<string, unknown>),
  },
  {
    name: 'list_web3_drops',
    description: "Upcoming and live NFT drops — curated mints that happen on the creator's own page (mintUrl) — soonest first, with price (wei of the chain's native currency) and supply.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/drops', {}),
  },
  {
    name: 'toggle_web3_drop_reminder',
    description: 'Turn the 15-minute reminder for a drop on, or off if it already is.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Drop id from list_web3_drops.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/web3/drops/${encodeURIComponent(id)}/remind`, {});
    },
  },
  {
    name: 'refresh_web3_token_metadata',
    description: "Re-read a token's metadata (name, traits, image) from the provider; a new image is copied to Crossly's CDN. Once per token per 10 minutes.",
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: CONTRACT_PROP, tokenId: { type: 'string', description: 'Token id.' } },
      required: ['chain', 'contract', 'tokenId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, tokenId } = args as { chain: string; contract: string; tokenId: string };
      return apiPost(`/v1/web3/tokens/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}/refresh`, {});
    },
  },
  {
    name: 'list_web3_auctions',
    description: 'Live English auctions on the Crossly book, ending soonest first, with each top bid and the least the next bid can be (wei of the chain\'s wrapped native currency).',
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many, 1–100 (default 48).' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/auctions', args as Record<string, unknown>),
  },
  {
    name: 'get_web3_auction',
    description: "A token's live (or latest) auction: reserve, end time, top bid, bid count and minimum next bid. To bid, submit a WETH offer on the token at or above the minimum, valid for at least a day past the end.",
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: CONTRACT_PROP, tokenId: { type: 'string', description: 'Token id.' } },
      required: ['chain', 'contract', 'tokenId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, tokenId } = args as { chain: string; contract: string; tokenId: string };
      return apiGet(`/v1/web3/auctions/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}`, {});
    },
  },
  {
    name: 'create_web3_auction',
    description: 'Start an English auction on an NFT in your linked wallet. Nothing is signed: bids are offers, and you accept the top one when it ends. Bids must rise 5%; a bid in the last 10 minutes extends the end.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: CONTRACT_PROP,
        tokenId: { type: 'string', description: 'Token id.' },
        reserve: { type: 'string', description: "Opening bid as a decimal amount of the chain's native currency, e.g. '0.1'; not wei and not USD." },
        hours: { type: 'integer', minimum: 1, maximum: 720, description: 'Length in hours, 1–720.' },
      },
      required: ['chain', 'contract', 'tokenId', 'reserve', 'hours'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/auctions', args),
  },
  {
    name: 'cancel_web3_auction',
    description: 'Call off your auction while it has no bids.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Auction id from list_web3_auctions or get_web3_auction.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/web3/auctions/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'list_web3_bundles',
    description: 'Open bundle listings on the Crossly book: 2–30 NFTs sold together for one price.',
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: { type: 'string', description: 'Only bundles containing a token of this contract (0x…).' }, limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many, 1–100 (default 24).' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/bundles', args as Record<string, unknown>),
  },
  {
    name: 'list_web3_reserved',
    description: 'Private listings reserved for one of your linked wallets — only you can see or buy them.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/reserved', {}),
  },
  {
    name: 'get_web3_collection_depth',
    description:
      "A collection's Crossly order book by price level — asks cheapest first, bids dearest first, each with a running total — and the cheapest listing for every trait value. Prices are wei of the chain's native currency.",
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, contract: CONTRACT_PROP },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract } = args as { chain: string; contract: string };
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/depth`, {});
    },
  },
  {
    name: 'get_web3_collection_history',
    description: "A collection's daily floor, sales, volume (wei of the chain's native currency), holders and listed count, oldest first.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: CONTRACT_PROP,
        days: { type: 'integer', minimum: 1, maximum: 365, description: 'How many days back, 1–365 (default 90).' },
      },
      required: ['chain', 'contract'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { chain, contract, ...q } = args as { chain: string; contract: string; days?: number };
      return apiGet(`/v1/web3/collections/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}/history`, q);
    },
  },
  {
    name: 'search_web3_tokens',
    description: "Find NFTs by collection name and token number, e.g. 'pudgy 42' or 'Bored Ape #1234'.",
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Part of a collection name followed by a token number.' } },
      required: ['q'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/search/tokens', args as Record<string, unknown>),
  },
  {
    name: 'confirm_web3_transaction',
    description: "Apply a Seaport transaction to the Crossly book: fills and cancels are read from the receipt's Seaport events.",
    inputSchema: {
      type: 'object',
      properties: { chain: CHAIN_PROP, txHash: { type: 'string', description: 'Transaction hash (0x + 64 hex).' } },
      required: ['chain', 'txHash'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/transactions', args),
  },
];
