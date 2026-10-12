import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets set goals and the "complete my set" basket bid (api
 * routes/v1/write/vault-markets-set-goals.ts). A goal is one catalogue set;
 * progress is computed from what the user holds in the Crossly vault and each
 * missing piece is listed with its mark. One basket bid places a GTC limit buy
 * per missing piece under a hard total budget (limits plus the worst-case
 * buyer fee), paid by a saved card or the custodian account, every leg through
 * pre-trade risk; the legs are cancelled once the set is complete.
 */

const GOAL_ID = { type: 'string', description: 'The set goal id (a UUID) from list_vault_set_goals or create_vault_set_goal.' };
const CONDITION = { type: ['string', 'null'], description: 'The condition a piece must be in to count (as the goal options list them, e.g. "near_mint"), or null for any condition.' };
const GRADE_MODE = { type: 'string', enum: ['any', 'ungraded', 'exact'], description: 'Which grades count: "any" (any grade or none), "ungraded" (only ungraded units) or "exact" (only gradeKey).' };
const GRADE_KEY = { type: ['string', 'null'], description: 'The grade an "exact" goal wants, as the goal options list it (e.g. "psa:10"); null otherwise.' };
const BUDGET = { type: 'integer', description: 'The hard total budget, in cents of US dollars (100 to 25000000): every leg limit plus the worst-case buyer fee never adds up past it.' };
const BPS = { type: 'integer', description: 'How far over each piece mark a leg may pay, in basis points (0 to 2000; 500 = 5%). Default 500.' };
const SKU_IDS = { type: 'array', items: { type: 'string' }, description: 'Only these missing pieces (catalogue SKU ids from get_vault_set_goal). Leave out for every missing piece.' };

export const vaultMarketsSetGoalsTools: ToolDef[] = [
  {
    name: 'find_vault_sets',
    description: 'Find catalogue sets to start a set goal on. With q (2 or more characters): a word-start search of every set (a card set, a comic series, a sneaker line). Without q: the sets the user holds pieces of in the vault, then the collections they are building. Each has category, brandSlug and modelSlug (what create_vault_set_goal needs), pieces when known, and goalId when the user already has a goal on it.',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Words to search set names for (up to 80 characters). Leave out for the sets the user already holds pieces of.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { q } = args as { q?: string };
      return apiGet('/v1/vault-markets/set-goals/sets', q ? { q } : {});
    },
  },
  {
    name: 'list_vault_set_goals',
    description: 'The user set goals: each set, the target a piece must meet, pieces held of the total (computed from the vault), complete or not, and the working basket bid (budgetCents, committedCents and spentCents in cents of US dollars; legs working and filled).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/set-goals', {}),
  },
  {
    name: 'create_vault_set_goal',
    description: 'Start a set goal on a catalogue set (from find_vault_sets), optionally with a target: one condition, and any grade, ungraded, or one exact grade. One live goal per set, at most 20. Places no order and moves no money.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'The set category slug, from find_vault_sets.' },
        brandSlug: { type: 'string', description: 'The set brand slug, from find_vault_sets.' },
        modelSlug: { type: 'string', description: 'The set model slug, from find_vault_sets.' },
        condition: CONDITION,
        gradeMode: GRADE_MODE,
        gradeKey: GRADE_KEY,
      },
      required: ['category', 'brandSlug', 'modelSlug'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/set-goals', args),
  },
  {
    name: 'get_vault_set_goal',
    description: 'One set goal: every piece in set order, held (with the vault unit) or missing (bid: the cheapest marked book key that meets the target, markCents in cents of US dollars, or null when it has no price yet), the conditions and grades seen (options), and the working basket bid with each leg.',
    inputSchema: { type: 'object', properties: { goalId: GOAL_ID }, required: ['goalId'], additionalProperties: false },
    handler: (args) => {
      const { goalId } = args as { goalId: string };
      return apiGet(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}`, {});
    },
  },
  {
    name: 'update_vault_set_goal',
    description: 'Change what a piece must be to count toward a set goal. Refused while a basket bid works on the goal: cancel it first. Moves no money.',
    inputSchema: {
      type: 'object',
      properties: { goalId: GOAL_ID, condition: CONDITION, gradeMode: GRADE_MODE, gradeKey: GRADE_KEY },
      required: ['goalId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { goalId, ...patch } = args as { goalId: string; condition?: string | null; gradeMode?: string; gradeKey?: string | null };
      return apiPatch(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}`, patch);
    },
  },
  {
    name: 'remove_vault_set_goal',
    description: 'Remove a set goal. A working basket bid on it is cancelled first; whatever already filled stays in the vault. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { goalId: GOAL_ID }, required: ['goalId'], additionalProperties: false },
    handler: (args) => {
      const { goalId } = args as { goalId: string };
      return apiDelete(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}`);
    },
  },
  {
    name: 'plan_vault_set_basket',
    description: 'Preview the "complete my set" basket bid without placing anything: one leg per missing piece, cheapest first (limitCents = the mark plus maxBpsOverMark; costCents adds the worst-case buyer fee), the pieces skipped and why ("no_price", "over_budget", "not_chosen" or "too_many"), and committedCents, the most it can cost, never more than budgetCents. All money in cents of US dollars.',
    inputSchema: {
      type: 'object',
      properties: { goalId: GOAL_ID, budgetCents: BUDGET, maxBpsOverMark: BPS, skuIds: SKU_IDS },
      required: ['goalId', 'budgetCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { goalId, budgetCents, maxBpsOverMark, skuIds } = args as { goalId: string; budgetCents: number; maxBpsOverMark?: number; skuIds?: string[] };
      return apiGet(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}/basket-plan`, {
        budgetCents, ...(maxBpsOverMark != null ? { maxBpsOverMark } : {}), ...(skuIds?.length ? { skuIds: skuIds.join(',') } : {}),
      });
    },
  },
  {
    name: 'place_vault_set_basket',
    description: 'Place the "complete my set" basket bid: one GTC limit buy for one unit of each planned missing piece, under the hard budget. Each leg is an ordinary order that passes pre-trade risk and the ID check, paid at the match by the chosen saved card or the custodian account; the legs are cancelled once the set is complete. Show the user plan_vault_set_basket first and ask before calling. Pass the same clientBasketId on a retry so it is never placed twice.',
    inputSchema: {
      type: 'object',
      properties: {
        goalId: GOAL_ID,
        budgetCents: BUDGET,
        maxBpsOverMark: BPS,
        skuIds: SKU_IDS,
        funding: { type: 'string', enum: ['card', 'custodian'], description: 'How the legs are paid: "card" (one of the user saved cards, charged when a leg fills) or "custodian" (the Vault Markets custodian account; needs it open and active).' },
        stripePaymentMethodId: { type: 'string', description: 'For funding "card": the saved card id (pm_...), which must be one of the user own saved cards.' },
        clientBasketId: { type: 'string', description: 'Your own id for this basket (6 to 64 characters): a retry with the same id returns the basket already placed.' },
      },
      required: ['goalId', 'budgetCents', 'funding'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { goalId, ...body } = args as { goalId: string; budgetCents: number; funding: string; maxBpsOverMark?: number; skuIds?: string[]; stripePaymentMethodId?: string; clientBasketId?: string };
      return apiPost(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}/basket`, body, body.clientBasketId);
    },
  },
  {
    name: 'cancel_vault_set_basket',
    description: 'Cancel the working basket bid on a set goal: every working leg comes off the book; whatever already filled stays in the vault. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { goalId: GOAL_ID }, required: ['goalId'], additionalProperties: false },
    handler: (args) => {
      const { goalId } = args as { goalId: string };
      return apiPost(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}/basket/cancel`, {});
    },
  },
  {
    name: 'list_vault_set_baskets',
    description: 'A set goal basket bids, newest first: status ("working", "completed", "ended" or "cancelled"), budgetCents, committedCents and spentCents (cents of US dollars), and every leg (piece, book key, limitCents, the pro order id, status "pending", "working", "filled", "cancelled" or "rejected", and why).',
    inputSchema: {
      type: 'object',
      properties: { goalId: GOAL_ID, limit: { type: 'integer', description: 'How many basket bids to return, newest first (1 to 50; default 20).' } },
      required: ['goalId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { goalId, limit } = args as { goalId: string; limit?: number };
      return apiGet(`/v1/vault-markets/set-goals/${encodeURIComponent(goalId)}/baskets`, limit ? { limit } : {});
    },
  },
];
