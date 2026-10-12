import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmFusionHandles: ToolDef[] = [
  {
    name: 'fuse_cosm_cosmetics',
    description:
      'Fuse two cosmetics plus COSM into a rarer one. THIS DESTROYS BOTH INPUT ITEMS AND '
      + 'THE COSM — permanently and with no undo. Inputs must be owned, unbound and '
      + 'flagged fusable; stake-exclusive items can never be consumed. '
      + 'Always confirm explicitly with the user and name what will be destroyed before '
      + 'calling this. An open listing on a consumed input is cancelled.',
    inputSchema: {
      type: 'object',
      properties: {
        recipeId: {
          type: 'string',
          description:
            'The fusion recipe to run. It names which two cosmetics are consumed and how '
            + 'much COSM is burned — read it and state both to the user before calling.',
        },
        subjectId: {
          type: 'string',
          description:
            'The CBX subject whose items and COSM are destroyed. Must be one you own.',
        },
      },
      required: ['recipeId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(`/v1/cosm/fusion/${encodeURIComponent(String(args.recipeId))}`, {
        subjectId: String(args.subjectId),
      }),
  },
  {
    name: 'check_cosm_handle',
    description:
      'Is a vanity handle available, and what does it cost in COSM? Reasons for '
      + 'unavailability: invalid_shape, reserved, taken. Priced by length — short names '
      + 'are scarcer. Uniqueness is platform-wide, since it is a URL namespace.',
    inputSchema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'With or without a leading @.' },
      },
      required: ['handle'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/cosm/handles/${encodeURIComponent(String(args.handle))}`),
  },
  {
    name: 'claim_cosm_handle',
    description:
      'Claim a vanity storefront handle, burning COSM. ONE live handle per subject — '
      + 'claiming a second is refused rather than replacing the first. '
      + 'There is NO REFUND if it is released later: the COSM was burned. Check '
      + 'availability and price first, and confirm the spend.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description:
            'The CBX subject claiming it, and whose COSM is burned. Must be one you own.',
        },
        handle: {
          type: 'string',
          description:
            'The handle to claim, with or without a leading @. Check availability and '
            + 'price first — the COSM is burned and there is no refund.',
        },
      },
      required: ['subjectId', 'handle'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/cosm/handles', {
        subjectId: String(args.subjectId),
        handle: String(args.handle),
      }),
  },
  {
    name: 'list_cosm_burn_goals',
    description:
      'Community burn goal progress. Aggregate COSM burned crossing a threshold unlocks a '
      + 'cosmetic for everyone who CONTRIBUTED — not for everybody. Only burns inside the '
      + 'goal window count, and `progressBps` is capped at 10000 because the total is '
      + 'snapshotted on completion.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/cosm/goals'),
  },
];
