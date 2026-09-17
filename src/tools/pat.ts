import { apiDelete, apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const patTools: ToolDef[] = [
  {
    name: 'list_pat_scopes',
    description:
      'List the canonical PAT scope catalog — each entry has { id, label, description }. Use this before create_pat to ' +
      "show the user which scopes are available and what they unlock. Scopes follow the resource:action pattern (e.g. " +
      "'listings:read', 'orders:write').",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/pat/scopes'),
  },
  {
    name: 'list_pats',
    description:
      "List the seller's Personal Access Tokens. Returns the preview only (id, name, prefix, scopes, environment, " +
      'lastUsedAt, expiresAt, revokedAt, createdAt) — NEVER the full token. Use this to show "active sessions" in a UI.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/pat'),
  },
  {
    name: 'create_pat',
    description:
      'Mint a new PAT. The response includes the FULL token exactly ONCE — surface it to the user with a "copy this now" ' +
      'warning. Subsequent list_pats calls only return the preview. scopes must be a non-empty subset of the catalog ids ' +
      '(see list_pat_scopes). environment defaults to "live". expiresAt is optional; null = never expires until revoked. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 80 },
        scopes: { type: 'array', items: { type: 'string' }, minItems: 1 },
        environment: { type: 'string', enum: ['live', 'test'], default: 'live' },
        expiresAt: { type: ['string', 'null'], description: 'ISO 8601 timestamp or null for no expiry.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'scopes'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/pat', body, idempotencyKey);
    },
  },
  {
    name: 'delete_pat',
    description:
      'Revoke a PAT by id. Sets revokedAt = now() — the token immediately stops working. Cannot be undone (the seller must ' +
      'mint a fresh one). Pass an idempotencyKey on retries.',
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
      apiDelete(`/v1/pat/${encodeURIComponent(args.id as string)}`, args.idempotencyKey as string | undefined),
  },
];
