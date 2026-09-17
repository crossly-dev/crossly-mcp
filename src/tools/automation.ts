import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const automationTools: ToolDef[] = [
  {
    name: 'list_automation_rules',
    description:
      'List the seller\'s automation rules (e.g. "every 12h re-share my top 50 Poshmark closet items", ' +
      '"auto-decline offers below 60% of asking", "send a thank-you message after every sale"). ' +
      'Each rule has triggerType+triggerConfig, optional conditionType+conditionConfig, actionType+actionConfig, ' +
      'target platforms, and isActive. Use this before create_automation_rule to avoid duplicates.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/automation/rules'),
  },
  {
    name: 'create_automation_rule',
    description:
      'Create a new automation rule. The shape is generic — triggerType picks a class of event ("schedule", ' +
      '"new_offer", "new_sale", "stale_listing"…), triggerConfig parametrises it, actionType picks a class of ' +
      'action ("share_closet", "decline_offer", "send_message", "price_drop"…), actionConfig parametrises it. ' +
      'Read the Crossly docs (or the user\'s existing rules) to know which trigger/action combos are supported. ' +
      'Pass isActive=false to create-but-pause for review. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 120, description: 'Human-readable rule name.' },
        triggerType: {
          type: 'string',
          description:
            'What kicks the rule off — e.g. "schedule" (cron-like), "new_offer", "new_sale", "stale_listing", "low_stock".',
        },
        triggerConfig: {
          type: 'object',
          description: 'Free-form config for the trigger (e.g. { cron: "0 */12 * * *" } or { minDays: 14 }).',
        },
        actionType: {
          type: 'string',
          description: 'What the rule does — e.g. "share_closet", "price_drop", "decline_offer", "send_message", "delist".',
        },
        actionConfig: {
          type: 'object',
          description: 'Free-form config for the action (e.g. { percent: 5 } for price_drop, { template: "Hi {{buyer}}..." } for messages).',
        },
        conditionType: {
          type: 'string',
          description: 'Optional gating condition — only run the action if this matches (e.g. "price_above", "platform_in").',
        },
        conditionConfig: { type: 'object', description: 'Free-form condition config.' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Restrict the rule to these platform slugs. Omit for all.',
        },
        isActive: {
          type: 'boolean',
          default: true,
          description: 'false = create paused so the user can review before enabling.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'triggerType', 'triggerConfig', 'actionType', 'actionConfig'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/automation/rules', body, idempotencyKey);
    },
  },
  {
    name: 'delete_automation_rule',
    description:
      'Permanently delete an automation rule. Past actions it took remain in the audit log. ' +
      'If you just want to pause a rule, update it to isActive=false instead (when an update endpoint is available). ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Rule UUID from list_automation_rules.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/automation/rules/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'list_automation_runs',
    description:
      'Per-fire log for automation rules and workflow chains. Each row carries status (success / partial / ' +
      'failure / skipped), actionType, durationMs, errorMessage (when failed), and a summary jsonb. Filter by ' +
      'ruleId or chainId to debug "is my rule actually firing?" — without filters returns the 100 most recent fires.',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'Optional — filter to one rule.' },
        chainId: { type: 'string', description: 'Optional — filter to one chain.' },
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/automation/runs', args as Record<string, unknown>),
  },

  // ── Workflow chains ────────────────────────────────────────────────
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
      properties: { id: { type: 'string', description: 'Chain UUID.' } },
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
        name: { type: 'string', maxLength: 200 },
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
        isActive: { type: 'boolean', default: true },
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
        id: { type: 'string' },
        name: { type: 'string' },
        triggerId: { type: 'string' },
        triggerConfig: { type: 'object' },
        steps: { type: 'array' },
        isActive: { type: 'boolean' },
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
    name: 'delete_workflow_chain',
    description: 'Delete a workflow chain. Cascades to its steps + run history.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/workflow-chains/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },

  // ── Notification integrations (Slack / Discord / Webhook) ──────────
  {
    name: 'list_notification_integrations',
    description:
      'List the seller\'s outbound notification destinations. notify.* automation actions reference one of these by ' +
      'integrationId. Provider is slack / discord / webhook. The webhookUrl is masked in the response.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/notification-integrations'),
  },
  {
    name: 'create_notification_integration',
    description:
      'Add a notification destination. Slack/Discord: config = { webhookUrl }. Generic webhook: ' +
      'config = { url, headers?: object, hmacSecret?: string }. The seller mints incoming-webhook URLs in Slack/Discord ' +
      'admin or points the generic webhook at any URL.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['slack', 'discord', 'webhook'] },
        name: { type: 'string', maxLength: 80 },
        config: { type: 'object', description: 'Provider-shaped config.' },
        enabled: { type: 'boolean', default: true },
        ...IDEMPOTENCY_PROP,
      },
      required: ['provider', 'name', 'config'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/notification-integrations', body, idempotencyKey);
    },
  },
  {
    name: 'update_notification_integration',
    description: 'Patch a notification destination (name / enabled / config).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        enabled: { type: 'boolean' },
        config: { type: 'object' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPatch(`/v1/notification-integrations/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delete_notification_integration',
    description: 'Delete a notification destination. Any automation actions pointing at it start failing on next fire.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/notification-integrations/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },

  // ── Crossly Network pool ───────────────────────────────────────────
  {
    name: 'get_network_pool_membership',
    description:
      "Read the seller's Crossly Network pool membership row. Includes per-action toggles (shareEnabled / followEnabled / likeEnabled), opted-in platforms, karma counters (engagementsPerformed / engagementsReceived).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/network/pool'),
  },
  {
    name: 'get_network_pool_size',
    description: 'Total members in the pool. Use as the "how big is the network" stat.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/network/pool/size'),
  },
  {
    name: 'list_network_pool_log',
    description:
      'Recent engagement history. Each row records (engager → target, actionType, platform, performedAt). Both sent + received are surfaced.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/network/pool/log', args as Record<string, unknown>),
  },
  {
    name: 'join_network_pool',
    description:
      "Opt the seller into the Crossly Network reciprocal engagement pool. Required before the network.share_pool / " +
      'network.follow_pool / network.like_pool automation actions will fire.',
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/network/pool', {}, args.idempotencyKey as string | undefined),
  },
  {
    name: 'update_network_pool_membership',
    description: 'Patch per-action toggles + opted-in platforms on the pool membership row.',
    inputSchema: {
      type: 'object',
      properties: {
        shareEnabled: { type: 'boolean' },
        followEnabled: { type: 'boolean' },
        likeEnabled: { type: 'boolean' },
        platforms: { type: 'array', items: { type: 'string' } },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPatch('/v1/network/pool', body, idempotencyKey);
    },
  },
  {
    name: 'leave_network_pool',
    description: "Drop out of the pool. Network.* automation actions stop firing; other members stop engaging with the seller's catalog.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete('/v1/network/pool', args.idempotencyKey as string | undefined),
  },

  // ── Per-rule operations ────────────────────────────────────────────────
  {
    name: 'get_automation_rule',
    description: 'Get a single automation rule by id, with its full trigger / condition / action config.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Rule UUID.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/automation/rules/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'update_automation_rule',
    description:
      'Full-replace update of an automation rule (PUT). Body shape mirrors create — pass every field. The server validates ' +
      'trigger/condition/action configs against the catalog and recomputes nextRunAt for schedule triggers. Pass an ' +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        triggerType: { type: 'string' },
        triggerConfig: { type: 'object' },
        actionType: { type: 'string' },
        actionConfig: { type: 'object' },
        conditionType: { type: 'string' },
        conditionConfig: { type: 'object' },
        platforms: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPut(`/v1/automation/rules/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'toggle_automation_rule',
    description:
      'Flip an automation rule between active and inactive. Schedule-trigger rules also get their nextRunAt recomputed when ' +
      'flipping back to active. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/automation/rules/${encodeURIComponent(args.id as string)}/toggle`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'run_automation_rule_now',
    description:
      'Fire an automation rule immediately, regardless of its trigger. Useful for "test this rule" workflows. Returns the ' +
      "queued jobId. Updates lastRunAt + runCount on the rule. Pass an idempotencyKey on retries — but note that 'run-now' " +
      'really does run a fresh execution every time the idempotency cache misses.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/automation/rules/${encodeURIComponent(args.id as string)}/run-now`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },

  // ── Recipe import / export ─────────────────────────────────────────────
  {
    name: 'export_automation_rules',
    description:
      "Export the seller's full automation rule library as a portable recipe bundle (JSON). Suitable for backup, sharing, " +
      'or migrating between accounts. The response is the bundle body itself.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/automation/rules/export'),
  },
  {
    name: 'export_automation_rule',
    description: 'Export a single automation rule as a portable recipe JSON object.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/automation/rules/${encodeURIComponent(args.id as string)}/export`),
  },
  {
    name: 'import_automation_recipes',
    description:
      'Import one or more rules from recipe JSON (single recipe or a bundle of recipes). Pass activate=true to leave the ' +
      'imported rules enabled (default is paused so the seller can review first). The body must match the recipe schema. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: 'Recipe object or { schemaVersion, recipes: [...] } bundle.' },
        activate: { type: 'boolean', default: false },
        ...IDEMPOTENCY_PROP,
      },
      required: ['payload'],
      additionalProperties: false,
    },
    handler: (args) => {
      const idempotencyKey = args.idempotencyKey as string | undefined;
      const activate = args.activate === true;
      const path = `/v1/automation/rules/import${activate ? '?activate=true' : ''}`;
      return apiPost(path, args.payload as Record<string, unknown>, idempotencyKey);
    },
  },
  {
    name: 'validate_automation_recipe',
    description:
      'Dry-run validate one or more recipes against the live catalog WITHOUT importing. Returns per-recipe valid/errors. Use ' +
      'this before import_automation_recipes to surface issues to the user.',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: 'Recipe object or { schemaVersion, recipes: [...] } bundle.' },
      },
      required: ['payload'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/automation/rules/validate-recipe', args.payload as Record<string, unknown>),
  },

  // ── Workflow chain ops ────────────────────────────────────────────────
  {
    name: 'toggle_workflow_chain',
    description:
      'Flip a workflow chain between active and inactive. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
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
        id: { type: 'string' },
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

  // ── Notification integrations ─────────────────────────────────────────
  {
    name: 'test_notification_integration',
    description:
      'Fire a canned test message to a notification destination (Slack/Discord/Webhook). Useful for "did I configure the ' +
      'webhook URL correctly?" verification before wiring it into automation rules. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/notification-integrations/${encodeURIComponent(args.id as string)}/test`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
];
