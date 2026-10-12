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
        scope: {
          type: 'string',
          enum: ['listing', 'description'],
          description:
            "Filter to one kind of template. 'listing' = a full listing bootstrap (title, brand, " +
            "condition, size, category, per-platform overrides…) that hydrates a whole listing form; " +
            "'description' = a reusable description snippet (measurements blurb, return policy, care " +
            'instructions) meant to be pasted into one field. Omit to list both kinds.',
        },
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
      properties: {
        id: {
          type: 'string',
          description:
            'Template UUID (the `id` from list_templates). Scoped to the calling seller — another ' +
            "seller's id returns 404, not their row.",
        },
      },
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
        scope: {
          type: 'string',
          enum: ['listing', 'description'],
          description:
            "Which kind of template this is. 'listing' = a full listing bootstrap: every typed field " +
            'you set below pre-fills the matching control on the listing form. ' +
            "'description' = a reusable description snippet — put the text in `description` and leave " +
            'the listing fields empty. Required.',
        },
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 120,
          description:
            'Label the seller picks this template by in the UI. 1-120 characters, required. Not shown ' +
            'to buyers — e.g. "Vintage tee baseline", not the listing title.',
        },
        notes: {
          type: 'string',
          maxLength: 1000,
          description:
            'Private memo for the seller about when to reach for this template. Max 1000 characters. ' +
            'Never published to any marketplace.',
        },
        title: {
          type: 'string',
          maxLength: 200,
          description:
            'Default listing title, max 200 characters here. May contain single-brace tokens ' +
            '({brand}, {size}, {color}, {year}…) filled at render time. Note that render_template caps ' +
            "the RENDERED title at 80 characters — eBay's ceiling — so a long stored template gets cut.",
        },
        titleVariants: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 5,
          description:
            'Up to 5 alternate title phrasings for A/B testing, same token syntax as `title`. ' +
            'Index 0 of this array is variantIndex 1 in render_template (variantIndex 0 is `title`).',
        },
        description: {
          type: 'string',
          description:
            "The description body. For scope='description' this IS the snippet. For scope='listing' " +
            'it is the description pre-filled on the form. Supports the same single-brace tokens as ' +
            '`title`. No length cap on the server.',
        },
        descriptionVariants: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 5,
          description:
            'Up to 5 alternate description bodies, selected by the same variantIndex as titleVariants. ' +
            "Normally only used for scope='listing'; a snippet is one string.",
        },
        brand: { type: 'string', description: 'Default brand/manufacturer, e.g. "Nike". Free text — not validated against a brand list.' },
        condition: {
          type: 'string',
          enum: ['new', 'like_new', 'good', 'fair', 'poor'],
          description:
            "Crossly's master condition, mapped per platform on publish. " +
            "'new' = unused, tags/packaging usually still on; 'like_new' = worn or opened once or twice, " +
            "no visible wear; 'good' = normal light wear, no notable flaws; 'fair' = clear wear or a " +
            "minor flaw that should be disclosed; 'poor' = damaged / for parts or repair.",
        },
        color: { type: 'string', description: 'Default primary colour, e.g. "Navy". Free text.' },
        material: { type: 'string', description: 'Default material/fabric, e.g. "100% cotton". Free text.' },
        size: { type: 'string', description: 'Default size value as the seller writes it, e.g. "M", "10.5", "32x34". Pair with sizeSystem.' },
        sizeSystem: {
          type: 'string',
          description:
            'Which sizing scale `size` is expressed in, e.g. "US", "UK", "EU", "JP". Free text — it ' +
            'disambiguates a bare number rather than converting it.',
        },
        weightOz: {
          type: 'integer',
          description:
            'Default shipped weight in whole OUNCES (not pounds, not grams). Used to pre-fill shipping ' +
            'estimates; 16 = 1 lb.',
        },
        dimensions: {
          type: 'object',
          properties: { lengthIn: { type: 'number' }, widthIn: { type: 'number' }, heightIn: { type: 'number' } },
          description:
            'Default package dimensions, every value in INCHES (not cm): { lengthIn, widthIn, heightIn }. ' +
            'Any subset may be given; omitted sides are stored null.',
        },
        categoryPath: {
          type: 'object',
          properties: { main: { type: 'string' }, sub: { type: 'string' }, sub2: { type: 'string' } },
          description:
            'Default category as a 3-level path: { main, sub, sub2 } — e.g. ' +
            '{ main: "Women", sub: "Tops", sub2: "T-Shirts" }. Levels are optional from the leaf up; ' +
            'this is the Crossly-side path, resolved to each platform\'s own taxonomy on publish.',
        },
        department: { type: 'string', description: 'Default department/audience, e.g. "Women", "Men", "Kids". Free text.' },
        gender: { type: 'string', description: 'Default gender the item is cut/marketed for, where a platform asks for it separately from department. Free text.' },
        style: { type: 'string', description: 'Default style descriptor, e.g. "Bomber", "Y2K", "Streetwear". Free text.' },
        pattern: { type: 'string', description: 'Default pattern/print, e.g. "Striped", "Floral", "Solid". Free text.' },
        itemType: { type: 'string', description: 'Default item type noun some platforms ask for alongside a category, e.g. "Sneakers", "Hoodie". Free text.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Default keyword tags pre-filled on the listing (Etsy tags, Depop hashtags, search keywords). ' +
            'Plain strings, no leading "#"; no server-side count limit here — per-platform caps apply on publish.',
        },
        platformOverrides: {
          type: 'object',
          description:
            'Per-platform field overrides, shape Record<platform, Record<field, string>> — e.g. ' +
            '{ "poshmark": { "title": "..." }, "ebay": { "condition": "used" } }. Values must be strings. ' +
            'Applied ON TOP of the master fields above, so a blank/absent entry means "inherit", ' +
            'not "clear".',
        },
        defaultForCategory: {
          type: 'string',
          description:
            'Category string this template is the seller\'s go-to for. Matched EXACTLY (not by prefix) ' +
            'against the category passed to suggest_template, so use the same spelling the listing form emits.',
        },
        isDefault: {
          type: 'boolean',
          description:
            'Make this the auto-hydrating default for defaultForCategory. Defaults to false. Setting ' +
            'true clears isDefault on the seller\'s other templates for that same category — there is ' +
            'only ever one. Has no effect unless defaultForCategory is also set.',
        },
        extras: {
          type: 'object',
          description:
            'Free-form JSON bag for fields that have no typed column yet. Stored and returned verbatim; ' +
            'nothing on the server interprets it, so do not put anything here that you expect to be applied.',
        },
        sortOrder: {
          type: 'integer',
          description:
            "Manual ordering position for scope='description' snippet lists — lower sorts first. " +
            'Defaults to 0. The main template list ignores it and orders by last-updated.',
        },
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
        id: { type: 'string', description: 'UUID of the template to patch. Must belong to the calling seller, else 404.' },
        name: { type: 'string', description: 'New label for the seller to find it by, 1-120 characters. Omit to leave unchanged.' },
        notes: { type: 'string', description: 'New private memo, max 1000 characters. Never published to a marketplace.' },
        title: { type: 'string', description: 'New default listing title, max 200 characters, single-brace tokens allowed ({brand}, {size}…).' },
        titleVariants: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Replaces the whole A/B title variant list (max 5) — this is not an append. ' +
            'Send [] to drop every variant.',
        },
        description: { type: 'string', description: 'New description body (the snippet itself when scope is description). Single-brace tokens allowed; no length cap.' },
        descriptionVariants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replaces the whole A/B description variant list (max 5) — not an append. Send [] to drop them all.',
        },
        brand: { type: 'string', description: 'New default brand, e.g. "Nike". Free text.' },
        condition: {
          type: 'string',
          description:
            "New default condition. The server accepts only Crossly's five master values: 'new' " +
            "(unused), 'like_new' (barely used, no visible wear), 'good' (normal light wear), 'fair' " +
            "(clear wear or a disclosable flaw), 'poor' (damaged / for parts). Anything else is rejected.",
        },
        color: { type: 'string', description: 'New default primary colour, e.g. "Navy". Free text.' },
        material: { type: 'string', description: 'New default material/fabric, e.g. "100% cotton". Free text.' },
        size: { type: 'string', description: 'New default size as written, e.g. "M", "10.5", "32x34".' },
        weightOz: { type: 'integer', description: 'New default shipped weight in whole OUNCES (16 oz = 1 lb) — not pounds or grams.' },
        dimensions: {
          type: 'object',
          description:
            'New default package dimensions { lengthIn, widthIn, heightIn }, all in INCHES (not cm). ' +
            'Replaces the stored object wholesale rather than merging side by side.',
        },
        categoryPath: {
          type: 'object',
          description:
            'New default category path { main, sub, sub2 }, e.g. { main: "Women", sub: "Tops" }. ' +
            'Replaces the stored object wholesale.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replaces the whole default keyword-tag list (plain strings, no leading "#") — not an append.',
        },
        platformOverrides: {
          type: 'object',
          description:
            'Replaces the whole per-platform override map, Record<platform, Record<field, string>>. ' +
            'Because it is a full replacement, resend the platforms you want kept; an omitted platform ' +
            'loses its overrides and falls back to the master fields.',
        },
        defaultForCategory: { type: 'string', description: 'New category this template is the go-to for. Matched EXACTLY by suggest_template, so spell it as the listing form does.' },
        isDefault: {
          type: 'boolean',
          description:
            'Promote (true) or demote (false) this template as the auto-hydrating default for its ' +
            "defaultForCategory. Promoting demotes the seller's other templates in that category — " +
            'there is only ever one. No effect unless defaultForCategory is set on the row.',
        },
        extras: {
          type: 'object',
          description:
            'Replaces the free-form JSON bag for un-typed fields. Stored verbatim and interpreted by ' +
            'nothing on the server.',
        },
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
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the template to delete. Hard delete, no undo and no trash — the row is gone. ' +
            "Must belong to the calling seller; another seller's id returns 404.",
        },
        ...IDEMPOTENCY_PROP,
      },
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
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the template to share. If it already has a token the SAME token comes back — ' +
            'calling twice never invalidates an existing public link.',
        },
        ...IDEMPOTENCY_PROP,
      },
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
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the template whose share link to kill. The template itself is untouched; only ' +
            'the token is cleared. Sharing again mints a NEW token, so the old URL stays dead — that ' +
            'is the point of revoking.',
        },
        ...IDEMPOTENCY_PROP,
      },
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
          description:
            'One template object, or an array of them — each shaped like a create_template body ' +
            '(scope + name required, every other field optional). Rows that fail validation are ' +
            'SKIPPED, not fatal: the response reports { imported, skipped, ids } so a short count is ' +
            'visible. isDefault is forced to false on every imported row regardless of what you send.',
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
