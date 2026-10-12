import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets auto-deleveraging (api routes/v1/write/vault-markets-adl.ts).
 * The loss waterfall: a position's own money, then the insurance fund (at
 * most 25% of it for one event), then ADL: the most profitable, most
 * levered opposite position on the same item closes against the bankrupt one
 * at its bankruptcy price. Only then the market pool or Crossly operations;
 * never Crossly money. Reads only.
 */
export const vaultMarketsAdlTools: ToolDef[] = [
  {
    name: 'get_vault_markets_adl_fund',
    description: 'The Vault Markets insurance fund: insuranceFundCents (booked) and insuranceFreeCents (free to draw now), perEventCapCents (the most one loss may draw before auto-deleveraging starts), the waterfall in order, and the latest ADL events with no user or position ids. Money is in cents of US dollars.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/adl', {}),
  },
  {
    name: 'list_vault_markets_adl_ranks',
    description: 'Your live Vault Markets positions, each with its place in its item auto-deleveraging queue: lights 5 (first in line) to 1 (last), or 0 when not in the queue (only profitable positions are). Ranked by P&L percent times effective leverage; pnlBps is P&L over your own margin in basis points, effLeverageX100 is leverage times 100, markCents is in cents of US dollars.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/adl/positions', {}),
  },
  {
    name: 'get_vault_markets_adl_rank',
    description: 'One of your Vault Markets positions with its auto-deleveraging lights (5 first in line to 1 last; 0 when not in the queue or once it has ended).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Position id (uuid), from list_vault_markets_positions or list_vault_markets_adl_ranks.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/adl/positions/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'list_vault_markets_adl_events',
    description: 'The auto-deleveraging events your Vault Markets positions were part of, newest first. role is "bankrupt" (yours went under water) or "counterparty" (yours was first in line); priceCents is the bankruptcy price both closed at, cents is what the short paid the long (both in cents of US dollars); status is "pending" (waiting for the short sale proceeds to be final), "sent", "settled", "refused" (with Crossly operations), "reversed" (the custodian did not move the cash, so it was undone), "void" (nothing to give) or "unknown" (with Crossly operations); kind is "unit" or "cash".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/adl/events', {}),
  },
];
