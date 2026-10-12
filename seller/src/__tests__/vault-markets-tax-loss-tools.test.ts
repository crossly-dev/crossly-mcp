/**
 * The tax-loss tool reads its literal v1 path, takes no arguments, and says
 * it never sells and is not tax advice.
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

const { vaultMarketsTaxLossTools } = await import('../tools/vault-markets-tax-loss.js');

beforeEach(() => { calls.length = 0; });

describe('vault tax-loss tool', () => {
  it('reads its path with no arguments', async () => {
    const t = vaultMarketsTaxLossTools.find((x) => x.name === 'get_vault_tax_loss_suggestions')!;
    expect(t).toBeTruthy();
    await t.handler({});
    expect(calls).toEqual([{ verb: 'GET', path: '/v1/vault-markets/tax/loss-suggestions', arg: {} }]);
    expect((t.inputSchema as { properties: Record<string, unknown> }).properties).toEqual({});
  });

  it('says money is in cents, it never sells, and it is not tax advice', () => {
    const d = vaultMarketsTaxLossTools[0]!.description;
    expect(d).toMatch(/cents of US dollars/);
    expect(d).toMatch(/Never sells/);
    expect(d).toMatch(/Not tax advice/);
  });
});
