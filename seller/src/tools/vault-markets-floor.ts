import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Trading Floor in Crossly World (api routes/v1/write/vault-markets-floor.ts):
 * the Vault Markets tape as the world room shows it, the big board and the
 * Market Open bell. Read-only. Nothing can be traded in the room.
 */
export const vaultMarketsFloorTools: ToolDef[] = [
  {
    name: 'get_vault_markets_trading_floor',
    description:
      'The Trading Floor in Crossly World, where the Vault Markets tape streams as light. Returns trades (the newest trades on every vault book in the last day, newest first, at most 40: bookKey, name, priceCents in cents of US dollars, priceText, side and ageS in seconds. side is "buy" when a buyer took an ask, "sell" when a seller hit a bid, or "cross" for an auction), ' +
      'tickers (the big board of the most-traded markets: last trade price lastCents in cents of US dollars, changeBps from the last trade before today in basis points, trades24h, the display mark markCents with its quality "A", "B", "C" or "none", and href, the market page), ' +
      'bell (Market Open: ringing for ten minutes after a new key opens, with its title, line, liveAt and marketHref, and next, what opens next) and trades24h. Every price is a trade on the Crossly order book and it never says who traded. It takes no arguments and cannot place an order.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/world/floor', {}),
  },
];
