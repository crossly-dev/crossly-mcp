/**
 * The Trading Floor tool reads /v1/vault-markets/world/floor, is registered,
 * takes no arguments, and nothing in it trades: the room only shows the tape.
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

const { vaultMarketsFloorTools } = await import('../tools/vault-markets-floor.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('trading floor tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of vaultMarketsFloorTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that trades, buys or spends', () => {
    for (const t of vaultMarketsFloorTools) expect(t.name).not.toMatch(/buy|sell|order|pay|spend|bid|place/);
  });

  it('take no arguments', () => {
    for (const t of vaultMarketsFloorTools) expect(t.inputSchema).toEqual({ type: 'object', properties: {}, additionalProperties: false });
  });

  it('get_vault_markets_trading_floor -> GET /v1/vault-markets/world/floor', async () => {
    await vaultMarketsFloorTools.find((t) => t.name === 'get_vault_markets_trading_floor')!.handler({});
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/vault-markets/world/floor' });
  });
});
