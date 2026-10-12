import { apiDelete, apiGet, apiPatch, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from '../types.js';

export const listingsCore: ToolDef[] = [
  {
    name: 'list_listings',
    description:
      'List the seller\'s listings across all connected marketplaces. Use this to see what\'s live, ' +
      'find a listing to edit or delist, or audit coverage per platform. Filter by ' +
      'platform="poshmark"|"mercari"|"ebay"|"etsy"|"shopify"|"depop"|"grailed"|"vinted"|"whatnot"|"vestiaire"|"facebook"|"offerup" ' +
      'and/or status="active"|"sold"|"draft", and kind="physical"|"web3" (NFT listings, whose marketplaces are ' +
      'web3_crossly, web3_opensea, web3_tensor, web3_magic_eden, web3_rarible). Paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
        platform: {
          type: 'string',
          description:
            'Restrict to one marketplace, e.g. "ebay", "poshmark" or "web3_opensea". Omit for all platforms.',
        },
        status: {
          type: 'string',
          description:
            'Filter by lifecycle: "draft" (never published), "active" (live on at least one '
            + 'marketplace), "sold" (the sale cascade closed it), "paused" (held back by the seller) or '
            + '"archived" (soft-deleted, recoverable). Most users want "active".',
        },
        kind: {
          type: 'string',
          enum: ['physical', 'web3'],
          description: 'Physical goods or Web3 assets (NFT listings). Omit for both.',
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
        kind: args.kind,
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
        platformListingIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Optional. End only these marketplace copies (the platformListings[].id from get_listing) — e.g. one " +
            "eBay site's copy of an item live on several eBay sites (ebay.co.uk, ebay.com …).",
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const q: Record<string, string> = {};
      if (Array.isArray(args.platforms) && (args.platforms as unknown[]).length > 0) q.platforms = (args.platforms as string[]).join(',');
      if (Array.isArray(args.platformListingIds) && (args.platformListingIds as unknown[]).length > 0) {
        q.platformListingIds = (args.platformListingIds as string[]).join(',');
      }
      const query = Object.keys(q).length > 0 ? q : undefined;
      return apiDelete(
        `/v1/listings/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
        query,
      );
    },
  },
  {
    name: 'set_listing_site_price',
    description:
      "Set the price of ONE marketplace copy of a listing, in that copy's own currency. A listing can be live on " +
      'several sites of one marketplace account (eBay: ebay.co.uk, ebay.com, ebay.ca …), each copy its own ' +
      "listing with its own price. The listing's main price (update_listing) prices the account's own site; " +
      'use this for any other site. Only that copy is updated on the marketplace.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Listing UUID.' },
        platformListingId: { type: 'string', description: "The copy's platformListings[].id (from get_listing), not the marketplace item id." },
        price: { type: 'number', description: "The price, in that copy's currency (platformListings[].currency)." },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'platformListingId', 'price'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPatch(
        `/v1/listings/${encodeURIComponent(args.id as string)}/platform-listings/${encodeURIComponent(args.platformListingId as string)}`,
        { price: args.price },
        args.idempotencyKey as string | undefined,
      ),
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
];
