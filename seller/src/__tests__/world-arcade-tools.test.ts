/**
 * The Arcade tool dispatches to GET /v1/world/arcade, is registered, and is
 * read-only: nothing plays a game, records a score or moves money.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { worldArcadeTools } = await import('../tools/world-arcade.js');
const { ALL_TOOLS } = await import('../registry.js');

beforeEach(() => { calls.length = 0; });

describe('arcade tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldArcadeTools) expect(names.has(t.name)).toBe(true);
  });

  it('only read', () => {
    for (const t of worldArcadeTools) expect(t.name).toMatch(/^get_/);
  });

  it('get_world_arcade -> GET /v1/world/arcade', async () => {
    await worldArcadeTools.find((t) => t.name === 'get_world_arcade')!.handler({});
    expect(calls[calls.length - 1]).toEqual({ verb: 'GET', path: '/v1/world/arcade' });
  });
});
