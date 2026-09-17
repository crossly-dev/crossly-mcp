import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const policyPresetsTools: ToolDef[] = [
  {
    name: 'list_policy_presets',
    description:
      "List the seller's reusable policy presets (return / shipping / payment policy blobs applied when publishing " +
      'listings). Optional `kind` filter narrows to one of return / shipping / payment.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['return', 'shipping', 'payment'],
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/policy-presets', { kind: args.kind }),
  },
  {
    name: 'create_policy_preset',
    description:
      'Create a policy preset. kind picks which policy family it belongs to (return / shipping / payment). policy is the ' +
      'opaque policy blob the platform layer already understands. Setting isDefault=true clears any other default for the ' +
      "same (user, kind) tuple — there's at most one default per kind. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['return', 'shipping', 'payment'],
        },
        name: { type: 'string', maxLength: 100 },
        policy: { type: 'object' },
        isDefault: { type: 'boolean', default: false },
        ...IDEMPOTENCY_PROP,
      },
      required: ['kind', 'name', 'policy'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/policy-presets', body, idempotencyKey);
    },
  },
  {
    name: 'update_policy_preset',
    description:
      'Update a policy preset (PATCH). Any subset of name / policy / isDefault may be supplied. Setting isDefault=true ' +
      'clears any other default for the same kind. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string', maxLength: 100 },
        policy: { type: 'object' },
        isDefault: { type: 'boolean' },
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
      return apiPatch(`/v1/policy-presets/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delete_policy_preset',
    description: 'Delete a policy preset by id. Pass an idempotencyKey on retries.',
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
        `/v1/policy-presets/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
];
