import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardEarn: ToolDef[] = [
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
];
