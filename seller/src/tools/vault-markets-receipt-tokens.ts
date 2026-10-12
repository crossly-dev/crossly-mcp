import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault receipt tokens on Solana (api routes/v1/write/vault-markets-receipt-tokens.ts).
 * Optional and explicit: one vault unit's warehouse receipt goes out to one of
 * the user's own verified Solana wallets as a Token-2022 token (supply 1). It
 * is minted only when that wallet signs the transaction the export returns,
 * frozen while the unit is pledged or lent, and burned on redeem or when the
 * unit leaves the vault. While it is out, the token is the title: the unit
 * cannot be sold, moved, lent or withdrawn on Crossly until it is redeemed.
 * An agent can build the transactions but cannot sign them: only the wallet
 * owner can. Not CBX; no money moves.
 */
const TOKEN_ID = { type: 'string', description: 'The receipt token id (uuid) from list_vault_receipt_tokens.' } as const;
const SIGNATURE = { type: 'string', description: 'Optional: the transaction signature the wallet returned (base58). It is recorded only if it landed; the chain state decides either way.' } as const;
const WALLET = { type: 'string', description: 'A Solana wallet address (base58) that is linked and verified on the user account.' } as const;

export const vaultMarketsReceiptTokensTools: ToolDef[] = [
  {
    name: 'list_vault_receipt_tokens',
    description: 'The user vault units with their warehouse receipt and receipt-token state (not exported, waiting for a signature, in a wallet, frozen because the unit is pledged or lent, redeemed), whether each can be exported now and why not. meta.state says whether receipt tokens are open (and which settings are missing), the program id, the authority, the terms version to accept and the cluster; meta.history lists the last 50 exports.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault/receipt-tokens'),
  },
  {
    name: 'get_vault_receipt_token',
    description: 'One receipt token with its chain log (built, minted, frozen, thawed, new holder seen, redeem built, burned) and explorer links.',
    inputSchema: { type: 'object', properties: { tokenId: TOKEN_ID }, required: ['tokenId'], additionalProperties: false },
    handler: (args) => { const { tokenId } = args as { tokenId: string }; return apiGet(`/v1/vault/receipt-tokens/${encodeURIComponent(tokenId)}`); },
  },
  {
    name: 'lookup_vault_receipt_token_mint',
    description: 'What a Solana mint address is: the Crossly warehouse receipt number and item it stands for, whether the token is live, frozen or burned, and whether the unit is still on a vault shelf. Names no person and no wallet. Use it before buying a receipt token anywhere.',
    inputSchema: { type: 'object', properties: { mint: { type: 'string', description: 'The token mint address (base58).' } }, required: ['mint'], additionalProperties: false },
    handler: (args) => { const { mint } = args as { mint: string }; return apiGet(`/v1/vault/receipt-tokens/by-mint/${encodeURIComponent(mint)}`); },
  },
  {
    name: 'export_vault_receipt_token',
    description: 'Build the export of one vault unit warehouse receipt to one of the user verified Solana wallets as a token. Returns a base64 transaction the wallet must sign and send within about two minutes (it pays the rent, about 0.005 SOL); nothing is minted until it does. Then call confirm_vault_receipt_token_export. Needs a verified ID; the unit must be stored, not pledged, not lent and not for sale. Only do this when the user explicitly asks.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: { type: 'string', description: 'The vault unit id (uuid) whose receipt goes out.' },
        wallet: WALLET,
        acceptTerms: { type: 'string', description: 'The current receipt token terms version (meta.state.termsVersion from list_vault_receipt_tokens), which the user accepts.' },
      },
      required: ['vaultItemId', 'wallet', 'acceptTerms'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault/receipt-tokens/export', args),
  },
  {
    name: 'confirm_vault_receipt_token_export',
    description: 'After the wallet sent the export transaction: read the chain and mark the token live once its one token exists. Returns confirmed false if it has not landed yet.',
    inputSchema: { type: 'object', properties: { tokenId: TOKEN_ID, signature: SIGNATURE }, required: ['tokenId'], additionalProperties: false },
    handler: (args) => { const { tokenId, ...body } = args as { tokenId: string; signature?: string }; return apiPost(`/v1/vault/receipt-tokens/${encodeURIComponent(tokenId)}/confirm`, body); },
  },
  {
    name: 'redeem_vault_receipt_token',
    description: 'Build the redeem of a receipt token held in one of the user verified Solana wallets: an unsigned burn the wallet signs and sends (it also closes the token account and returns its rent). Once it lands, call confirm_vault_receipt_token_redeem and the unit is in the user vault. Refused while the token is frozen.',
    inputSchema: { type: 'object', properties: { tokenId: TOKEN_ID, wallet: WALLET }, required: ['tokenId', 'wallet'], additionalProperties: false },
    handler: (args) => { const { tokenId, ...body } = args as { tokenId: string; wallet: string }; return apiPost(`/v1/vault/receipt-tokens/${encodeURIComponent(tokenId)}/redeem`, body); },
  },
  {
    name: 'confirm_vault_receipt_token_redeem',
    description: 'After the wallet sent the redeem: read the chain; once the token is burned the unit moves into the user vault (if it was not theirs already). Returns redeemed false if it has not landed yet.',
    inputSchema: { type: 'object', properties: { tokenId: TOKEN_ID, signature: SIGNATURE }, required: ['tokenId'], additionalProperties: false },
    handler: (args) => { const { tokenId, ...body } = args as { tokenId: string; signature?: string }; return apiPost(`/v1/vault/receipt-tokens/${encodeURIComponent(tokenId)}/redeem/confirm`, body); },
  },
  {
    name: 'list_vault_receipt_token_wallets',
    description: 'The user verified Solana wallets and whether each is on the receipt-token allow-list. Receipt tokens move only between allow-listed wallets, so a wallet must be on it to receive one from someone else (an export puts the receiving wallet on it by itself). meta.state says whether receipt tokens are open.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault/receipt-tokens/wallets'),
  },
  {
    name: 'allow_vault_receipt_token_wallet',
    description: 'Build the allow-list entry for one of the user verified Solana wallets so it can hold and receive receipt tokens. Returns a base64 transaction the wallet must sign and send within about two minutes (it pays about 0.001 SOL rent). Needs a verified ID and a wallet that passes the sanctions screen. Only do this when the user explicitly asks.',
    inputSchema: { type: 'object', properties: { wallet: WALLET }, required: ['wallet'], additionalProperties: false },
    handler: (args) => apiPost('/v1/vault/receipt-tokens/wallets/allow', args),
  },
];
