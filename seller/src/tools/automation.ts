import { automationRecipes } from './automation/recipes.js';
import { automationRules } from './automation/rules.js';
import { networkPool } from './automation/network.js';
import { notificationIntegrations } from './automation/notifications.js';
import { workflowChains } from './automation/chains.js';
import { ToolDef } from './types.js';

/**
 * Automation — rules, chains, recipes, notification destinations and the
 * Crossly Network pool.
 *
 * ── THE IDS ARE A CONTROLLED VOCABULARY ───────────────────────────────
 * triggerType / conditionType / actionType (and a chain's triggerId +
 * per-step actionId) are dotted catalog ids defined in the api's
 * `lib/automation-catalog/` — "schedule.interval", "listing.sold",
 * "listing.price_drop", "notify.slack". They are NOT free text, and an
 * id the catalog does not know is rejected. `get_automation_catalog`
 * returns the live list together with each entry's `configSchema`, which
 * is what the matching triggerConfig / conditionConfig / actionConfig
 * object is validated against. Read it before composing a rule rather
 * than guessing a plausible-looking name.
 *
 * ── UNITS DIFFER BETWEEN CONFIG KEYS ──────────────────────────────────
 * Inside these free-form config objects: `*Cents` keys are integer CENTS,
 * plain price/floor/threshold keys are USD DOLLARS, `percent`/`*Pct` keys
 * are percentages, `delayMs` / `waitMs` are MILLISECONDS, and
 * `intervalMinutes` is MINUTES (floored at 15 by the server).
 *
 * ── CREATING A SCHEDULED RULE DOES NOT SCHEDULE IT ────────────────────
 * `create_automation_rule` writes the row without a nextRunAt, and the
 * scheduler only picks up rules that have one. A schedule.* rule made
 * this way sits inert until `update_automation_rule`,
 * `toggle_automation_rule` or `run_automation_rule_now` arms it.
 * Event-driven triggers fire from hooks and need no arming.
 */
export const automationTools: ToolDef[] = [
  ...automationRules,
  ...automationRecipes,
  ...workflowChains,
  ...notificationIntegrations,
  ...networkPool,
];
