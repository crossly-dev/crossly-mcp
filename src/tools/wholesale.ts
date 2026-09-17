import { apiPost } from '../api.js';
import { ToolDef } from './types.js';

export const wholesaleTools: ToolDef[] = [
  {
    name: 'quote_wholesale',
    description:
      'What a buyer pays per unit and in total at a given quantity, after volume breaks and any ' +
      'negotiated account rate. Give either a listing slug (what a storefront URL has) or a ' +
      'platformListingId. ' +
      'READ `appliedSteps` BEFORE REPORTING A PRICE: it lists exactly what moved the number, and ' +
      'quoting a figure without being able to say why it is that figure is how a trade ' +
      'relationship goes wrong. `belowMinimum` means the seller does not accept an order this ' +
      'small — report that instead of the price. `nextBreak` is how many more units reach a ' +
      'cheaper rung, and is usually the most useful thing in the response.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        platformListingId: { type: 'string' },
        quantity: { type: 'integer', minimum: 1 },
      },
      required: ['quantity'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/shop/wholesale/quote', args),
  },
  {
    name: 'quote_wholesale_batch',
    description:
      'Price a whole order sheet in one call — up to 200 lines. Use this rather than looping ' +
      'quote_wholesale: a wholesale buyer prices thirty lines at once and wants one total. ' +
      '`subtotalCents` is summed from the per-line numbers returned alongside it, so the total ' +
      'always equals the visible lines. Lines that could not be resolved come back with ' +
      '`unavailable: true` rather than being silently dropped from the sum.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          maxItems: 200,
          items: {
            type: 'object',
            properties: {
              slug: { type: 'string' },
              platformListingId: { type: 'string' },
              quantity: { type: 'integer', minimum: 1 },
            },
            required: ['quantity'],
            additionalProperties: false,
          },
        },
      },
      required: ['lines'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/shop/wholesale/quote-batch', args),
  },
];
