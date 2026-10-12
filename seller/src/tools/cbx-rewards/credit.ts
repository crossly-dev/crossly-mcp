import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardCredit: ToolDef[] = [
  {
    name: 'get_cbx_credit_line',
    description:
      'A seller\'s wholesale credit line. This is TRADE CREDIT, not token-collateralized '
      + 'lending: it is secured by receivables the platform already holds (the payout stream, '
      + 'under a hold with an exposure ceiling) and secondarily by goods bought from the '
      + 'platform\'s own wholesale channel. '
      + 'CBX is the alignment mechanism, not the collateral — a stake raises the limit and '
      + 'lowers the rate, bounded to a share of the earned limit. '
      + 'The limit may FALL, but a drawn balance is NEVER accelerated or margin-called. There '
      + 'is no liquidation engine. If a seller asks whether a price drop can call their loan, '
      + 'the answer is no.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerUserId: {
          type: 'string',
          description: "The Crossly seller's user id. Their payout history is the underwriting input.",
        },
      },
      required: ['sellerUserId'],
    },
    handler: (args) => {
      const { sellerUserId } = args as { sellerUserId: string };
      return apiGet(`/v1/cbx/credit?sellerUserId=${encodeURIComponent(sellerUserId)}`);
    },
  },
  {
    name: 'refresh_cbx_credit_line',
    description:
      'Recompute a seller\'s limit from trading history and stake. The earned limit is a share '
      + 'of trailing SETTLED payout volume — money that actually reached them, not listed '
      + 'inventory or projected sales. The stake bonus is capped at a share of that, so a '
      + 'seller with no history gets nothing however much they stake. '
      + 'A frozen line stays frozen: freezing is a credit decision somebody made.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerUserId: { type: 'string', description: "The Crossly seller's user id." },
      },
      required: ['sellerUserId'],
    },
    handler: (args) => apiPost('/v1/cbx/credit/refresh', args),
  },
  {
    name: 'draw_cbx_credit',
    description:
      'Draw against a credit line. ADVANCES REAL VALUE the seller will owe. '
      + 'The advance lands as GRANT balance: in-platform only, so it cannot be withdrawn or '
      + 'turned into cash. Restricted to wholesale channels, because the limit was sized on '
      + 'the theory that the advance buys goods that get sold and generate the payout stream '
      + 'repaying it. '
      + 'Refuses if the reserve has no unallocated tokens. Idempotent on externalId. '
      + 'Tell the seller the dueAt date.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerUserId: { type: 'string', description: "The Crossly seller's user id." },
        cents: {
          type: 'integer',
          description: 'Amount to advance, in CENTS. The seller will owe this in dollars.',
        },
        channel: {
          type: 'string',
          enum: ['wholesale_lot', 'supplier_order', 'bulk_purchase'],
          description:
            'Which wholesale channel the advance buys from. Restricted to these because '
            + 'the limit was sized on the theory that the advance buys goods that get sold '
            + 'and generate the payout stream repaying it.',
        },
        externalId: {
          type: 'string',
          description: 'Draw request or wholesale order id. Idempotency key.',
        },
      },
      required: ['sellerUserId', 'cents', 'channel', 'externalId'],
    },
    handler: (args) => apiPost('/v1/cbx/credit/draw', args),
  },
  {
    name: 'repay_cbx_credit',
    description:
      'Apply a repayment to a credit line. REDUCES A RECORDED DEBT — getting this wrong writes '
      + 'off real money owed to the platform, which is why it needs the treasury scope while a '
      + 'draw needs only spend. '
      + 'Clamped to what is outstanding: a payout larger than the debt would otherwise push the '
      + 'balance negative and read as credit nobody underwrote. Idempotent on externalId.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerUserId: { type: 'string', description: "The Crossly seller's user id." },
        cents: {
          type: 'integer',
          description: 'Amount repaid, in CENTS. Clamped to what is outstanding.',
        },
        kind: {
          type: 'string',
          enum: ['repay_payout', 'repay_invoice'],
          description:
            'repay_payout when a released seller payout was applied to the balance — the '
            + 'normal path. repay_invoice when the seller paid directly.',
        },
        externalId: {
          type: 'string',
          description: 'The payout or payment id. Idempotency key.',
        },
        purchaseId: {
          type: 'string',
          description: 'The purchase whose payout funded this, on a repay_payout.',
        },
      },
      required: ['sellerUserId', 'cents', 'kind', 'externalId'],
    },
    handler: (args) => apiPost('/v1/cbx/credit/repay', args),
  },
  {
    name: 'freeze_cbx_credit_line',
    description:
      'Stop new draws on a line. Leaves the drawn balance on its ORIGINAL terms — there is no '
      + 'mechanism to call or accelerate what has already been advanced, and this is the only '
      + 'lever over a line. A seller who took inventory on Tuesday keeps Tuesday\'s terms.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerUserId: { type: 'string', description: "The Crossly seller's user id." },
        reason: {
          type: 'string',
          description: 'Why the line is being frozen. Stored and shown to the seller.',
        },
      },
      required: ['sellerUserId', 'reason'],
    },
    handler: (args) => apiPost('/v1/cbx/credit/freeze', args),
  },
];
