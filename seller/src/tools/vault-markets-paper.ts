import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets paper trading (api routes/v1/write/vault-markets-paper.ts).
 * PLAY MONEY ONLY: a practice account that starts with $10,000 of play money,
 * is never real and is never convertible to anything. Paper orders are
 * simulated against the real live order book without touching it. Always
 * tell the user these are play-money numbers.
 */
const PLAY = 'Play money only: never real money, never convertible. ';

export const vaultMarketsPaperTools: ToolDef[] = [
  {
    name: 'get_vault_markets_paper_account',
    description: `${PLAY}The user paper trading account (opened at $10,000 of play money the first time): cashCents, buyingPowerCents, equityCents, pnlCents and returnBps (cents of play US dollars and basis points), paper positions valued at the real marks, working paper orders with their queue estimate, recent paper fills and this week on the leaderboard.`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/paper', {}),
  },
  {
    name: 'list_vault_markets_paper_orders',
    description: `${PLAY}The user paper orders since their last reset, newest first.`,
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['working', 'done', 'all'], description: 'Which orders: "working" (still resting), "done" (filled, cancelled or expired) or "all" (default).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many to return, 1 to 200 (default 50).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/paper/orders', args),
  },
  {
    name: 'list_vault_markets_paper_fills',
    description: `${PLAY}The user paper fills since their last reset, newest first: priceCents and feeCents (cents of play US dollars; the fee is simulated at retail rates, never charged), liquidity "taker" or "maker", and source "book" (a visible real order) or "tape" (a real trade).`,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many to return, 1 to 200 (default 50).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/paper/fills', args),
  },
  {
    name: 'quote_vault_markets_paper_order',
    description: `${PLAY}What a paper order would fill against the real book right now, without placing anything: fillableUnits inside the limit, avgPriceCents, notionalCents and feeCents (cents of play US dollars), restingUnits and the queueAhead estimate for the rest.`,
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'The market: variantId:condition:gradeKey (gradeKey "-" when ungraded).' },
        side: { type: 'string', enum: ['buy', 'sell'], description: 'Side: "buy" or "sell".' },
        quantity: { type: 'integer', minimum: 1, maximum: 50, description: 'Units, 1 to 50 (default 1).' },
        limitCents: { type: 'integer', minimum: 1, description: 'Limit price per unit in cents of play US dollars. Omit for a market order (the 5% protection band around the mark).' },
      },
      required: ['bookKey', 'side'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/paper/quote', args),
  },
  {
    name: 'place_vault_markets_paper_order',
    description: `${PLAY}Place a paper order. It takes visible real liquidity now at book prices (taker fee simulated); what is left of a GTC limit rests on paper with a queue-position estimate and fills as the real tape reaches it. Sells only paper units the user holds (no paper shorts). It never touches the real book and spends no real money.`,
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'The market: variantId:condition:gradeKey (gradeKey "-" when ungraded).' },
        side: { type: 'string', enum: ['buy', 'sell'], description: 'Side: "buy" or "sell".' },
        type: { type: 'string', enum: ['market', 'limit'], description: 'Order type: "limit" (default) or "market" (fills now inside the 5% band around the mark, the rest cancelled).' },
        quantity: { type: 'integer', minimum: 1, maximum: 50, description: 'Units, 1 to 50 (default 1).' },
        limitCents: { type: 'integer', minimum: 1, description: 'Limit price per unit in cents of play US dollars. Required for a limit order.' },
        tif: { type: 'string', enum: ['gtc', 'ioc'], description: 'Time in force: "gtc" (default; the rest rests up to 30 days) or "ioc" (the rest is cancelled).' },
        clientOrderId: { type: 'string', description: 'Your own id for the order, up to 64 characters; sending it again returns the first order instead of a second one.' },
      },
      required: ['bookKey', 'side'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/paper/orders', args),
  },
  {
    name: 'cancel_vault_markets_paper_order',
    description: `${PLAY}Cancel a working paper order; the play cash or paper units it held come back.`,
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The paper order id (from list_vault_markets_paper_orders).' },
      },
      required: ['orderId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { orderId } = args as { orderId: string };
      return apiPost(`/v1/vault-markets/paper/orders/${encodeURIComponent(orderId)}/cancel`, {});
    },
  },
  {
    name: 'reset_vault_markets_paper_account',
    description: `${PLAY}Reset the paper account to $10,000 of play money: working paper orders are cancelled, paper positions cleared, and the leaderboard week starts again. Allowed once a day. Ask the user before calling.`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiPost('/v1/vault-markets/paper/reset', {}),
  },
  {
    name: 'get_vault_markets_paper_leaderboard',
    description: `${PLAY}The weekly paper trading leaderboard: opted-in players by display name, ranked by returnBps (basis points) on play equity, with the user own line in meta.you. Nothing is won or paid.`,
    inputSchema: {
      type: 'object',
      properties: {
        week: { type: 'string', description: 'A past week, as its Monday in YYYY-MM-DD (UTC). Omit for this week.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/paper/leaderboard', args),
  },
  {
    name: 'set_vault_markets_paper_leaderboard',
    description: `${PLAY}Join or leave the weekly paper leaderboard. Joining needs a display name the user picks (2 to 24 letters, numbers, spaces, dots, dashes or underscores), never their real name. Ask the user before calling.`,
    inputSchema: {
      type: 'object',
      properties: {
        optIn: { type: 'boolean', description: 'true to be listed on the board, false to leave it.' },
        displayName: { type: 'string', description: 'The name shown on the board, 2 to 24 characters. Needed the first time the user joins.' },
      },
      required: ['optIn'],
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/vault-markets/paper/leaderboard', args),
  },
];
