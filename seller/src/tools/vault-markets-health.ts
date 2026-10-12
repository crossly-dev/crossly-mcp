import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets portfolio health for retail holders (api
 * routes/v1/write/vault-markets-health.ts). Describes what the user holds in
 * the Crossly vault at Crossly marks from the order book: concentration, value
 * by liquidity tier, a category stress grid, a what-if on one held item and
 * value by mark quality. Information only, never advice; places no order.
 */

export const vaultMarketsHealthTools: ToolDef[] = [
  {
    name: 'get_vault_portfolio_health',
    description: 'Portfolio health of the user vault holdings at Crossly marks. Returns: totals (valueCents in cents of US dollars, items, units, unitsOnLoan, unmarkedUnits, unlistedUnits); concentration by single item, category, grade and grader (each group with shareBps, plus hhi on 0 to 10000, band "empty", "spread", "moderate" or "concentrated", and effectiveCount); liquidity by tier ("A" continuous, "B" auctions every 15 min, "C" daily auction, "D" listings only, "unclassified"); a stress grid (each category and everything down 10, 20 and 30 percent: changeCents, vaultAfterCents, vaultChangeBps); value by mark quality ("A" trade-anchored, "B" firm book, "C" indicative, "none"); plain observations; and the held items (bookKey) a what-if can run on. Information only, not advice.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/health', {}),
  },
  {
    name: 'vault_portfolio_what_if',
    description: 'What if one item the user holds moved by moveBps on its mark: the item value, the vault total, the item and its category share of the vault, and the single-item HHI, before and after (money in cents of US dollars, shares in basis points). A scenario on the mark, not a price the item could be sold at. Fails with not found when the user holds none of that item.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'A book key the user holds, from the items list of get_vault_portfolio_health ("variantId:condition:grade", grade "-" when ungraded).' },
        moveBps: { type: 'integer', minimum: -10000, maximum: 10000, description: 'The move on the item mark, in basis points from -10000 to 10000 (-2000 = down 20 percent, 1500 = up 15 percent).' },
      },
      required: ['bookKey', 'moveBps'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, moveBps } = args as { bookKey: string; moveBps: number };
      return apiGet('/v1/vault-markets/health/what-if', { bookKey, moveBps });
    },
  },
];
