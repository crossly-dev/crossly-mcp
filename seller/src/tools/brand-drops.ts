import { apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Brand drops — an approved drop partner's promoted drop-day releases,
 * featured on the Crossly home page and market with a countdown.
 * Backed by /v1/brand-drops. Not the line-and-draw drops (drops tools).
 */

const STATUS_FLOW =
  'Lifecycle: draft → (pending_review → Crossly approves) → scheduled → live at dropAt → ended. Partners with ' +
  'canSelfPublish schedule directly; everyone else submits for review. Editing the name, time or description of a ' +
  'reviewed drop sends it back to review. Live and finished drops cannot be changed.';

const DROP_ID = { type: 'string', description: 'UUID of one of your brand drops (from list_brand_drops); 404 otherwise.' };

const withKey = (args: Record<string, unknown>) => {
  const { idempotencyKey, ...rest } = args as Record<string, unknown> & { idempotencyKey?: string };
  return { idempotencyKey, rest };
};

export const brandDropsTools: ToolDef[] = [
  {
    name: 'get_brand_drop_partner',
    description:
      "The seller's drop-partner terms and this month's usage: fee (feeBps basis points; null = standard market fee, " +
      'not zero), promotion tier, maxDropsPerMonth and how many are used, maxUnitsPerDrop, and canSelfPublish (whether ' +
      'drops can be scheduled without Crossly review). partner is null when the seller is not an approved partner — ' +
      'they apply at crossly.net/drops/apply.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/brand-drops/partner'),
  },
  {
    name: 'list_brand_drops',
    description: `List the seller's brand drops, newest start time first, each with status, listingCount and any review note. ${STATUS_FLOW}`,
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'pending_review', 'scheduled', 'live', 'sold_out', 'ended', 'cancelled'],
          description: 'Only drops in this state: draft (being prepared), pending_review (waiting on Crossly), scheduled (will go live at dropAt), live, sold_out, ended, cancelled. Omit for all.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: 'Most drops to return (1-200, default 50).' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/brand-drops', args),
  },
  {
    name: 'get_brand_drop',
    description: 'One brand drop by id, with its status and any note from Crossly review.',
    inputSchema: { type: 'object', properties: { dropId: DROP_ID }, required: ['dropId'], additionalProperties: false },
    handler: (args) => apiGet(`/v1/brand-drops/${encodeURIComponent(String(args.dropId))}`),
  },
  {
    name: 'create_brand_drop',
    description:
      'Create a brand drop as a DRAFT. Approved partners only (403 drop_partner_required); counts against the monthly ' +
      'allowance (403 drop_quota_exhausted). Add listings with set_brand_drop_listings, then submit_brand_drop or ' +
      `schedule_brand_drop. ${STATUS_FLOW} Pass an idempotencyKey on retries.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 120, description: 'What buyers see on the countdown.' },
        dropAt: { type: 'string', description: 'ISO 8601 timestamp in the future when the drop goes live.' },
        description: { type: 'string', maxLength: 2000, description: "What's in the drop, shown to buyers. Optional." },
        coverImageUrl: { type: 'string', description: 'https URL of a cover image.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'dropAt'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, rest } = withKey(args);
      return apiPost('/v1/brand-drops', rest, idempotencyKey);
    },
  },
  {
    name: 'update_brand_drop',
    description:
      'Edit a brand drop (name, dropAt, description, coverImageUrl, endsAt, perCustomerLimit, buyerApiEnabled — closing ' +
      `the buyer API needs canGateBuyerApi) and/or set status. ${STATUS_FLOW} Pass an idempotencyKey on retries.`,
    inputSchema: {
      type: 'object',
      properties: {
        dropId: DROP_ID,
        name: { type: 'string', minLength: 2, maxLength: 120, description: 'New name shown on the countdown.' },
        dropAt: { type: 'string', description: 'ISO 8601, in the future.' },
        description: { type: ['string', 'null'], maxLength: 2000, description: 'New description; null clears it.' },
        coverImageUrl: { type: ['string', 'null'], description: 'https URL of a cover image; null clears it.' },
        endsAt: { type: ['string', 'null'], description: 'ISO 8601; when the drop closes. null = no end.' },
        perCustomerLimit: { type: ['integer', 'null'], minimum: 1, maximum: 100, description: 'Most units one buyer may buy in this drop (1-100); null = no limit.' },
        buyerApiEnabled: { type: 'boolean', description: 'false closes programmatic buying (the buyer API) during the drop — needs canGateBuyerApi in your terms (403 otherwise).' },
        status: {
          type: 'string',
          enum: ['draft', 'pending_review', 'scheduled', 'cancelled'],
          description: 'draft = withdraw / unschedule; pending_review = submit; scheduled = canSelfPublish only; cancelled.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['dropId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, rest } = withKey(args);
      const { dropId, ...body } = rest;
      return apiPatch(`/v1/brand-drops/${encodeURIComponent(String(dropId))}`, body, idempotencyKey);
    },
  },
  {
    name: 'submit_brand_drop',
    description: 'Submit a draft brand drop for Crossly review (needs a future dropAt). Once approved it is scheduled and goes live at dropAt.',
    inputSchema: { type: 'object', properties: { dropId: DROP_ID, ...IDEMPOTENCY_PROP }, required: ['dropId'], additionalProperties: false },
    handler: (args) =>
      apiPatch(`/v1/brand-drops/${encodeURIComponent(String(args.dropId))}`, { status: 'pending_review' }, args.idempotencyKey as string | undefined),
  },
  {
    name: 'schedule_brand_drop',
    description:
      'Schedule a draft brand drop to go live at its dropAt WITHOUT review. Only for partners with canSelfPublish ' +
      '(check get_brand_drop_partner); others get 403 drop_review_required and should use submit_brand_drop.',
    inputSchema: { type: 'object', properties: { dropId: DROP_ID, ...IDEMPOTENCY_PROP }, required: ['dropId'], additionalProperties: false },
    handler: (args) =>
      apiPatch(`/v1/brand-drops/${encodeURIComponent(String(args.dropId))}`, { status: 'scheduled' }, args.idempotencyKey as string | undefined),
  },
  {
    name: 'cancel_brand_drop',
    description: 'Cancel a brand drop that is not live yet. Permanent — a cancelled drop cannot be reopened; its listings stay on Crossly as normal listings.',
    inputSchema: { type: 'object', properties: { dropId: DROP_ID, ...IDEMPOTENCY_PROP }, required: ['dropId'], additionalProperties: false },
    handler: (args) =>
      apiPatch(`/v1/brand-drops/${encodeURIComponent(String(args.dropId))}`, { status: 'cancelled' }, args.idempotencyKey as string | undefined),
  },
  {
    name: 'get_brand_drop_listings',
    description: 'The listings a brand drop releases when it goes live (title, image, price, master listingId).',
    inputSchema: { type: 'object', properties: { dropId: DROP_ID }, required: ['dropId'], additionalProperties: false },
    handler: (args) => apiGet(`/v1/brand-drops/${encodeURIComponent(String(args.dropId))}/listings`),
  },
  {
    name: 'set_brand_drop_listings',
    description:
      'REPLACE the listings a brand drop releases with this set of master listing ids (from list_listings), up to 100. ' +
      'Each must already be listed on Crossly, or the call fails with listing_not_on_crossly naming them. Send [] to ' +
      'empty it. Not allowed once the drop is live or finished. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        dropId: DROP_ID,
        listingIds: { type: 'array', items: { type: 'string' }, maxItems: 100, description: 'Master listing ids (UUIDs from list_listings), each already on Crossly. The drop releases exactly these.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['dropId', 'listingIds'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPut(
        `/v1/brand-drops/${encodeURIComponent(String(args.dropId))}/listings`,
        { listingIds: args.listingIds },
        args.idempotencyKey as string | undefined,
      ),
  },
];
