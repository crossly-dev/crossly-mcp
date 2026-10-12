import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets tax-loss suggestions (api routes/v1/write/vault-markets-tax-loss.ts).
 * Read only: lists the units the user holds whose mark is below their cost.
 * Nothing here sells; a sale goes through the ordinary order ticket. Not tax
 * advice, and the answer carries the disclosure to show the user.
 */
export const vaultMarketsTaxLossTools: ToolDef[] = [
  {
    name: 'get_vault_tax_loss_suggestions',
    description: 'Tax-loss suggestions from the vault markets tax centre: the units the user holds now whose mark (from the Crossly order book) is below what they cost. Each has its lot (acquiredAt, how it came in, basisCents), the term if sold today ("short" or "long", held more than a year = long), longTermOn and daysToLongTerm for a short lot, estLossCents (mark minus cost, negative, before selling fees), markQuality ("A", "B", "C" or "none"), a blocker in plain words when it cannot be sold right now, and sellHref (the ordinary sell ticket). Totals by term, gains realised so far this year, and a disclosure. All money is in cents of US dollars. Never sells anything. Not tax advice: always pass the disclosure on to the user.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/tax/loss-suggestions', {}),
  },
];
