/**
 * The sky lanterns tool reads /v1/world/lanterns, is registered, and nothing
 * releases one or spends: a lantern is released at the stand in the world.
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

const { worldLanternsTools } = await import('../tools/world-lanterns.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('sky lantern tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldLanternsTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that releases or spends', () => {
    for (const t of worldLanternsTools) expect(t.name).not.toMatch(/release|buy|pay|spend/);
  });

  it('get_world_lanterns -> GET /v1/world/lanterns', async () => {
    await worldLanternsTools.find((t) => t.name === 'get_world_lanterns')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/lanterns' });
  });
});
