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
        brand: { type: 'string', description: 'Exact brand name. Use `q` for a fuzzy match.' },
        category: { type: 'string', description: 'Category slug, e.g. womens-outerwear.' },
        condition: {
          type: 'string',
          description:
            'Item condition as the seller declared it, e.g. new, like_new, good, fair. '
            + 'Conditions are per-listing text, so an unknown value simply matches nothing.',
        },
        seller: { type: 'string', description: 'Seller username.' },
        minPriceCents: {
          type: 'number',
          description: 'Lowest price to include, in CENTS (integer) - 2999 is $29.99, not 29.99.',
        },
        maxPriceCents: {
          type: 'number',
          description: 'Highest price to include, in CENTS (integer) - 2999 is $29.99, not 29.99.',
        },
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
    name: 'get_seller_trust',
    description:
      'Seller at a glance before buying from a stranger: member since, completed Crossly sales, independent rating, typical '
      + 'handling time, dispute rate (last year), trust tier, badges, and `summary` sentences. Recorded facts only. '
      + 'Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { username: { type: 'string', description: 'The seller handle, as in /shop/sellers/:username.' } },
      required: ['username'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { username } = args as { username: string };
      return apiGet(`/v1/buyer/sellers/${encodeURIComponent(username)}/trust`, {});
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
      properties: {
        slug: {
          type: 'string',
          description: 'The listing slug, from search_catalog or a monitor match.',
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string };
      return apiGet(`/v1/buyer/catalog/listings/${encodeURIComponent(slug)}/availability`, rest);
    },
  },

  {
    name: 'get_listing_shipping',
    description:
      'Every shipping service (Standard, Expedited, Overnight, international) the seller offers to a '
      + 'destination, each with its price in CENTS for the quantity and its delivery window in business '
      + 'days (handling included). shipsToCountry=false means the seller does not ship there. Use a '
      + 'service id as shippingServiceId on buy_listing. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The listing slug.' },
        zip: { type: 'string', description: 'Destination postal code. Required (5 digits) for a domestic US quote.' },
        country: { type: 'string', description: 'Destination ISO 3166-1 alpha-2, e.g. GB. Defaults to the seller’s country.' },
        quantity: { type: 'number', default: 1, description: 'Units to price.' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string };
      return apiGet(`/v1/buyer/catalog/listings/${encodeURIComponent(slug)}/shipping`, rest);
    },
  },

  {
    name: 'quote_landed_cost',
    description:
      'Import duties, import taxes and fees (in US-dollar CENTS) for a listing shipped to a country, priced on '
      + 'the cheapest shipping service the seller offers there. status=included: checkout charges them and the '
      + 'parcel ships DDP (no bill at the door). status=unavailable: it ships DDU and the carrier or customs may '
      + 'charge the buyer on delivery (see notice). status=none: no border is crossed. Errors 503 with missingEnv '
      + 'when landed-cost quoting is not configured. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The listing slug.' },
        country: { type: 'string', description: 'Destination ISO 3166-1 alpha-2, e.g. GB.' },
        postalCode: { type: 'string', description: 'Destination postal code (improves the quote).' },
        quantity: { type: 'number', default: 1, description: 'Units to quote.' },
      },
      required: ['slug', 'country'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string };
      return apiGet(`/v1/buyer/listings/${encodeURIComponent(slug)}/landed-cost`, rest);
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

  {
    name: 'get_fx_rates',
    description:
      'Display-only exchange rates: units of each currency per 1 US dollar (`rates.EUR = 0.92` means $1 ≈ €0.92), '
      + 'from the European Central Bank daily reference rates, with the ECB publication date as `asOf`. Use it to show '
      + 'an APPROXIMATE price in another currency. Every Crossly price and every charge is in US dollars; the card '
      + 'issuer sets the final exchange rate. Requires buyer:catalog:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/catalog/fx', {}),
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
        name: {
          type: 'string',
          description:
            'What the buyer will see on the alert. Name it after the thing being watched, not '
            + 'the query - it is the only context a notification carries.',
        },
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
        delivery: {
          type: 'string',
          enum: ['webhook', 'poll'],
          default: 'webhook',
          description:
            'How matches reach the buyer. `webhook` POSTs each match to webhookUrl as it '
            + 'happens and is the reason a monitor beats polling search. `poll` stores matches '
            + 'for list_buyer_monitor_matches instead — use it only when nothing can receive an '
            + 'inbound POST, since it reintroduces the latency a monitor exists to remove.',
        },
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
        id: { type: 'string', description: 'Monitor id from create_buyer_monitor.' },
        name: { type: 'string', description: 'New display name. Omit to leave it alone.' },
        active: {
          type: 'boolean',
          description:
            'false pauses delivery and keeps the match history; true resumes AND clears the '
            + 'failure streak, so fix a broken endpoint before setting it.',
        },
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
      properties: { id: { type: 'string', description: 'Monitor id to delete permanently.' } },
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
        enabled: {
          type: 'boolean',
          description:
            'Whether THIS key may spend at all. false is the default for every new key and is '
            + 'what bounds the damage a leaked token can do.',
        },
        dailyLimitCents: {
          type: 'number',
          description:
            'Rolling 24h ceiling in CENTS (integer) - 50000 is $500.00, not 500. 0 = unlimited, '
            + 'which is almost never intended.',
        },
        perOrderLimitCents: {
          type: 'number',
          description:
            'Per-purchase ceiling in CENTS (integer) - 50000 is $500.00, not 500. 0 = unlimited, '
            + 'which is almost never intended.',
        },
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
        listingSlug: {
          type: 'string',
          description: 'Slug of the listing to buy, from search_catalog or get_catalog_listing.',
        },
        paymentMethodId: { type: 'string', description: 'A SAVED payment method id. Never card data.' },
        quantity: {
          type: 'number',
          default: 1,
          description:
            'Units to buy. Also capped per listing per day by maxUnitsPerListingPerDay, so a '
            + 'large quantity can be refused even under the money limits.',
        },
        maxTotalCents: {
          type: 'number',
          description:
            'Refuse if the DELIVERED total - item plus shipping plus tax - exceeds this, in '
            + 'CENTS (integer): 12999 is $129.99, not 129.99. Set it from what the buyer agreed '
            + 'to pay, not from the listing price. Strongly recommended.',
        },
        localPickup: {
          type: 'boolean',
          description:
            'Collect in person instead of shipping. Only for listings that offer it; shipTo is '
            + 'ignored when true.',
        },
        shippingServiceId: {
          type: 'string',
          description:
            'Shipping speed: a service id from get_listing_shipping (e.g. standard, expedited). '
            + 'Omit for the cheapest. An id the seller does not offer to shipTo.country is refused.',
        },
        pickupPoint: {
          type: 'object',
          description:
            'Hold the parcel at a carrier pickup point instead of delivering it: pass one point exactly as '
            + 'delivery_info (what: pickup_points) returned it. Wins over shippingServiceId.',
        },
        authentication: {
          type: 'string',
          enum: ['direct', 'add'],
          description: 'direct: skip a seller-required authentication on an eligible item (ships sooner). add: buy an authentication check for the provider fee shown in the quote.',
        },
        gift: {
          type: 'object',
          properties: {
            recipientName: { type: 'string', description: 'Who it is for.' },
            recipientEmail: { type: 'string', description: 'Where the teaser and the "it has arrived" email go.' },
            message: { type: 'string', description: 'A note shown on the teaser (no price is ever shown).' },
            teaserAt: { type: 'string', description: 'ISO date-time to send the teaser (up to 90 days ahead); omit to send it once paid.' },
            senderName: { type: 'string', description: 'How the sender is named to the recipient; defaults to your display name.' },
          },
          required: ['recipientName', 'recipientEmail'],
          description: 'Send it as a gift: the recipient is emailed a teaser, and the item is revealed when it is delivered.',
        },
        protectionPlanId: {
          type: 'string',
          description: "A protection plan (extended warranty) id from the quote's protectionOptions. Its premium, in cents per unit, is added to the charge; cancel later with protection_plans.",
        },
        payInCurrency: {
          type: 'string',
          description:
            'Optional ISO 4217 code (e.g. "eur") to charge the card in that currency instead of USD, at the rate '
            + 'quoted inside the same request plus a 3% conversion charge. maxTotalCents and every limit stay in USD '
            + 'cents. Refused with 422 currency_unavailable when it cannot be honoured (pre-orders, no fresh rate).',
        },
        shipTo: {
          type: 'object',
          description: 'Omit to use the buyer\'s saved address.',
          properties: {
            name: { type: 'string', description: 'Recipient name as it should appear on the label.' },
            street1: { type: 'string', description: 'Street address, first line.' },
            street2: { type: 'string', description: 'Apartment, suite or unit. Optional.' },
            city: { type: 'string', description: 'City or town.' },
            state: { type: 'string', description: 'State, province or region. Required where the country needs one (US, CA, AU, …) — see list_countries.' },
            zip: { type: 'string', description: 'Postal or ZIP code. Required where the country has postal codes (a UK postcode, a US ZIP); omit for Hong Kong, UAE.' },
            country: { type: 'string', description: 'ISO 3166-1 alpha-2, e.g. US, GB. Defaults to US.' },
          },
          required: ['name', 'street1', 'city'],
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
