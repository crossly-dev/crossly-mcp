import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Peer-to-peer perpetual vault loans, Blend-style (api routes/v1/write/
 * vault-markets-p2p.ts). A lender offers cash at a yearly rate against an
 * item (book key) or one vault unit; a borrower pledges a stored unit and the
 * custodian pays lender to borrower. No oracle, no liquidation, no pool: the
 * loan runs until the lender calls it, then any other lender can take it over
 * in a ~30 hour refinancing auction whose rate climbs to the ceiling. Repaid
 * or refinanced, the lender is paid in full; neither by the end, the unit
 * moves to the lender. Money is integer cents of US dollars; rates are bps a
 * year (100 = 1%). Crossly is only the venue and never holds the money.
 */
const LOAN_ID: ToolDef['inputSchema'] = { type: 'object', properties: { loanId: { type: 'string', description: 'The P2P loan id (uuid).' } }, required: ['loanId'], additionalProperties: false };
const REQUEST_ID = { type: 'string', description: 'Your own id for this call (letters, digits, _ . : -; up to 80): a retry with the same id never acts twice.' } as const;

const q = (args: Record<string, unknown>) => Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined && v !== null));

export const vaultMarketsP2pTools: ToolDef[] = [
  {
    name: 'get_p2p_loans_dashboard',
    description: 'Peer-to-peer vault loans at a glance: as a borrower what you owe now (principal plus interest to the second) and daily interest; as a lender what you are owed; called loans on each side; your open offers and the cash they still offer; the gates (custody, lending) and the rules (refinancing auction hours, rate ceiling, size bounds, call grace).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/p2p/dashboard'),
  },
  {
    name: 'list_p2p_loan_offers',
    description: 'The open P2P loan offers book, lowest rate first: cents per loan, rate (bps a year), loans left, expiry, and the item (book key) or one unit each lends against. Lender identities are never shown.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'Only offers on this item: a book key variantId:condition:gradeKey (grade "-" when ungraded).' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'At most this many offers, 1-500; default 200.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/p2p/offers', q(args)),
  },
  {
    name: 'list_my_p2p_loan_offers',
    description: 'Your own P2P loan offers, newest first, with status (open, filled, cancelled, expired) and how many loans each has funded.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/p2p/offers/mine'),
  },
  {
    name: 'create_p2p_loan_offer',
    description: 'Offer to lend to other collectors against their vault units: principalCents per loan at aprBps a year, against an item (bookKey) or one unit (vaultItemId), for up to maxLoans loans. Nothing is held: the custodian pays from your own account when a borrower takes it. You can call a loan after a day; if it is not repaid or refinanced by the end of the ~30 hour auction, the unit becomes yours. Needs a verified ID, an active Vault Markets account and the current lending terms.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'Lend against any unit of this item: a book key variantId:condition:gradeKey. Give this or vaultItemId, not both.' },
        vaultItemId: { type: 'string', description: 'Lend against this one vault unit (uuid). Give this or bookKey, not both.' },
        principalCents: { type: 'integer', minimum: 10000, maximum: 10000000, description: 'Cash per loan, in cents of US dollars ($100 to $100,000).' },
        aprBps: { type: 'integer', minimum: 1, maximum: 3600, description: 'The yearly interest rate in basis points (100 = 1%), at most 3600 (36%).' },
        maxLoans: { type: 'integer', minimum: 1, maximum: 20, description: 'How many loans this offer funds, 1-20; default 1 (always 1 for a one-unit offer).' },
        expiresInDays: { type: 'integer', minimum: 1, maximum: 90, description: 'Days the offer stays open, 1-90; default 90.' },
        note: { type: 'string', description: 'A short note shown with the offer (up to 300 characters).' },
      },
      required: ['principalCents', 'aprBps'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/p2p/offers', args),
  },
  {
    name: 'cancel_p2p_loan_offer',
    description: 'Withdraw one of your open P2P loan offers. Loans already taken from it carry on.',
    inputSchema: { type: 'object', properties: { offerId: { type: 'string', description: 'The offer id (uuid).' } }, required: ['offerId'], additionalProperties: false },
    handler: (args) => { const { offerId } = args as { offerId: string }; return apiPost(`/v1/vault-markets/p2p/offers/${encodeURIComponent(offerId)}/cancel`, {}); },
  },
  {
    name: 'take_p2p_loan_offer',
    description: 'Borrow from another collector: take a P2P loan offer against one of your stored vault units. The unit is pledged (it cannot be listed, lent or withdrawn) and the principal is paid into your custodian account. Interest accrues by the second; repay any time. If the lender calls it and nobody refinances it and you do not repay within about 30 hours, the unit goes to the lender. Needs a verified ID, an active account and the current lending terms.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'The offer to take (uuid), from list_p2p_loan_offers or get_my_p2p_units.' },
        vaultItemId: { type: 'string', description: 'Your stored vault unit to pledge (uuid); it must match the offer item.' },
        requestId: REQUEST_ID,
      },
      required: ['offerId', 'vaultItemId'],
      additionalProperties: false,
    },
    handler: (args) => { const { offerId, ...body } = args as { offerId: string; vaultItemId: string; requestId?: string }; return apiPost(`/v1/vault-markets/p2p/offers/${encodeURIComponent(offerId)}/take`, body); },
  },
  {
    name: 'get_my_p2p_units',
    description: 'Your vault units for P2P borrowing: whether each can be pledged now (and why not), the best offers covering it (lowest rate first), and its P2P loan when it has one.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/p2p/units'),
  },
  {
    name: 'list_my_p2p_loans',
    description: 'Your P2P loans: what is owed now, daily interest, status, the refinancing auction when called (rate now, payoff now, end time) and the item mark for information only (no price ever triggers anything on these loans).',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['borrower', 'lender', 'any'], description: 'borrower = loans you took, lender = loans you made, any = both (default).' },
        status: { type: 'string', enum: ['live', 'closed', 'all'], description: 'live = still running (default), closed = repaid / refinanced / foreclosed / cancelled, all = both.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/p2p/loans', q(args)),
  },
  {
    name: 'get_p2p_loan',
    description: 'One P2P loan with its money log (fund, repay, refinance and their custodian status). A loan in a running refinancing auction can be read by any lender, without the log.',
    inputSchema: LOAN_ID,
    handler: (args) => { const { loanId } = args as { loanId: string }; return apiGet(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}`); },
  },
  {
    name: 'repay_p2p_loan',
    description: 'Borrower: repay a P2P loan from your custodian account to the lender. Without amountCents, in full: principal plus interest to the second, and the unit is free once the custodian has the payment. With amountCents below what is owed, a part payment: interest first, then principal; it must be at least the interest owed now and at least $1, and the loan stays open on the principal left.',
    inputSchema: {
      type: 'object',
      properties: {
        loanId: { type: 'string', description: 'The P2P loan id (uuid).' },
        amountCents: { type: 'integer', minimum: 1, maximum: 100000000, description: 'Optional: pay this much now, in cents of US dollars (a part payment). Leave out to repay in full.' },
        requestId: REQUEST_ID,
      },
      required: ['loanId'],
      additionalProperties: false,
    },
    handler: (args) => { const { loanId, ...body } = args as { loanId: string; amountCents?: number; requestId?: string }; return apiPost(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}/repay`, body); },
  },
  {
    name: 'call_p2p_loan',
    description: 'Lender: call a P2P loan (once it is a day old). A refinancing auction runs for about 30 hours, the rate a new lender gets climbing to the ceiling. Repaid or refinanced, you are paid in full; neither by the end, the unit moves to your vault.',
    inputSchema: LOAN_ID,
    handler: (args) => { const { loanId } = args as { loanId: string }; return apiPost(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}/call`, {}); },
  },
  {
    name: 'cancel_p2p_loan_call',
    description: 'Lender: take back your call on a P2P loan before any other lender has taken it over. The refinancing auction stops and the loan carries on as before on its terms.',
    inputSchema: LOAN_ID,
    handler: (args) => { const { loanId } = args as { loanId: string }; return apiPost(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}/cancel-call`, {}); },
  },
  {
    name: 'open_p2p_refi_auction',
    description: 'Borrower: look for a cheaper lender for your P2P loan. A refinancing auction runs; the yearly rate a new lender gets climbs from startAprBps to just under your loan rate now, so the first lender to take it gives you the lowest rate anyone would. They pay your lender off and the loan carries on at that rate. If nobody takes it by the end, nothing changes.',
    inputSchema: {
      type: 'object',
      properties: {
        loanId: { type: 'string', description: 'Your P2P loan id (uuid); you must be the borrower and the loan active (not called).' },
        startAprBps: { type: 'integer', minimum: 1, description: 'Where the rate starts, in basis points a year (100 = 1%), below your loan rate. Default: half your loan rate.' },
        hours: { type: 'number', minimum: 1, maximum: 72, description: 'How long the search runs, 1-72 hours. Default 24.' },
      },
      required: ['loanId'],
      additionalProperties: false,
    },
    handler: (args) => { const { loanId, ...body } = args as { loanId: string; startAprBps?: number; hours?: number }; return apiPost(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}/refi-auction`, body); },
  },
  {
    name: 'cancel_p2p_refi_auction',
    description: 'Borrower: stop looking for a cheaper lender for your P2P loan before anyone has taken it over. The loan carries on unchanged.',
    inputSchema: LOAN_ID,
    handler: (args) => { const { loanId } = args as { loanId: string }; return apiPost(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}/refi-auction/cancel`, {}); },
  },
  {
    name: 'list_p2p_refinancing_auctions',
    description: 'Running P2P refinancing auctions, soonest to end first: lender calls (auction) and borrowers looking for a cheaper lender (refiAuction). The payoff now in cents, the yearly rate a new lender gets now (bps), when it ends, and the item.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/p2p/auctions'),
  },
  {
    name: 'refinance_p2p_loan',
    description: 'Take over a P2P loan in a refinancing auction (a lender call or a borrower search for a cheaper lender): you pay the old lender everything owed now from your custodian account, and it becomes your loan to the same borrower at the auction rate now. Needs a verified ID, an active account and the current lending terms.',
    inputSchema: {
      type: 'object',
      properties: {
        loanId: { type: 'string', description: 'The loan id (uuid) in a running refinancing auction, from list_p2p_refinancing_auctions.' },
        maxPayoffCents: { type: 'integer', minimum: 1, maximum: 100000000, description: 'Refuse if the payoff is above this, in cents of US dollars (it grows by the second).' },
        requestId: REQUEST_ID,
      },
      required: ['loanId'],
      additionalProperties: false,
    },
    handler: (args) => { const { loanId, ...body } = args as { loanId: string; maxPayoffCents?: number; requestId?: string }; return apiPost(`/v1/vault-markets/p2p/loans/${encodeURIComponent(loanId)}/refinance`, body); },
  },
];
