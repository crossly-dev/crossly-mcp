import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The rest of the cross-marketplace buyer surface — purchase extras (subscribe
 * offer, footprint, buybacks, splits, return quotes and tracking, owner
 * stories, digital downloads), saved fit garments, card-break spots, a
 * shop-together room, parties / price guide / creators, and the market's
 * watches and fixed-price bids.
 *
 * Needs a BUYER token (`crossly_oat_…`, scoped `buyer:*`). A market bid
 * SPENDS MONEY when it fills: buyer:checkout:write, the key's spending
 * controls, and an idempotencyKey.
 *
 * Tools whose actions use DIFFERENT HTTP methods dispatch through functions
 * declared above the array, so the v1-parity scanner cannot cross them.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function purchaseExtras(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; slug?: string; story?: string; carrier?: string; trackingCode?: string };
  switch (a.action) {
    case 'subscribe_offer': return apiGet(`/v1/buyer/listings/${need(a.slug, "slug")}/subscribe-offer`);
    case 'impact': return apiGet('/v1/buyer/impact');
    case 'buybacks': return apiGet('/v1/buyer/buybacks');
    case 'splits': return apiGet('/v1/buyer/splits');
    case 'cancel_split': return apiPost(`/v1/buyer/splits/${need(a.id, "id")}/cancel`, {});
    case 'return_quote': return apiGet(`/v1/buyer/purchases/${need(a.id, "id")}/return`);
    case 'return_tracking': return apiPost(`/v1/buyer/returns/${need(a.id, "id")}/tracking`, { carrier: a.carrier, trackingCode: a.trackingCode });
    case 'cancel_return': return apiPost(`/v1/buyer/returns/${need(a.id, "id")}/cancel`, {});
    case 'story': return apiGet(`/v1/buyer/purchases/${need(a.id, "id")}/story`);
    case 'set_story': return apiPut(`/v1/buyer/purchases/${need(a.id, "id")}/story`, { story: a.story ?? '' });
    default: return apiPost(`/v1/buyer/purchases/${need(a.id, "id")}/download`, {});
  }
}

function fit(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: 'vocabulary' | 'list' | 'add' | 'remove'; id?: string; label?: string; measurements?: Record<string, unknown> };
  if (a.action === 'vocabulary') return apiGet('/v1/buyer/fit/vocabulary');
  if (a.action === 'list') return apiGet('/v1/buyer/fit/refs');
  if (a.action === 'add') return apiPost('/v1/buyer/fit/refs', { label: a.label, measurements: a.measurements ?? {} });
  return apiDelete(`/v1/buyer/fit/refs/${need(a.id, "id")}`);
}

function breaks(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: 'mine' | 'get' | 'hold' | 'release'; id?: string; spotId?: string };
  if (a.action === 'mine') return apiGet('/v1/buyer/breaks');
  if (a.action === 'get') return apiGet(`/v1/buyer/breaks/${need(a.id, "id")}`);
  const id = need(a.id, "id");
  const spot = need(a.spotId, "spotId");
  if (a.action === 'hold') return apiPost(`/v1/buyer/breaks/${id}/spots/${spot}/hold`, {});
  return apiDelete(`/v1/buyer/breaks/${id}/spots/${spot}/hold`);
}

function room(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: 'get' | 'join' | 'leave' | 'remove_item' | 'vote' | 'say'; code: string; itemId?: string; vote?: number; body?: string };
  const c = need(a.code, "code");
  if (a.action === 'get') return apiGet(`/v1/buyer/together/${c}`);
  if (a.action === 'join') return apiPost(`/v1/buyer/together/${c}/join`, {});
  if (a.action === 'leave') return apiPost(`/v1/buyer/together/${c}/leave`, {});
  if (a.action === 'remove_item') return apiDelete(`/v1/buyer/together/${c}/items/${need(a.itemId, "itemId")}`);
  if (a.action === 'vote') return apiPost(`/v1/buyer/together/${c}/items/${need(a.itemId, "itemId")}/vote`, { vote: a.vote ?? 0 });
  return apiPost(`/v1/buyer/together/${c}/messages`, { body: a.body ?? '' });
}

function discoverMore(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { what: 'parties' | 'party' | 'party_listings' | 'price_guide' | 'creator' | 'stream_auction'; slug?: string; handle?: string; streamId?: string; filters?: Record<string, string>; limit?: number };
  if (a.what === 'parties') return apiGet('/v1/buyer/parties');
  if (a.what === 'party') return apiGet(`/v1/buyer/parties/${need(a.slug, "slug")}`);
  if (a.what === 'party_listings') return apiGet(`/v1/buyer/parties/${need(a.slug, "slug")}/listings`, { limit: a.limit });
  if (a.what === 'price_guide') return apiGet('/v1/buyer/price-guide', a.filters ?? {});
  if (a.what === 'stream_auction') return apiGet(`/v1/buyer/live-streams/${need(a.streamId, "streamId")}/auction`);
  return apiGet(`/v1/buyer/creators/${need(a.handle, "handle")}`);
}

function delivery(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { what: 'pickup_points' | 'purchase' | 'consolidations'; zip?: string; line1?: string; city?: string; state?: string; country?: string; purchaseId?: string };
  if (a.what === 'pickup_points') return apiGet('/v1/buyer/pickup-points', { zip: a.zip, line1: a.line1, city: a.city, state: a.state, country: a.country });
  if (a.what === 'purchase') return apiGet(`/v1/buyer/purchases/${need(a.purchaseId, "purchaseId")}/delivery`);
  return apiGet('/v1/buyer/consolidations');
}

function market(args: Record<string, unknown>): Promise<unknown> {
  const a = args as {
    action: 'watches' | 'watch' | 'unwatch' | 'bids' | 'bid' | 'cancel_bid'; id?: string; variantId?: string; condition?: string;
    thresholdCents?: number; priceCents?: number; paymentMethodId?: string; expiresInDays?: number; idempotencyKey?: string;
    deliverTo?: 'home' | 'vault'; fastShip?: boolean; gradeWith?: { runId: string; returnMode?: 'return' | 'vault' };
  };
  if (a.action === 'watches') return apiGet('/v1/buyer/market/watches');
  if (a.action === 'watch') return apiPost('/v1/buyer/market/watches', { variantId: a.variantId, condition: a.condition, thresholdCents: a.thresholdCents ?? null });
  if (a.action === 'unwatch') return apiDelete(`/v1/buyer/market/watches/${need(a.id, "id")}`);
  if (a.action === 'bids') return apiGet('/v1/buyer/market/bids');
  if (a.action === 'cancel_bid') return apiDelete(`/v1/buyer/market/bids/${need(a.id, "id")}`);
  const bid = { variantId: a.variantId, priceCents: a.priceCents, paymentMethodId: a.paymentMethodId, condition: a.condition, expiresInDays: a.expiresInDays, deliverTo: a.deliverTo, fastShip: a.fastShip, gradeWith: a.gradeWith };
  return apiPost('/v1/buyer/market/bids', bid, a.idempotencyKey);
}

function vault(args: Record<string, unknown>): Promise<unknown> {
  const { action, id, priceCents, expiresInDays, speed, variantId, condition, idempotencyKey } = args as {
    action: 'items' | 'sell' | 'unlist' | 'withdraw' | 'purchase_options'; id?: string; priceCents?: number; expiresInDays?: number;
    speed?: 'standard' | 'expedited'; variantId?: string; condition?: string; idempotencyKey?: string;
  };
  if (action === 'items') return apiGet('/v1/buyer/vault');
  if (action === 'purchase_options') return apiGet('/v1/buyer/market/purchase-options', { variantId, condition });
  if (action === 'sell') return apiPost(`/v1/buyer/vault/${need(id, "id")}/list`, { priceCents, ...(expiresInDays ? { expiresInDays } : {}) });
  if (action === 'unlist') return apiPost(`/v1/buyer/vault/${need(id, "id")}/unlist`, {});
  return apiPost(`/v1/buyer/vault/${need(id, "id")}/withdraw`, { speed: speed ?? 'standard' }, idempotencyKey);
}

export const buyerXmarketExtraTools: ToolDef[] = [
  {
    name: 'purchase_extras',
    description:
      'After-purchase extras. subscribe_offer (slug): the listing\'s subscribe & save terms. impact: footprint your secondhand buys avoided. '
      + 'buybacks, splits: lists. cancel_split (id). return_quote (id = purchase): refund per reason and deadline. return_tracking / cancel_return '
      + '(id = return). story / set_story (id = purchase): your owner story, passed to the next owner. download (id = purchase): a 10-minute file '
      + 'link, uses one download. Reads need buyer:orders:read; changes buyer:orders:write (cancel_split: buyer:checkout:write).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['subscribe_offer', 'impact', 'buybacks', 'splits', 'cancel_split', 'return_quote', 'return_tracking', 'cancel_return', 'story', 'set_story', 'download'], description: "subscribe_offer = a listing's subscribe & save terms (slug); impact = your avoided footprint; buybacks / splits = your lists; cancel_split = cancel a split (id); return_quote = refund per reason + deadline (id = purchase); return_tracking = add tracking to a return (id = return); cancel_return (id = return); story / set_story = read / write your owner story (id = purchase); download = one-use 10-minute file link (id = purchase)." },
        id: { type: 'string', description: 'The purchase id (return_quote, story, set_story, download), the return id (return_tracking, cancel_return) or the split id (cancel_split).' },
        slug: { type: 'string', description: 'subscribe_offer: the listing slug.' },
        story: { type: 'string', description: 'set_story: up to 280 characters.' },
        carrier: { type: 'string', description: 'return_tracking: the carrier you shipped the return with (e.g. USPS, UPS), 2-40 characters.' },
        trackingCode: { type: 'string', description: 'return_tracking: the tracking number, 6-60 characters.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => purchaseExtras(args),
  },
  {
    name: 'fit_garments',
    description: 'Reference garments for fit: vocabulary (garment kinds + measurements), list, add (label + flat measurements in inches), remove (id). buyer:activity:*.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['vocabulary', 'list', 'add', 'remove'], description: 'vocabulary = garment kinds and their measurement keys; list = your saved garments; add = save one (label, measurements); remove = delete one (id).' },
        id: { type: 'string', description: 'remove: the saved garment id (from list).' },
        label: { type: 'string', description: 'add: a name for the garment ("my favourite jeans"), 1-80 characters.' },
        measurements: { type: 'object', description: 'kind plus measurement keys from vocabulary, in inches.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => fit(args),
  },
  {
    name: 'card_breaks',
    description: 'Card breaks: mine (spots you hold or bought), get (a break\'s board), hold / release a pick-your-spot spot (then buy it through checkout before the hold lapses). buyer:orders:read / buyer:cart:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['mine', 'get', 'hold', 'release'], description: "mine = spots you hold or bought; get = one break's board (id); hold = reserve a pick-your-spot spot (id, spotId); release = let a held spot go (id, spotId)." },
        id: { type: 'string', description: 'get / hold / release: the break id.' },
        spotId: { type: 'string', description: 'hold / release: the spot id from the break board.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => breaks(args),
  },
  {
    name: 'together_room',
    description: 'One shop-together room by code: get (board, votes, chat), join, leave, remove_item, vote (-1 / 0 / 1 on an item), say (chat). buyer:activity:*.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'join', 'leave', 'remove_item', 'vote', 'say'], description: 'get = board, votes and chat; join / leave the room; remove_item = take an item you added off the board (itemId); vote = vote on an item (itemId, vote); say = post to the chat (body).' },
        code: { type: 'string', description: 'The room code.' },
        itemId: { type: 'string', description: 'remove_item / vote: the board item id (from get).' },
        vote: { type: 'number', enum: [-1, 0, 1], description: 'vote: 1 = up, -1 = down, 0 = clear your vote.' },
        body: { type: 'string', description: 'say: the chat message text.' },
      },
      required: ['action', 'code'],
      additionalProperties: false,
    },
    handler: (args) => room(args),
  },
  {
    name: 'discover_more',
    description: 'parties, party (slug), party_listings (slug), price_guide (filters: q, brand, category, condition, size … — what matching items SOLD for), creator (handle), stream_auction (streamId: the auction live now — bid on its slug with the auction bid tool). buyer:catalog:read; stream_auction buyer:auctions:read.',
    inputSchema: {
      type: 'object',
      properties: {
        what: { type: 'string', enum: ['parties', 'party', 'party_listings', 'price_guide', 'creator', 'stream_auction'], description: 'parties = shopping parties; party = one party (slug); party_listings = listings shared to it, featured first (slug); price_guide = what matching items sold for (filters); creator = a creator storefront (handle); stream_auction = the auction live on a stream now (streamId).' },
        streamId: { type: 'string', description: 'stream_auction: the live stream id.' },
        slug: { type: 'string', description: 'party / party_listings: the party slug.' },
        handle: { type: 'string', description: "creator: the creator's handle." },
        filters: { type: 'object', description: 'price_guide: browse filters (q, brand, category, condition, size …); needs at least q, brand or category.' },
        limit: { type: 'number', description: 'party_listings: most listings to return.' },
      },
      required: ['what'],
      additionalProperties: false,
    },
    handler: (args) => discoverMore(args),
  },
  {
    name: 'delivery_info',
    description:
      'Where parcels go besides the door. pickup_points (zip, line1, city, state, country): UPS Access Points / FedEx Hold at Location '
      + 'near an address — pass one as pickupPoint to buy_listing. purchase (purchaseId): the point a purchase is held at, with its '
      + 'release code, or its ship-together consolidation. consolidations: the buyer\'s ship-together orders. buyer:catalog:read / buyer:orders:read.',
    inputSchema: {
      type: 'object',
      properties: {
        what: { type: 'string', enum: ['pickup_points', 'purchase', 'consolidations'], description: 'pickup_points = carrier pickup points near an address; purchase = where one purchase is held or consolidated (purchaseId); consolidations = your ship-together orders.' },
        zip: { type: 'string', description: 'pickup_points: postal code of the address to search near.' },
        line1: { type: 'string', description: 'pickup_points: street line of the address.' },
        city: { type: 'string', description: 'pickup_points: city of the address.' },
        state: { type: 'string', description: 'pickup_points: state / region code (e.g. CA).' },
        country: { type: 'string', description: 'pickup_points: ISO country code (e.g. US).' },
        purchaseId: { type: 'string', description: 'purchase: the purchase id.' },
      },
      required: ['what'],
      additionalProperties: false,
    },
    handler: (args) => delivery(args),
  },
  {
    name: 'market_orders',
    description:
      'The market: watches / watch (variantId, thresholdCents or any drop) / unwatch (id); bids / cancel_bid (id); bid places a FIXED-PRICE bid that SPENDS MONEY '
      + 'if it fills against an ask at or under priceCents (cents, integer), charging paymentMethodId. bid needs buyer:checkout:write, the key\'s '
      + 'spending controls, and an idempotencyKey.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['watches', 'watch', 'unwatch', 'bids', 'bid', 'cancel_bid'], description: 'watches = variants you watch; watch = alert on a variant (variantId, thresholdCents); unwatch (id); bids = your resting bids; bid = place a fixed-price bid that SPENDS when it fills; cancel_bid (id).' },
        id: { type: 'string', description: 'unwatch: the watch id; cancel_bid: the bid id.' },
        variantId: { type: 'string', description: 'watch / bid: the market variant id (uuid).' },
        condition: { type: 'string', description: 'watch / bid: the market condition book — DS (deadstock), VNDS (very near deadstock) or Used.' },
        thresholdCents: { type: 'number', description: 'watch: alert when an ask is at or under this, integer CENTS (e.g. 1999 = $19.99); omit to alert on any price drop.' },
        priceCents: { type: 'number', description: 'bid: your maximum price, integer CENTS (e.g. 1999 = $19.99), 100 to 100,000,000.' },
        paymentMethodId: { type: 'string', description: 'A saved card. Never card data.' },
        expiresInDays: { type: 'number', description: 'bid: days the bid rests before it expires, 1-60.' },
        deliverTo: { type: 'string', enum: ['home', 'vault'], description: 'bid: where it goes once it clears — home, or kept in your Crossly vault.' },
        fastShip: { type: 'boolean', description: 'bid: expedited shipping when it fills from vault stock (adds the premium from vault purchase_options).' },
        gradeWith: { type: 'object', properties: { runId: { type: 'string' }, returnMode: { type: 'string', enum: ['return', 'vault'] } }, required: ['runId'], description: 'bid: send a raw card to this Grading run first.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => market(args),
  },
  {
    name: 'vault',
    description: "Your Crossly vault (authenticated items stored for you): items lists them; sell lists one on the market at priceCents (it sells without shipping in); unlist takes it off; withdraw ships it home (speed standard|expedited) and CHARGES the shipping now (buyer:checkout:write + idempotencyKey); purchase_options (variantId, condition) says whether the lowest ask is vault stock, the fast-ship premium, and grading runs for a bid's gradeWith. Reading needs buyer:orders:read; sell/unlist buyer:offers:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['items', 'sell', 'unlist', 'withdraw', 'purchase_options'], description: 'items = your vaulted items; sell = list one on the market (id, priceCents); unlist = take it off the market (id); withdraw = ship it home and pay the shipping now (id, speed); purchase_options = vault stock / fast-ship / grading options for a variant (variantId, condition).' },
        id: { type: 'string', description: 'The vault item id (from items).' },
        priceCents: { type: 'number', description: 'sell: your asking price, integer CENTS (e.g. 1999 = $19.99), 100 to 100,000,000.' },
        expiresInDays: { type: 'number', description: 'sell: days the ask stays up, 1-60; omit for the default.' },
        speed: { type: 'string', enum: ['standard', 'expedited'], description: 'withdraw: standard (default) or expedited shipping; the shipping is charged now.' },
        variantId: { type: 'string', description: 'purchase_options: the market variant id (uuid).' },
        condition: { type: 'string', description: 'purchase_options: DS (deadstock, the default), VNDS (very near deadstock) or Used.' },
        idempotencyKey: { type: 'string', description: 'withdraw: sent as the Idempotency-Key header. Stable per intent so a retry cannot charge twice.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => vault(args),
  },
];
