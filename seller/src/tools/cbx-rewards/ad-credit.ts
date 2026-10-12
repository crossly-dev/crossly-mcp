import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardAdCredit: ToolDef[] = [
  {
    name: 'get_cbx_ad_credit',
    description:
      'Unspent advertising budget, in cents. Advertising is payable in CBX and NOTHING ELSE — '
      + 'there is no dollar path. The budget is denominated in dollars, priced when the payment '
      + 'finalized, deliberately not held as a token quantity: a price move would otherwise '
      + 'silently change the budget the advertiser prepaid. '
      + 'Credit is spendable on advertising only and is NOT refundable to dollars or tokens. '
      + 'Never tell an advertiser they can cash it out.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/ad-credit'),
  },
  {
    name: 'quote_cbx_ad_credit',
    description:
      'How much advertising a given number of tokens buys. Credit is 1:1 with market value at '
      + 'confirmation — with CBX the only way to pay, there is nothing to discount against.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUnits: {
          type: 'string',
          description: 'Tokens to price, as a decimal STRING of base units.',
        },
      },
      required: ['baseUnits'],
    },
    handler: (args) => apiPost('/v1/cbx/ad-credit/quote', args),
  },
  {
    name: 'purchase_cbx_ad_credit',
    description:
      'Claim an advertising budget against a CBX transfer the advertiser already sent. '
      + 'They transfer to the merchant\'s reserve themselves and present the signature; the '
      + 'balance delta is read at FINALIZED commitment, because a merely confirmed transaction '
      + 'can still be dropped by a fork and this grants real advertising. '
      + 'ONE SIGNATURE CAN BE CLAIMED EXACTLY ONCE. '
      + 'A 409 means it has not finalized yet — retry. A 400 means it will never be claimable '
      + '(failed, wrong mint, wrong destination) and retrying will not help. '
      + 'Priced at claim time, not send time.',
    inputSchema: {
      type: 'object',
      properties: {
        txSig: { type: 'string', description: 'Signature of the transfer the advertiser sent.' },
      },
      required: ['txSig'],
    },
    handler: (args) => apiPost('/v1/cbx/ad-credit/purchase', args),
  },
  {
    name: 'spend_cbx_ad_credit',
    description:
      'Consume advertising budget for a billing period. Spends what the balance covers and '
      + 'reports the rest as shortfallCents — the campaign should stop there rather than '
      + 'running on credit that does not exist. '
      + '20% of what is spent moves to the community events pool and 80% is operator revenue; '
      + 'the split happens on SPEND rather than at purchase, because the pool\'s share is '
      + 'earned when the advertising is actually delivered. Idempotent on externalId.',
    inputSchema: {
      type: 'object',
      properties: {
        cents: {
          type: 'integer',
          description: 'Advertising to bill, in CENTS. Spends what the budget covers.',
        },
        externalId: { type: 'string', description: 'Billing period or campaign id. Idempotency key.' },
        memo: { type: 'string', description: 'Free-text note stored on the ledger row.' },
      },
      required: ['cents', 'externalId'],
    },
    handler: (args) => apiPost('/v1/cbx/ad-credit/spend', args),
  },
];
