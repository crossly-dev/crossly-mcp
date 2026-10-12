import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardStaking: ToolDef[] = [
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
];
