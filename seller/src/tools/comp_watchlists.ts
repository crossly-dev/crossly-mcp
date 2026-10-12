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
        name: {
          type: 'string',
          description:
            'Human label for the watchlist, 1-100 characters — shown in the dashboard and echoed as `watchlistName` ' +
            'in the COMP_WATCHLIST_MATCH push. Purely a label: it is NOT part of the filter and never affects which ' +
            'comps match.',
          maxLength: 100,
        },
        brand: {
          type: ['string', 'null'],
          description:
            "Brand to watch, 1-100 characters, e.g. 'Lululemon'. Matched case-insensitively as a CONTAINS against " +
            "each scraped comp's title OR its brand field, so 'nike' also matches a title reading 'Nike Air Max 90'. " +
            'null or omitted means any brand. At least one of brand / categoryMain / platform must be set or the ' +
            'server rejects the create with 400.',
        },
        categoryMain: {
          type: ['string', 'null'],
          description:
            "Top-level category to watch, 1-100 characters — the `main` segment of Crossly's category object, e.g. " +
            "'shoes' or 'tops'. Matched case-insensitively EXACT against the comp's category (not a contains match, " +
            "so 'shoe' will not match 'shoes'). null or omitted means any category. Counts toward the " +
            'brand/categoryMain/platform requirement.',
        },
        platform: {
          type: ['string', 'null'],
          description:
            "Marketplace slug to watch, max 40 characters — exact match on the comp's platform. Only 'ebay', " +
            "'stockx', 'poshmark', 'mercari' and 'depop' have sold-comp scrapers; any other slug stores fine but " +
            'never scrapes. null or omitted means any platform, and the scrape then fans out across all five. ' +
            'Counts toward the brand/categoryMain/platform requirement.',
        },
        condition: {
          type: ['string', 'null'],
          description:
            "Item condition to watch, max 40 characters, in the platform's own vocabulary (e.g. 'new_with_tags', " +
            "'good'). Matched case-insensitively EXACT against the comp's condition; rows the scraper captured with " +
            'no condition are excluded once this is set. null or omitted means any condition. This does NOT satisfy ' +
            'the brand/categoryMain/platform requirement on its own.',
        },
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
        id: {
          type: 'string',
          description:
            'UUID of the watchlist to delete (`comp_watchlists.id`, as returned by list_comp_watchlists) — not a ' +
            'listing or comp id. Must belong to the calling account; an unknown or foreign id returns 404. Deleting ' +
            'the saved filter does NOT delete the scraped sold comps it surfaced; those are shared market data.',
        },
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
        id: {
          type: 'string',
          description:
            "UUID of the watchlist whose saved filter to replay (`comp_watchlists.id`, from list_comp_watchlists). " +
            'Must belong to the calling account, otherwise 404. Reads already-scraped rows only — it does not fetch ' +
            'anything fresh; use comp_watchlist_scrape for that.',
        },
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
        id: {
          type: 'string',
          description:
            'UUID of the watchlist to scrape right now (`comp_watchlists.id`, from list_comp_watchlists). Must ' +
            'belong to the calling account, otherwise 404. Scrapes the one platform the watchlist names, or all ' +
            "five scrapable ones ('ebay', 'stockx', 'poshmark', 'mercari', 'depop') when its platform is null, and " +
            'returns `{ scraped, new, matched }` counts.',
        },
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
