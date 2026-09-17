import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const accountTools: ToolDef[] = [
  // ── Identity ──────────────────────────────────────────────────────
  {
    name: 'get_me',
    description:
      "Identity check — returns { userId, email, displayName, subscriptionTier, subscriptionStatus, patPrefix, " +
      "scopes }. Use this to confirm the PAT works and see which scopes it carries before calling scoped tools.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/me'),
  },
  {
    name: 'update_profile',
    description:
      "Update the authenticated user's profile (currently just displayName). Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        displayName: { type: 'string', maxLength: 120 },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPatch('/v1/me', body, idempotencyKey);
    },
  },

  // ── Deletion lifecycle ───────────────────────────────────────────────────
  {
    name: 'get_account_deletion_status',
    description:
      "Get the currently-pending account deletion request, if any. Returns { pending: { id, requestedAt, " +
      "scheduledFor } | null }. Use this before request_account_deletion to surface an existing pending request.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/account/deletion-status'),
  },
  {
    name: 'request_account_deletion',
    description:
      "Schedule account deletion after a grace period (default 30 days, configured by the deployment). Returns " +
      "{ id, scheduledFor, graceDays }. 409s if a deletion is already pending — cancel it first or just surface the " +
      "existing schedule. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', maxLength: 1000, description: 'Optional reason captured in audit log.' },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/account/request-deletion', body, idempotencyKey);
    },
  },
  {
    name: 'cancel_account_deletion',
    description:
      "Cancel the currently-pending account deletion. 404s if there is none. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/account/cancel-deletion', {}, args.idempotencyKey as string | undefined),
  },
  {
    name: 'logout_all_sessions',
    description:
      "Revoke every active browser auth session for this user. The PAT itself is NOT revoked — only cookie-backed " +
      "browser sessions. Returns { ok, revokedCount }. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/account/logout-all', {}, args.idempotencyKey as string | undefined),
  },

  // ── Auth sessions ────────────────────────────────────────────────────────
  {
    name: 'list_auth_sessions',
    description:
      "List active browser auth sessions for this user. Each row carries { id, userAgent, ipAddress, ipCountry, " +
      "createdAt, lastUsedAt, expiresAt, isCurrent }. `isCurrent` is always false on PAT calls because we don't carry " +
      "the current_sid cookie.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/auth/sessions'),
  },
  {
    name: 'revoke_all_auth_sessions',
    description:
      "Mass-revoke every active browser auth session for this user (mirrors logout_all_sessions but expressed as a " +
      "DELETE on the collection). Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete('/v1/auth/sessions', args.idempotencyKey as string | undefined),
  },
  {
    name: 'revoke_auth_session',
    description:
      "Revoke a single browser auth session by id. Use list_auth_sessions to find the id. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/auth/sessions/${encodeURIComponent(args.sessionId as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'start_plan_upgrade',
    description:
      'Start an upgrade to a HIGHER Crossly plan. Returns a Stripe Checkout link — this ' +
      'charges nothing and the person must complete the payment themselves. Downgrades ' +
      'and cancellation are not available here; they stay with the account owner. ' +
      'Requires billing:write. Give the user the link rather than implying it is done.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['starter', 'pro', 'unlimited'] },
        interval: { type: 'string', enum: ['monthly', 'yearly'] },
      },
      required: ['tier'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/billing/upgrade', {
        tier: args.tier as string,
        ...(args.interval ? { interval: args.interval as string } : {}),
      }),
  },
];
