/**
 * The paper-trading mission tools hit their literal v1 paths, describe every
 * argument, say "play money", and are registered with the server.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, query?: unknown) => { calls.push({ verb: 'GET', path, body: query }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsMissionsTools } = await import('../tools/vault-markets-missions.js');
const { readFileSync } = await import('node:fs');
const tool = (name: string) => vaultMarketsMissionsTools.find((t) => t.name === name)!;

describe('paper-trading mission tools', () => {
  it('describe every argument and label play money', () => {
    for (const t of vaultMarketsMissionsTools) {
      expect(t.description, t.name).toMatch(/Play money only/);
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('are registered with the server', () => {
    const registry = readFileSync(new URL('../registry.ts', import.meta.url), 'utf8');
    expect(registry).toMatch(/import \{ vaultMarketsMissionsTools \}/);
    expect(registry).toMatch(/^\s+vaultMarketsMissionsTools,$/m);
  });

  it('reach their paths with only the described arguments', async () => {
    calls.length = 0;
    await tool('list_vault_markets_paper_missions').handler({});
    await tool('answer_vault_markets_mark_check').handler({ bookKey: 'k', quality: 'A', extra: 'x' });
    expect(calls.map((c) => `${c.verb} ${c.path}`)).toEqual([
      'GET /v1/vault-markets/paper/missions',
      'POST /v1/vault-markets/paper/missions/mark-check',
    ]);
    expect(calls[1]!.body).toEqual({ bookKey: 'k', quality: 'A' });
  });
});
