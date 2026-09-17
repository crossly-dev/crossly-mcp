import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

export const taxonomyTools: ToolDef[] = [
  {
    name: 'list_platform_categories',
    description:
      'Top-level categories for a marketplace. eBay + Etsy return live taxonomy from the platform; cookie platforms ' +
      '(Poshmark, Mercari, Depop, Grailed, Vinted, Whatnot, Vestiaire, OfferUp, Facebook, Curtsy) return the static ' +
      'enum the recipe layer uses. Use this as the first step of a programmatic listing flow — pick a category, ' +
      'walk children if not a leaf, then get_platform_category_aspects on the leaf.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: "Platform slug: ebay / etsy / poshmark / mercari / depop / grailed / vinted / whatnot / vestiaire / offerup / facebook / curtsy.",
        },
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/taxonomy/${encodeURIComponent(args.platform as string)}/categories`),
  },
  {
    name: 'list_platform_category_children',
    description:
      'One level of children under a category node. Walks deeper into the platform taxonomy. eBay nodes are string ' +
      'ids; Etsy nodes are numeric ids; cookie platforms typically return [] (no real tree).',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        categoryId: { type: 'string' },
      },
      required: ['platform', 'categoryId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(
        `/v1/taxonomy/${encodeURIComponent(args.platform as string)}/categories/${encodeURIComponent(
          args.categoryId as string,
        )}/children`,
      ),
  },
  {
    name: 'get_platform_category_aspects',
    description:
      'Item-specific aspects (eBay) / properties (Etsy) / hard-coded enums (cookie platforms) for a category. Each ' +
      'aspect carries: name, required, dataType, hasEnumValues, enumValues (when constrained), cardinality. The ' +
      'required ones MUST be filled in the listing body for the platform to accept it.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        categoryId: { type: 'string' },
      },
      required: ['platform', 'categoryId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(
        `/v1/taxonomy/${encodeURIComponent(args.platform as string)}/categories/${encodeURIComponent(
          args.categoryId as string,
        )}/aspects`,
      ),
  },
  {
    name: 'suggest_platform_categories',
    description:
      'Reverse lookup — suggest categories for a search phrase. eBay only today (their Taxonomy API has a category-' +
      'suggestions endpoint). Other platforms return an empty list with a note.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        q: { type: 'string', description: 'Free-text search phrase (e.g. "vintage levi denim jacket").' },
      },
      required: ['platform', 'q'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/taxonomy/${encodeURIComponent(args.platform as string)}/suggest`, { q: args.q }),
  },
  {
    name: 'get_platform_required_fields',
    description:
      'Normalized listing schema for a platform — the union of master fields (title/description/price/condition/' +
      'images/brand/size/color) and platform-specific overrides (e.g. Poshmark department, Mercari shipping class). ' +
      'Pass categoryId to inline the aspect list as `inlineAspects`. This is the recommended one-shot call before ' +
      'building a listing payload — it tells the agent everything that needs to be on the body.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        categoryId: { type: 'string', description: 'Optional — when set, the aspects for this category are inlined.' },
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/taxonomy/${encodeURIComponent(args.platform as string)}/required-fields`, {
        categoryId: args.categoryId,
      }),
  },
];
