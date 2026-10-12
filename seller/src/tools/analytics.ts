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
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 30,
          description:
            'Rolling window size in days, counted back from right now (not from midnight): the server groups every ' +
            'sale whose detectedAt is within the last `days` x 24h. Default 30, clamped to 365. 7=week, 90=quarter, ' +
            '365=year. revenue/fees/netProfit in the response are DOLLARS (decimal), not cents.',
        },
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
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 30,
          description:
            'Rolling window size in days, counted back from right now. Default 30, clamped to 365. Buckets are UTC ' +
            'CALENDAR days (`day` is YYYY-MM-DD in UTC), so the first and last bucket are usually partial. Days with ' +
            'no sales are OMITTED rather than returned as zero — do not assume `days` rows back. `revenue` is DOLLARS.',
        },
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
        range: {
          type: 'string',
          enum: ['7d', '30d', '90d', '1y', 'custom'],
          default: '30d',
          description:
            'Which window the "current" numbers cover. Preset buckets all run from midnight N days ago to now: ' +
            '"7d"=last 7 days, "30d"=last 30 (default), "90d"=last 90, "1y"=last 365 days (a rolling year, NOT a ' +
            'calendar year — use get_analytics_bookkeeping for that). "custom" uses startDate+endDate instead. ' +
            'Whatever the window, the server also computes the equally-long period immediately before it and returns ' +
            'it as the `previous`/`pctChange` half of each KPI.',
        },
        startDate: {
          type: 'string',
          description:
            'First day of a custom window, YYYY-MM-DD (any Date-parseable string works). INCLUSIVE — snapped down to ' +
            '00:00:00 local server time. Only read when range="custom", and BOTH startDate and endDate must be ' +
            'present or the server silently falls back to the 30-day window.',
        },
        endDate: {
          type: 'string',
          description:
            'Last day of a custom window, YYYY-MM-DD. INCLUSIVE — snapped up to 23:59:59.999 local server time, so ' +
            'sales made that day are counted. Only read when range="custom", and requires startDate alongside it.',
        },
        labels: {
          type: 'string',
          description:
            'Comma-separated inventory labels (e.g. "thrift,consignment"). Restricts every KPI to sales whose ' +
            'inventory item carries AT LEAST ONE of them (OR, not AND). Omit for all sales. The valid values for ' +
            'this seller come back as `availableLabels` in the response.',
        },
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
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description:
            '1-indexed page number (default 1). Increment to walk the next page; `total` in the response is the full ' +
            'row count, so the last page is ceil(total / limit). There is no date filter here — this walks ALL sold ' +
            'items ever, newest first by default.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Rows per page, 1-100. Default 20 (note: NOT the 25 most other list tools use).',
        },
        sortBy: {
          type: 'string',
          enum: ['salePrice', 'costOfGoods', 'netProfit', 'margin', 'platform', 'daysToSell', 'detectedAt'],
          default: 'detectedAt',
          description:
            'Which column orders the page. "salePrice"=what the buyer paid (DOLLARS); "costOfGoods"=snapshot COGS ' +
            'for the item (DOLLARS); "netProfit"=sale − platform fee − shipping − COGS, derived live (DOLLARS); ' +
            '"margin"=netProfit as a PERCENT of salePrice, so it ranks small cheap wins alongside big ones; ' +
            '"platform"=alphabetical by marketplace; "daysToSell"=days between the inventory item being created and ' +
            'the sale being detected; "detectedAt"=when the sale was detected (default — i.e. most recent first).',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc',
          description:
            'Direction for sortBy. "desc" (default) = biggest/newest first — best-margin or most-recent items. ' +
            '"asc" = smallest/oldest first, which is how you find the loss-makers and the slowest movers.',
        },
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
