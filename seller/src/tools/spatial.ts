import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
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
    name: 'create_spatial_scene',
    description: 'Start a Crossly World room of your own: kind collection (items on shelves) or warehouse (racks you arrange). Private until you make it public.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['collection', 'warehouse'], description: 'What the room is for.' },
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Its name.' },
        categorySlug: { type: 'string', maxLength: 40, description: 'Optional market category the room shows.' },
      },
      required: ['kind', 'name'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/spatial/scenes', args as Record<string, unknown>),
  },
  {
    name: 'rename_spatial_scene',
    description: 'Rename one of your Crossly World rooms.',
    inputSchema: {
      type: 'object',
      properties: { sceneId: { type: 'string', format: 'uuid', description: 'The room.' }, name: { type: 'string', minLength: 1, maxLength: 120, description: 'The new name.' } },
      required: ['sceneId', 'name'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { sceneId, name } = args as { sceneId: string; name: string };
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/rename`, { name });
    },
  },
  {
    name: 'set_spatial_scene_visibility',
    description: 'Make one of your Crossly World rooms private, unlisted (anyone with the link) or public (in the lobby).',
    inputSchema: {
      type: 'object',
      properties: { sceneId: { type: 'string', format: 'uuid', description: 'The room.' }, visibility: { type: 'string', enum: ['private', 'unlisted', 'public'], description: 'Who can walk in.' } },
      required: ['sceneId', 'visibility'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { sceneId, visibility } = args as { sceneId: string; visibility: string };
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/visibility`, { visibility });
    },
  },
  {
    name: 'update_spatial_scene_settings',
    description: 'How one of your Crossly World rooms is laid out: groupBy and sortBy keys (up to 4 each), theme, overlay, and the arrival camera.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', format: 'uuid', description: 'The room.' },
        groupBy: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'Group items by these keys.' },
        sortBy: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'Sort items by these keys.' },
        theme: { type: 'string', maxLength: 32, description: 'A room theme.' },
        overlay: { type: 'string', maxLength: 32, description: 'An overlay.' },
      },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { sceneId, ...settings } = args as { sceneId: string } & Record<string, unknown>;
      return apiPatch(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/settings`, settings);
    },
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
        sceneId: {
          type: 'string',
          description:
            'The scene to load. A scene id is a 3D room, not a warehouse location — '
            + 'never store one as a place a physical item lives.',
        },
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
  {
    name: 'get_spatial_warehouse',
    description:
      'The seller\'s WAREHOUSE room as it stands: every rack (pallet rack, shelving, garment '
      + 'rail, floor tote), its location `code`, where it stands on the floor in metres, its '
      + '`capacity`, how many items are `stocked` on it and the `fill` fraction, and the items '
      + 'on each with the full code of the level or bin they sit in. Use it to answer "where '
      + 'is X", "which rack has room", or to plan a pick path. `code` is what the seller sees '
      + 'on the rack\'s plate and on each item\'s storage location; correlate racks by `id`, '
      + 'not by code — a code changes when a zone is relabelled. `positioned: false` means the '
      + 'seller never stood that rack anywhere and the layout was chosen for them. Only for a '
      + 'room of kind `warehouse` (see list_spatial_scenes).',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', description: 'The warehouse scene id from list_spatial_scenes.' },
      },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { sceneId } = args as { sceneId: string };
      return apiGet(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/warehouse`);
    },
  },
  {
    name: 'list_spatial_streets',
    description:
      'Every street in the world: `slug`, `name`, `plotCount` and how many plots are `occupied`. '
      + '`platform: true` is Crossly\'s own Main Street, where every public shop has a plot.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/streets'),
  },
  {
    name: 'get_spatial_street',
    description:
      'One street, plot by plot from the entrance: each plot\'s `address` (`<street>/<number>`, '
      + 'stable while the shop stands there), human `label` ("12 Main Street"), and `shop` — the '
      + 'open shop\'s directory entry, or null when vacant. `shuttered` marks a plot whose shop '
      + 'is not public right now; `reserved` plots are newcomer plots that are never sold. Each open '
      + 'shop plot carries `life` (`soldToday`, and `window`: up to three live listings); the street '
      + 'carries `life.billboards` (promoted listings, paid per sale, or Crossly house ads) and '
      + '`life.buskers` (shop owners on the street who are live now, with the stream and lot).',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Street slug, e.g. main-street (see list_spatial_streets).' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/spatial/streets/${encodeURIComponent(slug)}`);
    },
  },
  {
    name: 'resolve_spatial_address',
    description:
      'The shop at a street address: `publicSlug` (use it with get_public_spatial_scene) and `name`. '
      + '404 when the plot is vacant or its shop is not public.',
    inputSchema: {
      type: 'object',
      properties: {
        street: { type: 'string', description: 'Street slug, e.g. main-street.' },
        number: { type: 'integer', minimum: 1, description: 'House number (1 is the first plot).' },
      },
      required: ['street', 'number'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { street, number } = args as { street: string; number: number };
      return apiGet(`/v1/spatial/address/${encodeURIComponent(street)}/${Math.trunc(Number(number))}`);
    },
  },
  {
    name: 'get_spatial_shop_addresses',
    description: 'The addresses of the seller\'s own shop — one per street it stands on, Main Street first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/shop/addresses'),
  },
  {
    name: 'claim_spatial_street_plot',
    description:
      'Put the seller\'s shop on an OPEN street: it takes the lowest vacant plot and the reply is its '
      + '`index` and `address`; calling again returns the plot it already has. The shop must be '
      + 'public. Main Street grows rather than filling; a full street somebody owns answers 409.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Street slug.' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiPost(`/v1/spatial/streets/${encodeURIComponent(slug)}/claim`, {});
    },
  },
  {
    name: 'leave_spatial_street',
    description:
      'Take the seller\'s shop off a street. The plot goes vacant and its address may be taken by '
      + 'another shop — tell the seller that before doing it.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Street slug.' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiDelete(`/v1/spatial/streets/${encodeURIComponent(slug)}/plot`);
    },
  },
  {
    name: 'get_spatial_plot_quote',
    description: 'What a street plot costs: `priceCents` (paid in CBX at spot), `maintenanceWeeklyCents`, weeks included with a purchase, and whether it is `buyable` now. Plots 1-2 on every street are newcomer plots and are never sold.',
    inputSchema: { type: 'object', properties: { street: { type: 'string', description: 'Street slug, e.g. main-street.' }, number: { type: 'integer', description: 'House number (1 is the first plot).' } }, required: ['street', 'number'], additionalProperties: false },
    handler: (args) => {
      const { street, number } = args as { street: string; number: number };
      return apiGet(`/v1/spatial/streets/${encodeURIComponent(street)}/plots/${Math.trunc(Number(number))}/quote`);
    },
  },
  {
    name: 'get_spatial_street_founding',
    description: 'What founding a street costs: `priceCents` (the premium, paid in CBX at spot), `maintenanceWeeklyCents` upkeep, `includedWeeks`, `plots`, `maxPerOwner`, `admissions` (open | apply | invite), `cbx` {open, reason} -- closed until CBX is minted -- and `refusal`: why the seller cannot ask yet, or null.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/streets/founding'),
  },
  {
    name: 'get_my_spatial_streets',
    description: 'The seller\'s streets: `status` (pending review, approved, founding, active, dormant, rejected, released), `upkeep` (active / grace / delinquent -- a delinquent owner collects no stall rent; three weeks late it is foreclosed), `paidThrough`, `admission`, `occupied` of `plotCount`, `pendingApplications`, `reviewNote`.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/spatial/streets/mine'),
  },
  {
    name: 'request_spatial_street',
    description: 'Ask to found a street. Free: Crossly reviews the name first; nothing is paid until found_spatial_street. Needs a public shop; one street per seller. Crossly\'s own streets are never available.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Street name, 3-32 characters.' }, slug: { type: 'string', description: 'Web address, e.g. arcade-row (derived from the name when omitted).' }, admission: { type: 'string', enum: ['open', 'apply', 'invite'], description: 'How shops get a plot.' } }, required: ['name'], additionalProperties: false },
    handler: (args) => apiPost('/v1/spatial/streets/requests', args as Record<string, unknown>),
  },
  {
    name: 'found_spatial_street',
    description: 'Found an approved street: pays the premium from the seller\'s EARNED CBX at spot and opens it. SPENDS MONEY: confirm the price with the seller first (get_spatial_street_founding). Refused until CBX is minted.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Street id from get_my_spatial_streets.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const id = (args as { id: string }).id;
      return apiPost(`/v1/spatial/streets/requests/${encodeURIComponent(id)}/found`, {});
    },
  },
  {
    name: 'pay_spatial_street_upkeep',
    description: 'Pay a founded street\'s upkeep forward, 1-12 weeks, in CBX. SPENDS MONEY: confirm with the seller.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Street id from get_my_spatial_streets.' }, weeks: { type: 'integer', description: 'Weeks to pay, 1-12.' } }, required: ['id', 'weeks'], additionalProperties: false },
    handler: (args) => {
      const { id, weeks } = args as { id: string; weeks: number };
      return apiPost(`/v1/spatial/streets/owned/${encodeURIComponent(id)}/upkeep`, { weeks });
    },
  },
  {
    name: 'get_spatial_property',
    description: 'The seller\'s plots (address, price, weekly maintenance, `paidThrough`, `status`: active / grace / delinquent) with any lease, and the leases they rent as a tenant. A delinquent owner cannot collect rent; three weeks late a deed is foreclosed.',
    inputSchema: { type: 'object', properties: {  }, required: [], additionalProperties: false },
    handler: () => apiGet('/v1/spatial/property'),
  },
  {
    name: 'buy_spatial_plot',
    description: 'Buy a vacant plot from Crossly with the seller\'s EARNED CBX at spot; their shop moves onto it and the first weeks of maintenance are included. SPENDS MONEY: confirm the quoted price with the seller first (get_spatial_plot_quote).',
    inputSchema: { type: 'object', properties: { street: { type: 'string', description: 'Street slug.' }, number: { type: 'integer', description: 'House number.' } }, required: ['street', 'number'], additionalProperties: false },
    handler: (args) => {
      const { street, number } = args as { street: string; number: number };
      return apiPost(`/v1/spatial/streets/${encodeURIComponent(street)}/plots/${Math.trunc(Number(number))}/buy`, {});
    },
  },
  {
    name: 'pay_spatial_plot_maintenance',
    description: 'Pay a plot\'s maintenance forward, 1-12 weeks, in CBX. SPENDS MONEY: confirm with the seller.',
    inputSchema: { type: 'object', properties: { deedId: { type: 'string', description: 'Deed id from get_spatial_property.' }, weeks: { type: 'integer', description: 'Weeks to pay, 1-12.' } }, required: ['deedId', 'weeks'], additionalProperties: false },
    handler: (args) => {
      const { deedId, weeks } = args as { deedId: string; weeks: number };
      return apiPost(`/v1/spatial/property/deeds/${encodeURIComponent(deedId)}/maintenance`, { weeks });
    },
  },
  {
    name: 'offer_spatial_plot_lease',
    description: 'Offer a vacant plot the seller owns for lease at a weekly rent in cents ($1-$5,000). Terms freeze when a tenant accepts.',
    inputSchema: { type: 'object', properties: { deedId: { type: 'string', description: 'Deed id.' }, rentWeeklyCents: { type: 'integer', description: 'Weekly rent in cents.' } }, required: ['deedId', 'rentWeeklyCents'], additionalProperties: false },
    handler: (args) => {
      const { deedId, rentWeeklyCents } = args as { deedId: string; rentWeeklyCents: number };
      return apiPost(`/v1/spatial/property/deeds/${encodeURIComponent(deedId)}/lease`, { rentWeeklyCents });
    },
  },
  {
    name: 'accept_spatial_plot_lease',
    description: 'Take a plot on lease: pays the first week to the owner in EARNED CBX and moves the seller\'s public shop onto it. SPENDS MONEY: confirm with the seller.',
    inputSchema: { type: 'object', properties: { leaseId: { type: 'string', description: 'Lease id (an offered lease on the street).' } }, required: ['leaseId'], additionalProperties: false },
    handler: (args) => {
      const { leaseId } = args as { leaseId: string };
      return apiPost(`/v1/spatial/property/leases/${encodeURIComponent(leaseId)}/accept`, {});
    },
  },
  {
    name: 'pay_spatial_plot_rent',
    description: 'Pay rent forward, 1-12 weeks. While the owner is delinquent the rent is waived, never collected. SPENDS MONEY: confirm with the seller.',
    inputSchema: { type: 'object', properties: { leaseId: { type: 'string', description: 'Lease id.' }, weeks: { type: 'integer', description: 'Weeks, 1-12.' } }, required: ['leaseId', 'weeks'], additionalProperties: false },
    handler: (args) => {
      const { leaseId, weeks } = args as { leaseId: string; weeks: number };
      return apiPost(`/v1/spatial/property/leases/${encodeURIComponent(leaseId)}/rent`, { weeks });
    },
  },
  {
    name: 'end_spatial_plot_lease',
    description: 'End a lease as owner or tenant. The tenant\'s shop gets a free Main Street address again.',
    inputSchema: { type: 'object', properties: { leaseId: { type: 'string', description: 'Lease id.' } }, required: ['leaseId'], additionalProperties: false },
    handler: (args) => {
      const { leaseId } = args as { leaseId: string };
      return apiPost(`/v1/spatial/property/leases/${encodeURIComponent(leaseId)}/end`, {});
    },
  },
  {
    name: 'get_spatial_shop_staff',
    description: 'The seller\'s shop staff: people holding a `staff` grant, who may arrange the shop and move its stock and nothing else. Each has `grantId`, `name`, `wageWeeklyCents` (paid by the seller in CBX), `wagePaidThrough`, and `pending` for an invite not yet accepted.',
    inputSchema: { type: 'object', properties: {  }, required: [], additionalProperties: false },
    handler: () => {
      return apiGet('/v1/spatial/shop/staff');
    },
  },
  {
    name: 'list_spatial_staffing',
    description: 'Shops the seller works in as staff, with their wage.',
    inputSchema: { type: 'object', properties: {  }, required: [], additionalProperties: false },
    handler: () => {
      return apiGet('/v1/spatial/staffing');
    },
  },
  {
    name: 'set_spatial_staff_wage',
    description: 'Set a staff member\'s weekly wage in cents ($1-$2,000), or null to clear it. Setting a wage does not pay it.',
    inputSchema: { type: 'object', properties: { grantId: { type: 'string', description: 'Staff grant id from get_spatial_shop_staff.' }, wageWeeklyCents: { type: 'integer', description: 'Weekly wage in cents, or null to clear.' } }, required: ['grantId', 'wageWeeklyCents'], additionalProperties: false },
    handler: (args) => {
      const { grantId, wageWeeklyCents } = args as { grantId: string; wageWeeklyCents: number | null };
      return apiPut(`/v1/spatial/shop/staff/${encodeURIComponent(grantId)}/wage`, { wageWeeklyCents });
    },
  },
  {
    name: 'pay_spatial_staff',
    description: 'Pay a staff member\'s wage forward, 1-4 weeks, from the seller\'s EARNED CBX. SPENDS MONEY: confirm the amount with the seller first.',
    inputSchema: { type: 'object', properties: { grantId: { type: 'string', description: 'Staff grant id.' }, weeks: { type: 'integer', description: 'Weeks to pay, 1-4.' } }, required: ['grantId', 'weeks'], additionalProperties: false },
    handler: (args) => {
      const { grantId, weeks } = args as { grantId: string; weeks: number };
      return apiPost(`/v1/spatial/shop/staff/${encodeURIComponent(grantId)}/pay`, { weeks });
    },
  },
  {
    name: 'list_spatial_deed_listings',
    description: 'Plots for resale, cheapest first: address, priceCents (paid in CBX at spot), Crossly\'s feeCents (the 2% CBX skim), weekly maintenance, and the deed\'s status and paidThrough (a buyer inherits the maintenance clock).',
    inputSchema: { type: 'object', properties: { street: { type: 'string', description: 'Optional street slug to narrow to.' } }, required: [], additionalProperties: false },
    handler: (args) => {
      const { street } = args as { street?: string };
      return apiGet('/v1/spatial/deeds/listings', street ? { street } : undefined);
    },
  },
  {
    name: 'list_spatial_deed_for_sale',
    description: 'List a plot the seller owns for resale at an asking price in cents ($1-$100,000). Maintenance must be current; a lease on it carries on with the buyer.',
    inputSchema: { type: 'object', properties: { deedId: { type: 'string', description: 'Deed id from get_spatial_property.' }, priceCents: { type: 'integer', description: 'Asking price in cents.' } }, required: ['deedId', 'priceCents'], additionalProperties: false },
    handler: (args) => {
      const { deedId, priceCents } = args as { deedId: string; priceCents: number };
      return apiPost(`/v1/spatial/property/deeds/${encodeURIComponent(deedId)}/list`, { priceCents });
    },
  },
  {
    name: 'cancel_spatial_deed_listing',
    description: 'Take the seller\'s plot off the resale market.',
    inputSchema: { type: 'object', properties: { listingId: { type: 'string', description: 'Listing id.' } }, required: ['listingId'], additionalProperties: false },
    handler: (args) => {
      const { listingId } = args as { listingId: string };
      return apiPost(`/v1/spatial/property/listings/${encodeURIComponent(listingId)}/cancel`, {});
    },
  },
  {
    name: 'buy_spatial_deed',
    description: 'Buy a plot on the resale market with the seller\'s EARNED CBX; the deed, its maintenance clock and any lease pass to them, and their shop moves on if the plot is vacant. SPENDS MONEY: confirm the price with the seller first.',
    inputSchema: { type: 'object', properties: { listingId: { type: 'string', description: 'Listing id from list_spatial_deed_listings.' } }, required: ['listingId'], additionalProperties: false },
    handler: (args) => {
      const { listingId } = args as { listingId: string };
      return apiPost(`/v1/spatial/property/listings/${encodeURIComponent(listingId)}/buy`, {});
    },
  },
];
