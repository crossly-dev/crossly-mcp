import { apiDelete, apiGet, apiPatch, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/**
 * Outbound notification destinations — the rows that notify.slack /
 * notify.discord / notify.webhook automation actions point at via
 * `actionConfig.integrationId`.
 */
export const notificationIntegrations: ToolDef[] = [
  {
    name: 'list_notification_integrations',
    description:
      'List the seller\'s outbound notification destinations. notify.* automation actions reference one of these by ' +
      'integrationId. Provider is slack / discord / webhook. The webhookUrl is masked in the response.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/notification-integrations'),
  },
  {
    name: 'create_notification_integration',
    description:
      'Add a notification destination. Slack/Discord: config = { webhookUrl }. Generic webhook: ' +
      'config = { url, headers?: object, hmacSecret?: string }. The seller mints incoming-webhook URLs in Slack/Discord ' +
      'admin or points the generic webhook at any URL.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['slack', 'discord', 'webhook'],
          description:
            'Which wire the message goes out on, and therefore what config must contain. "slack" = POST ' +
            '{ text } to a Slack incoming webhook (config.webhookUrl); "discord" = POST { content } to a ' +
            'Discord channel webhook (config.webhookUrl); "webhook" = POST your own rendered JSON to any ' +
            'URL (config.url), optionally HMAC-SHA256 signed. Immutable after create — to change wires, ' +
            'create a second destination and repoint the rules.',
        },
        name: {
          type: 'string',
          maxLength: 80,
          description: 'Label the seller sees when picking a destination, e.g. "#sales channel". 1–80 characters.',
        },
        config: { type: 'object', description: 'Provider-shaped config.' },
        enabled: {
          type: 'boolean',
          default: true,
          description:
            'Whether notify.* actions may deliver here. Defaults to true; false parks the destination ' +
            'without deleting it.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['provider', 'name', 'config'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/notification-integrations', body, idempotencyKey);
    },
  },
  {
    name: 'update_notification_integration',
    description: 'Patch a notification destination (name / enabled / config). Only the fields you send change.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Destination UUID from list_notification_integrations.' },
        name: { type: 'string', description: 'New display label, 1–80 characters. Omit to leave unchanged.' },
        enabled: {
          type: 'boolean',
          description:
            'Turn delivery on or off. false leaves the row and its rules intact but stops messages going ' +
            'out. Omit to leave unchanged.',
        },
        config: {
          type: 'object',
          description:
            'Replacement provider config — it OVERWRITES the stored object rather than merging, so resend ' +
            'every key. { webhookUrl } for slack/discord; { url, headers?, hmacSecret? } for webhook, where ' +
            'hmacSecret signs the body into X-Crossly-Signature (sha256 hex) with X-Crossly-Timestamp. ' +
            'Reads mask hmacSecret, so never round-trip the masked value back. Omit to leave unchanged.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPatch(`/v1/notification-integrations/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'test_notification_integration',
    description:
      'Fire a canned test message to a notification destination (Slack/Discord/Webhook). Useful for "did I configure the ' +
      'webhook URL correctly?" verification before wiring it into automation rules. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Destination UUID to test. Sends a timestamped "Crossly test notification" to config.webhookUrl ' +
            '(or config.url) and returns the destination\'s HTTP status; 400 if the row has no URL at all.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/notification-integrations/${encodeURIComponent(args.id as string)}/test`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'delete_notification_integration',
    description: 'Delete a notification destination. Any automation actions pointing at it start failing on next fire.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Destination UUID to delete. Rules whose actionConfig.integrationId still names it will error ' +
            'on their next fire — repoint them first.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/notification-integrations/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
];
