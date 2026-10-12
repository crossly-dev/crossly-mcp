import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly Market — public order-book reads.
 *
 * The descriptions carry one idea harder than the rest: a product does not
 * have "a price". The book is per (variant, condition, grade), a grade decides
 * WHICH market an item trades in rather than modifying a price in one, and the
 * same card is $414 raw and $12,168 in a PSA 10. A model that reports a
 * product-level figure as the price of a specific item is wrong by a factor of
 * thirty, so the tools say so explicitly and the product-level field is named
 * `lowestAskCentsFrom` rather than `price`.
 */
export const marketTools: ToolDef[] = [
  {
    name: 'browse_crossly_market',
    description:
      'Browse products on the Crossly Market order book — the StockX-style marketplace where buyers and sellers '
      + 'place bids and asks on catalogued products (sneakers, trading cards, comics, coins, video games, watches). '
      + 'Use it to find what trades, and at roughly what level. '
      + 'IMPORTANT: `lowestAskCentsFrom` is the cheapest ask across EVERY condition and EVERY grade — a "from" '
      + 'price for a browse list, NOT the price of any particular item. To price a specific copy you must call '
      + 'get_crossly_market_tiers for its variant. Reporting the "from" figure as the price of a graded item '
      + 'understates it by an order of magnitude. '
      + 'Set graded:true (optionally with grader and minGrade) to see only professionally graded inventory. '
      + 'Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free text over name, brand and style code.' },
        categorySlug: {
          type: 'string',
          description: 'e.g. cards, comics, coins, sneakers, video-games, watches.',
        },
        graded: {
          type: 'boolean',
          description: 'Only products with at least one open PROFESSIONALLY GRADED ask.',
        },
        grader: {
          type: 'string',
          description:
            'Restrict to one grading company, e.g. psa, bgs, cgc, pcgs, wata. Call list_crossly_graders '
            + 'for the valid slugs — guessing one returns an empty list with no explanation.',
        },
        minGrade: {
          type: 'string',
          description:
            'Only tiers at or above this grade, e.g. "9". REQUIRES grader, because grades are only comparable '
            + "within one company's scale: a coin's MS-65 and a card's 65 are not the same kind of number and one "
            + 'of them does not exist.',
        },
        page: { type: 'integer', minimum: 1, description: '1-based page number. Omit for the first page.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Results per page, 1-100. Defaults to the server page size.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/market/products', args as Record<string, unknown>),
  },

  {
    name: 'get_crossly_market_product',
    description:
      'One Crossly Market product and its variants. A VARIANT is which product — a shoe size, a vinyl pressing, a '
      + 'card printing — and each variant has its own order book. Use the variant ids from here with '
      + 'get_crossly_market_tiers or get_crossly_market_book. Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Market product (SKU) id.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/market/products/${encodeURIComponent(id)}`, {});
    },
  },

  {
    name: 'get_crossly_metals_spot',
    description:
      'Live precious-metal spot prices on the Crossly Market: gold, silver, platinum and palladium, in US cents per '
      + 'troy ounce of PURE metal. The melt value of a bullion product is its fine content (product.metal.fineTroyOz from '
      + 'get_crossly_market_product) times this. `stale` means the reading is older than the window spot-pegged '
      + 'orders trade on. Requires the catalog:read scope.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/market/metals/spot', {}),
  },

  {
    name: 'get_crossly_metals_spot_history',
    description: 'Spot price history for one precious metal, for a chart: points of {at, priceCents} over 1d, 7d, 30d or 1y. Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        metal: { type: 'string', enum: ['gold', 'silver', 'platinum', 'palladium'], description: 'Which metal: gold, silver, platinum or palladium.' },
        range: { type: 'string', enum: ['1d', '7d', '30d', '1y'], description: 'How far back: 1d (minute points), 7d or 30d (hourly), 1y (daily). Default 30d.' },
      },
      required: ['metal'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/market/metals/spot/history', args as Record<string, unknown>),
  },

  {
    name: 'list_crossly_bullion',
    description:
      'Bullion on the Crossly Market — coins, bars and rounds of gold, silver, platinum and palladium — filtered by '
      + 'metal, form and size and ordered by what the metal costs. Each item gives its pure content in troy ounces, '
      + 'melt value at live spot, lowest ask, premium over spot (cents and percent) and price per pure ounce. Use '
      + 'sort=premium to find the cheapest way to buy an ounce. Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        metal: { type: 'string', enum: ['gold', 'silver', 'platinum', 'palladium'], description: 'Only this metal.' },
        form: { type: 'string', enum: ['bullion_coin', 'bar', 'round'], description: 'Sovereign/mint coins, refiner bars, or private-mint rounds.' },
        size: { type: 'string', enum: ['fractional', 'quarter', 'half', 'one', 'two-five', 'ten', 'kilo', 'large'], description: 'By pure content: fractional (under 1/4 oz), quarter, half, one (1 oz), two-five (2-5 oz), ten (10 oz), kilo, large (100 oz+).' },
        brand: { type: 'string', description: 'The mint or refiner, exactly as listed (e.g. "PAMP Suisse").' },
        sort: { type: 'string', enum: ['popular', 'premium', 'per_oz', 'price_low', 'price_high'], description: 'popular, premium (lowest premium over spot first), per_oz (lowest price per pure ounce), price_low, price_high. Unpriced items sort last.' },
        page: { type: 'number', description: 'Page, 1-20 (48 per page).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/market/bullion', args as Record<string, unknown>),
  },

  {
    name: 'quote_crossly_scrap_metal',
    description:
      'What raw precious metal is worth — scrap gold or silver jewelry, flatware, dental gold — by weight and purity: '
      + 'its melt value at spot and what the best standing offer on the Crossly scrap desk pays after the desk fee. '
      + 'Purity is a karat for gold (14 = 14k) or finenessPpm (925000 = sterling). Units: ozt (troy ounce), g, kg, '
      + 'dwt (pennyweight), tola. The quote is an estimate: a lot settles on its assayed weight and purity. '
      + 'Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        metal: { type: 'string', enum: ['gold', 'silver', 'platinum', 'palladium'], description: 'Which metal the scrap is: gold, silver, platinum or palladium.' },
        weight: { type: 'number', description: 'Weight in `unit`.' },
        unit: { type: 'string', enum: ['ozt', 'g', 'kg', 'dwt', 'tola'], description: 'Weight unit: ozt = troy ounce (31.1 g, not a kitchen ounce), g = grams, kg = kilograms, dwt = pennyweight (1.555 g, what jewelers use), tola = 11.66 g. Default g.' },
        karat: { type: 'number', description: 'Gold only: 24, 22, 18, 14, 10, 9.' },
        finenessPpm: { type: 'number', description: 'Purity in parts per million (999000 = .999).' },
      },
      required: ['metal', 'weight'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/market/scrap/quote', args as Record<string, unknown>),
  },

  {
    name: 'get_crossly_market_related',
    description:
      'What sits around one Crossly Market product, as its page shows it: similar items (same brand and model — '
      + 'other colourways, editions, printings), products people also viewed, more from the brand, and the '
      + 'category\'s most popular; plus the product\'s breadcrumb, the directory pages around it (the brand\'s '
      + 'other models, other brands, the brand in other categories) and related searches. Each product carries '
      + 'its id for get_crossly_market_product. Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Market product (SKU) id.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/market/products/${encodeURIComponent(id)}/related`, {});
    },
  },

  {
    name: 'get_crossly_market_tiers',
    description:
      'THE PRICE OF A SPECIFIC ITEM. Returns one row per (condition, grade) tier that has activity for a variant: '
      + 'lowest ask, highest bid, last sale and open order counts, best grade first. '
      + 'This is the tool to use whenever the question is "what is this worth", because a graded slab is a '
      + 'SEPARATE MARKET rather than a variation on one — two PSA 10s of a card are interchangeable and a raw copy '
      + 'is a different item at a different price. `gradeKey` is null for the ungraded tier and `label` is the '
      + 'human name ("PSA 10", "Ungraded"). Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: { variantId: { type: 'string', description: 'Catalog variant id — the specific size/colourway, not the product id.' } },
      required: ['variantId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { variantId } = args as { variantId: string };
      return apiGet(`/v1/market/variants/${encodeURIComponent(variantId)}/tiers`, {});
    },
  },

  {
    name: 'get_crossly_market_book',
    description:
      'Order-book depth — resting bids and asks aggregated by price — for ONE tier of a variant. '
      + 'Omit gradeKey for the ungraded tier, which is where everything sits unless a grading company certified '
      + 'the copy. Use get_crossly_market_tiers first to discover which tiers exist; a gradeKey nothing trades in '
      + 'returns an empty book, which means "no orders here", not "no market for this item". '
      + 'Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        variantId: { type: 'string', description: 'Catalog variant id — the specific size/colourway, not the product id.' },
        condition: {
          type: 'string',
          enum: ['DS', 'VNDS', 'Used'],
          description: 'DS = deadstock/new. Defaults to DS.',
        },
        gradeKey: {
          type: 'string',
          description:
            'Canonical tier key from get_crossly_market_tiers, e.g. "psa:10". Omit for ungraded — do not '
            + 'construct one by hand.',
        },
      },
      required: ['variantId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { variantId, ...rest } = args as { variantId: string } & Record<string, unknown>;
      return apiGet(`/v1/market/variants/${encodeURIComponent(variantId)}/book`, rest);
    },
  },

  {
    name: 'list_crossly_graders',
    description:
      'The professional grading companies Crossly knows, and every grade each one issues. '
      + 'Call this before filtering or quoting a grade: the scales genuinely differ — cards run 1-10, coins use '
      + 'Sheldon where the designation is part of the grade (MS-65, not 65), sealed games carry a box grade AND a '
      + 'separate seal letter, AFA runs 10-100. Sneakers and watches return NOTHING, because they are '
      + 'authenticated rather than graded; do not invent a grade for them. Requires the catalog:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        categorySlug: {
          type: 'string',
          description: 'Only graders operating in this category. Empty result = the category is not graded.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/market/graders', args as Record<string, unknown>),
  },
];
