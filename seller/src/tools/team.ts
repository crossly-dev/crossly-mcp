import { apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const teamTools: ToolDef[] = [
  {
    name: 'list_team',
    description:
      "List pending team invitations + active team members for this account (owner-side view). Each invitation row " +
      "has { id, inviteeEmail, role, scopes, expiresAt, pending }; each member row has { id, memberUserId, " +
      "memberEmail, memberDisplayName, role, scopes }. Use this before invite_team_member or revoke_team to see " +
      "what's already in place.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/team'),
  },
  {
    name: 'invite_team_member',
    description:
      "Mint a team invitation. Response carries a ONE-TIME `acceptUrl` — surface it to the inviter so they can " +
      "share with the invitee out-of-band (email / Slack / etc.). `role` is 'va' (default) or 'admin'. `scopes` " +
      "must be a non-empty subset of the canonical PAT scope catalog (see list_pat_scopes). Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        inviteeEmail: {
          type: 'string',
          format: 'email',
          maxLength: 255,
          description:
            "Email address of the person being invited. Lower-cased before storage, and the route 400s with " +
            "`cannot_invite_self` if it matches the inviting account's own email. It does NOT have to be an " +
            "existing Crossly user, and nothing is emailed from here — the invite travels via the returned " +
            "acceptUrl, which expires 7 days after minting.",
        },
        role: {
          type: 'string',
          enum: ['va', 'admin'],
          default: 'va',
          description:
            "How much the scope list actually constrains this member. 'va' (default, a virtual assistant) is the " +
            "least-privilege role: every WRITE they make is checked by the team scope gate, which maps the URL " +
            "segment to a scope (listings:write, orders:write, …) and 403s when `scopes` lacks it. 'admin' BYPASSES " +
            "that gate entirely — the scope list becomes advisory and they can do anything on the owner's account. " +
            "Reads are currently ungated for both roles. Neither role can change billing plans or another member's " +
            "scopes; those stay with the owner.",
        },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description:
            "What this member may write, as ids from the canonical scope catalog (list_pat_scopes / GET " +
            "/api/pat/scopes) — e.g. 'listings:write', 'orders:write', 'inventory:read', 'analytics:read'. At least " +
            "one, and an id outside the catalog fails the whole call with `unknown scope`. '*' means full access and " +
            "skips every per-segment check, so it is the one entry to be deliberate about. Ignored in practice when " +
            "role='admin', which is already unrestricted.",
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['inviteeEmail', 'scopes'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/team/invite', body, idempotencyKey);
    },
  },
  {
    name: 'accept_team_invite',
    description:
      "Accept a pending team invitation by raw token (the URL fragment from invite_team_member's acceptUrl). " +
      "On success returns { ok, ownerUserId, role, scopes }. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          minLength: 16,
          description:
            "The raw invite token — the `?token=` query value from the acceptUrl invite_team_member returned, NOT " +
            "the whole URL and NOT the invitation id. 64 hex chars in practice (min 16 enforced); only its SHA-256 " +
            "hash is stored, so it exists in exactly one place and cannot be looked up again. Accepting binds the " +
            "invite to the CALLING PAT's user, whoever that is — run this as the invitee, not the owner. Fails with " +
            "`invalid_invite` if it is wrong, already accepted, or past its 7-day expiry.",
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['token'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, token } = args as Record<string, unknown> & { idempotencyKey?: string; token: string };
      return apiPost('/v1/team/accept', { token }, idempotencyKey);
    },
  },
  {
    name: 'revoke_team',
    description:
      "Revoke a pending invitation OR an active team member (owner only). Pass EXACTLY ONE of invitationId / " +
      "memberId — the route 400s if both or neither are present. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        invitationId: { type: 'string', format: 'uuid', description: 'Revoke a pending invite by its id.' },
        memberId: { type: 'string', format: 'uuid', description: 'Revoke an active team member by their team_members row id.' },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/team/revoke', body, idempotencyKey);
    },
  },
  {
    name: 'leave_team',
    description:
      "Member-side counterpart to revoke_team: walk off every team this PAT's owner is currently a member of. " +
      "Sets revokedAt on every active team_members row where memberUserId == me. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/team/leave', {}, args.idempotencyKey as string | undefined),
  },
  {
    name: 'update_team_member_scopes',
    description:
      "Update a team member's scopes (owner only). The supplied `scopes` array REPLACES the current set — pass the " +
      "full desired list, not a diff. Each scope id must be in the canonical PAT scope catalog. Pass an " +
      "idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'string',
          format: 'uuid',
          description:
            "The team_members row id — the `id` field of a row in list_team's `members` array, not the member's " +
            "userId and not their invitation id. Must be an ACTIVE (un-revoked) member of the calling owner's team; " +
            "anything else 404s.",
        },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description:
            "The member's complete new write permissions, as ids from the canonical scope catalog (list_pat_scopes) " +
            "— e.g. 'listings:write', 'orders:write', 'analytics:read'. REPLACES the stored list wholesale, so " +
            "include everything they should keep; omitting one removes it. At least one entry, and any id outside " +
            "the catalog rejects the whole call with `unknown scope`. '*' grants full access. Note this has no " +
            "effect on a member whose role is 'admin' — that role is not gated by scopes.",
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['memberId', 'scopes'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { memberId, idempotencyKey, ...body } = args as Record<string, unknown> & {
        memberId: string;
        idempotencyKey?: string;
      };
      return apiPatch(`/v1/team/${encodeURIComponent(memberId)}`, body, idempotencyKey);
    },
  },
];
