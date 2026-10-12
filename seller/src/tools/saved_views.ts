import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const savedViewsTools: ToolDef[] = [
  {
    name: 'list_saved_views',
    description:
      "List the seller's saved view presets (per-resource filter+sort+viewMode combos). Optional `resource` filter narrows " +
      'to one of listings / inventory / sales / orders / returns. Ordered by sortOrder then name.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          enum: ['listings', 'inventory', 'sales', 'orders', 'returns'],
          description:
            'Optional: return only the views saved for one list page. Omit for every resource. ' +
            "'listings' = the crossposted-listings list; 'inventory' = the inventory-item list; " +
            "'sales' = the sales list; 'orders' = the buyer-order list; 'returns' = the returns list. " +
            'Matched exactly against the stored string, so an unknown value returns an empty list ' +
            'rather than an error.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/saved-views', { resource: args.resource }),
  },
  {
    name: 'create_saved_view',
    description:
      'Create a saved view preset. resource picks which page it belongs to. filters is the filter blob the page already ' +
      'understands. viewMode is the per-resource display mode (grid/table/etc.). Setting isDefault=true clears any other ' +
      'default for the same (user, resource) tuple — there\'s at most one default per resource. Pass an idempotencyKey on ' +
      'retries.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          enum: ['listings', 'inventory', 'sales', 'orders', 'returns'],
          description:
            'Which list page this view belongs to — required, and it decides which page can ever ' +
            "recall it. 'listings' = the crossposted-listings list; 'inventory' = the inventory-item " +
            "list; 'sales' = the sales list; 'orders' = the buyer-order list; 'returns' = the returns " +
            'list. Also the scope of the one-default-per-resource rule below.',
        },
        name: {
          type: 'string',
          maxLength: 100,
          description:
            'Label the seller sees on the saved-view chip, e.g. "Unsold Poshmark over 30 days". ' +
            'Required, 1-100 characters. Not unique — two views may share a name.',
        },
        filters: {
          type: 'object',
          description:
            'The stored filter set itself: an arbitrary JSON object the list page wrote and will ' +
            'replay verbatim. The server stores it as jsonb without validating any key, so it must ' +
            'match what the target resource page understands. The seller dashboard writes, per ' +
            'resource: `search` (string), the status tab (`statusTab` for listings, `statusFilter` ' +
            'for inventory, `activeTab` for orders), `platformFilter`/`labelFilter` (string arrays), ' +
            '`sort` (string), `pageSize` (number), `viewMode`, and an `advanced` object of the ' +
            'per-page advanced filters. Defaults to {} (a view that filters nothing).',
        },
        viewMode: {
          type: ['string', 'null'],
          description:
            'Display mode to restore with the filters. Max 40 characters; the web app only ever ' +
            "writes 'row' (dense table rows) or 'grid' (photo tiles). Pass null, or omit, to leave " +
            "the page's current display mode alone when the view is applied.",
        },
        isDefault: {
          type: 'boolean',
          default: false,
          description:
            'true = make this the view that loads automatically when the seller opens that page. ' +
            'The server first clears isDefault on every other view for the same (user, resource), ' +
            'so there is at most one default per resource. Default false.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['resource', 'name'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/saved-views', body, idempotencyKey);
    },
  },
  {
    name: 'update_saved_view',
    description:
      'Update a saved view preset (PATCH). Any subset of name / filters / viewMode / isDefault / sortOrder may be supplied. ' +
      'Setting isDefault=true clears any other default for the same resource. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the saved view to update, from list_saved_views. Must belong to the calling ' +
            "seller — anything else 404s. The view's `resource` cannot be changed; create a new view " +
            'to move a filter set to another page.',
        },
        name: {
          type: 'string',
          maxLength: 100,
          description:
            'Rename the view (1-100 characters). Omit to leave the current label unchanged.',
        },
        filters: {
          type: 'object',
          description:
            'Replaces the stored filter object wholesale — it is NOT merged, so send the complete ' +
            'filter set, not just the keys that changed. Same free-form jsonb blob the resource page ' +
            'understands (search / status tab / platform + label arrays / sort / pageSize / advanced ' +
            'object). Omit to keep the existing filters.',
        },
        viewMode: {
          type: ['string', 'null'],
          description:
            "Display mode to restore, max 40 characters; the web app writes 'row' (dense table rows) " +
            "or 'grid' (photo tiles). Pass null to clear it so applying the view leaves the page's " +
            'display mode alone. Omit to keep the existing value.',
        },
        isDefault: {
          type: 'boolean',
          description:
            'true = make this the auto-loading view for its resource, clearing isDefault on every ' +
            'other view of the same resource first (at most one default per resource). false = stop ' +
            'being the default, leaving that resource with none. Omit to leave as-is.',
        },
        sortOrder: {
          type: 'integer',
          description:
            'Manual ordering position among that resource\'s views — list_saved_views sorts ascending ' +
            'by sortOrder, then by name. Lower sorts first; new views start at 0, and negatives are ' +
            'allowed to pin one ahead of them. Omit to leave the current position.',
        },
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
      return apiPatch(`/v1/saved-views/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delete_saved_view',
    description: 'Delete a saved view preset by id. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the saved view to delete, from list_saved_views. Scoped to the calling seller, ' +
            'so another user\'s id deletes nothing. Deleting only discards the stored filter preset — ' +
            'no listings, orders or other records are touched. If it was the resource\'s default, that ' +
            'resource is simply left with no default.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/saved-views/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
];
