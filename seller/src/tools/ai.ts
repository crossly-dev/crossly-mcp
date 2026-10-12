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
        title: { type: 'string', description: 'The current draft title to improve. Required, 1-400 characters.' },
        description: {
          type: 'string',
          description: 'The current draft description to improve. Required, 1-8000 characters.',
        },
        category: { type: 'string', description: 'Optional free-text category hint (e.g. "Tops > T-Shirts"), max 120 characters. Not validated against any platform taxonomy — it only steers the prompt.' },
        brand: { type: 'string', description: 'Optional brand hint (e.g. "Levi\'s"), max 80 characters.' },
        condition: { type: 'string', description: 'Optional free-text condition (e.g. "Like New", "Used"), max 40 characters.' },
        imageBase64: {
          type: 'string',
          description:
            'Optional product photo for visual context: raw base64 bytes, or a full data: URL. Raw bytes are ' +
            'assumed to be image/jpeg. Supplying it switches the request to the vision model, so the active ' +
            "provider must be vision-capable (groq's default is text-only and returns 422 no_capability).",
        },
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
        imageBase64: {
          type: 'string',
          description:
            'Base64-encoded image bytes, or a full data: URL. Required, non-empty; raw bytes are assumed to be ' +
            'image/jpeg. Requires a vision-capable active provider — groq\'s default model is text-only and ' +
            'returns 422 no_capability.',
        },
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
      'supplier), extract every line item. Returns `{ merchant, purchaseDate (YYYY-MM-DD or null), ' +
      'subtotalCents, taxCents, totalCents, items: [{ description, priceCents }] }` — all amounts are ' +
      'integer CENTS. Use this to bulk-create inventory items with cost of goods set to the ' +
      "receipt's unit price — much faster than retyping each item.",
    inputSchema: {
      type: 'object',
      properties: {
        imageBase64: {
          type: 'string',
          description:
            'Base64-encoded receipt photo, or a full data: URL (the media type is read from the prefix when ' +
            'present, else image/jpeg is assumed). Required, non-empty. Needs a vision-capable active provider. ' +
            'Every money field in the response — subtotalCents / taxCents / totalCents / items[].priceCents — ' +
            'comes back as an integer number of CENTS, and unreadable fields come back null rather than guessed.',
        },
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
        apiKey: {
          type: 'string',
          description:
            "The provider's own secret API key (e.g. an OpenAI sk-… key, an Anthropic x-api-key). Required, " +
            'non-empty. STORED: encrypted at rest with the server key and written to the user record under ' +
            '`<provider>ApiKeyEncrypted`; it is never echoed back — get_ai_status only reports a boolean per ' +
            'provider. Saving also sets that provider active and flips aiEnabled on. Use test_ai_key first if ' +
            'you want to validate without persisting.',
        },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'xai', 'openrouter', 'groq', 'custom'],
          default: 'openai',
          description:
            'Which provider this key belongs to; also becomes the active provider. Defaults to `openai` if ' +
            'omitted, so pass it explicitly. `openai` = api.openai.com (default model gpt-4o-mini, text+vision). ' +
            '`anthropic` = Claude through Anthropic\'s OpenAI-compatible layer (claude-haiku-4-5-20251001, ' +
            'text+vision). `google` = Gemini (gemini-2.0-flash, text+vision). `xai` = Grok (grok-3 for text, ' +
            'grok-2-vision-1212 for vision). `openrouter` = OpenRouter\'s router (openai/gpt-4o-mini, ' +
            'text+vision). `groq` = Groq (openai/gpt-oss-120b, TEXT ONLY — vision calls fail with ' +
            'no_capability). `custom` = any OpenAI-chat-completions-compatible endpoint you host or proxy ' +
            '(Ollama, vLLM, LM Studio, LiteLLM), and REQUIRES customConfig.',
        },
        customConfig: {
          type: 'object',
          description:
            'Only for provider="custom" — ignored for the built-in providers, and required for `custom` ' +
            '(otherwise the call is rejected 400 invalid_request). Describes your OpenAI-compatible endpoint.',
          properties: {
            baseUrl: {
              type: 'string',
              description:
                'Absolute URL of the OpenAI-compatible chat-completions root, with no trailing slash (e.g. ' +
                '"http://localhost:11434/v1"). Must parse as a URL; the key check GETs `<baseUrl>/models`.',
            },
            textModel: {
              type: 'string',
              description:
                'Model id to send for text-only calls (1-200 characters), exactly as your endpoint names it ' +
                '(e.g. "llama3.1:8b"). Used as the vision model too when visionModel is null.',
            },
            visionModel: {
              type: ['string', 'null'],
              description:
                'Model id for image calls (max 200 characters), or null/omitted to reuse textModel for vision.',
            },
            supportsVision: {
              type: 'boolean',
              description:
                'Whether this endpoint accepts image inputs. Defaults to false; while false every vision tool ' +
                '(generate_listing, magic_listing, categorize, extract-receipt) is refused with no_capability.',
            },
            supportsJsonMode: {
              type: 'boolean',
              description:
                'Whether this endpoint honors OpenAI-style structured JSON output (response_format). Defaults ' +
                'to false; reported back in the capability flags from get_ai_status.',
            },
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
          description:
            'Whose stored key to erase — `openai`, `anthropic` (Claude), `google` (Gemini), `xai` (Grok), ' +
            '`openrouter`, `groq`, or `custom` (your own OpenAI-compatible endpoint; also clears its saved ' +
            'baseUrl / model ids / capability flags). Deleting is per-provider, not a global wipe. The server ' +
            'DEFAULTS to `openai` when this is omitted, so pass it explicitly or you may delete the wrong key. ' +
            'Deleting the active provider promotes the first remaining provider that still has a key, or ' +
            'switches AI off entirely if none is left.',
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
        apiKey: {
          type: 'string',
          description:
            'Candidate provider secret to validate. Required, non-empty. NOT stored — it is used for one live ' +
            "GET to the provider's models endpoint and then discarded. Anything shorter than 8 characters is " +
            'reported `{ valid: false }` without a network call, and any non-2xx (bad key, network error) also ' +
            'returns `{ valid: false }` rather than an error.',
        },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'xai', 'openrouter', 'groq', 'custom'],
          default: 'openai',
          description:
            'Which provider to ping, selecting the endpoint and auth header: `openai`, `anthropic` (Claude — ' +
            'sent as x-api-key + anthropic-version), `google` (Gemini), `xai` (Grok), `openrouter`, `groq`, or ' +
            '`custom` (pings `<customConfig.baseUrl>/models`). Everything but anthropic uses a Bearer header. ' +
            'Defaults to `openai` when omitted — pass it explicitly so you validate against the right host.',
        },
        customConfig: {
          type: 'object',
          description:
            'Only read when provider="custom": the same object set_ai_key takes ({ baseUrl, textModel, ' +
            'visionModel?, supportsVision?, supportsJsonMode? }). `baseUrl` is the only part this tool uses — ' +
            'it GETs `<baseUrl>/models`. Omitting it for a custom provider returns `{ valid: false }`.',
        },
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
        title: {
          type: 'string',
          description: 'The existing listing title to rewrite. Required, 1-200 characters (longer titles are rejected — use ai_enhance_listing, which allows 400).',
        },
        brand: {
          type: 'string',
          description: 'Optional brand to work into the title (e.g. "Patagonia"). Free text, no length limit; purely a prompt hint.',
        },
        category: {
          type: 'string',
          description: 'Optional category hint (e.g. "Women > Outerwear"). Free text — not matched against any platform taxonomy, it only steers keyword choice.',
        },
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
        title: {
          type: 'string',
          description: 'Listing title the description is written for. Required even though only the description is returned, 1-200 characters.',
        },
        description: {
          type: 'string',
          description: 'Optional existing description to rewrite. Free text, no length limit here. Omit it to have one written from the title plus the hints below.',
        },
        brand: { type: 'string', description: 'Optional brand hint (e.g. "Nike"). Free text; prompt context only.' },
        condition: {
          type: 'string',
          description: 'Optional free-text condition (e.g. "NWT", "Good — light wear"). Not one of the platform condition enums; it is copy input, not a field value.',
        },
        category: { type: 'string', description: 'Optional category hint (e.g. "Shoes > Sneakers"). Free text; not a platform taxonomy id.' },
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
        imageUrls: {
          type: 'array',
          items: {
            type: 'string',
            description:
              'One photo URL. Absolute http(s) URLs are passed to the model as-is and must be publicly ' +
              "fetchable by the provider. A value starting with '/' is treated as a Crossly-relative path and " +
              "resolved against this API's own host.",
          },
          minItems: 1,
          maxItems: 4,
          description: 'Photos of the item, 1-4 URLs (more than 4 is rejected). Order matters — put the main/front shot first.',
        },
        brand: { type: 'string', description: 'Optional brand hint to bias the model when the tag is unreadable. Free text.' },
        category: { type: 'string', description: 'Optional category hint (free text, e.g. "Home > Kitchen"). Not a platform taxonomy id — it only narrows the guess.' },
        condition: { type: 'string', description: 'Optional free-text condition (e.g. "Used — Good"). Prompt context, not a platform condition enum.' },
        notes: { type: 'string', description: 'Optional seller notes for the model — flaws, measurements, included accessories. Max 500 characters.' },
        model: {
          type: 'string',
          description:
            "Optional provider model id, overriding the active provider's default vision model for this one " +
            "call (e.g. \"gpt-4o\", \"claude-haiku-4-5-20251001\"). Must be a model the SAME provider accepts — " +
            'the key and base URL are still the active provider\'s. Omit to use the default.',
        },
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
        imagesBase64: {
          type: 'array',
          items: {
            type: 'string',
            description:
              'One photo as raw base64 bytes, or as a full data: URL. Raw bytes are assumed image/jpeg. No data ' +
              'URL prefix is required.',
          },
          minItems: 1,
          maxItems: 8,
          description:
            'Photos of the item, 1-8 entries (more than 8 is rejected; the server also hard-slices to the ' +
            'first 8). Put the main shot first. Base64 inflates payloads ~33% — prefer generate_listing with ' +
            'URLs when the images are already hosted.',
        },
        brandHint: { type: 'string', description: 'Optional brand hint for the vision model (e.g. "Carhartt"). Max 120 characters. A hint, not an assertion — the model may override it from the photos.' },
        conditionHint: { type: 'string', description: 'Optional free-text condition hint (e.g. "like new, tags attached"). Max 80 characters. Not a platform condition enum.' },
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
        question: {
          type: 'string',
          description: "The seller's question in their own words. Required, 3-2000 characters. Answered ONLY from the docs passed in `context` — the model is told to say so when the docs do not cover it.",
        },
        context: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Human-readable doc title (max 200 characters). Shown to the model as the source name so it can cite it in the answer.',
              },
              slug: {
                type: 'string',
                description: 'Doc slug without a leading slash (max 200 characters) — rendered to the model as /docs/<slug>, and echoed back in the response as `sourceSlugs` so you can link the citations.',
              },
              body: {
                type: 'string',
                description: 'Full doc text, max 20000 characters. This is the ONLY knowledge the answer may draw on, so send the whole relevant section rather than a snippet.',
              },
            },
            required: ['title', 'slug', 'body'],
          },
          minItems: 1,
          maxItems: 5,
          description: 'The retrieved docs to ground the answer in — 1 to 5 of them (6+ is rejected). Rank them yourself; the server does no retrieval or re-ranking.',
        },
        model: {
          type: 'string',
          description:
            "Optional provider model id overriding the active provider's default TEXT model for this call " +
            '(must be a model that same provider accepts). Answers are capped at 800 output tokens regardless.',
        },
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
        imageUrl: {
          type: 'string',
          description:
            'URL of the single photo to classify. Required, non-empty. An absolute http(s) URL is handed to ' +
            "the provider as-is and must be publicly fetchable by it; a value starting with '/' is treated as " +
            "a Crossly-relative path and resolved against this API's host. Needs a vision-capable active " +
            'provider (groq default is text-only → 422 no_capability). Use ai_categorize_from_image if you ' +
            'have bytes rather than a URL.',
        },
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
