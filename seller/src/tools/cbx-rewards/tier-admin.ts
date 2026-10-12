import { apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardTierAdmin: ToolDef[] = [
  {
    name: 'create_cbx_earn_tier',
    description:
      'Create a cashback earn tier — a maturation window and a rate. '
      + 'MATURATION IS THE LOAD-BEARING FIELD. An accrual is CENTS until it matures and '
      + 'becomes a token quantity only then, priced at that moment; the window is how '
      + 'long a refund can still reverse it cleanly. A short window means less reversible '
      + 'cashback, not a better deal. '
      + '`isDefault` moves every new subject onto this tier. Existing accruals keep the '
      + 'tier they were written under.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Stable machine identifier.' },
        label: { type: 'string', description: 'Name shown to users.' },
        maturationDays: {
          type: 'integer',
          description:
            'Days before a pending accrual becomes tokens. Also the window in which a '
            + 'refund reverses it cleanly.',
        },
        earnRateBps: {
          type: 'integer',
          description: 'Cashback rate in basis points of order value (100 = 1%).',
        },
        isDefault: {
          type: 'boolean',
          description: 'Make this the tier new subjects start on.',
        },
      },
      required: ['slug', 'label', 'maturationDays', 'earnRateBps'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cbx/earn-tiers', args),
  },
  {
    name: 'create_cbx_stake_tier',
    description:
      'Create a staking tier — a minimum stake and what it unlocks. '
      + 'A tier grants a fee discount, an earn-rate boost and governance weight. IT PAYS '
      + 'NO RETURN ON THE STAKE ITSELF, which is the property that keeps staking a '
      + 'loyalty mechanism rather than a yield product. Never describe a tier as earning '
      + 'anything passively. '
      + '`cooldownDays` is the unstaking delay. Tokens in cooldown stop counting for '
      + 'governance immediately — the commitment a vote is priced against is already '
      + 'leaving.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Stable machine identifier.' },
        label: { type: 'string', description: 'Name shown to users.' },
        minBaseUnits: {
          type: 'string',
          description:
            'Minimum stake to reach this tier, as a STRING of base units (never a float).',
        },
        feeDiscountBps: {
          type: 'integer',
          description:
            'Marketplace fee discount in basis points — 100 = 1 percent OFF the fee '
            + 'rate, not a cash amount. 250 on a 5% fee leaves 4.75%.',
        },
        earnBoostBps: {
          type: 'integer',
          description: 'Multiplier on the earn RATE, in basis points. Not a yield.',
        },
        cooldownDays: {
          type: 'integer',
          description:
            'Unstaking delay. Stake in cooldown stops counting for governance at once.',
        },
      },
      required: ['slug', 'label', 'minBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cbx/stake-tiers', args),
  },
];
