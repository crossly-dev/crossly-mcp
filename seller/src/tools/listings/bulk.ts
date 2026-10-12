import { apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';
import {
  BULK_DELIST_PLATFORMS_PROP,
  BULK_FILTERS_PROP,
  BULK_LISTING_IDS_PROP,
  EBAY_QUOTA_PROP,
} from './_shared.js';

export const listingsBulk: ToolDef[] = [
  {
    name: 'list_bulk_relist',
    description:
      'Bulk relist a selection across platforms. Posts the canonical listings + dispatches list jobs for each (listing, platform) ' +
      'pair. Body shape mirrors the web UI: { listingIds, platforms?, filters?, confirmOverFreeQuota? }. eBay free-tier quota + ' +
      'selling cap are checked synchronously and the call short-circuits with 402/409 before any fan-out. Pass an idempotencyKey ' +
      'on retries — this is one of the most expensive operations in the API.',
    inputSchema: {
      type: 'object',
      properties: {
        listingIds: { type: 'array', items: { type: 'string' }, description: 'Listing UUIDs to relist.' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional platform allowlist. Omit to relist on every platform that already has a row.',
        },
        filters: { type: 'object', description: 'Optional secondary filter narrowing the selection (status / price band / etc.).' },
        confirmOverFreeQuota: {
          type: 'boolean',
          description: 'Set true to opt into eBay overage fees when the selection exceeds free-listing tier.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-relist', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_crosspost',
    description:
      'Bulk crosspost a selection to one or more NEW platforms (no delist phase). Unlike bulk-relist, this requires an explicit ' +
      '`platforms` array. Returns a bulkJobId you can poll for progress. eBay quota + selling-cap guards mirror bulk-relist. ' +
      'Always pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        listingIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Master Crossly listing UUIDs to crosspost — the `id` from list_listings / list_listing_ids, '
            + 'NOT a platformListingId. At least one required and no upper bound here (unlike the other '
            + 'bulk endpoints, which cap at 50,000). Any id not owned by the caller fails the whole call '
            + 'with 404 not_found naming the offenders, before anything is dispatched.',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description:
            'REQUIRED — the target marketplaces, e.g. ["poshmark","mercari","ebay"]. Platform ids come '
            + 'from the shared platform list (ebay, etsy, shopify, poshmark, mercari, depop, grailed, '
            + 'vinted, whatnot, vestiaire, facebook, offerup, curtsy, reverb, stockx, …). An empty array '
            + 'is a 400: unlike bulk-relist there is no "everywhere it already lives" default, because '
            + 'this endpoint opens NEW channels rather than refreshing existing ones.',
        },
        ...BULK_FILTERS_PROP,
        ...EBAY_QUOTA_PROP,
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds', 'platforms'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-crosspost', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_delist',
    description:
      'Bulk delist a selection from platforms. Omit `platforms` to delist everywhere; supply an array to restrict. ' +
      'Returns a bulkJobId for progress polling. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BULK_LISTING_IDS_PROP,
        ...BULK_DELIST_PLATFORMS_PROP,
        ...BULK_FILTERS_PROP,
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-delist', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_delete',
    description:
      'Bulk archive (soft-delete) a selection. Local listings go to status=archived inline; platform delists fan out via the ' +
      'coordinator queue and surface as a bulkJobId. Use this for "tidy up" actions; for irrecoverable deletes use ' +
      'list_bulk_hard_delete. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BULK_LISTING_IDS_PROP,
        ...BULK_DELIST_PLATFORMS_PROP,
        ...BULK_FILTERS_PROP,
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-delete', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_hard_delete',
    description:
      'Permanently delete archived (or sold) listings. Sales get soft-deleted with tombstones so the cookie-sales poller does ' +
      'not re-insert them. Refuses with 400/not_archived if any selected listing is still active — archive first via ' +
      'list_bulk_delete. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        listingIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Master Crossly listing UUIDs to destroy permanently, 1 to 50,000 — the `id` from '
            + 'list_listings, NOT a platformListingId. Archived and sold listings delete freely. If ANY '
            + 'is still live (active/draft/inactive) the call fails with 409 listings_live and deletes '
            + 'nothing — the error details say how many and on which marketplaces — unless allowLive is '
            + 'true. This is the irreversible path — the listing rows are gone, and their sales are '
            + 'tombstoned so the pollers cannot resurrect them.',
        },
        filters: {
          type: 'object',
          description:
            'Optional narrowing filters (same shape as the other bulk tools). Applied server-side: only '
            + 'ids that match are deleted.',
        },
        allowLive: {
          type: 'boolean',
          default: false,
          description:
            'true = also delete listings that are not archived/sold. Deleting NEVER delists: their '
            + 'marketplace copies stay live and Crossly stops tracking them (no sale sync, no auto-delist). '
            + 'To take them down too, use list_bulk_delete (archive) instead. Only set this after the '
            + 'user has seen the 409 listings_live counts and confirmed.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-hard-delete', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_update',
    description:
      'Bulk text + price update across a listing selection. `updates` carries optional title/description/price ops — title and ' +
      'description support set/insert_start/insert_end/find_replace/remove; price supports set/drop_percent/drop_amount/' +
      'raise_percent/raise_amount with rounding=up|down|none. All in one SQL UPDATE — no per-platform fan-out. Pass an ' +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BULK_LISTING_IDS_PROP,
        ...BULK_FILTERS_PROP,
        updates: {
          type: 'object',
          description:
            'The edit to apply, as up to three independent ops: { title?, description?, price? } — at '
            + 'least one is needed for anything to change. `title` and `description` each take '
            + '{ action: "set" | "insert_start" | "insert_end" | "find_replace" | "remove", value?, '
            + 'find?, replace? }: set replaces outright, insert_start / insert_end concatenate `value` '
            + 'onto the front or back, find_replace swaps every occurrence of `find` for `replace`, '
            + 'remove strips every occurrence of `value`. `price` takes { action: "set" | "drop_percent" '
            + '| "drop_amount" | "raise_percent" | "raise_amount", value, rounding?: "up" | "down" | '
            + '"none" (default "none") }, where `value` is US DOLLARS for set / drop_amount / '
            + 'raise_amount and a PERCENT for drop_percent / raise_percent (25 means 25%, not 0.25); the '
            + 'result is floored at $0 and rounded to 2 decimal places. Every op runs against the '
            + 'EFFECTIVE value (the listing\'s own field falling back to its inventory item default) and '
            + 'writes the MASTER listing only — per-platform overrides are left untouched, and only the '
            + 'fields named here are pushed out to the marketplaces afterwards.',
          properties: {
            title: { type: 'object' },
            description: { type: 'object' },
            price: { type: 'object' },
          },
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds', 'updates'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-update', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_check_status',
    description:
      'Queue a status-refresh check against the originating marketplace for each selected listing. Useful for "is this still ' +
      'really live?" audits after extension issues. Returns a bulkJobId. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BULK_LISTING_IDS_PROP,
        ...BULK_FILTERS_PROP,
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-check-status', body, idempotencyKey);
    },
  },
  {
    name: 'list_bulk_delist_preview',
    description:
      'Preview which marketplaces a bulk delist would touch — returns per-marketplace activeCount + accountStatus so an agent ' +
      'can show the seller the blast radius before committing. Read-only. Pass an idempotencyKey for cache-replay safety.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BULK_LISTING_IDS_PROP,
        ...BULK_FILTERS_PROP,
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/bulk-delist-preview', body, idempotencyKey);
    },
  },
  {
    name: 'list_by_ids',
    description:
      'Hydrated fetch — returns listing rows merged with their parent inventory item defaults + every platformListings row. ' +
      'Useful for "open this selection in an editor" workflows. Up to 200 ids per call. Pass an idempotencyKey for cache-replay.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 200,
          description:
            'Master Crossly listing UUIDs to hydrate — the `id` from list_listings / list_listing_ids, '
            + 'NOT platformListingIds (those come back on each platformListings row in the response). '
            + '1 to 200 per call; 201 or more is a 400. Ids belonging to another user are dropped '
            + 'silently rather than erroring, so compare the returned count against what you sent.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ids'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/by-ids', body, idempotencyKey);
    },
  },
];
