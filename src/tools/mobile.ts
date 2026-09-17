import { apiDelete, apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const mobileTools: ToolDef[] = [
  {
    name: 'list_mobile_push_tokens',
    description:
      "List Expo push tokens registered for this user's mobile devices (token strings are masked). Use to show " +
      "'what devices receive pushes' without exposing the raw token.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/mobile/push-tokens'),
  },
  {
    name: 'register_mobile_push_token',
    description:
      "Register an Expo push token for this user's device. UPSERT semantics — re-registering the same token is a " +
      "no-op beyond bumping lastUsedAt. Platform must be 'ios' | 'android' | 'web'. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', minLength: 8, maxLength: 200, description: 'Expo push token string.' },
        platform: { type: 'string', enum: ['ios', 'android', 'web'] },
        ...IDEMPOTENCY_PROP,
      },
      required: ['token', 'platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/mobile/push-token', body, idempotencyKey);
    },
  },
  {
    name: 'mobile_push_test',
    description:
      "Fire a no-op test push ('Crossly test — Push notifications are working') to every registered device for this " +
      "user. Useful for verifying notification delivery after register_mobile_push_token. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/mobile/push-test', {}, args.idempotencyKey as string | undefined),
  },
  {
    name: 'clear_mobile_push_tokens',
    description:
      "Clear ALL registered push tokens for this user. Use when the user signs out of every device or wants to stop " +
      "all push delivery. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete('/v1/mobile/push-tokens', args.idempotencyKey as string | undefined),
  },
];
