import { apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Cross-marketplace buyer features — gift finder, per-listing insights (fit,
 * resale value, impact, bought-together, reviews, quick questions, card
 * break, group buy), subscribe & save, split payment, the buyer agent's hunts,
 * group buys, returns, buybacks and shop-together rooms.
 *
 * Needs a BUYER token (`crossly_oat_…`, scoped `buyer:*`). Anything that can
 * spend money needs buyer:checkout:write, and takes an idempotencyKey so a
 * retried call cannot charge twice.
 *
 * Tools whose actions use DIFFERENT HTTP methods dispatch through functions
 * declared above the array, so the v1-parity scanner cannot cross them.
 */

const enc = encodeURIComponent;

function instantOffers(args: Record<string, unknown>): Promise<unknown> {
  const { action, portfolioId, offerId } = args as { action: 'quote' | 'list' | 'accept'; portfolioId?: string; offerId?: string };
  if (action === 'list') return apiGet('/v1/buyer/instant-offers');
  if (action === 'accept') {
    const id = enc(String(offerId ?? ''));
    return apiPost(`/v1/buyer/instant-offers/${id}/accept`, {});
  }
  const pid = enc(String(portfolioId ?? ''));
  return apiGet(`/v1/buyer/collection/${pid}/offer`);
}

function collectionSets(args: Record<string, unknown>): Promise<unknown> {
  const { action, category, brandSlug, modelSlug, optIn } = args as { action: 'list' | 'detail' | 'leaderboard'; category?: string; brandSlug?: string; modelSlug?: string; optIn?: boolean };
  if (action === 'leaderboard') return apiPut('/v1/buyer/collection/sets/leaderboard', { optIn: !!optIn });
  if (action === 'detail') {
    const c = enc(String(category ?? ''));
    const b = enc(String(brandSlug ?? ''));
    const m = enc(String(modelSlug ?? ''));
    return apiGet(`/v1/buyer/collection/sets/${c}/${b}/${m}`);
  }
  return apiGet('/v1/buyer/collection/sets');
}

function giftFinder(args: Record<string, unknown>): Promise<unknown> {
  const { action, for: who, interest, budget, page } = args as { action: 'options' | 'search'; for?: string; interest?: string; budget?: string; page?: number };
  if (action === 'options') return apiGet('/v1/buyer/gift-finder/options');
  return apiGet('/v1/buyer/gift-finder', { for: who, interest, budget, page });
}

function listingInsight(args: Record<string, unknown>): Promise<unknown> {
  const { what, slug, withMedia } = args as { what: string; slug: string; withMedia?: boolean };
  const s = enc(slug);
  if (what === 'fit') return apiGet(`/v1/buyer/listings/${s}/fit`);
  if (what === 'resale_value') return apiGet(`/v1/buyer/listings/${s}/resale-value`);
  if (what === 'impact') return apiGet(`/v1/buyer/listings/${s}/impact`);
  if (what === 'bought_together') return apiGet(`/v1/buyer/listings/${s}/bought-together`);
  if (what === 'seller_reviews') return apiGet(`/v1/buyer/listings/${s}/seller-reviews`, withMedia ? { withMedia: '1' } : undefined);
  if (what === 'quick_questions') return apiGet(`/v1/buyer/listings/${s}/quick-questions`);
  if (what === 'card_break') return apiGet(`/v1/buyer/listings/${s}/break`);
  if (what === 'cert') return apiGet(`/v1/buyer/listings/${s}/cert`);
  return apiGet(`/v1/buyer/listings/${s}/group-buy`);
}

function subscriptions(args: Record<string, unknown>): Promise<unknown> {
  const { action, slug, id, intervalDays, change, idempotencyKey } = args as { action: 'list' | 'subscribe' | 'update'; slug?: string; id?: string; intervalDays?: number; change?: string; idempotencyKey?: string };
  if (action === 'list') return apiGet('/v1/buyer/subscriptions');
  if (action === 'subscribe') {
    if (!slug) return Promise.reject(new Error('slug is required to subscribe'));
    return apiPost(`/v1/buyer/listings/${enc(slug)}/subscribe`, { intervalDays }, idempotencyKey);
  }
  if (!id) return Promise.reject(new Error('id is required to update'));
  return apiPatch(`/v1/buyer/subscriptions/${enc(id)}`, { action: change, intervalDays });
}

function hunts(args: Record<string, unknown>): Promise<unknown> {
  const { action, id, status, name, filters, maxPriceCents, mode, maxBuys, days, listingSlug, idempotencyKey } = args as {
    action: 'list' | 'create' | 'set_status'; id?: string; status?: string; name?: string; filters?: Record<string, unknown>;
    maxPriceCents?: number; mode?: string; maxBuys?: number; days?: number; listingSlug?: string; idempotencyKey?: string;
  };
  if (action === 'list') return apiGet('/v1/buyer/hunts');
  if (action === 'create') return apiPost('/v1/buyer/hunts', { name, filters: filters ?? {}, maxPriceCents, mode, maxBuys, days, listingSlug }, idempotencyKey);
  if (!id) return Promise.reject(new Error('id is required to change a hunt'));
  return apiPatch(`/v1/buyer/hunts/${enc(id)}`, { status });
}

function groupBuy(args: Record<string, unknown>): Promise<unknown> {
  const { id, action, idempotencyKey } = args as { id: string; action: 'join' | 'leave'; idempotencyKey?: string };
  if (action === 'join') return apiPost(`/v1/buyer/group-buys/${enc(id)}/join`, {}, idempotencyKey);
  return apiPost(`/v1/buyer/group-buys/${enc(id)}/leave`, {});
}

function together(args: Record<string, unknown>): Promise<unknown> {
  const { action, code, name, slug } = args as { action: 'list' | 'create' | 'add_item'; code?: string; name?: string; slug?: string };
  if (action === 'list') return apiGet('/v1/buyer/together');
  if (action === 'create') return apiPost('/v1/buyer/together', { name: name ?? '' });
  if (!code || !slug) return Promise.reject(new Error('code and slug are required to add an item'));
  return apiPost(`/v1/buyer/together/${enc(code)}/items`, { slug });
}

export const buyerXmarketTools: ToolDef[] = [
  {
    name: 'gift_finder',
    description: 'Find gifts: options = the recipients, their interests and budget bands; search = live listings for one. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['options', 'search'], description: 'options = the recipient, interest and budget keys to choose from; search = live listings matching for / interest / budget.' },
        for: { type: 'string', description: 'Recipient key from options (her, him, kids, …).' },
        interest: { type: 'string', description: 'Interest key for that recipient; omit for all of them.' },
        budget: { type: 'string', description: 'Budget band key (u25, u50, u100, u250, any).' },
        page: { type: 'number', description: 'search: results page, starting at 1; the response says hasMore.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => giftFinder(args),
  },
  {
    name: 'listing_insight',
    description:
      'Facts about one listing: fit (its measurements vs the buyer\'s saved garments), resale_value (sold comps for the brand + category, '
      + 'and the buyback offer when on), impact (sourced footprint of making a new one), bought_together, seller_reviews, quick_questions, '
      + 'card_break, group_buy, cert (a graded listing checked with the grader: verified / mismatch / not_found / unchecked, population, pop higher). '
      + 'Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        what: { type: 'string', enum: ['fit', 'resale_value', 'impact', 'bought_together', 'seller_reviews', 'quick_questions', 'card_break', 'group_buy', 'cert'], description: "Which fact: fit = vs your saved garments; resale_value = sold comps + buyback offer; impact = footprint of a new one; bought_together = items bought with it; seller_reviews = the seller's reviews; quick_questions = preset questions to ask; card_break = its break board; group_buy = its open group buy; cert = grader cert check." },
        slug: { type: 'string', description: 'The listing slug.' },
        withMedia: { type: 'boolean', description: 'seller_reviews only: reviews with photos.' },
      },
      required: ['what', 'slug'],
      additionalProperties: false,
    },
    handler: (args) => listingInsight(args),
  },
  {
    name: 'subscriptions',
    description: 'Subscribe & save: list; subscribe to a listing every 14/30/60/90 days (charged to the saved card); update one (pause, resume, skip, cancel, interval). Spending needs buyer:checkout:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'subscribe', 'update'], description: 'list = your subscriptions; subscribe = start one on a listing (slug, intervalDays; SPENDS on each run); update = change one (id, change).' },
        slug: { type: 'string', description: 'subscribe: the listing slug.' },
        id: { type: 'string', description: 'update: the subscription id.' },
        intervalDays: { type: 'number', enum: [14, 30, 60, 90], description: 'subscribe, or update with change=interval: days between deliveries — 14, 30, 60 or 90.' },
        change: { type: 'string', enum: ['pause', 'resume', 'skip', 'cancel', 'interval'], description: 'update: pause = stop runs until resumed; resume = restart; skip = skip the next run only; cancel = end it; interval = switch to intervalDays.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent so a retry cannot spend twice.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => subscriptions(args),
  },
  {
    name: 'split_purchase',
    description: 'Split a listing\'s price between 2-10 people: returns one pay link per share. Nobody is charged until every share is held; holds release after 48h. Requires buyer:checkout:write.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The listing slug to split.' },
        parts: { type: 'number', minimum: 2, maximum: 10, description: 'How many equal shares (2-10), one pay link each.' },
        note: { type: 'string', description: 'Optional message shown to the people paying, up to 200 characters.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent so a retry cannot spend twice.' },
      },
      required: ['slug', 'parts'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, parts, note, idempotencyKey } = args as { slug: string; parts: number; note?: string; idempotencyKey?: string };
      return apiPost(`/v1/buyer/listings/${enc(slug)}/split`, { parts, ...(note ? { note } : {}) }, idempotencyKey);
    },
  },
  {
    name: 'hunts',
    description:
      'The buyer agent: list; create (filters = search filters, maxPriceCents = budget, mode notify | offer | buy); set_status (active, paused, cancelled). '
      + 'offer makes an offer at the budget when a match is over it and checks out if accepted; buy buys matches at or under budget. '
      + 'Pass listingSlug (mode buy) for auto-buy on ONE listing: it buys when the price of that listing, sale applied, drops within maxPriceCents. '
      + 'Requires buyer:monitors:*; offer/buy also buyer:checkout:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'set_status'], description: 'list = your hunts; create = start one (name, filters or listingSlug, maxPriceCents, mode); set_status = pause / resume / stop one (id, status).' },
        id: { type: 'string', description: 'set_status: the hunt id (from list).' },
        status: { type: 'string', enum: ['active', 'paused', 'cancelled'], description: 'set_status: active = running; paused = held until set active again; cancelled = stopped for good.' },
        name: { type: 'string', description: 'create: a label for the hunt, up to 80 characters.' },
        filters: { type: 'object', description: 'Browse filters: q, brand, category, size, condition, minPrice, maxPrice …' },
        maxPriceCents: { type: 'number', description: "create: the budget per item, integer CENTS (e.g. 1999 = $19.99, minimum 100). offer/buy budgets are checked against the key's spending controls." },
        mode: { type: 'string', enum: ['notify', 'offer', 'buy'], description: 'create: notify = alert only; offer = offer at the budget on matches over it, checking out if accepted; buy = buy matches at or under the budget.' },
        maxBuys: { type: 'number', description: 'create: most items the hunt may buy before it stops, 1-10 (default 1).' },
        days: { type: 'number', description: 'create: days until the hunt expires, 1-90 (default 30).' },
        listingSlug: { type: 'string', description: 'Auto-buy on this one listing instead of a search.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent so a retry cannot spend twice.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => hunts(args),
  },
  {
    name: 'group_buy',
    description: 'Join (a hold at the starting price, captured at the price the group reaches) or leave a group buy. Requires buyer:checkout:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The group buy id (listing_insight group_buy).' },
        action: { type: 'string', enum: ['join', 'leave'], description: 'join = place a hold at the starting price (SPENDS when the group closes); leave = drop out and release your hold.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent so a retry cannot spend twice.' },
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => groupBuy(args),
  },
  {
    name: 'return_purchase',
    description: 'Start a return under the seller\'s policy (changed_mind, doesnt_fit, other) or send back a try-at-home item (try_at_home). Requires buyer:orders:write.',
    inputSchema: {
      type: 'object',
      properties: {
        purchaseId: { type: 'string', description: 'The purchase to return.' },
        reason: { type: 'string', enum: ['changed_mind', 'doesnt_fit', 'try_at_home', 'other'], description: "changed_mind / doesnt_fit / other = a return under the seller's policy (refund may differ by reason); try_at_home = send back a try-at-home item you are not keeping." },
        note: { type: 'string', description: 'Optional note to the seller, up to 500 characters.' },
        fit: { type: 'string', enum: ['small', 'large'], description: 'doesnt_fit only: which way it didn\'t fit (teaches the buyer\'s size memory).' },
      },
      required: ['purchaseId', 'reason'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { purchaseId, reason, note, fit } = args as { purchaseId: string; reason: string; note?: string; fit?: string };
      return apiPost(`/v1/buyer/purchases/${enc(purchaseId)}/return`, { reason, ...(note ? { note } : {}), ...(fit ? { fit } : {}) });
    },
  },
  {
    name: 'request_buyback',
    description: 'Ask Crossly to buy an item back under its buyback guarantee (store credit). Requires buyer:orders:write.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The buyback guarantee id.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const id = enc(String(args.id ?? ''));
      return apiPost(`/v1/buyer/buybacks/${id}/request`, {});
    },
  },
  {
    name: 'shop_together',
    description: 'Shop-together rooms: list; create a room (returns its code); add_item puts a listing on a room\'s board. Requires buyer:activity:read / buyer:activity:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'add_item'], description: "list = rooms you are in; create = open a new room (name) and get its code; add_item = put a listing (slug) on a room's board (code)." },
        code: { type: 'string', description: 'add_item: the room code.' },
        name: { type: 'string', description: 'create: the room name.' },
        slug: { type: 'string', description: 'add_item: the listing slug to add.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => together(args),
  },
  {
    name: 'cart_optimizer',
    description: "Price a shopping list: one item per line (\"2 Charizard Base Set\"). Returns the cheapest delivered basket across sellers, one pick per line, items + each seller's shipping with free-shipping thresholds applied. fewestPackages prefers fewer sellers. Adds nothing to the cart. Requires buyer:cart:read.",
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The shopping list, one item per line with an optional leading quantity ("2 Charizard Base Set"); up to 10,000 characters.' },
        fewestPackages: { type: 'boolean', description: 'Prefer fewer sellers (fewer packages) over the absolute lowest total.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/buyer/cart-optimizer', args),
  },
  {
    name: 'instant_offers',
    description: "Sell from your collection: quote shows the top open market bid and Crossly's instant store-credit offer for one collection item (portfolioId); list shows your offers; accept locks an offer (offerId) — ops then send a prepaid label and pay the credit once it checks out. Requires buyer:offers:read / buyer:offers:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['quote', 'list', 'accept'], description: "quote = top market bid + Crossly's instant offer for one collection item (portfolioId); list = your instant offers; accept = lock one offer (offerId)." },
        portfolioId: { type: 'string', description: 'quote: the collection item id.' },
        offerId: { type: 'string', description: 'accept: the instant offer id (from quote or list).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => instantOffers(args),
  },
  {
    name: 'collection_sets',
    description: "Set completion from your collection: list the sets you are collecting (owned / total, percent); detail one set (category + brandSlug + modelSlug from list) for every piece, its lowest market ask, the cost to complete, and the opt-in leaderboard with your rank; leaderboard turns showing yourself on boards on or off (optIn). Requires buyer:orders:read; leaderboard needs buyer:activity:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'detail', 'leaderboard'], description: 'list = sets you are collecting; detail = one set (category + brandSlug + modelSlug) piece by piece; leaderboard = show or hide yourself on set leaderboards (optIn).' },
        category: { type: 'string', description: 'detail: the set category, as returned by list.' },
        brandSlug: { type: 'string', description: 'detail: the set brand slug, as returned by list.' },
        modelSlug: { type: 'string', description: 'detail: the set model slug, as returned by list.' },
        optIn: { type: 'boolean', description: 'leaderboard: true = show you (by public handle) on boards; false or omitted = hide you.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => collectionSets(args),
  },
];
