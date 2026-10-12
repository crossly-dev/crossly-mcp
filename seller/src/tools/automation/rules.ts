import { apiDelete, apiGet, apiPost, apiPut } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/**
 * Single-rule automation: trigger → (condition) → action.
 *
 * triggerType / conditionType / actionType are a CONTROLLED VOCABULARY —
 * the dotted catalog ids in `lib/automation-catalog/`. Call
 * `get_automation_catalog` for the live list plus each entry's
 * configSchema; the ids named in the argument descriptions below are real
 * but not exhaustive.
 */
export const automationRules: ToolDef[] = [
  {
    name: 'list_automation_rules',
    description:
      'List the seller\'s automation rules (e.g. "every 12h re-share my top 50 Poshmark closet items", ' +
      '"auto-decline offers below 60% of asking", "send a thank-you message after every sale"). ' +
      'Each rule has triggerType+triggerConfig, optional conditionType+conditionConfig, actionType+actionConfig, ' +
      'target platforms, isActive, and the scheduler bookkeeping (nextRunAt / lastRunAt / runCount). ' +
      'Use this before create_automation_rule to avoid duplicates.',
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
      'Create a new automation rule: triggerType decides WHEN it fires, the optional conditionType gates ' +
      'WHETHER the action runs, actionType decides WHAT happens. All three are dotted catalog ids — call ' +
      'get_automation_catalog first and read each entry\'s configSchema, because the matching *Config object ' +
      'is validated against it. NOTE: this create path stores the row without computing nextRunAt, so a ' +
      'schedule.* rule does not start ticking until it is armed by update_automation_rule, ' +
      'toggle_automation_rule or run_automation_rule_now. Event-driven triggers (listing.sold, ' +
      'inbox.offer_received, …) fire from event hooks and need no arming. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          maxLength: 120,
          description: 'Human-readable rule name shown in the seller\'s automation list. 1–120 characters.',
        },
        triggerType: {
          type: 'string',
          description:
            'Catalog trigger id — when the rule fires. Schedules: "schedule.cron", "schedule.daily", ' +
            '"schedule.interval", "schedule.window". Listing events: "listing.created", "listing.sold", ' +
            '"listing.liked", "listing.commented", "listing.price_dropped", "listing.age_reached", ' +
            '"listing.no_views_after", "listing.metric_threshold". Orders: "order.shipped", ' +
            '"order.ship_by_soon", "order.ship_by_overdue", "order.delivered", "order.disputed", ' +
            '"order.returned", "order.refunded", "order.cancelled", "order.unshipped_after". Also ' +
            '"inbox.offer_received", "inbox.ebay_offer_received", "inbox.message_received", ' +
            '"inventory.low_stock", "inventory.zero_qty", "market.competitor_underprice", ' +
            '"platform.disconnected". get_automation_catalog returns the authoritative list.',
        },
        triggerConfig: {
          type: 'object',
          description:
            'Parameters for the chosen triggerType, keyed exactly as its catalog configSchema. ' +
            '{ cron: "0 9 * * *", timezone: "America/New_York" } for schedule.cron; { hourUtc: 9 } (0–23) ' +
            'for schedule.daily; { intervalMinutes: 720 } for schedule.interval — MINUTES, and the server ' +
            'floors it at 15, rejecting anything smaller; { startsAt, endsAt } ISO-8601 datetimes for ' +
            'schedule.window; { ageDays: 30 } for listing.age_reached; { threshold: 1 } for ' +
            'inventory.low_stock. Pass {} for triggers that take no config.',
        },
        actionType: {
          type: 'string',
          description:
            'Catalog action id — what the rule does. Pricing: "listing.price_drop", "listing.reprice", ' +
            '"listing.price_raise", "listing.timed_discount", "listing.sync_price_to_lowest". Engagement: ' +
            '"listing.share_closet", "listing.share", "listing.community_share", "listing.like_for_like", ' +
            '"listing.share_for_share", "network.share_pool", "network.follow_pool", "network.like_pool". ' +
            'Offers/inbox: "listing.send_offer_to_likers", ' +
            '"listing.ebay_send_offer_to_interested_buyers", "inbox.send_message", "inbox.send_thank_you", ' +
            '"inbox.auto_decline_low_offer", "inbox.counter_offer", "inbox.offer_auto_respond", ' +
            '"inbox.archive_scam". Lifecycle: "listing.auto_relist", "listing.delist", ' +
            '"listing.archive_stale", "listing.expand_platforms", "listing.update_field", ' +
            '"listing.add_tag", "order.cancel", "account.toggle_vacation". Notifications: "notify.slack", ' +
            '"notify.discord", "notify.telegram", "notify.webhook", "notify.email_user".',
        },
        actionConfig: {
          type: 'object',
          description:
            'Parameters for the chosen actionType, keyed exactly as its catalog configSchema. ' +
            '{ mode: "percent", percent: 5, floor: 20 } for listing.price_drop (percent is a PERCENTAGE, ' +
            'floor/fixedAmount are USD dollars); { maxItems: 50, delayMs: 3000, order: "newest" } for ' +
            'listing.share_closet (delayMs is MILLISECONDS between shares); { strategy: "undercut_lowest", ' +
            'undercutByCents: 100, floorCents: 2500 } for listing.reprice (every *Cents field is integer ' +
            'CENTS; strategy is undercut_lowest | match_market | scheduled_decay | raise_back | sold_median, and ' +
            '{ strategy: "sold_median", percentile: "median", requireApproval: true } with triggerType ' +
            'listing.age_reached { ageDays: 30 } drops a still-unsold listing to what the same catalog product sold ' +
            'for — down only, holding when the listing has no market SKU or too few sales); { integrationId, template } for notify.slack / notify.discord / notify.webhook, where ' +
            'integrationId is a notification_integrations UUID from list_notification_integrations and the ' +
            'template supports {{listingTitle}} / {{price}} / {{buyerName}} / {{platform}} / {{saleAmount}}.',
        },
        conditionType: {
          type: 'string',
          description:
            'Optional gate — the action only runs when this matches. Catalog condition ids are ' +
            '"listing.platform", "listing.price_range", "listing.price_above", "listing.price_below", ' +
            '"listing.age_range", "listing.has_tags", "listing.has_label". Omit (or send "none") to run ' +
            'the action on every fire.',
        },
        conditionConfig: {
          type: 'object',
          description:
            'Parameters for the chosen conditionType. { platforms: ["poshmark"] } for listing.platform; ' +
            '{ threshold: 50 } USD dollars for listing.price_above / listing.price_below; ' +
            '{ minPrice, maxPrice } USD dollars for listing.price_range; { minDays, maxDays } for ' +
            'listing.age_range; { tags: ["vintage"], matchAll: false } for listing.has_tags.',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional rule-level platform slugs (e.g. ["poshmark","mercari","ebay"]). Only ' +
            'listing.timed_discount currently reads this column — every other action takes its own ' +
            'platform filter inside actionConfig.platforms, so set that too. Omit for all platforms.',
        },
        isActive: {
          type: 'boolean',
          default: true,
          description:
            'Whether the rule is enabled. Defaults to true; pass false to create it paused so the user can ' +
            'review it before it can fire.',
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
      'Full-replace update of an automation rule (PUT). Body shape mirrors create — pass every field, because ' +
      'omitted ones are not preserved. Unlike create, this path validates triggerType / conditionType / ' +
      'actionType against the live catalog (unknown ids are rejected 400), validates each config against the ' +
      'catalog configSchema, and recomputes nextRunAt for schedule triggers — so it is also how you arm a ' +
      'schedule rule that create left unscheduled. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID of the rule to replace, from list_automation_rules.' },
        name: {
          type: 'string',
          description: 'Rule name. Required by the server on this route; 1–200 characters.',
        },
        triggerType: {
          type: 'string',
          description:
            'Catalog trigger id — must be one the catalog knows (e.g. "schedule.interval", ' +
            '"listing.sold", "inbox.offer_received", "order.unshipped_after"). An unknown id is a 400.',
        },
        triggerConfig: {
          type: 'object',
          description:
            'Config for triggerType, keyed as its catalog configSchema — e.g. { intervalMinutes: 720 } ' +
            '(MINUTES, minimum 15) or { hourUtc: 9 } (0–23 UTC). Validated before the row is written, so a ' +
            'rule that could not be scheduled cannot be saved.',
        },
        actionType: {
          type: 'string',
          description:
            'Catalog action id — e.g. "listing.price_drop", "listing.share_closet", "notify.slack". ' +
            'An id outside the catalog is a 400.',
        },
        actionConfig: {
          type: 'object',
          description:
            'Config for actionType, keyed as its catalog configSchema. Mind the units: `percent` fields are ' +
            'percentages, `*Cents` fields are integer CENTS, plain price/floor fields are USD dollars, and ' +
            '`delayMs` / `waitMs` are MILLISECONDS.',
        },
        conditionType: {
          type: 'string',
          description:
            'Catalog condition id gating the action ("listing.price_above", "listing.has_tags", …), or ' +
            '"none". Defaults to "none" (always run) when omitted.',
        },
        conditionConfig: {
          type: 'object',
          description:
            'Config for conditionType — e.g. { threshold: 50 } in USD dollars for listing.price_above. ' +
            'Defaults to {} and is ignored when conditionType is "none".',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Rule-level platform slugs, or omit/null for all. Read today only by listing.timed_discount; ' +
            'other actions filter via actionConfig.platforms.',
        },
        isActive: {
          type: 'boolean',
          description:
            'Enabled flag. Defaults to true. false also clears nextRunAt, so the scheduler stops ticking ' +
            'the rule entirely.',
        },
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
        id: {
          type: 'string',
          description:
            'Rule UUID. The server reads the row and inverts its current isActive — there is no on/off ' +
            'argument, so read the rule first if you need a specific end state.',
        },
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
        id: {
          type: 'string',
          description:
            'Rule UUID to fire now. The run happens even when the rule is inactive, and it also recomputes ' +
            'nextRunAt — so this doubles as a way to arm a schedule rule.',
        },
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
  {
    name: 'delete_automation_rule',
    description:
      'Permanently delete an automation rule. Past actions it took remain in the audit log. ' +
      'If you just want to pause a rule, toggle_automation_rule (or update it to isActive=false) instead. ' +
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
        ruleId: {
          type: 'string',
          description: 'Optional rule UUID — return only fires of that single automation rule.',
        },
        chainId: {
          type: 'string',
          description: 'Optional workflow-chain UUID — return only step runs belonging to that chain.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          default: 100,
          description:
            'How many runs to return, newest first by createdAt. 1–500, default 100; the server clamps ' +
            'out-of-range values rather than erroring.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/automation/runs', args as Record<string, unknown>),
  },
];
