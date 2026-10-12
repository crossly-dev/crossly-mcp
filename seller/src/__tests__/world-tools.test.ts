/**
 * The Crossly World tools dispatch to the right /v1/world verb and path, are
 * registered, and offer no verb that moves money (buy, mint, shake): an app
 * token never moves CBX, COSM or money.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  apiPut: vi.fn(async (path: string, body: unknown) => {
    calls.push({ verb: 'PUT', path, body });
    return {};
  }),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { worldTools } = await import('../tools/world.js');
const { ALL_TOOLS } = await import('../registry.js');

const run = (name: string, args: Record<string, unknown> = {}) => {
  const tool = worldTools.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.handler(args);
};
const last = () => calls[calls.length - 1]!;

beforeEach(() => {
  calls.length = 0;
});

describe('world tools', () => {
  it('are all registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no money verb', () => {
    for (const t of worldTools) {
      expect(t.name).not.toMatch(/buy|mint|shake|pay|checkout|withdraw|spend/);
    }
  });

  it.each([
    ['get_world_wallet', {}, 'GET /v1/world/wallet'],
    ['list_world_quests', {}, 'GET /v1/world/quests'],
    ['get_world_crew', {}, 'GET /v1/world/crew'],
    ['get_world_loadout', {}, 'GET /v1/world/avatar/loadout'],
    ['get_world_loadout', { userId: 'u-1' }, 'GET /v1/world/avatar/loadout/u-1'],
    ['list_world_closet', { limit: 5 }, 'GET /v1/world/avatar/closet'],
    ['list_world_stock_wearables', {}, 'GET /v1/world/avatar/stock'],
    ['list_world_authored_wearables', {}, 'GET /v1/world/avatar/wearables'],
    ['get_world_cosm_balance', {}, 'GET /v1/world/cosm/balance'],
    ['list_world_cosmetics', { tier: 'earned' }, 'GET /v1/world/cosm/cosmetics'],
    ['list_world_cosm_inventory', {}, 'GET /v1/world/cosm/inventory'],
    ['list_world_decor_catalogue', { surface: 'street' }, 'GET /v1/world/decor/catalogue'],
    ['list_world_my_decor', {}, 'GET /v1/world/decor/mine'],
    ['list_world_decor_inventory', {}, 'GET /v1/world/decor/inventory'],
    ['list_world_interactive_catalogue', {}, 'GET /v1/world/interactive/catalogue'],
    ['list_world_interactive_designs', {}, 'GET /v1/world/interactive/designs'],
    ['list_world_trade_table_listings', {}, 'GET /v1/world/trade-tables/listings'],
    ['list_world_binder', {}, 'GET /v1/world/trade-tables/binder'],
    ['list_world_friends', {}, 'GET /v1/world/friends'],
    ['get_world_fit_value', {}, 'GET /v1/world/fit-value'],
    ['get_world_fit_stats', {}, 'GET /v1/world/fits/stats'],
    ['list_world_best_dressed', {}, 'GET /v1/world/best-dressed'],
    ['list_world_streaks', {}, 'GET /v1/world/streaks'],
    ['get_world_auto_shop', {}, 'GET /v1/world/auto-shop'],
    ['wear_world_pin', { pin: null }, 'PUT /v1/world/quests/pin'],
    ['create_world_crew', { name: 'Night Owls', tag: 'OWL' }, 'POST /v1/world/crews'],
    ['join_world_crew', { code: 'abcdefgh' }, 'POST /v1/world/crews/join'],
    ['leave_world_crew', {}, 'POST /v1/world/crews/leave'],
    ['invite_world_friend', { userId: 'f-1', slug: 'main-street' }, 'POST /v1/world/friends/f-1/invite'],
    ['equip_world_item', { cosmeticId: 'c-1' }, 'POST /v1/world/avatar/equip'],
    ['unequip_world_slot', { slot: 'avatar_head' }, 'POST /v1/world/avatar/unequip'],
    ['set_world_auto_shop', { enabled: false }, 'PATCH /v1/world/auto-shop'],
  ] as const)('%s %j → %s', async (name, args, expected) => {
    await run(name, args as Record<string, unknown>);
    expect(`${last().verb} ${last().path}`).toBe(expected);
  });

  it('equip sends exactly one door', async () => {
    await run('equip_world_item', { receiptId: 'r-1', slot: 'avatar_feet' });
    expect(last().body).toEqual({ receiptId: 'r-1', slot: 'avatar_feet' });
    await run('equip_world_item', { cosmeticId: 'c-1', slot: 'avatar_feet' });
    expect(last().body).toEqual({ cosmeticId: 'c-1' });
  });

  it('create_world_crew forwards the idempotency key outside the body', async () => {
    await run('create_world_crew', { name: 'Night Owls', tag: 'OWL', idempotencyKey: 'k1' });
    expect(last()).toMatchObject({ body: { name: 'Night Owls', tag: 'OWL' }, key: 'k1' });
  });
});
