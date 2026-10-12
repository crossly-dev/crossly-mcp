/**
 * The provenance tool reads /v1/world/provenance, is registered, and
 * nothing buys or writes.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string, q: unknown) => { calls.push({ verb: 'GET', path, body: q }); return {}; }),
  apiPost: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { worldProvenanceTools } = await import('../tools/world-provenance.js');
const { ALL_TOOLS } = await import('../registry.js');

describe('provenance tools', () => {
  it('are registered', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const t of worldProvenanceTools) expect(names.has(t.name)).toBe(true);
  });

  it('offer no verb that buys or spends', () => {
    for (const t of worldProvenanceTools) expect(t.name).not.toMatch(/buy|pay|spend|bid/);
  });

  it('get_world_provenance -> GET /v1/world/provenance', async () => {
    await worldProvenanceTools.find((t) => t.name === 'get_world_provenance')!.handler({ listingIds: ['a', 'b'] });
    expect(calls[0]).toEqual({ verb: 'GET', path: '/v1/world/provenance', body: { listingIds: 'a,b' } });
  });
});
