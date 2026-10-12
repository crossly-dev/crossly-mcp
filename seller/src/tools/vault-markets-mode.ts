import { apiGet, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets Simple and Pro modes, and "What's it worth" (api
 * routes/v1/write/vault-markets-mode.ts). The mode is a display preference
 * remembered for the person on the web and in the app. The worth reads use
 * only the order book: the mark and its quality, what Instant Exit would pay
 * for one unit now, and the person's own units. Nothing here places an order
 * or moves money.
 */
export const vaultMarketsModeTools: ToolDef[] = [
  {
    name: 'get_vault_markets_mode',
    description: 'Your Vault Markets mode: "simple" (three things: buy, sell, and what it is worth) or "pro" (the full trading terminal). source is "chosen" when you picked it, or "default" when it was set for you once (new people start in simple; people already trading start in pro). explain says what each mode shows.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/mode', {}),
  },
  {
    name: 'set_vault_markets_mode',
    description: 'Choose your Vault Markets mode, remembered on the web and in the Crossly app. A display preference only: it places nothing and moves no money.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['simple', 'pro'], description: 'Which mode: "simple" (buy, sell and what it is worth) or "pro" (the full trading terminal).' },
      },
      required: ['mode'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { mode } = args as { mode: 'simple' | 'pro' };
      return apiPut('/v1/vault-markets/mode', { mode });
    },
  },
  {
    name: 'get_vault_markets_key_worth',
    description: 'What one Vault Markets item is worth: the mark (market price from the order book, in cents of US dollars) with its quality ("A" from trades, "B" from firm quotes, "C" indicative, "none" no price yet) and band; instantExit, what one unit would sell for right now into the best resting bid (bestBidCents, shareOfMarkBps, or the reason it cannot); and mine, your units, how many are free to sell, their value at the mark and what selling every free one now would fetch (sellNow, cents). headline and lines are plain words to repeat. Read only.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'The book key: variantId:condition:gradeKey (gradeKey "-" when ungraded), as the market pages and vault holdings give it.' },
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey } = args as { bookKey: string };
      return apiGet('/v1/vault-markets/worth', { bookKey });
    },
  },
  {
    name: 'get_vault_markets_vault_worth',
    description: 'What your whole Crossly vault is worth now: valueCents at the marks (cents of US dollars) split into reliable (A or B) and indicative (C) marks with units that have no mark, cost and P&L, today change, and sellNow, an estimate of what the units free to sell would fetch from the bids resting on the book right now. note says how far to trust the value. Read only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/worth/vault', {}),
  },
];
