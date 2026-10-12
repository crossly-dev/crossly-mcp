/**
 * The home-screen widget tools hit their literal v1 paths, pass only what they
 * were given, and describe every argument.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, body: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPut: vi.fn(async () => ({})),
  apiPatch: vi.fn(async () => ({})),
  apiDelete: vi.fn(async (path: string) => { calls.push({ verb: 'DELETE', path }); return {}; }),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsWidgetTools } = await import('../tools/vault-markets-widget.js');
const tool = (name: string) => vaultMarketsWidgetTools.find((t) => t.name === name)!;

describe('vault widget tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsWidgetTools) {
      const props = (t.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths', async () => {
    calls.length = 0;
    const key = '3f1c2b7e-0000-4000-8000-000000000001:near_mint:-';
    await tool('get_vault_widget_summary').handler({ key });
    await tool('get_vault_widget_summary').handler({});
    await tool('list_vault_widget_tokens').handler({});
    await tool('mint_vault_widget_token').handler({ deviceName: 'Pixel 8', installId: 'abcdef12' });
    await tool('revoke_vault_widget_token').handler({ id: '11111111-1111-4111-8111-111111111111' });
    await tool('revoke_all_vault_widget_tokens').handler({});
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault-markets/widget/summary', body: { key } },
      { verb: 'GET', path: '/v1/vault-markets/widget/summary', body: {} },
      { verb: 'GET', path: '/v1/vault-markets/widget/tokens', body: {} },
      { verb: 'POST', path: '/v1/vault-markets/widget/tokens', body: { deviceName: 'Pixel 8', installId: 'abcdef12' } },
      { verb: 'DELETE', path: '/v1/vault-markets/widget/tokens/11111111-1111-4111-8111-111111111111' },
      { verb: 'DELETE', path: '/v1/vault-markets/widget/tokens' },
    ]);
  });
});
