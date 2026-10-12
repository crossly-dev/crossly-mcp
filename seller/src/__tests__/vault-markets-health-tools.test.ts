/**
 * The portfolio-health tools hit their literal v1 paths, send the what-if on
 * the query string from destructured args, and describe every argument.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; arg?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, arg: query }); return {}; }),
  apiPost: vi.fn(async () => ({})),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsHealthTools } = await import('../tools/vault-markets-health.js');
const tool = (name: string) => vaultMarketsHealthTools.find((t) => t.name === name)!;

beforeEach(() => { calls.length = 0; });

describe('vault portfolio health tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsHealthTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
      expect(t.description).toMatch(/not advice|not a price/);
    }
  });

  it('reach their paths', async () => {
    await tool('get_vault_portfolio_health').handler({});
    await tool('vault_portfolio_what_if').handler({ bookKey: 'v1:near_mint:-', moveBps: -2_000 });
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault-markets/health', arg: {} },
      { verb: 'GET', path: '/v1/vault-markets/health/what-if', arg: { bookKey: 'v1:near_mint:-', moveBps: -2_000 } },
    ]);
  });
});
