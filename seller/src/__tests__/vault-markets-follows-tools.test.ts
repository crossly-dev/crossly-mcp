/**
 * The collectors-to-follow tools hit their literal v1 paths (handles from
 * destructured args, kinds as one comma list), every argument is described,
 * and no tool can trade.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown; query?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'PUT', path, body }); return {}; }),
  apiDelete: vi.fn(async (path: string) => { calls.push({ verb: 'DELETE', path }); return {}; }),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsFollowsTools } = await import('../tools/vault-markets-follows.js');
const tool = (name: string) => vaultMarketsFollowsTools.find((t) => t.name === name)!;

describe('collectors-to-follow tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsFollowsTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths', async () => {
    calls.length = 0;
    await tool('get_vault_sharing').handler({});
    await tool('update_vault_sharing').handler({ orders: true });
    await tool('list_vault_following').handler({});
    await tool('get_vault_follow_feed').handler({ kinds: ['buy', 'hall_loan'], limit: 5 });
    await tool('get_vault_collector_activity').handler({ handle: '@ann b' });
    await tool('get_vault_leaderboard').handler({ period: '30d', category: 'pokemon' });
    await tool('list_vault_copy_watches').handler({});
    await tool('start_vault_copy_watch').handler({ handle: 'ann' });
    await tool('stop_vault_copy_watch').handler({ handle: 'a/b' });
    await tool('list_vault_copy_watch_alerts').handler({ limit: 10 });
    await tool('mark_vault_copy_watch_alerts_read').handler({});
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/follows/sharing',
      'PUT /v1/vault-markets/follows/sharing',
      'GET /v1/vault-markets/follows/following',
      'GET /v1/vault-markets/follows/feed',
      'GET /v1/vault-markets/follows/profiles/%40ann%20b/activity',
      'GET /v1/vault-markets/follows/leaderboards',
      'GET /v1/vault-markets/follows/copy-watch',
      'PUT /v1/vault-markets/follows/copy-watch/ann',
      'DELETE /v1/vault-markets/follows/copy-watch/a%2Fb',
      'GET /v1/vault-markets/follows/copy-watch/alerts',
      'POST /v1/vault-markets/follows/copy-watch/alerts/read',
    ]);
    expect(calls[1]!.body).toEqual({ orders: true });
    expect(calls[3]!.query).toEqual({ kinds: 'buy,hall_loan', before: undefined, limit: 5 });
    expect(calls[4]!.query).toEqual({ kinds: undefined, before: undefined, limit: undefined });
  });

  it('no tool trades', () => {
    for (const t of vaultMarketsFollowsTools) expect(t.name).not.toMatch(/order|trade|copy_trade|mirror|place/);
  });
});
