import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Templates — unified. Every method hits the same underlying table
 * (scope='listing' | 'description') so an agent can save both a
 * canonical description snippet AND a full listing bootstrap with
 * consistent semantics. Legacy list/create/update/delete tools below
 * still work for back-compat and delegate to the same store.
 */
export const templatesTools: ToolDef[] = [
  {
    name: 'list_templates',
    description:
      "List the seller's templates. Every row has a `scope` ('listing' or 'description') and typed fields " +
      '(title, description, brand, condition, color, size, category, weight, dimensions, tags, ' +
      'platformOverrides, defaultForCategory, isDefault, titleVariants[], descriptionVariants[]). ' +
      "Preview `fieldsFilled` is a compact list of which fields the template populates — use it to render " +
      "\"this template fills Title + Brand + Condition\" hints. Optional scope + category filters.",
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['listing', 'description'] },
        category: { type: 'string', description: 'Filter to rows whose defaultForCategory matches.' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/me/templates', args as Record<string, string | undefined>),
  },
  {
    name: 'get_template',
    description:
      "Full row for one template by ID. Includes every typed field + free-form extras. Use this to hydrate " +
      "a listing form after picking a template.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/me/templates/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'suggest_template',
    description:
      "Return the seller's default template for a category (`null` when none set). Use this when the seller " +
      "picks a category so the form auto-hydrates without a picker.",
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category to look up (matches defaultForCategory).' },
      },
      required: ['category'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/me/templates/suggest', { category: args.category as string }),
  },
  {
    name: 'create_template',
    description:
      "Create a template. Required: scope ('listing' or 'description') + name. Every other field is optional; " +
      "only the ones you set populate the corresponding form field on apply. Set defaultForCategory + isDefault " +
      "to make it the auto-hydrate template when the seller picks that category.",
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['listing', 'description'] },
        name: { type: 'string', minLength: 1, maxLength: 120 },
        notes: { type: 'string', maxLength: 1000 },
        title: { type: 'string', maxLength: 200 },
        titleVariants: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        description: { type: 'string' },
        descriptionVariants: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        brand: { type: 'string' },
        condition: { type: 'string', enum: ['new','like_new','good','fair','poor'] },
        color: { type: 'string' },
        material: { type: 'string' },
        size: { type: 'string' },
        sizeSystem: { type: 'string' },
        weightOz: { type: 'integer' },
        dimensions: {
          type: 'object',
          properties: { lengthIn: { type: 'number' }, widthIn: { type: 'number' }, heightIn: { type: 'number' } },
        },
        categoryPath: {
          type: 'object',
          properties: { main: { type: 'string' }, sub: { type: 'string' }, sub2: { type: 'string' } },
        },
        department: { type: 'string' },
        gender: { type: 'string' },
        style: { type: 'string' },
        pattern: { type: 'string' },
        itemType: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        platformOverrides: { type: 'object' },
        defaultForCategory: { type: 'string' },
        isDefault: { type: 'boolean' },
        extras: { type: 'object' },
        sortOrder: { type: 'integer' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['scope', 'name'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/me/templates', body, idempotencyKey);
    },
  },
  {
    name: 'update_template',
    description:
      "Patch a template by ID. Pass only the fields you want to change; anything you send as null clears the " +
      "field, anything you omit is left alone.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        notes: { type: 'string' },
        title: { type: 'string' },
        titleVariants: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        descriptionVariants: { type: 'array', items: { type: 'string' } },
        brand: { type: 'string' },
        condition: { type: 'string' },
        color: { type: 'string' },
        material: { type: 'string' },
        size: { type: 'string' },
        weightOz: { type: 'integer' },
        dimensions: { type: 'object' },
        categoryPath: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        platformOverrides: { type: 'object' },
        defaultForCategory: { type: 'string' },
        isDefault: { type: 'boolean' },
        extras: { type: 'object' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPatch(`/v1/me/templates/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delete_template',
    description: 'Permanently delete a template by ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(`/v1/me/templates/${encodeURIComponent(args.id as string)}`, args.idempotencyKey as string | undefined),
  },
  {
    name: 'share_template',
    description:
      "Mint (or return existing) a read-only share token for a template. Response has `token`; construct the " +
      "public URL as `https://crossly.net/share/templates/${token}`. Idempotent — same call returns the same token.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost(`/v1/me/templates/${encodeURIComponent(args.id as string)}/share`, {}, idempotencyKey);
    },
  },
  {
    name: 'revoke_template_share',
    description: 'Revoke a template share token — future GETs to /public/templates/:token return 404.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(`/v1/me/templates/${encodeURIComponent(args.id as string)}/share`, args.idempotencyKey as string | undefined),
  },
  {
    name: 'import_templates',
    description:
      "Bulk import templates from a JSON blob or an array of them. Each item must have scope + name; " +
      "everything else optional. Never inherits isDefault — the seller opts in explicitly after import. " +
      "Returns the created IDs.",
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          oneOf: [
            { type: 'object' },
            { type: 'array', items: { type: 'object' } },
          ],
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['items'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, items } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/me/templates/import', items as Record<string, unknown>, idempotencyKey);
    },
  },
  {
    name: 'render_template',
    description:
      "Render a template's title and description against an item's data, WITHOUT applying it. " +
      "Do this before applying a template to a listing: the response's `missingTokens` tells you the template " +
      "wanted a Year (or a Size, or a Brand) that this item doesn't have, so you can warn the seller instead " +
      "of them finding out from a title that reads oddly on a live listing. " +
      "Tokens are SINGLE braces - {brand}, not {{brand}} - and anything in braces that is not a known token is " +
      "left untouched, because {50% off} is copy the seller typed, not a token we failed to fill. " +
      "Known tokens: item_name, brand, model, category, condition, color, size, material, style, price, sku, " +
      "year, month, date. Titles are capped at 80 characters (eBay's ceiling, the tightest we publish to). " +
      "variantIndex picks a stashed A/B phrasing: 0 is the base, 1 is the first variant; past the end falls " +
      "back to the base rather than rendering empty.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Template UUID.' },
        context: {
          type: 'object',
          description: 'Values for the tokens, e.g. { brand: "Nike", size: "M", price: 42 }.',
        },
        variantIndex: {
          type: 'integer',
          minimum: 0,
          description: '0 = the base title. 1..n = a stashed A/B variant.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, context, variantIndex } = args as {
        id: string;
        context?: Record<string, unknown>;
        variantIndex?: number;
      };
      return apiPost(`/v1/me/templates/${encodeURIComponent(id)}/render`, { context, variantIndex });
    },
  },
];
