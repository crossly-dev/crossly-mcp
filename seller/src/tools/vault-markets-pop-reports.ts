import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Grading population reports (api routes/v1/write/vault-markets-pop-reports.ts):
 * how many copies of a card each grader has graded at each grade, for one
 * Vault Markets market. Read-only; counts, never a price.
 */
export const vaultMarketsPopReportTools: ToolDef[] = [
  {
    name: 'get_vault_markets_pop_report',
    description:
      'The grading population report for one Vault Markets market. Returns focus (on a graded market: its grade, pop = copies graded at exactly that grade, higher = copies the same grader graded better, total = every copy that grader graded of the card, asOf = the report date YYYY-MM-DD, and source), ' +
      'graders (each grader ladder for the card, best grade first: gradeKey, grade, count and higher, from one report per grader, the newest, with the population feed beating a hand entry on the same date), provider.connected, ' +
      'and status: "ok" (a report to show), "not_synced" (the population feed knows the card but has not answered yet), "no_report" (nothing for this card) or "no_source" (no population feed is connected and nobody has entered a report), with explain saying what is missing in plain words. ' +
      'source is "provider" (the population feed) or "ops" (entered by Crossly from the grader published report). Counts only; it never shows a price and cannot place an order.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: {
          type: 'string',
          description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:NM:psa:10"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
        },
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/pop-reports', { bookKey });
    },
  },
];
