import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

const CHAIN_PROP = {
  type: 'string',
  enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'solana'],
  description: 'Chain: ethereum, base, polygon, arbitrum, optimism (Seaport: Crossly + OpenSea) or solana (the Crossly book, Tensor, Magic Eden).',
};
const MARKETPLACE_PROP = {
  type: 'string',
  enum: ['crossly', 'tensor', 'magic_eden'],
  description: "Where the Solana listing lives: 'crossly' (Crossly's own Auction House book, 1% fee), 'tensor' or 'magic_eden'.",
};
const ORDER_PROP = { type: 'string', description: 'The listing id from list_web3_listings or get_web3_token (a Crossly-book listing is its trade state address; Tensor / Magic Eden, the listing transaction signature).' };
const SOL_PROPS = {
  mint: { type: 'string', description: 'The NFT mint (asset id), base58.' },
  owner: { type: 'string', description: 'Your linked Solana wallet that holds it, base58.' },
  priceSol: { type: 'string', description: "Price in SOL — Solana's native currency, not USD — as a decimal string, up to 9 decimals, e.g. '1.25'." },
  expireInDays: { type: 'integer', minimum: 1, maximum: 3650, description: 'Days until the listing expires (optional).' },
};

/**
 * Cross-listing (docs/WEB3.md, step 4). Every order and transaction is
 * signed by the seller's wallet; these tools fetch the terms, build Solana
 * transactions (Crossly book, Tensor, Magic Eden), and submit what the wallet signed.
 */
export const web3CrossListTools: ToolDef[] = [
  {
    name: 'get_web3_crosslist_quote',
    description:
      "Each marketplace's terms for listing one token: Crossly's fee recipient and bps, OpenSea's required fees and zone, and whether Tensor is available. Build one order per marketplace from these.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: CHAIN_PROP,
        contract: { type: 'string', description: 'NFT contract (EVM) or collection address (Solana).' },
        tokenId: { type: 'string', description: 'Token id (EVM, decimal) or mint (Solana).' },
      },
      required: ['chain', 'contract', 'tokenId'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/web3/crosslist/quote', args as Record<string, unknown>),
  },
  {
    name: 'submit_web3_crosslist',
    description:
      'Submit already-signed Seaport listings for several marketplaces at once (typically one Seaport bulk signature). Returns a result per marketplace; one failing does not undo another.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { ...CHAIN_PROP, enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'] },
        orders: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          description: "One entry per marketplace: { marketplace: 'crossly' | 'opensea', components: Seaport OrderComponents, signature }.",
          items: { type: 'object' },
        },
      },
      required: ['chain', 'orders'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/crosslist', args),
  },
  {
    name: 'build_solana_listing_tx',
    description: 'Build an unsigned listing transaction (base64) on the Crossly book, Tensor or Magic Eden for a Solana NFT in your linked wallet. The wallet must sign and send it, then call record_solana_listing.',
    inputSchema: {
      type: 'object',
      properties: { marketplace: MARKETPLACE_PROP, ...SOL_PROPS, blockhash: { type: 'string', description: 'A recent Solana blockhash, base58.' } },
      required: ['marketplace', 'mint', 'owner', 'priceSol', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { marketplace, ...body } = args as Record<string, unknown> & { marketplace: string };
      return apiPost(`/v1/web3/solana/${encodeURIComponent(marketplace)}/list-tx`, body);
    },
  },
  {
    name: 'record_solana_listing',
    description: 'Record a Crossly-book, Tensor or Magic Eden listing your wallet has sent; Crossly reads the transaction back from the chain before recording it.',
    inputSchema: {
      type: 'object',
      properties: { marketplace: MARKETPLACE_PROP, ...SOL_PROPS, signature: { type: 'string', description: 'The confirmed transaction signature, base58.' } },
      required: ['marketplace', 'mint', 'owner', 'priceSol', 'signature'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { marketplace, ...body } = args as Record<string, unknown> & { marketplace: string };
      return apiPost(`/v1/web3/solana/${encodeURIComponent(marketplace)}/listings`, body);
    },
  },
  {
    name: 'build_solana_delist_tx',
    description: 'Build the unsigned transaction that takes one of your Solana listings down (the Crossly book, Tensor or Magic Eden, whichever it is on).',
    inputSchema: {
      type: 'object',
      properties: { orderHash: ORDER_PROP, blockhash: { type: 'string', description: 'A recent Solana blockhash, base58.' } },
      required: ['orderHash', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { orderHash, ...body } = args as Record<string, unknown> & { orderHash: string };
      return apiPost(`/v1/web3/solana/orders/${encodeURIComponent(orderHash)}/delist-tx`, body);
    },
  },
  {
    name: 'build_solana_buy_tx',
    description: 'Build the unsigned transaction that buys a Solana listing. The price is capped at the listed price.',
    inputSchema: {
      type: 'object',
      properties: {
        orderHash: ORDER_PROP,
        buyer: { type: 'string', description: 'The buying wallet, base58.' },
        blockhash: { type: 'string', description: 'A recent Solana blockhash, base58.' },
      },
      required: ['orderHash', 'buyer', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { orderHash, ...body } = args as Record<string, unknown> & { orderHash: string };
      return apiPost(`/v1/web3/solana/orders/${encodeURIComponent(orderHash)}/buy-tx`, body);
    },
  },
  {
    name: 'confirm_solana_tx',
    description: 'Apply a sent Solana buy or delist to the Crossly book; the transaction is read back from the chain first.',
    inputSchema: {
      type: 'object',
      properties: {
        orderHash: ORDER_PROP,
        signature: { type: 'string', description: 'The confirmed transaction signature, base58.' },
        action: { type: 'string', enum: ['buy', 'delist'], description: "'buy' after buying, 'delist' after taking your listing down." },
        buyer: { type: 'string', description: "For 'buy': the buying wallet, base58." },
      },
      required: ['orderHash', 'signature', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { orderHash, ...body } = args as Record<string, unknown> & { orderHash: string };
      return apiPost(`/v1/web3/solana/orders/${encodeURIComponent(orderHash)}/confirm`, body);
    },
  },
  {
    name: 'list_web3_approvals',
    description: 'Collections of yours that the OpenSea conduit (used by every Crossly and OpenSea listing) is approved to move, per linked wallet.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/approvals', {}),
  },
  {
    name: 'draft_rarible_listing',
    description:
      "Draft a Rarible V2 listing for an NFT in your linked EVM wallet. Returns the EIP-712 order for the wallet to sign (Rarible takes its own order, not the Seaport one) and whether Rarible's transfer proxy is approved for the collection. Then call submit_rarible_listing.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: ['ethereum', 'base', 'polygon', 'arbitrum'], description: 'The chain the NFT is on.' },
        maker: { type: 'string', description: 'Your linked wallet that holds the NFT, 0x address.' },
        contract: { type: 'string', description: 'The NFT contract, 0x address.' },
        tokenId: { type: 'string', description: 'The token id, decimal.' },
        standard: { type: 'string', enum: ['erc721', 'erc1155'], description: 'The token standard.' },
        priceWei: { type: 'string', description: "Price in wei of the chain's native coin (ETH, or POL on Polygon) — not USD — as a decimal string." },
        days: { type: 'integer', minimum: 1, maximum: 180, description: 'How many days the listing stays up.' },
      },
      required: ['chain', 'maker', 'contract', 'tokenId', 'standard', 'priceWei', 'days'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/rarible/draft', args),
  },
  {
    name: 'submit_rarible_listing',
    description: "Submit a Rarible listing your wallet signed: the draft's order fields plus the signature. Crossly verifies the signature, posts the order to Rarible and records it.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: ['ethereum', 'base', 'polygon', 'arbitrum'], description: 'The chain, as drafted.' },
        maker: { type: 'string', description: 'The maker wallet, as drafted.' },
        contract: { type: 'string', description: 'The NFT contract, as drafted.' },
        tokenId: { type: 'string', description: 'The token id, as drafted.' },
        standard: { type: 'string', enum: ['erc721', 'erc1155'], description: 'The token standard, as drafted.' },
        priceWei: { type: 'string', description: 'Price in wei of the native coin (not USD), exactly as drafted.' },
        salt: { type: 'string', description: 'The salt from the draft.' },
        start: { type: 'integer', description: 'Start, unix seconds, from the draft.' },
        end: { type: 'integer', description: 'End, unix seconds, from the draft.' },
        signature: { type: 'string', description: "The wallet's EIP-712 signature over the drafted order, 0x hex." },
      },
      required: ['chain', 'maker', 'contract', 'tokenId', 'standard', 'priceWei', 'salt', 'start', 'end', 'signature'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/rarible/listings', args),
  },
  {
    name: 'list_web3_marketplace_keys',
    description: "Per NFT marketplace (OpenSea, Tensor, Magic Eden, Rarible): whether Crossly's own API key covers it, and your own key's last four characters if you added one.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/web3/marketplace-keys', {}),
  },
  {
    name: 'set_web3_marketplace_key',
    description:
      "Save your own API key for an NFT marketplace (optional: Crossly's key is used otherwise). It gives you your own rate limit there; your wallet still signs every order. Checked with the marketplace first where possible; stored encrypted.",
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: { type: 'string', enum: ['opensea', 'tensor', 'magic_eden', 'rarible'], description: 'Which marketplace the key is for.' },
        apiKey: { type: 'string', description: 'The API key the marketplace issued you.' },
      },
      required: ['marketplace', 'apiKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { marketplace, ...body } = args as Record<string, unknown> & { marketplace: string };
      return apiPut(`/v1/web3/marketplace-keys/${encodeURIComponent(marketplace)}`, body);
    },
  },
  {
    name: 'delete_web3_marketplace_key',
    description: "Remove your own API key for an NFT marketplace; Crossly's key is used again.",
    inputSchema: {
      type: 'object',
      properties: { marketplace: { type: 'string', enum: ['opensea', 'tensor', 'magic_eden', 'rarible'], description: 'Which marketplace.' } },
      required: ['marketplace'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { marketplace } = args as { marketplace: string };
      return apiDelete(`/v1/web3/marketplace-keys/${encodeURIComponent(marketplace)}`);
    },
  },
  {
    name: 'build_solana_offer_tx',
    description: "Build an unsigned bid (base64) on a Solana NFT on the Crossly book for your linked wallet to sign and send; the SOL goes into your Auction House escrow. Then call record_solana_offer. Standard (non-programmable) NFTs only.",
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The NFT mint address.' },
        buyer: { type: 'string', description: 'Your linked Solana wallet (base58).' },
        priceSol: { type: 'string', description: "Bid as a decimal amount of SOL, the chain's native currency, e.g. '1.5'; not lamports and not USD." },
        blockhash: { type: 'string', description: 'A recent blockhash (base58).' },
      },
      required: ['mint', 'buyer', 'priceSol', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/solana/offers/tx', args),
  },
  {
    name: 'record_solana_offer',
    description: 'Record a sent Solana bid; it is recorded only once its trade state exists on chain.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The NFT mint address.' },
        buyer: { type: 'string', description: 'Your linked Solana wallet (base58).' },
        priceSol: { type: 'string', description: "The bid as a decimal amount of SOL (native currency), exactly as built; not lamports and not USD." },
        signature: { type: 'string', description: 'The sent transaction signature.' },
      },
      required: ['mint', 'buyer', 'priceSol', 'signature'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/web3/solana/offers', args),
  },
  {
    name: 'build_solana_offer_cancel_tx',
    description: 'Build the cancel of your Solana bid (the SOL your other bids do not need comes back). Sign, send, then confirm_solana_offer with action cancel.',
    inputSchema: {
      type: 'object',
      properties: { hash: { type: 'string', description: 'The bid order hash (its trade state address).' }, blockhash: { type: 'string', description: 'A recent blockhash (base58).' } },
      required: ['hash', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { hash, ...body } = args as { hash: string; blockhash: string };
      return apiPost(`/v1/web3/solana/offers/${encodeURIComponent(hash)}/cancel-tx`, body);
    },
  },
  {
    name: 'build_solana_offer_accept_tx',
    description: 'Build the sale of your Solana NFT into a bid, from your linked wallet that holds it (one transaction). Sign, send, then confirm_solana_offer with action accept.',
    inputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'The bid order hash.' },
        seller: { type: 'string', description: 'Your linked Solana wallet holding the NFT.' },
        blockhash: { type: 'string', description: 'A recent blockhash (base58).' },
      },
      required: ['hash', 'seller', 'blockhash'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { hash, ...body } = args as { hash: string; seller: string; blockhash: string };
      return apiPost(`/v1/web3/solana/offers/${encodeURIComponent(hash)}/accept-tx`, body);
    },
  },
  {
    name: 'confirm_solana_offer',
    description: 'Apply a sent Solana bid accept or cancel once the chain shows the bid closed.',
    inputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'The bid order hash.' },
        signature: { type: 'string', description: 'The sent transaction signature.' },
        action: { type: 'string', enum: ['accept', 'cancel'], description: "'accept' (you sold into it) or 'cancel' (you withdrew your bid)." },
        seller: { type: 'string', description: 'For accept: the selling wallet.' },
      },
      required: ['hash', 'signature', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { hash, ...body } = args as { hash: string; signature: string; action: string; seller?: string };
      return apiPost(`/v1/web3/solana/offers/${encodeURIComponent(hash)}/confirm`, body);
    },
  },
];
