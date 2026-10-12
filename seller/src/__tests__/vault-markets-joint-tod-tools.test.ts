/**
 * The joint vault and transfer-on-death tools hit their literal v1 paths (ids
 * from destructured args, encoded), keep ids out of bodies, and describe every argument.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; arg?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, arg: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, arg: body }); return {}; }),
  apiPut: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'PUT', path, arg: body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsJointTodTools } = await import('../tools/vault-markets-joint-tod.js');
const tool = (name: string) => vaultMarketsJointTodTools.find((t) => t.name === name)!;

beforeEach(() => { calls.length = 0; });

describe('joint vault and transfer-on-death tools', () => {
  it('describe every argument, money in cents of US dollars', () => {
    for (const t of vaultMarketsJointTodTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) {
        expect(v.description, `${t.name}.${k}`).toBeTruthy();
        if (/cents$/i.test(k)) expect(v.description).toMatch(/cents of US dollars/);
      }
    }
    expect(new Set(vaultMarketsJointTodTools.map((t) => t.name)).size).toBe(vaultMarketsJointTodTools.length);
  });

  it('reach their paths', async () => {
    await tool('list_vault_joint_vaults').handler({});
    await tool('create_vault_joint_vault').handler({ name: 'Family' });
    await tool('get_vault_joint_vault').handler({ jointId: 'j 1' });
    await tool('invite_to_vault_joint_vault').handler({ jointId: 'j1', to: '@kid', rights: 'trade' });
    await tool('respond_vault_joint_invite').handler({ jointId: 'j1', action: 'accept' });
    await tool('accept_vault_joint_terms').handler({ jointId: 'j1' });
    await tool('set_vault_joint_rights').handler({ jointId: 'j1', userId: 'u1', rights: 'full' });
    await tool('remove_vault_joint_member').handler({ jointId: 'j1', userId: 'u1' });
    await tool('add_vault_joint_units').handler({ jointId: 'j1', vaultItemIds: ['v1'] });
    await tool('remove_vault_joint_units').handler({ jointId: 'j1', vaultItemIds: ['v1'] });
    await tool('list_vault_joint_trades').handler({ jointId: 'j1' });
    await tool('place_vault_joint_trade').handler({ jointId: 'j1', side: 'buy', bookKey: 'k', limitCents: 5_000 });
    await tool('cancel_vault_joint_trade').handler({ jointId: 'j1', tradeId: 't1' });
    await tool('close_vault_joint_vault').handler({ jointId: 'j1' });
    await tool('get_vault_tod').handler({});
    await tool('accept_vault_tod_terms').handler({});
    await tool('set_vault_tod_beneficiaries').handler({ beneficiaries: [{ fullName: 'Kid', contact: 'k@x.com', shareBps: 10_000 }] });
    await tool('designate_vault_tod_unit').handler({ vaultItemId: 'v1', beneficiaryId: null });
    await tool('object_to_vault_tod_claim').handler({ claimId: 'c1' });
    await tool('list_vault_tod_my_claims').handler({});
    await tool('file_vault_tod_claim').handler({ holder: '@mum' });
    await tool('add_vault_tod_claim_document').handler({ claimId: 'c1', kind: 'death_certificate', filename: 'c.pdf', dataBase64: 'JVBERi0=' });
    await tool('submit_vault_tod_claim').handler({ claimId: 'c1' });
    await tool('withdraw_vault_tod_claim').handler({ claimId: 'c1' });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/joint',
      'POST /v1/vault-markets/joint',
      'GET /v1/vault-markets/joint/j%201',
      'POST /v1/vault-markets/joint/j1/invite',
      'POST /v1/vault-markets/joint/j1/respond',
      'POST /v1/vault-markets/joint/j1/terms',
      'POST /v1/vault-markets/joint/j1/members/u1/rights',
      'POST /v1/vault-markets/joint/j1/members/u1/remove',
      'POST /v1/vault-markets/joint/j1/units',
      'POST /v1/vault-markets/joint/j1/units/remove',
      'GET /v1/vault-markets/joint/j1/trades',
      'POST /v1/vault-markets/joint/j1/trades',
      'POST /v1/vault-markets/joint/j1/trades/t1/cancel',
      'POST /v1/vault-markets/joint/j1/close',
      'GET /v1/vault-markets/tod',
      'POST /v1/vault-markets/tod/terms',
      'PUT /v1/vault-markets/tod/beneficiaries',
      'PUT /v1/vault-markets/tod/designations',
      'POST /v1/vault-markets/tod/claims/c1/object',
      'GET /v1/vault-markets/tod/my-claims',
      'POST /v1/vault-markets/tod/my-claims',
      'POST /v1/vault-markets/tod/my-claims/c1/documents',
      'POST /v1/vault-markets/tod/my-claims/c1/submit',
      'POST /v1/vault-markets/tod/my-claims/c1/withdraw',
    ]);
    expect(calls[3]!.arg).toEqual({ to: '@kid', rights: 'trade' });
    expect(calls[11]!.arg).toEqual({ side: 'buy', bookKey: 'k', limitCents: 5_000 });
    expect(calls[21]!.arg).not.toHaveProperty('claimId');
  });
});
