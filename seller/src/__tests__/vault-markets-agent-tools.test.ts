/**
 * The shopping agent's Vault Markets tools (round 11 Y4): watches and drafted
 * orders. They are registered, describe every argument, call literal paths,
 * and none of them places an order — there is deliberately no confirm tool.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown; query?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, query }); return {}; }),
  apiPost: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async (path: string) => { calls.push({ verb: 'DELETE', path }); return {}; }),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsAgentTools } = await import('../tools/vault-markets-agent.js');
const { ALL_TOOLS } = await import('../registry.js');
const tool = (name: string) => vaultMarketsAgentTools.find((t) => t.name === name)!;
const ID = '33333333-3333-4333-8333-333333333333';

beforeEach(() => { calls.length = 0; });

describe('vault agent tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of vaultMarketsAgentTools) expect(names.has(t.name)).toBe(true);
  });

  it('none places, confirms or pays for an order', () => {
    for (const t of vaultMarketsAgentTools) expect(t.name).not.toMatch(/confirm|place|pay|buy|sell|spend/);
  });

  it('describe every argument', () => {
    for (const t of vaultMarketsAgentTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('watches: list, create (direction only when given), cancel', async () => {
    await tool('list_vault_markets_agent_watches').handler({ live: true });
    await tool('create_vault_markets_agent_watch').handler({ bookKey: 'v:near_mint:psa:10', metric: 'bid', thresholdCents: 40_000 });
    await tool('cancel_vault_markets_agent_watch').handler({ id: ID });
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault-markets/agent/watches', query: { live: 'true' } },
      { verb: 'POST', path: '/v1/vault-markets/agent/watches', body: { bookKey: 'v:near_mint:psa:10', metric: 'bid', thresholdCents: 40_000 } },
      { verb: 'DELETE', path: `/v1/vault-markets/agent/watches/${ID}` },
    ]);
  });

  it('drafts: list, get, cancel', async () => {
    await tool('list_vault_markets_agent_drafts').handler({});
    await tool('get_vault_markets_agent_draft').handler({ id: ID });
    await tool('cancel_vault_markets_agent_draft').handler({ id: ID });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/agent/drafts',
      `GET /v1/vault-markets/agent/drafts/${ID}`,
      `POST /v1/vault-markets/agent/drafts/${ID}/cancel`,
    ]);
  });
});
