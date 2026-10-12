import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets institutional (api routes/v1/write/vault-markets-inst.ts):
 * entity accounts (members in roles, sub-accounts with limits, the firm kill
 * switch; KYB is the custodian partner's), three NAVs with an ASC 820 level
 * per holding, the risk report, capacity, TCA and execution quality, trade
 * confirmations and monthly statements. `subaccountId` reads a sub-account
 * you are a member of; leave it out for your own account. VaR and LVaR are
 * model figures: labelled, with n and a band, null below their threshold
 * ("Not enough Crossly trades"); they never feed margin, loans or settlement.
 * Money is integer cents of US dollars. Reads need vault-markets:read,
 * changes vault-markets:trade.
 */
const UUID = (what: string) => ({ type: 'string', description: `${what} id (uuid).` }) as const;
const SUB = { subaccountId: { type: 'string', description: 'Optional sub-account id (uuid) from list_vault_markets_accounts; leave out for your own account.' } } as const;
const SUB_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { ...SUB }, additionalProperties: false };
const WINDOW: ToolDef['inputSchema'] = {
  type: 'object',
  properties: {
    ...SUB,
    from: { type: 'string', description: 'Optional start, ISO 8601 with offset (e.g. 2026-07-01T00:00:00Z).' },
    to: { type: 'string', description: 'Optional end, ISO 8601 with offset; default now.' },
    limit: { type: 'integer', minimum: 1, maximum: 500, default: 200, description: 'Most rows to return, 1-500; default 200.' },
  },
  additionalProperties: false,
};
const LIMITS = {
  type: 'object',
  description: 'Limits; any field null or left out = no limit from this level. Never above the entity\'s caps.',
  properties: {
    maxOrderNotionalCents: { type: 'integer', minimum: 0 },
    maxUnitsPerKey: { type: 'integer', minimum: 0 },
    maxGrossCents: { type: 'integer', minimum: 0 },
    maxNetCents: { type: 'integer', minimum: 0 },
    maxLeverageX100: { type: 'integer', minimum: 100, maximum: 1000, description: '100 = no leverage.' },
  },
  additionalProperties: false,
} as const;
const sub = (a: Record<string, unknown>) => ({ subaccountId: a.subaccountId as string | undefined });
const PLAN = {
  type: 'array',
  minItems: 1,
  maxItems: 50,
  description: 'Units per sub-account; the lines must add up to the order quantity. The first line leads (it pays, and holds the units until each share of the cash has moved).',
  items: {
    type: 'object',
    properties: { subaccountId: { type: 'string', description: 'Sub-account id (uuid) of the same entity, one you may trade.' }, quantity: { type: 'integer', minimum: 1, maximum: 500, description: 'Units for this sub-account, 1 or more.' } },
    required: ['subaccountId', 'quantity'],
    additionalProperties: false,
  },
} as const;

export const vaultMarketsInstTools: ToolDef[] = [
  {
    name: 'list_vault_markets_accounts',
    description: 'Every account you can act on: your own and each entity sub-account your memberships reach, with your role.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/accounts', {}),
  },
  {
    name: 'list_vault_markets_entities',
    description: 'The entities (funds, LLCs, trusts, SPVs) you belong to, and invitations waiting for you.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/entities', {}),
  },
  {
    name: 'get_vault_markets_entity',
    description: 'One entity: KYB status (the custodian\'s), members and roles, sub-accounts and limits, firm halts, caps.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity') }, required: ['id'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}`, {}),
  },
  {
    name: 'create_vault_markets_entity',
    description: 'Open an entity account: you become its admin and the custodian partner starts KYB in its own flow. Needs a verified ID and the custodian to be connected.',
    inputSchema: {
      type: 'object',
      properties: {
        legalName: { type: 'string', minLength: 2, maxLength: 200, description: 'The registered legal name of the entity, exactly as on its formation documents (2-200 characters).' },
        entityType: { type: 'string', enum: ['lp', 'llc', 'corp', 'trust', 'spv'], description: 'Legal form: "lp" = limited partnership (e.g. a fund), "llc" = limited liability company, "corp" = corporation, "trust" = trust, "spv" = special purpose vehicle.' },
        jurisdiction: { type: 'string', description: 'Where it is formed, e.g. "Delaware, US".' },
        lei: { type: 'string', description: 'Optional 20-character Legal Entity Identifier.' },
        taxClassification: { type: 'string', maxLength: 80, description: 'Optional free-text tax classification, up to 80 characters (e.g. "partnership", "C corporation", "disregarded entity").' },
      },
      required: ['legalName', 'entityType', 'jurisdiction'],
      additionalProperties: false,
    },
    handler: (a) => apiPost('/v1/vault-markets/entities', a),
  },
  {
    name: 'invite_vault_markets_member',
    description: 'Admin: invite a Crossly user by email to an entity as admin, trader, risk, ops or viewer (a viewer can never place an order).',
    inputSchema: {
      type: 'object',
      properties: {
        id: UUID('Entity'),
        email: { type: 'string', maxLength: 320, description: 'Email address of the Crossly user to invite.' },
        role: { type: 'string', enum: ['admin', 'trader', 'risk', 'ops', 'viewer'], description: 'Their role in the entity: "admin" = trades, manages members, sub-accounts and limits, can halt, uploads administrator marks; "trader" = places orders within limits; "risk" = cannot trade but can halt and clear halts (kill switch); "ops" = cannot trade but can upload administrator marks; "viewer" = read-only (e.g. an administrator or auditor), can never place an order. Every role can read. Admin, trader and risk need a verified ID to accept.' },
        limits: LIMITS,
        subaccountIds: { type: 'array', items: { type: 'string' }, description: 'Sub-accounts they may act on; leave out for all.' },
      },
      required: ['id', 'email', 'role'],
      additionalProperties: false,
    },
    handler: (a) => {
      const { id, ...body } = a as { id: string } & Record<string, unknown>;
      return apiPost(`/v1/vault-markets/entities/${encodeURIComponent(id)}/members`, body);
    },
  },
  {
    name: 'answer_vault_markets_invitation',
    description: 'Accept or decline an invitation to an entity. Trading, admin and risk roles need a verified ID to accept.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), accept: { type: 'boolean', description: 'true = accept the invitation and join the entity in the invited role; false = decline it.' } }, required: ['id', 'accept'], additionalProperties: false },
    handler: (a) => apiPost(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}/invitation`, { accept: a.accept }),
  },
  {
    name: 'halt_vault_markets_entity',
    description: 'Admin or risk: the firm kill switch. Halts the whole entity, or one sub-account when subaccountId is given; open orders there are cancelled and no new ones are placed until cleared.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), reason: { type: 'string', minLength: 3, maxLength: 500, description: 'Why the halt is being applied (3-500 characters); recorded on the halt and in the audit trail.' }, ...SUB }, required: ['id', 'reason'], additionalProperties: false },
    handler: (a) => apiPost(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}/halts`, { reason: a.reason, subaccountId: a.subaccountId }),
  },
  {
    name: 'clear_vault_markets_entity_halt',
    description: 'Admin or risk: lift a firm halt.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), haltId: UUID('Halt') }, required: ['id', 'haltId'], additionalProperties: false },
    handler: (a) => apiPost(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}/halts/${encodeURIComponent(String(a.haltId))}/clear`, {}),
  },
  {
    name: 'refresh_vault_markets_entity_kyb',
    description: "Refresh an entity's KYB status from the custodian partner (and its onboarding link while KYB is still open). Crossly stores only the partner's reference and status.",
    inputSchema: { type: 'object', properties: { id: UUID('Entity') }, required: ['id'], additionalProperties: false },
    handler: (a) => apiPost(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}/kyb`, {}),
  },
  {
    name: 'attest_vault_markets_entity_ecp',
    description: "Admin: record the entity's attestation that it is an eligible contract participant (over $10M in assets). Raising its caps stays an ops decision.",
    inputSchema: { type: 'object', properties: { id: UUID('Entity') }, required: ['id'], additionalProperties: false },
    handler: (a) => apiPost(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}/ecp`, {}),
  },
  {
    name: 'update_vault_markets_member',
    description: "Admin: change a member's role, limits or which sub-accounts they may use. The last admin cannot be demoted.",
    inputSchema: {
      type: 'object',
      properties: {
        id: UUID('Entity'),
        memberId: UUID('Member'),
        role: { type: 'string', enum: ['admin', 'trader', 'risk', 'ops', 'viewer'], description: 'admin = manage members, sub-accounts and halts and trade; trader = place orders; risk = view and halt; ops = view and operate; viewer = read only, never places an order.' },
        limits: { ...LIMITS, description: 'Per-member limits held to the entity caps; null clears them.' },
        subaccountIds: { type: ['array', 'null'], items: { type: 'string' }, maxItems: 200, description: 'Sub-account ids (uuid) this member may act for; null = all.' },
      },
      required: ['id', 'memberId'],
      additionalProperties: false,
    },
    handler: (a) => {
      const { id, memberId, ...body } = a as { id: string; memberId: string; role?: string; limits?: unknown; subaccountIds?: string[] | null };
      return apiPatch(`/v1/vault-markets/entities/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, body);
    },
  },
  {
    name: 'remove_vault_markets_member',
    description: 'Admin: remove a member from an entity (or leave it yourself). An entity always keeps one admin.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), memberId: UUID('Member') }, required: ['id', 'memberId'], additionalProperties: false },
    handler: (a) => {
      const { id, memberId } = a as { id: string; memberId: string };
      return apiDelete(`/v1/vault-markets/entities/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`);
    },
  },
  {
    name: 'open_vault_markets_subaccount',
    description: 'Admin: open a sub-account once the custodian has approved the entity. Its limits are held to the entity caps.',
    inputSchema: {
      type: 'object',
      properties: {
        id: UUID('Entity'),
        name: { type: 'string', minLength: 1, maxLength: 80, description: 'Sub-account name (1-80 characters), e.g. the strategy or fund it books for.' },
        strategyTag: { type: ['string', 'null'], maxLength: 80, description: 'Optional strategy label (up to 80 characters) shown on reports.' },
        limits: { ...LIMITS, description: 'Optional limits for the sub-account, held to the entity caps; null = the entity caps.' },
      },
      required: ['id', 'name'],
      additionalProperties: false,
    },
    handler: (a) => {
      const { id, ...body } = a as { id: string; name: string; strategyTag?: string | null; limits?: unknown };
      return apiPost(`/v1/vault-markets/entities/${encodeURIComponent(id)}/subaccounts`, body);
    },
  },
  {
    name: 'set_vault_markets_subaccount_limits',
    description: "Admin: set a sub-account's limits (per-order notional, units per key, gross, net, leverage), held to the entity caps. limits: null clears them.",
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), subId: UUID('Sub-account'), limits: { ...LIMITS, description: 'The limits; null clears them back to the entity caps.' } }, required: ['id', 'subId', 'limits'], additionalProperties: false },
    handler: (a) => {
      const { id, subId, limits } = a as { id: string; subId: string; limits: unknown };
      return apiPut(`/v1/vault-markets/entities/${encodeURIComponent(id)}/subaccounts/${encodeURIComponent(subId)}/limits`, { limits });
    },
  },
  {
    name: 'close_vault_markets_subaccount',
    description: 'Admin: close a sub-account that holds nothing and has no open orders.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), subId: UUID('Sub-account') }, required: ['id', 'subId'], additionalProperties: false },
    handler: (a) => {
      const { id, subId } = a as { id: string; subId: string };
      return apiPost(`/v1/vault-markets/entities/${encodeURIComponent(id)}/subaccounts/${encodeURIComponent(subId)}/close`, {});
    },
  },
  {
    name: 'get_vault_markets_entity_audit',
    description: 'An entity\'s audit trail, newest first: hash-chained rows with actor, account, API key, IP, session and source.',
    inputSchema: { type: 'object', properties: { id: UUID('Entity'), beforeSeq: { type: 'integer', minimum: 1, description: 'Paging cursor: return only rows with a sequence number below this (pass the lowest seq from the previous page). Leave out for the newest rows.' }, limit: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Most rows to return, 1-500; default 100.' } }, required: ['id'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/vault-markets/entities/${encodeURIComponent(String(a.id))}/audit`, { beforeSeq: a.beforeSeq, limit: a.limit }),
  },
  {
    name: 'get_vault_markets_nav',
    description: 'Mark NAV, bid NAV (the resting bids) and liquidation NAV (bids at 20% of ADV for 10 days), holding by holding, each with its ASC 820 level, the mark\'s quality and source, and your administrator\'s price when uploaded.',
    inputSchema: SUB_ONLY,
    handler: (a) => apiGet('/v1/vault-markets/nav', sub(a)),
  },
  {
    name: 'get_vault_markets_nav_history',
    description: 'Daily NAV snapshots: mark, bid and liquidation NAV, Level 2 and Level 3 value.',
    inputSchema: { type: 'object', properties: { ...SUB, days: { type: 'integer', minimum: 1, maximum: 3650, default: 365, description: 'How many recent days of snapshots to return, 1-3650; default 365.' } }, additionalProperties: false },
    handler: (a) => apiGet('/v1/vault-markets/nav/history', { ...sub(a), days: a.days }),
  },
  {
    name: 'upload_vault_markets_admin_marks',
    description: 'Upload your fund administrator\'s prices. They are shown beside Crossly\'s marks, labelled as yours, and never change a Crossly figure.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SUB,
        administrator: { type: 'string', description: 'Who priced them (shown with each price).' },
        marks: { type: 'array', minItems: 1, maxItems: 5000, description: 'The administrator prices, 1-5000 rows: each is a book key, the UTC day it prices, and the price per unit in integer cents of US dollars.', items: { type: 'object', properties: { bookKey: { type: 'string', description: 'A book key: variantId:condition:gradeKey (grade "-" when ungraded).' }, day: { type: 'string', description: 'YYYY-MM-DD' }, cents: { type: 'integer', minimum: 0, description: 'Price per unit in integer cents of US dollars (1999 = $19.99).' } }, required: ['bookKey', 'day', 'cents'], additionalProperties: false } },
      },
      required: ['administrator', 'marks'],
      additionalProperties: false,
    },
    handler: (a) => apiPost('/v1/vault-markets/admin-marks', a),
  },
  {
    name: 'get_vault_markets_risk_report',
    description: 'Historical VaR 95/99 for 1 and 10 days and Bangia LVaR (model figures with n and a band; null below the data threshold), stress scenarios (category −30%, CBX −50%, books thin to 25%, index drawdowns), concentration and counterparty exposure.',
    inputSchema: SUB_ONLY,
    handler: (a) => apiGet('/v1/vault-markets/risk-report', sub(a)),
  },
  {
    name: 'get_vault_markets_capacity',
    description: 'Capacity from the book. Pass bookKey (and optional units) for a key\'s ADV, depth within ±5% of the mark, vault stock, lendable units and days to liquidate at 20% of ADV; or index + notional (cents) for how much of the basket the asks fill now and the days the rest needs.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'A book key (variantId:condition:gradeKey, grade "-" when ungraded) to size capacity for. Pass this, or index + notional.' },
        units: { type: 'integer', minimum: 1, maximum: 1000000, description: 'Optional with bookKey: a position size in units, for how many days it would take to liquidate at 20% of ADV.' },
        index: { type: 'string', description: 'An index slug from the indexes tools.' }, notional: { type: 'integer', minimum: 1, description: 'With index: basket size in integer cents of US dollars.' },
        bandBps: { type: 'integer', minimum: 50, maximum: 5000, description: 'Depth band around the mark; default 500 (5%).' },
      },
      additionalProperties: false,
    },
    handler: (a) => apiGet('/v1/vault-markets/capacity', a),
  },
  {
    name: 'get_vault_markets_tca',
    description: 'Your pro orders in a window with arrival mark and mid, average fill, implementation shortfall, slippage, fill rate and time to fill (positive bps cost you).',
    inputSchema: WINDOW,
    handler: (a) => apiGet('/v1/vault-markets/tca', a),
  },
  {
    name: 'get_vault_markets_order_tca',
    description: 'One order\'s TCA, including slippage against the VWAP of eligible trades while it worked.',
    inputSchema: { type: 'object', properties: { orderId: UUID('Pro order'), ...SUB }, required: ['orderId'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/vault-markets/tca/${encodeURIComponent(String(a.orderId))}`, sub(a)),
  },
  {
    name: 'get_vault_markets_execution_quality',
    description: 'The quarterly execution-quality report (Rule 605 style): fill rates, speed, effective vs quoted spread and shortfall by order type and size, and the busiest keys. The current quarter is provisional.',
    inputSchema: { type: 'object', properties: { quarter: { type: 'string', description: 'Like 2026-Q4; default the current quarter.' } }, additionalProperties: false },
    handler: (a) => apiGet('/v1/vault-markets/execution-quality', { quarter: a.quarter }),
  },
  {
    name: 'get_vault_markets_order_handling',
    description: 'How Vault Markets handles orders: one price-time book, self-trade prevention, protected market orders, liquidations by auction, halts, dealers and fees.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/order-handling', {}),
  },
  {
    name: 'list_vault_markets_confirmations',
    description: 'Trade confirmations for your fills in a window (default 31 days): price, sale fee, maker or taker, the order, the vault unit and its warehouse receipt.',
    inputSchema: WINDOW,
    handler: (a) => apiGet('/v1/vault-markets/confirmations', a),
  },
  {
    name: 'get_vault_markets_confirmation',
    description: 'One trade confirmation.',
    inputSchema: { type: 'object', properties: { tradeId: UUID('Trade'), ...SUB }, required: ['tradeId'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/vault-markets/confirmations/${encodeURIComponent(String(a.tradeId))}`, sub(a)),
  },
  {
    name: 'list_vault_markets_statements',
    description: 'The last 24 months and whether each monthly statement is issued (frozen, with its sha256).',
    inputSchema: SUB_ONLY,
    handler: (a) => apiGet('/v1/vault-markets/statements', sub(a)),
  },
  {
    name: 'get_vault_markets_statement',
    description: 'A monthly statement: units held at month end with their marks, loans, pledges, positions, fills, fees and storage, and cash quoted from the custodian and labelled as its record.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Like 2026-10.' }, ...SUB }, required: ['month'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/vault-markets/statements/${encodeURIComponent(String(a.month))}`, sub(a)),
  },
  {
    name: 'set_vault_markets_usd_election',
    description: 'Admin only: elect USD for an entity. With usdOnly true its sub-accounts post collateral in USD only and pay every fee in USD, and each CBX reward paid to one of them is converted to USD by the custodian in that account (Crossly never holds the CBX). Audited; can be turned off again.',
    inputSchema: { type: 'object', properties: { entityId: UUID('Entity'), usdOnly: { type: 'boolean', description: 'true = elect USD (fees and collateral in USD only); false = end the election.' } }, required: ['entityId', 'usdOnly'], additionalProperties: false },
    handler: (args) => {
      const { entityId, usdOnly } = args as { entityId: string; usdOnly: boolean };
      return apiPut(`/v1/vault-markets/entities/${encodeURIComponent(entityId)}/usd-election`, { usdOnly });
    },
  },
  {
    name: 'list_vault_markets_reward_conversions',
    description: 'The custodian CBX-to-USD reward conversions for an entity that elected USD, newest first: reward instruction, status, amount in cents of US dollars and the sub-account custodian account.',
    inputSchema: { type: 'object', properties: { entityId: UUID('Entity') }, required: ['entityId'], additionalProperties: false },
    handler: (args) => {
      const { entityId } = args as { entityId: string };
      return apiGet(`/v1/vault-markets/entities/${encodeURIComponent(entityId)}/conversions`, {});
    },
  },
  {
    name: 'place_vault_markets_block',
    description: 'Place a block buy for an entity: one order booked to the first sub-account in plan (it pays from its custodian account), split across every plan line at the average price, fees included, once it is done and every payment is confirmed. Each share of the cash moves between the entity own custodian accounts and its units move only after that settles. Buys only.',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: UUID('Entity'),
        order: {
          type: 'object',
          description: 'The block order (a buy).',
          properties: {
            bookKey: { type: 'string', description: 'The book key: variantId:condition:gradeKey (gradeKey "-" when ungraded).' },
            side: { type: 'string', enum: ['buy'], description: '"buy" (blocks are buys only).' },
            type: { type: 'string', enum: ['limit', 'market', 'stop', 'stop_limit'], description: '"limit" = at limitCents or better (default); "market" = best price now, protected, never rests; "stop" = market once the price reaches stopCents; "stop_limit" = limit at limitCents once the price reaches stopCents.' },
            tif: { type: 'string', enum: ['gtc', 'gtd', 'ioc', 'fok'], description: '"gtc" = good till cancelled (default); "gtd" = good till expiresAt; "ioc" = fill what you can now, cancel the rest; "fok" = all now or nothing.' },
            quantity: { type: 'integer', minimum: 1, maximum: 50, description: 'Units in the block, 1-50; the plan lines must add up to it.' },
            limitCents: { type: 'integer', minimum: 100, description: 'Limit price per unit in cents of US dollars.' },
            stopCents: { type: 'integer', minimum: 100, description: 'Trigger price per unit in cents of US dollars (stop and stop_limit).' },
            expiresAt: { type: 'string', description: 'When a "gtd" order expires, ISO 8601.' },
            clientOrderId: { type: 'string', description: 'Optional id of your own (1-64 characters); placing again with it returns the first order.' },
          },
          required: ['bookKey', 'side', 'quantity'],
          additionalProperties: false,
        },
        plan: PLAN,
        note: { type: 'string', description: 'Optional note for the entity (up to 500 characters).' },
      },
      required: ['entityId', 'order', 'plan'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/blocks', args),
  },
  {
    name: 'list_vault_markets_blocks',
    description: 'An entity block orders, newest first, each with its plan and how it was allocated (units, average price, cash share in cents of US dollars, status).',
    inputSchema: { type: 'object', properties: { entityId: UUID('Entity'), limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Most blocks to return, 1-200; default 100.' } }, required: ['entityId'], additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/blocks', args),
  },
  {
    name: 'get_vault_markets_block',
    description: 'One block order with its plan lines: planned and allocated units, average price and cash share (cents of US dollars), and status ("planned", "units_moved", "allocated" or "needs_ops").',
    inputSchema: { type: 'object', properties: { orderId: UUID('Block order') }, required: ['orderId'], additionalProperties: false },
    handler: (args) => {
      const { orderId } = args as { orderId: string };
      return apiGet(`/v1/vault-markets/blocks/${encodeURIComponent(orderId)}`, {});
    },
  },
  {
    name: 'set_vault_markets_allocation',
    description: 'Post-trade allocation: set or replace the plan for a buy you placed for one of the entity sub-accounts (that sub-account leads and pays). Refused once any share has moved.',
    inputSchema: { type: 'object', properties: { orderId: UUID('Order'), plan: PLAN }, required: ['orderId', 'plan'], additionalProperties: false },
    handler: (args) => {
      const { orderId, plan } = args as { orderId: string; plan: Array<{ subaccountId: string; quantity: number }> };
      return apiPut(`/v1/vault-markets/blocks/${encodeURIComponent(orderId)}/allocation`, { plan });
    },
  },
  {
    name: 'allocate_vault_markets_block',
    description: 'Allocate a done block now (the keeper does it too). The outcome is "allocated", "waiting" (a payment or transfer is not settled yet), "nothing_filled" or "none".',
    inputSchema: { type: 'object', properties: { orderId: UUID('Block order') }, required: ['orderId'], additionalProperties: false },
    handler: (args) => {
      const { orderId } = args as { orderId: string };
      return apiPost(`/v1/vault-markets/blocks/${encodeURIComponent(orderId)}/allocate`, {});
    },
  },
];
