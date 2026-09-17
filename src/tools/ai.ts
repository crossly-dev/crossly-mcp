import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const aiTools: ToolDef[] = [
  {
    name: 'ai_enhance_listing',
    description:
      'Rewrite a listing title + description into SEO-optimized marketplace copy. Returns ' +
      '`{ title, description, tags }`. Pass the seller\'s draft text + optionally brand/condition/category. ' +
      'For image-based context, send a base64-encoded image as `imageBase64`. Costs against the seller\'s ' +
      'AI credit budget — do not call in a tight loop without confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The current draft title to improve.' },
        description: { type: 'string', description: 'The current draft description to improve.' },
        category: { type: 'string', description: 'Optional category hint (e.g. "Tops > T-Shirts").' },
        brand: { type: 'string', description: 'Optional brand hint.' },
        condition: { type: 'string', description: 'Optional condition (e.g. "Like New", "Used").' },
        imageBase64: { type: 'string', description: 'Optional base64 image for visual context.' },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/ai/enhance-listing', args),
  },
  {
    name: 'ai_categorize_from_image',
    description:
      'Given a base64-encoded image, return `{ category, brand, suggestedTitle }`. Use this when starting ' +
      "from a photo with no metadata — you'll get back enough to pre-fill a listing form.",
    inputSchema: {
      type: 'object',
      properties: {
        imageBase64: { type: 'string', description: 'Base64-encoded image bytes (no data URL prefix needed).' },
      },
      required: ['imageBase64'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/ai/categorize-from-image', args),
  },
  {
    name: 'ai_extract_receipt',
    description:
      'Given a base64-encoded photo of a sourcing receipt (thrift store, estate sale, wholesale ' +
      'supplier), extract every line item. Returns `{ items: [{ name, price, quantity }], total?, ' +
      'storeName?, date? }`. Use this to bulk-create inventory items with cost of goods set to the ' +
      "receipt's unit price — much faster than retyping each item.",
    inputSchema: {
      type: 'object',
      properties: {
        imageBase64: { type: 'string', description: 'Base64-encoded receipt photo (no data URL prefix needed).' },
      },
      required: ['imageBase64'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/ai/extract-receipt', args),
  },

  // ── BYO-key plumbing ───────────────────────────────────────────────────
  {
    name: 'get_ai_status',
    description:
      "Get the seller's BYO-key state — which providers have keys configured, which is the active provider, capability " +
      'flags (vision / JSON mode), and the customConfig when using a custom provider.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/ai/status'),
  },
  {
    name: 'get_ai_providers',
    description:
      'Static catalog of supported AI providers — labels, default model ids, and capability flags. Use this to populate a ' +
      "provider picker in a UI without hardcoding the list.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/ai/providers'),
  },
  {
    name: 'set_ai_key',
    description:
      'Save an encrypted BYO-key for an AI provider and activate it. provider is one of openai/anthropic/google/xai/' +
      'openrouter/groq/custom. For custom, supply customConfig with baseUrl + textModel (+ optional visionModel / ' +
      'capability flags). Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'xai', 'openrouter', 'groq', 'custom'],
          default: 'openai',
        },
        customConfig: {
          type: 'object',
          properties: {
            baseUrl: { type: 'string' },
            textModel: { type: 'string' },
            visionModel: { type: ['string', 'null'] },
            supportsVision: { type: 'boolean' },
            supportsJsonMode: { type: 'boolean' },
          },
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['apiKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPut('/v1/ai/key', body, idempotencyKey);
    },
  },
  {
    name: 'delete_ai_key',
    description:
      'Remove the BYO-key for a provider. If the deleted provider was active, falls back to any other provider with a key, ' +
      'or disables AI entirely if there are no more keys. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'xai', 'openrouter', 'groq', 'custom'],
          default: 'openai',
        },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const provider = args.provider as string | undefined;
      const path = provider ? `/v1/ai/key?provider=${encodeURIComponent(provider)}` : '/v1/ai/key';
      return apiDelete(path, args.idempotencyKey as string | undefined);
    },
  },
  {
    name: 'test_ai_key',
    description:
      "Live-ping a candidate BYO-key without saving it. Returns { valid: boolean }. Use this before set_ai_key to surface " +
      "bad keys to the user.",
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'xai', 'openrouter', 'groq', 'custom'],
          default: 'openai',
        },
        customConfig: { type: 'object' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['apiKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/test-key', body, idempotencyKey);
    },
  },

  // ── Content generation ────────────────────────────────────────────────
  {
    name: 'enhance_title',
    description:
      "SEO-rewrite a listing title. Returns the suggested title text plus optional reasoning. Costs against the seller's " +
      'AI credits. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        brand: { type: 'string' },
        category: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['title'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/enhance-title', body, idempotencyKey);
    },
  },
  {
    name: 'enhance_description',
    description:
      "SEO-rewrite a listing description. Required: title. Optional context fields tighten the prompt. Costs against AI " +
      'credits. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        brand: { type: 'string' },
        condition: { type: 'string' },
        category: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['title'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/enhance-description', body, idempotencyKey);
    },
  },
  {
    name: 'generate_listing',
    description:
      'Generate a full listing payload from up to 4 image URLs. Returns suggested title / description / tags / brand / ' +
      'category. Optional notes/category/condition/brand hints sharpen the prompt. Costs against AI credits + bills the ' +
      "user's BYO-key. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
        brand: { type: 'string' },
        category: { type: 'string' },
        condition: { type: 'string' },
        notes: { type: 'string' },
        model: { type: 'string', description: 'Optional override for the AI model.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['imageUrls'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/generate-listing', body, idempotencyKey);
    },
  },
  {
    name: 'magic_listing',
    description:
      'Generate a full listing payload from up to 8 base64-encoded photos. Same response shape as generate_listing. Useful ' +
      'when the agent already has the bytes (e.g. just snapped via a mobile client). Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        imagesBase64: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
        brandHint: { type: 'string' },
        conditionHint: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['imagesBase64'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/magic-listing', body, idempotencyKey);
    },
  },
  {
    name: 'ai_help',
    description:
      'In-app help Q&A grounded in supplied docs (up to 5 docs per call). Each doc carries { title, slug, body }. The ' +
      "model answers ONLY from the supplied context — surface 'docs do not cover this' answers honestly. Pass an " +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        context: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['title', 'slug', 'body'],
          },
          minItems: 1,
          maxItems: 5,
        },
        model: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['question', 'context'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/help', body, idempotencyKey);
    },
  },
  {
    name: 'categorize_with_ai',
    description:
      'Guess a category from a single image URL (the URL form complements ai_categorize_from_image which takes base64). ' +
      'Returns suggested category + reasoning. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['imageUrl'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/ai/categorize', body, idempotencyKey);
    },
  },
];
