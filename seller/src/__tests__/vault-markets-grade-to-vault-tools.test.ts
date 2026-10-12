/**
 * The Grade -> Vault -> List tools hit their literal v1 paths (ids from
 * destructured args, encoded), keep ids out of bodies, pass the price
 * confirmation through exactly, and describe every argument.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; arg?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, arg: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, arg: body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async (path: string) => { calls.push({ verb: 'DELETE', path }); return {}; }),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsGradeToVaultTools } = await import('../tools/vault-markets-grade-to-vault.js');
const tool = (name: string) => vaultMarketsGradeToVaultTools.find((t) => t.name === name)!;

beforeEach(() => { calls.length = 0; });

describe('grade to vault tools', () => {
  it('describe every argument, money in cents of US dollars', () => {
    for (const t of vaultMarketsGradeToVaultTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) {
        expect(v.description, `${t.name}.${k}`).toBeTruthy();
        if (/cents$/i.test(k)) expect(v.description).toMatch(/cents of US dollars/);
      }
    }
  });

  it('reach their paths', async () => {
    await tool('list_vault_grade_to_vault').handler({ live: true });
    await tool('list_vault_grade_to_vault_candidates').handler({});
    await tool('start_vault_grade_to_vault').handler({ source: 'inventory', inventoryItemId: 'i1', runId: 'r1', declaredValueCents: 10_000 });
    await tool('get_vault_grade_to_vault').handler({ flowId: 'f 1' });
    await tool('book_vault_grade_to_vault').handler({ flowId: 'f1', runId: 'r1' });
    await tool('mark_vault_grade_to_vault_shipped').handler({ flowId: 'f1', tracking: '1Z' });
    await tool('confirm_vault_grade_to_vault_list').handler({ flowId: 'f1', priceCents: 30_000, gradeKey: 'psa-10', confirm: true });
    await tool('keep_vault_grade_to_vault').handler({ flowId: 'f1' });
    await tool('cancel_vault_grade_to_vault').handler({ flowId: 'f1' });
    await tool('get_vault_unit_evidence').handler({ vaultItemId: 'u1' });
    await tool('add_vault_unit_scan').handler({ vaultItemId: 'u1', captureId: 'c1' });
    await tool('remove_vault_unit_scan').handler({ vaultItemId: 'u1', evidenceId: 'e1' });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/grade-to-vault',
      'GET /v1/vault-markets/grade-to-vault/candidates',
      'POST /v1/vault-markets/grade-to-vault',
      'GET /v1/vault-markets/grade-to-vault/f%201',
      'POST /v1/vault-markets/grade-to-vault/f1/book',
      'POST /v1/vault-markets/grade-to-vault/f1/shipped',
      'POST /v1/vault-markets/grade-to-vault/f1/list',
      'POST /v1/vault-markets/grade-to-vault/f1/keep',
      'POST /v1/vault-markets/grade-to-vault/f1/cancel',
      'GET /v1/vault-markets/units/u1/evidence',
      'POST /v1/vault-markets/units/u1/evidence/scans',
      'DELETE /v1/vault-markets/units/u1/evidence/e1',
    ]);
    expect(calls[0]!.arg).toEqual({ live: '1' });
    expect(calls[4]!.arg).not.toHaveProperty('flowId');
    expect(calls[6]!.arg).toEqual({ priceCents: 30_000, gradeKey: 'psa-10', confirm: true });
  });

  it('the price confirmation requires every part of it', () => {
    expect(tool('confirm_vault_grade_to_vault_list').inputSchema.required).toEqual(['flowId', 'priceCents', 'gradeKey', 'confirm']);
  });
});
