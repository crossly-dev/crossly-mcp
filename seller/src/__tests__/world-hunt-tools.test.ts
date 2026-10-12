/**
 * The Great Hunt tools dispatch to the right /v1/world/hunt verb and path,
 * are registered, and none of them takes a key or moves money: a key is
 * picked up by walking to it in the world.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push({ verb: 'GET', path }); return {}; }),
  apiPost: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { worldHuntTools } = await import('../tools/world-hunt.js');
const { ALL_TOOLS } = await import('../registry.js');

beforeEach(() => { calls.length = 0; });

describe('great hunt tools', () => {
  it('are all registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldHuntTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that takes a key or spends', () => {
    for (const t of worldHuntTools) expect(t.name).not.toMatch(/take|find|claim|buy|mint|pay|spend/);
  });

  it.each([
    ['get_my_great_hunt', 'GET /v1/world/hunt'],
    ['get_great_hunt_scoreboard', 'GET /v1/world/hunt/scoreboard'],
    ['start_great_hunt', 'POST /v1/world/hunt/start'],
  ])('%s -> %s', async (name, expected) => {
    await worldHuntTools.find((t) => t.name === name)!.handler({});
    const c = calls[calls.length - 1]!;
    expect(`${c.verb} ${c.path}`).toBe(expected);
  });
});
