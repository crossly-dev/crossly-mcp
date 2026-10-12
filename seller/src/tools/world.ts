import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Crossly World: what a person has, wears and is doing there (wallet, quests,
 * crew, loadout and closet, COSM reads, trade-table listings and binder,
 * friends, fit value, the best-dressed and streak boards, the auto-shop
 * switch), plus the verbs that move NO money -- wear a quest pin, start / join
 * / leave a crew, invite a friend, equip / unequip what you already own, and
 * save / rename / delete / put on a saved outfit (through the same equip).
 *
 * Deliberately absent: buying cosmetics (COSM or CBX), minting to a wallet and
 * shaking on a trade. An app token never moves CBX, COSM or money; those stay
 * on crossly.net.
 */
const EMPTY = { type: 'object', properties: {}, additionalProperties: false } as const;
const SLOT = {
  type: 'string',
  enum: ['avatar_head', 'avatar_body', 'avatar_outer', 'avatar_legs', 'avatar_feet', 'avatar_back'],
  description: 'Avatar slot: avatar_head, avatar_body, avatar_outer (a jacket or vest over the top), avatar_legs, avatar_feet or avatar_back.',
} as const;

export const worldTools: ToolDef[] = [
  // ── reads ──
  {
    name: 'get_world_wallet',
    description:
      'Every balance you hold in Crossly World: bucksCents (Crossly Bucks, cents), the three CBX balances kept apart as ' +
      'base-unit strings (granted = spend in-platform only, earned = withdrawable once matured, connected = a delegation ' +
      'ceiling on your own wallet) plus pendingCents of unmatured cashback, and COSM baseUnits. available:false means ' +
      'that currency is not provisioned here, not a zero balance. Read-only.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/wallet', {}),
  },
  {
    name: 'list_world_quests',
    description:
      'Every Crossly World quest with your progress (goal, target, count, done) and the pin each earns. meta.wearing is the ' +
      'pin on your nameplate; meta.streak your current and best daily visit streak.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/quests', {}),
  },
  {
    name: 'get_world_crew',
    description:
      'Your Crossly World crew (null when in none): name, tag, join code, whether you own it, and up to 30 members with the ' +
      'public room each is in right now when they chose to be seen by name.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/crew', {}),
  },
  {
    name: 'get_world_crew_leaderboards',
    description: 'The Crossly World game leaderboards (Price Guess, hunts, speed trades; this week and all time) ranked among your crew only. 404 when you are in no crew.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/crew/leaderboards', {}),
  },
  {
    name: 'list_world_follows',
    description: 'Everybody you follow in Crossly World, each with mutual: true when they follow you back (a friend).',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/follows', {}),
  },
  {
    name: 'follow_world_user',
    description: 'Follow somebody in Crossly World. When they follow back you are friends. Idempotent.',
    inputSchema: { type: 'object', properties: { userId: { type: 'string', format: 'uuid', description: 'Who to follow.' } }, required: ['userId'], additionalProperties: false },
    handler: (args) => {
      const { userId } = args as { userId: string };
      return apiPost(`/v1/world/follows/${encodeURIComponent(userId)}`, {});
    },
  },
  {
    name: 'unfollow_world_user',
    description: 'Unfollow somebody in Crossly World. Idempotent.',
    inputSchema: { type: 'object', properties: { userId: { type: 'string', format: 'uuid', description: 'Who to unfollow.' } }, required: ['userId'], additionalProperties: false },
    handler: (args) => {
      const { userId } = args as { userId: string };
      return apiDelete(`/v1/world/follows/${encodeURIComponent(userId)}`);
    },
  },
  {
    name: 'list_world_following_rooms',
    description: 'The public Crossly World rooms of people you follow, to walk into.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/following/rooms', {}),
  },
  {
    name: 'get_world_jobs',
    description: 'The Crossly World jobs board: open staff shifts you could claim, your claimed shifts and open price checks.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/jobs', {}),
  },
  {
    name: 'list_world_posted_jobs',
    description: 'Shifts you posted for your Crossly World rooms, with who claimed each and how it went.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/jobs/posted', {}),
  },
  {
    name: 'set_world_emote_wheel',
    description: 'Arrange your Crossly World emote wheel: an array of emote ids, moment slots or null. Locked or unknown ids are dropped.',
    inputSchema: { type: 'object', properties: { wheel: { type: 'array', items: { type: ['string', 'null'] }, maxItems: 8, description: 'Slots in order.' } }, required: ['wheel'], additionalProperties: false },
    handler: (args) => apiPut('/v1/world/emotes/wheel', { wheel: (args as { wheel: Array<string | null> }).wheel }),
  },
  {
    name: 'set_world_active_pet',
    description: 'Walk one of your pets with you in Crossly World, or none (kind: null).',
    inputSchema: { type: 'object', properties: { kind: { type: ['string', 'null'], description: 'A pet kind you own, or null.' } }, required: ['kind'], additionalProperties: false },
    handler: (args) => apiPut('/v1/world/pets/active', { kind: (args as { kind: string | null }).kind }),
  },
  {
    name: 'list_world_dms',
    description: 'Your Crossly World friends (mutual follows) you can direct-message, each with the last line between you and how many of theirs you have not read; most recent first.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/dms', {}),
  },
  {
    name: 'get_world_dm_thread',
    description: 'Your direct-message thread with one Crossly World friend, oldest first (the last 100 lines). Reading it marks their lines read.',
    inputSchema: {
      type: 'object',
      properties: { userId: { type: 'string', format: 'uuid', description: "The friend's user id (from list_world_dms)." } },
      required: ['userId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { userId } = args as { userId: string };
      return apiGet(`/v1/world/dms/${encodeURIComponent(userId)}`, {});
    },
  },
  {
    name: 'send_world_dm',
    description: 'Send a direct message to a Crossly World friend (a mutual follow; never across a block), up to 400 characters, through the world chat guard.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid', description: "The friend's user id (from list_world_dms)." },
        text: { type: 'string', minLength: 1, maxLength: 400, description: 'The message.' },
      },
      required: ['userId', 'text'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { userId, text } = args as { userId: string; text: string };
      return apiPost(`/v1/world/dms/${encodeURIComponent(userId)}`, { text });
    },
  },
  {
    name: 'get_world_crew_chat',
    description: 'Your Crossly World crew chat: the last 50 lines (from, name, text, at), kept in memory only. 404 when you are in no crew.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/crew/chat', {}),
  },
  {
    name: 'get_world_loadout',
    description:
      'What you are wearing in Crossly World (or, with userId, what somebody else is wearing): each slot\'s cosmetic or real ' +
      'item with its verified-purchase mark. Carries no price, receipt id, seller or order.',
    inputSchema: {
      type: 'object',
      properties: { userId: { type: 'string', description: 'Optional: another person\'s user id (UUID). Omit for your own loadout.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { userId } = args as { userId?: string };
      return apiGet(userId ? `/v1/world/avatar/loadout/${encodeURIComponent(userId)}` : '/v1/world/avatar/loadout', {});
    },
  },
  {
    name: 'list_world_closet',
    description:
      'Your Crossly purchases you can verifiably wear in the world, newest first (receiptId, title, brand, size, image). ' +
      'Pass a receiptId to equip_world_item.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many to return (1-200).' },
        offset: { type: 'integer', minimum: 0, description: 'How many to skip, for paging.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { limit, offset } = args as { limit?: number; offset?: number };
      const query: Record<string, unknown> = {};
      if (limit !== undefined) query.limit = limit;
      if (offset !== undefined) query.offset = offset;
      return apiGet('/v1/world/avatar/closet', query);
    },
  },
  {
    name: 'list_world_stock_wearables',
    description:
      'Items of your OWN inventory you could wear into a Crossly World room as a walking storefront (inventoryItemId, title, ' +
      'image, slot). Pass an inventoryItemId to equip_world_item.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/avatar/stock', {}),
  },
  {
    name: 'list_world_authored_wearables',
    description:
      'Wearables you authored as a designer: sku, name, slot, priceBaseUnits (COSM base units, string), supply, minted, ' +
      'active (false until reviewed). meta.available is false when COSM is not provisioned.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/avatar/wearables', {}),
  },
  {
    name: 'get_world_cosm_balance',
    description:
      'Your COSM balance: baseUnits (a string; COSM has 6 decimals) and decimals. available:false = COSM is not provisioned ' +
      'on this deployment. Read-only -- COSM is never spent through the API.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/cosm/balance', {}),
  },
  {
    name: 'list_world_cosmetics',
    description:
      'The active Crossly World cosmetics catalogue: sku, name, slot, tier, priceCents (premium tier only, cents), ' +
      'priceBaseUnits (earned tier only, COSM base units string), supply and what it unlocks. Read-only: cosmetics are ' +
      'bought on crossly.net.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['premium', 'earned', 'stake_exclusive'], description: 'Only this tier.' },
        slot: { type: 'string', description: 'Only this slot (e.g. avatar_head, wall, floor).' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { tier, slot } = args as { tier?: string; slot?: string };
      const query: Record<string, unknown> = {};
      if (tier) query.tier = tier;
      if (slot) query.slot = slot;
      return apiGet('/v1/world/cosm/cosmetics', query);
    },
  },
  {
    name: 'list_world_cosm_inventory',
    description:
      'Cosmetics you hold, newest first (cosmeticId, sku, name, slot, tier, edition, acquiredAt). Pass a cosmeticId to ' +
      'equip_world_item to wear one.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/cosm/inventory', {}),
  },
  {
    name: 'list_world_decor_catalogue',
    description:
      'The Decor Shop: every active cosmetic grouped by surface (avatar, home, shop, stall, street) and slot, with price ' +
      '(priceCents for premium = the dollar price, paid in CBX; priceBaseUnits = COSM for earned; never card), editions remaining ("12 of 250 left"), ' +
      'owned + edition number, and buyWith. READ-ONLY: there is no buy or mint tool -- send the user to ' +
      'https://crossly.net/shop/decor?id=<id> to pay or mint. meta.mint says whether minting is open.',
    inputSchema: {
      type: 'object',
      properties: { surface: { type: 'string', enum: ['avatar', 'home', 'shop', 'stall', 'street'], description: 'Only this surface.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { surface } = args as { surface?: string };
      return apiGet('/v1/world/decor/catalogue', surface ? { surface } : {});
    },
  },
  {
    name: 'list_world_my_decor',
    description:
      'Decor the user holds and decor they minted to their wallet, newest first: edition number, surface, what it unlocks, ' +
      'mintState (held | minting | minted), mintAddress and whether it is mintable now. Read-only.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/decor/mine', {}),
  },
  {
    name: 'list_world_decor_inventory',
    description:
      'Decor the user holds, as an INVENTORY. Decor is a quantity: each copy is one unit -- a placed prop uses one copy per placement, ' +
      'a finish (wallpaper, floor, theme, shopfront, facade, sign style, street or booth styles) one copy per space it dresses. Per item: ' +
      'owned, placed, available, and placements (which home / shop room / stall booking / street, and how many). Read-only: placing and ' +
      'retracting happen in the Crossly app or on crossly.net; buying more is https://crossly.net/shop/decor.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/decor/inventory', {}),
  },
  {
    name: 'list_world_interactive_catalogue',
    description:
      'Interactive objects in Crossly World: pieces that run a shared script in a room (dice table, jukebox, arcade, claw machine, ' +
      'fortune booth, karaoke mic, drawing easel, trivia buzzers, and approved creator designs). Per item: model, decorValue, source ' +
      '(first_party | creator), name, blurb, size in metres, cosmeticId (the Decor Shop SKU) and version. Read-only.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/interactive/catalogue', {}),
  },
  {
    name: 'list_world_interactive_designs',
    description:
      "The user's own interactive-object designs (MML documents they wrote), with review state: liveVersion (what every copy runs), " +
      'latestVersion { version, state: pending | approved | rejected | withdrawn | cancelled, decisionNote }, archivedAt (archived: off ' +
      'sale, owned copies keep running), price in COSM base units. Read-only: writing, previewing, submitting and archiving happen on ' +
      'https://crossly.net/shop/decor?tab=interactive.',
    inputSchema: {
      type: 'object',
      properties: { archived: { type: 'string', enum: ['exclude', 'include', 'only'], description: 'Archived designs: exclude (default), include, or only them.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { archived } = args as { archived?: string };
      return apiGet('/v1/world/interactive/designs', archived ? { archived } : {});
    },
  },
  {
    name: 'list_world_trade_table_listings',
    description: 'Your open Trade Block trade listings a Crossly World trade table can be opened on, each with its items\' names.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/trade-tables/listings', {}),
  },
  {
    name: 'list_world_binder',
    description:
      'Your binder: unsold collection items that may be laid on a trade mat -- name, condition, grade, image and valueCents ' +
      '(market value, cents).',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/trade-tables/binder', {}),
  },
  {
    name: 'list_world_friends',
    description:
      'Your friends (mutual follows) with the PUBLIC Crossly World room each is in right now when they chose to be seen by ' +
      'name (else null), and their home slug when they let friends visit.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/friends', {}),
  },
  {
    name: 'get_world_fit_value',
    description:
      'What your current outfit is worth from the order book (cents; last sale else lowest ask per catalogued piece), how ' +
      'many pieces were priced, and whether you show it on your card.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/fit-value', {}),
  },
  {
    name: 'get_world_fit_stats',
    description: 'Your walking storefront, last 7 days: distinct people who tapped "Shop this" or "Offer" on what you wore, and counts of each.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/fits/stats', {}),
  },
  {
    name: 'list_world_best_dressed',
    description: 'This week\'s Crossly World best-dressed board, top ten (name, profile, loves). Named people only.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/best-dressed', {}),
  },
  {
    name: 'list_world_streaks',
    description: 'The longest current daily Crossly World visit streaks (2+ days), top ten. Named people only.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/streaks', {}),
  },
  {
    name: 'get_world_auto_shop',
    description: 'Whether Crossly keeps a world shop for you automatically, and that shop (name, visibility, address) or null.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/auto-shop', {}),
  },
  // ── writes (none moves money) ──
  {
    name: 'wear_world_pin',
    description: 'Wear a quest pin you have EARNED on your Crossly World nameplate, or pin=null to wear none. 403 for an unearned pin.',
    inputSchema: {
      type: 'object',
      properties: { pin: { type: ['string', 'null'], description: 'The pin key from list_world_quests, or null to take it off.' } },
      required: ['pin'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { pin } = args as { pin: string | null };
      return apiPut('/v1/world/quests/pin', { pin });
    },
  },
  {
    name: 'create_world_crew',
    description: 'Start a Crossly World crew you own. Answers its id and the join code to share. Fails 409 when you are already in a crew.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 32, description: 'Crew name (2-32 characters).' },
        tag: { type: 'string', minLength: 2, maxLength: 5, description: 'Nameplate tag: 2-5 letters or digits (uppercased).' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'tag'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as { name: string; tag: string; idempotencyKey?: string };
      return apiPost('/v1/world/crews', body, idempotencyKey);
    },
  },
  {
    name: 'join_world_crew',
    description: 'Join a Crossly World crew by the code a member gave you (max 30 members, one crew per person).',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', minLength: 6, maxLength: 16, description: 'The crew\'s join code.' } },
      required: ['code'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { code } = args as { code: string };
      return apiPost('/v1/world/crews/join', { code });
    },
  },
  {
    name: 'leave_world_crew',
    description: 'Leave your Crossly World crew. If you own it, the crew is disbanded. Idempotent.',
    inputSchema: EMPTY,
    handler: () => apiPost('/v1/world/crews/leave', {}),
  },
  {
    name: 'say_to_world_crew',
    description: 'Say a line to your Crossly World crew (up to 400 characters). Goes through the world chat guard; a blocked or too-quick line is dropped. 404 when you are in no crew.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', minLength: 1, maxLength: 400, description: 'What to say to your crew.' } },
      required: ['text'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { text } = args as { text: string };
      return apiPost('/v1/world/crew/chat', { text });
    },
  },
  {
    name: 'invite_world_friend',
    description:
      '"Join me": notify one friend (a mutual follow) with a link to a PUBLIC Crossly World room. At most once a minute per ' +
      'friend; 404 when they are not a friend or the room is not public.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The friend\'s user id (UUID), from list_world_friends.' },
        slug: { type: 'string', description: 'The public room\'s slug to invite them to.' },
      },
      required: ['userId', 'slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { userId, slug } = args as { userId: string; slug: string };
      return apiPost(`/v1/world/friends/${encodeURIComponent(userId)}/invite`, { slug });
    },
  },
  {
    name: 'equip_world_item',
    description:
      'Wear something you ALREADY own in Crossly World -- give exactly one of cosmeticId (a cosmetic you hold), receiptId ' +
      '(a purchase from list_world_closet) or inventoryItemId (your own stock). The slot comes from the item; replaces ' +
      'whatever was there. Moves no money. Answers your loadout after.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'A cosmetic you hold (from list_world_cosm_inventory).' },
        receiptId: { type: 'string', description: 'A purchase receipt (from list_world_closet).' },
        inventoryItemId: { type: 'string', description: 'An item of your own stock (from list_world_stock_wearables).' },
        slot: { ...SLOT, description: 'Fallback slot for a receipt or stock item with no catalog shape. Ignored for a cosmetic.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { cosmeticId, receiptId, inventoryItemId, slot } = args as {
        cosmeticId?: string; receiptId?: string; inventoryItemId?: string; slot?: string;
      };
      const body = cosmeticId
        ? { cosmeticId }
        : receiptId
          ? { receiptId, ...(slot ? { slot } : {}) }
          : { inventoryItemId, ...(slot ? { slot } : {}) };
      return apiPost('/v1/world/avatar/equip', body);
    },
  },
  {
    name: 'unequip_world_slot',
    description: 'Take off whatever you wear in one Crossly World avatar slot. Idempotent (an empty slot answers removed:false).',
    inputSchema: { type: 'object', properties: { slot: SLOT }, required: ['slot'], additionalProperties: false },
    handler: (args) => {
      const { slot } = args as { slot: string };
      return apiPost('/v1/world/avatar/unequip', { slot });
    },
  },
  {
    name: 'set_world_auto_shop',
    description: 'Turn your automatic Crossly World shop off (made private, never deleted) or back on.',
    inputSchema: {
      type: 'object',
      properties: { enabled: { type: 'boolean', description: 'true = keep an automatic world shop; false = hide it.' } },
      required: ['enabled'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { enabled } = args as { enabled: boolean };
      return apiPatch('/v1/world/auto-shop', { enabled });
    },
  },
  // ── saved outfits (up to 6; applying goes through the equip, so ownership holds) ──
  {
    name: 'list_world_outfits',
    description:
      'Your saved Crossly World outfits (up to 6): id, name, appearance (skin, hair, hairColour, eyes, build) and items -- ' +
      'each worn thing as the door it goes back on by (slot, door: cosmetic | receipt | stock, id, label).',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/outfits', {}),
  },
  {
    name: 'save_world_outfit',
    description:
      'Save what you are wearing in Crossly World now as a named look. Worn things that no longer trace to something you ' +
      'own come back in skipped and are not saved. Fails 409 when you already keep 6 -- delete one first.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 32, description: 'The name of the look (1-32 characters).' },
        appearance: {
          type: 'object',
          description: 'Optional character look to keep with it: { skin, hair, hairColour, eyes, build } keys; unknown keys fall back to the default.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as { name: string; appearance?: Record<string, string>; idempotencyKey?: string };
      return apiPost('/v1/world/outfits', body, idempotencyKey);
    },
  },
  {
    name: 'rename_world_outfit',
    description: 'Rename one of your saved Crossly World outfits.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The outfit id (UUID) from list_world_outfits.' },
        name: { type: 'string', minLength: 1, maxLength: 32, description: 'The new name (1-32 characters).' },
      },
      required: ['id', 'name'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, name } = args as { id: string; name: string };
      return apiPatch(`/v1/world/outfits/${encodeURIComponent(id)}`, { name });
    },
  },
  {
    name: 'delete_world_outfit',
    description: 'Delete one of your saved Crossly World outfits.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The outfit id (UUID) from list_world_outfits.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/world/outfits/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'apply_world_outfit',
    description:
      'Put one of your saved Crossly World outfits on. Each item goes through the normal equip, so anything you no longer ' +
      'own is listed in skipped with the reason; slots the look left empty are emptied. Answers the appearance of the look, ' +
      'applied, skipped and cleared. Moves no money.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The outfit id (UUID) from list_world_outfits.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/outfits/${encodeURIComponent(id)}/apply`, {});
    },
  },
];
