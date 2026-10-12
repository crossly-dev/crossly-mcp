import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets (api routes/v1/write/vault-markets.ts): invest in vault items
 * at the market price, lend units out, short and lever on a book key, and
 * stake CBX into the market pool. Reads need vault-markets:read, everything
 * that moves money vault-markets:trade. Lending, shorts, leverage and staking
 * answer 503 with { gate, missing } until their registration is live; a 409
 * carries a plain message (nothing to borrow, over a limit, custodian refused).
 */
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const CENTS = (what: string) => ({ type: 'integer', minimum: 100, maximum: 100_000_000, description: `${what}, in cents of US dollars (the currency), a whole number.` }) as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;

export const vaultMarketsTools: ToolDef[] = [
  {
    name: 'list_vault_markets_movers',
    description: 'Vault items with the biggest 24 h moves in their market price (from the order book), with units in the vault. Each row carries the bookKey the other tools take.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'How many items to return (1-100). Default 20.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { limit } = args as { limit?: number };
      return apiGet('/v1/vault-markets/movers', limit ? { limit } : {});
    },
  },
  {
    name: 'get_vault_markets_market',
    description: 'One book key: its mark (market price, in cents) and history, lending depth and borrow rate, open interest (shorts and longs) and live auctions.',
    inputSchema: { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false },
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/market', { bookKey });
    },
  },
  {
    name: 'get_vault_markets_account',
    description: 'Which Vault Markets registrations are live (custody, lending, leverage, staking) and the env each still waits on, plus your custodian account, limits and balances. Check this before trading.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/account', {}),
  },
  {
    name: 'open_vault_markets_account',
    description: 'Open your account at the custodian partner (once). Returns { status }; the custodian verifies it before it is active.',
    inputSchema: NONE,
    handler: () => apiPost('/v1/vault-markets/account', {}),
  },
  {
    name: 'start_vault_markets_identity_check',
    description: 'Start (or resume) the one-time ID check that loans, advances, dealer status and larger orders need. Returns { url } for the user to open in a browser, or { alreadyVerified: true }.',
    inputSchema: NONE,
    handler: () => apiPost('/v1/vault-markets/identity/start', {}),
  },
  {
    name: 'accept_vault_markets_terms',
    description: 'Accept the current lending terms, needed before you lend a unit or open a short. Returns { termsVersion }.',
    inputSchema: NONE,
    handler: () => apiPost('/v1/vault-markets/terms', {}),
  },
  {
    name: 'get_vault_markets_portfolio',
    description: 'Your vault holdings at the market price, with cost and P&L (all in cents), and the units you have out on loan.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/portfolio', {}),
  },
  {
    name: 'set_vault_item_lending',
    description: 'Turn lending on or off for a unit you own in the vault. A lent unit earns a borrow fee from shorts and can be recalled. Returns { lendEnabled, minAprBps }.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('Vault item'),
        on: { type: 'boolean', description: 'true to lend the unit out to shorts, false to stop lending it.' },
        minAprBps: {
          type: ['integer', 'null'],
          minimum: 0,
          maximum: 10_000,
          description: 'Optional lowest borrow rate you accept for this unit, as a yearly rate (APR) in basis points (100 = 1%, 10000 = 100%). null clears it; leave it out to keep the current one.',
        },
      },
      required: ['id', 'on'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, on, minAprBps } = args as { id: string; on: boolean; minAprBps?: number | null };
      return apiPost(`/v1/vault/${encodeURIComponent(id)}/lend`, minAprBps === undefined ? { on } : { on, minAprBps });
    },
  },
  {
    name: 'list_vault_markets_loans',
    description: 'Units you lent: rate, fees earned (in cents), recall due date.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/loans', {}),
  },
  {
    name: 'recall_vault_markets_loan',
    description: 'Recall a lent unit: the short has 3 days to return one. Returns { recallDueAt }.',
    inputSchema: { type: 'object', properties: { id: ID('Loan') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/loans/${encodeURIComponent(id)}/recall`, {});
    },
  },
  {
    name: 'list_vault_markets_positions',
    description: 'Your shorts and leveraged longs, with entry, mark, health and P&L in cents.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['live', 'closed'],
          default: 'live',
          description: 'Which positions: "live" = opening, open, called (collateral call) or closing, the default; "closed" = closed, bought in, sold off or cancelled.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { status } = args as { status?: 'live' | 'closed' };
      return apiGet('/v1/vault-markets/positions', status ? { status } : {});
    },
  },
  {
    name: 'get_vault_markets_position',
    description: 'One position with its loans, auctions and custodian instruction log.',
    inputSchema: { type: 'object', properties: { id: ID('Position') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/positions/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'open_vault_markets_short',
    description: 'Short a book key: borrow units lent units (default 1) and sell each at limitCents or better, posting collateral for all of them (50% of the mark each; CBX counts at half, up to 30%). All units are borrowed or none unless allowPartial. A partial sale opens with the units sold and the rest is cancelled. Needs the lending terms accepted. Returns { positionId, matched, units }.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        limitCents: CENTS('Lowest price the borrowed unit may sell for'),
        collateralUsdCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: 'Cash collateral to lock from your custodian account, in cents of US dollars (the currency).' },
        collateralCbxValueCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: 'Optional CBX collateral by its value, in cents of US dollars (the currency); counts at half, up to 30% of the requirement.' },
        leverageX100: { type: 'integer', minimum: 100, maximum: 150, description: 'Optional leverage times 100: 100 is none (the default), 125 is 1.25x, 150 is 1.5x (the most). Above 100 the market pool posts part of the collateral, which needs the leverage registration.' },
        locateId: { type: 'string', description: 'Optional locate id (uuid) you hold from the lending desk: borrow exactly that unit at its quoted terms.' },
        subaccountId: { type: 'string', description: 'Optional firm sub-account id (uuid) to open the position for; leave out for your own account.' },
        units: { type: 'integer', minimum: 1, maximum: 25, description: 'Optional number of units in the position (default 1). The item liquidity tier caps it: tier A 25, B 10, C 3, D 1.' },
        allowPartial: { type: 'boolean', description: 'Optional: true borrows as many of the units as are free instead of refusing when fewer are (never none). Default false: all or none.' },
      },
      required: ['bookKey', 'limitCents', 'collateralUsdCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, limitCents, collateralUsdCents, collateralCbxValueCents, leverageX100, locateId, subaccountId, units, allowPartial } = args as { bookKey: string; limitCents: number; collateralUsdCents: number; collateralCbxValueCents?: number; leverageX100?: number; locateId?: string; subaccountId?: string; units?: number; allowPartial?: boolean };
      return apiPost('/v1/vault-markets/shorts', { bookKey, limitCents, collateralUsdCents, collateralCbxValueCents, leverageX100, locateId, subaccountId, units, allowPartial });
    },
  },
  {
    name: 'open_vault_markets_long',
    description: 'Buy units of a book key (default 1) into your vault with leverage (up to 2x) borrowed from the market staking pool, paying up to maxCents each. A partial fill opens with the units bought and the rest is cancelled. Returns { positionId, matched, units }.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        maxCents: CENTS('Highest price you pay for each unit'),
        leverageX100: { type: 'integer', minimum: 101, maximum: 200, description: 'Leverage times 100: 101 is 1.01x, 150 is 1.5x, 200 is 2x (the most).' },
        subaccountId: { type: 'string', description: 'Optional firm sub-account id (uuid) to open the position for; leave out for your own account.' },
        units: { type: 'integer', minimum: 1, maximum: 25, description: 'Optional number of units in the position (default 1). The item liquidity tier caps it: tier A 25, B 10, C 3, D 1.' },
      },
      required: ['bookKey', 'maxCents', 'leverageX100'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, maxCents, leverageX100, subaccountId, units } = args as { bookKey: string; maxCents: number; leverageX100: number; subaccountId?: string; units?: number };
      return apiPost('/v1/vault-markets/longs', { bookKey, maxCents, leverageX100, subaccountId, units });
    },
  },
  {
    name: 'cover_vault_markets_short',
    description: 'Cover a short: all its units, or units of them, each buying any unit of its book key into the vault for up to maxCents; each goes back to its lender.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('Position'), maxCents: CENTS('Highest price you pay for each covering unit'), units: { type: 'integer', minimum: 1, maximum: 25, description: 'Optional number of the position units to close (default all of them); each closes as its own one-unit row.' } },
      required: ['id', 'maxCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, maxCents, units } = args as { id: string; maxCents: number; units?: number };
      return apiPost(`/v1/vault-markets/positions/${encodeURIComponent(id)}/cover`, { maxCents, units });
    },
  },
  {
    name: 'close_vault_markets_long',
    description: 'Close a leveraged long: all its units, or units of them, each sold for at least minCents; each sale repays the pool first and the rest is yours.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('Position'), minCents: CENTS('Lowest price each unit may sell for'), units: { type: 'integer', minimum: 1, maximum: 25, description: 'Optional number of the position units to close (default all of them); each closes as its own one-unit row.' } },
      required: ['id', 'minCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, minCents, units } = args as { id: string; minCents: number; units?: number };
      return apiPost(`/v1/vault-markets/positions/${encodeURIComponent(id)}/close`, { minCents, units });
    },
  },
  {
    name: 'add_vault_markets_collateral',
    description: 'Answer a margin call (a position whose status is "called"): a short posts more collateral, in cash or CBX at half its value; a leveraged long pays down its pool loan with the cash. Returns the position.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('Position'),
        usdCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: 'Cash to add from your custodian account, in cents of US dollars (the currency).' },
        cbxValueCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: 'Optional CBX to post by its value, in cents of US dollars (the currency); shorts only, counts at half.' },
      },
      required: ['id', 'usdCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, usdCents, cbxValueCents } = args as { id: string; usdCents: number; cbxValueCents?: number };
      return apiPost(`/v1/vault-markets/positions/${encodeURIComponent(id)}/collateral`, { usdCents, cbxValueCents });
    },
  },
  {
    name: 'cancel_vault_markets_order',
    description: "Cancel a position's working order: an unfilled opening order cancels the position; an unfilled cover or close leaves the position open. Returns { ok }.",
    inputSchema: { type: 'object', properties: { id: ID('Position') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/positions/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'list_vault_markets_alerts',
    description: 'Your price alerts on book keys.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/alerts', {}),
  },
  {
    name: 'create_vault_markets_alert',
    description: "Alert me when a book key's market price goes above or below a price. Fires once. At most 50 live alerts.",
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        direction: { type: 'string', enum: ['above', 'below'], description: '"above" fires when the market price rises to or past the threshold; "below" fires when it falls to or under it.' },
        thresholdCents: CENTS('The price that triggers the alert'),
      },
      required: ['bookKey', 'direction', 'thresholdCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, direction, thresholdCents } = args as { bookKey: string; direction: 'above' | 'below'; thresholdCents: number };
      return apiPost('/v1/vault-markets/alerts', { bookKey, direction, thresholdCents });
    },
  },
  {
    name: 'delete_vault_markets_alert',
    description: 'Delete a price alert. Returns { ok }.',
    inputSchema: { type: 'object', properties: { id: ID('Alert') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/vault-markets/alerts/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'get_vault_markets_pool',
    description: 'The CBX market staking pool that funds leverage: size, value, what it lends, utilisation, rate and insurance fund (money in cents).',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/pool', {}),
  },
  {
    name: 'list_vault_markets_stakes',
    description: 'Your stakes in the market pool and what each redeems for now.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/pool/stakes', {}),
  },
  {
    name: 'stake_vault_markets_pool',
    description: 'Stake CBX you hold at the custodian into the market pool. Returns { stakeId, shares }.',
    inputSchema: {
      type: 'object',
      properties: { baseUnits: { type: 'string', description: 'How much CBX to stake, in CBX base units (the token currency\'s smallest unit) as a whole-number string.' } },
      required: ['baseUnits'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { baseUnits } = args as { baseUnits: string };
      return apiPost('/v1/vault-markets/pool/stakes', { baseUnits });
    },
  },
  {
    name: 'unstake_vault_markets_pool',
    description: 'Unstake: the stake is paid out after the 7-day cooldown. Returns { cooldownUntil }.',
    inputSchema: { type: 'object', properties: { id: ID('Stake') }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/pool/stakes/${encodeURIComponent(id)}/unstake`, {});
    },
  },
];
