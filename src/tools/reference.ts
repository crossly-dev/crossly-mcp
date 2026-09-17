import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

export const referenceTools: ToolDef[] = [
  {
    name: 'list_categories',
    description:
      "Return Crossly's canonical two-level category tree (main → sub). Use this when crossposting an item " +
      'to make sure you pick a category value that is valid platform-wide. Response: `{ main: string[], sub: { Tops: ["T-Shirts", ...], ... } }`.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/categories'),
  },
  {
    name: 'search_brands',
    description:
      'Search the Crossly brand index. Returns up to 50 case-insensitive substring matches. Use when the ' +
      'user types a brand and you want to suggest a canonical spelling, or when categorizing.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first 50 brands alphabetically.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/brands', { search: args.search }),
  },
  {
    name: 'search_styles',
    description:
      "Search the eBay-sourced \"Style\" item-specific values (Bohemian, Casual, etc.). Use when " +
      "filling out eBay item-specifics or any other platform that maps onto eBay's style aspect.",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first N styles.' },
        limit: { type: 'integer', description: 'Cap on results. Default 50, max 500.' },
        platform: { type: 'string', description: "Default 'ebay'. Currently only eBay is sourced." },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/styles', { search: args.search, limit: args.limit, platform: args.platform }),
  },
  {
    name: 'search_patterns',
    description:
      "Search the eBay-sourced \"Pattern\" item-specific values (Solid, Striped, Plaid, etc.). Use when " +
      "filling out eBay item-specifics for clothing/accessories.",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first N patterns.' },
        limit: { type: 'integer', description: 'Cap on results. Default 50, max 500.' },
        platform: { type: 'string', description: "Default 'ebay'." },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/patterns', { search: args.search, limit: args.limit, platform: args.platform }),
  },
  {
    name: 'search_departments',
    description:
      "Search the eBay-sourced \"Department\" item-specific values (Women, Men, Unisex, etc.).",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first N departments.' },
        limit: { type: 'integer', description: 'Cap on results. Default 50, max 500.' },
        platform: { type: 'string', description: "Default 'ebay'." },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/departments', { search: args.search, limit: args.limit, platform: args.platform }),
  },
  {
    name: 'search_genders',
    description:
      "Search the eBay-sourced \"Gender\" item-specific values (Female, Male, Unisex, etc.).",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first N genders.' },
        limit: { type: 'integer', description: 'Cap on results. Default 50, max 500.' },
        platform: { type: 'string', description: "Default 'ebay'." },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/genders', { search: args.search, limit: args.limit, platform: args.platform }),
  },
  {
    name: 'search_types',
    description:
      "Search the eBay-sourced \"Type\" item-specific values (T-Shirt, Sneakers, etc.) — the granular " +
      "item-type field below department/gender.",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first N types.' },
        limit: { type: 'integer', description: 'Cap on results. Default 50, max 500.' },
        platform: { type: 'string', description: "Default 'ebay'." },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/types', { search: args.search, limit: args.limit, platform: args.platform }),
  },
  {
    name: 'search_size_systems',
    description:
      'Search the Poshmark + Vestiaire size-system union (US, UK, EU, AU, FR, KR). Use when picking the ' +
      'size_system field on those platforms.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search query. Empty returns the first N size systems.' },
        limit: { type: 'integer', description: 'Cap on results. Default 50, max 500.' },
        platform: { type: 'string', description: "Scope to 'poshmark' or 'vestiaire'. Default is the cross-platform union." },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/size-systems', { search: args.search, limit: args.limit, platform: args.platform }),
  },
  {
    name: 'list_connections',
    description:
      'List the seller\'s OAuth-connected API platforms (eBay, Etsy, Shopify, Amazon, Walmart). Returns ' +
      "isActive + shopUrl + last-seen timestamp. For COOKIE platforms (Poshmark/Mercari/etc.) use list_platform_accounts instead.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/connections'),
  },
  {
    name: 'get_automation_catalog',
    description:
      'Discover which triggerType / actionType / conditionType values are valid before creating an automation ' +
      'rule. Each entry includes a description and `configSchema` (the keys you must supply in the rule\'s ' +
      'triggerConfig / actionConfig). Call this FIRST when the user asks you to set up automation.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/automation/catalog'),
  },
];
