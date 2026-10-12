/**
 * The "What should I vault?" tools hit their literal v1 paths (the item id
 * from destructured args, encoded), are read only, and describe every argument.
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

const { vaultMarketsVaultSuggestTools } = await import('../tools/vault-markets-vault-suggest.js');
const tool = (name: string) => vaultMarketsVaultSuggestTools.find((t) => t.name === name)!;

beforeEach(() => { calls.length = 0; });

describe('vault suggestion tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsVaultSuggestTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths, read only', async () => {
    await tool('list_vault_suggestions').handler({ limit: 10 });
    await tool('list_vault_suggestions').handler({});
    await tool('get_vault_suggestion_for_item').handler({ inventoryItemId: 'i 1' });
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault-markets/vault-suggestions', arg: { limit: '10' } },
      { verb: 'GET', path: '/v1/vault-markets/vault-suggestions', arg: {} },
      { verb: 'GET', path: '/v1/vault-markets/vault-suggestions/items/i%201', arg: {} },
    ]);
  });
});
