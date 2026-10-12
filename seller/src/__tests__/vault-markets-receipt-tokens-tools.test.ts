/**
 * The vault receipt-token tools hit their literal v1 paths (ids from
 * destructured args, bodies without the id), and every argument is described.
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

const { vaultMarketsReceiptTokensTools } = await import('../tools/vault-markets-receipt-tokens.js');
const tool = (name: string) => vaultMarketsReceiptTokensTools.find((t) => t.name === name)!;

describe('vault receipt-token tools', () => {
  it('describe every argument', () => {
    for (const t of vaultMarketsReceiptTokensTools) {
      const props = (t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
      for (const [k, v] of Object.entries(props)) expect(v.description, `${t.name}.${k}`).toBeTruthy();
    }
  });

  it('reach their paths', async () => {
    calls.length = 0;
    await tool('list_vault_receipt_tokens').handler({});
    await tool('get_vault_receipt_token').handler({ tokenId: 't 1' });
    await tool('lookup_vault_receipt_token_mint').handler({ mint: 'M1' });
    await tool('export_vault_receipt_token').handler({ vaultItemId: 'u1', wallet: 'W1', acceptTerms: 'rt-1' });
    await tool('confirm_vault_receipt_token_export').handler({ tokenId: 't1', signature: 'S' });
    await tool('redeem_vault_receipt_token').handler({ tokenId: 't1', wallet: 'W1' });
    await tool('confirm_vault_receipt_token_redeem').handler({ tokenId: 't1' });
    await tool('list_vault_receipt_token_wallets').handler({});
    await tool('allow_vault_receipt_token_wallet').handler({ wallet: 'W1' });
    expect(calls).toEqual([
      { verb: 'GET', path: '/v1/vault/receipt-tokens' },
      { verb: 'GET', path: '/v1/vault/receipt-tokens/t%201' },
      { verb: 'GET', path: '/v1/vault/receipt-tokens/by-mint/M1' },
      { verb: 'POST', path: '/v1/vault/receipt-tokens/export', body: { vaultItemId: 'u1', wallet: 'W1', acceptTerms: 'rt-1' } },
      { verb: 'POST', path: '/v1/vault/receipt-tokens/t1/confirm', body: { signature: 'S' } },
      { verb: 'POST', path: '/v1/vault/receipt-tokens/t1/redeem', body: { wallet: 'W1' } },
      { verb: 'POST', path: '/v1/vault/receipt-tokens/t1/redeem/confirm', body: {} },
      { verb: 'GET', path: '/v1/vault/receipt-tokens/wallets' },
      { verb: 'POST', path: '/v1/vault/receipt-tokens/wallets/allow', body: { wallet: 'W1' } },
    ]);
  });
});
