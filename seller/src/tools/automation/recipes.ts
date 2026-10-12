import { apiGet, apiPost } from '../../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from '../types.js';

/**
 * Automation recipes — the portable JSON form of a rule.
 *
 * One rule ↔ one recipe: { schemaVersion: 1, name, description?, trigger:
 * { type, config }, condition?: { type, config }, action: { type, config },
 * platforms?, metadata? }. A bundle wraps many: { schemaVersion: 1,
 * exportedAt?, recipes: [...] }. Both import paths accept either shape.
 */
export const automationRecipes: ToolDef[] = [
  {
    name: 'export_automation_rules',
    description:
      "Export the seller's full automation rule library as a portable recipe bundle (JSON). Suitable for backup, sharing, " +
      'or migrating between accounts. The response is the bundle body itself — { schemaVersion: 1, exportedAt, recipes: [...] } ' +
      'with every id, timestamp and user reference stripped.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/automation/rules/export'),
  },
  {
    name: 'export_automation_rule',
    description: 'Export a single automation rule as a portable recipe JSON object.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Rule UUID from list_automation_rules. Returns one recipe — { schemaVersion: 1, name, trigger, ' +
            'condition?, action, platforms? } — safe to share, since ids, timestamps and the owning user are stripped.',
        },
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
      'Recipes whose trigger/condition/action fails catalog validation are skipped and returned in the response\'s ' +
      '`errors` array — a partial import is a success, so always read both `created` and `errors`. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: 'Recipe object or { schemaVersion, recipes: [...] } bundle.' },
        activate: {
          type: 'boolean',
          default: false,
          description:
            'Whether the imported rules are created enabled. Defaults to false — rules land paused with no ' +
            'nextRunAt so the seller reviews them first. true sets isActive and computes nextRunAt, meaning ' +
            'a schedule.* recipe can fire within the minute.',
        },
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
];
