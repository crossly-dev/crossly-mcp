import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Buyer gift cards — list, credit, purchase, redeem.
 *
 * Needs a BUYER token scoped buyer:giftcards:read / buyer:giftcards:write.
 * The descriptions carry the two facts an agent cannot discover by trying:
 * a purchase charges nothing until the person confirms the returned
 * PaymentIntent, and the code is never in any response (it is emailed to the
 * recipient), so there is nothing to "fetch the code" with.
 */
export const buyerGiftCardTools: ToolDef[] = [
  {
    name: 'list_my_gift_cards',
    description:
      'Gift cards the buyer BOUGHT, newest first: amount, recipient, status (active / redeemed / void / expired), '
      + 'delivery date and expiry. Codes are masked unless the buyer sent the card to their own email. '
      + 'Requires buyer:giftcards:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/gift-cards'),
  },
  {
    name: 'get_gift_card_credit',
    description:
      'Gift card credit on the buyer\'s own account: one row per redeemed card with what is left and when it '
      + 'expires; meta.giftCreditCents is the unspent total in CENTS and meta.nextExpiresAt the soonest lapse. '
      + 'Spending at checkout uses gift credit first. Requires buyer:giftcards:read.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/gift-cards/credit'),
  },
  {
    name: 'purchase_gift_card',
    description:
      'Start buying a Crossly gift card for someone. CHARGES NOTHING BY ITSELF: it returns a Stripe PaymentIntent '
      + 'clientSecret that the buyer must confirm with a payment method on Crossly (web or app). The code is emailed '
      + 'to the recipient after payment clears and is NEVER returned by the API. $10-$500. The card and the credit it '
      + 'becomes expire 5 years after purchase. AN idempotencyKey IS REQUIRED - derive it from the intent '
      + '(e.g. "gift:<recipient>:<occasion>") so a retry returns the same card instead of opening a second one. '
      + 'Requires buyer:giftcards:write.',
    inputSchema: {
      type: 'object',
      properties: {
        amountCents: {
          type: 'number',
          description: 'Card value in CENTS (integer), 1000-50000: 5000 is $50.00, not 50.',
        },
        recipientEmail: { type: 'string', description: 'Where the code is emailed.' },
        recipientName: { type: 'string', description: 'Shown in the email greeting. Optional.' },
        message: { type: 'string', description: 'A note included with the card, up to 500 characters. Optional.' },
        deliverAt: {
          type: 'string',
          description: 'ISO 8601 instant to email the code (within a year). Omit to send as soon as it is paid.',
        },
        idempotencyKey: {
          type: 'string',
          description: 'Sent as the Idempotency-Key header. REQUIRED. Stable per intent, not random per attempt.',
        },
      },
      required: ['amountCents', 'recipientEmail', 'idempotencyKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/buyer/gift-cards', body, idempotencyKey);
    },
  },
  {
    name: 'redeem_gift_card',
    description:
      'Redeem a Crossly gift card code (CRX-XXXX-XXXX-XXXX) into the buyer\'s OWN balance, spendable at checkout. '
      + 'One redemption per card; the credit keeps the card\'s expiry date. Refusals: 404 invalid_code, '
      + '409 already_redeemed / not_paid / void / expired. Requires buyer:giftcards:write.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The gift card code, with or without dashes.' },
        idempotencyKey: {
          type: 'string',
          description: 'Optional. Replays the original answer if the same key is sent again within 24h.',
        },
      },
      required: ['code'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/buyer/gift-cards/redeem', body, idempotencyKey);
    },
  },
];
