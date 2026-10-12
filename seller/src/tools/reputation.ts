import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Reputation levels and jobs in Crossly World. Levels are earned from real
 * activity on four tracks (trader, collector, seller, host), weighted by
 * recency, and unlock lounges, a home display case, an earlier stall booking
 * window and bigger Space venues. Jobs: shop-staff and grading-desk shifts
 * worked in person, and price checks appraisers answer. Read-only here.
 */
export const reputationTools: ToolDef[] = [
  {
    name: 'get_my_reputation',
    description:
      'Your Crossly World reputation: each track (trader, collector, seller, host) with points, level, the next level\'s threshold, ' +
      'what the level has unlocked and the next unlock, and the lines the points came from (recency-weighted; lost disputes and failed authentications subtract).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/reputation/mine', {}),
  },
  {
    name: 'get_reputation',
    description: 'Somebody\'s public Crossly World reputation levels by storefront handle: the level on each track and their nameplate badge. Not found for an unknown handle.',
    inputSchema: {
      type: 'object',
      properties: { profile: { type: 'string', description: 'Their storefront handle, e.g. rare-threads.' } },
      required: ['profile'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { profile } = args as { profile: string };
      return apiGet(`/v1/reputation/${encodeURIComponent(profile)}`, {});
    },
  },
  {
    name: 'list_open_shifts',
    description:
      'Open shifts on the Crossly World Jobs board, soonest first: shop staff in boutiques and grading-desk helpers, with window, place and pay. ' +
      'meta.payOn is false while Crossly has jobs pay switched off (work is recorded, not paid).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many shifts to return, 1-100.' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/jobs/shifts', args as Record<string, unknown>),
  },
  {
    name: 'list_open_appraisals',
    description:
      'Open price checks appraisers can answer (Collector level 3+ holding 3+ pieces in that market category), newest first, with bounties. ' +
      'Optionally filter to one market category slug.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Only price checks in this market category slug (e.g. trading-cards).' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many price checks to return, 1-100.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/jobs/appraisals', args as Record<string, unknown>),
  },
];
