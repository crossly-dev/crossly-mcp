/**
 * Reusable argument blocks for the bulk listing tools.
 *
 * Every `/v1/listings/bulk-*` route parses the same `BulkListingIdsSchema`
 * (`listingIds` + optional `filters`), so the prose lives here once instead
 * of drifting per tool. These are NOT tool arrays — do not name anything in
 * this file `*Tools`.
 */

/** The selection itself. Shared by every bulk-* endpoint. */
export const BULK_LISTING_IDS_PROP = {
  listingIds: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Master Crossly listing UUIDs — the `id` from list_listings / list_listing_ids, NOT a '
      + 'platformListingId (that is a marketplace\'s own id for ONE channel of a listing and is '
      + 'rejected here). 1 to 50,000 per call. Ids that are not the caller\'s never act: depending on '
      + 'the endpoint they either fail the whole call with 404 not_found naming them, or are skipped.',
  },
} as const;

/** The advanced narrowing block — `BulkAdvancedFiltersSchema`. */
export const BULK_FILTERS_PROP = {
  filters: {
    type: 'object',
    description:
      'Optional server-side narrowing applied to `listingIds` BEFORE any fan-out — the effective '
      + 'selection is the intersection, so filters only ever SHRINK the set, never add to it. All keys '
      + 'optional: listedMoreThanDays / noSaleDays (integer days, 1-3650); priceMin / priceMax '
      + '(effective price in US DOLLARS, e.g. 24.99, range 0-1000000 — the listing\'s price falling back '
      + 'to its inventory item\'s default); viewsLessThan / favoritesLessThan (integers 0-10000000, '
      + 'summed across the listing\'s active platform rows); quantityAvailableLessThanOrEqual (integer '
      + '0-10000; 0 catches out-of-stock); listedOnLessThan / listedOnAtLeast (integers 1-20, a count of '
      + 'ACTIVE platform rows — listedOnLessThan=2 means "live on only one marketplace"); brandContains '
      + '(case-insensitive substring, 1-120 chars); hasAnyLabels / hasNoneLabels (up to 40 inventory '
      + 'labels each); condition (exact effective condition, e.g. "new", "good"). Omit for no narrowing.',
  },
} as const;

/** `platforms` on the bulk take-down endpoints (delist / archive). */
export const BULK_DELIST_PLATFORMS_PROP = {
  platforms: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Optional platform ids restricting which marketplaces are taken down, e.g. ["poshmark","ebay"]. '
      + 'Ids come from the shared platform list (ebay, etsy, shopify, poshmark, mercari, depop, grailed, '
      + 'vinted, whatnot, vestiaire, facebook, offerup, curtsy, goat, reverb, stockx, …). Omit to act on '
      + 'EVERY marketplace the selection is currently live on. Read straight off the body without '
      + 'validation — an unrecognised id simply matches no platform row and silently does nothing.',
  },
} as const;

/** eBay's free-listing overage opt-in. Same semantics on every endpoint that has it. */
export const EBAY_QUOTA_PROP = {
  confirmOverFreeQuota: {
    type: 'boolean',
    description:
      'eBay only, and only consulted when "ebay" is among the targets. Left unset, the call stops at '
      + '402 free_quota_exceeded as soon as the selection would cross eBay\'s monthly free-listing '
      + 'allowance; set true to accept eBay\'s per-listing insertion fee of roughly $0.35 US DOLLARS on '
      + 'each listing past that allowance. It does NOT bypass eBay\'s separate monthly selling cap, '
      + 'which still rejects with 409 selling_cap_reached.',
  },
} as const;
