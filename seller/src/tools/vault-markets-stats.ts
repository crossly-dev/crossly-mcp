import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets per-item analytics (api routes/v1/write/vault-markets-stats.ts):
 * the Crossly Estimate, the liquidity score, risk statistics, the sector
 * correlation matrix and the Crossly gem rate. Everything is DERIVED from
 * Crossly trades and the firm book — labelled, with a band and an n, never a
 * price, and never used for margin, loans or settlement. Under a data
 * threshold the answer says "Not enough Crossly trades" and has no number;
 * report that as is, never fill in a figure. Money is cents of US dollars;
 * volatility, drawdown and spreads are basis points (100 = 1%).
 */
const BOOK_KEY = {
  type: 'string',
  description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded (e.g. "3f2a...:new:-"). Take it from list_vault_markets_movers or get_vault_markets_portfolio.',
} as const;
const KEY_ONLY: ToolDef['inputSchema'] = { type: 'object', properties: { bookKey: BOOK_KEY }, required: ['bookKey'], additionalProperties: false };
const key = (args: unknown) => encodeURIComponent((args as { bookKey: string }).bookKey);

export const vaultMarketsStatsTools: ToolDef[] = [
  {
    name: 'get_vault_markets_key_stats',
    description: 'Everything derived about one book key in one call: the Crossly Estimate, the liquidity score, risk statistics and the gem rate. A part that could not be read comes back as { error }.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet(`/v1/vault-markets/key-stats/${key(args)}`),
  },
  {
    name: 'get_vault_markets_estimate',
    description: 'The Crossly Estimate for a book key — a model, not a price. Returns the method used (own_trades, index_adjusted, grade_ratio), cents with 68% and 95% bands, High/Medium/Low confidence from the walk-forward backtest (FSD) and n. available=false means no number: say "Not enough Crossly trades" and give `why`.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet(`/v1/vault-markets/estimates/${key(args)}`),
  },
  {
    name: 'get_vault_markets_estimate_accuracy',
    description: "The Crossly Estimate's track record: backtested trades (n), FSD and bias per method, category and liquidity bucket, and whether estimates in each cell are shown (n >= 50 and FSD <= 0.30).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/estimates-accuracy'),
  },
  {
    name: 'get_vault_markets_liquidity',
    description: 'The liquidity score (0-100) of a book key with every component: trades in 30/90 days, distinct counterparties, median days between trades, time-weighted quoted spread, two-sided share and depth within 5% from hourly book snapshots, Amihud and Roll, each as a percentile within the category. insufficient=true means no score.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet(`/v1/vault-markets/liquidity/${key(args)}`),
  },
  {
    name: 'get_vault_markets_risk_stats',
    description: 'Risk statistics from weekly returns: annualised volatility raw and Geltner-desmoothed (say which), max drawdown and beta to the Composite, with n. For a book key the returns come from trade-anchored (A-quality) marks only; an index slug uses its closes. Needs 26 weekly returns, else insufficient=true and no numbers.',
    inputSchema: {
      type: 'object',
      properties: { bookKey: { type: 'string', description: 'A book key (variantId:condition:gradeKey) or an index slug from list_vault_markets_indexes.' } },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/vault-markets/risk-stats/${key(args)}`),
  },
  {
    name: 'get_vault_markets_correlations',
    description: "The correlation matrix of the sector indexes' weekly returns, pairwise-complete, with n per pair. rho[i][j] is null when the pair shares fewer than 26 weeks.",
    inputSchema: {
      type: 'object',
      properties: { weeks: { type: 'integer', minimum: 26, maximum: 156, default: 52, description: 'Weeks back (26-156). Default 52.' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/vault-markets/correlations', { weeks: (args as { weeks?: number }).weeks }),
  },
  {
    name: 'get_vault_markets_gem_rate',
    description: "The Crossly gem rate for a book key's item and its category: of cards graded through Crossly, the share that came back at each grader's gem grade (e.g. PSA 10, BGS 9.5+), with a Wilson 95% band and n. Needs 10 returns per grader. Crossly's own returns only — not a grader population report, and not a prediction of a grade.",
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet(`/v1/vault-markets/gem-rate/${key(args)}`),
  },
  {
    name: 'get_vault_markets_market_model',
    description: 'How a book key trades: its liquidity tier (A continuous; B a call auction every 15 minutes; C one daily call; D listings only), the call collecting now with its indicative price (cents) and volume and nominal close, the next call, the LULD price band and any limit state, pause or halt. On B/C keys orders wait for the call: use a day or good-til-cancelled limit, never IOC/FOK.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet(`/v1/vault-markets/market-model/${key(args)}`),
  },
  {
    name: 'list_vault_markets_calls',
    description: 'Recent call-auction uncrosses on a book key: kind (open, reopen, periodic, daily, buy_in, sell_off), clearing price in cents of US dollars, and units.',
    inputSchema: KEY_ONLY,
    handler: (args) => apiGet(`/v1/vault-markets/calls/${key(args)}`),
  },
];
