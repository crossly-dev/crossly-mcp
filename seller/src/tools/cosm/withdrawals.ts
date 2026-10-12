import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmWithdrawals: ToolDef[] = [
  {
    name: 'get_cosm_withdrawals',
    description:
      'A subject\'s COSM withdrawal history, and whether withdrawals are open at all. '
      + 'THEY ARE NOT OPEN TODAY: `meta.open` is false and `meta.outstanding` lists the '
      + 'preconditions still to be met — an audited minter program, a securities opinion, '
      + 'a money-transmission review, and the emission invariant proven under real volume. '
      + 'If a user asks when they can cash out, the honest answer is that it is gated on '
      + 'those and NONE of them has a date. Do not invent or imply a timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject whose withdrawals to list. Must be one you own. Read '
            + '`meta.open` in the response before offering withdrawal to anybody.',
        },
      },
      required: ['subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/withdrawals', { subjectId: String(args.subjectId) }),
  },
  {
    name: 'request_cosm_withdrawal',
    description:
      'Request a COSM withdrawal to the subject\'s own proven wallet. '
      + 'THIS REFUSES TODAY with a 409 listing the outstanding preconditions — check '
      + 'get_cosm_withdrawals first rather than calling this to find out. '
      + 'There is NO destination parameter: it goes to the subject\'s own VERIFIED '
      + 'connected wallet, because a per-request destination is how a compromised session '
      + 'drains a balance elsewhere. If a user asks you to send COSM to an address, that '
      + 'is not something this API can do for them. '
      + 'Pass a stable `externalId` so a retry returns the original withdrawal instead of '
      + 'creating a second one.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject withdrawing. Must be one you own. The destination is this '
            + "subject's own verified connected wallet — there is no address parameter.",
        },
        baseUnits: {
          type: 'string',
          description: 'Amount in base units as a string. Six decimals; minimum 1 COSM.',
        },
        externalId: {
          type: 'string',
          description: 'Your own stable id for this request. Makes a retry a no-op.',
        },
      },
      required: ['subjectId', 'baseUnits', 'externalId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/cosm/withdrawals', {
        subjectId: String(args.subjectId),
        baseUnits: String(args.baseUnits),
        externalId: String(args.externalId),
      }),
  },
];
