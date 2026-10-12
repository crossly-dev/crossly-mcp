import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmCosmetics: ToolDef[] = [
  {
    name: 'list_cosm_cosmetics',
    description:
      'The cosmetics catalogue. TIERS ARE DISJOINT and no SKU has two prices: `premium` '
      + 'is CASH only (`priceCents`), `earned` is COSM only (`priceBaseUnits`), and '
      + '`stake_exclusive` cannot be bought at any price in any currency — it is granted '
      + 'on stake TENURE. '
      + 'Never imply a premium item can be earned with COSM or that a stake-exclusive one '
      + 'is purchasable; the disjointness is enforced by database constraints because '
      + 'pricing one SKU in both currencies would be arbitrageable.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: {
          type: 'string',
          enum: ['premium', 'earned', 'stake_exclusive'],
          description: 'Filter by tier.',
        },
        slot: {
          type: 'string',
          description:
            'Filter by slot, e.g. avatar_head, room_material, room_prop, nameplate.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const query: Record<string, string> = {};
      if (args.tier) query.tier = String(args.tier);
      if (args.slot) query.slot = String(args.slot);
      return apiGet('/v1/cosm/cosmetics', Object.keys(query).length ? query : undefined);
    },
  },
  {
    name: 'buy_cosm_cosmetic',
    description:
      'Buy an earned-tier cosmetic with COSM. THE COSM IS DESTROYED — it is not credited '
      + 'to Crossly, and it no longer exists afterwards. '
      + 'Refuses a premium SKU (cash only) or a stake-exclusive one (not purchasable). '
      + 'Also counts toward any open community burn goal. '
      + 'Confirm the spend with the user before calling: there is no refund, because '
      + 'refunding a burn would mean minting.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'The cosmetic id from the catalogue.' },
        subjectId: { type: 'string', description: 'The CBX subject buying it.' },
      },
      required: ['cosmeticId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(`/v1/cosm/cosmetics/${encodeURIComponent(String(args.cosmeticId))}/buy`, {
        subjectId: String(args.subjectId),
      }),
  },
  {
    name: 'list_cosm_inventory',
    description:
      'Cosmetics a subject holds. `bound` true means it can NEVER be traded or fused — '
      + 'that applies to stake-exclusive grants and make-goods, and is enforced by a '
      + 'database constraint rather than a setting somebody can change. '
      + '`editionNumber` identifies the item and travels with it through a sale.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: 'The CBX subject whose cosmetics to list. Must be one you own.',
        },
      },
      required: ['subjectId'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/cosm/inventory', { subjectId: String(args.subjectId) }),
  },
  {
    name: 'list_cosm_unlocks',
    description:
      'Which spatial cosmetic values a subject may apply to their rooms. Values no SKU '
      + 'claims — the stock walls, floors and themes — are FREE and are not listed here, '
      + 'so an empty result does not mean they can change nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: 'The CBX subject whose spatial unlocks to list. Must be one you own.',
        },
      },
      required: ['subjectId'],
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/cosm/unlocks', { subjectId: String(args.subjectId) }),
  },
];
