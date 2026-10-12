import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Buyer lists and discovery — saved for later, combined-total requests,
 * wishlist management, recently viewed, followed sellers, and browsing with
 * the shop's own filters.
 *
 * Needs a BUYER token (`crossly_oat_…`, scoped `buyer:*`).
 *
 * Tools whose actions use DIFFERENT HTTP methods dispatch through functions
 * declared above the array, so the v1-parity scanner (which pairs every verb
 * and path inside one handler) cannot cross them.
 */

const enc = encodeURIComponent;

function savedForLater(args: Record<string, unknown>): Promise<unknown> {
  const { action, id } = args as { action: 'list' | 'save' | 'move_to_cart' | 'remove'; id?: string };
  if (action === 'list') return apiGet('/v1/buyer/cart/saved');
  if (!id) return Promise.reject(new Error('id is required for this action'));
  if (action === 'save') return apiPost(`/v1/buyer/cart/items/${enc(id)}/save-for-later`, undefined);
  if (action === 'move_to_cart') return apiPost(`/v1/buyer/cart/saved/${enc(id)}/move-to-cart`, undefined);
  return apiDelete(`/v1/buyer/cart/saved/${enc(id)}`);
}

function totalRequests(args: Record<string, unknown>): Promise<unknown> {
  const { action, id, sellerUserId, message } = args as {
    action: 'list' | 'request' | 'cancel';
    id?: string;
    sellerUserId?: string;
    message?: string;
  };
  if (action === 'list') return apiGet('/v1/buyer/total-requests');
  if (action === 'request') return apiPost('/v1/buyer/total-requests', { sellerUserId, ...(message ? { message } : {}) });
  if (!id) return Promise.reject(new Error('id is required to cancel'));
  return apiDelete(`/v1/buyer/total-requests/${enc(id)}`);
}

function manageWishlist(args: Record<string, unknown>): Promise<unknown> {
  const { id, action, name, isPublic, slug, resetLink } = args as {
    id: string;
    action: 'rename' | 'set_public' | 'share' | 'remove_item' | 'delete';
    name?: string;
    isPublic?: boolean;
    slug?: string;
    resetLink?: boolean;
  };
  if (action === 'rename') return apiPatch(`/v1/buyer/wishlists/${enc(id)}`, { name });
  if (action === 'set_public') return apiPatch(`/v1/buyer/wishlists/${enc(id)}`, { isPublic });
  if (action === 'share') return apiPost(`/v1/buyer/wishlists/${enc(id)}/share`, resetLink ? { resetLink: true } : {});
  if (action === 'remove_item') {
    if (!slug) return Promise.reject(new Error('slug is required to remove an item'));
    return apiDelete(`/v1/buyer/wishlists/${enc(id)}/items/${enc(slug)}`);
  }
  return apiDelete(`/v1/buyer/wishlists/${enc(id)}`);
}

function followedSellers(args: Record<string, unknown>): Promise<unknown> {
  const { action, sellerUserId } = args as { action: 'list' | 'mark_seen'; sellerUserId?: string };
  if (action === 'list') return apiGet('/v1/buyer/following/sellers');
  return apiPost('/v1/buyer/following/sellers/seen', sellerUserId ? { sellerUserId } : {});
}

export const buyerListTools: ToolDef[] = [
  {
    name: 'saved_for_later',
    description:
      'The buyer\'s saved-for-later list, parked out of the cart. list; save = move a CART LINE here (id = cart '
      + 'item id); move_to_cart = put a saved item back at TODAY\'s price (refused if it sold); remove. Every '
      + 'action returns the resulting saved list. Requires buyer:cart:read (list) or buyer:cart:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'save', 'move_to_cart', 'remove'],
          description: 'list = read; save = cart line to saved; move_to_cart = saved item to cart; remove = drop it.',
        },
        id: {
          type: 'string',
          description: 'For save: the cart item id. For move_to_cart / remove: the saved item id.',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => savedForLater(args),
  },

  {
    name: 'combined_total_requests',
    description:
      'Ask a seller for ONE combined shipping total on every item of theirs in the cart (eBay\'s "request total"). '
      + 'request needs two or more of that seller\'s items in the cart and spends nothing; the quote applies at '
      + 'checkout on Crossly while `matchesCart` is true. list; request; cancel. '
      + 'Requires buyer:cart:read (list) or buyer:cart:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'request', 'cancel'],
          description: 'list = newest request per seller; request = ask a seller; cancel = withdraw a request.',
        },
        sellerUserId: { type: 'string', description: 'For request: the seller, from a cart line.' },
        message: { type: 'string', description: 'For request: optional note to the seller, up to 500 characters.' },
        id: { type: 'string', description: 'For cancel: the request id.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => totalRequests(args),
  },

  {
    name: 'manage_wishlist',
    description:
      'Manage one wishlist. rename (name); set_public (isPublic — false stops the share link working); share = '
      + 'make it public and return its link (resetLink: true issues a new link and kills the old one); '
      + 'remove_item (slug); delete = the list and everything on it. Creating lists and adding items are separate '
      + '(the buyer MCP server\'s create_my_wishlist / add_to_my_wishlist). Requires buyer:wishlist:write.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Wishlist id.' },
        action: {
          type: 'string',
          enum: ['rename', 'set_public', 'share', 'remove_item', 'delete'],
          description: 'What to do to the list; see the tool description for each.',
        },
        name: { type: 'string', description: 'For rename: the new name, 1-120 characters.' },
        isPublic: { type: 'boolean', description: 'For set_public: true lets the share link open the list.' },
        slug: { type: 'string', description: 'For remove_item: the listing slug.' },
        resetLink: { type: 'boolean', description: 'For share: replace the link; the old one stops working.' },
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => manageWishlist(args),
  },

  {
    name: 'clear_recently_viewed',
    description:
      'Remove one listing from the buyer\'s recently viewed (pass slug), or clear the whole list (omit it). '
      + 'Viewing the item again brings it back; sellers\' view counts are unaffected. Requires buyer:history:write.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'One listing to remove. Omit to clear everything.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug?: string };
      return slug ? apiDelete(`/v1/buyer/recently-viewed/${enc(slug)}`) : apiDelete('/v1/buyer/recently-viewed');
    },
  },

  {
    name: 'followed_sellers',
    description:
      'Sellers the buyer follows. list: each with `newListings` since they last looked. mark_seen: clear that '
      + 'count for one seller (sellerUserId) or all of them. Requires buyer:follows:read (list) or buyer:follows:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'mark_seen'],
          description: 'list = read with new counts; mark_seen = clear the new count.',
        },
        sellerUserId: { type: 'string', description: 'For mark_seen: one seller. Omit to mark all seen.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => followedSellers(args),
  },

  {
    name: 'browse_catalog',
    description:
      'Browse the way the shop does, with eBay\'s filters: buying format, returns accepted, size, colour, SOLD '
      + 'items, Best Match. Page-numbered, capped at 50 pages of up to 60 — to walk the whole catalogue use '
      + 'search_catalog, which pages by cursor. With sold: true the rows are recent sales (90 days) carrying '
      + 'soldPriceCents and soldAt. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Free text; every word must appear in the title or brand.' },
        brand: { type: 'string', description: 'Exact brand, case-insensitive.' },
        condition: { type: 'string', description: 'Exact condition, e.g. new, like_new, good.' },
        category: { type: 'string', description: 'Category slug.' },
        subcategory: { type: 'string', description: 'Subcategory slug.' },
        size: { type: 'string', description: 'Exact size, case-insensitive (M does not match XL).' },
        color: { type: 'string', description: 'Exact colour, case-insensitive.' },
        format: {
          type: 'string',
          enum: ['auction', 'buy_it_now', 'offers'],
          description: 'auction = live auctions; buy_it_now = fixed price; offers = accepts offers.',
        },
        returns: { type: 'boolean', description: 'true = only listings that accept returns.' },
        freeShipping: { type: 'boolean', description: 'true = only free shipping.' },
        localPickup: { type: 'boolean', description: 'true = only listings offering local pickup.' },
        deals: { type: 'boolean', description: 'true = only items marked down from a higher price.' },
        sold: { type: 'boolean', description: 'true = recent sales instead of live listings.' },
        shipsTo: {
          type: 'string',
          description:
            'ISO 3166-1 alpha-2 destination country (e.g. GB) - only listings whose seller ships there. '
            + 'Omit (or "any") for no destination filter.',
        },
        minPriceCents: { type: 'integer', description: 'Lowest price in CENTS (integer) - 2500 is $25.00.' },
        maxPriceCents: { type: 'integer', description: 'Highest price in CENTS (integer) - 9999 is $99.99.' },
        sort: {
          type: 'string',
          enum: ['best_match', 'newest', 'price_low', 'price_high', 'popular', 'ending_soon'],
          description: 'Default best_match with q, newest without. ending_soon is for auctions.',
        },
        page: { type: 'integer', description: '1-50.' },
        limit: { type: 'integer', description: '1-60, default 24.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const query: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null) query[k] = typeof v === 'boolean' ? String(v) : v;
      }
      return apiGet('/v1/buyer/catalog/browse', query);
    },
  },

  {
    name: 'search_sellers',
    description:
      'Find a seller by shop handle or shop name (at least two characters). Only shops that have listed on '
      + 'Crossly. Exact matches first, then prefix, then by live listings. Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Two or more characters of a handle or shop name.' },
        limit: { type: 'integer', description: '1-30, default 12.' },
      },
      required: ['q'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/buyer/catalog/sellers', args as Record<string, unknown>),
  },

  {
    name: 'get_listing_sold_history',
    description:
      'What THIS listing has sold for, newest first (last 50), with meta.medianCents. Per-unit item price in '
      + 'cents, excluding shipping and tax. This listing only — never "similar items". Requires buyer:catalog:read.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The listing slug.' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/buyer/catalog/listings/${enc(slug)}/sold-history`);
    },
  },
];
