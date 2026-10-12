import { apiDelete, apiGet, apiPost, apiPut } from '../../api.js';
import { ToolDef } from '../types.js';

// ── Storefront: dollar-priced cosmetics paid in CBX, and what money cannot buy ────────────────────

export const cosmStorefront: ToolDef[] = [
  {
    name: 'buy_cosmetic_with_cbx',
    description:
      'Buy a dollar-priced cosmetic, paying in CBX. Digital cosmetics are PRICED in dollars '
      + 'and never sold for cash: the SKU' + "'" + 's priceCents is paid from the subject' + "'" + 's EARNED CBX '
      + 'at spot. SPENDS MONEY: confirm the price with the user first. requestKey (8-64 '
      + 'chars, a fresh one per purchase) makes a retry the same purchase; if the grant '
      + 'fails after payment (sold out, already held) the spend is reversed. Refuses an '
      + 'earned (COSM) or stake-exclusive SKU.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'The dollar-priced SKU to buy.' },
        subjectId: { type: 'string', description: 'The buyer, as a CBX subject.' },
        requestKey: { type: 'string', description: 'A fresh 8-64 char key for this purchase.' },
      },
      required: ['cosmeticId', 'subjectId', 'requestKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { cosmeticId, subjectId, requestKey } = args as { cosmeticId: string; subjectId: string; requestKey: string };
      return apiPost(`/v1/cosm/cosmetics/${encodeURIComponent(cosmeticId)}/buy-cbx`, { subjectId, requestKey });
    },
  },
  {
    name: 'claim_stake_exclusive_cosmetic',
    description:
      'Claim a stake-exclusive cosmetic once tenure qualifies. These are BOUND forever '
      + 'and purchasable by nobody at any price in any currency — if a user asks to buy '
      + 'one, the answer is that it cannot be bought, which is the point. '
      + 'A short tenure returns granted:false with tenureDays and requiredDays: that is '
      + 'the NORMAL answer, not an error, so report progress rather than failure. '
      + 'Idempotent while the copy is held.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'The stake-exclusive SKU.' },
        subjectId: { type: 'string', description: 'The claimant, as a CBX subject.' },
      },
      required: ['cosmeticId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(`/v1/cosm/cosmetics/${encodeURIComponent(String(args.cosmeticId))}/claim`, {
        subjectId: args.subjectId,
      }),
  },
  {
    name: 'get_cosm_stake_tenure',
    description:
      'How long a subject has held a stake CONTINUOUSLY, in days — the figure every '
      + 'stake-exclusive claim is decided on. Not "time since they first staked": a gap '
      + 'resets it and a cooling stake does not count, so do not describe it that way. '
      + 'Use it to show progress toward a claim before attempting one.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The subject to measure.' },
      },
      required: ['subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/stake-tenure', { subjectId: String(args.subjectId) }),
  },
  {
    name: 'set_cosmetic_unlock',
    description:
      'Set or clear what a cosmetic unlocks spatially. BOTH fields or neither: a key with '
      + 'no value would claim every value of that key and silently gate the whole '
      + 'control, so a half-pair is collapsed to two nulls — read the response, which '
      + 'echoes what was APPLIED rather than what was sent. Passing two nulls removes the '
      + 'gate and makes the control free for EVERYONE, which is rarely what somebody '
      + 'means by "update the unlock" — confirm before clearing.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'The SKU whose gate is being set.' },
        unlocksKey: {
          type: ['string', 'null'],
          description: 'The scene key this cosmetic gates. Null clears the gate.',
        },
        unlocksValue: {
          type: ['string', 'null'],
          description: 'The value of that key. Null clears the gate.',
        },
      },
      required: ['cosmeticId', 'unlocksKey', 'unlocksValue'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPut(`/v1/cosm/cosmetics/${encodeURIComponent(String(args.cosmeticId))}/unlock`, {
        unlocksKey: args.unlocksKey ?? null,
        unlocksValue: args.unlocksValue ?? null,
      }),
  },
  {
    name: 'release_cosm_handle',
    description:
      'Release a handle. NOTHING IS REFUNDED — the COSM paid for it was BURNED, so there '
      + 'is nothing to give back, and refunding would mean minting. Tell the user that '
      + 'before calling this; somebody expecting a refund will read silence as a bug. '
      + 'The handle returns to the pool and ANYONE may claim it, including somebody else, '
      + 'so this is not a way to park one. Returns released:false if they held none.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The holder, as a CBX subject.' },
        reason: { type: 'string', description: 'Why, for the audit trail. 1-200 chars.' },
      },
      required: ['subjectId', 'reason'],
      additionalProperties: false,
    },
    // `apiDelete(path, idempotencyKey, query, body)` — the route reads
    // these from the BODY, so they go in the fourth slot. Passing them
    // second would send the pair as an idempotency key.
    handler: (args) =>
      apiDelete('/v1/cosm/handles', undefined, undefined, {
        subjectId: String(args.subjectId),
        reason: String(args.reason),
      }),
  },
  {
    name: 'quote_employee_fee',
    description:
      'What one shop-employee conversation will cost, in COSM. Priced with the SAME '
      + 'functions the charge uses, so the figure quoted is the figure taken. Half BURNS '
      + 'and half moves to the market pool as a tax, and the two always sum to the total '
      + 'exactly. Charges nothing and changes nothing — safe to call freely, including '
      + 'before every message.',
    inputSchema: {
      type: 'object',
      properties: {
        totalCents: {
          type: 'integer',
          description: 'The conversation value in cents, which the fee is derived from.',
        },
      },
      required: ['totalCents'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/employee/fee-quote', { totalCents: Number(args.totalCents) }),
  },
];
