import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Pack openings: published odds, provably-fair pulls of real items into the
 * buyer's vault, sell-back for credit. Opening SPENDS MONEY (the saved card):
 * buyer:checkout:write, the key's spending controls, and an idempotencyKey.
 *
 * Dispatches through a function declared above the array, so the v1-parity
 * scanner cannot cross GET and POST actions.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function packs(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string; id?: string; confirmAdult?: boolean; paymentMethodId?: string; clientSeed?: string; idempotencyKey?: string };
  switch (a.action) {
    case 'list': return apiGet('/v1/buyer/packs');
    case 'get': return apiGet(`/v1/buyer/packs/${need(a.slug, "slug")}`);
    case 'openings': return apiGet('/v1/buyer/pack-openings');
    case 'fairness': return apiGet('/v1/buyer/packs/fairness');
    case 'rotate_seed': return apiPost('/v1/buyer/packs/fairness/rotate', a.clientSeed ? { clientSeed: a.clientSeed } : {});
    case 'sell_back': return apiPost(`/v1/buyer/pack-openings/${need(a.id, "id")}/sell-back`, {});
    case 'open':
      if (a.confirmAdult !== true) throw new Error('confirmAdult must be true: the buyer confirms they are 18 or older');
      return apiPost(`/v1/buyer/packs/${need(a.slug, "slug")}/open`, { confirmAdult: true, ...(a.paymentMethodId ? { paymentMethodId: a.paymentMethodId } : {}) }, a.idempotencyKey);
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

export const buyerPackTools: ToolDef[] = [
  {
    name: 'packs',
    description: "Mystery packs with PUBLISHED odds: list / get show every tier's odds, items left, value range and the expected value of one opening; open CHARGES the pack price to the saved card and pulls one real item into the buyer's Crossly vault (confirmAdult true, buyer:checkout:write + idempotencyKey); openings lists pulls with their fairness proof; sell_back trades a pull for Crossly credit at the pack's buyback rate; fairness shows the server-seed commitment and revealed seeds; rotate_seed reveals the current seed so past pulls can be re-run.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'open', 'openings', 'sell_back', 'fairness', 'rotate_seed'], description: "list = all packs with odds; get = one pack (slug); open = buy and open one (slug, confirmAdult; CHARGES the saved card); openings = your pulls with fairness proofs; sell_back = trade a pull for Crossly credit (id); fairness = server-seed commitment and revealed seeds; rotate_seed = reveal the current seed and start a new one (optional clientSeed)." },
        slug: { type: 'string', description: 'The pack slug (from list).' },
        id: { type: 'string', description: 'sell_back: the opening id (from openings).' },
        confirmAdult: { type: 'boolean', description: 'open: must be true — the buyer is 18 or older.' },
        paymentMethodId: { type: 'string', description: 'A saved card. Never card data.' },
        clientSeed: { type: 'string', description: 'rotate_seed: your own client seed (1–64 of A-Z a-z 0-9 - _).' },
        idempotencyKey: { type: 'string', description: 'Sent as the Idempotency-Key header. Stable per intent.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => packs(args),
  },
];
