import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The reprice log and approvals. Tools whose actions use DIFFERENT HTTP
 * methods dispatch through functions declared above the array, so the
 * v1-parity scanner cannot cross them.
 */

const enc = encodeURIComponent;

function reprices(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: 'list' | 'approve' | 'skip'; id?: string; pending?: boolean; listingId?: string; limit?: number; idempotencyKey?: string };
  if (a.action === 'list') {
    return apiGet('/v1/reprice-events', { pending: a.pending === undefined ? undefined : String(a.pending), listingId: a.listingId, limit: a.limit });
  }
  if (!a.id) return Promise.reject(new Error('id is required to approve or skip'));
  if (a.action === 'approve') return apiPost(`/api/v1/reprice-events/${enc(a.id)}/approve`, {}, a.idempotencyKey);
  return apiPost(`/api/v1/reprice-events/${enc(a.id)}/skip`, {}, a.idempotencyKey);
}

function soldComps(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { marketSkuId?: string; condition?: string; listingId?: string };
  return apiGet('/v1/pricing/sold-comps', { marketSkuId: a.marketSkuId, condition: a.condition, listingId: a.listingId });
}

export const repriceTools: ToolDef[] = [
  {
    name: 'reprice_events',
    description:
      'The reprice log: every decision a listing.reprice rule made (applied, held at a floor, or pending approval when the rule has '
      + 'requireApproval). list: pending=true for only those waiting, or filter by listingId. approve: applies exactly the recorded '
      + 'price to the recorded platform listing (proposals older than three days expire instead). skip: leaves the price. '
      + 'automation:write to approve or skip.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'approve', 'skip'], description: 'list = reprice decisions, newest first; approve = apply a pending proposal at its recorded price (id); skip = reject a pending proposal, price unchanged (id).' },
        id: { type: 'string', description: 'approve / skip: the reprice event id (from list).' },
        pending: { type: 'boolean', description: 'list: true = only proposals waiting for approval.' },
        listingId: { type: 'string', description: 'list: only events for this listing id (uuid).' },
        limit: { type: 'number', description: 'list: most events to return, 1-200.' },
        idempotencyKey: { type: 'string', description: 'approve / skip: sent as the Idempotency-Key header. Stable per intent so a retry cannot decide twice.' },
      },
      required: ['action'],
    },
    handler: (args) => reprices(args),
  },
  {
    name: 'sold_comps',
    description:
      'What one catalog product actually sold for across Crossly in the last 180 days — the numbers a listing.reprice rule '
      + 'with strategy "sold_median" prices against. Pass marketSkuId (+ optional condition) OR one of your listingIds. '
      + 'Returns median / p25 / p75 / p10 / p90 in integer cents (p10 and p90 null under 10 sales), the sale count, the last '
      + 'sale, and daysToSell (median / p25 / p75 days from listing to sale). comps is null until there are 3+ sales from 2+ '
      + 'sellers; holdCode then says why (no_market_sku, mixed_inventory, below_privacy_floor). Needs listings:read.',
    inputSchema: {
      type: 'object',
      properties: {
        marketSkuId: { type: 'string', description: 'The catalog SKU (uuid). Give this or listingId, not both.' },
        condition: { type: 'string', description: 'With marketSkuId: only sales in this condition. Omit for items with no condition set.' },
        listingId: { type: 'string', description: 'One of your listings (uuid); the SKU and condition of its inventory are used.' },
      },
    },
    handler: (args) => soldComps(args),
  },
];
