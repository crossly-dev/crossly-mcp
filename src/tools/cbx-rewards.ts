import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * CBX rewards, staking, advertising, balances, and wholesale credit.
 *
 * Split from `cbx.ts` to stay under the repo's file-size cap, and
 * registered alongside it.
 *
 * ── WHAT AN AGENT MUST UNDERSTAND BEFORE USING THESE ──────────────────
 * Several of these commit money forward or move it, and the descriptions
 * say so rather than reading as neutral CRUD:
 *
 *   create_cbx_boost         commits a merchant's budget to cashback.
 *   stake_cbx                makes a user's balance UNSPENDABLE. It is
 *                            their money and this locks it.
 *   redeem_cbx_service       debits a user for a service.
 *   purchase_cbx_ad_credit   claims an advertising budget against a
 *                            token transfer. One signature, one claim.
 *   draw_cbx_credit          advances real value against a credit line.
 *   grant_cbx                issues spendable value out of the reserve.
 *
 * ── THE THREE BALANCES ────────────────────────────────────────────────
 * A subject can hold three, and they are not interchangeable:
 *
 *   EARNED     cashback. Withdrawable once matured.
 *   GRANTED    ad credit, wholesale draws, promos. Spendable in the
 *              marketplace ONLY — never withdrawable.
 *   CONNECTED  the user's own self-custodied CBX, via a bounded
 *              delegation. Never a platform liability.
 *
 * Spends always consume granted → earned → connected, and that order is
 * not configurable. Never tell a user their granted balance can be
 * withdrawn or cashed out; it cannot, by construction.
 *
 * ── AMOUNTS ───────────────────────────────────────────────────────────
 * Cents are plain integers. TOKEN amounts are decimal STRINGS of base
 * units, because a balance can exceed what a JSON number holds exactly.
 * Never convert a token amount through a float before displaying it.
 */
export const cbxRewardTools: ToolDef[] = [
  // ── Earn tiers and boosts ────────────────────────────────────────
  {
    name: 'list_cbx_earn_tiers',
    description:
      'The earn terms this merchant offers — a longer maturation window buys a higher rate. '
      + 'This is a term structure on a REBATE, not a yield: the user chooses when to be paid '
      + 'for a purchase they already made, and nothing accrues to a balance for being held. '
      + 'Do not describe it as interest or staking rewards.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/earn-tiers'),
  },
  {
    name: 'quote_cbx_rate',
    description:
      'What an order would earn and WHY, without accruing anything. `source` says whether the '
      + 'rate came from the base rate, an earn tier, or a merchant-funded boost; '
      + '`stakeBoostBps` is the part the user\'s own stake contributed. '
      + 'Does NOT reserve boost budget, so a quote and the later accrual can differ if the '
      + 'budget runs out in between — the accrual response repeats the rate actually granted, '
      + 'and that is the authoritative one.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: 'The CBX subject id, from create_cbx_subject. Not the merchant\'s own user id.',
        },
        paidCents: { type: 'integer', description: 'What the buyer paid, in CENTS.' },
        tierSlug: { type: 'string', description: 'Which earn term. Omit for the default.' },
        target: {
          type: 'object',
          description: 'What was bought, for boost matching.',
          properties: {
            category: { type: 'string', description: "The item's category, as the merchant names it." },
            sku: { type: 'string', description: "The item's SKU." },
            collection: { type: 'string', description: 'The collection it belongs to.' },
          },
        },
      },
      required: ['subjectId', 'paidCents'],
    },
    handler: (args) => apiPost('/v1/cbx/rates/quote', args),
  },
  {
    name: 'accrue_cbx_for_purchase',
    description:
      'Accrue cashback for an order and let CBX do the rate maths — resolves the earn tier, '
      + 'any matching boost and the user\'s stake boost, charges the merchant\'s boost budget '
      + 'in the same transaction, and records the rate actually granted. '
      + 'CREATES A LIABILITY. Prefer this over accrue_cbx unless the merchant computes its own '
      + 'rates. If a matching boost cannot fund the order the accrual falls back to the '
      + 'un-boosted rate and boostBudgetExhausted is true — that is expected behaviour, not an '
      + 'error. Idempotent on externalId: a retried webhook neither accrues twice nor charges '
      + 'the budget twice.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: 'The CBX subject id, from create_cbx_subject.',
        },
        paidCents: {
          type: 'integer',
          description: 'What the buyer paid, in CENTS. The cashback is computed from this.',
        },
        externalId: { type: 'string', description: "The merchant's order id. Idempotency key." },
        tierSlug: {
          type: 'string',
          description: 'Which earn term the user chose. Omit for the merchant default.',
        },
        target: {
          type: 'object',
          description: 'What was bought, so a boost can match it.',
          properties: {
            category: { type: 'string', description: "The item's category." },
            sku: { type: 'string', description: "The item's SKU." },
            collection: { type: 'string', description: 'The collection it belongs to.' },
          },
        },
      },
      required: ['subjectId', 'paidCents', 'externalId'],
    },
    handler: (args) => apiPost('/v1/cbx/accruals/purchase', args),
  },
  {
    name: 'list_cbx_boosts',
    description:
      'The merchant\'s funded cashback boosts, with live burn against budget. `budgetCents` is '
      + 'a hard ceiling enforced inside the accrual transaction, so a boost cannot overspend — '
      + 'when it runs out, matching orders quietly fall back to the base rate. '
      + '`committedCents` in the meta is cashback promised across all live boosts but not yet '
      + 'claimed by an order: a forward commitment worth mentioning when reporting coverage.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/boosts'),
  },
  {
    name: 'create_cbx_boost',
    description:
      'Fund elevated cashback on matching items. COMMITS THE MERCHANT\'S MONEY — budgetCents '
      + 'is a real spend. '
      + 'A boost REPLACES the base or tier rate rather than adding to it: the merchant is '
      + 'stating the total it will pay, priced against its margin. Most specific target wins '
      + '(sku > collection > category > all). '
      + 'Better than a discount for the merchant, because the spend lands as a durable balance '
      + 'the buyer returns to use rather than a one-time price cut they pocket.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Label for the boost, shown to the merchant.' },
        targetKind: {
          type: 'string',
          enum: ['all', 'category', 'sku', 'collection'],
          description:
            'What the boost matches on. "all" applies to every order and takes no '
            + 'targetValue; the other three require one and are matched by exact equality. '
            + 'Most specific wins: sku beats collection beats category beats all.',
        },
        targetValue: {
          type: 'string',
          description:
            'The category, SKU or collection to match, exactly. Required unless '
            + 'targetKind is "all".',
        },
        boostedRateBps: {
          type: 'integer',
          description: 'Cashback rate in basis points — 500 = 5%. Replaces the base rate.',
        },
        budgetCents: {
          type: 'integer',
          description:
            'Hard ceiling on cashback this boost will fund, in CENTS. Enforced inside the '
            + 'accrual transaction, so it cannot be exceeded.',
        },
        startsAt: { type: 'string', description: 'ISO 8601.' },
        endsAt: { type: 'string', description: 'ISO 8601.' },
      },
      required: ['name', 'boostedRateBps', 'budgetCents', 'startsAt', 'endsAt'],
    },
    handler: (args) => apiPost('/v1/cbx/boosts', args),
  },
  {
    name: 'pause_cbx_boost',
    description:
      'Stop a boost matching further orders. Refunds NOTHING already accrued — cashback a buyer '
      + 'was shown at checkout is a promise already made, and unwinding it would take it back '
      + 'from them. The remaining budget simply stops being spendable.',
    inputSchema: {
      type: 'object',
      properties: {
        boostId: { type: 'string', description: 'The boost to pause, from list_cbx_boosts.' },
      },
      required: ['boostId'],
    },
    handler: (args) => {
      const { boostId } = args as { boostId: string };
      return apiPost(`/v1/cbx/boosts/${encodeURIComponent(boostId)}/pause`, {});
    },
  },

  // ── Staking ──────────────────────────────────────────────────────
  {
    name: 'list_cbx_stake_tiers',
    description:
      'Staking tiers and what locking tokens buys. Staking pays NOTHING — it confers a lower '
      + 'withdrawal fee and a higher earn rate on FUTURE purchases. That is a discount for '
      + 'commitment, not a return on a holding, and the distinction matters: describing it as '
      + 'yield, rewards or interest would be wrong and would misrepresent the product.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/stake-tiers'),
  },
  {
    name: 'get_cbx_stake',
    description:
      'A subject\'s staking state and SPENDABLE balance. Use `availableBaseUnits` for any '
      + 'checkout — it is the balance minus anything locked. Reading the plain balance instead '
      + 'would let a user try to spend staked tokens and be refused. '
      + '`earnBoostBps` reads zero once an unstake is requested, because the boost ends with '
      + 'the commitment; `feeDiscountBps` survives the cooldown, since withdrawing is exactly '
      + 'what somebody in cooldown is trying to do.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/stake`);
    },
  },
  {
    name: 'stake_cbx',
    description:
      'Lock a subject\'s tokens for a tier. MAKES THEIR BALANCE UNSPENDABLE — it stays their '
      + 'money and stays backed, but they cannot use it until they unstake and wait out the '
      + 'cooldown. Confirm the user actually wants this before calling it. '
      + 'Refuses an amount that clears no tier, because locking tokens for no benefit is never '
      + 'what somebody meant to do. One stake per subject.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
        baseUnits: {
          type: 'string',
          description:
            'Tokens to lock, as a decimal STRING of base units. A string because a balance '
            + 'can exceed what a JSON number holds exactly.',
        },
      },
      required: ['subjectId', 'baseUnits'],
    },
    handler: (args) => {
      const { subjectId, ...body } = args as { subjectId: string; baseUnits: string };
      return apiPost(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/stake`, body);
    },
  },
  {
    name: 'unstake_cbx',
    description:
      'Start the unstake cooldown. The earn boost stops immediately; the tokens stay locked '
      + 'until `unlocksAt`. Tell the user the date — the cooldown is what makes the discount '
      + 'real, and being surprised by it is the main complaint it generates.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiPost(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/stake/unstake`, {});
    },
  },

  // ── Service redemptions ──────────────────────────────────────────
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
            'Which service, from list_cbx_redeemable_services — e.g. grading, '
            + 'authentication, evidence_seal, listing_boost, subscription.',
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

  // ── Advertising, payable in CBX only ─────────────────────────────
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

  // ── Balances ─────────────────────────────────────────────────────
  {
    name: 'get_cbx_balances',
    description:
      'All three balances a subject holds — earned, granted, and connected. '
      + 'EARNED is cashback, withdrawable once matured. GRANTED is ad credit, wholesale draws '
      + 'and promos: spendable in the marketplace only and NEVER withdrawable. CONNECTED is the '
      + 'user\'s own self-custodied CBX reachable through a bounded delegation. '
      + '`connectedAvailableBaseUnits` is delegation HEADROOM, not a wallet balance — the user '
      + 'may hold less than they approved or have revoked on chain, so it is a ceiling. '
      + 'When reporting a total, say which parts can leave the platform and which cannot.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/balances`);
    },
  },
  {
    name: 'plan_cbx_spend',
    description:
      'Which balances would pay for a spend, and in what order. The order is '
      + 'granted -> earned -> connected and it is not configurable — granted first is a '
      + 'security property, because spending earned first would let a user convert a '
      + 'non-withdrawable grant into a withdrawable balance one purchase at a time. '
      + 'Returns shortfallBaseUnits rather than failing, so a checkout can charge the '
      + 'remainder to a card. Plans nothing and moves nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
        baseUnits: {
          type: 'string',
          description: 'Amount to plan for, as a decimal STRING of base units.',
        },
        excludeConnected: {
          type: 'boolean',
          description: 'Set on a flow that cannot wait for an on-chain transfer.',
        },
      },
      required: ['subjectId', 'baseUnits'],
    },
    handler: (args) => {
      const { subjectId, ...body } = args as { subjectId: string };
      return apiPost(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/spend-plan`, body);
    },
  },
  {
    name: 'list_cbx_grants',
    description:
      'A subject\'s live grants, soonest-expiring first. That ordering is the allocation order: '
      + 'a spend consumes the grant closest to lapsing, so value about to expire is used before '
      + 'value that will not. Mention upcoming expiry dates when a user asks about their '
      + 'balance — unused grant credit lapsing is the main surprise this generates.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
      },
      required: ['subjectId'],
    },
    handler: (args) => {
      const { subjectId } = args as { subjectId: string };
      return apiGet(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/grants`);
    },
  },
  {
    name: 'grant_cbx',
    description:
      'Issue grant credit — in-platform, non-withdrawable. SPENDS REAL VALUE out of the '
      + 'reserve. '
      + 'Requires a funding batchId for every kind except grant_makegood, because grant credit '
      + 'is spendable at merchants who receive real value and the tokens have to exist. '
      + 'There is no path that converts a grant to withdrawable balance or pays it to an '
      + 'address, and the database enforces that. Do not promise a recipient otherwise.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id receiving the grant.' },
        baseUnits: {
          type: 'string',
          description: 'Tokens to grant, as a decimal STRING of base units.',
        },
        kind: {
          type: 'string',
          enum: ['grant_ad_credit', 'grant_wholesale_credit', 'grant_promo', 'grant_makegood'],
          description:
            'Why the grant is being made. grant_ad_credit funds advertising; '
            + 'grant_wholesale_credit is a credit draw; grant_promo is a promotional gift; '
            + 'grant_makegood compensates for a platform failure and is the ONLY kind that '
            + 'does not require a funding batchId.',
        },
        expiresAt: { type: 'string', description: 'ISO 8601. Omit for no expiry.' },
        batchId: { type: 'string', description: 'Required unless kind is grant_makegood.' },
        externalId: {
          type: 'string',
          description:
            "The granting program's own id. Makes the grant idempotent, so a retried "
            + 'grant run does not issue twice.',
        },
        memo: {
          type: 'string',
          description: 'Free-text note stored on the ledger row, for explaining the grant later.',
        },
      },
      required: ['subjectId', 'baseUnits', 'kind'],
    },
    handler: (args) => {
      const { subjectId, ...body } = args as { subjectId: string };
      return apiPost(`/v1/cbx/subjects/${encodeURIComponent(subjectId)}/grants`, body);
    },
  },

  // ── Wholesale credit ─────────────────────────────────────────────
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

  // ── Threshold disbursements ──────────────────────────────────────
  {
    name: 'get_cbx_disbursement_progress',
    description:
      'How close each disbursement rule is to firing — safe to show users. A climbing counter '
      + 'toward a known number is why this uses cadence-plus-threshold rather than a pure '
      + 'threshold: people can see the pool rising and know roughly when the next community '
      + 'event is possible. `nextEligibleAt` is the earliest a rule can fire again.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/disbursement-progress'),
  },
  {
    name: 'check_cbx_disbursement_rule',
    description:
      'Evaluate a disbursement rule now, firing it if every gate passes. Gates in order: '
      + 'cadence, threshold, coverage — `outcome` names the one that stopped it. '
      + 'A missing or stale treasury snapshot declines on `coverage`, because unknown coverage '
      + 'is not healthy coverage. '
      + 'Firing opens a campaign in PREVIEWED state; it still needs approval and execution, so '
      + 'this does not pay anybody. Send dryRun to evaluate without writing anything.',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: {
          type: 'string',
          description: 'The disbursement rule to evaluate.',
        },
        dryRun: {
          type: 'boolean',
          description:
            'Evaluate the gates and report the outcome without opening a campaign or '
            + 'writing anything.',
        },
      },
      required: ['ruleId'],
    },
    handler: (args) => {
      const { ruleId, ...body } = args as { ruleId: string; dryRun?: boolean };
      return apiPost(`/v1/cbx/disbursement-rules/${encodeURIComponent(ruleId)}/check`, body);
    },
  },
];
