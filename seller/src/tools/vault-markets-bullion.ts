import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets bullion keys and spot-pegged maker quotes (api
 * routes/v1/write/vault-markets-bullion.ts). A key family is metal + form +
 * size + mint (or any mint) and groups the bullion catalogue so there is one
 * market for "an ounce of gold"; trading stays per book key. Spot is a
 * REFERENCE only, labelled "Spot (reference, not a Crossly price)": never
 * present it as a Crossly price. A pegged quote is "spot plus or minus N
 * cents or basis points"; it rests as a pro limit order re-priced every spot
 * tick and is pulled while spot is stale. Money is integer cents of US
 * dollars; spot is cents of US dollars per troy ounce of pure metal.
 */
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded. Take it from the books of get_vault_markets_bullion_key.',
} as const;
const KIND = {
  type: 'string',
  enum: ['spot_plus_cents', 'spot_plus_bps'],
  description: 'How the quote follows spot: "spot_plus_cents" (melt plus premiumCents per unit) or "spot_plus_bps" (melt plus premiumBps basis points).',
} as const;
const PREMIUM_CENTS = { type: 'integer', minimum: -500000, maximum: 500000, description: 'For spot_plus_cents: the premium per unit over melt, in cents of US dollars; negative = under spot (e.g. -2000 = spot minus $20.00).' } as const;
const PREMIUM_BPS = { type: 'integer', minimum: -5000, maximum: 5000, description: 'For spot_plus_bps: the premium over melt in basis points (100 = 1%); negative = under spot.' } as const;
const FLOOR = { type: 'integer', minimum: 100, description: 'Optional lowest price per unit a seller accepts, in cents of US dollars.' } as const;
const CAP = { type: 'integer', minimum: 100, description: 'Optional highest price per unit a buyer pays, in cents of US dollars.' } as const;

export const vaultMarketsBullionTools: ToolDef[] = [
  {
    name: 'list_vault_markets_bullion_keys',
    description: 'Bullion key families (metal, form, size, mint or any mint) with vault units, best resting bid and ask across their books in cents of US dollars, and spot as a labelled reference (never a Crossly price) with one unit of metal valued at it.',
    inputSchema: {
      type: 'object',
      properties: {
        metal: { type: 'string', enum: ['gold', 'silver', 'platinum', 'palladium'], description: 'Only this metal: "gold", "silver", "platinum" or "palladium".' },
        form: { type: 'string', enum: ['bullion_coin', 'bar', 'round'], description: 'Only this form: "bullion_coin", "bar" or "round".' },
        size: { type: 'string', description: 'Only this nominal size slug, e.g. "1oz", "1-10oz", "10oz", "1kg", "100g".' },
        anyMint: { type: 'boolean', description: 'true = only the any-mint families.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { metal, form, size, anyMint } = args as { metal?: string; form?: string; size?: string; anyMint?: boolean };
      return apiGet('/v1/vault-markets/bullion/keys', { metal, form, size, anyMint: anyMint === undefined ? undefined : String(anyMint) });
    },
  },
  {
    name: 'get_vault_markets_bullion_key',
    description: 'One bullion key family: its catalogue products, every live book key with best bid, best ask, vault units and its mark (built from the book only; spot never sets it), live pegged quote counts, and spot as a labelled reference.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The family slug from list_vault_markets_bullion_keys, e.g. "gold-bullion_coin-1oz-any".' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      const s = encodeURIComponent(slug);
      return apiGet(`/v1/vault-markets/bullion/keys/${s}`);
    },
  },
  {
    name: 'get_vault_markets_bullion_families_for',
    description: 'Which bullion key families a book key belongs to, with spot for its metal as a labelled reference and the melt value of one unit at that spot in cents of US dollars. Empty families when the item is not keyed bullion.',
    inputSchema: { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/bullion/for', args as Record<string, unknown>),
  },
  {
    name: 'preview_vault_markets_bullion_peg',
    description: 'The price a spot-pegged quote would rest at right now, in cents of US dollars, from fresh spot only. priceCents is null while spot is stale or missing: such a quote waits off the book.',
    inputSchema: {
      type: 'object',
      properties: { bookKey: BOOK_KEY, kind: KIND, premiumCents: PREMIUM_CENTS, premiumBps: PREMIUM_BPS, floorCents: FLOOR, capCents: CAP },
      required: ['bookKey', 'kind'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/bullion/pegs/preview', args as Record<string, unknown>),
  },
  {
    name: 'list_vault_markets_bullion_pegs',
    description: 'Your spot-pegged quotes: side, units, filled, the peg in words, the order it rests as, the last price and spot it was priced from (cents of US dollars), and why it is pulled (spot_stale, or the reason the book refused it).',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['live', 'all'], description: '"live" (active or pulled, the default) or "all" (also filled and stopped).' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/bullion/pegs', args as Record<string, unknown>),
  },
  {
    name: 'set_vault_markets_bullion_peg',
    description: 'Set a spot-pegged maker quote on a bullion book key: it rests as a pro limit order at melt plus the premium, clamped to floor and cap, re-priced every spot tick and pulled off the book while spot is stale. Replaces your live quote on the same key and side. It is your own money and risk. Needs a verified ID; only set it when the user asked for it.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: BOOK_KEY,
        side: { type: 'string', enum: ['buy', 'sell'], description: '"buy" (a bid) or "sell" (an ask on units you hold in the vault).' },
        quantity: { type: 'integer', minimum: 1, maximum: 50, description: 'Units (1-50).' },
        kind: KIND,
        premiumCents: PREMIUM_CENTS,
        premiumBps: PREMIUM_BPS,
        floorCents: FLOOR,
        capCents: CAP,
        funding: { type: 'string', enum: ['card', 'custodian'], description: 'How a buy is paid: "card" (give stripePaymentMethodId) or "custodian" (your Vault Markets custodian account). Ignored for a sell.' },
        stripePaymentMethodId: { type: 'string', description: 'Stripe payment method id (pm_...) of one of your saved cards, for funding "card".' },
      },
      required: ['bookKey', 'side', 'quantity', 'kind'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/bullion/pegs', args),
  },
  {
    name: 'stop_vault_markets_bullion_peg',
    description: 'Stop a spot-pegged quote: its resting order comes off the book; units already filled stay filled.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Pegged quote id (uuid) from list_vault_markets_bullion_pegs.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      const pid = encodeURIComponent(id);
      return apiDelete(`/v1/vault-markets/bullion/pegs/${pid}`);
    },
  },
  {
    name: 'list_vault_markets_bullion_family_pegs',
    description: 'Your family-wide spot-pegged quotes: one quote resting across a bullion family books at one condition, with units left, the peg in words, status ("active", "filled" or "stopped") and every leg (the pegged quote on each book, with the order it rests as).',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['live', 'all'], description: '"live" (active, the default) or "all" (also filled and stopped).' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/bullion/family-pegs', args as Record<string, unknown>),
  },
  {
    name: 'set_vault_markets_bullion_family_peg',
    description: 'Set a family-wide spot-pegged quote: one quote such as "buy any 1 oz gold coin at spot plus $40" resting on each product book of a bullion family at one condition. When any leg fills it comes off the others and goes back on only for what is left; two fills at once are settled one at a time against what is left. A bid pays from the custodian account; a sell uses units you hold in the vault. It is your own money and risk. Needs a verified ID; only set it when the user asked for it.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The family slug, from list_vault_markets_bullion_keys (for example gold-bullion_coin-1oz-any).' },
        condition: { type: 'string', enum: ['DS', 'VNDS', 'Used'], description: 'The condition every leg rests in: "DS" (brilliant uncirculated or sealed), "VNDS" (handled) or "Used" (circulated).' },
        side: { type: 'string', enum: ['buy', 'sell'], description: '"buy" (bid) or "sell" (ask on units you hold in the vault).' },
        quantity: { type: 'integer', minimum: 1, maximum: 50, description: 'Units across the whole family (1-50).' },
        kind: KIND,
        premiumCents: PREMIUM_CENTS,
        premiumBps: PREMIUM_BPS,
        floorCents: FLOOR,
        capCents: CAP,
        funding: { type: 'string', enum: ['custodian'], description: 'How a bid is paid: "custodian" (your Vault Markets custodian account; a card is not allowed for a family bid). Ignored for a sell.' },
      },
      required: ['slug', 'condition', 'side', 'quantity', 'kind'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/bullion/family-pegs', args),
  },
  {
    name: 'stop_vault_markets_bullion_family_peg',
    description: 'Stop a family-wide quote: every leg order comes off the book; units already filled stay filled.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Family quote id (uuid) from list_vault_markets_bullion_family_pegs.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      const fid = encodeURIComponent(id);
      return apiDelete(`/v1/vault-markets/bullion/family-pegs/${fid}`);
    },
  },
];
