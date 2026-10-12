/**
 * The Hall of Grails tool reads /v1/world/hall, is registered, and nothing
 * buys or spends: exhibits are bought through the market.
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

const { worldHallTools } = await import('../tools/world-hall.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('hall tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldHallTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that buys or spends', () => {
    for (const t of worldHallTools) expect(t.name).not.toMatch(/buy|pay|spend|bid/);
  });

  it('get_world_hall -> GET /v1/world/hall', async () => {
    await worldHallTools.find((t) => t.name === 'get_world_hall')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/hall' });
  });
});
