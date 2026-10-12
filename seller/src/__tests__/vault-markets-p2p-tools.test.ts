/**
 * The P2P vault loan tools hit their literal v1 paths (ids from destructured
 * args, bodies without the id), and every argument is described.
 */
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push({ verb: 'GET', path }); return {}; }),
  apiPost: vi.fn(async (path: string, body?: unknown) => { calls.push({ verb: 'POST', path, body }); return {}; }),
  apiPatch: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
  requirePat: vi.fn(() => 'crossly_pat_test'),
  configureClient: vi.fn(),
}));

const { vaultMarketsP2pTools } = await import('../tools/vault-markets-p2p.js');
const tool = (name: string) => vaultMarketsP2pTools.find((t) => t.name === name)!;

describe('P2P vault loan tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsP2pTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths', async () => {
    calls.length = 0;
    await tool('take_p2p_loan_offer').handler({ offerId: 'o 1', vaultItemId: 'u1', requestId: 'r1' });
    await tool('repay_p2p_loan').handler({ loanId: 'l1' });
    await tool('call_p2p_loan').handler({ loanId: 'l1' });
    await tool('refinance_p2p_loan').handler({ loanId: 'l1', maxPayoffCents: 5 });
    await tool('cancel_p2p_loan_offer').handler({ offerId: 'o1' });
    await tool('get_p2p_loan').handler({ loanId: 'l1' });
    await tool('list_p2p_loan_offers').handler({ bookKey: 'k' });
    await tool('repay_p2p_loan').handler({ loanId: 'l1', amountCents: 2500 });
    await tool('cancel_p2p_loan_call').handler({ loanId: 'l1' });
    await tool('open_p2p_refi_auction').handler({ loanId: 'l 1', startAprBps: 400, hours: 12 });
    await tool('cancel_p2p_refi_auction').handler({ loanId: 'l1' });
    expect(calls).toEqual([
      { verb: 'POST', path: '/v1/vault-markets/p2p/offers/o%201/take', body: { vaultItemId: 'u1', requestId: 'r1' } },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l1/repay', body: {} },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l1/call', body: {} },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l1/refinance', body: { maxPayoffCents: 5 } },
      { verb: 'POST', path: '/v1/vault-markets/p2p/offers/o1/cancel', body: {} },
      { verb: 'GET', path: '/v1/vault-markets/p2p/loans/l1' },
      { verb: 'GET', path: '/v1/vault-markets/p2p/offers' },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l1/repay', body: { amountCents: 2500 } },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l1/cancel-call', body: {} },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l%201/refi-auction', body: { startAprBps: 400, hours: 12 } },
      { verb: 'POST', path: '/v1/vault-markets/p2p/loans/l1/refi-auction/cancel', body: {} },
    ]);
  });
});
