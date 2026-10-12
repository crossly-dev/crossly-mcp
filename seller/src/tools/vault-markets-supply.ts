import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault supply (api routes/v1/write/vault-markets-supply.ts): send inventory
 * items to the Crossly vault as one box with a prepaid label, see each unit's
 * Instant Exit line, the seller round-up, Market Open invites and waitlists,
 * and Vault Drop-off Partners. Money is integer cents of US dollars; shares
 * are basis points (bps, 100 = 1%).
 */
const CONDITION = { type: 'string', enum: ['DS', 'VNDS', 'Used'], description: 'Vault condition: "DS" deadstock/new, "VNDS" very near deadstock, "Used". A graded slab is "Used" with its gradeKey.' } as const;
const PARCEL = {
  type: 'object',
  description: 'The box, for the prepaid label. Default 12x10x6 in, 48 oz.',
  properties: { lengthIn: { type: 'number' }, widthIn: { type: 'number' }, heightIn: { type: 'number' }, weightOz: { type: 'number' } },
  required: ['lengthIn', 'widthIn', 'heightIn', 'weightOz'],
  additionalProperties: false,
} as const;
const id = (what: string): ToolDef['inputSchema'] => ({ type: 'object', properties: { id: { type: 'string', description: `${what} id (uuid).` } }, required: ['id'], additionalProperties: false });
const slug: ToolDef['inputSchema'] = { type: 'object', properties: { slug: { type: 'string', description: 'The opening key\'s slug, from list_vault_openings.' } }, required: ['slug'], additionalProperties: false };

export const vaultMarketsSupplyTools: ToolDef[] = [
  {
    name: 'send_inventory_to_vault',
    description: 'Send crosslister inventory items (matched to a catalogue variant) to the Crossly vault as one box. Each becomes an inbound vault unit; the box gets one prepaid inbound label. Crosslisted listings stay live; a sale on any channel ships from the vault. Returns { batchId, created, skipped (with reasons), label, labelError }.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', minItems: 1, maxItems: 100, description: 'The inventory items to send (1-100): each inventoryItemId with its vault condition and, for a graded slab, gradeKey.', items: { type: 'object', properties: { inventoryItemId: { type: 'string' }, condition: CONDITION, gradeKey: { type: ['string', 'null'] } }, required: ['inventoryItemId'], additionalProperties: false } },
        autoListBps: { type: ['integer', 'null'], minimum: 5000, maximum: 30000, description: 'Once stored, list each unit in the vault book at this share of the mark (9500 = 95%). Waits while the key has no mark.' },
        lendWhenIdle: { type: 'boolean', description: 'Turn lending on once stored (needs the lending registration, the ID check and the lending terms).' },
        parcel: PARCEL,
      },
      required: ['items'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/supply/send', args),
  },
  {
    name: 'list_vault_deposits',
    description: 'Your units sent to the vault, each with its state and its key\'s Instant Exit line ("Instant Exit now: $X (N% of mark)" or "No market yet"). meta.lendingGate says whether lending is open.',
    inputSchema: { type: 'object', properties: { inventoryItemIds: { type: 'string', description: 'Comma-separated inventory item ids to filter to.' } }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/supply/deposits', args as Record<string, unknown>),
  },
  {
    name: 'update_vault_deposit',
    description: 'Change a deposit\'s toggles: autoListBps (null = do not list) and lendWhenIdle.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Deposit id (uuid), from list_vault_deposits.' }, autoListBps: { type: ['integer', 'null'], minimum: 5000, maximum: 30000, description: 'List the unit in the vault book at this share of the mark once stored (9500 = 95%); null = do not list.' }, lendWhenIdle: { type: 'boolean', description: 'Turn lending on once stored (needs the lending registration, the ID check and the lending terms).' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id: depositId, ...body } = args as { id: string; autoListBps?: number | null; lendWhenIdle?: boolean };
      return apiPatch(`/v1/vault-markets/supply/deposits/${encodeURIComponent(depositId)}`, body);
    },
  },
  {
    name: 'get_vault_batch_label',
    description: 'A box sent to the vault: its prepaid label URL and tracking, or why it has none.',
    inputSchema: id('Batch'),
    handler: (args) => {
      const { id: batchId } = args as { id: string };
      return apiGet(`/v1/vault-markets/supply/batches/${encodeURIComponent(batchId)}`);
    },
  },
  {
    name: 'rebuy_vault_batch_label',
    description: 'Buy the prepaid inbound label for a box again (after the first purchase failed or the label expired). Returns the batch with its label URL and tracking.',
    inputSchema: id('Batch'),
    handler: (args) => {
      const { id: batchId } = args as { id: string };
      return apiPost(`/v1/vault-markets/supply/batches/${encodeURIComponent(batchId)}/label`, {});
    },
  },
  {
    name: 'get_vault_round_up',
    description: 'Your seller round-up: the share of each payout that funds a vault buy, the budget so far and what it is doing (null when none).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/supply/round-up'),
  },
  {
    name: 'set_vault_round_up',
    description: 'Set the round-up: shareBps (100-5000) of each payout released to you adds to a budget; when it covers the cheapest vault unit on bookKey, one unit is bought with your saved card, never above the budget. Nothing is taken from the payout itself.',
    inputSchema: {
      type: 'object',
      properties: { bookKey: { type: 'string', description: 'variantId:condition:gradeKey ("-" when ungraded).' }, shareBps: { type: 'integer', minimum: 100, maximum: 5000, description: 'Share of each released payout that goes to the round-up budget, in basis points (100 = 1%, max 5000 = 50%).' } },
      required: ['bookKey', 'shareBps'],
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/vault-markets/supply/round-up', args),
  },
  {
    name: 'stop_vault_round_up',
    description: 'Stop the round-up (its history stays; an armed buy is cancelled).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiDelete('/v1/vault-markets/supply/round-up'),
  },
  {
    name: 'list_market_open_invites',
    description: 'Market Open invites to you as a dealer: keys Crossly is opening and asks you to quote.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/supply/invites'),
  },
  {
    name: 'answer_market_open_invite',
    description: 'Accept or decline a Market Open invite.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Market Open invite id (uuid).' }, accept: { type: 'boolean', description: 'true to join as a dealer on that key, false to decline.' } }, required: ['id', 'accept'], additionalProperties: false },
    handler: (args) => {
      const { id: inviteId, accept } = args as { id: string; accept: boolean };
      return apiPost(`/v1/vault-markets/supply/invites/${encodeURIComponent(inviteId)}`, { accept });
    },
  },
  {
    name: 'list_vault_openings',
    description: 'Keys opening soon on the vault book (and just opened): units on the shelf, dealers quoting, waitlist size, the mark when the book has one, and your place.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/opening'),
  },
  {
    name: 'get_vault_opening',
    description: 'One key opening on the vault book: units on the shelf, dealers quoting, waitlist size, the mark when the book has one, and your place.',
    inputSchema: slug,
    handler: (args) => {
      const { slug: key } = args as { slug: string };
      return apiGet(`/v1/vault-markets/opening/${encodeURIComponent(key)}`);
    },
  },
  {
    name: 'join_vault_opening_waitlist',
    description: 'Join a key\'s waitlist, optionally with a friend\'s invite code (ref). Inviting moves you up the queue; nobody is paid. Returns your place and your own code.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'Slug of the opening key, from list_vault_openings.' }, ref: { type: ['string', 'null'], description: 'Optional invite code of the person who referred you (moves them up the waitlist; never cash).' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug: s, ref } = args as { slug: string; ref?: string | null };
      return apiPost(`/v1/vault-markets/opening/${encodeURIComponent(s)}/waitlist`, { ref: ref ?? null });
    },
  },
  {
    name: 'leave_vault_opening_waitlist',
    description: 'Leave a key\'s waitlist.',
    inputSchema: slug,
    handler: (args) => {
      const { slug: key } = args as { slug: string };
      return apiDelete(`/v1/vault-markets/opening/${encodeURIComponent(key)}/waitlist`);
    },
  },
  {
    name: 'get_vault_partnership',
    description: 'Your Vault Drop-off Partnership: status, partner code, fee share and cap, totals and batches (null when you never applied).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/partners/me'),
  },
  {
    name: 'apply_vault_partner',
    description: 'Apply as a Vault Drop-off Partner (a card shop that takes walk-ins for the vault). Needs the one-time ID check; ops approve.',
    inputSchema: {
      type: 'object',
      properties: { shopName: { type: 'string', description: 'Trading name of the card shop.' }, address: { type: 'object', additionalProperties: { type: ['string', 'null'] }, description: 'Shop address: line1, line2, city, state, postalCode, country.' }, website: { type: 'string', description: 'Shop website or social page.' }, note: { type: 'string', description: 'Anything ops should know about the shop (volume, categories).' } },
      required: ['shopName'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/partners/apply', args),
  },
  {
    name: 'send_vault_partner_batch',
    description: 'An approved partner sends walk-ins in under its code: each item (catalogue variantId, condition, gradeKey, photo URLs) becomes an inbound vault unit; the box gets one prepaid label. The partner earns a capped share of Crossly\'s fee on each unit\'s first sale.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', minItems: 1, maxItems: 100, description: 'The walk-in items in this box (1-100): catalogue variantId, vault condition, gradeKey for a slab, and photos.', items: { type: 'object', properties: { variantId: { type: 'string' }, condition: CONDITION, gradeKey: { type: ['string', 'null'] }, photos: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string' } } }, required: ['variantId', 'condition', 'photos'], additionalProperties: false } },
        parcel: PARCEL,
      },
      required: ['items'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/partners/batches', args),
  },
  {
    name: 'list_vault_partner_accruals',
    description: 'Your partner fee shares: accrued on a unit\'s first sale, paid in Bucks once the sale is final, void if refunded.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/partners/accruals'),
  },
];
