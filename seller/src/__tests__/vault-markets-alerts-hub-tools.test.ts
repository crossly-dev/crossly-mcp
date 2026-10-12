/**
 * The vault alerts hub tools hit their literal v1 paths, pass only what they
 * were given, and describe every argument.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, body: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPut: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'PUT', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsAlertsHubTools } = await import('../tools/vault-markets-alerts-hub.js');
const tool = (name: string) => vaultMarketsAlertsHubTools.find((t) => t.name === name)!;

describe('vault alerts hub tools', () => {
  it('describe every argument, nested ones too', () => {
    for (const t of vaultMarketsAlertsHubTools) {
      const props = (t.inputSchema.properties ?? {}) as Record<string, { description?: string; properties?: Record<string, { description?: string }> }>;
      for (const [k, v] of Object.entries(props)) {
        expect(v.description, `${t.name}.${k}`).toBeTruthy();
        for (const [kk, vv] of Object.entries(v.properties ?? {})) expect(vv.description, `${t.name}.${k}.${kk}`).toBeTruthy();
      }
    }
  });

  it('name every kind in the test tool enum', () => {
    const kind = (tool('send_vault_test_alert').inputSchema.properties.kind as { enum: string[] }).enum;
    expect(kind).toEqual(['price', 'fill', 'margin_call', 'adl', 'p2p_loan', 'auction', 'market_open', 'receipt_token', 'set_goal', 'follow', 'account']);
  });

  it('reach their paths', async () => {
    calls.length = 0;
    await tool('get_vault_alert_settings').handler({});
    await tool('update_vault_alert_settings').handler({ matrix: { fill: { email: false } }, quietHours: null });
    await tool('send_vault_test_alert').handler({ kind: 'adl' });
    await tool('list_vault_alert_log').handler({ limit: 10 });
    await tool('list_vault_alert_log').handler({});
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault-markets/alert-prefs', body: {} },
      { verb: 'PUT', path: '/v1/vault-markets/alert-prefs', body: { matrix: { fill: { email: false } }, quietHours: null, telegram: undefined } },
      { verb: 'POST', path: '/v1/vault-markets/alert-prefs/test', body: { kind: 'adl' } },
      { verb: 'GET', path: '/v1/vault-markets/alert-log', body: { limit: 10 } },
      { verb: 'GET', path: '/v1/vault-markets/alert-log', body: {} },
    ]);
  });
});
