import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The CBX ad-credit ledger.
 *
 * This file started with six tools for routes that had an SDK method and no
 * MCP tool. Five of them — the disbursement rules and the earn/stake tier
 * creators — landed independently in cbx-rewards.ts, so only this one is
 * left rather than shipping two tools per route.
 */
export const cbxOpsTools: ToolDef[] = [
  {
    name: 'list_cbx_ad_credit_ledger',
    description:
      'Ad-credit movements for this merchant, newest first. Append-only and there is no refund '
      + 'kind: a correction is another entry, so the history is never rewritten. Ad credit is '
      + 'GRANTED balance — in-platform advertising spend only, never withdrawable.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/ad-credit/ledger'),
  },
  {
    name: 'register_cbx_reserve',
    description:
      'Register the merchant reserve token account after granting the platform payout key an '
      + 'SPL allowance on it. Only the address is sent; mint, delegate and allowance are read from '
      + 'the chain and a mismatch is refused. Needs treasury scope.',
    inputSchema: {
      type: 'object',
      properties: {
        reserveTokenAccount: { type: 'string', description: 'The reserve SPL token account address.' },
        approveTxSig: { type: 'string', description: 'Signature of the approve transaction, for the record.' },
      },
      required: ['reserveTokenAccount'],
    },
    handler: (args: Record<string, unknown>) => apiPost('/v1/cbx/reserve', args),
  },
];
