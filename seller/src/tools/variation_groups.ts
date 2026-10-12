import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Variation groups — several of the seller's listings sold as one product.
 *
 * The fact an agent most needs from these tools is counter-intuitive enough
 * to repeat in every description: a group's members are STANDALONE listings,
 * not children. They appear in list_listings, they publish independently to
 * platforms with no variation support, and each has its own inventory, COGS
 * and lifecycle. The group is an extra fact about them, not a container.
 *
 * Getting that wrong is not cosmetic. An agent repricing "every listing"
 * would treat four sizes of one shirt as four unrelated products and can
 * happily undercut the seller against themselves; one counting products
 * would report four where the seller has one.
 */
export const variationGroupTools: ToolDef[] = [
  {
    name: 'list_variation_groups',
    description:
      'Every variation group the seller has — listings sold together as one product with '
      + 'options (sizes, card conditions, vinyl pressings). Returns each group with its '
      + 'members and a rollup: memberCount, fromPriceCents (the CHEAPEST option, not an '
      + 'average), availableUnits, and needsAttention. '
      + 'IMPORTANT: members are standalone listings that also appear in list_listings — '
      + 'do not count them as separate products, and do not reprice them independently '
      + 'without checking they belong to a group.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/api/v1/variation-groups'),
  },
  {
    name: 'get_variation_group',
    description:
      'One variation group with every option, its value on the axis (e.g. "M", "10.5", '
      + '"Near Mint"), price, stock and status. Use after list_variation_groups when you '
      + 'need the individual options rather than the summary.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'The group listing id.' },
      },
      required: ['groupId'],
    },
    handler: (args) => {
      const { groupId } = args as { groupId: string };
      return apiGet(`/api/v1/variation-groups/${encodeURIComponent(groupId)}`);
    },
  },
  {
    name: 'get_listing_variation_group',
    description:
      'Which variation group a listing belongs to, or null. '
      + 'Call this BEFORE acting on a listing in bulk — repricing, delisting or counting '
      + 'four sizes of one shirt as four independent products is wrong in a way that only '
      + 'shows up later in the numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'string', description: 'The listing id to look up.' },
      },
      required: ['listingId'],
    },
    handler: (args) => {
      const { listingId } = args as { listingId: string };
      return apiGet(`/api/v1/listings/${encodeURIComponent(listingId)}/variation-group`);
    },
  },
  {
    name: 'plan_variation_group_publish',
    description:
      'What publishing a variation group to given platforms WOULD do — without publishing. '
      + 'Platforms split two ways and the difference is large: eBay and Shopify produce ONE '
      + 'listing with a dropdown, while Depop, Poshmark, Mercari, Vinted and the rest have no '
      + 'variation concept at all and produce one listing PER OPTION. A four-option group on '
      + 'Depop is four listings. '
      + 'Returns per-platform mode/listingsProduced/explanation plus totalListings. Always '
      + 'show totalListings before recommending a publish — it is the number the seller reacts '
      + 'to, and finding out afterwards means unpicking several live listings.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'The group listing id.' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Platform ids to plan for, e.g. ["ebay","depop","poshmark"].',
        },
      },
      required: ['groupId', 'platforms'],
    },
    handler: (args) => {
      const { groupId, platforms } = args as { groupId: string; platforms: string[] };
      return apiGet(
        `/api/v1/variation-groups/${encodeURIComponent(groupId)}/publish-plan`,
        { platforms: (platforms ?? []).join(',') },
      );
    },
  },
];
