/**
 * The Wishing Fountain tool reads /v1/world/wishes, is registered, and nothing
 * makes a wish or spends: a wish is a coin tossed at the fountain in the world.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push({ verb: 'GET', path }); return {}; }),
  apiPost: vi.fn(async () => ({})),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { worldWishesTools } = await import('../tools/world-wishes.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('wishing fountain tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldWishesTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that makes a wish or spends', () => {
    for (const t of worldWishesTools) expect(t.name).not.toMatch(/make|toss|buy|pay|spend/);
  });

  it('get_world_wishes -> GET /v1/world/wishes', async () => {
    await worldWishesTools.find((t) => t.name === 'get_world_wishes')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/wishes' });
  });
});
