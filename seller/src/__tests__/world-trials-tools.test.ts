/**
 * The Time Trials tools read the right /v1/world/trials paths, are
 * registered, and none of them records a lap or moves money: a lap is timed
 * by riding the course in the world.
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

const { worldTrialsTools } = await import('../tools/world-trials.js');
const { ALL_TOOLS } = await import('../registry.js');

beforeEach(() => { calls.length = 0; });

describe('time trials tools', () => {
  it('are all registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldTrialsTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that records a lap or spends', () => {
    for (const t of worldTrialsTools) expect(t.name).not.toMatch(/record|submit|set_|claim|buy|mint|pay|spend|wager/);
  });

  it.each([
    ['get_my_trial_bests', {}, 'GET /v1/world/trials/mine'],
    ['get_trials_leaderboard', {}, 'GET /v1/world/trials/commons-loop/leaderboard'],
    ['get_trials_leaderboard', { course: 'other loop' }, 'GET /v1/world/trials/other%20loop/leaderboard'],
  ])('%s %j -> %s', async (name, args, expected) => {
    await worldTrialsTools.find((t) => t.name === name)!.handler(args);
    const c = calls[calls.length - 1]!;
    expect(`${c.verb} ${c.path}`).toBe(expected);
  });
});
