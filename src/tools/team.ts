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
        inviteeEmail: { type: 'string', format: 'email', maxLength: 255 },
        role: { type: 'string', enum: ['va', 'admin'], default: 'va' },
        scopes: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'PAT scope ids.' },
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
        token: { type: 'string', minLength: 16 },
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
        memberId: { type: 'string', format: 'uuid' },
        scopes: { type: 'array', items: { type: 'string' }, minItems: 1 },
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
