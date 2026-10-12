/**
 * The kites tool reads /v1/world/kites, is registered, and nothing
 * flies one or spends: a kite is flown on the lawn in the world.
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

const { worldKitesTools } = await import('../tools/world-kites.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('kite tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldKitesTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that flies or spends', () => {
    for (const t of worldKitesTools) expect(t.name).not.toMatch(/fly|buy|pay|spend/);
  });

  it('get_world_kites -> GET /v1/world/kites', async () => {
    await worldKitesTools.find((t) => t.name === 'get_world_kites')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/kites' });
  });
});
