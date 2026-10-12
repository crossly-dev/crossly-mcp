import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * One Vault Markets mark with everything behind it (api routes/v1/write/
 * vault-markets-marks.ts). Marks come from the Crossly order book only; an
 * implied input is named and never makes a mark usable for risk.
 */
export const vaultMarketsMarksTools: ToolDef[] = [
  {
    name: 'get_vault_markets_mark',
    description: 'One book key mark with everything behind it: cents (cents of US dollars), quality ("A" trade-anchored, "B" firm two-sided, "C" indicative, "none"), confidenceBps (basis points) and the band in cents, asOf, usableForRisk (judged for margin), impliedFrom (the related grade, the model median of the other sizes, or the index it took an implied input from; null when none), the stored inputs, and the learned relations it may be implied from.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'Book key: variantId:condition:gradeKey, with "-" as the grade when ungraded (from a vault market or position).' },
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet(`/v1/vault-markets/marks/${encodeURIComponent(bookKey)}`, {});
    },
  },
];
