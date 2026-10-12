import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

export const catalogLookupTools: ToolDef[] = [
  {
    name: 'lookup_crossly_offers',
    description:
      'What Crossly currently has for a specific product identifier — a barcode, a sneaker style code, a LEGO set ' +
      'number, a TCGplayer or Discogs id, or an Amazon ASIN. Returns live, buyable offers cheapest first: ' +
      'marketplace listings (with a slug you can link to) and open order-book asks. ' +
      'Use it for sourcing decisions — "I am holding this barcode, what does it go for" — and to check whether an ' +
      'item a seller is about to list already has competition. ' +
      'IDENTIFIER-FIRST and deliberately literal: a GTIN is validated against its GS1 check digit, and there is no ' +
      'similarity fallback. An empty list means Crossly does not have that exact product, NOT that nothing similar ' +
      'exists — do not retry with a looser value, and do not present an empty result as "no market for this". ' +
      'This is the same lookup the Scout buyer extension uses to decide whether something is cheaper on Crossly. ' +
      'Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          enum: ['gtin', 'style_code', 'lego_set', 'tcgplayer', 'discogs', 'asin'],
          description:
            'Which kind of identifier. `gtin` covers every barcode family (UPC-A, EAN-13, EAN-8, ITF-14) and any ' +
            'length is accepted. `lego_set` is a LEGO set number — NOT `set_code`, which on Crossly means a ' +
            'trading-card set and is meaningless without a collector number.',
        },
        value: {
          type: 'string',
          description:
            'The identifier, in whatever spelling you have. Normalised server-side, so "036000291452" and ' +
            '"0036000291452" are the same product.',
        },
      },
      required: ['namespace', 'value'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/catalog/lookup', {
        namespace: args.namespace as string,
        value: args.value as string,
      }),
  },
];
