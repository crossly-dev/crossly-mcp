/**
 * The set-goal tools hit their literal v1 paths (ids from destructured args,
 * encoded), keep the goal id out of the body, and describe every argument.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; arg?: unknown; key?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, arg: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown, key?: unknown) => { calls.push({ verb: 'POST', path, arg: body, key }); return {}; }),
  apiPatch: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'PATCH', path, arg: body }); return {}; }),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async (path: string) => { calls.push({ verb: 'DELETE', path }); return {}; }),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsSetGoalsTools } = await import('../tools/vault-markets-set-goals.js');
const tool = (name: string) => vaultMarketsSetGoalsTools.find((t) => t.name === name)!;

beforeEach(() => { calls.length = 0; });

describe('vault set-goal tools', () => {
  it('describe every argument, money in cents of US dollars', () => {
    for (const t of vaultMarketsSetGoalsTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) {
        expect(v.description, `${t.name}.${k}`).toBeTruthy();
        if (/cents$/i.test(k)) expect(v.description).toMatch(/cents of US dollars/);
      }
    }
  });

  it('reach their paths', async () => {
    await tool('find_vault_sets').handler({ q: 'fleer' });
    await tool('list_vault_set_goals').handler({});
    await tool('create_vault_set_goal').handler({ category: 'c', brandSlug: 'b', modelSlug: 'm' });
    await tool('get_vault_set_goal').handler({ goalId: 'g 1' });
    await tool('update_vault_set_goal').handler({ goalId: 'g1', gradeMode: 'ungraded' });
    await tool('remove_vault_set_goal').handler({ goalId: 'g1' });
    await tool('plan_vault_set_basket').handler({ goalId: 'g1', budgetCents: 5_000 });
    await tool('place_vault_set_basket').handler({ goalId: 'g1', budgetCents: 5_000, funding: 'custodian', clientBasketId: 'retry-1' });
    await tool('cancel_vault_set_basket').handler({ goalId: 'g1' });
    await tool('list_vault_set_baskets').handler({ goalId: 'g1' });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/set-goals/sets',
      'GET /v1/vault-markets/set-goals',
      'POST /v1/vault-markets/set-goals',
      'GET /v1/vault-markets/set-goals/g%201',
      'PATCH /v1/vault-markets/set-goals/g1',
      'DELETE /v1/vault-markets/set-goals/g1',
      'GET /v1/vault-markets/set-goals/g1/basket-plan',
      'POST /v1/vault-markets/set-goals/g1/basket',
      'POST /v1/vault-markets/set-goals/g1/basket/cancel',
      'GET /v1/vault-markets/set-goals/g1/baskets',
    ]);
  });

  it('keeps the goal id out of bodies and sends the retry key', async () => {
    await tool('update_vault_set_goal').handler({ goalId: 'g1', gradeMode: 'exact', gradeKey: 'psa:10' });
    await tool('place_vault_set_basket').handler({ goalId: 'g1', budgetCents: 9_000, funding: 'card', stripePaymentMethodId: 'pm_1', clientBasketId: 'k-123456' });
    await tool('plan_vault_set_basket').handler({ goalId: 'g1', budgetCents: 9_000, skuIds: ['a', 'b'] });
    expect(calls[0]!.arg).toEqual({ gradeMode: 'exact', gradeKey: 'psa:10' });
    expect(calls[1]!.arg).toEqual({ budgetCents: 9_000, funding: 'card', stripePaymentMethodId: 'pm_1', clientBasketId: 'k-123456' });
    expect(calls[1]!.key).toBe('k-123456');
    expect(calls[2]!.arg).toEqual({ budgetCents: 9_000, skuIds: 'a,b' });
  });
});
