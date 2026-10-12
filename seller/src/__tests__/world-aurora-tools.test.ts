/**
 * The Sales Aurora tool reads /v1/world/aurora, is registered, and nothing
 * buys or spends: the sky only shows sales.
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

const { worldAuroraTools } = await import('../tools/world-aurora.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('aurora tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldAuroraTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that buys or spends', () => {
    for (const t of worldAuroraTools) expect(t.name).not.toMatch(/buy|pay|spend|bid/);
  });

  it('get_world_aurora -> GET /v1/world/aurora', async () => {
    await worldAuroraTools.find((t) => t.name === 'get_world_aurora')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/aurora' });
  });
});
