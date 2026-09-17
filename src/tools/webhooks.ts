import { apiDelete, apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const webhooksTools: ToolDef[] = [
  {
    name: 'list_webhooks',
    description:
      'List the seller\'s registered webhook endpoints — URLs Crossly POSTs to when events happen ' +
      '(new sale, listing failure, message received, etc.). Each row has url, events[], enabled, ' +
      'lastDeliveryAt, and lastError if the most recent delivery failed.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/webhooks'),
  },
  {
    name: 'register_webhook',
    description:
      'Register a new webhook endpoint. The response includes a `secret` — RETURN THIS ONCE to the user ' +
      'and tell them to store it; Crossly signs every outgoing webhook delivery with an HMAC using this secret. ' +
      'The user\'s receiver MUST verify the signature header. Pick events carefully — sending all events to ' +
      'a noisy endpoint can rate-limit other deliveries. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'HTTPS URL Crossly will POST to. Must respond 2xx within 10s; otherwise we retry with backoff.',
        },
        events: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event types to subscribe to, e.g. ["sale.detected","listing.failed","message.received"]. Empty = nothing (paused).',
          default: [],
        },
        description: {
          type: 'string',
          maxLength: 500,
          description: 'Optional human-readable description.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['url'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/webhooks', body, idempotencyKey);
    },
  },
  {
    name: 'delete_webhook',
    description:
      'Delete a webhook endpoint. Any in-flight delivery attempts are abandoned. The HMAC signing secret ' +
      'is permanently lost — re-registering generates a fresh one. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook UUID from list_webhooks.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/webhooks/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'test_webhook',
    description:
      'Fire a synthetic test.ping delivery to one of the seller\'s registered webhooks. Returns the deliveryId for the ' +
      'attempted delivery — the seller can match it against their receiver logs to verify HMAC parsing. Pass an ' +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook UUID from list_webhooks.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/webhooks/${encodeURIComponent(args.id as string)}/test`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
];
