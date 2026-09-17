import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Live Shop — sessions, identification, and lock-on.
 *
 * Split from `buyer.ts` rather than appended to it because these tools share a
 * concern the catalogue ones do not: they are read by an agent that will be
 * driving a camera in a loop, and the cost of getting the loop wrong is real
 * money and a very unhappy buyer.
 *
 * So the descriptions carry the operational rules, not the parameter list:
 *
 *   - do NOT post every frame; tracking and decoding are on-device and free
 *   - a vision label is WORDS, never an identity
 *   - `shippingUnknown` means a total is not delivered, and saying otherwise
 *     is a false statement somebody acts on
 *   - only a human confirmation promotes a text match to something priceable
 *
 * None of that is discoverable by trying. An agent finds it out by doing the
 * wrong thing at scale.
 */
export const buyerLiveTools: ToolDef[] = [
  {
    name: 'find_cheapest_anywhere',
    description:
      'Given an item identifier, find the cheapest place to buy it — Crossly first, then other '
      + 'retailers. Answers with a VERDICT (crossly_best | offsite_cheaper | offsite_only | '
      + 'no_match), not a list. Offsite offers are ranked CHEAPEST-FIRST; commission only ever '
      + 'breaks a sub-$1 tie, and Crossly gets a $1 preference and no more. '
      + 'CHECK shippingUnknown before calling any total "delivered" — when true the figure '
      + 'excludes postage, and presenting it as a delivered price is a false statement the buyer '
      + 'acts on. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        ns: { type: 'string', description: 'Identifier namespace, e.g. gtin or style_code.' },
        value: { type: 'string' },
        pagePriceCents: {
          type: 'number',
          description: 'What the buyer is looking at, so "cheaper" means cheaper than that.',
        },
        currency: { type: 'string' },
      },
      required: ['ns', 'value'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/buyer/anywhere', args as Record<string, unknown>),
  },

  {
    name: 'identify_item',
    description:
      'Identify a physical item from a barcode or a photo, returning a HUD-ready answer. '
      + 'A BARCODE establishes identity: exact, about 50ms, free. A PHOTO establishes only '
      + 'resemblance — self-hosted CLIP first, then a vision model, which is capped per buyer '
      + 'per day. '
      + 'A vision label is WORDS, never an identity. It names the thing so somebody can search; '
      + 'it must never be used to claim a price for a specific product. Read `tier` before '
      + 'quoting any figure. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'object',
          properties: { ns: { type: 'string' }, value: { type: 'string' } },
          required: ['ns', 'value'],
          additionalProperties: false,
        },
        imageBase64: { type: 'string', description: 'A JPEG frame, base64-encoded.' },
        pagePriceCents: { type: 'number' },
        currency: { type: 'string' },
        sessionId: { type: 'string', description: 'Live Shop trip to record this against.' },
        allowVision: { type: 'boolean', description: 'False skips the one rung that costs money.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/identify', args as Record<string, unknown>),
  },

  {
    name: 'scan_item',
    description:
      'One-shot scan of a barcode or photo. Prefer identify_item, which runs the full cost '
      + 'ladder and returns the same HUD payload. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'object',
          properties: { ns: { type: 'string' }, value: { type: 'string' } },
          required: ['ns', 'value'],
          additionalProperties: false,
        },
        imageBase64: { type: 'string' },
        pagePriceCents: { type: 'number' },
        currency: { type: 'string' },
        sessionId: { type: 'string' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/scan', args as Record<string, unknown>),
  },

  {
    name: 'start_scan_session',
    description:
      'Open a Live Shop trip, then pass the returned id as sessionId on each scan so a whole '
      + 'shopping trip groups together. Opening a session CLOSES any other live one, because a '
      + 'person is in one shop at a time and two live sessions split a trip across both. '
      + 'Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', enum: ['glasses', 'phone'], default: 'phone' },
        label: { type: 'string', description: 'Optional name, e.g. "Saturday, outlet mall".' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/scan/sessions', args as Record<string, unknown>),
  },

  {
    name: 'end_scan_session',
    description: 'Close a Live Shop trip. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/buyer/scan/sessions/${encodeURIComponent(id)}/end`, {});
    },
  },

  {
    name: 'list_scan_sessions',
    description:
      'Scanning trips for this buyer, newest first. Requires buyer:catalog:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/scan/sessions', {}),
  },

  {
    name: 'get_scan_session',
    description:
      'One trip and everything it found, including the total saved. Verdicts come back EXACTLY '
      + 'as they were given at the time and are never re-priced — a history that silently '
      + 'refreshes old prices shows a saving that was never actually on offer. '
      + 'Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...rest } = args as { id: string };
      return apiGet(`/v1/buyer/scan/sessions/${encodeURIComponent(id)}`, rest);
    },
  },

  {
    name: 'start_lockon',
    description:
      'Lock on to an object the buyer is holding, then post observations as they turn it over. '
      + 'The answer improves as evidence arrives: a style code inside a shoe settles what the '
      + 'front of it could not. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/lockons', args as Record<string, unknown>),
  },

  {
    name: 'observe_lockon',
    description:
      'Add what one frame revealed and get the current best answer. '
      + 'Send only what you LEARNED — a decoded barcode, newly-read OCR text, or an image when '
      + 'neither settled it. DO NOT post every frame: tracking and decoding run on-device for '
      + 'free, and this endpoint takes evidence, not video. '
      + 'Evidence is RANKED (confirmed > barcode > ocr > visual) so a late weak reading can never '
      + 'overwrite a strong early one. When several products match the text, `candidates` comes '
      + 'back — SHOW them and let the buyer choose, because a vision label is words and only a '
      + 'human confirmation turns it into an identity worth pricing against. '
      + 'Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lock-on id.' },
        barcode: {
          type: 'object',
          properties: { ns: { type: 'string' }, value: { type: 'string' } },
          required: ['ns', 'value'],
          additionalProperties: false,
        },
        ocrText: { type: 'string', description: 'Raw text read off the object this frame.' },
        attributes: {
          type: 'object',
          properties: {
            brand: { type: 'string' },
            model: { type: 'string' },
            size: { type: 'string' },
            colour: { type: 'string' },
            tokens: { type: 'array', items: { type: 'string' } },
          },
          additionalProperties: false,
        },
        imageBase64: { type: 'string' },
        pagePriceCents: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...rest } = args as { id: string };
      return apiPost(`/v1/buyer/lockons/${encodeURIComponent(id)}/observe`, rest);
    },
  },

  {
    name: 'confirm_lockon',
    description:
      'The buyer picked one of the candidates. Promotes a text match to a CONFIRMED identity — '
      + 'the strongest evidence in the system, because a person holding the object said yes. '
      + 'Validated against the candidates actually offered, so it cannot be claimed about an '
      + 'arbitrary product. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ns: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['id', 'ns', 'value'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...rest } = args as { id: string };
      return apiPost(`/v1/buyer/lockons/${encodeURIComponent(id)}/confirm`, rest);
    },
  },
];
