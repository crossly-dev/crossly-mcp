import { apiDelete, apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const compWatchlistsTools: ToolDef[] = [
  {
    name: 'list_comp_watchlists',
    description:
      "List the seller's sold-comp watchlists. Each watchlist is a saved filter against the external_sold_comps table — " +
      'when scrapers pull new sold comps, the matching watchlists surface them in the dashboard. Useful for "what items ' +
      'are selling at what price right now?" research.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/comp-watchlists'),
  },
  {
    name: 'create_comp_watchlist',
    description:
      'Create a sold-comp watchlist. At least one of brand/categoryMain/platform must be set; minPrice/maxPrice are ' +
      'optional and must satisfy min ≤ max when both present. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100 },
        brand: { type: ['string', 'null'] },
        categoryMain: { type: ['string', 'null'] },
        platform: { type: ['string', 'null'] },
        condition: { type: ['string', 'null'] },
        minPrice: { type: ['number', 'null'], minimum: 0 , description: 'In DOLLARS as a decimal, e.g. 45.99 — this column is decimal(10,2), NOT cents. Other Crossly fields ending in `Cents` are integers of cents; do not mix them up.' },
        maxPrice: { type: ['number', 'null'], minimum: 0 , description: 'In DOLLARS as a decimal, e.g. 45.99 — this column is decimal(10,2), NOT cents. Other Crossly fields ending in `Cents` are integers of cents; do not mix them up.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/comp-watchlists', body, idempotencyKey);
    },
  },
  {
    name: 'delete_comp_watchlist',
    description: 'Delete a sold-comp watchlist by id. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/comp-watchlists/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'comp_watchlist_recent',
    description:
      'List recent external sold comps matching a watchlist — up to 50 rows ordered by soldAtApprox (or scrapedAt fallback) ' +
      'DESC. Each row has platform, title, brand, soldPrice, imageUrl, listingUrl, scrapedAt, soldAtApprox.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/comp-watchlists/${encodeURIComponent(args.id as string)}/recent`),
  },
  {
    name: 'comp_watchlist_scrape',
    description:
      "Manually trigger a fresh scrape for a watchlist. Returns a summary of how many new comps were ingested. Use this when " +
      "the seller wants 'pull the latest data right now' instead of waiting for the next scheduled scrape. Pass an " +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/comp-watchlists/${encodeURIComponent(args.id as string)}/scrape`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
];
