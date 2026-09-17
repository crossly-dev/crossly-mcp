import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

export const listingsTools: ToolDef[] = [
  {
    name: 'list_listings',
    description:
      'List the seller\'s listings across all connected marketplaces. Use this to see what\'s live, ' +
      'find a listing to edit or delist, or audit coverage per platform. Filter by ' +
      'platform="poshmark"|"mercari"|"ebay"|"etsy"|"shopify"|"depop"|"grailed"|"vinted"|"whatnot"|"vestiaire"|"facebook"|"offerup" ' +
      'and/or status="active"|"sold"|"draft". Paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
        platform: {
          type: 'string',
          description: 'Restrict to one marketplace. Omit for all platforms.',
        },
        status: {
          type: 'string',
          description: 'Filter by lifecycle. Most users want "active".',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/listings', {
        page: args.page,
        limit: args.limit,
        platform: args.platform,
        status: args.status,
      }),
  },
  {
    name: 'get_listing',
    description:
      'Fetch one listing by UUID, including every per-platform row (platformListingId, URL, status). ' +
      'Use this to find the public URL on each marketplace, or to inspect failure reasons.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Listing UUID from list_listings.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/listings/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'crosspost_listing',
    description:
      'Crosspost an item to one or more marketplaces. This is the primary "list it for me" action. ' +
      'Pass either an existing inventoryItemId (recommended — preserves linkage so a sale on one platform ' +
      'auto-delists the others), or a fresh `data` blob WITH createInventoryItem set to true. ' +
      'Do not create listings with neither: without an inventory item nothing decrements when it sells, ' +
      'there is no cost basis or aging, and the listing is invisible to every inventory report — ' +
      'building a catalogue that way produces a shelf that reads as empty. ' +
      '`platforms` is an array of platform slugs; each ' +
      'gets a background job. Returns the created listing row plus a job-id per platform — they run async. ' +
      'ALWAYS pass an idempotencyKey on retries to avoid double-listing.',
    inputSchema: {
      type: 'object',
      properties: {
        inventoryItemId: {
          type: 'string',
          description: 'UUID of an existing inventory item. Strongly preferred over passing data alone.',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 15,
          description:
            'Slugs of platforms to crosspost to, e.g. ["poshmark","mercari","ebay"]. Each must be a connected account on the seller\'s side.',
        },
        data: {
          type: 'object',
          description:
            'Listing payload merged with inventory-item defaults. At minimum: { title, description, price, images }. Extra platform-specific fields (e.g. shipping policies for eBay) are passed through.',
        },
        createInventoryItem: {
          type: 'boolean',
          description:
            'Create the inventory item behind this listing from `data`. Use this whenever you are NOT passing an inventoryItemId. Ignored if one is supplied.',
        },
        inventoryItemQuantity: {
          type: 'integer',
          minimum: 0,
          description: "Physical units on the shelf. Defaults to data.quantity, then 1.",
        },
        compositionQuantity: {
          type: 'integer',
          minimum: 1,
          description: 'Units of the item consumed per sale of this listing. Defaults to 1.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platforms', 'data'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings', body, idempotencyKey);
    },
  },
  {
    name: 'update_listing',
    description:
      'Edit a live listing on one or more platforms (price drop, title fix, image swap). ' +
      '`changes` is a sparse object of fields to update. Omit `platforms` to push the edit to every platform ' +
      'this listing is live on; pass an array to restrict (e.g. ["poshmark"]). Each affected platform gets ' +
      'an async job. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Listing UUID.' },
        changes: {
          type: 'object',
          description:
            'Sparse object — only the fields you want changed (e.g. { price: 24.99 }). Title/description/images/price are universally supported.',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional. Restrict the edit to these platforms. Omit for all.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'changes'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPatch(`/v1/listings/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delist',
    description:
      'End / remove a listing from one or more marketplaces. Without `platforms`, delists from EVERY platform ' +
      'this listing is currently live on. Each platform gets an async job. Use this for manual takedowns; the ' +
      'sale cascade auto-delists when an item sells, so you rarely need this for sold items. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Listing UUID.' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional. Restrict to these platforms. Omit to delist everywhere.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const query =
        Array.isArray(args.platforms) && (args.platforms as unknown[]).length > 0
          ? { platforms: (args.platforms as string[]).join(',') }
          : undefined;
      return apiDelete(
        `/v1/listings/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
        query,
      );
    },
  },
  {
    name: 'import_listing_by_url',
    description:
      'Attach a real platform listing to an existing Crossly listing by pasting its live URL — fetches the ' +
      'actual title/price/images/condition from the marketplace (not a URL-only stub) and links it as that ' +
      'listing\'s platform channel. Use when the seller already has an item live on a marketplace and wants ' +
      'Crossly to track/manage it going forward. Supported platforms: ebay, etsy, shopify, poshmark, mercari, ' +
      'depop, grailed, vinted, whatnot, offerup, curtsy, vestiaire, facebook. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Crossly listing UUID to attach onto.' },
        platform: { type: 'string', description: 'Marketplace slug, e.g. "ebay", "poshmark".' },
        url: { type: 'string', description: 'The live listing URL on that platform.' },
        accountSlot: {
          type: 'integer',
          description: 'Optional — which connected account slot to resolve against. Defaults to 1.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'platform', 'url'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/listings/${encodeURIComponent(id)}/import-by-url`, body, idempotencyKey);
    },
  },
  {
    name: 'listing_magic_fill',
    description:
      'Auto-fill empty fields on ONE platform tab of an existing listing from the master listing\'s own data, ' +
      'using the same deterministic taxonomy resolvers + AI category/facet pickers Magic List uses — scoped to ' +
      'just this platform, so it works even if the seller is not currently connected to it (many resolvers are ' +
      'pure local lookups with no live-connection dependency). Never overwrites a field the seller already set. ' +
      'Use when a marketplace was added/connected after the listing was created, or a platform tab looks sparse ' +
      'compared to the master. Not applicable to the master listing itself — platform must be a real marketplace slug.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Crossly listing UUID.' },
        platform: { type: 'string', description: 'Marketplace slug, e.g. "depop", "grailed".' },
        note: {
          type: 'string',
          maxLength: 300,
          description:
            "The seller's own words about the item, e.g. \"it's the 1968 reissue, not the 1964\". "
            + 'Passed to the category and attribute pickers as authoritative over anything inferred '
            + 'from the title.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/listings/${encodeURIComponent(id)}/magic-fill`, body, idempotencyKey);
    },
  },
  {
    name: 'listing_list_discrepancies',
    description:
      'List detected marketplace-drift discrepancies for a listing — per-field cases where Crossly\'s stored ' +
      'value (condition/price/title/category/brand/size/quantity) diverges from what the platform\'s own detail ' +
      'fetch currently reports, found by the periodic listing-health sweep. Use to check whether a seller edited ' +
      'a listing directly on the marketplace outside Crossly.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Crossly listing UUID.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/listings/${encodeURIComponent(args.id as string)}/discrepancies`),
  },
  {
    name: 'listing_resolve_discrepancy',
    description:
      'Resolve one detected discrepancy (see listing_list_discrepancies). Each row has a `source`: ' +
      '\'remote_drift\' rows (the platform\'s own live data disagrees with Crossly) take "accept_remote" ' +
      '(the platform\'s current value becomes the Crossly override) or "push_ours" (push Crossly\'s stored value ' +
      'back to the platform). \'override_vs_master\' rows (this listing\'s own stored per-platform override ' +
      'disagrees with its own master field, no live fetch involved) take "sync_from_master" (clears the stale ' +
      'override so the effective value falls through to master, and re-pushes live if already published). ' +
      '"relist" applies to \'remote_drift\' or \'sync_failed\' and is the escape hatch for a value the platform '
      + 'refuses to edit in place at all (Grailed will not raise a price after a price drop, permanently) — it '
      + 'delists and posts a fresh listing, minting a NEW listing id and URL and losing the original\'s age, '
      + 'watchers and saves, so only use it when an in-place push has already failed for that reason. '
      + '"dismiss" applies to any source — acknowledges the drift and stops nagging unless it drifts further.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Crossly listing UUID.' },
        discrepancyId: { type: 'string', description: 'Discrepancy row UUID from listing_list_discrepancies.' },
        action: {
          type: 'string',
          enum: ['accept_remote', 'push_ours', 'sync_from_master', 'relist', 'dismiss'],
          description: 'How to resolve the discrepancy — must match the row\'s source, see above.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'discrepancyId', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, discrepancyId, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        discrepancyId: string;
        idempotencyKey?: string;
      };
      return apiPost(
        `/v1/listings/${encodeURIComponent(id)}/discrepancies/${encodeURIComponent(discrepancyId)}/resolve`,
        body,
        idempotencyKey,
      );
    },
  },

  // ── Bulk listing operations ─────────────────────────────────────────────
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
        listingIds: { type: 'array', items: { type: 'string' } },
        platforms: { type: 'array', items: { type: 'string' }, description: 'Required — target marketplaces.' },
        filters: { type: 'object' },
        confirmOverFreeQuota: { type: 'boolean' },
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
        listingIds: { type: 'array', items: { type: 'string' } },
        platforms: { type: 'array', items: { type: 'string' } },
        filters: { type: 'object' },
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
        listingIds: { type: 'array', items: { type: 'string' } },
        platforms: { type: 'array', items: { type: 'string' } },
        filters: { type: 'object' },
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
        listingIds: { type: 'array', items: { type: 'string' } },
        filters: { type: 'object' },
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
        listingIds: { type: 'array', items: { type: 'string' } },
        filters: { type: 'object' },
        updates: {
          type: 'object',
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
        listingIds: { type: 'array', items: { type: 'string' } },
        filters: { type: 'object' },
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
        listingIds: { type: 'array', items: { type: 'string' } },
        filters: { type: 'object' },
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
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 200 },
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

  // ── Discovery helpers ──────────────────────────────────────────────────
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
        status: { type: 'string' },
        platform: { type: 'string' },
        search: { type: 'string' },
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
        sku: { type: 'string' },
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
];
