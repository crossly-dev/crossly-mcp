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
        id: {
          type: 'string',
          description:
            'The restock PROMPT uuid — the `id` field of a row from list_restock_prompts, not the '
            + 'listingId or inventoryItemId it carries alongside. The prompt must still be pending; one '
            + 'already dismissed or republished returns 404 not_found, so this is safe to retry blind.',
        },
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
        id: {
          type: 'string',
          description:
            'The restock PROMPT uuid — the `id` field of a row from list_restock_prompts, not the '
            + 'listingId or inventoryItemId it carries alongside. The prompt must still be pending; one '
            + 'already dismissed or fully republished returns 404 not_found.',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 20,
          description:
            'Platform ids to republish onto, 1 to 20 of them, e.g. ["poshmark","mercari"]. Must be '
            + 'drawn from this prompt\'s own `platforms` array (the marketplaces the sale cascade '
            + 'delisted, and the only ones eligible) — anything else is filtered out silently, and if '
            + 'nothing eligible remains the call is a 400 no_eligible_platforms whose details name what '
            + 'was allowed. Each accepted platform gets its own list job under one trackable bulkJobId.',
        },
        confirmOverFreeQuota: {
          type: 'boolean',
          description:
            'eBay only, and only consulted when "ebay" is in `platforms`. Left unset, a republish that '
            + 'would cross eBay\'s monthly free-listing allowance stops at 402 free_quota_exceeded; set '
            + 'true to accept eBay\'s per-listing insertion fee of roughly $0.35 US DOLLARS on each '
            + 'listing past that allowance. It does NOT bypass eBay\'s separate monthly selling cap, '
            + 'which still rejects with 409 selling_cap_reached.',
        },
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
