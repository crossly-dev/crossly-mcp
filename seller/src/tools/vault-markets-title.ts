import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault title, proof of reserves, the lending desk and the licensed index
 * feed (api routes/v1/write/vault-markets-title.ts). Warehouse receipts are
 * the document of title for a vault unit; the unit list and the daily
 * proof-of-reserves Merkle root are public and each owner can check their
 * own inclusion proof. Money is integer cents of US dollars; rates are bps
 * (100 = 1%). Crossly is the index licensor and data feed only.
 */
const DAY = { type: 'string', description: 'A UTC day, YYYY-MM-DD.' } as const;
const BOOK_KEY = { type: 'string', description: 'A book key: variantId:condition:gradeKey (grade "-" when ungraded).' } as const;
const SLUG: ToolDef['inputSchema'] = { type: 'object', properties: { slug: { type: 'string', description: 'A built-in index slug (user-made indexes are never licensed).' } }, required: ['slug'], additionalProperties: false };
const TERM = { type: ['integer', 'null'], enum: [30, 90, null], description: 'A fixed-rate term loan of 30 or 90 days (not recallable before term); omit for an open loan.' } as const;

const q = (args: Record<string, unknown>) => Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined && v !== null));

export const vaultMarketsTitleTools: ToolDef[] = [
  {
    name: 'get_vault_unit_list',
    description: 'The published vault unit list (bar-list equivalent): each unit on a shelf with its warehouse receipt number, book key, shelf location code, insured value, status, pledged / on-loan flags and a per-receipt hashed holder. Paged.',
    inputSchema: { type: 'object', properties: { bookKey: BOOK_KEY, page: { type: 'integer', minimum: 1, maximum: 100000, description: 'Page number, 1-based; default 1.' }, limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Units per page, 1-1000; default 200.' } }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault/unit-list', q(args)),
  },
  {
    name: 'list_my_vault_receipts',
    description: 'Your warehouse receipts (documents of title for your vault units), live first; meta.receipts says whether receipts are registered.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault/receipts'),
  },
  {
    name: 'get_vault_receipt',
    description: 'One of your receipts with its hash chain (issued / transferred / pledged / released / surrendered), re-verified on read: chain.ok is false if any event was altered.',
    inputSchema: { type: 'object', properties: { receiptNo: { type: 'string', description: 'e.g. CVL-00000001' } }, required: ['receiptNo'], additionalProperties: false },
    handler: (args) => { const { receiptNo } = args as { receiptNo: string }; return apiGet(`/v1/vault/receipts/${encodeURIComponent(receiptNo)}`); },
  },
  {
    name: 'get_vault_attestations',
    description: 'Vault attestations: independent physical counts, the insurance certificate (with a warning when insured value exceeds its limits), SOC 1 Type II and SOC 2 reports, each with its document.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault/attestations'),
  },
  {
    name: 'get_proof_of_reserves',
    description: 'Proof of reserves: the latest daily Merkle root over every unit in custody, its counts (stored, listed, grading, withdrawing, pledged, on loan, open loans, receipts, insured value), its Solana memo anchor when anchoring is on, the last `days` roots, and the exact hashing method.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 400, description: 'How many recent daily roots to include in the history, 1-400; default 30.' } }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/proof-of-reserves', q(args)),
  },
  {
    name: 'get_proof_of_reserves_day',
    description: 'One day\'s proof-of-reserves snapshot: root, counts, anchor.',
    inputSchema: { type: 'object', properties: { day: DAY }, required: ['day'], additionalProperties: false },
    handler: (args) => { const { day } = args as { day: string }; return apiGet(`/v1/vault-markets/proof-of-reserves/${encodeURIComponent(day)}`); },
  },
  {
    name: 'get_proof_of_reserves_leaves',
    description: 'One day\'s leaf hashes in tree order, a page at a time, to recount the units and rebuild the root independently.',
    inputSchema: { type: 'object', properties: { day: DAY, page: { type: 'integer', minimum: 1, maximum: 100000, description: 'Page number, 1-based; default 1.' }, limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Leaf hashes per page, 1-1000; default 200.' } }, required: ['day'], additionalProperties: false },
    handler: (args) => {
      const { day, ...rest } = args as { day: string; page?: number; limit?: number };
      return apiGet(`/v1/vault-markets/proof-of-reserves/${encodeURIComponent(day)}/leaves`, q(rest));
    },
  },
  {
    name: 'get_my_reserves_proof',
    description: 'Your inclusion proofs for a day (latest by default): each unit\'s leaf fields, salt, owner commitment, leaf hash and sibling path. Verify locally with your OWN user id against the published root.',
    inputSchema: { type: 'object', properties: { day: DAY }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/proof-of-reserves/me', q(args)),
  },
  {
    name: 'quote_vault_locate',
    description: 'A locate quote: how many units of a book key you could borrow now (up to qty), the indicative rate (APR bps) and the collateral needed (150%, or 175% where the lender elected return in kind only). Holds nothing.',
    inputSchema: { type: 'object', properties: { key: BOOK_KEY, qty: { type: 'integer', minimum: 1, maximum: 50, description: 'Units you want to borrow, 1-50; default 1. The quote says how many are available now, up to this.' }, termDays: { type: 'integer', enum: [30, 90], description: 'Quote a fixed-rate term loan: 30 = 30-day term, 90 = 90-day term (not recallable before term). Leave out to quote an open loan.' } }, required: ['key'], additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/locates', q(args)),
  },
  {
    name: 'hold_vault_locate',
    description: 'Hold up to qty lendable units of a book key for 15 minutes so a short can open against them. Needs the lending registration and the ID check.',
    inputSchema: { type: 'object', properties: { bookKey: BOOK_KEY, qty: { type: 'integer', minimum: 1, maximum: 50, description: 'Units to hold, 1-50 (required). Fewer may be held if fewer are lendable; the result says how many.' }, termDays: TERM }, required: ['bookKey', 'qty'], additionalProperties: false },
    handler: (args) => apiPost('/v1/vault-markets/locates', args),
  },
  {
    name: 'list_my_vault_locates',
    description: 'Your locates, newest first (held / used / released / expired).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/locates/mine'),
  },
  {
    name: 'release_vault_locate',
    description: 'Release a live locate before it lapses.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Locate id (uuid).' } }, required: ['id'], additionalProperties: false },
    handler: (args) => { const { id } = args as { id: string }; return apiDelete(`/v1/vault-markets/locates/${encodeURIComponent(id)}`); },
  },
  {
    name: 'get_lender_election',
    description: 'Your lender election: returnInKind (shorts post 175% collateral, 14-day buy-in, never cash-settled) and allowTerm (30/90-day fixed-rate term loans, not recallable before term).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/lending/election'),
  },
  {
    name: 'set_lender_election',
    description: 'Change your lender election; applies to loans opened afterwards.',
    inputSchema: { type: 'object', properties: { returnInKind: { type: 'boolean', description: 'true = your lent units must come back in kind only: shorts post 175% collateral, face a 14-day buy-in and are never cash-settled. false = standard 150% collateral. Leave out to keep the current setting.' }, allowTerm: { type: 'boolean', description: 'true = your units may go out on 30- or 90-day fixed-rate term loans, not recallable before term. false = open loans only. Leave out to keep the current setting. At least one of returnInKind / allowTerm is required.' } }, additionalProperties: false },
    handler: (args) => apiPut('/v1/vault-markets/lending/election', args),
  },
  {
    name: 'get_lender_collateral_statement',
    description: 'Your daily collateral statement as a lender (today, or a past day): per open loan the mark and quality, fees owed to you, the short\'s collateral share and its coverage against 105% of mark + fees.',
    inputSchema: { type: 'object', properties: { day: DAY }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/lending/statement', q(args)),
  },
  {
    name: 'list_lender_statements',
    description: 'The days you have stored lender collateral statements for, with their summary.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/lending/statements'),
  },
  {
    name: 'get_lender_programme',
    description: 'Your lender programme report: lendable units, units out, utilisation, fee revenue, term and return-in-kind loans in force, and each loan\'s rate against today\'s curve.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/lending/programme'),
  },
  {
    name: 'get_index_feed',
    description: 'The licensed index feed for a built-in index (partner DCM registration needed): level now (intraday or last close, with coverage), last close, frozen 7-day TWAP settlement value, and every constituent\'s mark source, quality and trade count. The HTTP response is HMAC-signed.',
    inputSchema: SLUG,
    handler: (args) => { const { slug } = args as { slug: string }; return apiGet(`/v1/vault-markets/index-feed/${encodeURIComponent(slug)}`); },
  },
  {
    name: 'get_index_settlement_series',
    description: 'The frozen 7-day TWAP settlement series for a licensed index (never restated), with the closes behind each value.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'A built-in index slug (user-made indexes are never licensed).' }, days: { type: 'integer', minimum: 1, maximum: 730, description: 'How many recent daily settlement values to return, 1-730; default 90.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string; days?: number };
      return apiGet(`/v1/vault-markets/index-feed/${encodeURIComponent(slug)}/settlement`, q(rest));
    },
  },
  {
    name: 'get_index_funding_reference',
    description: 'Reference funding for a perpetual-style future on an index: premiumBps through F = P + clamp(I - P, ±0.05%) per 8h with |F| capped at 0.5%/day. The partner DCM computes and settles funding.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'A built-in index slug (user-made indexes are never licensed).' }, premiumBps: { type: 'number', minimum: -10000, maximum: 10000, description: 'Your premium P in basis points (100 = 1%): the TWAP of (impact mid - index) / index for the future. -10000 to 10000; required.' }, interestBps: { type: 'number', minimum: -100, maximum: 100, description: 'Interest component I in basis points per 8h period (100 = 1%), -100 to 100; default 1 bp per 8h.' } }, required: ['slug', 'premiumBps'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string; premiumBps: number; interestBps?: number };
      return apiGet(`/v1/vault-markets/index-feed/${encodeURIComponent(slug)}/funding`, q(rest));
    },
  },
  {
    name: 'list_my_index_licences',
    description: 'Your index feed licences as Crossly ops recorded them, with the indexes each covers (null = every licensed index). Without one the feed answers 403 not_a_licensee.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/index-licence/mine'),
  },
  {
    name: 'get_index_licence_usage',
    description: 'Your licensed index feed reads over a window, per index and endpoint.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 366, description: 'Window length in days, counting back from now, 1-366; default 30.' } }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/index-licence/usage', q(args)),
  },
];
