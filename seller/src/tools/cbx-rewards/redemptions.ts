import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardRedemptions: ToolDef[] = [
  {
    name: 'list_cbx_redeemable_services',
    description:
      'Services payable in CBX, and the discount each carries. Paying in CBX costs less than '
      + 'paying in dollars, which is what makes anybody choose it. These are real services '
      + 'with real cost behind them — grading, authentication, evidence sealing, listing '
      + 'promotion, subscriptions.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/redemptions/services'),
  },
  {
    name: 'quote_cbx_redemption',
    description:
      'What a service costs in tokens right now. Fails with 409 when there is no fresh price: '
      + 'a dollar-priced service has no honest token quantity without a spot, and guessing '
      + 'would either overcharge the user or undercharge the operator. Retry later rather than '
      + 'inventing a number.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceKind: {
          type: 'string',
          description:
            'Which service, from list_cbx_redeemable_services — e.g. subscription. '
            + 'grading and authentication are listed but refused (paid out in dollars).',
        },
        listPriceCents: {
          type: 'integer',
          description: 'The dollar list price in CENTS, before the pay-in-CBX discount.',
        },
      },
      required: ['serviceKind', 'listPriceCents'],
    },
    handler: (args) => apiPost('/v1/cbx/redemptions/quote', args),
  },
  {
    name: 'redeem_cbx_service',
    description:
      'Pay for a service in CBX. DEBITS THE USER\'S BALANCE. '
      + 'Staked tokens cannot pay — the debit checks spendable balance, not total. '
      + 'Idempotent on (serviceKind, externalId) rather than externalId alone, because a '
      + 'grading submission and a listing boost can share an id when they refer to the same '
      + 'item.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id being debited.' },
        serviceKind: {
          type: 'string',
          description: 'Which service, from list_cbx_redeemable_services.',
        },
        listPriceCents: {
          type: 'integer',
          description: 'The dollar list price in CENTS, before the pay-in-CBX discount.',
        },
        externalId: { type: 'string', description: "The merchant's id for the thing paid for." },
      },
      required: ['subjectId', 'serviceKind', 'listPriceCents', 'externalId'],
    },
    handler: (args) => apiPost('/v1/cbx/redemptions', args),
  },
];
