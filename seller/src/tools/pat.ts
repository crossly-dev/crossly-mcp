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
        name: {
          type: 'string',
          maxLength: 80,
          description:
            'Human label for the token, 1-80 characters — what the seller sees in the token list when deciding ' +
            'what to revoke (e.g. "Claude desktop", "nightly repricer"). Not unique and not part of the token string.',
        },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description:
            'Controlled vocabulary — every entry must be an id from the catalog the API enforces, and one unknown ' +
            'string rejects the whole call. At least one is required. Seller scopes: "*" (full access), ' +
            '"inventory:read"/"inventory:write", "listings:read"/"listings:write", "orders:read"/"orders:write", ' +
            '"inbox:read"/"inbox:write", "sales:read"/"sales:write", "analytics:read", "activity:read", ' +
            '"accounts:read"/"accounts:write", "automation:read"/"automation:write", "billing:write" (upgrade only, ' +
            'never downgrade/cancel), "payouts:write" (start payout-account onboarding), "webhooks:read"/"webhooks:write", "integrations:read"/"integrations:write", ' +
            '"customers:read"/"customers:write", "tax:read"/"tax:write", "catalog:read", ' +
            '"policy-presets:read"/"policy-presets:write". Buyer scopes act on a shopper rather than a store and ' +
            'are a separate principal: "buyer:profile:read", "buyer:orders:read", "buyer:cart:read"/"buyer:cart:write", ' +
            '"buyer:wishlist:read"/"buyer:wishlist:write", "buyer:cashback:read"/"buyer:cashback:write", ' +
            '"buyer:offers:read"/"buyer:offers:write", "buyer:auctions:read", "buyer:orders:write", ' +
            '"buyer:feedback:write", "buyer:history:write", "buyer:follows:read"/"buyer:follows:write", ' +
            '"buyer:activity:read"/"buyer:activity:write", "buyer:catalog:read", ' +
            '"buyer:monitors:read"/"buyer:monitors:write", "buyer:checkout:write" (spends money — also gates ' +
            'auction bids). Call ' +
            'list_pat_scopes for the live catalog rather than trusting this list to stay current, and grant the ' +
            'narrowest set that works — a scope cannot be added to a token later, only re-minted.',
        },
        environment: {
          type: 'string',
          enum: ['live', 'test'],
          default: 'live',
          description:
            'A LABEL baked into the token string (crossly_pat_<env>_<prefix>_<secret>), not a sandbox. "live" ' +
            '(the default) and "test" both authenticate against the same production account and the same real ' +
            'data — "test" exists so a scratch token is recognisable at a glance and easy to revoke, and it ' +
            'protects nothing on its own.',
        },
        expiresAt: {
          type: ['string', 'null'],
          description:
            'Absolute expiry as an ISO 8601 datetime string (e.g. "2027-01-31T00:00:00Z") — an absolute moment, ' +
            'NOT a TTL in seconds or days. null or omitted = never expires until it is revoked. Anything that is ' +
            'not a valid ISO 8601 datetime is rejected.',
        },
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
        id: {
          type: 'string',
          description:
            'UUID of the token to revoke, from the `id` field of list_pats — NOT the `prefix` and NOT the token ' +
            'secret itself (the secret was only ever shown once, at mint time). Must be one of your own ' +
            'not-yet-revoked tokens; anything else 404s. Revoking the token this session is authenticating with ' +
            'will lock you out immediately.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(`/v1/pat/${encodeURIComponent(args.id as string)}`, args.idempotencyKey as string | undefined),
  },
];
