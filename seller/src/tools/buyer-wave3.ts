import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Buyer wave 3: own-price match and price protection (buyer), and the
 * seller's own-price-match setting.
 *
 * Tools dispatch through functions declared above the array, so the
 * v1-parity scanner cannot cross GET / PUT actions.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function priceGuarantee(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string; orderId?: string };
  switch (a.action) {
    case 'price': return apiGet(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/price`);
    case 'protection': return apiGet(`/v1/buyer/orders/${need(a.orderId, "orderId")}/price-protection`);
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function ownPriceMatch(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; matchOwnPrices?: boolean; acceptsLayaway?: boolean };
  switch (a.action) {
    case 'get': return apiGet('/v1/pricing/settings');
    case 'layaways': return apiGet('/v1/layaways');
    case 'set': return apiPut('/v1/pricing/settings', { ...(a.matchOwnPrices !== undefined ? { matchOwnPrices: a.matchOwnPrices } : {}), ...(a.acceptsLayaway !== undefined ? { acceptsLayaway: a.acceptsLayaway } : {}) });
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function videoRequests(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string; note?: string };
  switch (a.action) {
    case 'request': return apiPost(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/video-requests`, { note: a.note });
    case 'for_listing': return apiGet(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/videos`);
    case 'mine': return apiGet('/v1/buyer/video-requests');
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function sellerVideoRequests(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; status?: string; videoUrl?: string; note?: string; fileName?: string; contentType?: string; contentLength?: number };
  switch (a.action) {
    case 'list': return apiGet('/v1/video-requests', { status: a.status ?? 'open' });
    case 'upload_url': return apiPost('/v1/video-requests/upload-url', { fileName: a.fileName, contentType: a.contentType, contentLength: a.contentLength });
    case 'answer': return apiPost(`/v1/video-requests/${need(a.id, "id")}/answer`, { videoUrl: a.videoUrl, note: a.note });
    case 'decline': return apiPost(`/v1/video-requests/${need(a.id, "id")}/decline`, { note: a.note });
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function registries(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; token?: string; q?: string; platformListingId?: string; giftId?: string; desired?: number; thanked?: boolean; title?: string; kind?: string; eventDate?: string; message?: string; shipAddressId?: string };
  const fields = { ...(a.title ? { title: a.title } : {}), ...(a.kind ? { kind: a.kind } : {}), ...(a.eventDate !== undefined ? { eventDate: a.eventDate } : {}), ...(a.message !== undefined ? { message: a.message } : {}), ...(a.shipAddressId !== undefined ? { shipAddressId: a.shipAddressId } : {}) };
  switch (a.action) {
    case 'list': return apiGet('/v1/buyer/registries');
    case 'create': return apiPost('/v1/buyer/registries', fields);
    case 'search': return apiGet('/v1/buyer/registries/search', { q: a.q ?? '' });
    case 'get': return apiGet(`/v1/buyer/registries/${need(a.id, "id")}`);
    case 'update': return apiPatch(`/v1/buyer/registries/${need(a.id, "id")}`, fields);
    case 'delete': return apiDelete(`/v1/buyer/registries/${need(a.id, "id")}`);
    case 'set_desired': return apiPut(`/v1/buyer/registries/${need(a.id, "id")}/items/${need(a.platformListingId, "platformListingId")}`, { desired: a.desired ?? 1 });
    case 'gifts': return apiGet(`/v1/buyer/registries/${need(a.id, "id")}/gifts`);
    case 'mark_thanked': return apiPost(`/v1/buyer/registries/${need(a.id, "id")}/gifts/${need(a.giftId, "giftId")}/thanked`, { thanked: a.thanked !== false });
    case 'view': return apiGet(`/v1/buyer/registry/${need(a.token, "token")}`);
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function layaways(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; amountCents?: number };
  switch (a.action) {
    case 'list': return apiGet('/v1/buyer/layaways');
    case 'get': return apiGet(`/v1/buyer/layaways/${need(a.id, "id")}`);
    case 'pay': return apiPost(`/v1/buyer/layaways/${need(a.id, "id")}/pay`, a.amountCents ? { amountCents: a.amountCents } : {});
    case 'cancel': return apiPost(`/v1/buyer/layaways/${need(a.id, "id")}/cancel`, {});
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function sizeMemory(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string; purchaseId?: string; fit?: string };
  switch (a.action) {
    case 'listing': return apiGet(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/my-size`);
    case 'prompts': return apiGet('/v1/buyer/size-memory/prompts');
    case 'answer': return apiPost(`/v1/buyer/purchases/${need(a.purchaseId, "purchaseId")}/fit`, { fit: a.fit });
    case 'sizes': return apiGet('/v1/buyer/size-memory/sizes');
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function rentals(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string; id?: string; startDate?: string; days?: number; addressId?: string; shipTo?: Record<string, unknown>; accept?: boolean; photos?: string[] };
  const body = { startDate: a.startDate, days: a.days, ...(a.addressId ? { addressId: a.addressId } : {}), ...(a.shipTo ? { shipTo: a.shipTo } : {}) };
  switch (a.action) {
    case 'offer': return apiGet(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/rental`);
    case 'quote': return apiPost(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/rental/quote`, body);
    case 'book': return apiPost(`/v1/buyer/catalog/listings/${need(a.slug, "slug")}/rental`, body);
    case 'mine': return apiGet('/v1/buyer/rentals');
    case 'cancel': return apiPost(`/v1/buyer/rentals/${need(a.id, "id")}/cancel`, {});
    case 'respond_to_claim': return apiPost(`/v1/buyer/rentals/${need(a.id, "id")}/claim-response`, { accept: a.accept === true });
    case 'eligibility': return apiGet('/v1/buyer/rentals/eligibility');
    case 'start_identity': return apiPost('/v1/buyer/rentals/identity/start', {});
    case 'arrival_photos': return apiPost(`/v1/buyer/rentals/${need(a.id, "id")}/arrival-photos`, { photos: a.photos ?? [] });
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function sellerRentals(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; platformListingId?: string; dailyCents?: number; weeklyCents?: number; depositCents?: number; minDays?: number; maxDays?: number; bufferDays?: number; rentOnly?: boolean; requireApproval?: boolean; cents?: number; note?: string; photos?: string[] };
  switch (a.action) {
    case 'list': return apiGet('/v1/rentals');
    case 'offers': return apiGet('/v1/rentals/offers');
    case 'set_offer': return apiPut(`/v1/rentals/offers/${need(a.platformListingId, "platformListingId")}`, { dailyCents: a.dailyCents, weeklyCents: a.weeklyCents ?? null, depositCents: a.depositCents ?? 0, minDays: a.minDays ?? 1, maxDays: a.maxDays ?? 30, bufferDays: a.bufferDays ?? 2, rentOnly: a.rentOnly ?? false, requireApproval: a.requireApproval ?? false });
    case 'remove_offer': return apiDelete(`/v1/rentals/offers/${need(a.platformListingId, "platformListingId")}`);
    case 'labels': return apiPost(`/v1/rentals/${need(a.id, "id")}/labels`, {});
    case 'shipped': return apiPost(`/v1/rentals/${need(a.id, "id")}/shipped`, { photos: a.photos ?? [] });
    case 'approve': return apiPost(`/v1/rentals/${need(a.id, "id")}/approve`, {});
    case 'decline': return apiPost(`/v1/rentals/${need(a.id, "id")}/decline`, {});
    case 'returned': return apiPost(`/v1/rentals/${need(a.id, "id")}/returned`, {});
    case 'cancel': return apiPost(`/v1/rentals/${need(a.id, "id")}/cancel`, {});
    case 'claim': return apiPost(`/v1/rentals/${need(a.id, "id")}/claim`, { cents: a.cents, note: a.note, ...(a.photos ? { photos: a.photos } : {}) });
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

export const buyerWave3Tools: ToolDef[] = [
  {
    name: 'price_guarantee',
    description: "Crossly's price guarantees, buyer side. price: today's price for a listing — when the seller has the same item live on another marketplace for less, Crossly charges that (priceMatch says which marketplace), and lowestAnywhere lists the marketplaces it is guaranteed not to be cheaper on; priceCheck rates the price against real sales of the same catalog item in the same condition over 180 days (verdict great / good / fair / high, medianCents and the middle-half lowCents–highCents range, all in CENTS; null until 3+ sales from 2+ sellers). protection: an order's price protection — if the item gets cheaper before `until`, the difference goes to the buyer's Bucks automatically; creditedCents is what it has paid so far. Needs buyer:catalog:read (price) or buyer:orders:read (protection).",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['price', 'protection'], description: 'price: a listing’s guaranteed price. protection: an order’s price protection.' },
        slug: { type: 'string', description: 'price: the listing slug, as in /shop/<slug>.' },
        orderId: { type: 'string', description: 'protection: the order (purchase) id.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => priceGuarantee(args),
  },
  {
    name: 'own_price_match',
    description: "The seller's selling options. matchOwnPrices (default on): an item the seller has live on another marketplace at a lower price sells on Crossly at that price, and buyers see 'Lowest price anywhere'; only dollar-priced copies are compared. acceptsLayaway (default on): buyers may put items on layaway. get reads both (listings:read); set changes either (listings:write); layaways lists the seller's items on layaway — never ship an active one (orders:read).",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'layaways'], description: 'get: read the settings. set: change them. layaways: my items on layaway.' },
        acceptsLayaway: { type: 'boolean', description: 'set: whether buyers may put your items on layaway.' },
        matchOwnPrices: { type: 'boolean', description: 'set: true to match your own lower prices (copies priced in US dollars are compared), false to keep the Crossly price.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => ownPriceMatch(args),
  },
  {
    name: 'video_requests',
    description: "Ask a seller for a video of an item, buyer side. request asks (one open request per item; an optional note says what to show); for_listing lists the clips the seller already recorded for that item, with the question each answers; mine lists the buyer's requests and their answers. Asking needs buyer:activity:write; reading buyer:catalog:read / buyer:activity:read.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['request', 'for_listing', 'mine'], description: 'request: ask for a video. for_listing: answered clips for an item. mine: my requests.' },
        slug: { type: 'string', description: 'request / for_listing: the listing slug, as in /shop/<slug>.' },
        note: { type: 'string', description: 'request: what you want to see, e.g. "the zipper working" (max 500 chars).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => videoRequests(args),
  },
  {
    name: 'seller_video_requests',
    description: "Buyers asking the seller for a video of an item. list shows requests (status open by default, or answered / declined / all); upload_url returns a presigned upload for the clip (PUT the file to uploadUrl with the same Content-Type and exact Content-Length); answer sends the clip (videoUrl = the publicUrl from upload_url) — the buyer is notified and it shows on the listing; decline closes a request with an optional note. Reading needs inbox:read, the rest inbox:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'upload_url', 'answer', 'decline'], description: 'Which video-request operation to run.' },
        id: { type: 'string', description: 'answer / decline: the request id (from list).' },
        status: { type: 'string', enum: ['open', 'answered', 'declined', 'all'], description: 'list: which requests (default open).' },
        fileName: { type: 'string', description: 'upload_url: the clip file name, e.g. clip.mp4.' },
        contentType: { type: 'string', description: 'upload_url: video/mp4, video/quicktime, video/webm or video/x-m4v.' },
        contentLength: { type: 'number', description: 'upload_url: the exact file size in bytes.' },
        videoUrl: { type: 'string', description: 'answer: the publicUrl returned by upload_url.' },
        note: { type: 'string', description: 'answer / decline: an optional note to the buyer.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => sellerVideoRequests(args),
  },
  {
    name: 'gift_registries',
    description: "Gift registries (wedding, baby, birthday, housewarming, graduation, other): a wishlist with an occasion, a date, how many of each item are wanted, and a hidden ship-to address. list / get / create / update / delete manage the buyer's own (shipAddressId must be one of their saved addresses — guests never see it); set_desired sets how many of an item are wanted (1–50); gifts is the thank-you list and mark_thanked ticks one; search finds someone's registry by its name or theirs; view shows a registry as a guest sees it, from its token. Items are added like any wishlist item (the registry's wishlistId). Reading needs buyer:wishlist:read (search/view buyer:catalog:read), changes buyer:wishlist:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'search', 'get', 'update', 'delete', 'set_desired', 'gifts', 'mark_thanked', 'view'], description: 'Which registry operation to run.' },
        id: { type: 'string', description: 'The registry id (from list), for get / update / delete / set_desired / gifts / mark_thanked.' },
        token: { type: 'string', description: 'view: the token in a registry link.' },
        q: { type: 'string', description: 'search: a registry title or the registrant’s name.' },
        title: { type: 'string', description: 'create / update: the registry name.' },
        kind: { type: 'string', enum: ['wedding', 'baby', 'birthday', 'housewarming', 'graduation', 'other'], description: 'create / update: the occasion.' },
        eventDate: { type: 'string', description: 'create / update: the date, YYYY-MM-DD (empty to clear).' },
        message: { type: 'string', description: 'create / update: a note to guests.' },
        shipAddressId: { type: 'string', description: 'create / update: one of your saved address ids — where guests’ gifts ship.' },
        platformListingId: { type: 'string', description: 'set_desired: the item’s platform listing id.' },
        desired: { type: 'number', description: 'set_desired: how many you want (1–50).' },
        giftId: { type: 'string', description: 'mark_thanked: the gift id from gifts.' },
        thanked: { type: 'boolean', description: 'mark_thanked: false to untick (default true).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => registries(args),
  },
  {
    name: 'layaways',
    description: "Layaway, buyer side: an item put on layaway at checkout (layawayItemIds) is paid as a deposit now and the rest in installments on the saved card; it ships when paid in full. list / get show the price, paid so far, what is left and the schedule; pay pays some (at least 100 cents) or all of the rest now (amountCents, in CENTS; omit for all); cancel refunds everything paid except the layaway fee (10% of the price, at most 1500 cents). Reading needs buyer:orders:read, pay/cancel buyer:orders:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'pay', 'cancel'], description: 'Which layaway operation to run.' },
        id: { type: 'string', description: 'get / pay / cancel: the layaway id (from list).' },
        amountCents: { type: 'number', description: 'pay: how much to pay now, in CENTS (at least 100). Omit to pay off the rest.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => layaways(args),
  },
  {
    name: 'size_memory',
    description: "The buyer's size memory, learned from what they bought and kept (fit_garments is the separate inch-by-inch measurement check). listing: this item against their size (yourSize and brandSize, verdict your_size / smaller / larger, a warning when this brand and size ran small or large on them, and brandRuns — how other buyers say the brand runs); null for an unsized item. prompts: delivered sized orders waiting on how they fit. answer: say how a purchase fit (true_to_size, small, large). sizes: the learned sizes by kind of item (shoes, tops, bottoms, dresses, outerwear). Reading needs buyer:catalog:read / buyer:orders:read; answer buyer:orders:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['listing', 'prompts', 'answer', 'sizes'], description: 'Which size-memory operation to run.' },
        slug: { type: 'string', description: 'listing: the listing slug, as in /shop/<slug>.' },
        purchaseId: { type: 'string', description: 'answer: the purchase (from prompts).' },
        fit: { type: 'string', enum: ['true_to_size', 'small', 'large'], description: 'answer: how it fit.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => sizeMemory(args),
  },
  {
    name: 'rentals',
    description: "Rent instead of buy. offer shows whether a listing is for rent (day/week rates and deposit in CENTS, length limits, booked dates); quote prices dates (rent, both shipping legs once shipTo or addressId is given, deposit); book returns a Stripe PaymentIntent client secret to confirm (the dates are held 30 minutes); mine lists the buyer's rentals with the return label; cancel calls off one that has not shipped (full refund); respond_to_claim accepts or disputes a deposit claim; eligibility says whether the buyer can rent (renting needs an ID check — photo ID + selfie — and ships only to the name on the ID; one rental at a time until the first comes back); start_identity begins that check; arrival_photos records its condition on arrival. Reading needs buyer:catalog:read / buyer:orders:read; book buyer:checkout:write; cancel and respond buyer:orders:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['offer', 'quote', 'book', 'mine', 'cancel', 'respond_to_claim', 'eligibility', 'start_identity', 'arrival_photos'], description: 'Which rental operation to run.' },
        photos: { type: 'array', items: { type: 'string' }, description: 'arrival_photos: photo URLs you uploaded of its condition on arrival.' },
        slug: { type: 'string', description: 'offer / quote / book: the listing slug, as in /shop/<slug>.' },
        id: { type: 'string', description: 'cancel / respond_to_claim: the rental id (from mine).' },
        startDate: { type: 'string', description: 'quote / book: the first day, YYYY-MM-DD.' },
        days: { type: 'number', description: 'quote / book: how many days.' },
        addressId: { type: 'string', description: 'quote / book: one of the buyer’s saved address ids to ship to.' },
        shipTo: { type: 'object', description: 'quote / book: an address { name, street1, street2?, city, state, zip, country?, phone? } instead of addressId.' },
        accept: { type: 'boolean', description: 'respond_to_claim: true accepts the claim, false disputes it (Crossly decides).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => rentals(args),
  },
  {
    name: 'seller_rentals',
    description: "Rent your Crossly listings out. offers / set_offer / remove_offer manage what is for rent (dailyCents, optional weeklyCents and depositCents all in CENTS; minDays, maxDays, bufferDays of turnaround either side; rentOnly takes it off sale on Crossly while offered; needs a ship-from address). list shows bookings with the ship-to. Renters are ID-verified and it ships only to the name on their ID; with requireApproval a booking arrives as requested and approve charges the held card (decline releases it). A booking runs: labels (buys the outbound and return labels) → shipped (with at least 2 condition photos) → returned → claim (part or all of the deposit in CENTS, with a note, within 3 days of the return, or 14 days after the end if it never came back); cancel refunds a booking that has not shipped. Offers need listings:*, bookings orders:*.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'offers', 'set_offer', 'remove_offer', 'labels', 'shipped', 'returned', 'cancel', 'claim', 'approve', 'decline'], description: 'Which seller rental operation to run.' },
        requireApproval: { type: 'boolean', description: 'set_offer: approve each booking yourself (the card is only held until you do; 24h to decide).' },
        id: { type: 'string', description: 'labels / shipped / returned / cancel / claim: the rental id (from list).' },
        platformListingId: { type: 'string', description: 'set_offer / remove_offer: the Crossly platform listing id.' },
        dailyCents: { type: 'number', description: 'set_offer: the day rate, in CENTS (at least 100).' },
        weeklyCents: { type: 'number', description: 'set_offer: an optional week rate, in CENTS.' },
        depositCents: { type: 'number', description: 'set_offer: the refundable deposit, in CENTS.' },
        minDays: { type: 'number', description: 'set_offer: the shortest rental, days.' },
        maxDays: { type: 'number', description: 'set_offer: the longest rental, days (max 90).' },
        bufferDays: { type: 'number', description: 'set_offer: turnaround days either side of a booking (0–14).' },
        rentOnly: { type: 'boolean', description: 'set_offer: take it off sale on Crossly while offered.' },
        cents: { type: 'number', description: 'claim: how much of the deposit, in CENTS.' },
        note: { type: 'string', description: 'claim: what the claim is for.' },
        photos: { type: 'array', items: { type: 'string' }, description: 'shipped: at least 2 photo URLs of its condition as it leaves; claim: photo URLs of the damage (required unless it never came back).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => sellerRentals(args),
  },
];
