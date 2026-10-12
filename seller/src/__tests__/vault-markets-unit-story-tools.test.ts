/**
 * The unit-story tools hit their literal v1 paths (ids from destructured
 * args, encoded), and every argument is described.
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

const { vaultMarketsUnitStoryTools } = await import('../tools/vault-markets-unit-story.js');
const tool = (name: string) => vaultMarketsUnitStoryTools.find((t) => t.name === name)!;

describe('vault unit-story tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsUnitStoryTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths', async () => {
    calls.length = 0;
    await tool('get_vault_unit_story').handler({ vaultItemId: 'u 1' });
    await tool('list_vault_position_units').handler({ positionId: 'p1' });
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault-markets/units/u%201/story' },
      { verb: 'GET', path: '/v1/vault-markets/positions/p1/units' },
    ]);
  });
});
