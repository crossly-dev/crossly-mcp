import { apiDelete, apiGet, apiPost, apiPut } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/**
 * Workflow chains — one trigger, then an ordered list of steps.
 *
 * A chain's triggerId and every action/condition step id come from the same
 * automation catalog the single-rule tools use (`get_automation_catalog`).
 * The server rejects an id it does not know, so never invent one.
 */
export const workflowChains: ToolDef[] = [
  {
    name: 'list_workflow_chains',
    description:
      'List multi-step automation chains. A chain is a triggerId + an ordered list of steps where each step is ' +
      'an action, a wait, or a condition (branching). Use this to discover existing chains before creating one.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/workflow-chains'),
  },
  {
    name: 'get_workflow_chain',
    description: 'Get one workflow chain with its full step graph.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Chain UUID from list_workflow_chains. Returns { chain, steps } ordered by position.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/workflow-chains/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'create_workflow_chain',
    description:
      'Create a workflow chain. triggerId comes from the automation catalog (e.g. "listing.sold", "order.shipped"). ' +
      'Each step is { stepType: "action"|"wait"|"condition", actionId?: string, actionConfig?: object, waitMs?: integer }. ' +
      'Action + condition steps require actionId (catalog id); wait steps require waitMs. Condition steps may include ' +
      '`actionConfig.skipSteps` — number of steps to skip when false. Up to 50 steps per chain.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          maxLength: 200,
          description: 'Human-readable chain name shown in the seller\'s workflow list. 1–200 characters.',
        },
        triggerId: { type: 'string', description: 'Catalog triggerId (call get_automation_catalog to discover).' },
        triggerConfig: { type: 'object', description: 'Trigger config matching the catalog entry.' },
        steps: {
          type: 'array',
          description: 'Ordered step list.',
          items: {
            type: 'object',
            properties: {
              stepType: { type: 'string', enum: ['action', 'wait', 'condition'] },
              actionId: { type: 'string' },
              actionConfig: { type: 'object' },
              waitMs: { type: 'integer', minimum: 0 },
            },
            required: ['stepType'],
          },
          minItems: 1,
          maxItems: 50,
        },
        isActive: {
          type: 'boolean',
          default: true,
          description:
            'Whether the chain may fire. Defaults to true; pass false to save it paused while the user ' +
            'reviews the step list.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'triggerId', 'steps'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/workflow-chains', body, idempotencyKey);
    },
  },
  {
    name: 'update_workflow_chain',
    description:
      'Replace a workflow chain wholesale. Same body shape as create_workflow_chain (name/triggerId/triggerConfig/' +
      'steps/isActive). Steps are reassigned positions 0..N — no diff-merge.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID of the chain to replace, from list_workflow_chains.' },
        name: { type: 'string', description: 'New chain name, 1–200 characters. Required — this is a full replace.' },
        triggerId: {
          type: 'string',
          description:
            'Catalog trigger id that starts the chain — e.g. "listing.sold", "order.shipped", ' +
            '"inbox.message_received", "inventory.low_stock". Must exist in the catalog or the server 400s.',
        },
        triggerConfig: {
          type: 'object',
          description:
            'Config for triggerId, keyed as its catalog configSchema. Defaults to {} (fire on every event). ' +
            'Only a few triggers filter on it: { intent: "offer" } for inbox.message_received, ' +
            '{ threshold: 1 } for inventory.low_stock, { minDeltaPercent: 5 } for market.competitor_underprice.',
        },
        steps: {
          type: 'array',
          description:
            'The complete new ordered step list, 1–50 entries — the old steps are deleted and these are ' +
            'reinserted at positions 0..N. Each entry is { stepType: "action"|"wait"|"condition", actionId?, ' +
            'actionConfig?, waitMs? }: "action" needs a catalog action id in actionId, "condition" needs a ' +
            'catalog condition id in actionId (plus optional actionConfig.skipSteps — how many steps to jump ' +
            'when it is false; omitted means skip the rest of the chain), "wait" needs waitMs in MILLISECONDS ' +
            '(0 to 7776000000, i.e. 90 days).',
        },
        isActive: {
          type: 'boolean',
          description: 'Whether the chain may fire after the replace. Defaults to true if omitted.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'name', 'triggerId', 'steps'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPut(`/v1/workflow-chains/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'toggle_workflow_chain',
    description:
      'Flip a workflow chain between active and inactive. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Chain UUID. The server inverts the chain\'s current isActive and returns the updated row — ' +
            'there is no explicit on/off argument.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/workflow-chains/${encodeURIComponent(args.id as string)}/toggle`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'run_workflow_chain_now',
    description:
      'Enqueue an ad-hoc run of a workflow chain. Returns the chainRunId. Useful for "test this chain" workflows. Pass an ' +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Chain UUID to run now. The run starts at step 0 with trigger data { manual: true, firedAt }, ' +
            'so steps that read real trigger fields (listing, order, buyer) may find them missing.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/workflow-chains/${encodeURIComponent(args.id as string)}/run-now`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'delete_workflow_chain',
    description: 'Delete a workflow chain. Cascades to its steps + run history.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Chain UUID to delete. Irreversible — its steps and run history go with it.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/workflow-chains/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
];
