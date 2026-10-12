import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Hall of Grails in Crossly World: a museum of real catalogue items with
 * their live order book, a new exhibition every Monday (UTC). An exhibit is
 * bought, bid on or watched through the market tools by its skuId. Members can
 * lend pieces from their Crossly vault to the exhibition (display only).
 */
export const worldHallTools: ToolDef[] = [
  {
    name: 'get_world_hall',
    description:
      'The Hall of Grails in Crossly World: this week\'s exhibition (title, blurb, when it ends, what is next) and its exhibits -- ' +
      'up to twelve real catalogue items (skuId, name, brand, photo, retail, lowest ask and last sale from the live order book; ' +
      'loan: lender and grade when a member lent it). Use the market tools with an exhibit\'s skuId to see or buy it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/hall', {}),
  },
  {
    name: 'get_hall_loans',
    description:
      'Lend to the Hall: this week\'s exhibition, the caller\'s loans on show, and the pieces in their Crossly vault they could lend ' +
      '(held, not pledged, in the exhibition\'s category).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/hall/loans', {}),
  },
  {
    name: 'lend_to_hall',
    description:
      'Put one of the caller\'s vault pieces on show in this week\'s Hall of Grails exhibition under their plaque. ' +
      'Display only: it stays in their vault, still listable and withdrawable.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: { type: 'string', description: 'The vault piece to lend (from get_hall_loans eligible).' },
        credit: { type: 'string', enum: ['name', 'anonymous'], description: 'Credit the caller by name, or as "a collector".' },
      },
      required: ['vaultItemId'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/world/hall/loans', { vaultItemId: args.vaultItemId, credit: args.credit ?? 'name' }),
  },
  {
    name: 'withdraw_hall_loan',
    description: 'Take one of the caller\'s loans off show in the Hall of Grails.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The loan id (from get_hall_loans loans).' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiDelete(`/v1/world/hall/loans/${encodeURIComponent(String(args.id))}`),
  },
];
