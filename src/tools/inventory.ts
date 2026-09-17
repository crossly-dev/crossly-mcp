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
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/inventory', {
        page: args.page,
        limit: args.limit,
        search: args.search,
        status: args.status,
      }),
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
        defaultDescription: { type: 'string', maxLength: 8000 },
        defaultPrice: { type: 'number', description: 'Asking price in USD.' },
        originalPrice: { type: 'number', description: 'Original/MSRP for "X% off" displays.' },
        brand: { type: 'string', maxLength: 80 },
        size: { type: 'string', maxLength: 40 },
        condition: {
          type: 'string',
          maxLength: 40,
          description: 'e.g. "new_with_tags", "like_new", "good", "fair". Each platform maps to its own enum at publish time.',
        },
        color: { type: 'array', items: { type: 'string' } },
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
        sku: { type: 'string', maxLength: 80 },
        quantity: { type: 'integer', minimum: 0, default: 1 },
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
        id: { type: 'string', description: 'Inventory item UUID.' },
        defaultTitle: { type: 'string', maxLength: 140 },
        defaultDescription: { type: 'string', maxLength: 8000 },
        defaultPrice: { type: 'number' , description: 'In DOLLARS as a decimal, e.g. 45.99 — this column is decimal(10,2), NOT cents. Other Crossly fields ending in `Cents` are integers of cents; do not mix them up.' },
        originalPrice: { type: 'number' , description: 'In DOLLARS as a decimal, e.g. 45.99 — this column is decimal(10,2), NOT cents. Other Crossly fields ending in `Cents` are integers of cents; do not mix them up.' },
        brand: { type: 'string' },
        size: { type: 'string' },
        condition: { type: 'string' },
        color: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        labels: { type: 'array', items: { type: 'string' } },
        sku: { type: 'string' },
        quantity: { type: 'integer', minimum: 0 },
        images: { type: 'array', items: { type: 'string', format: 'uri' } },
        notes: { type: 'string', maxLength: 8000 },
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
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
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
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50000 },
        addLabels: { type: 'array', items: { type: 'string' } },
        removeLabels: { type: 'array', items: { type: 'string' } },
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
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50000 },
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
      "Bulk delete inventory items. Returns 409 with blockedCount when items are still linked to active listings unless " +
      "force=true. With deleteListings=true the linked listings are also delisted (slow — coordinator job). Surface the 409 " +
      "warning to the user; do not auto-force without confirmation. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50000 },
        force: { type: 'boolean', default: false, description: 'Skip the linked-listings guard.' },
        deleteListings: { type: 'boolean', default: false, description: 'Also delist any linked active listings.' },
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
        from: { type: 'string' },
        to: { type: 'string' },
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
        status: { type: 'string' },
        search: { type: 'string' },
        category: { type: 'string' },
        platform: { type: 'string' },
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
      properties: { sku: { type: 'string' } },
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
