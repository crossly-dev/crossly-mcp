import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets grading (api routes/v1/write/vault-markets-grading.ts): grade
 * a vault unit without taking it out. A raw unit on the grading hub's shelf
 * goes into a Grading Run (list_grading_runs) and comes back to the same vault
 * item with its grade. The slot is free; the saved card is charged only if
 * the run locks.
 */
export const vaultMarketsGradingTools: ToolDef[] = [
  {
    name: 'list_vault_markets_gradings',
    description: 'Your vault units sent to grading: where each card is in its run, and the grade once it is back.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/grading', {}),
  },
  {
    name: 'send_vault_markets_unit_grading',
    description: "Send a raw vault unit on the grading hub's shelf to a Grading Run. It is held until it comes back, graded, to the same vault item. The slot is free; your saved card is charged only if the run locks. Returns { submissionId, vaultItemId, status }.",
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: { type: 'string', description: 'Vault unit id (uuid) of the raw card to grade.' },
        runId: { type: 'string', description: 'Grading Run id (uuid), from list_grading_runs.' },
        declaredValueCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: "What the card is worth, in cents of US dollars (the currency), for the grader's tier limit and insurance. Default: its mark." },
        prescreen: { type: 'boolean', description: 'true = a person checks centering and surface before the grader sees it, for a fee.' },
        missMode: {
          type: 'string',
          enum: ['roll_over', 'release'],
          description: 'If the run misses its minimum: "roll_over" = move the card into the next open run at this tier (the default); "release" = take it out of grading, back on the shelf.',
        },
      },
      required: ['vaultItemId', 'runId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, runId, declaredValueCents, prescreen, missMode } = args as {
        vaultItemId: string; runId: string; declaredValueCents?: number; prescreen?: boolean; missMode?: string;
      };
      return apiPost('/v1/vault-markets/grading', { vaultItemId, runId, declaredValueCents, prescreen, missMode });
    },
  },
  {
    name: 'pull_vault_markets_grading_unit',
    description: 'Pull a vault unit out of its Grading Run before the run locks (nothing was charged). It goes back on the shelf. Returns { status }.',
    inputSchema: {
      type: 'object',
      properties: { submissionId: { type: 'string', description: 'The grading submission id (uuid), from list_vault_markets_gradings or send_vault_markets_unit_grading.' } },
      required: ['submissionId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { submissionId } = args as { submissionId: string };
      return apiPost(`/v1/vault-markets/grading/${encodeURIComponent(submissionId)}/pull`, {});
    },
  },
];
