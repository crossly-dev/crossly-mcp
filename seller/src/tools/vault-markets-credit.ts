import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault credit (api routes/v1/write/vault-markets-credit.ts): cash-out loans
 * against stored vault units and advances against units listed for sale, lent
 * by the market pool into your custodian account. Pledged units cannot be
 * listed, lent or withdrawn until repaid. Opening a loan or advance needs a
 * verified ID (start_vault_markets_identity_check). Reads need
 * vault-markets:read, anything that moves money vault-markets:trade.
 */
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const UNIT_IDS = (what: string) => ({ type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50, description: `${what}: 1-50 vault unit ids (uuids) from get_vault_markets_portfolio.` }) as const;
const AMOUNT = (what: string) => ({ type: 'integer', minimum: 1, maximum: 100_000_000, description: `${what}, in cents of US dollars (the currency), a whole number.` }) as const;
const ID_ONLY = (what: string): ToolDef['inputSchema'] => ({ type: 'object', properties: { id: ID(what) }, required: ['id'], additionalProperties: false });

export const vaultMarketsCreditTools: ToolDef[] = [
  {
    name: 'list_vault_markets_credit',
    description: 'Your vault loans and advances: what is owed, interest accrued (in cents), loan-to-value, the liquidation line and the collateral value it is called at.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['live', 'closed', 'all'], default: 'live', description: '"live" = still owed (the default); "closed" = repaid or liquidated; "all" = both.' },
        kind: { type: 'string', enum: ['loan', 'advance'], description: 'Optional filter: "loan" = borrowed against stored units; "advance" = against a unit listed for sale.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { status, kind } = args as { status?: string; kind?: string };
      return apiGet('/v1/vault-markets/credit', { status, kind });
    },
  },
  {
    name: 'get_vault_markets_credit',
    description: 'One loan or advance with its pledged units and its money log (draws, interest, repayments, sale proceeds).',
    inputSchema: ID_ONLY('Loan or advance'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/credit/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'repay_vault_markets_credit',
    description: 'Repay a loan or advance from your custodian account, interest first. Leave amountCents out to repay everything. Repaid in full, the items are free.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('Loan or advance'),
        amountCents: AMOUNT('How much to repay (leave out to repay everything owed)'),
        requestId: { type: 'string', description: 'Optional id of your own for this repayment (letters, digits, _ . : -; up to 80): a retry with the same id never pays twice.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, amountCents, requestId } = args as { id: string; amountCents?: number; requestId?: string };
      return apiPost(`/v1/vault-markets/credit/${encodeURIComponent(id)}/repay`, { amountCents, requestId });
    },
  },
  {
    name: 'quote_vault_markets_loan',
    description: "How much you can borrow against vault units: each unit's tier, mark (in cents) and limit, the pool's rate and yours.",
    inputSchema: { type: 'object', properties: { vaultItemIds: { ...UNIT_IDS('Units to quote'), description: 'Optional: up to 50 vault unit ids (uuids) to quote. Leave out to quote every stored unit you hold.' } }, additionalProperties: false },
    handler: (args) => {
      const { vaultItemIds } = args as { vaultItemIds?: string[] };
      return apiGet('/v1/vault-markets/loans/quote', { vaultItemIds: vaultItemIds?.length ? vaultItemIds.join(',') : undefined });
    },
  },
  {
    name: 'open_vault_markets_loan',
    description: 'Borrow against stored vault units: they are pledged (no listing, lending or withdrawal) and the market pool lends amountCents into your custodian account. Needs a verified ID.',
    inputSchema: {
      type: 'object',
      properties: { vaultItemIds: UNIT_IDS('Units to pledge'), amountCents: AMOUNT('How much to borrow') },
      required: ['vaultItemIds', 'amountCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemIds, amountCents } = args as { vaultItemIds: string[]; amountCents: number };
      return apiPost('/v1/vault-markets/loans', { vaultItemIds, amountCents });
    },
  },
  {
    name: 'pledge_vault_markets_loan_units',
    description: 'Pledge more stored units to a loan (answers a loan call, or makes room to borrow more).',
    inputSchema: { type: 'object', properties: { id: ID('Loan'), vaultItemIds: UNIT_IDS('Units to add') }, required: ['id', 'vaultItemIds'], additionalProperties: false },
    handler: (args) => {
      const { id, vaultItemIds } = args as { id: string; vaultItemIds: string[] };
      return apiPost(`/v1/vault-markets/loans/${encodeURIComponent(id)}/units`, { vaultItemIds });
    },
  },
  {
    name: 'release_vault_markets_loan_unit',
    description: "Free one pledged unit from a loan, if what is owed still fits inside the other units' limit.",
    inputSchema: { type: 'object', properties: { id: ID('Loan'), vaultItemId: ID('Pledged vault unit') }, required: ['id', 'vaultItemId'], additionalProperties: false },
    handler: (args) => {
      const { id, vaultItemId } = args as { id: string; vaultItemId: string };
      return apiPost(`/v1/vault-markets/loans/${encodeURIComponent(id)}/units/${encodeURIComponent(vaultItemId)}/release`, {});
    },
  },
  {
    name: 'get_vault_markets_loan_unit_sale_floor',
    description: "The lowest price a pledged unit can be sold at to repay its loan: after the sale (less the vault fee and storage) what is still owed must fit inside the other units' limit. Returns { floorCents, owedCents, otherUnitsCarryCents }, in cents.",
    inputSchema: { type: 'object', properties: { id: ID('Loan'), vaultItemId: ID('Pledged vault unit') }, required: ['id', 'vaultItemId'], additionalProperties: false },
    handler: (args) => {
      const { id, vaultItemId } = args as { id: string; vaultItemId: string };
      return apiGet(`/v1/vault-markets/loans/${encodeURIComponent(id)}/units/${encodeURIComponent(vaultItemId)}/sale-floor`, {});
    },
  },
  {
    name: 'sell_vault_markets_loan_unit',
    description: 'Sell a pledged unit to repay its loan: it is listed at priceCents (at least the sale floor) and stays pledged until it sells; the proceeds repay the loan first and the rest is yours. Calling it again re-prices it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('Loan'),
        vaultItemId: ID('Pledged vault unit'),
        priceCents: { type: 'integer', minimum: 100, maximum: 100_000_000, description: 'The asking price, in cents of US dollars (the currency), a whole number; at least the sale floor from get_vault_markets_loan_unit_sale_floor.' },
      },
      required: ['id', 'vaultItemId', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, vaultItemId, priceCents } = args as { id: string; vaultItemId: string; priceCents: number };
      return apiPost(`/v1/vault-markets/loans/${encodeURIComponent(id)}/units/${encodeURIComponent(vaultItemId)}/sell`, { priceCents });
    },
  },
  {
    name: 'quote_vault_markets_advance',
    description: 'What an advance on a vault unit listed for sale could be: up to half of the lower of its mark and asking price (in cents), free for 60 days.',
    inputSchema: { type: 'object', properties: { vaultItemId: ID('Listed vault unit') }, required: ['vaultItemId'], additionalProperties: false },
    handler: (args) => {
      const { vaultItemId } = args as { vaultItemId: string };
      return apiGet('/v1/vault-markets/advances/quote', { vaultItemId });
    },
  },
  {
    name: 'open_vault_markets_advance',
    description: 'Take an advance against a vault unit listed for sale: paid into your custodian account, netted from the sale. Free for 60 days, then the pool rate. Needs a verified ID.',
    inputSchema: {
      type: 'object',
      properties: { vaultItemId: ID('Listed vault unit'), amountCents: AMOUNT('How much to advance') },
      required: ['vaultItemId', 'amountCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, amountCents } = args as { vaultItemId: string; amountCents: number };
      return apiPost('/v1/vault-markets/advances', { vaultItemId, amountCents });
    },
  },
  {
    name: 'relist_vault_markets_advance',
    description: "Relist an advance's unit at a new price (never so low its sale could not repay the advance).",
    inputSchema: {
      type: 'object',
      properties: { id: ID('Advance'), priceCents: { type: 'integer', minimum: 100, maximum: 100_000_000, description: 'The new asking price, in cents of US dollars (the currency), a whole number.' } },
      required: ['id', 'priceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, priceCents } = args as { id: string; priceCents: number };
      return apiPost(`/v1/vault-markets/advances/${encodeURIComponent(id)}/relist`, { priceCents });
    },
  },
];
