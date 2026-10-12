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
        platform: {
          type: 'string',
          description:
            'Platform slug the category id belongs to: ebay / etsy / poshmark / mercari / depop / grailed / ' +
            'vinted / whatnot / vestiaire / offerup / facebook / curtsy. Anything else is rejected with ' +
            '400 unsupported_platform.',
        },
        categoryId: {
          type: 'string',
          description:
            "A node id in THAT platform's own id space — never reuse an id across platforms. eBay: the " +
            'categoryId string from eBay\'s Taxonomy API (e.g. "15709"). Etsy: the numeric taxonomy-node id ' +
            'as a string (the server parses it with Number(), so a non-numeric value yields NaN and an ' +
            'empty result). Cookie platforms: the `id` exactly as returned by list_platform_categories for ' +
            'that platform. Only platforms whose categories are a flat parent-linked list (e.g. Mercari, ' +
            'Depop) return children; structurally top-only ones (Poshmark departments, Grailed depts) ' +
            'return [].',
        },
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
      'aspect carries: name, required, dataType, selectionOnly, enumValues (when constrained), cardinality. The ' +
      'required ones MUST be filled in the listing body for the platform to accept it.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description:
            'Platform slug whose aspect schema you want: ebay / etsy / poshmark / mercari / depop / grailed / ' +
            'vinted / whatnot / vestiaire / offerup / facebook / curtsy. Anything else is rejected with ' +
            '400 unsupported_platform.',
        },
        categoryId: {
          type: 'string',
          description:
            "The LEAF category id in that platform's own id space — aspects are per-leaf, so a branch node " +
            'usually returns few or none. eBay: the Taxonomy API categoryId string; Etsy: the numeric ' +
            'taxonomy-node id as a string (parsed with Number()); cookie platforms: the `id` returned by ' +
            'list_platform_categories for that same platform. Ids are NOT interchangeable between platforms.',
        },
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
      'Reverse lookup — suggest categories for a search phrase (a listing title works). eBay uses its Taxonomy API; ' +
      'Poshmark, Mercari, Depop, Grailed, Vinted, Whatnot, Vestiaire, OfferUp, Facebook and Curtsy search Crossly\'s ' +
      'harvested copy of their category tree, scored by the phrase\'s words in each category and its parents, each hit ' +
      'with a root-first breadcrumb and whether it is a leaf. Etsy returns an empty list: browse its tree instead.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description:
            'Platform slug to search within: ebay / etsy / poshmark / mercari / depop / grailed / vinted / ' +
            'whatnot / vestiaire / offerup / facebook / curtsy (400 unsupported_platform otherwise). Every one ' +
            'but etsy returns suggestions. Suggested ids come back in the chosen platform\'s id space.',
        },
        q: { type: 'string', description: 'Free-text search phrase (e.g. "vintage levi denim jacket"). Omitting it or passing an empty string short-circuits to an empty result list without calling the platform.' },
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
        platform: {
          type: 'string',
          description:
            'Platform slug whose listing schema you want: ebay / etsy / poshmark / mercari / depop / grailed / ' +
            'vinted / whatnot / vestiaire / offerup / facebook / curtsy (400 unsupported_platform otherwise). ' +
            'Drives both the `requiredFields` union and the id space `categoryId` is read in.',
        },
        categoryId: {
          type: 'string',
          description:
            "Optional leaf category id in THIS platform's own id space (eBay Taxonomy categoryId string, Etsy " +
            'numeric taxonomy-node id as a string, or the cookie-platform id from list_platform_categories). ' +
            'When set, that category\'s aspects are returned inline as `inlineAspects`; when omitted, ' +
            '`inlineAspects` is [] and only the platform-level field union comes back.',
        },
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
