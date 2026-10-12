/**
 * The creator price widget tools hit their literal /v1 paths, are registered,
 * describe every argument, and nothing in them trades.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push({ verb: 'GET', path }); return {}; }),
  apiPost: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'PATCH', path, body }); return {}; }),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async (path: string) => { calls.push({ verb: 'DELETE', path }); return {}; }),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsPriceWidgetsTools } = await import('../tools/vault-markets-price-widgets.js');
const { ALL_TOOLS } = await import('../registry.js');
const tool = (n: string) => vaultMarketsPriceWidgetsTools.find((t) => t.name === n)!;

describe('vault widget tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of vaultMarketsPriceWidgetsTools) expect(names.has(t.name)).toBe(true);
  });

  it('describe every argument and offer no verb that trades', () => {
    for (const t of vaultMarketsPriceWidgetsTools) {
      expect(t.name).not.toMatch(/buy|sell|order|pay|spend|bid|place/);
      for (const [k, v] of Object.entries(t.inputSchema.properties)) expect((v as { description?: string }).description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('map to their routes', async () => {
    calls.length = 0;
    await tool('list_vault_price_widgets').handler({});
    await tool('create_vault_price_widget').handler({ kind: 'mark', bookKey: 'v:Used:-', affiliateCodeId: null });
    await tool('preview_vault_price_widget').handler({ kind: 'index', indexSlug: 'crossly-50' });
    await tool('get_vault_price_widget').handler({ widgetId: 'a/b' });
    await tool('update_vault_price_widget').handler({ widgetId: 'w1', theme: 'dark' });
    await tool('delete_vault_price_widget').handler({ widgetId: 'w1' });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/price-widgets',
      'POST /v1/vault-markets/price-widgets',
      'POST /v1/vault-markets/price-widgets/preview',
      'GET /v1/vault-markets/price-widgets/a%2Fb',
      'PATCH /v1/vault-markets/price-widgets/w1',
      'DELETE /v1/vault-markets/price-widgets/w1',
    ]);
    expect(calls[1]!.body).toMatchObject({ kind: 'mark', bookKey: 'v:Used:-', affiliateCodeId: null });
    expect(calls[4]!.body).toMatchObject({ theme: 'dark' });
  });
});
