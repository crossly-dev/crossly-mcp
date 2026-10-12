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
      + 'Answers carry BOTH kinds of money and they STACK: `offsite.buyerCashbackCents` is what the buyer gets back through us, and `coupon` is a code to try at the retailer. Cashback is certain; a coupon is a code a checkout may reject, so present it as the weaker of the two. `hud.coupon.measured: false` means the code has never been observed to work — say the code is available and DO NOT quote a saving for it, because no measured figure exists and an invented one is discovered at the checkout. '
      + 'CHECK shippingUnknown before calling any total "delivered" — when true the figure '
      + 'excludes postage, and presenting it as a delivered price is a false statement the buyer '
      + 'acts on. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        ns: { type: 'string', description: 'Identifier namespace, e.g. gtin or style_code.' },
        value: { type: 'string', description: 'The identifier itself, e.g. 012345678905 for a gtin or CW2288-111 for a style_code.' },
        pagePriceCents: {
          type: 'number',
          description: 'What the buyer is looking at, in CENTS (integer, minor units) - 2999 is $29.99, never 29.99. Sets the bar that \'cheaper\' is measured against.',
        },
        currency: { type: 'string', description: 'ISO 4217 code for pagePriceCents, e.g. usd. Defaults to usd.' },
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
      + 'Answers carry BOTH kinds of money and they STACK: `offsite.buyerCashbackCents` is what the buyer gets back through us, and `coupon` is a code to try at the retailer. Cashback is certain; a coupon is a code a checkout may reject, so present it as the weaker of the two. `hud.coupon.measured: false` means the code has never been observed to work — say the code is available and DO NOT quote a saving for it, because no measured figure exists and an invented one is discovered at the checkout. '
      + 'A vision label is WORDS, never an identity. It names the thing so somebody can search; '
      + 'it must never be used to claim a price for a specific product. Read `tier` before '
      + 'quoting any figure. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'object',
          description:
            'A code read off the item. Settles identity exactly and for free, so pass it '
            + 'instead of a photo whenever one is in frame.',
          properties: {
            ns: { type: 'string', description: 'Identifier namespace, e.g. gtin or style_code.' },
            value: { type: 'string', description: 'The identifier itself, e.g. 012345678905 for a gtin or CW2288-111 for a style_code.' },
          },
          required: ['ns', 'value'],
          additionalProperties: false,
        },
        imageBase64: { type: 'string', description: 'A JPEG frame, base64-encoded.' },
        pagePriceCents: {
          type: 'number',
          description: 'What the buyer is looking at, in CENTS (integer, minor units) - 2999 is $29.99, never 29.99. Sets the bar that \'cheaper\' is measured against.',
        },
        currency: { type: 'string', description: 'ISO 4217 code for pagePriceCents, e.g. usd. Defaults to usd.' },
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
      + 'ladder and returns the same HUD payload. '
      + 'Answers carry BOTH kinds of money and they STACK: `offsite.buyerCashbackCents` is what the buyer gets back through us, and `coupon` is a code to try at the retailer. Cashback is certain; a coupon is a code a checkout may reject, so present it as the weaker of the two. `hud.coupon.measured: false` means the code has never been observed to work — say the code is available and DO NOT quote a saving for it, because no measured figure exists and an invented one is discovered at the checkout. '
      + 'Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'object',
          description: 'A code read off the item. Exact, free, and preferred over a photo.',
          properties: {
            ns: { type: 'string', description: 'Identifier namespace, e.g. gtin or style_code.' },
            value: { type: 'string', description: 'The identifier itself, e.g. 012345678905 for a gtin or CW2288-111 for a style_code.' },
          },
          required: ['ns', 'value'],
          additionalProperties: false,
        },
        imageBase64: { type: 'string', description: 'A JPEG frame, base64-encoded.' },
        pagePriceCents: {
          type: 'number',
          description: 'What the buyer is looking at, in CENTS (integer, minor units) - 2999 is $29.99, never 29.99. Sets the bar that \'cheaper\' is measured against.',
        },
        currency: { type: 'string', description: 'ISO 4217 code for pagePriceCents, e.g. usd. Defaults to usd.' },
        sessionId: { type: 'string', description: 'Live Shop trip to record this against.' },
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
        device: {
          type: 'string',
          enum: ['glasses', 'phone'],
          default: 'phone',
          description:
            'What the buyer is scanning with. `glasses` means the verdict is also drawn into '
            + 'the lens; `phone` means the card is shown on screen. Recorded per trip so a '
            + 'history can tell the two apart.',
        },
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
      properties: {
        id: { type: 'string', description: 'Scan session id returned by start_scan_session.' },
      },
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
      properties: {
        id: { type: 'string', description: 'Scan session id returned by start_scan_session.' },
      },
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
      properties: {
        sessionId: {
          type: 'string',
          description: 'Scan session this lock-on belongs to, from start_scan_session.',
        },
      },
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
          description:
            'A code the device decoded this frame. The strongest evidence there is and it '
            + 'costs nothing, so send it the moment it appears.',
          properties: {
            ns: { type: 'string', description: 'Identifier namespace, e.g. gtin or style_code.' },
            value: { type: 'string', description: 'The identifier itself, e.g. 012345678905 for a gtin or CW2288-111 for a style_code.' },
          },
          required: ['ns', 'value'],
          additionalProperties: false,
        },
        ocrText: { type: 'string', description: 'Raw text read off the object this frame.' },
        attributes: {
          type: 'object',
          description:
            'What the device is CONFIDENT it read. These accumulate across frames and feed the '
            + 'candidate search, so a guess here pollutes the rest of the lock-on.',
          properties: {
            brand: { type: 'string', description: 'Brand as printed, e.g. Patagonia.' },
            model: { type: 'string', description: 'Model or product name, e.g. Nano Puff Hoody.' },
            size: { type: 'string', description: 'Size as printed, e.g. M, 10.5, or 42 EU.' },
            colour: { type: 'string', description: 'Colourway as printed, e.g. Black or Infrared.' },
            tokens: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Loose words seen on the object that did not fit the fields above. Fed to '
                + 'full-text search, so noise costs recall.',
            },
          },
          additionalProperties: false,
        },
        imageBase64: {
          type: 'string',
          description:
            'A JPEG frame, base64-encoded. Send ONLY when the cheap evidence did not settle it '
            + '- this is the rung that can cost money.',
        },
        pagePriceCents: {
          type: 'number',
          description: 'What the buyer is looking at, in CENTS (integer, minor units) - 2999 is $29.99, never 29.99. Sets the bar that \'cheaper\' is measured against.',
        },
        currency: { type: 'string', description: 'ISO 4217 code for pagePriceCents, e.g. usd. Defaults to usd.' },
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
        id: { type: 'string', description: 'Lock-on id from start_lockon.' },
        ns: {
          type: 'string',
          description: 'Identifier namespace, e.g. gtin or style_code. Must match a candidate this lock-on actually offered.',
        },
        value: {
          type: 'string',
          description:
            'Identifier value of the candidate the buyer picked. Validated against the '
            + 'candidates actually offered, so it cannot assert an arbitrary product.',
        },
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
