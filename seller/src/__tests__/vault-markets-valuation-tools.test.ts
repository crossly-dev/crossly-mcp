/**
 * The valuation-statement tools hit their literal v1 paths (ids from
 * destructured args, encoded), keep the id out of the query, send only the
 * fields given, and describe every argument.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; arg?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, arg: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, arg: body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsValuationTools } = await import('../tools/vault-markets-valuation.js');
const tool = (name: string) => vaultMarketsValuationTools.find((t) => t.name === name)!;

beforeEach(() => { calls.length = 0; });

describe('vault valuation-statement tools', () => {
  it('describe every argument; enums name every value', () => {
    for (const t of vaultMarketsValuationTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string; enum?: string[] }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) {
        expect(v.description, `${t.name}.${k}`).toBeTruthy();
        for (const e of v.enum ?? []) expect(v.description, `${t.name}.${k} names ${e}`).toContain(`"${e}"`);
      }
      expect(t.description).toMatch(/cents of US dollars|holder/);
    }
  });

  it('reach their paths', async () => {
    await tool('preview_vault_valuation_statement').handler({ purpose: 'insurance', asOf: '2026-09-30' });
    await tool('issue_vault_valuation_statement').handler({ purpose: 'appraisal', policyRef: 'P-1' });
    await tool('list_vault_valuation_statements').handler({ limit: 3 });
    await tool('get_vault_valuation_statement').handler({ statementId: 's 1' });
    await tool('verify_vault_valuation_statement').handler({ statementId: 's1', hash: 'ab'.repeat(32) });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/valuation-statements/preview',
      'POST /v1/vault-markets/valuation-statements',
      'GET /v1/vault-markets/valuation-statements',
      'GET /v1/vault-markets/valuation-statements/s%201',
      'GET /v1/vault-markets/valuation-statements/s1/verify',
    ]);
    expect(calls[0]!.arg).toEqual({ purpose: 'insurance', asOf: '2026-09-30' });
    expect(calls[1]!.arg).toEqual({ purpose: 'appraisal', policyRef: 'P-1' });
    expect(calls[2]!.arg).toEqual({ limit: 3 });
    expect(calls[3]!.arg).toEqual({});
    expect(calls[4]!.arg).toEqual({ hash: 'ab'.repeat(32) });
  });

  it('verify without a hash sends an empty query', async () => {
    await tool('verify_vault_valuation_statement').handler({ statementId: 's1' });
    expect(calls[0]!.arg).toEqual({});
  });
});
