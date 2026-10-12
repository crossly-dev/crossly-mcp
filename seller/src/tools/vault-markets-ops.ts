import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets ops (api routes/v1/write/vault-markets-ops.ts): units move
 * between vaults (gifts to another user, gifts to Crossly Cares) without
 * leaving the shelf; money only ever moves through the order book. Also the
 * investor tax centre, scheduled vault auctions with proxy bidding, and
 * Instant Exit on one unit.
 *
 * The tax-year PDF is not a tool: it is a binary file, and a tool returns
 * text. get_vault_markets_tax returns its link; export_vault_markets_tax_csv
 * returns the same year as CSV text.
 */
const ID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const CENTS = (what: string) => ({ type: 'integer', minimum: 100, maximum: 100_000_000, description: `${what}, in cents of US dollars (the currency), a whole number.` }) as const;
const NULL_CENTS = (what: string) => ({ type: ['integer', 'null'], minimum: 100, maximum: 100_000_000, description: `Optional ${what}, in cents of US dollars (the currency), a whole number; null or left out = none.` }) as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;
const ID_ONLY = (what: string): ToolDef['inputSchema'] => ({ type: 'object', properties: { id: ID(what) }, required: ['id'], additionalProperties: false });
const UNIT_ONLY = (what: string): ToolDef['inputSchema'] => ({ type: 'object', properties: { vaultItemId: ID(what) }, required: ['vaultItemId'], additionalProperties: false });
const YEAR = { type: 'integer', minimum: 2020, maximum: 2100, description: 'The tax year (e.g. 2026). Default: the current year.' } as const;
const KIND = { type: 'string', enum: ['weekly', 'premier'], description: '"weekly" = the weekly event, ending Sunday; "premier" = the premier event, for units marked $10,000 or more.' } as const;

export const vaultMarketsOpsTools: ToolDef[] = [
  {
    name: 'gift_vault_markets_unit',
    description: 'Give a unit in your vault to another Crossly user (by @username or email). It stays on its shelf; they have 7 days to accept. ID needed above $1,000 at the mark. Returns { id, expiresAt }.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: ID('Vault unit to give'),
        to: { type: 'string', description: 'Who gets it: a Crossly @username / handle or an email address.' },
        note: { type: ['string', 'null'], description: 'Optional note to the recipient (up to 280 characters).' },
      },
      required: ['vaultItemId', 'to'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, to, note } = args as { vaultItemId: string; to: string; note?: string | null };
      return apiPost('/v1/vault-markets/gifts', { vaultItemId, to, note });
    },
  },
  {
    name: 'list_vault_markets_gifts',
    description: 'Gifts you sent and received, newest first, with their status.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/gifts', {}),
  },
  {
    name: 'accept_vault_markets_gift',
    description: 'Accept a gift: the unit becomes yours in place. Returns { status }.',
    inputSchema: ID_ONLY('Gift'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/gifts/${encodeURIComponent(id)}/accept`, {});
    },
  },
  {
    name: 'decline_vault_markets_gift',
    description: 'Decline a gift: the unit stays with the giver. Returns { status }.',
    inputSchema: ID_ONLY('Gift'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/gifts/${encodeURIComponent(id)}/decline`, {});
    },
  },
  {
    name: 'cancel_vault_markets_gift',
    description: 'Cancel a gift you sent, before it is accepted. Returns { status }.',
    inputSchema: ID_ONLY('Gift'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/gifts/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'donate_vault_markets_unit',
    description: 'Give a vault unit to Crossly Cares (once the charity can receive; otherwise the answer says why not). Returns { id, markCents }.',
    inputSchema: UNIT_ONLY('Vault unit to donate'),
    handler: (args) => {
      const { vaultItemId } = args as { vaultItemId: string };
      return apiPost('/v1/vault-markets/donations', { vaultItemId });
    },
  },
  {
    name: 'get_vault_markets_tax',
    description: 'Your tax year on the vault markets: units bought and sold with cost, proceeds, gain and term (in cents); lending fees, staking interest (estimate), market-maker rewards; closed positions. Includes links to the CSV and PDF files.',
    inputSchema: { type: 'object', properties: { year: YEAR }, additionalProperties: false },
    handler: (args) => {
      const { year } = args as { year?: number };
      return apiGet('/v1/vault-markets/tax', { year });
    },
  },
  {
    name: 'export_vault_markets_tax_csv',
    description: 'The tax year as CSV text: one row per sale, purchase, gift, income line and closed position.',
    inputSchema: { type: 'object', properties: { year: YEAR }, additionalProperties: false },
    handler: (args) => {
      const { year } = args as { year?: number };
      return apiGet('/v1/vault-markets/tax.csv', { year });
    },
  },
  {
    name: 'list_vault_markets_auctions',
    description: 'Open vault auction events and their lots, soonest ending first.',
    inputSchema: { type: 'object', properties: { kind: { ...KIND, description: `Optional filter. ${KIND.description}` } }, additionalProperties: false },
    handler: (args) => {
      const { kind } = args as { kind?: string };
      return apiGet('/v1/vault-markets/auctions', { kind });
    },
  },
  {
    name: 'list_my_vault_markets_auctions',
    description: 'Lots you consigned (with your reserve) and lots you bid on (with your maximum and whether you lead).',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/auctions/mine', {}),
  },
  {
    name: 'get_vault_markets_auction_lot',
    description: 'One auction lot: the price showing, the next minimum bid (in cents), whether a reserve exists and is met, the end (extended by late bids), the bid history and your standing.',
    inputSchema: ID_ONLY('Lot'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/auctions/lots/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'consign_vault_markets_auction_lot',
    description: 'Consign a stored, authenticated vault unit to the next weekly or premier auction, with an optional opening price and reserve. The unit is held until the close. Returns { lotId, eventId, endsAt }.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: ID('Vault unit to auction'),
        kind: { ...KIND, default: 'weekly', description: `Which event (default "weekly"). ${KIND.description}` },
        startCents: NULL_CENTS('opening price'),
        reserveCents: NULL_CENTS('reserve (the lot does not sell below it)'),
      },
      required: ['vaultItemId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, kind, startCents, reserveCents } = args as { vaultItemId: string; kind?: string; startCents?: number | null; reserveCents?: number | null };
      return apiPost('/v1/vault-markets/auctions/lots', { vaultItemId, kind, startCents, reserveCents });
    },
  },
  {
    name: 'withdraw_vault_markets_auction_lot',
    description: 'Withdraw your lot before any bid; the unit goes back on your shelf. Returns { ok }.',
    inputSchema: ID_ONLY('Lot'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/auctions/lots/${encodeURIComponent(id)}/withdraw`, {});
    },
  },
  {
    name: 'bid_vault_markets_auction_lot',
    description: "Leave or raise your maximum on a lot; the system bids for you up to it. A bid in the last 2 minutes extends the lot by 2 minutes. The winner's saved card is charged at the close. ID needed above $10,000.",
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('Lot'),
        maxCents: CENTS('Your maximum bid'),
        stripePaymentMethodId: { type: 'string', description: 'The saved card (Stripe payment method id, "pm_...") charged if you win.' },
      },
      required: ['id', 'maxCents', 'stripePaymentMethodId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, maxCents, stripePaymentMethodId } = args as { id: string; maxCents: number; stripePaymentMethodId: string };
      return apiPost(`/v1/vault-markets/auctions/lots/${encodeURIComponent(id)}/bids`, { maxCents, stripePaymentMethodId });
    },
  },
  {
    name: 'feature_vault_markets_auction_lot',
    description: 'Feature an open lot on your live show, or pass lotId null to take it off. Viewers see the pin change. Returns { ok }.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('Live show (live stream)'), lotId: { type: ['string', 'null'], description: 'The lot id (uuid) to feature, or null to clear the featured lot.' } },
      required: ['id', 'lotId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, lotId } = args as { id: string; lotId: string | null };
      return apiPost(`/v1/vault-markets/live-streams/${encodeURIComponent(id)}/featured-lot`, { lotId });
    },
  },
  {
    name: 'get_vault_markets_unit_quote',
    description: "The market around a vault unit: its mark and source, the best bid that could take it, the Instant Exit price (the best bid) and a pack pull's own sell-back credit. Prices in cents.",
    inputSchema: ID_ONLY('Vault unit'),
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/units/${encodeURIComponent(id)}/quote`, {});
    },
  },
  {
    name: 'sell_vault_markets_unit_now',
    description: 'Sell one unit of this item now into the best bid (an immediate-or-cancel pro order), never below minCents. Returns { status: filled | missed, filledCents, quote, order }.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('Vault unit'), minCents: NULL_CENTS('lowest price you accept') },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, minCents } = args as { id: string; minCents?: number | null };
      return apiPost(`/v1/vault-markets/units/${encodeURIComponent(id)}/sell-now`, minCents == null ? {} : { minCents });
    },
  },
];
