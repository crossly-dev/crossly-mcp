import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

export const inventoryTools: ToolDef[] = [
  {
    name: 'list_inventory',
    description:
      'List the seller\'s inventory items (the source-of-truth catalog, separate from per-platform listings). ' +
      'Use this to find an item by title, get its ID for crossposting, or audit what\'s in stock. ' +
      'Filter by status="active"|"sold"|"archived" or a free-text search. Returns paginated rows with ' +
      'defaultTitle, defaultPrice, brand, size, condition, images, quantity, createdAt.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
        search: {
          type: 'string',
          description: 'Free-text match against title/description. Omit to list everything.',
        },
        status: {
          type: 'string',
          enum: ['active', 'sold', 'archived'],
          description: 'Filter by lifecycle status. Most users only care about "active".',
        },
        kind: {
          type: 'string',
          enum: ['physical', 'web3'],
          description: 'Physical goods or Web3 assets (NFTs synced from a linked wallet). Omit for both.',
        },
        platforms: {
          type: 'string',
          description: 'Comma-separated marketplaces, e.g. "ebay,vinted": items with an active listing on any of them.',
        },
        platformMode: {
          type: 'string',
          enum: ['listed', 'not_listed'],
          description: '"not_listed" inverts platforms: items live on NONE of them (what still needs crossposting there).',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/inventory', {
        page: args.page,
        limit: args.limit,
        search: args.search,
        status: args.status,
        kind: args.kind,
        platforms: args.platforms,
        platformMode: args.platformMode,
      }),
  },
  {
    name: 'merge_inventory_items',
    description:
      'Merge inventory items that are the SAME physical item into one - e.g. an import from two marketplaces ' +
      'created one item per platform for a single ring. The kept item gets every listing link, sale, order and ' +
      'conversation; the others are archived (never deleted). Stock is NOT added together: one item listed ' +
      'twice is still one item. Ask the seller which item to keep.',
    inputSchema: {
      type: 'object',
      properties: {
        keepItemId: { type: 'string', description: 'UUID of the inventory item that survives.' },
        mergeItemIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'UUIDs of the items folded into it and archived. Must not include the keeper.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['keepItemId', 'mergeItemIds'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { keepItemId, mergeItemIds, idempotencyKey } = args as {
        keepItemId: string;
        mergeItemIds: string[];
        idempotencyKey?: string;
      };
      return apiPost('/v1/inventory/merge', { keepItemId, mergeItemIds }, idempotencyKey);
    },
  },
  {
    name: 'get_inventory_item',
    description:
      'Fetch one inventory item by its UUID, plus every platform-listing row attached to it ' +
      '(so you can see which marketplaces it\'s currently live on, their per-platform IDs, and their URLs). ' +
      'Use this before deciding to crosspost (to know which platforms are already covered) or before editing.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inventory item UUID. Get this from list_inventory.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/inventory/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'create_inventory_item',
    description:
      'Add a new item to the seller\'s catalog. This does NOT list it on any marketplace — call crosspost_listing ' +
      'afterward with the returned id. Required: defaultTitle. Recommended: defaultPrice, brand, size, condition, ' +
      'images (array of public URLs). Returns the created row with its UUID.',
    inputSchema: {
      type: 'object',
      properties: {
        defaultTitle: { type: 'string', maxLength: 140, description: 'Item title used as the default across platforms.' },
        defaultDescription: {
          type: 'string',
          maxLength: 8000,
          description:
            'Long-form item description, max 8000 chars. In Crossly a description is a LISTING fact (one item can read '
            + 'differently on eBay than on Poshmark), so the canonical copy lives on the listing — set it with '
            + 'create_listing/update_listing rather than relying on this.',
        },
        defaultPrice: { type: 'number', description: 'Asking price in US DOLLARS as a decimal, e.g. 45.99 — NOT cents. Fields ending in `Cents` elsewhere in this API are integer cents; do not mix them up.' },
        originalPrice: { type: 'number', description: 'Original/MSRP in US DOLLARS as a decimal, e.g. 120.00 — NOT cents. Used only for "X% off" displays; it is never charged.' },
        brand: {
          type: 'string',
          maxLength: 80,
          description:
            'Brand/maker as free text, max 80 chars, e.g. "Patagonia". Stored verbatim — each platform matches it to '
            + 'its own brand picker at publish time.',
        },
        size: {
          type: 'string',
          maxLength: 40,
          description:
            'Size exactly as the seller writes it, max 40 chars, e.g. "M", "10.5", "32x30". Free text, no unit or '
            + 'sizing-system validation.',
        },
        condition: {
          type: 'string',
          maxLength: 40,
          description: 'e.g. "new_with_tags", "like_new", "good", "fair". Each platform maps to its own enum at publish time.',
        },
        color: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Colors as free-text strings, e.g. ["black","cream"]. Defaults to [] when omitted; platforms that accept '
            + 'only one color take the first entry.',
        },
        category: {
          type: 'object',
          properties: {
            main: { type: 'string' },
            sub: { type: 'string' },
            sub2: { type: 'string' },
          },
          description: 'Hierarchical category. Free-form strings; the dispatcher maps to platform-specific IDs.',
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Hashtag/keyword list.' },
        labels: { type: 'array', items: { type: 'string' }, description: 'User-defined organisational labels.' },
        sku: {
          type: 'string',
          maxLength: 80,
          description:
            'Seller-chosen stock-keeping code, max 80 chars. Never generated for you and NOT uniqueness-enforced — '
            + 'call inventory_sku_exists first to avoid a duplicate. It is also the key import_inventory_csv matches '
            + 'on, so it is what makes the export → edit → re-import round trip update instead of duplicate.',
        },
        quantity: {
          type: 'integer',
          minimum: 0,
          default: 1,
          description:
            'Units on hand as a whole count (not a weight or a pack size). Minimum 0, defaults to 1. This is total '
            + 'stock; the server derives available/reserved/sold from it as orders arrive.',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'uri' },
          description: 'Public HTTPS image URLs. First is the cover.',
        },
        notes: { type: 'string', maxLength: 8000, description: 'Private notes — never shown to buyers.' },
        weightLb: { type: 'number', minimum: 0, description: 'Package weight (pounds part) for dimensional-shipping box selection.' },
        weightOz: { type: 'number', minimum: 0, description: 'Package weight (ounces part).' },
        dimensionLIn: { type: 'number', minimum: 0, description: 'Package length in inches.' },
        dimensionWIn: { type: 'number', minimum: 0, description: 'Package width in inches.' },
        dimensionHIn: { type: 'number', minimum: 0, description: 'Package height in inches.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['defaultTitle'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inventory', body, idempotencyKey);
    },
  },
  {
    name: 'update_inventory_item',
    description:
      'Edit an inventory item\'s defaults. Only the fields you pass are changed (PATCH semantics). ' +
      'This updates the local catalog but does NOT propagate edits to live marketplace listings — ' +
      'use update_listing for that. Pass an idempotencyKey if you may retry.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inventory item UUID (inventory_items.id) — the `id` from list_inventory or get_inventory_item. Must belong to the calling seller or the call 404s.' },
        defaultTitle: {
          type: 'string',
          maxLength: 140,
          description:
            'Replacement item NAME, max 140 chars. This is how the seller identifies the physical thing (it backs '
            + 'inventory search and CSV re-import matching); it does NOT rewrite the titles of live marketplace '
            + 'listings — use update_listing for those.',
        },
        defaultDescription: {
          type: 'string',
          maxLength: 8000,
          description:
            'Replacement description, max 8000 chars. Descriptions are a listing fact in Crossly, so editing it here '
            + 'changes no live marketplace copy — use update_listing for what buyers read.',
        },
        defaultPrice: { type: 'number' , description: 'In DOLLARS as a decimal, e.g. 45.99 — this column is decimal(10,2), NOT cents. Other Crossly fields ending in `Cents` are integers of cents; do not mix them up.' },
        originalPrice: { type: 'number' , description: 'In DOLLARS as a decimal, e.g. 45.99 — this column is decimal(10,2), NOT cents. Other Crossly fields ending in `Cents` are integers of cents; do not mix them up.' },
        brand: { type: 'string', description: 'Replacement brand as free text, max 80 chars. Omit to leave the current brand alone (PATCH semantics).' },
        size: { type: 'string', description: 'Replacement size string, max 40 chars, e.g. "M" or "10.5". Free text — no sizing-system validation.' },
        condition: { type: 'string', description: 'Replacement condition slug, max 40 chars — e.g. "new_with_tags", "like_new", "good", "fair". Each platform maps it to its own condition enum at publish time.' },
        color: { type: 'array', items: { type: 'string' }, description: 'REPLACES the whole color array — not merged. Pass every color you want to keep; [] clears them.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'REPLACES the whole hashtag/keyword array — not merged. Pass the full list; [] clears it.' },
        labels: { type: 'array', items: { type: 'string' }, description: 'REPLACES the whole label array — not merged. For add/remove semantics across many items use inventory_bulk_labels instead.' },
        sku: {
          type: 'string',
          description:
            'Replacement stock-keeping code, max 80 chars. Changing it breaks the CSV round-trip match for this item: '
            + 'a later import_inventory_csv still carrying the OLD sku will add a duplicate rather than update.',
        },
        quantity: {
          type: 'integer',
          minimum: 0,
          description:
            'New total units on hand, a whole count of 0 or more. NOTE: this writes the Crossly row ONLY — it does not '
            + 'push the new stock to live marketplace listings and will not delist at 0. Use '
            + 'bulk_set_inventory_quantity when the change has to reach the marketplaces.',
        },
        images: { type: 'array', items: { type: 'string', format: 'uri' }, description: 'REPLACES the whole image array — not merged. Public HTTPS URLs; the first is the cover photo.' },
        notes: { type: 'string', maxLength: 8000, description: 'Replacement private notes, max 8000 chars. Seller-only — never shown to buyers and never pushed to a marketplace.' },
        weightLb: { type: 'number', minimum: 0, description: 'Package weight (pounds part).' },
        weightOz: { type: 'number', minimum: 0, description: 'Package weight (ounces part).' },
        dimensionLIn: { type: 'number', minimum: 0, description: 'Package length in inches.' },
        dimensionWIn: { type: 'number', minimum: 0, description: 'Package width in inches.' },
        dimensionHIn: { type: 'number', minimum: 0, description: 'Package height in inches.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPatch(`/v1/inventory/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'archive_inventory_item',
    description:
      'Soft-delete (archive) an inventory item — it disappears from the active catalog but is preserved for ' +
      'analytics. Does NOT delist active marketplace listings; call delist for that first if needed. ' +
      'Safe to retry with the same idempotencyKey.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inventory item UUID.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/inventory/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'get_inventory_activity',
    description:
      'List the activity log for an inventory item — created/sold/edited/quantity-changed/etc. Useful for ' +
      'debugging "why does this look weird?" or building an item history view.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inventory item UUID.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 50,
          description: 'Max events to return, 1-100, default 50. Newest first; there is no cursor, so raise this rather than paging.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/inventory/${encodeURIComponent(args.id as string)}/activity`, {
        limit: args.limit,
      }),
  },

  // ── Bulk inventory operations + label management ───────────────────────
  {
    name: 'inventory_bulk_labels',
    description:
      'Bulk add/remove labels on inventory items. Pass addLabels and/or removeLabels arrays; at least one of the two must be ' +
      'non-empty. Idempotent — duplicates in the existing array are de-duplicated. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 50000,
          description:
            'Inventory item UUIDs (inventory_items.id) to relabel, 1-50000 of them. Get the set from '
            + 'list_inventory_ids. Ids that are not this seller\'s are silently skipped, so compare the returned '
            + '`updated` count against the length you sent.',
        },
        addLabels: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Label strings to ADD to every listed item, each max 100 chars. Merged into the existing labels and '
            + 'de-duplicated, so re-running is harmless. Defaults to [].',
        },
        removeLabels: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Label strings to STRIP from every listed item, each max 100 chars; exact match, case-sensitive. Applied '
            + 'before addLabels. Defaults to []; the call 400s ("no_changes") if both arrays end up empty.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ids'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inventory/bulk-labels', body, idempotencyKey);
    },
  },
  {
    name: 'inventory_bulk_archive',
    description:
      'Bulk archive inventory items (soft delete — status=archived). Items disappear from active rollups but are preserved ' +
      'for analytics. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 50000,
          description:
            'Inventory item UUIDs (inventory_items.id) to archive, 1-50000 of them. Get the set from '
            + 'list_inventory_ids. Archiving only sets status="archived" — it does NOT delist anything, so items '
            + 'stay live and buyable on every marketplace until you delist them separately.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ids'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inventory/bulk-archive', body, idempotencyKey);
    },
  },
  {
    name: 'inventory_bulk_delete',
    description:
      "Bulk delete inventory items. Returns 409 when items are still linked to listings unless force=true; its details " +
      "carry cascadeByPlatform/cascadeTotal — the LIVE marketplace listings deleteListings=true would END (e.g. 2,786 on " +
      "eBay) — and deleteListingsDefault, what omitting deleteListings does for this seller (their saved setting). " +
      "Before forcing, tell the user both outcomes in numbers and get an explicit choice; ending listings takes them off " +
      "the marketplaces and cannot be undone from Crossly. Always pass deleteListings explicitly when forcing. Pass an " +
      "idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 50000,
          description:
            'Inventory item UUIDs (inventory_items.id) to delete permanently, 1-50000 of them. Get the set from '
            + 'list_inventory_ids. Any id still linked to a non-archived listing or an active platform listing is '
            + 'counted in the 409 `blockedCount` and nothing is deleted unless force=true.',
        },
        force: { type: 'boolean', default: false, description: 'Skip the linked-listings guard.' },
        deleteListings: {
          type: 'boolean',
          description:
            'true = also END every linked live marketplace listing (irreversible from Crossly); false = keep them live, '
            + 'only delink. Omitted = the seller\'s saved setting (see the 409\'s deleteListingsDefault). Pass it explicitly.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ids'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inventory/bulk-delete', body, idempotencyKey);
    },
  },
  {
    name: 'inventory_labels_stats',
    description:
      "List every distinct label the seller has used across their catalog, with item-count and assigned color. Use this to " +
      "show a 'manage labels' UI or audit which labels actually have items.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/inventory/labels/stats'),
  },
  {
    name: 'inventory_labels_rename',
    description:
      "Rename a label across every inventory item that carries it. Color metadata is migrated atomically. Pass an " +
      "idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description:
            'The existing label to rename, 1-100 chars. Exact, case-sensitive match — items that do not carry this '
            + 'exact string are untouched and the response `updated` count will be 0.',
        },
        to: {
          type: 'string',
          description:
            'The new label text, 1-100 chars. If an item already carries it the two labels MERGE and the duplicate '
            + 'collapses. Passing the same value as `from` is a no-op returning updated: 0.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inventory/labels/rename', body, idempotencyKey);
    },
  },

  // ── Discovery helpers ──────────────────────────────────────────────────
  {
    name: 'list_inventory_facets',
    description:
      "Distinct brands + main categories across this user's inventory. Drives the filter chips on the inventory page.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/inventory/facets'),
  },
  {
    name: 'list_inventory_ids',
    description:
      "Filter inventory → return the matching id list. Canonical pattern for bulk actions: materialize the id set " +
      "here, then dispatch to inventory_bulk_* tools. Filters: status / search (title or brand ilike) / category / " +
      "platform (only items currently listed there) / labels (comma-separated).",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Exact lifecycle status to match — "active", "sold" or "archived". Omit to match every status.',
        },
        search: {
          type: 'string',
          description:
            'Case-insensitive substring (SQL ILIKE %term%) matched against the item title OR the brand. Omit for no '
            + 'text filter.',
        },
        category: {
          type: 'string',
          description:
            'Exact main-category name. Category is a LISTING fact in Crossly, so this keeps items that have at least '
            + 'one listing whose category.main equals this string exactly.',
        },
        platform: {
          type: 'string',
          description:
            'Platform slug — "ebay", "poshmark", "mercari", "etsy", … Keeps only items that have a platform-listing '
            + 'row on that platform for this seller, in ANY status (so sold and delisted rows still match).',
        },
        labels: { type: 'string', description: 'Comma-separated label list.' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/inventory/ids', {
        status: args.status,
        search: args.search,
        category: args.category,
        platform: args.platform,
        labels: args.labels,
      }),
  },
  {
    name: 'inventory_sku_exists',
    description:
      "Check whether a SKU is already in use on this user's inventory. Returns { exists: boolean }. Use during " +
      "import flows or before create_inventory_item to dedupe.",
    inputSchema: {
      type: 'object',
      properties: {
        sku: {
          type: 'string',
          description:
            'The SKU string to look for. Exact, case-sensitive match, scoped to the calling seller only — another '
            + "seller's identical SKU does not count as taken.",
        },
      },
      required: ['sku'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/inventory/sku-exists', { sku: args.sku }),
  },
  {
    name: 'list_inventory_labels',
    description:
      "List every distinct label across this user's inventory. Drives the labels filter chip in the web/mobile " +
      "inventory page. Pair with inventory_labels_stats for counts + colors.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/inventory/labels'),
  },
  {
    name: 'import_inventory_csv',
    description:
      'Import a CSV into the seller\'s inventory. Rows whose `sku` matches an item they already have UPDATE ' +
      'that item; rows without a usable SKU are ADDED as new items. That is the whole round-trip: export, edit, ' +
      'import back. If you strip or omit the sku column you will duplicate their catalog, so keep it. ' +
      'ALWAYS call once with dryRun=true first and show the seller the created/updated/skipped counts before ' +
      'committing - this endpoint can damage a whole catalog and a preview costs one call. ' +
      'Columns: title (required), price (required), quantity, condition, brand, size, color, sku, cost_of_goods, ' +
      'description, images, category_main, category_sub, tags, notes, warehouse_location, storage_bin. ' +
      'Multi-value cells use ";". Rows carrying price/description/category also create a DRAFT listing - ' +
      'nothing is ever published by an import. Bad rows are skipped and reported with their spreadsheet line ' +
      'number, not fatal.',
    inputSchema: {
      type: 'object',
      properties: {
        csv: { type: 'string', description: 'The CSV text, header row included.' },
        dryRun: {
          type: 'boolean',
          description: 'Report what would happen without writing anything. Do this first.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['csv'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { csv, dryRun, idempotencyKey } = args as {
        csv: string;
        dryRun?: boolean;
        idempotencyKey?: string;
      };
      return apiPost('/v1/inventory/csv/import', { csv, dryRun }, idempotencyKey);
    },
  },
  {
    name: 'export_inventory_csv',
    description:
      'Export the seller\'s inventory as CSV text. Emits exactly the columns import_inventory_csv reads, so the ' +
      'output can be edited and imported straight back. Pass itemIds to export a subset; omit for everything. ' +
      'Price, description and category come from each item\'s most recent listing.',
    inputSchema: {
      type: 'object',
      properties: {
        itemIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Inventory item UUIDs. Omit to export the whole inventory.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { itemIds } = args as { itemIds?: string[] };
      return apiPost('/v1/inventory/csv/export', itemIds?.length ? { itemIds } : {});
    },
  },
  {
    name: 'bulk_set_inventory_quantity',
    description:
      "Set, add to, or subtract from the stock on many inventory items at once. " +
      "This is NOT just a column write - stock is mirrored by every marketplace the items are listed on, so " +
      "the push fans out: live listings get the new quantity, anything dropping to 0 is DELISTED before someone " +
      "can buy air, and anything rising from 0 reactivates or raises a restock prompt. " +
      "mode='set' means 'this many are on the shelf'; increase/decrease adjust by the value. A decrease is " +
      "floored at 0. " +
      "The numbers change immediately and the returned bulkJobId tracks the marketplace push. `skipped` counts " +
      "ids that did not move (already at that number, or not this seller's). " +
      "Confirm the count with the seller before running this over a large selection - it changes what buyers see.",
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Inventory item UUIDs. Get them from list_inventory or the ids endpoint.',
        },
        mode: {
          type: 'string',
          enum: ['set', 'increase', 'decrease'],
          description: "'set' assigns the number; the others adjust by it.",
        },
        value: { type: 'number', description: 'Non-negative whole number.' },
        syncMarketplaces: {
          type: 'boolean',
          description: 'False changes Crossly only and leaves live listings alone. Defaults to true.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['ids', 'mode', 'value'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { ids, mode, value, syncMarketplaces, idempotencyKey } = args as {
        ids: string[];
        mode: string;
        value: number;
        syncMarketplaces?: boolean;
        idempotencyKey?: string;
      };
      return apiPost(
        '/v1/inventory/bulk-quantity',
        { ids, mode, value, syncMarketplaces },
        idempotencyKey,
      );
    },
  },
];
