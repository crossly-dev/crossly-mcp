/**
 * AI listing images (BYOK) — generate a product photo with the seller's OWN
 * image-provider key, preview the prompt, choose the image provider.
 * Backed by POST /v1/listings/ai-image(+/prompt) and PUT /v1/ai/image-config.
 * Plus Crossly's AI-image DETECTION on listing photos: GET
 * /v1/listings/:id/ai-detections and POST /v1/ai-detections/:id/dispute.
 */
import { apiGet, apiPost, apiPut } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

const FIELDS = {
  listingId: {
    type: 'string',
    format: 'uuid',
    description: 'A listing the seller owns. Blank fields below are filled from it, and the generated image is recorded on it as AI-generated.',
  },
  title: { type: 'string', description: 'Listing title, max 500 characters.' },
  brand: { type: 'string', description: 'Brand, e.g. "Nike". Max 200 characters.' },
  model: { type: 'string', description: 'Model / style name, e.g. "Air Jordan 1 Retro High OG". Max 200 characters.' },
  color: {
    description: 'Colourway — one string or an array of colour names (max 10), e.g. ["Varsity Red", "White"].',
    anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  },
  material: { type: 'string', description: 'Main material, e.g. "leather". Max 200 characters.' },
  size: { type: 'string', description: 'Size label, used only to keep proportions true. Max 60 characters.' },
  condition: {
    type: 'string',
    description: 'Condition label ("New with tags", "Used - Good", "Fair"…). The image stays true to it: a used item is never rendered as new and visible wear is kept.',
  },
  category: { type: 'string', description: 'Category path, e.g. "Shoes › Sneakers". Steers the lifestyle setting. Max 300 characters.' },
  description: { type: 'string', description: 'Listing description — physical details only; it is never rendered as text in the image. Max 8000 characters.' },
  style: {
    type: 'string',
    enum: ['studio', 'lifestyle', 'flatlay', 'detail'],
    description: 'studio (default: seamless light backdrop, softbox, 3/4 hero, square) | lifestyle (real-world setting; the only style that may include people) | flatlay (top-down on a neutral surface) | detail (macro of materials/labels).',
  },
  extra: { type: 'string', description: "Short seller direction appended to the prompt (max 300 characters), e.g. \"show the outsole\". It cannot override the no-invented-logos / one-item rules." },
  referenceImageUrl: {
    type: 'string',
    description: "One of the listing's own photos on the Crossly CDN. The model keeps that exact item (colour, shape, markings, wear) and only changes background, lighting and framing. URLs on any other host are refused.",
  },
};

export const listingsAiImage: ToolDef[] = [
  {
    name: 'generate_listing_image',
    description:
      "Generate a product photo for a listing using the seller's OWN AI key (BYOK — OpenAI, Google Gemini, " +
      'xAI Grok or Together FLUX, whichever is set as the image provider in Settings → AI; the seller pays their ' +
      'provider per image). The image is stored on the Crossly CDN and MARKED AI-GENERATED: with `listingId` it ' +
      "is recorded in that listing's aiMediaUrls, so the shop shows an AI tag while it is on the listing; without " +
      'one, send the returned url in `aiMediaUrls` when creating/updating the listing. It is NOT added to the ' +
      "listing's photos — add `url` to `images` yourself. Returns `{ url, prompt, provider, model, listingId, " +
      'aiGenerated }`. 400 with details.settingsPath when no image-capable key is saved. Ask before generating ' +
      'many — each call spends the seller\'s credits.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FIELDS,
        prompt: {
          type: 'string',
          description: 'Optional prompt to use verbatim instead of the built one (e.g. from preview_listing_image_prompt, edited). Max 4000 characters.',
        },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/listings/ai-image', body, idempotencyKey);
    },
  },
  {
    name: 'preview_listing_image_prompt',
    description:
      'Return the product-photography prompt generate_listing_image would send for these fields — `{ prompt }`. ' +
      'No image is generated and no AI credits are spent.',
    inputSchema: {
      type: 'object',
      properties: { ...FIELDS },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/listings/ai-image/prompt', args),
  },
  {
    name: 'set_ai_image_provider',
    description:
      "Choose which of the seller's saved AI keys makes listing images, independently of the text provider. " +
      'Returns `{ success, image: { provider, model, resolvedProvider, resolvedModel, supportedProviders, error } }`.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: ['string', 'null'],
          enum: ['openai', 'google', 'xai', 'together', null],
          description: 'Image provider. null = automatic (the main AI provider if it can make images, else the first image-capable provider with a saved key).',
        },
        model: {
          type: ['string', 'null'],
          description: "Image model id override (e.g. \"gpt-image-2.5-sunburst\"). null/omitted = the provider's default.",
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['provider'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPut('/v1/ai/image-config', body, idempotencyKey);
    },
  },
  {
    name: 'list_listing_ai_detections',
    description:
      "Crossly's AI-image detections for a listing's photos — `{ data: [{ id, url, verdict, flagged, status, source, " +
      "score, generator, evidence, disputedAt, resolvedAt, resolution }] }`. Crossly flags a photo when the file's own " +
      'metadata says it was generated (Content Credentials / IPTC DigitalSourceType / generator tags) or a hosted ' +
      'detector scores it over the threshold; a flagged photo on the listing makes the shop show "AI images · detected ' +
      'by Crossly". Photos with no detection row are simply not in the list.',
    inputSchema: {
      type: 'object',
      properties: { listingId: { type: 'string', format: 'uuid', description: 'A listing the seller owns.' } },
      required: ['listingId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { listingId } = args as { listingId: string };
      return apiGet(`/v1/listings/${encodeURIComponent(listingId)}/ai-detections`);
    },
  },
  {
    name: 'dispute_ai_detection',
    description:
      'The seller says a flagged photo is NOT AI-generated: sends it to Crossly review (`status` becomes "disputed"). ' +
      'The flag and the shop tag stay until Crossly decides. Refused (409) once already reviewed. Only dispute when ' +
      'the seller confirms the photo is a real photograph.',
    inputSchema: {
      type: 'object',
      properties: {
        detectionId: { type: 'string', format: 'uuid', description: 'The `id` from list_listing_ai_detections.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['detectionId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { detectionId, idempotencyKey } = args as { detectionId: string; idempotencyKey?: string };
      return apiPost(`/v1/ai-detections/${encodeURIComponent(detectionId)}/dispute`, {}, idempotencyKey);
    },
  },
];
