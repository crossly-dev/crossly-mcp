import { apiGet, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

export const listingsDiscovery: ToolDef[] = [
  {
    name: 'list_listings_facets',
    description:
      "Distinct brands + main categories across this user's listings AND inventory items. Drives filter chips in " +
      "the listings UI and is the canonical 'what brands does this seller stock?' lookup.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/listings/facets'),
  },
  {
    name: 'list_listing_ids',
    description:
      "Filter listings → return the matching id list (no pagination). Use this BEFORE bulk actions to materialize " +
      "the target set. Filters: status / platform / search (title or brand ilike).",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description:
            'Exact listing lifecycle to match on the MASTER listing row (not the per-platform rows): '
            + '"draft" (created in Crossly, never published anywhere), "active" (published and live), '
            + '"sold" (the sale cascade closed it out), "paused" (deliberately held back by the seller, '
            + 'e.g. vacation mode) or "archived" (soft-deleted — still recoverable, and the only state '
            + 'besides "sold" that list_bulk_hard_delete will accept). Omit to match every status.',
        },
        platform: {
          type: 'string',
          description:
            'Platform id from the shared platform list — e.g. "ebay", "etsy", "shopify", "poshmark", '
            + '"mercari", "depop", "grailed", "vinted", "whatnot", "vestiaire", "facebook", "offerup", '
            + '"curtsy". Narrows to listings that have a platform row for that marketplace in ANY state, '
            + 'so a delisted or failed channel still matches — this is "has ever been wired to X", not '
            + '"is live on X". Omit for all platforms.',
        },
        search: {
          type: 'string',
          description:
            'Case-insensitive substring; a listing matches when the term appears anywhere in its title '
            + 'OR its brand (SQL ILIKE %term%). Not fuzzy and not tokenized — "nike air" will not match '
            + 'a listing whose title says "Air Max" and whose brand says "Nike". Omit for no text filter.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/listings/ids', {
        status: args.status,
        platform: args.platform,
        search: args.search,
      }),
  },
  {
    name: 'listings_sku_exists',
    description:
      "Check whether a SKU is already used by one of this user's items (scoped to the listings+inventory join). " +
      "Returns { exists: boolean }. Use during import flows to dedupe SKUs before creating duplicate items.",
    inputSchema: {
      type: 'object',
      properties: {
        sku: {
          type: 'string',
          description:
            "The SKU to test, matched EXACTLY and case-sensitively against this seller's "
            + 'inventory_items.sku — no trimming, no normalization, so "ABC-1" and "abc-1" are different '
            + 'SKUs. Required: an empty or missing value is a 400 sku_required, not { exists: false }. '
            + 'SKUs are only unique per seller, so this says nothing about other users\' items.',
        },
      },
      required: ['sku'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/listings/sku-exists', { sku: args.sku }),
  },
  {
    name: 'check_listing_duplicates',
    description:
      "Check whether the seller ALREADY owns something matching this title/photo before you create a listing. " +
      "Call this first whenever you are creating listings in bulk - an automated caller is the one most likely " +
      "to list the same item twice without anyone noticing. Each match comes back with a `suggested` action: " +
      "restock (same item, bump the existing listing's stock instead of making a second one that competes with " +
      "it), variation (another size of the same thing - chain them via the variation group), or duplicate " +
      "(they listed this already). Matches are suggestions, not verdicts - surface them to the seller rather " +
      "than acting unilaterally. An empty matches array means nothing was found; this never errors.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title of the listing you are about to create.' },
        size: { type: 'string', description: 'Its size, if any. Drives the restock-vs-variation suggestion.' },
        images: {
          type: 'array',
          items: { type: 'string' },
          description: 'Image URLs. Only the first is used, and it must be publicly reachable.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { title, size, images } = args as {
        title?: string;
        size?: string;
        images?: string[];
      };
      return apiPost('/v1/listings/check-duplicates', { title, size, images });
    },
  },
  {
    name: 'combine_duplicate_listings',
    description:
      "Fold DUPLICATE listings of the same item into one, adding their stock together. Use this when a seller " +
      "has listed the same physical item more than once (a bad import, a re-scan) - two listings for one pile " +
      "of stock compete with each other and each carries a wrong quantity. This is NOT for sizes or colours: " +
      "those are a variation group, where each option keeps its own stock. " +
      "The keeper survives with everyone's stock on it and keeps its sales history, photos and live marketplace " +
      "listings; the rest are DELISTED from every marketplace and archived (never deleted). " +
      "Ask the seller which listing to keep - it is not a detail you should pick for them. " +
      "Returns 409 with a code when something has to happen first: reserved_stock (ship or cancel the open " +
      "order), chained (dissolve the bundle or variation group), no_inventory_item, sold, keeper_in_sources.",
    inputSchema: {
      type: 'object',
      properties: {
        keepListingId: { type: 'string', description: 'UUID of the listing that survives.' },
        mergeListingIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'UUIDs of the listings folded into it and archived. Must not include the keeper.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['keepListingId', 'mergeListingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { keepListingId, mergeListingIds, idempotencyKey } = args as {
        keepListingId: string;
        mergeListingIds: string[];
        idempotencyKey?: string;
      };
      return apiPost('/v1/listings/combine', { keepListingId, mergeListingIds }, idempotencyKey);
    },
  },
  {
    name: 'merge_listings',
    description:
      "Merge the SAME item listed on DIFFERENT marketplaces into one Crossly listing (e.g. a ring imported from " +
      "eBay and again from Vinted as two listings). Every marketplace stays LIVE - nothing is delisted; the kept " +
      "listing gains the others' marketplace listings and per-marketplace prices, and the rest are archived " +
      "(never deleted). For duplicates on the SAME marketplace use combine_duplicate_listings instead. " +
      "Ask the seller which listing to keep. Returns 409 same_platform_live when two of them are live on one marketplace.",
    inputSchema: {
      type: 'object',
      properties: {
        keepListingId: { type: 'string', description: 'UUID of the listing that survives (its title and photos win).' },
        mergeListingIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'UUIDs of the listings merged into it and archived. Must not include the keeper.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['keepListingId', 'mergeListingIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { keepListingId, mergeListingIds, idempotencyKey } = args as {
        keepListingId: string;
        mergeListingIds: string[];
        idempotencyKey?: string;
      };
      return apiPost('/v1/listings/merge', { keepListingId, mergeListingIds }, idempotencyKey);
    },
  },
];
