/**
 * The fireflies tool reads /v1/world/fireflies, is registered, and nothing
 * catches one or spends: a firefly is caught by walking up to it in the world.
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

const { worldFirefliesTools } = await import('../tools/world-fireflies.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('firefly tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldFirefliesTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that catches or spends', () => {
    for (const t of worldFirefliesTools) expect(t.name).not.toMatch(/catch|buy|pay|spend/);
  });

  it('get_world_fireflies -> GET /v1/world/fireflies', async () => {
    await worldFirefliesTools.find((t) => t.name === 'get_world_fireflies')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/fireflies' });
  });
});
