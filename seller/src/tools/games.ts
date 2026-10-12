import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World market games, read-only: Price Guess (guess what a real item
 * really sold for), scavenger hunts in shops (find every token, unlock the
 * seller's coupon), pack breaks on a shop's stage, and speed trades at trade
 * tables. Games are played inside the world; these tools read the record. No
 * game takes money or pays cash, and a break spot is bought on crossly.net.
 */
export const gamesTools: ToolDef[] = [
  {
    name: 'list_my_game_results',
    description:
      'Your Crossly World market-game results, newest first: game (price_guess, price_guess_solo, hunt, speed_trade, ' +
      'break_host), score, whether you won and any Crossly Bucks prize in cents (0 while prizes are pins only). ' +
      'meta.unlocks lists hunt coupons you earned (with codes); meta.hits the break hits pulled for spots you bought.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/games/results/mine', {}),
  },
  {
    name: 'list_live_hunts',
    description:
      'Scavenger hunts running now in Crossly World shops: title, shop, how many tokens, what finishing unlocks ' +
      '("10% off" -- never the code), when it ends and how many people finished. A hunt at a pop-up stall has stall.bookingId '
      + 'set and its shop slug is the street. Optional place = one shop or street slug.',
    inputSchema: {
      type: 'object',
      properties: { place: { type: 'string', description: 'A shop slug, to list only that shop\'s hunt.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { place } = args as { place?: string };
      return apiGet('/v1/games/hunts', place ? { place } : {});
    },
  },
  {
    name: 'list_upcoming_breaks',
    description:
      'Pack breaks staged on shop stages in Crossly World, live first then soonest: the break, its shop, start time, ' +
      'spots (buyer masked), hits revealed so far, and buyUrl -- the page on crossly.net where spots are bought.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/games/breaks/upcoming', {}),
  },
  {
    name: 'get_game_leaderboards',
    description:
      'Crossly World game leaderboards: top ten per game -- Price Guess (wins, then points), scavenger hunts (finished), ' +
      'speed trades (won) -- this week (from Monday 00:00 UTC) under week and of all time under all. A name shows only for ' +
      'somebody who chose to be seen by name in the world; everyone else is "A player" in their place.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/games/leaderboards', {}),
  },
];
