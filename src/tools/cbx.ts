import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * CBX — cashback rails for a physical-goods marketplace.
 *
 * ── WHAT AN AGENT NEEDS TO UNDERSTAND BEFORE USING THESE ──────────────
 * Two of these tools move real money and one of them is irreversible, so
 * the descriptions say so plainly rather than reading as neutral CRUD.
 * Specifically:
 *
 *   accrue_cbx           creates a liability. Idempotent ONLY if you pass
 *                        sourceExternalId.
 *   reverse_cbx_accrual  works while pending, fails once converted.
 *   create_cbx_claim     debits a balance and queues a transfer OFF the
 *                        platform. Not reversible once confirmed.
 *   execute_cbx_campaign distributes a pool to many users at once.
 *
 * ── AMOUNTS ───────────────────────────────────────────────────────────
 * Cents are plain integers. TOKEN amounts are decimal STRINGS of base
 * units, because a balance can exceed what a JSON number holds exactly.
 * Never convert a token amount through a float before displaying it.
 */
export const cbxTools: ToolDef[] = [
  {
    name: 'get_cbx_account',
    description:
      'Which CBX merchant the configured key belongs to, and the exact terms it issues '
      + 'cashback on — earn rate, maturation window, claim minimum, withdrawal fee schedule, '
      + 'and whether external claims are enabled at all. Read this before quoting terms to a '
      + 'user: the rates are per-merchant and hard-coding Crossly\'s own would be wrong for '
      + 'any other marketplace.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/me'),
  },
  {
    name: 'create_cbx_subject',
    description:
      'Map one of the merchant\'s own user ids to a CBX subject id. Idempotent — calling it '
      + 'again with the same externalUserId returns the same subject. Every other CBX tool '
      + 'takes the subjectId, never the merchant\'s own user id.',
    inputSchema: {
      type: 'object',
      properties: {
        externalUserId: {
          type: 'string',
          description: "The merchant's own id for this user. Opaque to CBX.",
        },
      },
      required: ['externalUserId'],
    },
    handler: (args) => apiPost('/v1/cbx/subjects', args),
  },
  {
    name: 'accrue_cbx',
    description:
      'Record cashback a user earned, in cents. CREATES A LIABILITY — the merchant now owes '
      + 'this. The accrual stays PENDING and dollar-denominated until its maturation window '
      + 'closes, then converts to tokens at that moment\'s market price. '
      + 'ALWAYS pass sourceExternalId (the merchant\'s own order or accrual id): it is what '
      + 'makes a retry a no-op instead of a second credit. Without it, a retried call accrues '
      + 'twice. A duplicate returns { duplicate: true } rather than an error.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'From create_cbx_subject.' },
        cents: {
          type: 'number',
          description: 'Positive whole cents the user earned.',
        },
        sourceExternalId: {
          type: 'string',
          description:
            "The merchant's own id for this accrual. STRONGLY RECOMMENDED — it is the "
            + 'idempotency key. Omitting it makes a retry a double credit.',
        },
        maturationDays: {
          type: 'number',
          description:
            "Override the merchant's configured window. Must be at least as long as their "
            + 'refund window, because after conversion there is no clawback.',
        },
      },
      required: ['subjectId', 'cents'],
    },
    handler: (args) => apiPost('/v1/cbx/accruals', args),
  },
  {
    name: 'reverse_cbx_accrual',
    description:
      'Claw back a PENDING accrual — a refund, cancellation, or fraud. Returns 409 once the '
      + 'accrual has converted, because by then the value is tokens in somebody\'s balance and '
      + 'reversing it is a debit against that balance rather than a state change. If this '
      + 'fails with state "converted", the refund has to be handled another way.',
    inputSchema: {
      type: 'object',
      properties: {
        accrualId: {
          type: 'string',
          description: 'The accrual to claw back. Must still be PENDING.',
        },
        reason: { type: 'string', description: 'Recorded on the accrual as the audit trail.' },
      },
      required: ['accrualId', 'reason'],
    },
    handler: (args) => {
      const { accrualId, ...body } = args as { accrualId: string; reason: string };
      return apiPost(`/v1/cbx/accruals/${encodeURIComponent(accrualId)}/reverse`, body);
    },
  },
  {
    name: 'spend_cbx',
    description:
      "Redeem a user's CBX against an order. DEBITS THEIR BALANCE. "
      + 'The user is charged exactly what they spend — the skim is never added on top, and '
      + "it comes out of the MERCHANT's fee on the order, capped against it. "
      + 'ALWAYS pass externalId (your order id): it makes a retried checkout a no-op '
      + 'instead of debiting the user twice, and checkouts retry. '
      + 'Spending is free and has no minimum, unlike withdrawing — if a user is choosing '
      + 'between spending and withdrawing, spending is cheaper for them and better for the '
      + 'merchant, and it is worth saying so.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject id, from create_cbx_subject. Not the merchant own user id.',
        },
        baseUnits: { type: 'string', description: 'Base units as a decimal string.' },
        crosslyFeeCentsOnOrder: {
          type: 'number',
          description:
            "The merchant's fee on this order in cents. The margin the skim is funded "
            + 'from and capped against. Zero is legitimate and yields no skim.',
        },
        externalId: {
          type: 'string',
          description: 'REQUIRED. Your order id — the idempotency key.',
        },
        centsPerToken: { type: 'number', description: 'Override the oracle spot. Normally omit.' },
      },
      required: ['subjectId', 'baseUnits', 'crosslyFeeCentsOnOrder', 'externalId'],
    },
    handler: (args) => apiPost('/v1/cbx/spends', args),
  },
  {
    name: 'reverse_cbx_spend',
    description:
      'Refund a spend. Returns the tokens to the user AND claws the skim back out of both '
      + 'the community pool and operator revenue — all three move together, because '
      + 'returning the tokens while the others kept their shares would count the same '
      + 'tokens twice against one reserve. The spend also stops counting as campaign '
      + 'activity, so buy-then-refund cannot farm distributions.',
    inputSchema: {
      type: 'object',
      properties: {
        externalId: { type: 'string', description: 'The order id used when spending.' },
        reason: {
          type: 'string',
          description: 'Why the spend is being refunded. Stored on the row.',
        },
      },
      required: ['externalId', 'reason'],
    },
    handler: (args) => {
      const { externalId, ...body } = args as { externalId: string; reason: string };
      return apiPost(`/v1/cbx/spends/${encodeURIComponent(externalId)}/reverse`, body);
    },
  },
  {
    name: 'get_cbx_spent',
    description: "Total CBX a subject has spent in the merchant's marketplace.",
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: "The CBX subject id, from create_cbx_subject. Not the merchant's own user id.",
        },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/spent`);
    },
  },
  {
    name: 'get_cbx_revenue',
    description:
      'Operator revenue accrued and NOT yet withdrawn, in CBX — the share of the spend '
      + 'skim plus half the withdrawal fees. It sits inside the reserve until swept, which '
      + 'is why it is tracked separately: without a number saying how much of the reserve '
      + "is the operator's, there is no safe amount to take out.",
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/revenue'),
  },
  {
    name: 'sweep_cbx_revenue',
    description:
      'Move accrued revenue from the reserve to the operator revenue wallet. MOVES REAL '
      + 'VALUE on chain. '
      + 'Moves at most what is genuinely free — reserve minus outstanding user balances, '
      + 'minus claims in flight, minus the community pool, minus unswept revenue. If the '
      + 'reserve is SHORT it moves nothing regardless of what is accrued: an under-covered '
      + 'reserve is not a reason to stop paying users, it is a reason to stop paying '
      + 'ourselves. '
      + 'Call with dryRun first and surface the breakdown — "why did it sweep nothing" is '
      + 'answered by the individual terms, not by the total.',
    inputSchema: {
      type: 'object',
      properties: {
        maxBaseUnits: { type: 'string', description: 'Cap the sweep. Omit to move everything free.' },
        dryRun: { type: 'boolean', description: 'Report the arithmetic without moving tokens.' },
      },
    },
    handler: (args) => apiPost('/v1/cbx/revenue/sweep', args ?? {}),
  },
  {
    name: 'get_cbx_balance',
    description:
      'What a subject holds. TWO numbers, and they are different things: `pendingCents` is '
      + 'earned but still inside its reversal window — dollars, not tokens, and still '
      + 'clawback-able. `availableBaseUnits` is CBX they hold now, as a decimal STRING of base '
      + 'units. Do not add them together; do not parse the token amount as a float.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: "The CBX subject id, from create_cbx_subject. Not the merchant's own user id.",
        },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/balance`);
    },
  },
  {
    name: 'get_cbx_ledger',
    description:
      "A subject's append-only CBX ledger, newest first. The balance is the sum of these rows; "
      + 'there is no cached balance anywhere that could disagree with them.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject id, from create_cbx_subject. Not the merchant own user id.',
        },
        limit: { type: 'number', description: '1-200, default 50.' },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId, ...query } = args as { subjectId: string; limit?: number };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/ledger`, query);
    },
  },
  {
    name: 'get_cbx_treasury',
    description:
      "The merchant's latest reserve reconciliation. `coverageBps` is their reserve measured "
      + 'against what they owe users, including claims in flight — 10000 is exactly 100%. Below '
      + 'the required floor, CONVERSIONS STOP (balances are never credited against tokens that '
      + 'do not exist) while claims and spends keep working, because those move value out and '
      + 'improve coverage. If `ok` is false, that is the thing to surface.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/treasury'),
  },
  {
    name: 'get_cbx_pool',
    description:
      "The merchant's events-pool balance, in base units as a string. Funded by the skim on "
      + 'in-marketplace CBX spending, the community share of withdrawal fees, and lapsed '
      + 'balances. This is what campaigns distribute.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/pool'),
  },
  {
    name: 'get_cbx_wallet',
    description:
      'The verified payout address for a subject, or null if they have not registered and '
      + 'proved one. A claim cannot be created until this returns an address — payouts go only '
      + 'to an address the subject cryptographically proved they control.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: "The CBX subject id, from create_cbx_subject. Not the merchant's own user id.",
        },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/wallet`);
    },
  },
  {
    name: 'start_cbx_wallet_verification',
    description:
      'Begin proving a subject controls a payout address. Returns a `message` that a HUMAN must '
      + 'sign with their wallet — an agent cannot do this step, and should present the message '
      + 'text verbatim and wait for the signature. '
      + 'The signature is required because there is no custody here: a payout cannot be undone, '
      + 'so a typo or an address swapped by a phishing page is permanent. The message binds the '
      + 'merchant, subject, address and a single-use nonce, so it is not reusable elsewhere. '
      + 'Calling this replaces any previously registered address for that subject.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject id, from create_cbx_subject. Not the merchant own user id.',
        },
        address: { type: 'string', description: 'The Solana address the user wants paid to.' },
      },
      required: ['subjectId', 'address'],
    },
    handler: (args) => apiPost('/v1/cbx/wallets/challenge', args),
  },
  {
    name: 'complete_cbx_wallet_verification',
    description:
      'Finish verification by submitting the signature the user produced over the message from '
      + 'start_cbx_wallet_verification. The nonce is single-use, so a signature cannot be '
      + 'replayed later to re-verify an address that was since replaced. A failure returns a '
      + 'reason (nonce_expired, nonce_consumed, signature_mismatch, bad_address) — surface it '
      + 'rather than retrying blindly, since each one needs a different fix.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject id, from create_cbx_subject. Not the merchant own user id.',
        },
        walletId: { type: 'string', description: 'From start_cbx_wallet_verification.' },
        signature: { type: 'string', description: 'Base58 signature over the issued message.' },
      },
      required: ['subjectId', 'walletId', 'signature'],
    },
    handler: (args) => apiPost('/v1/cbx/wallets/verify', args),
  },
  {
    name: 'quote_cbx_claim',
    description:
      'What a withdrawal would cost, WITHOUT committing to it. Use this to show a user the fee '
      + 'breakdown before they confirm — a payout that arrives smaller than expected with no '
      + 'prior breakdown reads as shaving. The network fee is at actual cost and includes a '
      + 'one-time account rent when the recipient has no token account yet; that rent is a '
      + 'recoverable deposit on an account the USER owns, not a fee anybody keeps.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject id, from create_cbx_subject. Not the merchant own user id.',
        },
        baseUnits: { type: 'string', description: 'Gross amount to withdraw, base units as a string.' },
        centsPerToken: { type: 'number', description: 'Current price, integer cents per token.' },
        networkCostCents: { type: 'number', description: 'Estimated network cost in cents.' },
      },
      required: ['subjectId', 'baseUnits', 'centsPerToken'],
    },
    handler: (args) => apiPost('/v1/cbx/claims/quote', args),
  },
  {
    name: 'create_cbx_claim',
    description:
      'Reserve a withdrawal. DEBITS THE BALANCE IMMEDIATELY and queues a transfer off the '
      + 'platform. Call quote_cbx_claim first and confirm with the user. '
      + 'There is NO destination parameter — payouts go only to the address the subject '
      + 'registered and cryptographically proved they control, which is why a compromised key '
      + 'cannot redirect anybody\'s balance. Pass an idempotencyKey; a retry with the same key '
      + 'returns the original claim rather than debiting twice.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject id, from create_cbx_subject. Not the merchant own user id.',
        },
        baseUnits: {
          type: 'string',
          description:
            'Gross tokens to withdraw, as a decimal STRING of base units. Fees come out of '
            + 'this, so the user receives less than this amount.',
        },
        centsPerToken: {
          type: 'number',
          description:
            'The spot used to price this claim, in CENTS per whole token. It is what converts '
            + "the dollar-denominated fee floor and cap into this claim's token amounts.",
        },
        networkCostCents: {
          type: 'number',
          description:
            'Live network cost of the transfer, in CENTS — the transaction fee plus, only when '
            + 'the recipient has no token account yet, the one-time account rent. Passed '
            + 'through at cost with no markup.',
        },
        idempotencyKey: {
          type: 'string',
          description: 'REQUIRED. A retry with the same key will not debit twice.',
        },
      },
      required: ['subjectId', 'baseUnits', 'centsPerToken', 'idempotencyKey'],
    },
    handler: (args) => apiPost('/v1/cbx/claims', args),
  },
  {
    name: 'send_cbx_claim',
    description:
      'Send a reserved claim on chain. IRREVERSIBLE once confirmed. '
      + 'A status of `unconfirmed` means the transfer may have landed but confirmation was not '
      + 'observed — DO NOT retry it. Retrying an unconfirmed transfer is how a claim gets paid '
      + 'twice; it must be reconciled against the chain first.',
    inputSchema: {
      type: 'object',
      properties: {
        claimId: {
          type: 'string',
          description: "The claim, from create_cbx_claim.",
        },
      },
      required: ['claimId'],
    },
    handler: (args) => {
      const { claimId } = args as { claimId: string };
      return apiPost(`/v1/cbx/claims/${encodeURIComponent(claimId)}/send`, {});
    },
  },
  {
    name: 'get_cbx_claim',
    description: "A claim's current state, transaction signature, and failure reason if any.",
    inputSchema: {
      type: 'object',
      properties: {
        claimId: {
          type: 'string',
          description: "The claim, from create_cbx_claim.",
        },
      },
      required: ['claimId'],
    },
    handler: (args) => {
      const { claimId } = args as { claimId: string };
      return apiGet(`/v1/cbx/claims/${encodeURIComponent(claimId)}`);
    },
  },
  {
    name: 'list_cbx_campaigns',
    description: "The merchant's pool distributions, newest first, with their current state.",
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/campaigns'),
  },
  {
    name: 'create_cbx_campaign',
    description:
      'Create a pool distribution in DRAFT. Nothing is paid until it is previewed, approved and '
      + 'executed. Weighting metrics all measure ACTIVITY inside the window '
      + '(accruals_count, accrued_cents, spend_count, spend_base_units) — there is deliberately '
      + 'no option to weight by balance held, because paying holders in proportion to holdings '
      + 'is a dividend on a passive position and rewards hoarding. '
      + 'Set capPerSubject on anything proportional: without it one large participant can take '
      + 'almost the entire pool.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Label for the campaign, shown to the merchant and in payout history.',
        },
        budgetBaseUnits: { type: 'string', description: 'Hard ceiling, base units as a string.' },
        windowStart: { type: 'string', description: 'ISO 8601.' },
        windowEnd: { type: 'string', description: 'ISO 8601.' },
        eligibility: {
          type: 'object',
          description: 'Optional gate, e.g. { minMetric: { metric: "accruals_count", value: 3 } }.',
        },
        weighting: {
          type: 'object',
          description:
            'Required. { metric, mode: "proportional"|"equal", capPerSubject? }. '
            + 'Metric must be one of accruals_count, accrued_cents, spend_count, spend_base_units.',
        },
      },
      required: ['name', 'budgetBaseUnits', 'windowStart', 'windowEnd', 'weighting'],
    },
    handler: (args) => apiPost('/v1/cbx/campaigns', args),
  },
  {
    name: 'preview_cbx_campaign',
    description:
      'Compute the recipient list WITHOUT paying it. Always do this before approving. '
      + 'An eligibility rule over a live dataset cannot be sized by reading it — the only way '
      + 'to know whether it pays fifty people or fifty thousand is to run it and look. '
      + 'Returns the recipients, the total, the pool balance, and a hash of the list. '
      + 'Re-previewing invalidates any prior approval by design.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: "The campaign, from list_cbx_campaigns.",
        },
      },
      required: ['campaignId'],
    },
    handler: (args) => {
      const { campaignId } = args as { campaignId: string };
      return apiPost(`/v1/cbx/campaigns/${encodeURIComponent(campaignId)}/preview`, {});
    },
  },
  {
    name: 'approve_cbx_campaign',
    description:
      'Approve the previewed recipient list. Approval is of THAT specific list — if the '
      + 'eligible set changes afterwards, execution will refuse and it has to be re-previewed '
      + 'and re-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: "The campaign, from list_cbx_campaigns.",
        },
      },
      required: ['campaignId'],
    },
    handler: (args) => {
      const { campaignId } = args as { campaignId: string };
      return apiPost(`/v1/cbx/campaigns/${encodeURIComponent(campaignId)}/approve`, {});
    },
  },
  {
    name: 'execute_cbx_campaign',
    description:
      'Pay an approved campaign. DISTRIBUTES REAL VALUE to many subjects at once. '
      + 'Refuses if the recipient list moved since approval. Pass an executionKey; a retry '
      + 'with the same key is a no-op rather than a second distribution. '
      + 'Payouts credit balances directly rather than transferring on chain, so a distribution '
      + 'to ten thousand recipients costs one internal move.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: 'The campaign, from list_cbx_campaigns.',
        },
        executionKey: {
          type: 'string',
          description: 'REQUIRED. Makes a retry a no-op instead of paying twice.',
        },
      },
      required: ['campaignId', 'executionKey'],
    },
    handler: (args) => {
      const { campaignId, ...body } = args as { campaignId: string; executionKey: string };
      return apiPost(`/v1/cbx/campaigns/${encodeURIComponent(campaignId)}/execute`, body);
    },
  },
  {
    name: 'get_cbx_campaign_payouts',
    description:
      'What a campaign actually paid, with the activity weight behind each amount. The weight '
      + 'is kept so a payout can be explained to the person who received it — "why did I get '
      + 'this much" should have a better answer than "the algorithm".',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: "The campaign, from list_cbx_campaigns.",
        },
      },
      required: ['campaignId'],
    },
    handler: (args) => {
      const { campaignId } = args as { campaignId: string };
      return apiGet(`/v1/cbx/campaigns/${encodeURIComponent(campaignId)}/payouts`);
    },
  },
];
