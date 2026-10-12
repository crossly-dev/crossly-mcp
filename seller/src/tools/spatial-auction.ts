import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * The live auction house inside a spatial room.
 *
 * As with the spatial tools, the descriptions spend their words on how to READ
 * the result — but here there is a second reason, and it is sharper. This is
 * the one spatial surface an agent can SPEND on, against a human auctioneer
 * who moves faster than a poll interval. The two ways a model loses money here
 * are computing its own minimum bid (the opening bid on a lot is floored at
 * the START price, not start + step) and bidding on a lot the auctioneer has
 * already left. Both are addressed in the prose below rather than left to be
 * inferred from field names, because a model infers confidently.
 */
const SCENE_ID_PROP = {
  type: 'string',
  description:
    'The room\'s scene id, from list_spatial_auction_rooms or from '
    + 'get_public_spatial_auction. NOT a public slug and NOT a session id — the three are '
    + 'different identifiers and do not substitute for one another.',
} as const;

export const spatialAuctionTools: ToolDef[] = [
  {
    name: 'list_spatial_auction_rooms',
    description:
      'Rooms this seller OWNS that are currently hosting a live auction, with the session\'s '
      + 'title, status and schedule joined in. An empty list means they are hosting nothing — '
      + 'which is the ordinary state of every room on the platform, NOT a sign the feature is '
      + 'unavailable. This is not a directory of salerooms to bid in: for somebody else\'s '
      + 'room, take a publicSlug from list_public_spatial_scenes and open it with '
      + 'get_public_spatial_auction. `topics.auction` is the WebSocket topic price movements '
      + 'are broadcast on; `topics.room` is null until the room has been shared publicly.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/spatial/auction/rooms'),
  },
  {
    name: 'get_spatial_auction_room',
    description:
      'What the rostrum says in one room RIGHT NOW: the session, the lot currently up, the '
      + 'standing price, and the minimum the next bid must clear. '
      + 'HOW TO READ IT: every amount is CENTS. Use `currentLot.minimumNextBidCents` as the '
      + 'bid floor — never compute currentBidCents + bidIncrementCents, because the OPENING '
      + 'bid on a lot is floored at the start price rather than start + step, so your own '
      + 'arithmetic silently raises the entry price on any lot with a real increment and the '
      + 'bid is then refused. `reserveMet` says whether the seller\'s floor has been cleared; '
      + 'the floor itself is never published, and there is no way to find it — a crowd that '
      + 'can read the reserve bids to it and stops. '
      + '`serverTime` is the SERVER\'s clock, given to you because there is no per-lot '
      + 'deadline: a lot closes when a human drops the hammer, not when a timer runs out, so '
      + 'any countdown you render is a guess. Age the session against serverTime rather than '
      + 'your own. '
      + '`hosting: false` with a null `auction` is a described empty answer, not an error. A '
      + 'room this account may not enter answers 404, exactly as a room that does not exist '
      + 'does — do not read a 404 as proof the room is gone.',
    inputSchema: {
      type: 'object',
      properties: { sceneId: SCENE_ID_PROP },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/spatial/auction/rooms/${encodeURIComponent(args.sceneId as string)}`),
  },
  {
    name: 'list_spatial_auction_lots',
    description:
      'The catalogue: every lot in the session a room is hosting, in the order the auctioneer '
      + 'will reach them. Each row carries the same fields as the current lot, all amounts in '
      + 'CENTS, with `minimumNextBidCents` being the figure the bid transaction itself '
      + 'evaluates against. '
      + 'DO NOT INFER WHICH LOT IS UP FROM THIS LIST. A human auctioneer can skip ahead, so '
      + 'the lowest lot with no hammerAt is frequently not the one taking bids; '
      + 'get_spatial_auction_room is the only authority on that. '
      + 'A lot carrying a `hammerAt` has been SOLD; one with `skipped: true` failed its '
      + 'reserve. Neither takes further bids. The reserve AMOUNT is absent by design. '
      + 'A room hosting nothing answers an empty list rather than a 404 — a 404 here means '
      + 'the room does not exist or this account may not enter it.',
    inputSchema: {
      type: 'object',
      properties: { sceneId: SCENE_ID_PROP },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/spatial/auction/rooms/${encodeURIComponent(args.sceneId as string)}/lots`),
  },
  {
    name: 'get_public_spatial_auction',
    description:
      'Open somebody else\'s saleroom by its public share handle, and get back the sceneId '
      + 'every other tool here needs. This is the bridge between the two identifier spaces: '
      + 'list_public_spatial_scenes hands out SLUGS, while the room, lots and bid tools are '
      + 'keyed by scene id, and they are not interchangeable. '
      + 'Resolves rooms shared as `public` ONLY. An `unlisted` room is a bearer link and '
      + 'crowd-shaped features stay switched off in those, so a slug that works with '
      + 'get_public_spatial_scene may still answer 404 here — that is the room\'s owner '
      + 'choosing, not a fault. Same reading rules as get_spatial_auction_room: amounts in '
      + 'CENTS, minimumNextBidCents rather than your own arithmetic, no reserve amount.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'The room\'s public share handle (its `publicSlug`), not a scene id and not a '
            + 'session id.',
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/spatial/auction/public/${encodeURIComponent(args.slug as string)}`),
  },
  {
    name: 'place_spatial_auction_bid',
    description:
      'Bid on the lot currently up in a spatial auction room. THIS COMMITS THE USER TO BUY at '
      + 'the amount you name if the auctioneer hammers it — read get_spatial_auction_room '
      + 'immediately beforehand, because the price moves while you think. '
      + 'SUCCESS MEANS THE BID WAS RECORDED, NOT THAT IT WON. Somebody may outbid it on the '
      + 'very next frame; the lot is theirs only once the auctioneer hammers. Never report a '
      + '2xx here as having bought anything. '
      + 'DIGITAL GOODS ONLY. A physical lot is refused 403 with '
      + 'details.reason = "physical_lot", checked against the listing on every single bid — '
      + 'this saleroom has no shipping, escrow or dispute path behind it, so that refusal is '
      + 'never retryable and never a transient error. Physical goods sell for cash or CBX '
      + 'through the ordinary listing flow. '
      + 'THE REFUSALS: 400 `bid_too_low` carries details.minimumNextBidCents — retry at '
      + 'exactly that number, do not add a step of your own. 409 `lot_closed` means hammered '
      + 'or skipped; a different 409 means the auctioneer moved on from the lotId you named, '
      + 'and the reply says which lot is actually up. 429 `bidding_too_fast` throttles one '
      + 'bidder on one lot so a script cannot serialise the room behind its own row lock — '
      + 'wait retryInSeconds; the limit is counted per PERSON from the recorded bids, so '
      + 'switching tools or surfaces does not raise it. 404 means no such room OR no '
      + 'permission to enter it, deliberately one answer.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: SCENE_ID_PROP,
        amountCents: {
          type: 'integer',
          minimum: 1,
          description:
            'The bid, in CENTS (integer) — 7500 is $75.00, never 75. Must be at least the '
            + 'room\'s `currentLot.minimumNextBidCents`; do NOT derive that figure by adding '
            + 'bidIncrementCents to currentBidCents, because the opening bid on a lot is '
            + 'floored at the START price instead, and the two differ on every lot that '
            + 'carries a real increment.',
        },
        lotId: {
          type: 'string',
          description:
            'Optional, and worth sending whenever your idea of the current lot came from '
            + 'anywhere but a fresh get_spatial_auction_room. It is CHECKED against the '
            + 'rostrum rather than used in its place, so a stale value is refused with 409 '
            + 'instead of placing a real bid on an item the user never looked at.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['sceneId', 'amountCents'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/spatial/auction/rooms/${encodeURIComponent(args.sceneId as string)}/bid`,
        {
          amountCents: args.amountCents,
          ...(typeof args.lotId === 'string' ? { lotId: args.lotId } : {}),
        },
        args.idempotencyKey as string | undefined,
      ),
  },
];
