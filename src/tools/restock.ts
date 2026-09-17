import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const restockTools: ToolDef[] = [
  {
    name: 'list_restock_prompts',
    description:
      'List pending restock prompts — banners surfaced after a sale-cascade leaves a multi-quantity item out-of-stock on ' +
      'one platform while inventory remains. Each row carries listingId, inventoryItemId, eligible platforms[], ' +
      'newQuantity, and the parent listing\'s title/images/price.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/restock-prompts'),
  },
  {
    name: 'dismiss_restock_prompt',
    description:
      'Dismiss a pending restock prompt without republishing. Marks status=dismissed. Pass an idempotencyKey on retries.',
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
      apiPost(
        `/v1/restock-prompts/${encodeURIComponent(args.id as string)}/dismiss`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'republish_restock_prompt',
    description:
      'Republish a restock prompt to one or more platforms. `platforms` must be a subset of the prompt\'s eligible list — ' +
      "anything else is silently dropped. eBay republishes go through the same quota / selling-cap guards as a normal " +
      "crosspost; pass confirmOverFreeQuota=true to opt into eBay overage fees. Once all eligible platforms are republished " +
      'the prompt is marked actioned; otherwise the remaining list shrinks. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        platforms: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
        confirmOverFreeQuota: { type: 'boolean' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'platforms'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/restock-prompts/${encodeURIComponent(id)}/republish`, body, idempotencyKey);
    },
  },
];
