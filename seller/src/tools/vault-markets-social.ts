import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets social (api routes/v1/write/vault-markets-social.ts):
 * verified share cards (the % is the price move since the user's real fill,
 * computed by Crossly; amounts hidden unless turned on), opt-in public vault
 * profiles that show weights and never dollars, a feed of new vault buys by
 * people the user follows (no copy trading), the Learn hub's server-graded
 * quizzes (cosmetic pins only), the quarterly Vault Report, the press kit,
 * index levels and the widget reads. Moves and weights are basis points.
 */
const ID = { type: 'string', description: 'The share card id (uuid) from list_vault_share_cards or create_vault_share_card.' } as const;
const HANDLE = { type: 'string', description: 'The person\'s Crossly handle, with or without the @.' } as const;
const CONCEPT = {
  type: 'string',
  enum: ['marks', 'instant-exit', 'lending', 'shorts', 'liens', 'auctions', 'indexes'],
  description: 'The Learn concept.',
} as const;
const SLUG = { type: 'string', description: 'The index slug (lowercase letters, digits and dashes) from list_vault_markets_indexes.' } as const;
const RANGE = { type: 'string', enum: ['1m', '3m', '6m', '1y', '5y'], description: 'How much history to include: "1m" = last 30 days, "3m" = 91 days, "6m" = 182 days, "1y" = 365 days, "5y" = 1825 days. Default "1y".' } as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;

export const vaultMarketsSocialTools: ToolDef[] = [
  {
    name: 'list_vault_share_cards',
    description: 'The user\'s verified share cards (not taken down), each as the public sees it: title, mark with quality, the % move since their real fill, and the image and link paths.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/share-cards'),
  },
  {
    name: 'create_vault_share_card',
    description: 'Make a verified share card of a position, a vault unit, a public index or the user\'s portfolio. Crossly computes the % from the real fill and today\'s mark; dollar amounts stay hidden unless showAmounts is true. Returns the card with its link.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['position', 'unit', 'index', 'portfolio'], description: '"position" = a short or leveraged long; "unit" = one vault unit; "index" = a built-in or shared index; "portfolio" = everything the user holds in the vault.' },
        refId: { type: 'string', description: 'The position id, vault unit id or index slug. Omit for "portfolio".' },
        showAmounts: { type: 'boolean', description: 'Show dollar amounts on the card. Default false (% only).' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/share-cards', args),
  },
  {
    name: 'get_vault_share_card',
    description: 'One share card as the public sees it.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/share-cards/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'set_vault_share_card_amounts',
    description: 'Show or hide the dollar amounts on one of the user\'s share cards.',
    inputSchema: { type: 'object', properties: { id: ID, showAmounts: { type: 'boolean', description: 'true = show amounts; false = % only.' } }, required: ['id', 'showAmounts'], additionalProperties: false },
    handler: (args) => {
      const { id, showAmounts } = args as { id: string; showAmounts: boolean };
      return apiPatch(`/v1/vault-markets/share-cards/${encodeURIComponent(id)}`, { showAmounts });
    },
  },
  {
    name: 'delete_vault_share_card',
    description: 'Take one of the user\'s share cards down: its link and image stop working.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/vault-markets/share-cards/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'get_vault_profile_settings',
    description: 'The user\'s public vault profile switch: whether it is on, whether followers see their new buys, the profile URL and follower count.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/profile'),
  },
  {
    name: 'update_vault_profile_settings',
    description: 'Turn the user\'s public vault profile on or off and choose whether followers see their new vault buys. The profile shows weights by market, never dollars. Going public needs a handle.',
    inputSchema: {
      type: 'object',
      properties: {
        isPublic: { type: 'boolean', description: 'true = the profile is public at /shop/u/<handle>/vault.' },
        showBuys: { type: 'boolean', description: 'true = followers see new vault buys (never prices).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/vault-markets/profile', args),
  },
  {
    name: 'get_vault_public_profile',
    description: 'Someone\'s public vault: each market\'s weight (basis points of the marked value), followers, whether the user follows them, and their recent buys (no prices).',
    inputSchema: { type: 'object', properties: { handle: HANDLE }, required: ['handle'], additionalProperties: false },
    handler: (args) => {
      const { handle } = args as { handle: string };
      return apiGet(`/v1/vault-markets/profiles/${encodeURIComponent(handle)}`);
    },
  },
  {
    name: 'follow_vault_profile',
    description: 'Follow someone with a public vault so their new vault buys appear in the user\'s feed. This never copies their trades.',
    inputSchema: { type: 'object', properties: { handle: HANDLE }, required: ['handle'], additionalProperties: false },
    handler: (args) => {
      const { handle } = args as { handle: string };
      return apiPost(`/v1/vault-markets/profiles/${encodeURIComponent(handle)}/follow`, {});
    },
  },
  {
    name: 'unfollow_vault_profile',
    description: 'Stop following someone.',
    inputSchema: { type: 'object', properties: { handle: HANDLE }, required: ['handle'], additionalProperties: false },
    handler: (args) => {
      const { handle } = args as { handle: string };
      return apiDelete(`/v1/vault-markets/profiles/${encodeURIComponent(handle)}/follow`);
    },
  },
  {
    name: 'get_vault_feed',
    description: 'New vault buys by the people the user follows who share them, newest first, with each market\'s mark and a link to buy that market normally. No prices of their buys.',
    inputSchema: {
      type: 'object',
      properties: {
        before: { type: 'string', description: 'ISO time: only buys before it (the last item\'s "at" to page).' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 30, description: 'How many (1-50). Default 30.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { before, limit } = args as { before?: string; limit?: number };
      return apiGet('/v1/vault-markets/feed', { before, limit });
    },
  },
  {
    name: 'get_vault_learn',
    description: 'The Vault Learn hub: each concept (marks, Instant Exit, lending, shorts, liens, auctions, indexes) with whether the user passed its quiz. Quizzes earn cosmetic pins only.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/learn'),
  },
  {
    name: 'get_vault_learn_concept',
    description: 'One Learn concept: its explanation and quiz questions (no answers).',
    inputSchema: { type: 'object', properties: { concept: CONCEPT }, required: ['concept'], additionalProperties: false },
    handler: (args) => {
      const { concept } = args as { concept: string };
      return apiGet(`/v1/vault-markets/learn/${encodeURIComponent(concept)}`);
    },
  },
  {
    name: 'answer_vault_learn_quiz',
    description: 'Submit the user\'s answers to a concept\'s quiz, one choice index (0-based) per question in order. Graded on the server; says which were right. 5 tries an hour per concept.',
    inputSchema: {
      type: 'object',
      properties: { concept: CONCEPT, answers: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 1, maxItems: 10, description: 'The chosen choice index for each question.' } },
      required: ['concept', 'answers'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { concept, answers } = args as { concept: string; answers: number[] };
      return apiPost(`/v1/vault-markets/learn/${encodeURIComponent(concept)}/quiz`, { answers });
    },
  },
  {
    name: 'get_vault_report',
    description: 'The quarterly Crossly Vault Report: index levels, top movers, most-lent markets and grade premiums, from the order book only (A/B quality marks).',
    inputSchema: { type: 'object', properties: { quarter: { type: 'string', description: 'Like "2026-q3". Default: the latest quarter.' } }, additionalProperties: false },
    handler: (args) => {
      const { quarter } = args as { quarter?: string };
      return apiGet('/v1/vault-markets/report', { quarter });
    },
  },
  {
    name: 'get_vault_press_kit',
    description: 'The press kit: each built-in index with its level, quality, n, CSV download and a "cite as" line, plus methodology links and the embed snippets.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/press'),
  },
  {
    name: 'get_vault_index_levels',
    description: 'An index\'s daily closes (up to 5 years), oldest first.',
    inputSchema: { type: 'object', properties: { slug: SLUG }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}/levels`);
    },
  },
  {
    name: 'get_vault_index_widget',
    description: 'What the <crossly-index> widget shows for an index: level, closes, quality, n, as-of, or insufficient=true when too few reliable marks.',
    inputSchema: { type: 'object', properties: { slug: SLUG, range: RANGE }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, range } = args as { slug: string; range?: string };
      return apiGet(`/v1/vault-markets/widgets/index/${encodeURIComponent(slug)}`, { range });
    },
  },
  {
    name: 'get_vault_mark_widget',
    description: 'What the <crossly-mark> widget shows for a market: mark, quality, trades over 30 days, as-of and a sparkline, or insufficient=true when there is no market yet.',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: { type: 'string', description: 'The market: variantId:condition:gradeKey, with grade "-" when ungraded.' },
        range: RANGE,
      },
      required: ['bookKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookKey, range } = args as { bookKey: string; range?: string };
      return apiGet('/v1/vault-markets/widgets/mark', { bookKey, range });
    },
  },
];
