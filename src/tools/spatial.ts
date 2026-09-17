import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Spatial scenes — the inventory as a place.
 *
 * As with the evidence tools, the descriptions spend their words on how to
 * READ the result, because the failure mode for an agent here is not fetching
 * the wrong room — it is treating a solver's arrangement as a statement about
 * where something physically is. Those are different claims and only one of
 * them is safe to act on.
 */
export const spatialTools: ToolDef[] = [
  {
    name: 'list_spatial_scenes',
    description:
      'The rooms on this account: one per market category the seller holds catalog-resolved '
      + 'stock in (cards, sneakers, vinyl, watches, and so on), plus a warehouse. '
      + 'Rooms are created on first read, so an empty result means the account holds no '
      + 'catalog-resolved inventory — NOT that the feature is unavailable. '
      + 'kind `collection` is arranged for looking at; kind `warehouse` is meant to mirror '
      + 'the seller\'s physical space.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/spatial/scenes'),
  },
  {
    name: 'list_public_spatial_scenes',
    description:
      'Public collection rooms on this Crossly instance that anyone can open — the directory '
      + 'behind world-hopping between collectors. A room is listed once its owner '
      + 'sets it public; rooms shared as `unlisted` are deliberately NOT listed, because that '
      + 'setting means "reachable with the link" rather than "publish me". Empty rooms are '
      + 'omitted. Returns name, publicSlug, categorySlug, itemCount, up to four previewImages, '
      + 'forSaleCount and a priceFromCents/priceToCents BAND — enough to present a choice. '
      + 'The band is the cheapest and dearest thing for sale in the room and is never a quote '
      + 'for a particular object; /api/public/spatial/{slug}/offers is the only authority on '
      + 'that. Open a room with its slug at /api/public/spatial/{slug}.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/spatial/public'),
  },
  {
    name: 'get_spatial_scene',
    description:
      'One solved room: the container geometry, where every item sits, and the items themselves. '
      + 'HOW TO READ IT: all dimensions are METRES and match the real physical object, so they '
      + 'can be trusted for questions like whether something fits. '
      + 'Each placement carries `pinned`. pinned=true means a HUMAN put it there and it will not '
      + 'move. pinned=false means a layout SOLVER chose that spot and it may be different after '
      + 'the stock changes — never report an unpinned placement as where an item physically is, '
      + 'and never store one as a location. For a real address of a physical copy, read the '
      + 'item\'s `location` field, which is only written when something is placed in a warehouse. '
      + '`solved.overflow` lists items that did not fit anywhere; a non-empty array means the '
      + 'room is INCOMPLETE and any count you quote from it will be short. '
      + '`stats.capitalCents` is what the seller PAID, not what the stock is worth — do not '
      + 'present it as a valuation.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string' },
      },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/spatial/scenes/${encodeURIComponent(args.sceneId as string)}`),
  },
  {
    name: 'get_public_spatial_scene',
    description:
      'A shared room opened by its public slug — somebody else\'s collection, as a visitor '
      + 'sees it. Take the slug from list_public_spatial_scenes, or from a share link. '
      + 'Resolves `unlisted` rooms too: that setting means "reachable with the link", so '
      + 'holding the link is the permission even though the room is not in the directory. '
      + 'HOW TO READ IT: same geometry rules as get_spatial_scene — dimensions are METRES '
      + 'and match the real physical object, and each placement carries `pinned`. '
      + 'pinned=true means a HUMAN put it there and it will not move; pinned=false means a '
      + 'layout SOLVER chose that spot and it may be somewhere else after the stock changes. '
      + 'Never report an unpinned placement as where an item physically is. '
      + '`solved.overflow` lists what did not fit — a non-empty array means the room is '
      + 'INCOMPLETE, so any count you read off the shelves is short of `stats.itemCount`. '
      + 'This view is REDACTED relative to the owner\'s: no cost, no storage location, no '
      + 'listing status, and no `stats.capitalCents` — a visitor does not get to see what '
      + 'the seller paid. It also carries NO prices. Nothing here says anything is for sale; '
      + 'for that, call get_public_spatial_scene_offers.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'The room\'s public share handle (its `publicSlug`), not a scene id. Scene ids '
            + 'from list_spatial_scenes do not work here and vice versa.',
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/spatial/public/${encodeURIComponent(args.slug as string)}`),
  },
  {
    name: 'get_public_spatial_scene_offers',
    description:
      'What is actually for sale in a shared room: price, remaining stock, condition and '
      + 'grade, one entry per buyable object. '
      + 'CORRELATE BY `itemId`, which is the same id get_public_spatial_scene publishes for '
      + 'each item — never by title. Two copies of the same card in one room are different '
      + 'objects at different prices, and matching by resemblance is how somebody gets '
      + 'quoted the wrong one. '
      + 'DO NOT CACHE A PRICE. The room\'s geometry and its prices run on different clocks: '
      + 'the arrangement is stable for minutes, but a price or a stock count changes the '
      + 'moment the seller edits a listing. Re-read this immediately before you quote a '
      + 'number or act on one; a price carried over from an earlier room fetch is a quote '
      + 'you cannot stand behind. '
      + '`priceCents` is CENTS, not dollars. `available` is remaining stock when the listing '
      + 'declares one and null when it does not — null is UNKNOWN, never zero, so do not '
      + 'report it as out of stock. An object visible in the room with no entry here is '
      + 'simply not for sale. An empty list means the owner is showing the collection rather '
      + 'than selling it, which is a deliberate choice and different from the room not '
      + 'existing (that is a 404). Where an item belongs to several active listings the '
      + 'quote is for THAT item alone rather than a bundle containing it.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'The room\'s public share handle (its `publicSlug`) — the same one you passed '
            + 'to get_public_spatial_scene.',
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/spatial/public/${encodeURIComponent(args.slug as string)}/offers`),
  },
  {
    name: 'get_spatial_movements',
    description:
      'Stock MOVEMENTS in one of the seller\'s rooms over a time window — where things went, '
      + 'as opposed to where they currently sit. One row per physical transition: the item, '
      + 'the node it came from, the node it went to, when it happened, and the kind of move '
      + '(`placed` = it had no location before; `moved` = shelf to shelf; `picked` = pulled '
      + 'for an order; `shipped` = left the building; `received` = arrived, from intake or a '
      + 'return; `removed` = displaced off a slot by something else being put there). '
      + 'HOW TO READ IT: correlate rows to shelves by `fromNodeId` / `toNodeId`. '
      + '`fromCode` / `toCode` are DISPLAY SNAPSHOTS of the location code as it stood at the '
      + 'time of the move ("A-3-2"). They are neither unique nor stable — a code is derived '
      + 'from the rack\'s position, so renaming a zone rewrites every code under it, and two '
      + 'rooms readily produce the same string. Grouping movements by code will merge the '
      + 'histories of unrelated racks and the result will look perfectly plausible. '
      + 'A null `toNodeId` on a `shipped` or `picked` row means it left the building — that '
      + 'is a fact, not missing data. A null on a `removed` row means nobody recorded where '
      + 'it went, and you must not infer one. '
      + 'THIS SURFACE IS NOT ATTRIBUTED TO PEOPLE. Movements are recorded against the team '
      + 'member who made them, and the seller\'s dashboard shows that to the account owner '
      + 'and team admins only, because it is workplace monitoring. A token carries no team '
      + 'role, so no actor is returned here and `meta.attributed` is always false. Do not '
      + 'attempt to infer who did something from timing or sequence. '
      + '`meta.truncated` true means the window held more rows than one response carries and '
      + 'the OLDEST were dropped — narrow the window rather than treating the result as the '
      + 'complete history. `meta.heat` is per-node inbound/outbound totals for the whole '
      + 'window, and is computed server-side over ALL rows, so it stays correct even when '
      + 'the row list was truncated.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: {
          type: 'string',
          description: 'A scene id from list_spatial_scenes. Usually the `warehouse` room.',
        },
        since: {
          type: 'string',
          description:
            'ISO 8601 timestamp. Defaults to seven days ago. The span is clamped to 90 days.',
        },
        until: { type: 'string', description: 'ISO 8601 timestamp. Defaults to now.' },
      },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const q = new URLSearchParams();
      if (typeof args.since === 'string') q.set('since', args.since);
      if (typeof args.until === 'string') q.set('until', args.until);
      const qs = q.toString();
      return apiGet(
        `/v1/spatial/scenes/${encodeURIComponent(args.sceneId as string)}/movements`
        + (qs ? `?${qs}` : ''),
      );
    },
  },
];
