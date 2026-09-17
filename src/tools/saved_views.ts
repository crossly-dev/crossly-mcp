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
        },
        name: { type: 'string', maxLength: 100 },
        filters: { type: 'object' },
        viewMode: { type: ['string', 'null'] },
        isDefault: { type: 'boolean', default: false },
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
        id: { type: 'string' },
        name: { type: 'string', maxLength: 100 },
        filters: { type: 'object' },
        viewMode: { type: ['string', 'null'] },
        isDefault: { type: 'boolean' },
        sortOrder: { type: 'integer' },
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
        id: { type: 'string' },
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
