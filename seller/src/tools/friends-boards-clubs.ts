import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Buyer parity W8b: friends in chats and shared wishlists, outfit boards,
 * shop-the-look tags, and sellers' loyalty clubs — buyer tools plus the
 * seller's loyalty-club and hotspot tools.
 *
 * Tools dispatch through functions declared above the array, so the
 * v1-parity scanner cannot cross GET / POST / PUT / DELETE actions.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function friends(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; conversationId?: string; wishlistId?: string; token?: string; userId?: string };
  switch (a.action) {
    case 'invite_to_chat': return apiPost(`/v1/buyer/conversations/${need(a.conversationId, "conversationId")}/invite`, {});
    case 'join_chat': return apiPost(`/v1/buyer/conversations/join/${need(a.token, "token")}`, {});
    case 'chat_guests': return apiGet(`/v1/buyer/conversations/${need(a.conversationId, "conversationId")}/guests`);
    case 'remove_chat_guest': return apiDelete(`/v1/buyer/conversations/${need(a.conversationId, "conversationId")}/guests/${need(a.userId, "userId")}`);
    case 'invite_to_wishlist': return apiPost(`/v1/buyer/wishlists/${need(a.wishlistId, "wishlistId")}/invite`, {});
    case 'join_wishlist': return apiPost(`/v1/buyer/wishlists/join/${need(a.token, "token")}`, {});
    case 'wishlist_members': return apiGet(`/v1/buyer/wishlists/${need(a.wishlistId, "wishlistId")}/members`);
    case 'remove_wishlist_member': return apiDelete(`/v1/buyer/wishlists/${need(a.wishlistId, "wishlistId")}/members/${need(a.userId, "userId")}`);
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function boards(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; token?: string; slug?: string; platformListingId?: string; title?: string; description?: string; isPublic?: boolean; items?: unknown[] };
  switch (a.action) {
    case 'list': return apiGet('/v1/buyer/boards');
    case 'get': return apiGet(`/v1/buyer/boards/${need(a.id, "id")}`);
    case 'shared': return apiGet(`/v1/buyer/boards/shared/${need(a.token, "token")}`);
    case 'create': return apiPost('/v1/buyer/boards', { title: a.title ?? 'My board', ...(a.description ? { description: a.description } : {}), ...(a.isPublic !== undefined ? { isPublic: a.isPublic } : {}) });
    case 'update': return apiPatch(`/v1/buyer/boards/${need(a.id, "id")}`, { ...(a.title ? { title: a.title } : {}), ...(a.description !== undefined ? { description: a.description } : {}), ...(a.isPublic !== undefined ? { isPublic: a.isPublic } : {}) });
    case 'add': return apiPost(`/v1/buyer/boards/${need(a.id, "id")}/items`, { slug: a.slug });
    case 'remove': return apiDelete(`/v1/buyer/boards/${need(a.id, "id")}/items/${need(a.platformListingId, "platformListingId")}`);
    case 'save_layout': return apiPut(`/v1/buyer/boards/${need(a.id, "id")}/layout`, { items: a.items ?? [] });
    case 'delete': return apiDelete(`/v1/buyer/boards/${need(a.id, "id")}`);
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function clubs(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; sellerUserId?: string };
  switch (a.action) {
    case 'mine': return apiGet('/v1/buyer/clubs');
    case 'for_seller': return apiGet(`/v1/buyer/sellers/${need(a.sellerUserId, "sellerUserId")}/club`);
    case 'join': return apiPost(`/v1/buyer/sellers/${need(a.sellerUserId, "sellerUserId")}/club/join`, {});
    case 'leave': return apiDelete(`/v1/buyer/sellers/${need(a.sellerUserId, "sellerUserId")}/club/join`);
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function sellerLoyalty(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; name?: string; description?: string; active?: boolean; tiers?: unknown[] };
  if (a.action === 'save') return apiPut('/v1/loyalty/club', { name: a.name, ...(a.description ? { description: a.description } : {}), ...(a.active !== undefined ? { active: a.active } : {}), tiers: a.tiers ?? [] });
  if (a.action === 'members') return apiGet('/v1/loyalty/members');
  return apiGet('/v1/loyalty/club');
}

function looks(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; targetType?: string; targetId?: string; spots?: unknown[] };
  if (a.action === 'set') return apiPut('/v1/hotspots', { targetType: a.targetType, targetId: a.targetId, spots: a.spots ?? [] });
  return apiGet('/v1/buyer/hotspots', { targetType: a.targetType, targetId: a.targetId });
}

const TARGET = { type: 'string', enum: ['story', 'story_v1', 'collection'], description: 'story: a seller story; story_v1: an older single-listing story; collection: a lookbook collection (its cover photo).' };

export const friendsBoardsClubsTools: ToolDef[] = [
  {
    name: 'shop_with_friends',
    description: "Bring friends in: invite_to_chat makes a single-use link (7 days) that adds a friend to a buyer–seller chat as a guest who can read and post (the thread's buyer only, max 5); join_chat accepts one; chat_guests lists guests; remove_chat_guest removes one (or leave with your own user id). invite_to_wishlist makes a co-editor link (14 days, max 20 members); join_wishlist accepts; wishlist_members lists; remove_wishlist_member removes or leaves. Chats need buyer:activity:*, wishlists buyer:wishlist:*.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['invite_to_chat', 'join_chat', 'chat_guests', 'remove_chat_guest', 'invite_to_wishlist', 'join_wishlist', 'wishlist_members', 'remove_wishlist_member'], description: 'What to do: invite to / join / list / remove from a chat or a shared wishlist.' },
        conversationId: { type: 'string', description: 'The chat (conversation) id, for the chat actions.' },
        wishlistId: { type: 'string', description: 'The wishlist id, for the wishlist actions.' },
        token: { type: 'string', description: 'join_chat / join_wishlist: the token from the invite link.' },
        userId: { type: 'string', description: 'remove_*: the guest or member to remove — your own id to leave.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => friends(args),
  },
  {
    name: 'outfit_boards',
    description: "The buyer's outfit boards — collages of listings, shareable by link. list / get / shared (by token) read boards; create makes one; update renames it or changes its description / shareable (isPublic) setting; add puts a listing (slug) at the next spot; remove takes one off; save_layout replaces the layout (items with platformListingId or slug, x, y, w as fractions 0–1 of the board, z stacking order; max 40); delete removes the board. Reading needs buyer:wishlist:read, editing buyer:wishlist:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'shared', 'create', 'update', 'add', 'remove', 'save_layout', 'delete'], description: 'Which board operation to run.' },
        id: { type: 'string', description: 'The board id (from list), for get / add / remove / save_layout / delete.' },
        token: { type: 'string', description: 'shared: the token in a board share link.' },
        slug: { type: 'string', description: 'add: the listing slug, as in /shop/<slug>.' },
        platformListingId: { type: 'string', description: 'remove: the platform listing id of the item to take off.' },
        title: { type: 'string', description: 'create: the board title.' },
        description: { type: 'string', description: 'create: an optional description.' },
        isPublic: { type: 'boolean', description: 'create: whether its share link works for others (default true).' },
        items: { type: 'array', items: { type: 'object' }, description: 'save_layout: [{ platformListingId (or slug), x, y, w, z, note? }] with x, y, w as fractions of the board.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => boards(args),
  },
  {
    name: 'loyalty_clubs',
    description: "Sellers' loyalty clubs, buyer side: mine lists the clubs the buyer belongs to with their spend, tier, discount and the next tier; for_seller shows one seller's club and tiers; join joins (free) — the tier discount then applies to that seller's items as the best of any rate the buyer has with them, never stacked; leave leaves. Needs buyer:follows:* (or buyer:catalog:read for for_seller).",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['mine', 'for_seller', 'join', 'leave'], description: 'mine: my clubs. for_seller: a seller’s club. join / leave: membership.' },
        sellerUserId: { type: 'string', description: 'for_seller / join / leave: the seller’s user id.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => clubs(args),
  },
  {
    name: 'seller_loyalty_club',
    description: "Seller: your loyalty club. get shows it with members per tier; save creates or replaces it — name, active, and up to 6 tiers each with minSpendCents (spend with you, in cents) and discountBps (basis points, max 3000 = 30%) and perks; members lists members by spend. Needs customers:read / customers:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'save', 'members'], description: 'get: the club. save: create or update it. members: who is in it.' },
        name: { type: 'string', description: 'save: the club name.' },
        description: { type: 'string', description: 'save: what members get.' },
        active: { type: 'boolean', description: 'save: whether buyers can join and discounts apply.' },
        tiers: { type: 'array', items: { type: 'object' }, description: 'save: [{ name, minSpendCents (cents), discountBps (basis points, ≤3000), perks? }].' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => sellerLoyalty(args),
  },
  {
    name: 'shop_the_look',
    description: "Shop-the-look tags on story and lookbook photos. get (buyer) lists the listings tagged on a photo and where (x, y as fractions of the image); set (seller) replaces your tags on your own story or collection photo with up to 12 of your Crossly listings. get needs buyer:catalog:read, set listings:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set'], description: 'get: read a photo’s tags. set: replace your tags on your photo.' },
        targetType: TARGET,
        targetId: { type: 'string', description: 'The story or collection id.' },
        spots: { type: 'array', items: { type: 'object' }, description: 'set: [{ platformListingId, x, y (fractions 0–1), label? }].' },
      },
      required: ['action', 'targetType', 'targetId'],
      additionalProperties: false,
    },
    handler: (args) => looks(args),
  },
];
