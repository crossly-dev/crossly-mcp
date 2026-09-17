import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The buyer surface — catalogue, monitors, checkout.
 *
 * ── WHAT THE DESCRIPTIONS ARE DOING ──────────────────────────────────
 * An agent reading these has no way to discover, by trying, that polling is
 * expensive or that a retry double-buys. It will find out by doing the wrong
 * thing at scale. So each description carries the operational fact that makes
 * the difference, not just the parameter list:
 *
 *   - search  → walk by cursor, and if you are looping on a timer you want a
 *               monitor instead
 *   - buy     → an Idempotency-Key is not optional in practice
 *   - monitor → the first sweep seeds without firing, so "it did nothing" is
 *               expected on creation rather than a bug to work around
 *
 * These all need a BUYER token (`crossly_oat_…`, scoped `buyer:*`). A seller
 * PAT will not authenticate them.
 */
export const buyerTools: ToolDef[] = [
  // ── Catalogue ──────────────────────────────────────────────────────
  {
    name: 'search_catalog',
    description:
      'Search the Crossly catalogue — the buyer-facing listings anyone can purchase. '
      + 'Paginates by an OPAQUE CURSOR, not page numbers: pass the `meta.nextCursor` you were given back as '
      + '`cursor` to get the next page. Do not construct or parse a cursor. Page 500 costs the same as page 1, so '
      + 'walking the whole catalogue is fine. '
      + 'IF YOU ARE ABOUT TO CALL THIS ON A TIMER TO SEE WHAT CHANGED, USE create_buyer_monitor INSTEAD — it is '
      + 'lower latency and vastly cheaper. Requires the buyer:catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Free text; matches title OR brand.' },
        brand: { type: 'string' },
        category: { type: 'string' },
        condition: { type: 'string' },
        seller: { type: 'string', description: 'Seller username.' },
        minPriceCents: { type: 'number' },
        maxPriceCents: { type: 'number' },
        listedAfter: { type: 'string', description: 'ISO instant; only listings live after it.' },
        inStockOnly: { type: 'boolean', description: 'Default true.' },
        sort: {
          type: 'string',
          enum: ['newest', 'price_low', 'price_high'],
          description:
            'No "popular": it reorders continuously, and a cursor into a reordering list silently skips rows.',
        },
        limit: { type: 'number', description: 'Max 100, default 24.' },
        cursor: { type: 'string', description: 'Opaque. From a previous meta.nextCursor.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/buyer/catalog/search', args as Record<string, unknown>),
  },

  {
    name: 'get_catalog_listing',
    description:
      'Read one listing in full by its slug. Resolves even when the listing is SOLD or DELISTED — check the '
      + '`available` and `status` fields rather than treating a successful response as "buyable". '
      + '(A 404 here would make a stale slug indistinguishable from one that never existed, and the usual '
      + 'response to that ambiguity is to re-crawl.) Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The listing slug.' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string };
      return apiGet(`/v1/buyer/catalog/listings/${encodeURIComponent(slug)}`, rest);
    },
  },

  {
    name: 'check_listing_availability',
    description:
      'Is this listing still buyable, and at what price. The CHEAPEST call in the buyer API — one indexed row, no '
      + 'joins — and the right one to use before attempting a purchase. '
      + 'If you want to know the moment it changes rather than asking repeatedly, create a back_in_stock or '
      + 'price_drop monitor. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string };
      return apiGet(`/v1/buyer/catalog/listings/${encodeURIComponent(slug)}/availability`, rest);
    },
  },

  {
    name: 'get_catalog_facets',
    description:
      'The brands, categories and conditions that currently have stock, with live counts. Use this to discover '
      + 'valid filter values before searching — a filter built from these cannot return an empty page for a value '
      + 'that has since sold out. Requires buyer:catalog:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/catalog/facets', {}),
  },

  // ── Monitors ───────────────────────────────────────────────────────
  {
    name: 'list_buyer_monitors',
    description:
      'List the buyer\'s monitors — the saved searches that notify them when something matches. '
      + 'A monitor with `active: false` and a `pausedReason` stopped on its own, usually because its webhook '
      + 'endpoint kept refusing deliveries. Requires buyer:monitors:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/monitors', {}),
  },

  {
    name: 'create_buyer_monitor',
    description:
      'Watch a search and be notified when it matches — the correct alternative to polling search on a timer. '
      + 'Works immediately; there is no review step. '
      + 'THE FIRST SWEEP RECORDS STATE WITHOUT NOTIFYING, deliberately: a back_in_stock alert created while the '
      + 'item is already in stock has not observed a restock, and a new_listing monitor would otherwise deliver '
      + 'the entire back catalogue at once. Silence right after creation is expected, not a fault. '
      + 'The webhookSecret is returned ONCE in this response and is never readable again — store it or the buyer '
      + 'cannot verify deliveries. Use delivery "poll" when no public URL can receive a POST. '
      + 'back_in_stock must name one listing via query.slug. Requires buyer:monitors:write.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['new_listing', 'price_drop', 'back_in_stock'],
          description:
            'price_drop and back_in_stock are TRANSITIONS — they fire on a change, not on a state being true.',
        },
        query: {
          type: 'object',
          description:
            'Same filters as search_catalog, plus `slug` to watch one listing. Required for back_in_stock.',
          properties: {
            slug: { type: 'string' },
            q: { type: 'string' },
            brand: { type: 'string' },
            category: { type: 'string' },
            condition: { type: 'string' },
            seller: { type: 'string' },
            minPriceCents: { type: 'number' },
            maxPriceCents: { type: 'number' },
          },
          additionalProperties: false,
        },
        delivery: { type: 'string', enum: ['webhook', 'poll'], default: 'webhook' },
        webhookUrl: {
          type: 'string',
          description:
            'Required for webhook delivery. Must be publicly reachable — private, loopback and link-local '
            + 'addresses are refused.',
        },
      },
      required: ['name', 'kind'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/monitors', args as Record<string, unknown>),
  },

  {
    name: 'get_buyer_monitor_matches',
    description:
      'What a monitor has matched. This is how you read a `poll` monitor, and it doubles as an audit trail for a '
      + '`webhook` one — a delivery the endpoint missed is not data that was lost. '
      + '`triggerPriceCents` is -1 when the monitor kind has no price trigger. Requires buyer:monitors:read.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Monitor id.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...rest } = args as { id: string };
      return apiGet(`/v1/buyer/monitors/${encodeURIComponent(id)}/matches`, rest);
    },
  },

  {
    name: 'update_buyer_monitor',
    description:
      'Pause, resume or rename a monitor. Resuming a monitor that was auto-paused for delivery failures also '
      + 'clears its failure streak — so fix the endpoint FIRST, or it will pause again on the next failure. '
      + 'Requires buyer:monitors:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        active: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...rest } = args as { id: string };
      return apiPatch(`/v1/buyer/monitors/${encodeURIComponent(id)}`, rest);
    },
  },

  {
    name: 'delete_buyer_monitor',
    description:
      'Delete a monitor and everything it has matched. Irreversible. To stop notifications temporarily, use '
      + 'update_buyer_monitor with active:false instead — that keeps the match history. Requires buyer:monitors:write.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/buyer/monitors/${encodeURIComponent(id)}`);
    },
  },

  // ── Checkout ───────────────────────────────────────────────────────
  {
    name: 'get_buyer_checkout_controls',
    description:
      'What the CURRENT API key is permitted to spend. Per-key, not per-account: every key has its own switch and '
      + 'its own ceilings, so another key being enabled says nothing about this one. '
      + 'Check this before attempting buy_listing — `enabled: false` means the purchase will be refused regardless '
      + 'of scopes. Requires buyer:checkout:write.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/checkout/controls', {}),
  },

  {
    name: 'set_buyer_checkout_controls',
    description:
      'Switch this key on for spending and set its ceilings. THIS AUTHORISES REAL MONEY TO BE SPENT WITHOUT THE '
      + 'PERSON PRESENT — confirm the limits with them before calling it, and prefer the smallest that works. '
      + 'Holding the buyer:checkout:write scope is NOT sufficient on its own; a key that was never enabled here '
      + 'cannot spend, which is what bounds the damage a leaked token can do. '
      + 'A limit of 0 means NO ceiling, which is almost never what someone wants — set real numbers. '
      + 'maxUnitsPerListingPerDay caps how much of one seller\'s stock this key can take.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        dailyLimitCents: { type: 'number', description: 'Rolling 24h ceiling. 0 = unlimited.' },
        perOrderLimitCents: { type: 'number', description: 'Per-purchase ceiling. 0 = unlimited.' },
        maxUnitsPerListingPerDay: { type: 'number', description: 'Anti-scalping cap. Default 1.' },
      },
      required: ['enabled', 'dailyLimitCents', 'perOrderLimitCents', 'maxUnitsPerListingPerDay'],
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/buyer/checkout/controls', args as Record<string, unknown>),
  },

  {
    name: 'buy_listing',
    description:
      'BUY A LISTING. THIS SPENDS REAL MONEY and completes without the buyer present. '
      + 'AN idempotencyKey IS REQUIRED — the API answers 400 idempotency_key_required without one. '
      + 'A retry after a timeout is the normal way an automated buyer purchases '
      + 'the same item twice, and it happens in exactly the case where you never learned the first attempt '
      + 'succeeded. Derive it from the intent (e.g. "monitor-<id>:<slug>"), not from a random value per attempt. '
      + 'maxTotalCents is checked against the DELIVERED total — item plus shipping plus tax — before anything is '
      + 'charged, so set it from what the buyer agreed to pay, not from the listing price. '
      + 'paymentMethodId names a card the buyer already saved on crossly.net; there is no way to supply card '
      + 'details and you must never ask for any. '
      + 'A card requiring 3-D Secure cannot be charged unattended and returns 402 authentication_required — that '
      + 'is final, not retryable. Requires buyer:checkout:write AND the key being enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        listingSlug: { type: 'string' },
        paymentMethodId: { type: 'string', description: 'A SAVED payment method id. Never card data.' },
        quantity: { type: 'number', default: 1 },
        maxTotalCents: {
          type: 'number',
          description: 'Refuse above this DELIVERED total. Strongly recommended.',
        },
        localPickup: { type: 'boolean' },
        shipTo: {
          type: 'object',
          description: 'Omit to use the buyer\'s saved address.',
          properties: {
            name: { type: 'string' },
            street1: { type: 'string' },
            street2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['name', 'street1', 'city', 'state', 'zip'],
          additionalProperties: false,
        },
        idempotencyKey: {
          type: 'string',
          description:
            'Sent as the Idempotency-Key header. REQUIRED. Stable per intent — a fresh random '
            + 'value each attempt passes the check and still lets a timeout buy the item twice.',
        },
      },
      required: ['listingSlug', 'paymentMethodId', 'idempotencyKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & {
        idempotencyKey?: string;
      };
      return apiPost('/v1/buyer/checkout', body, idempotencyKey);
    },
  },
];
