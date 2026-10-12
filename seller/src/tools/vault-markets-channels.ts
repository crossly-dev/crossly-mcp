import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets channels (api routes/v1/write/vault-markets-growth-channels.ts):
 * the Telegram and nudge-cap switches, the weekly vault digest, a catalogue
 * item's vault value, a collection valued at the order book's display marks,
 * and ship-in deposits. Prices are display marks with a quality (A / B / C /
 * none); `cents: null` means no market yet.
 */
export const vaultMarketsChannelsTools: ToolDef[] = [
  {
    name: 'get_vault_markets_channels',
    description: 'Your Vault Markets channel switches: Telegram alerts and digest, the daily cap on vault nudges by push (default 5; margin calls and recalls are never capped), whether a Telegram chat is linked, and nudges sent today.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/channels', {}),
  },
  {
    name: 'update_vault_markets_channels',
    description: 'Change the Vault Markets channel switches. Returns the new view.',
    inputSchema: {
      type: 'object',
      properties: {
        telegramAlerts: { type: 'boolean', description: 'Copy vault alerts and account notices to the linked Telegram chat.' },
        telegramDigest: { type: 'boolean', description: 'Send the weekly vault digest to the linked Telegram chat.' },
        pushCapPerDay: { type: 'integer', minimum: 0, maximum: 20, description: 'Most vault nudges (price alerts, offers, first marks, the digest) by push per day.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { telegramAlerts, telegramDigest, pushCapPerDay } = args as { telegramAlerts?: boolean; telegramDigest?: boolean; pushCapPerDay?: number };
      return apiPut('/v1/vault-markets/channels', { telegramAlerts, telegramDigest, pushCapPerDay });
    },
  },
  {
    name: 'preview_vault_markets_digest',
    description: "This week's vault digest as it would go out: units at the display marks (unmarked units counted, not valued), the like-for-like change from a week ago, offers on your units, watched items that got a first mark, and one Learn card. Returns { week, value, offers, firstMarks, learn, lines }.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/digest/preview', {}),
  },
  {
    name: 'list_vault_markets_digests',
    description: 'Your past weekly vault digests: week, status (sent / skipped / failed), the channels used and a summary.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/digest/history', {}),
  },
  {
    name: 'get_vault_value_for_item',
    description: "What a catalogue item is worth in the vault: each vault book key's display mark with quality and n, units in the vault, the Instant Exit price a holder gets now, and whether it can be shipped in. Answer 'what is my item worth in the vault'.",
    inputSchema: {
      type: 'object',
      properties: {
        skuId: { type: 'string', description: 'Catalogue item id (uuid).' },
        variantId: { type: 'string', description: 'Optional: one variant (size, printing) of the item (uuid).' },
      },
      required: ['skuId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { skuId, variantId } = args as { skuId: string; variantId?: string };
      return apiGet('/v1/vault-markets/value', variantId ? { skuId, variantId } : { skuId });
    },
  },
  {
    name: 'get_vault_collection_worth',
    description: "What your collection is worth at the vault book's display marks. Items with no mark or no catalogue match are counted, never valued. Returns { data, meta: { totals } }.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/collection-worth', {}),
  },
  {
    name: 'watch_vault_collection',
    description: 'Add every collection item that sits on a vault book key to your Vault Markets watchlist. Returns { watched, skipped }.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiPost('/v1/vault-markets/collection-worth/watch', {}),
  },
  {
    name: 'open_vault_deposit',
    description: 'Open a ship-in deposit for an ungraded catalogue item. It is inbound until the vault receives and checks it, then stored in your name. Nothing is listed or sold. Returns { vaultItem: { id, status } }.',
    inputSchema: {
      type: 'object',
      properties: {
        skuId: { type: 'string', description: 'Catalogue item id (uuid).' },
        variantId: { type: 'string', description: 'The variant (size, printing) id (uuid).' },
        condition: { type: 'string', enum: ['DS', 'VNDS', 'Used'], description: 'DS = deadstock (default), VNDS = very near deadstock, Used.' },
      },
      required: ['skuId', 'variantId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { skuId, variantId, condition } = args as { skuId: string; variantId: string; condition?: string };
      return apiPost('/v1/vault-markets/deposits', { skuId, variantId, condition });
    },
  },
];
