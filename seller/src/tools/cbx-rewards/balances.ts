import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardBalances: ToolDef[] = [
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
];
