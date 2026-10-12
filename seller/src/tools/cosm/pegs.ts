import { apiDelete, apiGet, apiPut } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmPegs: ToolDef[] = [
  {
    name: 'list_cbx_listing_pegs',
    description:
      "A seller's CBX-pegged listings and why each price last moved. "
      + '`lastReason` is the useful field: repriced, no_rate, below_threshold, '
      + 'clamped_floor, clamped_ceiling or clamped_change. A seller asking why their '
      + 'price has not moved deserves that answer rather than "it should have" — read it '
      + 'before speculating. '
      + 'The repricer uses a 24h MINIMUM rate, never spot. Tracking spot would let '
      + 'somebody pump CBX, watch every pegged ask drop, and buy with cheaply acquired '
      + 'tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerUserId: {
          type: 'string',
          description: 'The seller whose pegs to list.',
        },
      },
      required: ['sellerUserId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/pegs', { sellerUserId: String(args.sellerUserId) }),
  },
  {
    name: 'set_cbx_listing_peg',
    description:
      'Hold a listing\'s CBX ask at a dollar target, repriced hourly against a 24h '
      + 'MINIMUM rate. '
      + 'THREE BOUNDS, EACH FOR A DIFFERENT FAILURE, and they are not interchangeable: '
      + '`maxChangeBps` stops one bad reading posting an absurd ask (it converges over '
      + 'cycles instead); `floorBaseUnits` and `ceilingBaseUnits` are the SELLER\'s own '
      + 'limits, so a sustained real move never posts a price they did not consider; '
      + '`minChangeBps` stops the ask being rewritten for a fraction of a percent. '
      + 'Suggest setting a floor and ceiling — without them a genuine sustained move '
      + 'reprices without any seller-defined stop. '
      + 'BE CLEAR ABOUT WHAT A PEG DOES NOT DO. Accepting CBX means holding CBX. The peg '
      + 'protects the dollar value of the ASK; it cannot protect the value of the tokens '
      + 'once the seller has them.',
    inputSchema: {
      type: 'object',
      properties: {
        platformListingId: {
          type: 'string',
          description: 'The platform listing to peg.',
        },
        sellerUserId: {
          type: 'string',
          description: 'The seller who owns the listing.',
        },
        enabled: {
          type: 'boolean',
          description: 'False keeps the peg configured but stops repricing.',
        },
        targetCents: {
          type: 'integer',
          description:
            'The dollar target to hold, in CENTS. The ask in CBX is derived from this '
            + 'each cycle.',
        },
        floorBaseUnits: {
          type: 'string',
          description:
            'Lowest CBX ask to post, as a STRING of base units. The seller\'s own stop.',
        },
        ceilingBaseUnits: {
          type: 'string',
          description:
            'Highest CBX ask to post, as a STRING of base units. The seller\'s own stop.',
        },
        maxChangeBps: {
          type: 'integer',
          description:
            'Largest single-cycle move, in basis points. Bounds the damage of one bad '
            + 'reading; the peg converges over several cycles instead.',
        },
        minChangeBps: {
          type: 'integer',
          description:
            'Smallest move worth rewriting the ask for, in basis points. Stops churn.',
        },
      },
      required: ['platformListingId', 'sellerUserId', 'enabled', 'targetCents'],
      additionalProperties: false,
    },
    handler: (args) => apiPut('/v1/cosm/pegs', args),
  },
  {
    name: 'remove_cbx_listing_peg',
    description:
      'Stop repricing a listing. The ask STAYS AT ITS CURRENT VALUE — removing a peg '
      + 'does not restore an earlier price, so tell the seller what the ask is now '
      + 'rather than implying a revert.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: {
          type: 'string',
          description: 'The platform listing to unpeg.',
        },
        sellerUserId: {
          type: 'string',
          description: 'The seller who owns the listing.',
        },
      },
      required: ['listingId', 'sellerUserId'],
      additionalProperties: false,
    },
    handler: (args) =>
      // apiDelete is (path, idempotencyKey?, query?) — there is no body
      // parameter. The extra `undefined` pushed the query into a fourth slot
      // that does not exist, so `sellerUserId` was never going to be sent.
      apiDelete(`/v1/cosm/pegs/${encodeURIComponent(String(args.listingId))}`, undefined, {
        sellerUserId: String(args.sellerUserId),
      }),
  },
];
