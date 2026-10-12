/**
 * The Wishing Fountain tool reads /v1/world/chests, is registered, and nothing
 * opens a chest or spends: a chest is opened by walking up to it in the world.
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

const { worldChestsTools } = await import('../tools/world-chests.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('commons chest tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldChestsTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that opens a chest or spends', () => {
    for (const t of worldChestsTools) expect(t.name).not.toMatch(/open|take|claim|buy|pay|spend/);
  });

  it('get_commons_chest -> GET /v1/world/chests', async () => {
    await worldChestsTools.find((t) => t.name === 'get_commons_chest')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/chests' });
  });
});
