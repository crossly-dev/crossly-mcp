/**
 * The buyer offers / auctions / orders / lists tools dispatch each action to
 * the right /v1 verb and path. A grouped tool is one place a wrong branch can
 * hide — "withdraw" posting to /respond would be a silent no-op for the agent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: vi.mock is lifted above every declaration, so the store it
// writes to has to be created by the same hoisting.
const calls = vi.hoisted(
  () => [] as Array<{ verb: string; path: string; body?: unknown; key?: unknown; query?: unknown }>,
);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => {
    calls.push({ verb: 'GET', path, query });
    return {};
  }),
  apiPost: vi.fn(async (path: string, body: unknown, key?: string) => {
    calls.push({ verb: 'POST', path, body, key });
    return {};
  }),
  apiPatch: vi.fn(async (path: string, body: unknown) => {
    calls.push({ verb: 'PATCH', path, body });
    return {};
  }),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async (path: string, key?: string) => {
    calls.push({ verb: 'DELETE', path, key });
    return {};
  }),
}));

const { buyerCommerceTools } = await import('../tools/buyer-commerce.js');
const { buyerOrderTools } = await import('../tools/buyer-orders.js');
const { buyerListTools } = await import('../tools/buyer-lists.js');

const all = [...buyerCommerceTools, ...buyerOrderTools, ...buyerListTools];
const run = (name: string, args: Record<string, unknown>) => {
  const tool = all.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.handler(args);
};
const last = () => calls[calls.length - 1]!;
const route = () => `${last().verb} ${last().path}`;

beforeEach(() => {
  calls.length = 0;
});

describe('offers and auctions', () => {
  it('answer_my_offer: withdraw is a DELETE, the rest POST /respond', async () => {
    await run('answer_my_offer', { id: 'o1', action: 'withdraw' });
    expect(route()).toBe('DELETE /v1/buyer/offers/o1');
    await run('answer_my_offer', { id: 'o1', action: 'counter', counterCents: 4500, idempotencyKey: 'k' });
    expect(last()).toMatchObject({ verb: 'POST', path: '/v1/buyer/offers/o1/respond', body: { action: 'counter', counterCents: 4500 }, key: 'k' });
    await run('answer_my_offer', { id: 'o1', action: 'accept' });
    expect(last().body).toEqual({ action: 'accept' });
  });

  it('bid_on_auction carries the idempotency key out of the body', async () => {
    await run('bid_on_auction', { slug: 'lot', amountCents: 1500, maxBidCents: 4000, idempotencyKey: 'bid-lot' });
    expect(last()).toMatchObject({
      verb: 'POST',
      path: '/v1/buyer/auctions/lot/bids',
      body: { amountCents: 1500, maxBidCents: 4000 },
      key: 'bid-lot',
    });
  });

  it('get_auction_activity and manage_auction_bid pick the right path', async () => {
    await run('get_auction_activity', { slug: 'lot', view: 'bids' });
    expect(route()).toBe('GET /v1/buyer/auctions/lot/bids');
    await run('get_auction_activity', { slug: 'lot', view: 'me' });
    expect(route()).toBe('GET /v1/buyer/auctions/lot/me');
    await run('manage_auction_bid', { slug: 'lot', action: 'retract', reason: 'typo' });
    expect(last()).toMatchObject({ path: '/v1/buyer/auctions/lot/retract', body: { reason: 'typo' } });
    await run('manage_auction_bid', { slug: 'lot', action: 'pay' });
    expect(route()).toBe('POST /v1/buyer/auctions/lot/pay');
  });
});

describe('orders, cases, feedback', () => {
  it('act_on_order', async () => {
    await run('act_on_order', { id: 'p1', action: 'cancel' });
    expect(route()).toBe('POST /v1/buyer/orders/p1/cancel');
    await run('act_on_order', { id: 'p1', action: 'received' });
    expect(route()).toBe('POST /v1/buyer/orders/p1/received');
    await run('act_on_order', { id: 'p1', action: 'not_received', body: 'never arrived here' });
    expect(last()).toMatchObject({ path: '/v1/buyer/orders/p1/inr', body: { body: 'never arrived here' } });
  });

  it('act_on_case maps every action', async () => {
    await run('act_on_case', { id: 'c1', action: 'accept_offer' });
    expect(last()).toMatchObject({ path: '/v1/buyer/cases/c1/respond', body: { decision: 'accept' } });
    await run('act_on_case', { id: 'c1', action: 'reject_offer' });
    expect(last().body).toEqual({ decision: 'reject' });
    await run('act_on_case', { id: 'c1', action: 'counter', amountCents: 900 });
    expect(route()).toBe('POST /v1/buyer/cases/c1/counter');
    await run('act_on_case', { id: 'c1', action: 'message', body: 'hello' });
    expect(route()).toBe('POST /v1/buyer/cases/c1/messages');
    await run('act_on_case', { id: 'c1', action: 'escalate' });
    expect(route()).toBe('POST /v1/buyer/cases/c1/escalate');
    await run('act_on_case', { id: 'c1', action: 'withdraw' });
    expect(route()).toBe('POST /v1/buyer/cases/c1/withdraw');
  });

  it('cases and feedback reads', async () => {
    await run('get_my_cases', { status: 'all' });
    expect(last()).toMatchObject({ path: '/v1/buyer/cases', query: { status: 'all' } });
    await run('get_my_cases', { id: 'c1' });
    expect(route()).toBe('GET /v1/buyer/cases/c1');
    await run('get_my_feedback', { view: 'pending' });
    expect(route()).toBe('GET /v1/buyer/feedback/pending');
    await run('get_my_feedback', { view: 'left' });
    expect(route()).toBe('GET /v1/buyer/feedback');
    await run('revise_feedback', { id: 'r1', rating: 4 });
    expect(last()).toMatchObject({ verb: 'PATCH', path: '/v1/buyer/feedback/r1', body: { rating: 4 } });
  });
});

describe('lists', () => {
  it('saved_for_later', async () => {
    await run('saved_for_later', { action: 'list' });
    expect(route()).toBe('GET /v1/buyer/cart/saved');
    await run('saved_for_later', { action: 'save', id: 'ci1' });
    expect(route()).toBe('POST /v1/buyer/cart/items/ci1/save-for-later');
    await run('saved_for_later', { action: 'move_to_cart', id: 's1' });
    expect(route()).toBe('POST /v1/buyer/cart/saved/s1/move-to-cart');
    await run('saved_for_later', { action: 'remove', id: 's1' });
    expect(route()).toBe('DELETE /v1/buyer/cart/saved/s1');
    await expect(run('saved_for_later', { action: 'remove' })).rejects.toThrow(/id is required/);
  });

  it('manage_wishlist', async () => {
    await run('manage_wishlist', { id: 'w1', action: 'rename', name: 'Gifts' });
    expect(last()).toMatchObject({ verb: 'PATCH', path: '/v1/buyer/wishlists/w1', body: { name: 'Gifts' } });
    await run('manage_wishlist', { id: 'w1', action: 'share', resetLink: true });
    expect(last()).toMatchObject({ verb: 'POST', path: '/v1/buyer/wishlists/w1/share', body: { resetLink: true } });
    await run('manage_wishlist', { id: 'w1', action: 'remove_item', slug: 'a b' });
    expect(route()).toBe('DELETE /v1/buyer/wishlists/w1/items/a%20b');
    await run('manage_wishlist', { id: 'w1', action: 'delete' });
    expect(route()).toBe('DELETE /v1/buyer/wishlists/w1');
  });

  it('total requests, history, follows', async () => {
    await run('combined_total_requests', { action: 'request', sellerUserId: 'u1' });
    expect(last()).toMatchObject({ verb: 'POST', path: '/v1/buyer/total-requests', body: { sellerUserId: 'u1' } });
    await run('combined_total_requests', { action: 'cancel', id: 't1' });
    expect(route()).toBe('DELETE /v1/buyer/total-requests/t1');
    await run('clear_recently_viewed', {});
    expect(route()).toBe('DELETE /v1/buyer/recently-viewed');
    await run('clear_recently_viewed', { slug: 's' });
    expect(route()).toBe('DELETE /v1/buyer/recently-viewed/s');
    await run('followed_sellers', { action: 'mark_seen' });
    expect(last()).toMatchObject({ verb: 'POST', path: '/v1/buyer/following/sellers/seen', body: {} });
  });

  it('browse_catalog sends booleans as strings', async () => {
    await run('browse_catalog', { q: 'boots', returns: true, sold: false, minPriceCents: 2500 });
    expect(last()).toMatchObject({
      path: '/v1/buyer/catalog/browse',
      query: { q: 'boots', returns: 'true', sold: 'false', minPriceCents: 2500 },
    });
  });
});
