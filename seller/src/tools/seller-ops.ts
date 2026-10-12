import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Seller ops: building and publishing variation / purchase-rule groups, and
 * the forward-looking inventory reads (aging, cohort sell-through, portfolio
 * value over time).
 *
 * Tools whose actions use DIFFERENT HTTP methods dispatch through functions
 * declared above the array, so the v1-parity scanner cannot cross them.
 */

const enc = encodeURIComponent;

function manageGroup(args: Record<string, unknown>): Promise<unknown> {
  const a = args as {
    action: 'create' | 'generate' | 'update' | 'publish' | 'dissolve';
    groupId?: string; kind?: string; title?: string; axisName?: string; rule?: Record<string, unknown>;
    members?: Array<{ listingId: string; axisValue?: string }>; sourceListingId?: string; sourceValue?: string;
    options?: Array<{ value: string; price?: number; quantity?: number; sku?: string }>; platforms?: string[]; idempotencyKey?: string;
  };
  if (a.action === 'create') return apiPost('/api/v1/variation-groups', { kind: a.kind, title: a.title, axisName: a.axisName, rule: a.rule, members: a.members }, a.idempotencyKey);
  if (a.action === 'generate') return apiPost('/api/v1/variation-groups/generate', { sourceListingId: a.sourceListingId, axisName: a.axisName, sourceValue: a.sourceValue, options: a.options }, a.idempotencyKey);
  if (!a.groupId) return Promise.reject(new Error('groupId is required for this action'));
  const id = enc(a.groupId);
  if (a.action === 'update') return apiPatch(`/api/v1/variation-groups/${id}`, { title: a.title, axisName: a.axisName, rule: a.rule });
  if (a.action === 'publish') return apiPost(`/api/v1/variation-groups/${id}/publish`, { platforms: a.platforms ?? [] }, a.idempotencyKey);
  return apiDelete(`/api/v1/variation-groups/${id}`);
}

function insights(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { what: 'aging' | 'sell_through' | 'value_history'; start?: string; end?: string; days?: number };
  if (a.what === 'aging') return apiGet('/v1/inventory/aging');
  if (a.what === 'sell_through') return apiGet('/v1/inventory/sell-through', { start: a.start, end: a.end });
  return apiGet('/v1/inventory/value-history', { days: a.days });
}

export const sellerOpsTools: ToolDef[] = [
  {
    name: 'manage_variation_group',
    description:
      'Build and publish grouped listings. create: group existing listings (kind variation with axisName + members[].axisValue, '
      + 'or kind group with a purchase rule {minQty|minSpendCents|note|allowPairWithAnyItem} written into every member\'s description and enforced '
      + 'at Crossly checkout). generate: turn ONE listing into a variation group — sourceListingId, axisName ("Size"), sourceValue (its own value), '
      + 'options[{value, price?, quantity?, sku?}] each become a new listing with its own stock. update: title / axisName / rule. publish: per '
      + 'platform (one listing with a picker on eBay, Shopify and Etsy; one per option elsewhere) — call get_variation_publish_plan first. '
      + 'dissolve: members stay listings. listings:write.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'generate', 'update', 'publish', 'dissolve'], description: 'create = group existing listings; generate = split one listing into a variation per option; update = retitle / rename axis / change rule (groupId); publish = push to platforms (groupId, platforms); dissolve = break up the group, members stay listings (groupId).' },
        groupId: { type: 'string', description: 'update / publish / dissolve: the group id.' },
        kind: { type: 'string', enum: ['variation', 'group'], description: 'create: variation = one product across an axis such as Size (needs axisName + members[].axisValue); group = a purchase-rule bundle ("buy any 3", needs rule). Default variation.' },
        title: { type: 'string', description: 'create / update: the group title, 1-200 characters.' },
        axisName: { type: 'string', description: 'create / generate / update: the variation axis ("Size", "Condition", "Pressing"), 1-40 characters.' },
        rule: { type: 'object', description: "create / update, kind group: { minQty (2-100), minSpendCents (integer CENTS, e.g. 5000 = $50.00), note (up to 280 chars), allowPairWithAnyItem }; written into every member's description and enforced at checkout." },
        members: { type: 'array', items: { type: 'object' }, description: 'create: 2-250 existing listings as [{ listingId, axisValue? }]; axisValue is the value of that listing on the axis (e.g. "M").' },
        sourceListingId: { type: 'string', description: 'generate: the listing to turn into a variation group.' },
        sourceValue: { type: 'string', description: 'generate: the own value of the source listing on the axis (e.g. "M"), 1-60 characters.' },
        options: { type: 'array', items: { type: 'object' }, description: "generate: 1-249 new values as [{ value, price?, quantity?, sku? }]; price is DOLLARS (e.g. 19.99), blank = the source listing's price; each becomes its own listing." },
        platforms: { type: 'array', items: { type: 'string' }, description: 'publish: platform keys to publish to (e.g. ebay, shopify, etsy), 1-20.' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header on create/generate/publish.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => manageGroup(args),
  },
  {
    name: 'inventory_insights',
    description:
      'Forward-looking inventory. aging: unsold stock by age (0-7, 7-30, 30-90, 90+ days, unlisted) with a recommendation per bucket. '
      + 'sell_through: of what came in during a window (default the 30 days ending 30 days ago), how much sold — against the previous window. '
      + 'value_history: portfolio value of unsold stock over time (days, default 90). analytics:read.',
    inputSchema: {
      type: 'object',
      properties: {
        what: { type: 'string', enum: ['aging', 'sell_through', 'value_history'], description: "aging = unsold stock by age bucket with recommendations; sell_through = share of a window's intake that sold, vs the previous window (start, end); value_history = unsold stock value over time (days)." },
        start: { type: 'string', description: 'sell_through window start (ISO date).' },
        end: { type: 'string', description: 'sell_through window end (ISO date).' },
        days: { type: 'number', description: 'value_history span, 1-730.' },
      },
      required: ['what'],
      additionalProperties: false,
    },
    handler: (args) => insights(args),
  },
];
