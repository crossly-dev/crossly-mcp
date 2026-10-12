import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Crossly Grading — send cards to PSA, CGC, SGC, TAG and others.
 *
 * A Grading Run is one bulk submission Crossly sends to a grader at one tier.
 * Reserving a slot is free; when the run reaches the grader's minimum by its
 * cutoff it LOCKS and every reserved card is charged on the seller's saved
 * card. Direct is the seller's own grader account: Crossly tracks the card
 * and verifies the cert, and takes no money.
 */
const MISS_MODE = {
  type: 'string',
  enum: ['roll_over', 'release'],
  description: 'If the run misses its minimum: roll the card into the next open run at this tier (default), or release it.',
} as const;
const RETURN_MODE = {
  type: 'string',
  enum: ['return', 'vault'],
  description: 'After grading: ship the slab back to you (default), or keep it in the Crossly vault.',
} as const;

export const gradingTools: ToolDef[] = [
  {
    name: 'list_grading_runs',
    description:
      'List Grading Runs taking reservations now, soonest cutoff first: grader, tier, price per card, handling fee, ' +
      'slots held vs capacity and minimum, cutoff, and what the run saves against sending one card alone. ' +
      '`meta.open` is false while runs are switched off.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/grading/runs', {}),
  },
  {
    name: 'get_grading_rate_card',
    description: 'Every grader and tier Crossly can send to, with the per-card price in cents (null = paused at the grader), minimum cards and declared-value cap.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/grading/rate-card', {}),
  },
  {
    name: 'list_grading_submissions',
    description:
      'List your cards out for grading (runs and Direct), newest first, with their status, charges, the inbound ' +
      'label to mail a card to the hub once its run locks, and the grade once it is back.',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean', description: 'true = only cards still in flight. Omit for every card.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { active } = args as { active?: boolean };
      return apiGet('/v1/grading/submissions', active == null ? {} : { active: active ? '1' : '0' });
    },
  },
  {
    name: 'get_grading_worth',
    description:
      'Is this inventory item worth grading? Its raw market value, what each grade it could come back at is worth at ' +
      'each grader, the cost, and the lowest grade that breaks even. It never predicts the grade.',
    inputSchema: {
      type: 'object',
      properties: { inventoryItemId: { type: 'string', description: 'Inventory item UUID.' } },
      required: ['inventoryItemId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { inventoryItemId } = args as { inventoryItemId: string };
      return apiGet(`/v1/grading/worth/${encodeURIComponent(inventoryItemId)}`, {});
    },
  },
  {
    name: 'reserve_grading_slot',
    description:
      'Hold a slot for one card in a Grading Run. Free now; the card is charged on the saved card ONLY if the run ' +
      'locks. Needs a full-access token and an idempotencyKey (derive it from the card, reuse it on retries).',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Grading Run UUID, from list_grading_runs.' },
        inventoryItemId: { type: 'string', description: 'Inventory item UUID of the card. Omit to name it with `title` instead.' },
        title: { type: 'string', description: 'The card, when it is not in your inventory. Up to 200 characters.' },
        declaredValueCents: { type: 'integer', minimum: 0, description: 'What the card is worth, in CENTS (integer). Some tiers cap it.' },
        prescreen: { type: 'boolean', description: 'A person checks centering and surface before the grader sees it, for a fee.' },
        missMode: MISS_MODE,
        returnMode: RETURN_MODE,
        ...IDEMPOTENCY_PROP,
      },
      required: ['runId', 'declaredValueCents', 'idempotencyKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { runId, idempotencyKey, ...body } = args as Record<string, unknown> & { runId: string; idempotencyKey?: string };
      return apiPost(`/v1/grading/runs/${encodeURIComponent(runId)}/reserve`, body, idempotencyKey);
    },
  },
  {
    name: 'cancel_grading_reservation',
    description: 'Pull a reserved card out of its run. Only while it is still reserved: nothing was charged. Once the run locks it is on its way.',
    inputSchema: {
      type: 'object',
      properties: { submissionId: { type: 'string', description: 'Grading submission UUID.' } },
      required: ['submissionId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { submissionId } = args as { submissionId: string };
      return apiPost(`/v1/grading/submissions/${encodeURIComponent(submissionId)}/cancel`, {});
    },
  },
  {
    name: 'mark_grading_shipped',
    description: 'Say you mailed a charged card to the hub (use the inbound label on the submission).',
    inputSchema: {
      type: 'object',
      properties: {
        submissionId: { type: 'string', description: 'Grading submission UUID.' },
        tracking: { type: 'string', description: 'Optional tracking number for the parcel to the hub.' },
      },
      required: ['submissionId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { submissionId, tracking } = args as { submissionId: string; tracking?: string };
      return apiPost(`/v1/grading/submissions/${encodeURIComponent(submissionId)}/shipped`, { tracking: tracking ?? null });
    },
  },
  {
    name: 'create_direct_grading',
    description:
      'Track a card you sent on your OWN grader account (Direct). Crossly takes no money; when it comes back, ' +
      'enter the grade with record_direct_grading_result and the cert is verified.',
    inputSchema: {
      type: 'object',
      properties: {
        graderSlug: { type: 'string', description: 'Grader slug, e.g. psa, cgc_cards, sgc, tag, bgs.' },
        tierSlug: { type: 'string', description: 'Optional service tier you used at the grader.' },
        inventoryItemId: { type: 'string', description: 'Inventory item UUID of the card. Omit to name it with `title` instead.' },
        title: { type: 'string', description: 'The card, when it is not in your inventory. Up to 200 characters.' },
        declaredValueCents: { type: 'integer', minimum: 0, description: 'What the card is worth, in CENTS (integer).' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['graderSlug', 'declaredValueCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/grading/direct', body, idempotencyKey);
    },
  },
  {
    name: 'record_direct_grading_result',
    description:
      'Direct submissions only: enter the grade that came back. It is written to the inventory item and every ' +
      'listing of it, and marked verified when the grader\'s cert record agrees.',
    inputSchema: {
      type: 'object',
      properties: {
        submissionId: { type: 'string', description: 'Grading submission UUID (a Direct one).' },
        grade: { type: 'string', description: "As the grader writes it: '10', '9.8', 'MS-65'. Must be a grade that grader issues." },
        qualifier: { type: 'string', description: 'Optional label qualifier, e.g. a CGC label tier.' },
        sealGrade: { type: 'string', description: 'Optional second axis on dual scales (WATA seal grade).' },
        certNumber: { type: 'string', description: 'Cert number on the slab; used to verify the grade.' },
      },
      required: ['submissionId', 'grade'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { submissionId, ...body } = args as Record<string, unknown> & { submissionId: string };
      return apiPost(`/v1/grading/submissions/${encodeURIComponent(submissionId)}/result`, body);
    },
  },
  {
    name: 'verify_grading_cert',
    description: 'Look a cert number up with its grader. Returns found=false when the grader has no record of it.',
    inputSchema: {
      type: 'object',
      properties: {
        graderSlug: { type: 'string', description: 'Grader slug, e.g. psa, cgc_cards, sgc, bgs.' },
        certNumber: { type: 'string', description: 'Cert number on the slab, 4 to 20 characters.' },
      },
      required: ['graderSlug', 'certNumber'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { graderSlug, certNumber } = args as { graderSlug: string; certNumber: string };
      return apiPost('/v1/grading/verify-cert', { graderSlug, certNumber });
    },
  },
];
