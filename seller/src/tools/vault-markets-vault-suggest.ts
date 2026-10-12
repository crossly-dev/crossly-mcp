import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets: "What should I vault?" (api
 * routes/v1/write/vault-markets-vault-suggest.ts). Read only and inform only:
 * the user's inventory items whose book key has a liquid vault market, ranked,
 * each with the market, Instant Exit now and the vault fee. Sending is
 * send_inventory_to_vault (POST /v1/vault-markets/supply/send), only when the user asks.
 */
export const vaultMarketsVaultSuggestTools: ToolDef[] = [
  {
    name: 'list_vault_suggestions',
    description: 'What to send to the vault: the user inventory items whose book key has a liquid vault market (liquidity tier A, B or C), best first. Each has a score from 0 to 100 with its reasons, the market (tier, mark and its quality, best bid, best vault ask, spread in basis points), Instant Exit now, the list price, days listed without selling, and the vault fee. Prices are from the Crossly order book; money is in cents of US dollars. Inform only, never advice: send with send_inventory_to_vault only when the user asks.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many suggestions to return, 1 to 100 (default 25).' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { limit } = args as { limit?: number };
      return apiGet('/v1/vault-markets/vault-suggestions', limit != null ? { limit: String(limit) } : {});
    },
  },
  {
    name: 'get_vault_suggestion_for_item',
    description: 'One inventory item: its vault suggestion, or in plain words why there is none. status is one of: suggested, not_found, no_stock, not_matched (no catalogue match), in_vault (already sent) or no_market (no liquid vault market for its key).',
    inputSchema: {
      type: 'object',
      properties: { inventoryItemId: { type: 'string', description: 'The inventory item id (uuid).' } },
      required: ['inventoryItemId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { inventoryItemId } = args as { inventoryItemId: string };
      return apiGet(`/v1/vault-markets/vault-suggestions/items/${encodeURIComponent(inventoryItemId)}`, {});
    },
  },
];
