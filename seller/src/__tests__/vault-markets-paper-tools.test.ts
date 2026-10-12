/**
 * The paper trading tools hit their literal v1 paths (the order id from
 * destructured args), describe every argument, and say "play money" in
 * every description.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, body: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'PUT', path, body }); return {}; }),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsPaperTools } = await import('../tools/vault-markets-paper.js');
const tool = (name: string) => vaultMarketsPaperTools.find((t) => t.name === name)!;

describe('paper trading tools', () => {
  it('describe every argument and label play money', () => {
    for (const t of vaultMarketsPaperTools) {
      expect(t.description, t.name).toMatch(/Play money only/);
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths', async () => {
    calls.length = 0;
    await tool('get_vault_markets_paper_account').handler({});
    await tool('place_vault_markets_paper_order').handler({ bookKey: 'k', side: 'buy', limitCents: 500 });
    await tool('cancel_vault_markets_paper_order').handler({ orderId: 'o 1' });
    await tool('reset_vault_markets_paper_account').handler({});
    await tool('set_vault_markets_paper_leaderboard').handler({ optIn: true, displayName: 'Slab Hunter' });
    await tool('get_vault_markets_paper_leaderboard').handler({});
    await tool('quote_vault_markets_paper_order').handler({ bookKey: 'k', side: 'sell' });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/paper',
      'POST /v1/vault-markets/paper/orders',
      'POST /v1/vault-markets/paper/orders/o%201/cancel',
      'POST /v1/vault-markets/paper/reset',
      'PUT /v1/vault-markets/paper/leaderboard',
      'GET /v1/vault-markets/paper/leaderboard',
      'GET /v1/vault-markets/paper/quote',
    ]);
    expect(calls[2]!.body).toEqual({});
  });
});
