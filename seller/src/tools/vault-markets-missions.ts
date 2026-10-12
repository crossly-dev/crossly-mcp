import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets paper-trading missions (api routes/v1/write/vault-markets-missions.ts).
 * Guided practice built on paper trading. PLAY MONEY ONLY: the paper account
 * is never real and never convertible. Progress is observed by the server
 * from paper orders and fills, price watches, set goals and graded mark
 * checks; no tool marks a mission done. Missions earn world quest progress
 * and cosmetic pins, never money or CBX. Spread into vaultMarketsPaperTools.
 */
const PLAY = 'Play money only: never real money, never convertible. ';

export const vaultMarketsMissionsTools: ToolDef[] = [
  {
    name: 'list_vault_markets_paper_missions',
    description: `${PLAY}The user paper-trading missions: each with what to do (goal, how), count toward target, done and doneAt, and action (where to do it: "market", "paper", "mark_check", "assistant" or "sets"). meta.markCheck suggests a market for the "Read the mark" mission. Missions earn world quest pins only, never money.`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/paper/missions', {}),
  },
  {
    name: 'answer_vault_markets_mark_check',
    description: `${PLAY}Answer the "Read the mark" mission for the user: the quality letter they read beside a market mark, checked against the stored mark. One answer per market and 10 a day, so only send the letter the user read; never guess for them.`,
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'The market read: variantId:condition:gradeKey (gradeKey "-" when ungraded), usually meta.markCheck.suggestion.bookKey from list_vault_markets_paper_missions.' },
        quality: { type: 'string', enum: ['A', 'B', 'C'], description: 'The quality letter the user read: "A" (trade-anchored), "B" (two-sided firm mid) or "C" (indicative).' },
      },
      required: ['bookKey', 'quality'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, quality } = args as { bookKey: string; quality: string };
      return apiPost('/v1/vault-markets/paper/missions/mark-check', { bookKey, quality });
    },
  },
];
