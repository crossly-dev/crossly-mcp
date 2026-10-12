import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets large-trader reports (api routes/v1/write/vault-markets-reports.ts).
 * A group of linked accounts (one party) over 25% of an item's vault units,
 * or $100,000 of it at the mark, files a short report about the position;
 * Crossly ops then review it. Filing never moves money, never blocks a trade
 * and never changes a mark.
 */
export const vaultMarketsReportsTools: ToolDef[] = [
  {
    name: 'list_vault_markets_large_trader_reports',
    description: 'Your large-trader reports (with any linked accounts, as one party): due first, then filed, then cleared in the last 90 days. Each has action: "file" (not filed yet), "amend" (filed, not reviewed), "refile" (reviewed; a new filing goes back for review) or "none" (cleared). notionalCents is in cents of US dollars.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/large-trader-reports', {}),
  },
  {
    name: 'file_vault_markets_large_trader_report',
    description: 'File, amend or refile a large-trader report about a position. Returns the report.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Large-trader report id (uuid), from list_vault_markets_large_trader_reports.' },
        purpose: {
          type: 'string',
          enum: ['collecting', 'investment', 'resale', 'market_making', 'hedging', 'other'],
          description: 'Why you hold this much: "collecting" (to keep), "investment" (to hold for value), "resale" (to sell on), "market_making" (quoting both sides), "hedging" (against another position), "other" (say in the statement).',
        },
        actingFor: {
          type: 'string',
          enum: ['self', 'entity', 'clients'],
          description: 'Who you act for: "self" (yourself), "entity" (a company or fund you control), "clients" (other people).',
        },
        entityName: { type: ['string', 'null'], description: 'The entity or clients you act for (required when actingFor is "entity" or "clients"; up to 200 characters).' },
        otherAccounts: { type: ['string', 'null'], description: 'Other Crossly accounts you control or act with (free text, up to 1,000 characters).' },
        intendsToAdd: { type: ['boolean', 'null'], description: 'Whether you plan to add more to this position.' },
        statement: { type: 'string', minLength: 20, maxLength: 4000, description: 'A few sentences about the position in your own words (20 to 4,000 characters).' },
      },
      required: ['id', 'purpose', 'actingFor', 'statement'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, purpose, actingFor, entityName, otherAccounts, intendsToAdd, statement } = args as {
        id: string; purpose: string; actingFor: string; entityName?: string | null; otherAccounts?: string | null; intendsToAdd?: boolean | null; statement: string;
      };
      return apiPost(`/v1/vault-markets/large-trader-reports/${encodeURIComponent(id)}/file`, { purpose, actingFor, entityName, otherAccounts, intendsToAdd, statement });
    },
  },
];
