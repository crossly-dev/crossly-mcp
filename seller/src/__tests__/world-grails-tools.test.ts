/**
 * The grail tool posts the ids to /v1/world/grails/match, is registered, and
 * nothing buys or writes.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async () => ({})),
  apiPost: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { worldGrailsTools } = await import('../tools/world-grails.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('grail tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldGrailsTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that buys or spends', () => {
    for (const t of worldGrailsTools) expect(t.name).not.toMatch(/buy|pay|spend|bid/);
  });

  it('match_world_grails -> POST /v1/world/grails/match with the ids', async () => {
    await worldGrailsTools.find((t) => t.name === 'match_world_grails')!.handler({ skuIds: ['a'], junk: 1 });
    expect(calls[0]).toEqual({ verb: 'POST', path: '/v1/world/grails/match', body: { listingIds: undefined, inventoryIds: undefined, skuIds: ['a'] } });
  });
});
