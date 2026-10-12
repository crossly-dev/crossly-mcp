import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets portfolio margin for ECP firm accounts (api
 * routes/v1/write/vault-markets-pm.ts). The requirement is the worst loss
 * across a scenario grid on Crossly marks: each item by its tier range in 7
 * steps, category index shocks by beta, a CBX shock and a liquidity add-on,
 * never under 15% of gross. Firm sub-accounts only.
 */
export const vaultMarketsPmTools: ToolDef[] = [
  {
    name: 'get_vault_markets_portfolio_margin',
    description: 'Portfolio margin for a Vault Markets firm sub-account: eligibility with every reason (ECP attestation, KYB, minimum equity of 50000000 or 10000000 cents of US dollars), whether it is enrolled, the latest requirementCents, equityCents and excessCents (cents of US dollars), state ("healthy", "call" with 24 hours to fix, or "buy_in" when positions go to auction), the breakdown by category and item, partner index futures counted, and the policy in plain words. Before enrolling it shows a live preview.',
    inputSchema: { type: 'object', properties: { subaccountId: { type: 'string', description: 'Firm sub-account id (uuid), from list_vault_markets_accounts.' } }, required: ['subaccountId'], additionalProperties: false },
    handler: (args) => {
      const { subaccountId } = args as { subaccountId: string };
      return apiGet('/v1/vault-markets/portfolio-margin', { subaccountId });
    },
  },
  {
    name: 'list_vault_markets_portfolio_margin_history',
    description: 'The 5-minute portfolio margin recalculations of a Vault Markets firm sub-account, newest first: equityCents, requirementCents, excessCents, scenarioCents, floorCents and grossCents (all cents of US dollars) and state ("healthy", "call" or "buy_in").',
    inputSchema: {
      type: 'object',
      properties: {
        subaccountId: { type: 'string', description: 'Firm sub-account id (uuid), from list_vault_markets_accounts.' },
        hours: { type: 'integer', minimum: 1, maximum: 720, description: 'How many hours back to read (default 24, at most 720).' },
      },
      required: ['subaccountId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { subaccountId, hours } = args as { subaccountId: string; hours?: number };
      return apiGet('/v1/vault-markets/portfolio-margin/history', { subaccountId, hours });
    },
  },
  {
    name: 'enroll_vault_markets_portfolio_margin',
    description: 'Admin only: put a Vault Markets firm sub-account under portfolio margin. Needs the leverage venue registered, a verified ID, an entity that attested it is an eligible contract participant and passed KYB, and the minimum equity. Positions are then margined on the whole account, recalculated every 5 minutes; calls and auctions work as before. Audited.',
    inputSchema: { type: 'object', properties: { subaccountId: { type: 'string', description: 'Firm sub-account id (uuid), from list_vault_markets_accounts.' } }, required: ['subaccountId'], additionalProperties: false },
    handler: (args) => {
      const { subaccountId } = args as { subaccountId: string };
      return apiPost('/v1/vault-markets/portfolio-margin/enroll', { subaccountId });
    },
  },
  {
    name: 'leave_vault_markets_portfolio_margin',
    description: 'Admin only: take a Vault Markets firm sub-account off portfolio margin. Each position is then held to its own tier floors again and may be called straight away. Audited.',
    inputSchema: { type: 'object', properties: { subaccountId: { type: 'string', description: 'Firm sub-account id (uuid), from list_vault_markets_accounts.' } }, required: ['subaccountId'], additionalProperties: false },
    handler: (args) => {
      const { subaccountId } = args as { subaccountId: string };
      return apiPost('/v1/vault-markets/portfolio-margin/leave', { subaccountId });
    },
  },
  {
    name: 'vault_markets_portfolio_margin_what_if',
    description: 'The portfolio margin requirement of a Vault Markets firm sub-account before and after a trade, at the Crossly mark with fees left out (requirementCents, equityCents, excessCents and changeCents in cents of US dollars). Changes nothing and places no order.',
    inputSchema: {
      type: 'object',
      properties: {
        subaccountId: { type: 'string', description: 'Firm sub-account id (uuid), from list_vault_markets_accounts.' },
        bookKey: { type: 'string', description: 'The item book key, variantId:condition:gradeKey (gradeKey "-" when raw).' },
        side: { type: 'string', enum: ['buy', 'sell'], description: '"buy" adds units; "sell" removes held units or goes short.' },
        units: { type: 'integer', minimum: 1, maximum: 10000, description: 'How many units.' },
      },
      required: ['subaccountId', 'bookKey', 'side', 'units'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { subaccountId, bookKey, side, units } = args as { subaccountId: string; bookKey: string; side: 'buy' | 'sell'; units: number };
      return apiPost('/v1/vault-markets/portfolio-margin/what-if', { subaccountId, bookKey, side, units });
    },
  },
];
