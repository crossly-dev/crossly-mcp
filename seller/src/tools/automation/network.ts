import { apiDelete, apiGet, apiPatch, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/**
 * Crossly Network — the opt-in reciprocal engagement pool that the
 * network.share_pool / network.follow_pool / network.like_pool automation
 * actions draw their candidates from.
 */
export const networkPool: ToolDef[] = [
  {
    name: 'get_network_pool_membership',
    description:
      "Read the seller's Crossly Network pool membership row. Includes per-action toggles (shareEnabled / followEnabled / likeEnabled), opted-in platforms, karma counters (engagementsPerformed / engagementsReceived). Returns { member: null } when the seller has not joined.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/network/pool'),
  },
  {
    name: 'get_network_pool_size',
    description: 'Total members in the pool. Use as the "how big is the network" stat.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/network/pool/size'),
  },
  {
    name: 'list_network_pool_log',
    description:
      'Recent engagement history. Each row records (engager → target, actionType, platform, performedAt). Both sent + received are surfaced.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          default: 100,
          description:
            'How many engagement rows to return, newest first by performedAt. 1–500, default 100; the ' +
            'server clamps out-of-range values rather than erroring.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/network/pool/log', args as Record<string, unknown>),
  },
  {
    name: 'join_network_pool',
    description:
      "Opt the seller into the Crossly Network reciprocal engagement pool. Required before the network.share_pool / " +
      'network.follow_pool / network.like_pool automation actions will fire. Idempotent — joining twice returns ' +
      'joined:false rather than erroring. The new row starts with all three action toggles ON and platforms empty ' +
      '(= every connected platform).',
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/network/pool', {}, args.idempotencyKey as string | undefined),
  },
  {
    name: 'update_network_pool_membership',
    description:
      'Patch per-action toggles + opted-in platforms on the pool membership row. Only the fields you send ' +
      'change; 404s if the seller has not joined the pool yet.',
    inputSchema: {
      type: 'object',
      properties: {
        shareEnabled: {
          type: 'boolean',
          description:
            'Whether the seller participates in sharing — both performing shares for other members and ' +
            'being picked as a share target. Defaults to true on join. Omit to leave unchanged.',
        },
        followEnabled: {
          type: 'boolean',
          description:
            'Whether the seller participates in reciprocal follows (network.follow_pool). Defaults to true ' +
            'on join. Omit to leave unchanged.',
        },
        likeEnabled: {
          type: 'boolean',
          description:
            'Whether the seller participates in reciprocal likes (network.like_pool). Defaults to true on ' +
            'join. Omit to leave unchanged.',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Platform slugs the seller opts into, e.g. ["poshmark","mercari"]. Stored comma-joined; an ' +
            'empty array means every platform the seller is connected on. Replaces the stored list rather ' +
            'than adding to it. Omit to leave unchanged.',
        },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPatch('/v1/network/pool', body, idempotencyKey);
    },
  },
  {
    name: 'leave_network_pool',
    description: "Drop out of the pool. Network.* automation actions stop firing; other members stop engaging with the seller's catalog.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete('/v1/network/pool', args.idempotencyKey as string | undefined),
  },
];
