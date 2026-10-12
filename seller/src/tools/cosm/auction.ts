import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmAuction: ToolDef[] = [
  {
    name: 'list_cosm_auction',
    description:
      'Open cosmetic auction listings, priced in COSM. A COSM-denominated peer market: '
      + 'buyers pay COSM, sellers receive COSM, and the 8% fee BURNS. It is not a cash '
      + 'market and cannot be used to convert COSM to money.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'Filter to one SKU.' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(
        '/v1/cosm/auction',
        args.cosmeticId ? { cosmeticId: String(args.cosmeticId) } : undefined,
      ),
  },
  {
    name: 'quote_cosm_auction_fee',
    description:
      'What listing at a given ask would cost in fees, before committing. The fee is 8% '
      + 'of the ask rounded UP, and the seller always nets something. Quote this and show '
      + 'the net before calling the listing tool.',
    inputSchema: {
      type: 'object',
      properties: {
        askBaseUnits: {
          type: 'string',
          description: 'Ask in base units, as a string. Six decimals; must exceed 1.',
        },
      },
      required: ['askBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/auction/quote', { askBaseUnits: String(args.askBaseUnits) }),
  },
  {
    name: 'list_cosm_cosmetic_for_sale',
    description:
      'List an owned cosmetic on the auction house for COSM. Refuses a BOUND item. '
      + 'One open listing per item. `askBaseUnits` is a string of base units (six '
      + 'decimals) and must exceed 1. Quote the fee first so the seller sees their net.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: 'The selling CBX subject. Must own the item and must be one you own.',
        },
        ownershipId: {
          type: 'string',
          description: 'From list_cosm_inventory — the ownership row, not the cosmetic id.',
        },
        askBaseUnits: {
          type: 'string',
          description:
            'Ask price in COSM base units, as a STRING (six decimals, never a float). '
            + 'Must exceed 1. Priced in COSM, not dollars — this is not a cash market.',
        },
        expiresAt: {
          type: 'string',
          description: 'Optional ISO-8601 expiry. Omit for an open-ended listing.',
        },
      },
      required: ['subjectId', 'ownershipId', 'askBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/cosm/auction', {
        subjectId: String(args.subjectId),
        ownershipId: String(args.ownershipId),
        askBaseUnits: String(args.askBaseUnits),
        ...(args.expiresAt ? { expiresAt: String(args.expiresAt) } : {}),
      }),
  },
  {
    name: 'buy_cosm_auction_listing',
    description:
      'Buy an open auction listing with COSM. The listing is claimed before any COSM '
      + 'moves, so a race loses cleanly rather than debiting twice. Buying your own '
      + 'listing is refused. Confirm the spend with the user first — there is no refund.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: {
          type: 'string',
          description: 'The open auction listing to buy, from list_cosm_auction.',
        },
        subjectId: {
          type: 'string',
          description:
            'The buying CBX subject. Must be one you own, and cannot be the seller — '
            + 'buying your own listing is refused.',
        },
      },
      required: ['listingId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(`/v1/cosm/auction/${encodeURIComponent(String(args.listingId))}/buy`, {
        subjectId: String(args.subjectId),
      }),
  },
];
