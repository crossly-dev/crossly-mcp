import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

export const analyticsTools: ToolDef[] = [
  {
    name: 'get_analytics_summary',
    description:
      'Headline KPIs over a recent window — total sales count, gross revenue, total platform fees — for the ' +
      'last N days (default 30, max 365). Use this for "how did I do this month / week / quarter" questions ' +
      'instead of summing list_sales pages yourself.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 30,
          description: 'Rolling window size in days. 7=week, 30=month, 90=quarter, 365=year.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/analytics/summary', { days: args.days }),
  },
  {
    name: 'get_analytics_by_platform',
    description:
      'Sales count, revenue, fees, and net profit grouped by platform for the last N days. Use this to answer ' +
      '"which platform is making me the most money?" or "where are my fees eating margin?".',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/analytics/by-platform', { days: args.days }),
  },
  {
    name: 'get_analytics_timeseries',
    description:
      'Daily sales count + gross revenue for the last N days. Useful for spotting trends or building charts. ' +
      'Returns one row per day with `day` (YYYY-MM-DD), `sales`, and `revenue`.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/analytics/timeseries', { days: args.days }),
  },
  {
    name: 'get_analytics_dashboard',
    description:
      "Composite dashboard payload — 20+ aggregates rolled into one response: revenue/profit/soldCount/avgPrice " +
      "(current + previous + pctChange), sellThroughRate, avgDaysToSell, salesByPlatform, avgSalePriceByPlatform, " +
      "revenueByDay, topCategories, topSubcategories, topBrands, top5ItemsByRevenue, recentSales, availableLabels. " +
      "Use this for the home dashboard view rather than fanning out across 20 separate analytics calls. " +
      "Range: 7d/30d/90d/1y/custom (with startDate+endDate for custom). Comma-separated `labels` filters by inventory label.",
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['7d', '30d', '90d', '1y', 'custom'], default: '30d' },
        startDate: { type: 'string', description: 'ISO date, required when range=custom.' },
        endDate: { type: 'string', description: 'ISO date, required when range=custom.' },
        labels: { type: 'string', description: 'Comma-separated label list to filter sales/inventory by.' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/analytics/dashboard', {
        range: args.range,
        startDate: args.startDate,
        endDate: args.endDate,
        labels: args.labels,
      }),
  },
  {
    name: 'get_analytics_today',
    description:
      "Today's seller checklist + 14-day activity streak: { checklist: { ordersToShip, unreadMessages, " +
      "listingsStaleEnoughToRelist, draftsWaiting }, streak: { current, longest, lastActiveDate }, " +
      "activitySparkline: number[14] }. Drives the 'today view' on web + mobile home screens.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/analytics/today'),
  },
  {
    name: 'get_analytics_items',
    description:
      "Per-item P&L for sold inventory — paginated, sortable. Each row carries { saleId, platform, itemTitle, " +
      "itemBrand, itemSku, salePrice, platformFee, shippingCost, costOfGoods, netProfit, marginPct, daysToSell, " +
      "detectedAt }. Use this for 'show me my best/worst margin items' or P&L drilldowns.",
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: 'string',
          enum: ['salePrice', 'costOfGoods', 'netProfit', 'margin', 'platform', 'daysToSell', 'detectedAt'],
          default: 'detectedAt',
        },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/analytics/items', {
        page: args.page,
        limit: args.limit,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
      }),
  },
  {
    name: 'get_analytics_bookkeeping',
    description:
      "Monthly P&L + per-platform breakdown for a calendar year. Returns { year, monthlyPL: [{ month, revenue, " +
      "cogs, platformFees, shippingCosts, netProfit }] x12, annualTotals: {...}, platformBreakdown: [{ platform, " +
      "revenue, count, platformFees, netProfit }] }. Designed for tax-time + accounting exports.",
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', minimum: 2020, maximum: 2099, description: 'Calendar year. Defaults to current year.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/analytics/bookkeeping', { year: args.year }),
  },
  {
    name: 'get_insights_by_platform',
    description:
      "Platform velocity + margin insight over the last 90 days. Returns { rows: [{ platform, sales, gross_cents, " +
      "avg_days_to_sale, avg_sale_cents, net_cents }] }. Different from get_analytics_by_platform — this one is " +
      "tuned for 'which platform am I selling fastest on and at what margin?' decisions over a fixed 90-day window.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/insights/by-platform'),
  },
];
