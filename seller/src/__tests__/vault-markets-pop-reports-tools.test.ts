/**
 * The population report tool reads /v1/vault-markets/pop-reports with the
 * bookKey, is registered, describes its one argument, and nothing in it trades.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; params: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, params: unknown) => { calls.push({ verb: 'GET', path, params }); return {}; }),
  apiPost: vi.fn(async () => ({})),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsPopReportTools } = await import('../tools/vault-markets-pop-reports.js');
const { ALL_TOOLS } = await import('../registry.js');

const KEY = '11111111-1111-4111-8111-111111111111:NM:psa:9';

describe('population report tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of vaultMarketsPopReportTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that trades, buys or spends', () => {
    for (const t of vaultMarketsPopReportTools) expect(t.name).not.toMatch(/buy|sell|order|pay|spend|bid|place/);
  });

  it('describe every argument', () => {
    for (const t of vaultMarketsPopReportTools) {
      const props = (t.inputSchema as { properties: Record<string, { description?: string }> }).properties;
      for (const p of Object.values(props)) expect(p.description).toBeTruthy();
    }
  });

  it('get_vault_markets_pop_report -> GET /v1/vault-markets/pop-reports', async () => {
    await vaultMarketsPopReportTools.find((t) => t.name === 'get_vault_markets_pop_report')!.handler({ bookKey: KEY });
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/vault-markets/pop-reports', params: { bookKey: KEY } });
  });
});
