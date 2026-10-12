import { apiGet } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmSupply: ToolDef[] = [
  {
    name: 'get_cosm_balance',
    description:
      "A subject's COSM balance and the emission taper currently in force. "
      + 'Amounts are STRINGS of base units with six decimals — divide by 1e6 to display, '
      + 'and never use float arithmetic. '
      + '`taper.rateMultiplierBps` is 10000 at the full rate and steps down as lifetime '
      + 'supply grows; it depends on total supply rather than on this subject, so every '
      + 'earner in the same week sees the same figure. '
      + 'COSM is NOT withdrawable and is NOT a yield — it is earned by activity, and '
      + 'staking only multiplies the rate.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The CBX subject id.' },
      },
      required: ['subjectId'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/cosm/balance', { subjectId: String(args.subjectId) }),
  },
  {
    name: 'get_cosm_supply',
    description:
      'Total COSM supply — minted, burned, reversed, circulating — plus the taper in force. '
      + 'Derived from the ledger rather than a cached counter, so it cannot drift from the '
      + 'rows it summarises. '
      + '`reconciles` is an integrity check: minted minus burned minus reversed must equal '
      + 'the sum of every balance, and the auction debit/credit pair must cancel. FALSE '
      + 'means a bug, not stale data — surface it as a problem rather than reporting the '
      + 'numbers as if they were sound.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/cosm/supply'),
  },
  {
    name: 'get_cosm_emission_schedule',
    description:
      'The published COSM emission taper. Fixed years ahead and indexed on CUMULATIVE '
      + 'MINTED, which is monotonic and which nothing anybody does can move backwards. '
      + 'Useful for answering "will my earn rate drop" honestly: the schedule is knowable '
      + 'in advance, and the final step is a floor rather than zero.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/cosm/supply/schedule'),
  },
  {
    name: 'list_cosm_epochs',
    description:
      'Per-epoch COSM emission against the backstop ceiling. `demanded` is what activity '
      + 'would have earned at full rate; `emitted` is what was credited. If they differ, '
      + 'the ceiling refused something — which should be rare, since the real governor is '
      + 'the emission rate itself. `ceilingBound` true signals an anomaly rather than a '
      + 'busy week.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          default: 26,
          description: 'How many recent epochs. Default 26 (half a year at 7-day epochs).',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(
        '/v1/cosm/supply/epochs',
        args.limit === undefined ? undefined : { limit: String(args.limit) },
      ),
  },
];
