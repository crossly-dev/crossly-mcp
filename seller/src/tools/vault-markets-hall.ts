import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Hall of Grails loans of vault units (api routes/v1/write/vault-markets-hall-loans.ts):
 * a holder lends a unit in their Crossly vault to the Hall of Grails in
 * Crossly World. Display rights only: the unit never moves and stays theirs to
 * list, sell or withdraw. It earns reputation and a badge, never cash.
 */
export const vaultMarketsHallTools: ToolDef[] = [
  {
    name: 'list_vault_markets_hall_lenders',
    description: 'The vault units lent to this week Hall of Grails exhibition and on show now: each item (skuId, name, imageUrl, grade), the lender as the plate names them (a display name, or "a collector"), the plate lines and how many exhibitions the unit has stood in. meta.exhibition names the week. No ids or amounts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/hall/lenders', {}),
  },
  {
    name: 'get_vault_markets_hall_desk',
    description: 'The caller Hall of Grails desk: this week exhibition, the rules (maxLive loans at a time, shownPerHolder per exhibition, repPoints reputation per exhibition shown), loans (status "active", "ending" or "ended"; onShowNow; showingUntil; exhibitions; next exhibition it fits; badge) and the vault units they could lend (canLend, or blocker in words). Display only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/hall/loans', {}),
  },
  {
    name: 'lend_vault_unit_to_hall',
    description: 'Lend one of the caller vault units to the Hall of Grails: a standing loan of display rights only. It goes on a plinth under a plate naming them in every weekly exhibition its category fits; it never moves and stays theirs to list, sell or withdraw. Earns reputation, no cash. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: { type: 'string', description: 'The vault unit to lend (from get_vault_markets_hall_desk eligible, where canLend is true).' },
        credit: { type: 'string', enum: ['name', 'anonymous'], description: '"name": the plate shows the caller display name; "anonymous": it says "a collector". Defaults to "name".' },
      },
      required: ['vaultItemId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, credit } = args as { vaultItemId: string; credit?: 'name' | 'anonymous' };
      return apiPost('/v1/vault-markets/hall/loans', { vaultItemId, credit: credit ?? 'name' });
    },
  },
  {
    name: 'opt_out_vault_hall_loan',
    description: 'Opt one of the caller Hall of Grails loans out. A unit on a plinth this week finishes this exhibition (status "ending" with showingUntil); otherwise the loan ends at once (status "ended"). Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The Hall loan id (from get_vault_markets_hall_desk loans).' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/vault-markets/hall/loans/${encodeURIComponent(id)}/opt-out`, {});
    },
  },
  {
    name: 'set_vault_hall_loan_credit',
    description: 'Change how the plate on a lent unit plinth names the caller, from now: "name" (their display name) or "anonymous" ("a collector").',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The Hall loan id (from get_vault_markets_hall_desk loans).' },
        credit: { type: 'string', enum: ['name', 'anonymous'], description: '"name": show the caller display name; "anonymous": show "a collector".' },
      },
      required: ['id', 'credit'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, credit } = args as { id: string; credit: 'name' | 'anonymous' };
      return apiPost(`/v1/vault-markets/hall/loans/${encodeURIComponent(id)}/credit`, { credit });
    },
  },
];
